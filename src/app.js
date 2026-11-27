import { PONDS, SCENARIOS, MODEL_INFO, buildSnapshot } from './model.js';
import { FarmScene } from './farm-scene.js';
import { ForecastChart } from './forecast-chart.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const number = (value, digits = 1) => value === null || value === undefined || !Number.isFinite(value) ? '—' : Number(value).toFixed(digits);
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Z"/><path d="m2 12 10 5 10-5M2 16l10 5 10-5"/>',
  chart: '<path d="M3 3v18h18M7 14l4-5 4 3 5-7"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  book: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-2-10 1Z"/>',
  droplet: '<path d="M12 3c-3 5-7 8-7 12a7 7 0 0 0 14 0c0-4-4-7-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="M12 8v5m0 3h.01"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10v10M3 7l9 5 9-5M7.5 4.5l9 5v5"/>',
  move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  rotate: '<path d="M3 9a9 9 0 1 1 1 9M3 3v6h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  reset: '<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  flask: '<path d="M9 3h6M10 3v7l-6 9c-1 1 0 2 1 2h14c1 0 2-1 1-2l-6-9V3M7 15h10"/>',
  leaf: '<path d="M20 3c-12-1-18 6-14 12 5 6 16 2 14-12ZM3 21l12-12"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
  rain: '<path d="M6 14a5 5 0 1 1 2-9 6 6 0 0 1 11 4 3 3 0 0 1 0 6M7 17l-1 4m6-4-1 4m6-4-1 4"/>',
  signal: '<path d="m2 2 20 20M8.5 9a8 8 0 0 1 9 2M5 7a12 12 0 0 1 17 1M2 8a12 12 0 0 1 3-2M8 15a5 5 0 0 1 4-2m-1 7h2"/>',
  wind: '<path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h5a3 3 0 1 1-3 3"/>',
  thermometer: '<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 8v9"/>',
  waves: '<path d="M2 6c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 12c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 18c3-3 5 3 8 0s5 3 8 0 4 0 4 0"/>',
  activity: '<path d="M2 12h4l3-8 6 16 3-8h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
function fillIcons() { $$('[data-icon]').forEach(element => { if (!element.firstElementChild) element.innerHTML = icon(element.dataset.icon); }); }
fillIcons();

const scenarioDetails = {
  normal: { icon: 'sun', title: 'วันปกติ', subtitle: 'สภาพบ่อเริ่มต้น' },
  night: { icon: 'moon', title: 'ก่อนฟ้าสาง', subtitle: 'ดูออกซิเจนช่วงดึก' },
  rain: { icon: 'rain', title: 'ฝนหนัก', subtitle: 'น้ำฝนและชั้นน้ำ' },
  sun: { icon: 'thermometer', title: 'แดดจัด', subtitle: 'ความร้อนและ pH' },
  outage: { icon: 'bolt', title: 'ไฟหลักดับ', subtitle: 'เครื่องตีน้ำหยุด' },
  sensor: { icon: 'signal', title: 'เซนเซอร์หาย', subtitle: 'ตรวจข้อมูลขาดหาย' },
};
const state = {
  selectedId: PONDS[0].id,
  scenarios: Object.fromEntries(PONDS.map(pond => [pond.id, 'normal'])),
  elapsedByPond: Object.fromEntries(PONDS.map(pond => [pond.id, 0])),
  layer: 'oxygen',
  draft: { aerators: 3, feed: 1, backup: false },
  plan: { aerators: 3, feed: 1, backup: false },
  playing: false,
  eventTab: 'alerts',
  acknowledged: new Set(),
  activities: [],
};
let snapshots = {};
let playTimer;
let toastTimer;
const scene = new FarmScene($('#farm-canvas'), { onSelectPond: selectPond });
const chart = new ForecastChart($('#forecast-chart'));

function getSnapshot(pondId, plan = null) {
  return buildSnapshot({
    pondId,
    scenarioId: state.scenarios[pondId],
    elapsedMinutes: state.elapsedByPond[pondId],
    proposedAerators: plan?.aerators ?? 3,
    feedFactor: plan?.feed ?? 1,
    backupPower: plan?.backup ?? false,
  });
}
function current() { return snapshots[state.selectedId]; }
function isDirty() { return state.draft.aerators !== state.plan.aerators || state.draft.feed !== state.plan.feed || state.draft.backup !== state.plan.backup; }
function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3800);
}
function stopPlaying() {
  clearInterval(playTimer);
  state.playing = false;
  $('#play-button').innerHTML = icon('play');
  $('#play-button').setAttribute('aria-label', 'เล่นเวลาจำลอง');
  $('#play-button').setAttribute('aria-pressed', 'false');
}
function resetPlan() {
  const snapshot = getSnapshot(state.selectedId);
  const aerators = snapshot.scenario.id === 'outage' ? Math.min(3, snapshot.pond.totalAerators) : snapshot.equipment.active;
  state.draft = { aerators, feed: 1, backup: false };
  state.plan = { ...state.draft };
  $('#aerator-range').max = String(snapshot.pond.totalAerators);
  $('#aerator-range').value = String(aerators);
  $('#aerator-max-label').textContent = `${snapshot.pond.totalAerators} เครื่อง`;
  $('#feed-range').value = '100';
  $('#backup-switch').checked = false;
}
function addActivity(title, description) {
  const snapshot = current() || getSnapshot(state.selectedId);
  state.activities.unshift({ id: state.activities.length + 1, pondId: state.selectedId, time: snapshot.clock.label, title, description });
  state.activities = state.activities.slice(0, 30);
}
function selectPond(id) {
  if (!PONDS.some(pond => pond.id === id) || id === state.selectedId) return;
  stopPlaying();
  state.selectedId = id;
  resetPlan();
  render();
}
function selectScenario(id) {
  if (!SCENARIOS.some(scenario => scenario.id === id)) return;
  stopPlaying();
  state.scenarios[state.selectedId] = id;
  state.elapsedByPond[state.selectedId] = 0;
  resetPlan();
  render();
  addActivity(`ทดลองสถานการณ์ ${scenarioDetails[id].title}`, 'เปลี่ยนข้อมูลสมมติของบ่อที่เลือก ไม่มีผลกับอุปกรณ์จริง');
  renderEvents();
}
function thresholdLabel(value, missing = false) {
  if (missing) return 'ประเมินไม่ได้';
  if (value === null) return 'ยังไม่ถึงใน 3 ชม.';
  if (value === 0) return 'ต่ำกว่าเกณฑ์แล้ว';
  return `อีก ${Math.round(value)} นาที`;
}

function renderSummary() {
  const values = Object.values(snapshots);
  const available = values.filter(snapshot => snapshot.bottomDO !== null);
  const normal = values.filter(snapshot => snapshot.risk.level === 'normal').length;
  const unknown = values.filter(snapshot => snapshot.risk.level === 'unknown').length;
  const atRisk = values.filter(snapshot => ['watch', 'critical'].includes(snapshot.risk.level));
  $('#farm-summary').textContent = `${normal} บ่ออยู่ในเกณฑ์เดโม${unknown ? ` · ${unknown} บ่อข้อมูลไม่พอ` : ' · กำลังเลี้ยงทุกรุ่น'}`;
  $('#average-do').textContent = available.length ? number(available.reduce((sum, snapshot) => sum + snapshot.bottomDO, 0) / available.length, 2) : '—';
  $('#risk-count').textContent = String(atRisk.length);
  $('#risk-caption').textContent = `${atRisk.filter(snapshot => snapshot.risk.level === 'critical').length} บ่อถึงเกณฑ์เร่งด่วน${unknown ? ` · ${unknown} บ่อข้อมูลขาดหาย` : 'ในแบบจำลอง'}`;
  $('#farm-power').textContent = number(values.reduce((sum, snapshot) => sum + snapshot.equipment.currentKw, 0), 1);
}
function renderPonds() {
  const unit = state.layer === 'oxygen' ? 'mg/L' : state.layer === 'salinity' ? 'ppt' : '°C';
  $('#pond-selector').innerHTML = PONDS.map(pond => {
    const snapshot = snapshots[pond.id];
    const value = state.layer === 'oxygen' ? snapshot.bottomDO : state.layer === 'salinity' ? snapshot.metrics.salinity : snapshot.metrics.temperature;
    return `<button class="pond-option ${pond.id === state.selectedId ? 'active' : ''}" type="button" data-pond="${pond.id}" aria-pressed="${pond.id === state.selectedId}" aria-label="เลือก ${safe(pond.name)} ${safe(snapshot.risk.title)}"><span class="pond-option-top">${pond.id}<i class="legend-dot ${snapshot.risk.level}" aria-hidden="true"></i></span><span class="pond-option-value">${number(value, 1)}<small>${unit}</small></span><span class="pond-option-caption">เลี้ยง ${pond.cropDay} วัน</span></button>`;
  }).join('');
  $('#pond-selector').querySelectorAll('[data-pond]').forEach(button => button.addEventListener('click', () => selectPond(button.dataset.pond)));
  const metricsByPond = Object.fromEntries(PONDS.map(pond => [pond.id, { do: snapshots[pond.id].bottomDO, temperature: snapshots[pond.id].metrics.temperature, salinity: snapshots[pond.id].metrics.salinity, riskLevel: snapshots[pond.id].risk.level }]));
  scene.update({ ponds: PONDS, selectedId: state.selectedId, scenarioId: current().scenario.id, elapsedMinutes: state.elapsedByPond[state.selectedId], metricsByPond, activeAerators: Object.fromEntries(PONDS.map(pond => [pond.id, snapshots[pond.id].equipment.active])), layer: state.layer });
}
function renderMetrics() {
  const snapshot = current();
  const { metrics, pond, risk } = snapshot;
  $('#pond-crop').textContent = `${pond.id} / กุ้งขาว · อายุ ${pond.cropDay} วัน · ${pond.areaRai} ไร่`;
  $('#selected-pond-title').textContent = `${pond.name} · คุณภาพน้ำ`;
  $('#pond-status').className = `status-pill ${risk.level}`;
  $('#pond-status').textContent = risk.title;
  const cards = [
    { name: 'DO จุดตรวจหลัก', value: metrics.do, digits: 2, unit: 'mg/L', icon: 'droplet', caption: `ใกล้ก้นบ่อ ${number(snapshot.bottomDO, 2)} mg/L` },
    { name: 'อุณหภูมิน้ำ', value: metrics.temperature, digits: 1, unit: '°C', icon: 'thermometer', caption: 'ตัวอย่างค่าตรวจวัดในบ่อ' },
    { name: 'กรด–ด่าง', value: metrics.ph, digits: 2, unit: 'pH', icon: 'flask', caption: `TAN ${number(metrics.tan, 2)} mg N/L · สมมติ` },
    { name: 'ความเค็ม', value: metrics.salinity, digits: 1, unit: 'ppt', icon: 'waves', caption: 'อ่านร่วมกับฝนและชั้นน้ำ' },
    { name: 'ปริมาณฝน', value: metrics.rain, digits: 1, unit: 'mm/h', icon: 'rain', caption: 'อัตราฝน ณ เวลาจำลอง' },
    { name: 'รังสีแสงอาทิตย์', value: metrics.solar, digits: 0, unit: 'W/m²', icon: 'sun', caption: `ระดับน้ำ ${number(metrics.waterLevel, 2)} ม.` },
  ];
  $('#water-metrics').innerHTML = cards.map(card => `<div class="water-metric"><span class="water-metric-label">${icon(card.icon)}${card.name}</span><p class="water-metric-value">${number(card.value, card.digits)}<small>${card.unit}</small></p><p class="water-metric-caption">${card.caption}</p></div>`).join('');
  $('#risk-explanation').className = `risk-explanation ${risk.level}`;
  $('#risk-explanation').innerHTML = `<div class="risk-title">${icon(risk.level === 'normal' ? 'check' : risk.level === 'unknown' ? 'signal' : 'shield')}${safe(risk.title)}</div><p>${safe(risk.summary)}</p><ul class="risk-reasons">${risk.reasons.slice(0, 2).map(reason => `<li>${safe(reason.detail)}</li>`).join('')}</ul>`;
  $('#quality-label').textContent = `${snapshot.quality.label} · ${snapshot.quality.updatedAgo} · ข้อมูลสมมติ${snapshot.quality.status === 'missing' ? ' · ยังไม่ประเมินแนวโน้ม DO' : ' ยังไม่เชื่อมฟาร์มจริง'}`;
}
function renderScenario() {
  const snapshot = current();
  $('#scenario-pond-name').textContent = snapshot.pond.name;
  $('#scenario-list').innerHTML = SCENARIOS.map(scenario => {
    const details = scenarioDetails[scenario.id];
    return `<button class="scenario-button ${snapshot.scenario.id === scenario.id ? 'active' : ''}" type="button" data-scenario="${scenario.id}" aria-pressed="${snapshot.scenario.id === scenario.id}">${icon(details.icon)}<strong>${details.title}</strong><small>${details.subtitle}</small></button>`;
  }).join('');
  $('#scenario-list').querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => selectScenario(button.dataset.scenario)));
  const { metrics } = snapshot;
  $('#weather-strip').innerHTML = `<div class="weather-item">${icon('rain')}<span><strong>${number(metrics.rain, 1)} mm/h</strong>ฝนสมมติ</span></div><div class="weather-item">${icon('wind')}<span><strong>${number(metrics.wind, 1)} m/s</strong>ลมสมมติ</span></div><div class="weather-item">${icon('sun')}<span><strong>${number(metrics.solar, 0)} W/m²</strong>แสงอาทิตย์</span></div>`;
  $('#clock-label').textContent = snapshot.clock.label;
  $('#time-range').value = String(state.elapsedByPond[state.selectedId]);
  $('#elapsed-label').textContent = `+${state.elapsedByPond[state.selectedId]} นาที`;
}
function renderControl() {
  const snapshot = current();
  const { equipment, forecast } = snapshot;
  $('#equipment-state').className = `equipment-state ${equipment.powerAvailable ? '' : 'fault'}`;
  $('#equipment-state').innerHTML = `${icon('bolt')}<span><strong>${equipment.powerAvailable ? `ปัจจุบัน ${equipment.active} / ${equipment.total} เครื่องกำลังทำงาน` : 'ไฟหลักดับ · เครื่องปัจจุบันหยุดทำงาน'}</strong>กำลังไฟเดิม ${number(equipment.currentKw, 1)} kW · สถานะสมมติ</span>`;
  $('#aerator-output').textContent = String(state.draft.aerators);
  $('#feed-output').textContent = String(Math.round(state.draft.feed * 100));
  const dirty = isDirty();
  $('#plan-dirty').textContent = dirty ? 'ปรับค่าแล้ว · กดจำลองเพื่ออัปเดตเส้นคาดการณ์' : 'กราฟแสดงแผนทดลองที่เลือกอยู่';
  $('#plan-dirty').className = `plan-dirty ${dirty ? 'changed' : ''}`;
  $('#forecast-plan-label').textContent = dirty ? 'มีค่าใหม่ที่ยังไม่ได้จำลอง' : 'DO จุดตรวจหลัก · ผลสาธิต';
  const missing = snapshot.quality.status === 'missing';
  $('#simulate-button').disabled = missing;
  if (missing) {
    $('#plan-result').innerHTML = '<p class="plan-result-title">ยังเปรียบเทียบแผนไม่ได้</p><p>ไม่มีค่า DO ปัจจุบันสำหรับเริ่มคำนวณ ตรวจเซนเซอร์หรือเปลี่ยนสถานการณ์เพื่อทดลองต่อ</p>';
    return;
  }
  const lastBaseline = forecast.baseline.at(-1)?.do;
  const lastProposed = forecast.proposed.at(-1)?.do;
  const difference = lastProposed - lastBaseline;
  const prefix = difference > 0.005 ? '+' : '';
  const energy = forecast.energyDeltaKwh;
  $('#plan-result').innerHTML = `<p class="plan-result-title">DO ณ ปลายชั่วโมงที่ 3 เทียบแผนเดิม</p><div class="plan-result-row"><strong class="${difference < -0.005 ? 'negative' : ''}">${prefix}${number(difference, 2)}</strong><span>mg/L</span></div><p>เครื่องในแผนใช้ได้ ${equipment.effectiveProposed} / ${equipment.proposed} เครื่อง</p><small>พลังงาน ${energy > 0 ? '+' : ''}${number(energy, 1)} kWh ใน 3 ชั่วโมง${!equipment.powerAvailable && !state.plan.backup ? ' · ต้องเปิดไฟสำรองเพื่อทดลองเพิ่มอากาศ' : ''}</small>`;
}
function renderForecast() {
  const snapshot = current();
  const { forecast, quality } = snapshot;
  chart.update({ history: snapshot.history, baseline: forecast.baseline, proposed: forecast.proposed, threshold: snapshot.thresholds.warningDO, clockHour: snapshot.clock.hour, quality: quality.status });
  const missing = quality.status === 'missing';
  $('#forecast-summary').innerHTML = `<div class="forecast-stat"><span>DO ต่ำสุด · แผนเดิม</span><strong>${number(forecast.baselineMin, 2)}${missing ? '' : ' mg/L'}</strong><small>รวมค่าปัจจุบันในช่วง 3 ชม.</small></div><div class="forecast-stat"><span>DO ต่ำสุด · แผนทดลอง</span><strong>${number(forecast.proposedMin, 2)}${missing ? '' : ' mg/L'}</strong><small>รวมค่าปัจจุบันในช่วง 3 ชม.</small></div><div class="forecast-stat"><span>แผนเดิมถึงเกณฑ์เตือน</span><strong>${thresholdLabel(forecast.minutesToThresholdBaseline, missing)}</strong><small>แผนทดลอง: ${thresholdLabel(forecast.minutesToThresholdProposed, missing)}</small></div>`;
}
function renderEvents() {
  const severity = { critical: 0, unknown: 1, watch: 2, normal: 3 };
  const alerts = Object.values(snapshots).filter(snapshot => snapshot.risk.level !== 'normal').sort((a, b) => severity[a.risk.level] - severity[b.risk.level]);
  $('#alert-count').textContent = `${state.eventTab === 'alerts' ? alerts.length : state.activities.length} รายการ`;
  $$('[data-event-tab]').forEach(button => { button.classList.toggle('active', button.dataset.eventTab === state.eventTab); button.setAttribute('aria-pressed', String(button.dataset.eventTab === state.eventTab)); });
  if (state.eventTab === 'activity') {
    $('#events-list').innerHTML = state.activities.length ? state.activities.map(activity => `<div class="event-row"><span class="event-icon activity">${icon('flask')}</span><span class="event-pond">${activity.pondId}<small>${activity.time}</small></span><div class="event-content"><strong>${safe(activity.title)}</strong><p>${safe(activity.description)}</p></div><span class="status-pill normal">จำลองแล้ว</span></div>`).join('') : '<p class="empty-state">เลือกสถานการณ์หรือจำลองแผน เพื่อบันทึกกิจกรรมที่นี่</p>';
    return;
  }
  $('#events-list').innerHTML = alerts.length ? alerts.map(snapshot => {
    const id = `${snapshot.pond.id}:${snapshot.scenario.id}:${snapshot.risk.level}:${snapshot.risk.reasons.map(reason => reason.id).join('-')}`;
    const acknowledged = state.acknowledged.has(id);
    return `<div class="event-row ${acknowledged ? 'acknowledged' : ''}"><span class="event-icon ${snapshot.risk.level}">${icon(snapshot.risk.level === 'unknown' ? 'signal' : 'shield')}</span><span class="event-pond">${snapshot.pond.id}<small>${snapshot.clock.label}</small></span><div class="event-content"><strong>${safe(snapshot.risk.title)}</strong><p>${safe(snapshot.risk.reasons[0]?.detail || snapshot.risk.summary)}</p></div><button type="button" class="event-action" data-ack="${safe(id)}" aria-pressed="${acknowledged}">${acknowledged ? 'รับทราบแล้ว' : 'รับทราบ'}</button></div>`;
  }).join('') : '<p class="empty-state">ไม่มีบ่อถึงเกณฑ์แจ้งเตือนในสถานการณ์ที่เลือก · ข้อมูลจำลอง</p>';
  $('#events-list').querySelectorAll('[data-ack]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.ack;
    if (state.acknowledged.has(id)) state.acknowledged.delete(id); else state.acknowledged.add(id);
    renderEvents();
  }));
}
function render() {
  const focused = document.activeElement;
  const focusKey = focused?.dataset?.pond ? ['data-pond', focused.dataset.pond] : focused?.dataset?.scenario ? ['data-scenario', focused.dataset.scenario] : null;
  snapshots = Object.fromEntries(PONDS.map(pond => [pond.id, getSnapshot(pond.id, pond.id === state.selectedId ? state.plan : null)]));
  renderSummary();
  renderPonds();
  renderMetrics();
  renderScenario();
  renderControl();
  renderForecast();
  renderEvents();
  if (focusKey) document.querySelector(`[${focusKey[0]}="${focusKey[1]}"]`)?.focus({ preventScroll: true });
}

$$('[data-layer]').forEach(button => button.addEventListener('click', () => {
  state.layer = button.dataset.layer;
  $$('[data-layer]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  scene.setLayer(state.layer);
  renderPonds();
}));
$('#rotate-view').addEventListener('click', () => scene.rotate(Math.PI / 8));
$('#zoom-in').addEventListener('click', () => scene.zoom(0.15));
$('#zoom-out').addEventListener('click', () => scene.zoom(-0.15));
$('#reset-view').addEventListener('click', () => scene.resetView());
$('#time-range').addEventListener('input', event => { stopPlaying(); state.elapsedByPond[state.selectedId] = Number(event.target.value); render(); });
$('#play-button').addEventListener('click', () => {
  if (state.playing) { stopPlaying(); return; }
  if (state.elapsedByPond[state.selectedId] >= 180) state.elapsedByPond[state.selectedId] = 0;
  state.playing = true;
  $('#play-button').innerHTML = icon('pause');
  $('#play-button').setAttribute('aria-label', 'หยุดเวลาจำลอง');
  $('#play-button').setAttribute('aria-pressed', 'true');
  playTimer = setInterval(() => {
    state.elapsedByPond[state.selectedId] = Math.min(180, state.elapsedByPond[state.selectedId] + 5);
    render();
    if (state.elapsedByPond[state.selectedId] === 180) stopPlaying();
  }, 1500);
});
$('#reset-demo').addEventListener('click', () => {
  stopPlaying(); state.elapsedByPond[state.selectedId] = 0; resetPlan(); render();
  addActivity('เริ่มสถานการณ์ใหม่', 'คืนเวลาสถานการณ์และแผนทดลองของบ่อนี้เป็นค่าเริ่มต้น'); renderEvents(); notify('เริ่มสถานการณ์ของบ่อนี้ใหม่แล้ว');
});
$('#aerator-range').addEventListener('input', event => { state.draft.aerators = Number(event.target.value); renderControl(); });
$('#feed-range').addEventListener('input', event => { state.draft.feed = Number(event.target.value) / 100; renderControl(); });
$('#backup-switch').addEventListener('change', event => { state.draft.backup = event.target.checked; renderControl(); });
$('#simulate-button').addEventListener('click', () => {
  if (current().quality.status === 'missing') return;
  state.plan = { ...state.draft }; render();
  addActivity('เปรียบเทียบแผนการเติมอากาศ', `ทดลอง ${state.plan.aerators} เครื่อง · อาหาร ${Math.round(state.plan.feed * 100)}% · ไฟสำรอง${state.plan.backup ? 'เปิด' : 'ปิด'} · ผลเป็นค่าจำลอง`);
  renderEvents(); notify('อัปเดตเส้นแผนทดลองและผลเปรียบเทียบแล้ว');
});
$$('[data-event-tab]').forEach(button => button.addEventListener('click', () => { state.eventTab = button.dataset.eventTab; renderEvents(); }));
$$('.rail-nav .rail-link').forEach(link => link.addEventListener('click', () => { $$('.rail-nav .rail-link').forEach(item => item.classList.toggle('active', item === link)); }));
$$('[data-open-guide]').forEach(button => button.addEventListener('click', () => { stopPlaying(); $('#guide-dialog').showModal(); }));
$('#close-guide').addEventListener('click', () => $('#guide-dialog').close());
$('#guide-start').addEventListener('click', () => $('#guide-dialog').close());
$('#guide-dialog').addEventListener('click', event => { if (event.target === $('#guide-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlaying(); });

$('#export-button').addEventListener('click', () => {
  const snapshot = current();
  const rows = [['data_type', 'pond_id', 'pond_name', 'scenario', 'simulation_clock', 'offset_minutes', 'parameter', 'value', 'unit', 'series', 'lower', 'upper', 'provenance']];
  const common = [snapshot.pond.id, snapshot.pond.name, snapshot.scenario.id, snapshot.clock.label];
  const provenance = 'SYNTHETIC_DEMO_NOT_REAL_FARM';
  const metadata = { model_version: MODEL_INFO.version, selected_elapsed_minutes: state.elapsedByPond[state.selectedId], proposed_aerators: state.plan.aerators, effective_proposed_aerators: snapshot.equipment.effectiveProposed, proposed_feed_factor: state.plan.feed, proposed_backup_power: state.plan.backup, baseline_active_aerators: snapshot.equipment.active, baseline_current_kw: snapshot.equipment.currentKw, threshold_warning_do: snapshot.thresholds.warningDO, threshold_critical_do: snapshot.thresholds.criticalDO };
  for (const [key, value] of Object.entries(metadata)) rows.push(['simulation_metadata', ...common, 0, key, value, '', 'applied_plan', '', '', provenance]);
  for (const [key, value] of Object.entries(snapshot.metrics)) rows.push(['synthetic_observation', ...common, 0, key, value ?? '', MODEL_INFO.units[key] || '', '', '', '', provenance]);
  for (const [key, value] of [['surface_do', snapshot.surfaceDO], ['bottom_do', snapshot.bottomDO]]) rows.push(['synthetic_observation', ...common, 0, key, value ?? '', 'mg/L', '', '', '', provenance]);
  for (const point of snapshot.history) rows.push(['synthetic_history', ...common, point.minute, 'do', point.do ?? '', 'mg/L', 'history', '', '', provenance]);
  for (const series of ['baseline', 'proposed']) for (const point of snapshot.forecast[series]) rows.push(['illustrative_forecast', ...common, point.minute, 'do', point.do, 'mg/L', series, point.low, point.high, provenance]);
  const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `ebi-farm-${snapshot.pond.id}-${snapshot.scenario.id}-demo.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  notify('ส่งออกข้อมูลของบ่อที่เลือก พร้อมป้ายข้อมูลสมมติแล้ว');
});

resetPlan();
render();
