#!/usr/bin/env node
'use strict';
/* 프리셋(데모/가설 재현) DOM 경로 스모크 — hws-ui 의 panel.presets 기능이 *실제로 동작*하는지 헤드리스로 증명한다.
 *   회귀 상태(D=1)로 열린 패널의 프리셋 버튼을 클릭하면 → createSim(아레나)·시딩·run 으로 점프해
 *   별이 천장(z=D−1)까지 떠오르고 E 무게중심 z 가 솟는가. (verify sun 이 단언하는 수치를 *화면 경로*가 그대로 내는지.)
 *   "설명은 그럴듯한데 확인 불가" 를 푸는 기능이므로, 그 기능 자체도 수치로 닫는다.
 * 사용: node engine/validate/smoke-preset.js */
var path = require('path');

/* ── 최소 스텁 DOM (smoke-dom-3d.js 의 부분집합 — 버튼 클릭·span 동기화·getElementById 만 필요) ── */
function makeCtx() {
  var noop = function () {};
  return {
    createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    putImageData: noop, drawImage: noop, beginPath: noop, arc: noop, stroke: noop, moveTo: noop, lineTo: noop,
    fill: noop, fillRect: noop, strokeRect: noop, fillText: noop, clearRect: noop,
    measureText: function (s) { return { width: 8 * String(s).length }; },
    imageSmoothingEnabled: false, strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: ''
  };
}
function makeEl(tag) {
  return {
    tagName: tag.toUpperCase(), children: [], _listeners: {}, parentNode: null,
    id: '', className: '', innerHTML: '', textContent: '', title: '',
    type: '', checked: false, value: '', min: '', max: '', step: '', width: 512, height: 512, style: {}, selected: false,
    appendChild: function (c) {
      this.children.push(c); c.parentNode = this;
      if (this.tagName === 'SELECT' && c.tagName === 'OPTION') { if (c.selected) this.value = c.value; else if (this.value === '') this.value = c.value; }
      return c;
    },
    addEventListener: function (ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    dispatch: function (ev) { (this._listeners[ev] || []).forEach(function (f) { f({ clientX: 40, clientY: 40, preventDefault: function () {} }); }); },
    getContext: function (type) { return type === '2d' ? (this._ctx || (this._ctx = makeCtx())) : null; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width, height: this.height }; }
  };
}
function findById(root, id) {
  if (root.id === id) return root;
  var ch = root.children || [];
  for (var i = 0; i < ch.length; i++) { var r = findById(ch[i], id); if (r) return r; }
  return null;
}
function findByText(root, tag, text) {
  if (root.tagName === tag && root.textContent === text) return root;
  var ch = root.children || [];
  for (var i = 0; i < ch.length; i++) { var r = findByText(ch[i], tag, text); if (r) return r; }
  return null;
}
var document = {
  body: makeEl('body'),
  createElement: function (t) { return makeEl(t); },
  createTextNode: function (s) { return { _text: s }; },
  getElementById: function (id) { return findById(this.body, id); }
};
global.window = global;
global.document = document;
global.requestAnimationFrame = function () { return 0; };
global.performance = { now: function () { return Date.now(); } };

var HWS = require('../hws-ui.js');
var core = require('../hws-sim.js');

/* verify.js sunArena()/seedSunCore() 와 같은 설정(여기선 격리 스모크용 최소 복제). */
function sunArena(kRise) {
  return {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kIgnite: 1, kStarRise: kRise, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 1, starGap: 6, starR: 2, starDriftPeriod: 20,
    kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0
  };
}
function seedSunCore(sim, c) { var W = sim.p.W, H = sim.p.H, disc = c.discCells(W, H, (W / 2) | 0, (H / 2) | 0, 2); for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += 2.0; sim.E0 += 2.0; } }
function comZ(sim) { var p = sim.p, D = p.D || 1, WH = p.W * p.H, E = sim.E, num = 0, den = 0; for (var z = 0; z < D; z++) { var t = 0; for (var k = 0; k < WH; k++) t += E[z * WH + k]; num += z * t; den += t; } return den > 0 ? num / den : 0; }
function maxStarZ(sim) { var m = 0, st = sim.stars || []; for (var i = 0; i < st.length; i++) { var z = st[i].z || 0; if (z > m) m = z; } return m; }

/* 회귀 상태(D=1·부력 off)로 열리는 최소 패널 + 프리셋 1개(별 부력 ON). */
var panel = {
  title: 'preset smoke',
  controls: [{ items: [
    { kind: 'slider', id: 'D', label: 'D', param: 'D', min: 1, max: 8, step: 1, def: 1, fixed: 0 },
    { kind: 'check', id: 'risec', label: 'rise', gateFor: 'kStarRise', def: false },
    { kind: 'slider', id: 'kStarRise', label: 'kStarRise', param: 'kStarRise', min: 0, max: 3, step: 1, def: 0, fixed: 0, gateBy: 'risec', gateOff: 0 }
  ] }],
  stats: [{ label: 'comZ', get: function (c) { return comZ(c.sim).toFixed(2); } }],
  presets: [{ label: '☀ ON', params: sunArena(1), seed: seedSunCore, run: 200, note: 'on' }]
};

var fail = 0;
function check(name, cond, detail) { console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  — ' + detail : '')); if (!cond) fail++; }

var handle = HWS.mount(core, panel);

/* 마운트 직후 = 회귀 상태(D=1): 별 부력 비활성, E 무게중심 z = 0(바닥). */
var s0 = handle.sim();
check('마운트 = 회귀 상태(D=1·comZ≈0)', (s0.p.D || 1) === 1 && comZ(s0) < 0.01, 'D=' + (s0.p.D || 1) + ' comZ=' + comZ(s0).toFixed(3));

/* 프리셋 버튼을 찾아 클릭 → applyPreset(아레나·시딩·run 200). */
var btn = findByText(document.body, 'BUTTON', '☀ ON');
check('프리셋 버튼이 패널에 렌더됨', !!btn);
btn.dispatch('click');

/* 클릭 후 = 별이 천장(z=7)까지 떠오르고 E 무게중심 z 가 솟아야(=verify sun on). */
var s1 = handle.sim();
var mz = maxStarZ(s1), cz = comZ(s1);
check('프리셋이 D=8 아레나로 점프', (s1.p.D || 1) === 8, 'D=' + (s1.p.D || 1));
check('별이 천장까지 떠오름 (별최고 z=7)', mz === 7, 'maxStarZ=' + mz);
check('E 무게중심 z 가 高z 로 솟음 (>5)', cz > 5.0, 'comZ=' + cz.toFixed(2));

/* 컨트롤 UI 가 프리셋 값에 동기화됐는가(가독성) — D 슬라이더·게이트 체크. */
var dEl = document.getElementById('D'), riseEl = document.getElementById('risec'), riseSl = document.getElementById('kStarRise');
check('D 슬라이더 UI = 8 동기화', String(dEl.value) === '8', 'D.value=' + dEl.value);
check('부력 게이트 체크 on·슬라이더=1 동기화', riseEl.checked === true && String(riseSl.value) === '1', 'risec=' + riseEl.checked + ' kStarRise=' + riseSl.value);

console.log(fail ? ('\n✗ 프리셋 스모크 ' + fail + ' 항 실패') : '\n✅ 프리셋 스모크 통과 — 회귀 상태→한 클릭→별이 하늘로(verify sun 수치 = 화면 경로 일치)');
process.exit(fail ? 1 : 0);
