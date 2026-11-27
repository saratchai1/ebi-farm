import test from 'node:test';
import assert from 'node:assert/strict';
import { PONDS, SCENARIOS, MODEL_INFO, buildSnapshot } from '../src/model.js';

const lastDo = points => points.at(-1)?.do;

test('the default four-pond view distinguishes normal, watch and critical states', () => {
  assert.equal(PONDS.length, 4);
  assert.deepEqual(SCENARIOS.map(scenario => scenario.id), ['normal', 'night', 'rain', 'sun', 'outage', 'sensor']);
  const snapshots = PONDS.map(pond => buildSnapshot({ pondId: pond.id }));
  assert.deepEqual(snapshots.map(snapshot => snapshot.risk.level), ['normal', 'watch', 'watch', 'critical']);
  assert.ok(snapshots[2].forecast.minutesToThresholdBaseline > 0);
  assert.equal(snapshots[0].forecast.minutesToThresholdBaseline, null);
  assert.equal(snapshots[1].forecast.minutesToThresholdBaseline, 0);
});

test('identical inputs produce identical synthetic observations and forecasts', () => {
  const options = { pondId: 'P03', scenarioId: 'rain', elapsedMinutes: 72.5, proposedAerators: 4, feedFactor: 0.8, backupPower: true };
  assert.deepEqual(buildSnapshot(options), buildSnapshot(options));
});

test('pending controls never rewrite measurements, history, baseline or current risk', () => {
  for (const scenario of SCENARIOS) {
    const initial = buildSnapshot({ pondId: 'P03', scenarioId: scenario.id, elapsedMinutes: 15, proposedAerators: 0, feedFactor: 1.5 });
    const proposed = buildSnapshot({ pondId: 'P03', scenarioId: scenario.id, elapsedMinutes: 15, proposedAerators: 8, feedFactor: 0.5, backupPower: true });
    for (const key of ['metrics', 'surfaceDO', 'bottomDO', 'history', 'risk', 'quality', 'clock']) {
      assert.deepEqual(proposed[key], initial[key], `${scenario.id}: ${key}`);
    }
    assert.deepEqual(proposed.forecast.baseline, initial.forecast.baseline, scenario.id);
    assert.equal(proposed.forecast.baselineMin, initial.forecast.baselineMin);
  }
});

test('additional powered aeration improves the proposed oxygen trajectory', () => {
  for (const pond of PONDS) {
    for (const scenarioId of ['normal', 'night', 'rain', 'sun']) {
      const low = buildSnapshot({ pondId: pond.id, scenarioId, proposedAerators: 0 });
      const high = buildSnapshot({ pondId: pond.id, scenarioId, proposedAerators: pond.totalAerators });
      assert.ok(lastDo(high.forecast.proposed) > lastDo(low.forecast.proposed), `${pond.id}/${scenarioId}: final DO`);
      high.forecast.proposed.forEach((point, index) => {
        assert.ok(point.do >= low.forecast.proposed[index].do, `${pond.id}/${scenarioId}: minute ${point.minute}`);
      });
    }
  }
});

test('aeration requests have no oxygen or electricity effect during an outage without backup', () => {
  const zero = buildSnapshot({ pondId: 'P03', scenarioId: 'outage', proposedAerators: 0 });
  const requested = buildSnapshot({ pondId: 'P03', scenarioId: 'outage', proposedAerators: 8 });
  assert.equal(requested.equipment.active, 0);
  assert.equal(requested.equipment.powerAvailable, false);
  assert.equal(requested.equipment.effectiveProposed, 0);
  assert.equal(requested.equipment.proposedKw, 0);
  assert.equal(requested.forecast.energyDeltaKwh, 0);
  assert.deepEqual(requested.forecast.proposed, zero.forecast.proposed);
  assert.deepEqual(requested.forecast.proposed, requested.forecast.baseline);
});

test('backup power changes only the outage intervention, leaving the outage baseline intact', () => {
  const options = { pondId: 'P03', scenarioId: 'outage', proposedAerators: 5 };
  const withoutBackup = buildSnapshot(options);
  const withBackup = buildSnapshot({ ...options, backupPower: true });
  assert.equal(withBackup.equipment.active, 0);
  assert.equal(withBackup.equipment.powerAvailable, false);
  assert.equal(withBackup.equipment.effectiveProposed, 5);
  assert.ok(withBackup.equipment.proposedKw > 0);
  assert.ok(withBackup.forecast.energyDeltaKwh > 0);
  assert.ok(lastDo(withBackup.forecast.proposed) > lastDo(withoutBackup.forecast.proposed));
  assert.deepEqual(withBackup.forecast.baseline, withoutBackup.forecast.baseline);
  assert.deepEqual(withBackup.metrics, withoutBackup.metrics);
  assert.deepEqual(withBackup.risk, withoutBackup.risk);
});

test('a lower projected feed load improves the forecast without changing present observations', () => {
  const base = { pondId: 'P03', scenarioId: 'night', proposedAerators: 3 };
  const low = buildSnapshot({ ...base, feedFactor: 0.6 });
  const high = buildSnapshot({ ...base, feedFactor: 1.4 });
  assert.ok(lastDo(low.forecast.proposed) > lastDo(high.forecast.proposed));
  assert.deepEqual(low.metrics, high.metrics);
  assert.deepEqual(low.forecast.baseline, high.forecast.baseline);
  assert.deepEqual(low.risk, high.risk);
});

test('missing oxygen telemetry always yields unknown risk and no forecast', () => {
  for (const pond of PONDS) {
    const snapshot = buildSnapshot({ pondId: pond.id, scenarioId: 'sensor', proposedAerators: 8, feedFactor: 0, backupPower: true });
    assert.equal(snapshot.metrics.do, null);
    assert.equal(snapshot.surfaceDO, null);
    assert.equal(snapshot.bottomDO, null);
    assert.equal(snapshot.quality.status, 'missing');
    assert.equal(snapshot.risk.level, 'unknown');
    assert.deepEqual(snapshot.forecast.baseline, []);
    assert.deepEqual(snapshot.forecast.proposed, []);
    for (const key of ['baselineMin', 'proposedMin', 'minutesToThresholdBaseline', 'minutesToThresholdProposed']) {
      assert.equal(snapshot.forecast[key], null, key);
    }
    assert.ok(snapshot.history.every(point => point.do === null));
  }
});

test('night, rain and sun scenarios expose distinct environmental mechanisms', () => {
  const normal = buildSnapshot({ scenarioId: 'normal' });
  const night = buildSnapshot({ scenarioId: 'night' });
  const rain = buildSnapshot({ scenarioId: 'rain' });
  const sun = buildSnapshot({ scenarioId: 'sun' });
  assert.equal(night.metrics.solar, 0);
  assert.ok(night.metrics.do < normal.metrics.do);
  assert.ok(rain.metrics.rain > 0);
  assert.ok(rain.metrics.salinity < normal.metrics.salinity);
  assert.ok(rain.surfaceDO - rain.bottomDO > normal.surfaceDO - normal.bottomDO);
  assert.ok(sun.metrics.temperature > normal.metrics.temperature);
  assert.ok(sun.metrics.ph > normal.metrics.ph);
  assert.ok(sun.risk.reasons.some(reason => reason.id === 'ammonia-context'));
});

test('critical oxygen conditions cannot be downgraded by less severe weather explanations', () => {
  for (const scenarioId of ['normal', 'night', 'rain', 'sun', 'outage']) {
    const snapshot = buildSnapshot({ pondId: 'P04', scenarioId, proposedAerators: 4, feedFactor: 0, backupPower: true });
    assert.equal(snapshot.risk.level, 'critical', scenarioId);
    assert.ok(snapshot.risk.reasons.some(reason => reason.severity === 'critical'));
  }
});

test('a severe baseline forecast can trigger critical risk before measured DO crosses 3 mg/L', () => {
  const snapshot = buildSnapshot({ pondId: 'P03', scenarioId: 'outage' });
  assert.ok(snapshot.metrics.do > snapshot.thresholds.criticalDO);
  assert.ok(snapshot.bottomDO > snapshot.thresholds.criticalDO);
  assert.ok(snapshot.forecast.baselineMin < snapshot.thresholds.criticalDO);
  assert.equal(snapshot.risk.level, 'critical');
  assert.ok(snapshot.risk.reasons.some(reason => reason.id === 'forecast-critical'));
});

test('history and both forecasts are anchored to the same present observation', () => {
  for (const pond of PONDS) {
    for (const scenario of SCENARIOS.filter(item => item.id !== 'sensor')) {
      const snapshot = buildSnapshot({ pondId: pond.id, scenarioId: scenario.id, elapsedMinutes: 27.25 });
      assert.equal(snapshot.history[0].minute, -180);
      assert.equal(snapshot.history.at(-1).minute, 0);
      assert.equal(snapshot.history.at(-1).do, snapshot.metrics.do);
      for (const path of [snapshot.forecast.baseline, snapshot.forecast.proposed]) {
        assert.deepEqual(path[0], { minute: 0, do: snapshot.metrics.do, low: snapshot.metrics.do, high: snapshot.metrics.do });
        assert.equal(path.at(-1).minute, 180);
      }
    }
  }
});

test('the assumption envelope encloses the trajectory and values remain finite and bounded', () => {
  for (const pond of PONDS) {
    for (const scenario of SCENARIOS) {
      for (const elapsedMinutes of [0, 90, 720]) {
        const snapshot = buildSnapshot({ pondId: pond.id, scenarioId: scenario.id, elapsedMinutes, proposedAerators: 8, feedFactor: 0.7, backupPower: true });
        assert.match(snapshot.clock.label, /^\d{2}:\d{2}$/);
        assert.ok(snapshot.clock.hour >= 0 && snapshot.clock.hour < 24);
        for (const value of Object.values(snapshot.metrics)) {
          assert.ok(value === null || Number.isFinite(value));
        }
        for (const path of [snapshot.forecast.baseline, snapshot.forecast.proposed]) {
          path.forEach((point, index) => {
            for (const key of ['do', 'low', 'high']) {
              assert.ok(Number.isFinite(point[key]));
              assert.ok(point[key] >= 0 && point[key] <= 10, `${pond.id}/${scenario.id}/${key}`);
            }
            assert.ok(point.low <= point.do && point.do <= point.high);
            if (index) assert.ok(point.minute > path[index - 1].minute);
          });
        }
        for (const point of snapshot.history) {
          assert.ok(point.do === null || (Number.isFinite(point.do) && point.do >= 0 && point.do <= 10));
        }
      }
    }
  }
});

test('energy change uses total proposed machines, with additional consumption positive', () => {
  const same = buildSnapshot({ pondId: 'P01', proposedAerators: 3 });
  const more = buildSnapshot({ pondId: 'P01', proposedAerators: 4 });
  const fewer = buildSnapshot({ pondId: 'P01', proposedAerators: 2 });
  assert.equal(same.forecast.energyDeltaKwh, 0);
  assert.equal(more.forecast.energyDeltaKwh, 4.5);
  assert.equal(fewer.forecast.energyDeltaKwh, -4.5);
});

test('invalid selections and non-finite controls fall back to a bounded usable snapshot', () => {
  const snapshot = buildSnapshot({ pondId: 'invalid', scenarioId: 'invalid', elapsedMinutes: NaN, proposedAerators: Infinity, feedFactor: NaN });
  assert.deepEqual(snapshot, buildSnapshot());
  const clamped = buildSnapshot({ proposedAerators: 999, feedFactor: -10, elapsedMinutes: -50 });
  assert.equal(clamped.equipment.proposed, clamped.pond.totalAerators);
  assert.equal(clamped.clock.label, buildSnapshot().clock.label);
  assert.ok(clamped.forecast.proposed.every(point => Number.isFinite(point.do)));
});

test('model metadata explicitly identifies synthetic data and an uncalibrated assumption band', () => {
  assert.equal(MODEL_INFO.mode, 'synthetic-demo');
  assert.equal(MODEL_INFO.thresholdCrossing, 'warningDO');
  assert.match(MODEL_INFO.uncertaintyLabel, /ไม่ใช่ช่วงความเชื่อมั่น/);
  assert.match(MODEL_INFO.disclaimer, /ไม่ใช่การวินิจฉัยโรค/);
  assert.deepEqual(buildSnapshot().thresholds, { warningDO: 5, criticalDO: 3 });
});
