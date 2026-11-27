/**
 * Deterministic shrimp-pond teaching model.
 *
 * Every observation, pond and parameter in this module is synthetic. The
 * oxygen balance and sensitivity envelope illustrate a digital-twin workflow;
 * they are not a calibrated farm model, a mortality probability or a disease
 * diagnosis. Proposed controls never modify the synthetic measurements.
 */

export const PONDS = Object.freeze([
  { id: 'P01', name: 'บ่อ 01', cropDay: 45, areaRai: 1.8, depth: 1.45, biomassKg: 2400, stockCount: 180000, feedKg: 96, totalAerators: 6 },
  { id: 'P02', name: 'บ่อ 02', cropDay: 63, areaRai: 2, depth: 1.35, biomassKg: 4200, stockCount: 210000, feedKg: 168, totalAerators: 6 },
  { id: 'P03', name: 'บ่อ 03', cropDay: 78, areaRai: 2.4, depth: 1.5, biomassKg: 6000, stockCount: 220000, feedKg: 210, totalAerators: 8 },
  { id: 'P04', name: 'บ่อ 04', cropDay: 58, areaRai: 1.6, depth: 1.3, biomassKg: 3600, stockCount: 160000, feedKg: 145, totalAerators: 4 },
].map(Object.freeze));

export const SCENARIOS = Object.freeze([
  { id: 'normal', name: 'วันปกติ', subtitle: 'สภาพบ่อและการเดินเครื่องตามตัวอย่าง', startHour: 14 },
  { id: 'night', name: 'ก่อนรุ่งเช้า', subtitle: 'แสงน้อยและความต้องการออกซิเจนสะสม', startHour: 2.5 },
  { id: 'rain', name: 'ฝนหนัก', subtitle: 'ความเค็มเปลี่ยนและชั้นน้ำต่างกัน', startHour: 16.5 },
  { id: 'sun', name: 'แดดจัด', subtitle: 'น้ำร้อนและ pH สูง ต้องตรวจร่วมกับ TAN', startHour: 13.5 },
  { id: 'outage', name: 'ไฟฟ้าดับ', subtitle: 'เครื่องตีน้ำหยุด ทดลองแหล่งจ่ายสำรอง', startHour: 1.5 },
  { id: 'sensor', name: 'เซ็นเซอร์ขาดหาย', subtitle: 'ข้อมูล DO ไม่พอสำหรับการพยากรณ์', startHour: 5 },
].map(Object.freeze));

export const MODEL_INFO = Object.freeze({
  name: 'Ebi Farm · illustrative oxygen balance',
  version: '1.0.0',
  mode: 'synthetic-demo',
  disclaimer: 'ข้อมูลและแบบจำลองทั้งหมดเป็นข้อมูลสาธิต ยังไม่ได้สอบเทียบกับฟาร์มจริง ไม่ใช่การวินิจฉัยโรคหรือความน่าจะเป็นที่กุ้งจะตาย',
  uncertaintyLabel: 'ช่วงจากสมมติฐานการเติมอากาศ/แสง ±20% และความต้องการออกซิเจน ±15% ไม่ใช่ช่วงความเชื่อมั่นที่ผ่านการสอบเทียบ',
  thresholdNote: 'DO 5 และ 3 mg/L เป็นเกณฑ์สาธิต ต้องกำหนดร่วมกับผู้ดูแลฟาร์มตามชนิดกุ้ง อายุ และระบบเลี้ยง',
  saturationNote: 'เพดานการละลายออกซิเจนเป็นค่าประมาณเชิงสาธิต แบบจำลองนี้ไม่จำลองภาวะออกซิเจนเกินอิ่มตัว',
  forecastMinutes: 180,
  historyMinutes: 180,
  stepMinutes: 5,
  integrationMinutes: 1,
  thresholdCrossing: 'warningDO',
  energyDeltaDefinition: 'proposed electricity minus baseline electricity over the forecast horizon; positive means additional kWh',
  feedAccountingNote: 'feedKg is reference kg/day; effective feed-associated oxygen demand is spread over 24 hours. The demo does not model the delay between feeding and oxygen consumption.',
  units: Object.freeze({ do: 'mg/L', temperature: '°C', ph: 'pH', salinity: 'ppt', rain: 'mm/h', solar: 'W/m²', wind: 'm/s', waterLevel: 'm', tan: 'mg N/L', nitrite: 'mg N/L' }),
  coefficients: Object.freeze({ aeratorKw: 1.5, aeratorZeroDoTransferKgPerHour: 3.6, shrimpOxygenKgPerKgHour: 0.00026, feedOxygenKgPerKg: 0.108, photosynthesisMaxMgLHour: 0.68, passiveExchangePerHour: 0.045 }),
});

const THRESHOLDS = Object.freeze({ warningDO: 5, criticalDO: 3 });
const POND_STATE = Object.freeze({
  P01: { do: 6.4, active: 3, salinity: 18, temperatureOffset: 0, sediment: 0.16, tan: 0.35, nitrite: 0.12, phase: 0.2 },
  P02: { do: 4.7, active: 2, salinity: 20, temperatureOffset: 0.3, sediment: 0.23, tan: 0.65, nitrite: 0.19, phase: 1.1 },
  P03: { do: 5.25, active: 2, salinity: 16, temperatureOffset: 0.5, sediment: 0.42, tan: 0.85, nitrite: 0.25, phase: 2.2 },
  P04: { do: 2.8, active: 1, salinity: 22, temperatureOffset: 0.2, sediment: 0.3, tan: 0.75, nitrite: 0.22, phase: 2.9 },
});

const SCENARIO_DO_OFFSET = Object.freeze({ normal: 0, night: -1.15, rain: -0.7, sun: 0.2, outage: -1.5, sensor: 0 });
const SCENARIO_TREND = Object.freeze({ normal: -0.12, night: -0.34, rain: -0.5, sun: 0.14, outage: -1.25, sensor: 0 });

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function round(value, decimals = 2) { return Number(value.toFixed(decimals)); }
function finiteNumber(value, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function hourAt(scenario, elapsedMinutes) { return ((scenario.startHour + elapsedMinutes / 60) % 24 + 24) % 24; }
function daylight(hour) { return Math.max(0, Math.sin((hour - 6) / 12 * Math.PI)); }
function clockAt(scenario, elapsedMinutes) {
  const hour = hourAt(scenario, elapsedMinutes);
  const minuteOfDay = Math.floor(hour * 60 + 1e-7) % 1440;
  return { hour, label: `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}` };
}

/** Approximate mg/L saturation cap, deliberately identified as illustrative. */
function saturation(temperature, salinity) {
  return clamp(8.3 - 0.15 * (temperature - 25) - 0.04 * salinity, 4.5, 10);
}

function environmentAt(pond, scenario, elapsedMinutes) {
  const state = POND_STATE[pond.id];
  const hour = hourAt(scenario, elapsedMinutes);
  const light = daylight(hour);
  const rain = scenario.id === 'rain' ? 28 + 4 * Math.sin(elapsedMinutes / 55 + state.phase) : 0;
  const solarFactor = scenario.id === 'rain' ? 0.14 : scenario.id === 'sun' ? 1 : 0.78;
  const baseTemperature = scenario.id === 'sun' ? 32.8 : scenario.id === 'rain' ? 26.7 : 28.1;
  const temperature = baseTemperature + state.temperatureOffset + 0.85 * Math.sin((hour - 9) / 24 * 2 * Math.PI);
  const salinityDrop = scenario.id === 'rain' ? 4 + 0.9 * Math.tanh(elapsedMinutes / 130) : 0;
  const salinity = state.salinity - salinityDrop + 0.12 * Math.sin(elapsedMinutes / 100 + state.phase);
  const ph = scenario.id === 'sun' ? 8.95 + 0.12 * light : scenario.id === 'rain' ? 7.65 + 0.08 * light : 7.78 + 0.52 * light;
  return {
    temperature: round(temperature),
    ph: round(ph),
    salinity: round(salinity),
    rain: round(rain, 1),
    solar: Math.round(1000 * light * solarFactor),
    wind: round(scenario.id === 'rain' ? 3.2 + 0.4 * Math.sin(elapsedMinutes / 80) : 1.3 + 0.25 * Math.sin(elapsedMinutes / 90 + state.phase), 1),
    waterLevel: round(pond.depth + (scenario.id === 'rain' ? 0.07 + 0.025 * Math.tanh(elapsedMinutes / 120) : 0)),
    tan: round(state.tan + (scenario.id === 'sun' ? 0.15 : 0)),
    nitrite: state.nitrite,
  };
}

/**
 * Synthetic observation generator, independent of proposed interventions.
 * Smooth, bounded deterministic curves stand in for telemetry in this demo.
 */
function observationAt(pond, scenario, elapsedMinutes, environment) {
  if (scenario.id === 'sensor') return null;
  const state = POND_STATE[pond.id];
  const dayWave = 0.28 * (Math.sin((hourAt(scenario, elapsedMinutes) - 9) / 24 * 2 * Math.PI) - Math.sin((scenario.startHour - 9) / 24 * 2 * Math.PI));
  const smallWave = 0.055 * (Math.sin(elapsedMinutes / 52 + state.phase) - Math.sin(state.phase));
  const trend = SCENARIO_TREND[scenario.id] * Math.tanh(elapsedMinutes / 150);
  return round(clamp(state.do + SCENARIO_DO_OFFSET[scenario.id] + dayWave + smallWave + trend, 0, saturation(environment.temperature, environment.salinity)));
}

/**
 * Oxygen concentration derivative in mg/L/hour.
 * 1 kg O2 in 1 m³ = 1000 mg/L, hence the kg-to-concentration conversion.
 */
function oxygenRate(concentration, pond, scenario, elapsedMinutes, aerators, feedFactor, variation) {
  const environment = environmentAt(pond, scenario, elapsedMinutes);
  const state = POND_STATE[pond.id];
  const volumeM3 = pond.areaRai * 1600 * environment.waterLevel;
  const sat = saturation(environment.temperature, environment.salinity);
  const c = MODEL_INFO.coefficients;
  const tempFactor = clamp(1.06 ** (environment.temperature - 28), 0.65, 1.65);
  const aeration = aerators * c.aeratorZeroDoTransferKgPerHour * 1000 / volumeM3 * Math.max(0, 1 - concentration / sat) * variation.supply;
  const passiveExchange = c.passiveExchangePerHour * (sat - concentration);
  const photosynthesis = c.photosynthesisMaxMgLHour * environment.solar / 1000 * variation.supply;
  const shrimpRespiration = pond.biomassKg * c.shrimpOxygenKgPerKgHour * 1000 / volumeM3;
  const feedDemand = (pond.feedKg / 24) * c.feedOxygenKgPerKg * feedFactor * 1000 / volumeM3;
  const algaeRespiration = 0.12 + (scenario.id === 'night' ? 0.07 : 0);
  const rainLayerDemand = scenario.id === 'rain' ? 0.12 / (1 + 0.25 * aerators) : 0;
  const demand = (shrimpRespiration + feedDemand + state.sediment + algaeRespiration + rainLayerDemand) * tempFactor * variation.demand;
  return { rate: aeration + passiveExchange + photosynthesis - demand, saturation: sat };
}

function forecastPath(pond, scenario, elapsedMinutes, currentDo, aerators, feedFactor) {
  const variations = {
    center: { supply: 1, demand: 1 },
    lower: { supply: 0.8, demand: 1.15 },
    upper: { supply: 1.2, demand: 0.85 },
  };
  const state = { center: currentDo, lower: currentDo, upper: currentDo };
  const points = [{ minute: 0, do: currentDo, low: currentDo, high: currentDo }];
  for (let minute = 1; minute <= MODEL_INFO.forecastMinutes; minute += 1) {
    for (const key of Object.keys(state)) {
      const next = oxygenRate(state[key], pond, scenario, elapsedMinutes + minute - 0.5, aerators, feedFactor, variations[key]);
      state[key] = clamp(state[key] + next.rate / 60, 0, next.saturation);
    }
    if (minute % MODEL_INFO.stepMinutes === 0) {
      const center = round(state.center);
      points.push({ minute, do: center, low: Math.min(center, round(state.lower)), high: Math.max(center, round(state.upper)) });
    }
  }
  return points;
}

function minimum(points) { return points.length ? Math.min(...points.map(point => point.do)) : null; }

/** First crossing of the demonstration warning threshold; not time to death. */
function minutesToThreshold(points, threshold) {
  if (!points.length) return null;
  if (points[0].do <= threshold) return 0;
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 1];
    const after = points[index];
    if (after.do <= threshold) {
      const portion = (before.do - threshold) / (before.do - after.do);
      return round(before.minute + portion * (after.minute - before.minute), 1);
    }
  }
  return null;
}

function assessRisk(metrics, bottomDO, scenario, forecast, equipment) {
  if (metrics.do === null) {
    return {
      level: 'unknown',
      title: 'ข้อมูลไม่พอประเมิน',
      summary: 'ข้อมูล DO ขาดหาย จึงหยุดการพยากรณ์และไม่แสดงสถานะปลอดภัยจากค่าครั้งก่อน',
      reasons: [{ id: 'missing-do', title: 'ไม่พบข้อมูลออกซิเจนล่าสุด', detail: 'ตรวจเซ็นเซอร์และวัดยืนยันในบ่อก่อนใช้ผลประเมิน ระบบยังไม่ได้ส่งคำสั่งควบคุมอุปกรณ์', severity: 'unknown' }],
    };
  }

  const reasons = [];
  let level = 'normal';
  const promote = next => {
    const rank = { normal: 0, watch: 1, critical: 2 };
    if (rank[next] > rank[level]) level = next;
  };
  const add = (id, title, detail, severity) => {
    reasons.push({ id, title, detail, severity });
    promote(severity);
  };

  if (metrics.do <= THRESHOLDS.criticalDO || bottomDO <= THRESHOLDS.criticalDO) {
    add('critical-do', 'ออกซิเจนต่ำถึงเกณฑ์วิกฤตสาธิต', `DO จุดหลัก ${metrics.do.toFixed(2)} และใกล้พื้นบ่อ ${bottomDO.toFixed(2)} mg/L ควรตรวจยืนยันและใช้ขั้นตอนตอบสนองของฟาร์ม`, 'critical');
  } else if (metrics.do <= THRESHOLDS.warningDO || bottomDO <= THRESHOLDS.warningDO) {
    add('low-do', 'ออกซิเจนต่ำกว่าเกณฑ์เฝ้าระวังสาธิต', `DO จุดหลัก ${metrics.do.toFixed(2)} และใกล้พื้นบ่อ ${bottomDO.toFixed(2)} mg/L`, 'watch');
  }

  if (forecast.baselineMin <= THRESHOLDS.criticalDO) {
    add('forecast-critical', 'แนวโน้มเดิมอาจเข้าเกณฑ์วิกฤต', `ค่าต่ำสุดจำลองใน 3 ชั่วโมง ${forecast.baselineMin.toFixed(2)} mg/L ผลนี้ขึ้นกับสมมติฐานและยังไม่ได้สอบเทียบ`, 'critical');
  } else if (forecast.baselineMin <= THRESHOLDS.warningDO && metrics.do > THRESHOLDS.warningDO) {
    add('forecast-low', 'ออกซิเจนมีแนวโน้มลดต่ำกว่าเกณฑ์', `เส้นคาดการณ์กลางอาจถึง 5 mg/L ใน ${Math.round(forecast.minutesToThresholdBaseline)} นาที`, 'watch');
  }

  if (!equipment.powerAvailable) {
    add('power-outage', 'ไฟหลักดับและเครื่องตีน้ำหยุด', 'แนวโน้มปัจจุบันคำนวณจากเครื่องตีน้ำ 0 เครื่อง การเลือกไฟสำรองมีผลกับเส้นทดลองเท่านั้น', 'watch');
  }
  if (scenario.id === 'rain') {
    add('rain-layers', 'ฝนและความแตกต่างระหว่างชั้นน้ำ', `ฝน ${metrics.rain} mm/h ความเค็ม ${metrics.salinity} ppt ควรตรวจการเปลี่ยนแปลงและวัดหลายระดับ`, 'watch');
  }
  if (scenario.id === 'sun' && metrics.ph >= 8.9 && metrics.tan > 0) {
    add('ammonia-context', 'น้ำร้อนและ pH สูง ต้องตรวจแอมโมเนียร่วม', `TAN ${metrics.tan} mg N/L, pH ${metrics.ph}, อุณหภูมิ ${metrics.temperature} °C, ความเค็ม ${metrics.salinity} ppt เป็นสัญญาณให้ตรวจเพิ่ม ระบบไม่ได้คำนวณ NH₃ หรือยืนยันพิษ`, 'watch');
  }
  if (scenario.id === 'night') {
    add('night-demand', 'ช่วงไม่มีแสงสำหรับสังเคราะห์แสง', 'แบบจำลองยังมีการใช้ออกซิเจนจากกุ้ง สิ่งมีชีวิต และพื้นบ่อ แม้พลังงานแสงจะเป็นศูนย์', 'normal');
  }
  if (!reasons.length) {
    add('within-demo-limits', 'ข้อมูลอยู่ในช่วงเกณฑ์สาธิต', 'ติดตามแนวโน้มและข้อมูลตรวจบ่อต่อเนื่อง สถานะนี้ไม่ใช่การรับรองว่ากุ้งไม่มีโรคหรือจะไม่ตาย', 'normal');
  }

  return {
    level,
    title: { normal: 'อยู่ในช่วงเกณฑ์สาธิต', watch: 'ควรเฝ้าระวัง', critical: 'ต้องตรวจสอบเร่งด่วน' }[level],
    summary: {
      normal: 'ค่าออกซิเจนและแนวโน้มกลางยังสูงกว่าเกณฑ์เฝ้าระวังที่ตั้งไว้ในตัวอย่าง',
      watch: 'พบเงื่อนไขที่ควรติดตามเพิ่ม พร้อมเปรียบเทียบทางเลือกการจัดการบ่อ',
      critical: 'พบค่าออกซิเจนหรือแนวโน้มที่เข้าเกณฑ์วิกฤตสาธิต ต้องตรวจยืนยันจากข้อมูลบ่อจริง',
    }[level],
    reasons,
  };
}

export function buildSnapshot({ pondId = 'P01', scenarioId = 'normal', elapsedMinutes = 0, proposedAerators = 3, feedFactor = 1, backupPower = false } = {}) {
  const pond = PONDS.find(item => item.id === pondId) ?? PONDS[0];
  const scenario = SCENARIOS.find(item => item.id === scenarioId) ?? SCENARIOS[0];
  const elapsed = clamp(finiteNumber(elapsedMinutes, 0), 0, 10080);
  const proposed = clamp(Math.round(finiteNumber(proposedAerators, 3)), 0, pond.totalAerators);
  const proposedFeedFactor = clamp(finiteNumber(feedFactor, 1), 0, 1.5);
  const backup = backupPower === true;
  const powerAvailable = scenario.id !== 'outage';
  const active = powerAvailable ? POND_STATE[pond.id].active : 0;
  const effectiveProposed = powerAvailable || backup ? proposed : 0;
  const equipment = {
    active,
    total: pond.totalAerators,
    proposed,
    effectiveProposed,
    powerAvailable,
    backupPower: backup,
    currentKw: round(active * MODEL_INFO.coefficients.aeratorKw),
    proposedKw: round(effectiveProposed * MODEL_INFO.coefficients.aeratorKw),
  };
  const environment = environmentAt(pond, scenario, elapsed);
  const currentDo = observationAt(pond, scenario, elapsed, environment);
  const metrics = { do: currentDo, ...environment };
  const gap = scenario.id === 'rain' ? 1.15 / (1 + 0.15 * active) : 0.3 / (1 + 0.1 * active);
  const surfaceDO = currentDo === null ? null : round(clamp(currentDo + gap * 0.45, 0, saturation(environment.temperature, environment.salinity)));
  const bottomDO = currentDo === null ? null : round(clamp(currentDo - gap, 0, saturation(environment.temperature, environment.salinity)));
  const history = [];
  for (let minute = -MODEL_INFO.historyMinutes; minute <= 0; minute += MODEL_INFO.stepMinutes) {
    const at = elapsed + minute;
    const historicalEnvironment = environmentAt(pond, scenario, at);
    history.push({ minute, do: observationAt(pond, scenario, at, historicalEnvironment) });
  }
  const baseline = currentDo === null ? [] : forecastPath(pond, scenario, elapsed, currentDo, active, 1);
  const proposedPath = currentDo === null ? [] : forecastPath(pond, scenario, elapsed, currentDo, effectiveProposed, proposedFeedFactor);
  const forecast = {
    baseline,
    proposed: proposedPath,
    baselineMin: minimum(baseline),
    proposedMin: minimum(proposedPath),
    minutesToThresholdBaseline: minutesToThreshold(baseline, THRESHOLDS.warningDO),
    minutesToThresholdProposed: minutesToThreshold(proposedPath, THRESHOLDS.warningDO),
    energyDeltaKwh: round((equipment.proposedKw - equipment.currentKw) * MODEL_INFO.forecastMinutes / 60),
  };
  const quality = currentDo === null
    ? { status: 'missing', label: 'ข้อมูล DO ขาดหาย', updatedAgo: '18 นาที' }
    : { status: 'ok', label: 'ข้อมูลสาธิตครบ', updatedAgo: 'เมื่อครู่นี้' };

  return {
    pond: { ...pond },
    scenario: { ...scenario },
    clock: clockAt(scenario, elapsed),
    metrics,
    surfaceDO,
    bottomDO,
    equipment,
    quality,
    risk: assessRisk(metrics, bottomDO, scenario, forecast, equipment),
    history,
    forecast,
    thresholds: { ...THRESHOLDS },
  };
}
