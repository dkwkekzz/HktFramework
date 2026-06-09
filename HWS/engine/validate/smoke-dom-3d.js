/* 3D 레이어 DOM 경로 스모크 테스트 — attach/bind 로 장식한 패널이 mount·draw·이벤트 경로를
 * 깨뜨리지 않고, WebGL2 가 없는 환경에서 *조용히 2D 로 폴백*하는지 확인한다.
 * (WebGL2 렌더 자체는 스텁 불가 — 브라우저 육안 검증은 validate/step-0007-3d.html.)
 * 사용: node engine/validate/smoke-dom-3d.js */
'use strict';
var path = require('path');

/* ── 최소 스텁 DOM + 2D 캔버스 (smoke-dom.js 의 스텁 + getElementById/insertBefore/parentNode) ── */
var rafQueue = [];
function makeCtx() {
  var noop = function () {};
  return {
    createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    putImageData: noop, drawImage: noop, beginPath: noop, arc: noop, stroke: noop,
    moveTo: noop, lineTo: noop, fill: noop, fillRect: noop, strokeRect: noop, fillText: noop,
    clearRect: noop, measureText: function (s) { return { width: 8 * String(s).length }; },
    imageSmoothingEnabled: false, strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: ''
  };
}
function makeEl(tag) {
  var el = {
    tagName: tag.toUpperCase(), children: [], _listeners: {}, parentNode: null,
    id: '', className: '', innerHTML: '', textContent: '', title: '',
    type: '', checked: false, value: '', min: '', max: '', step: '',
    width: 512, height: 512, style: {}, selected: false,
    appendChild: function (c) {
      this.children.push(c); c.parentNode = this;
      if (this.tagName === 'SELECT' && c.tagName === 'OPTION' && (c.selected || this.value === '')) {
        if (c.selected) this.value = c.value;
        else if (this.value === '') this.value = c.value;
      }
      return c;
    },
    insertBefore: function (c, ref) {
      var i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      c.parentNode = this;
      return c;
    },
    addEventListener: function (ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    dispatch: function (ev) { (this._listeners[ev] || []).forEach(function (f) { f({ clientX: 40, clientY: 40, preventDefault: function () {} }); }); },
    /* 2D 만 지원 — webgl2 는 null = 3D 폴백 경로 강제 */
    getContext: function (type) { if (type === '2d') return this._ctx || (this._ctx = makeCtx()); return null; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width, height: this.height }; }
  };
  return el;
}
function findById(root, id) {
  if (root.id === id) return root;
  var ch = root.children || [];
  for (var i = 0; i < ch.length; i++) { var r = findById(ch[i], id); if (r) return r; }
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
global.performance = { now: function () { return 0; } };
global.requestAnimationFrame = function (fn) { rafQueue.push(fn); };
global.addEventListener = function () {};

var core = require(path.join(__dirname, '..', '..', 'step-0007', 'sim-core.js'));
var engine = require(path.join(__dirname, '..', 'hws-ui.js'));
var hws3d = require(path.join(__dirname, '..', 'hws-3d.js'));
var panel = require(path.join(__dirname, '..', '..', 'step-0007', 'panel.js'));

var fails = 0;
function ok(name, cond, detail) { console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  — ' + detail : '')); if (!cond) fails++; }

console.log('① attach + mount + bind — 장식된 패널로 페이지 구성·첫 프레임이 오류 없이 끝나는가');
var handle = null;
try {
  handle = hws3d.bind(engine.mount(core, hws3d.attach(panel)));
  ok('mount 무오류', true);
} catch (e) { ok('mount 무오류', false, e.message + '\n' + e.stack); }

if (handle) {
  console.log('\n② WebGL2 부재 → 2D 폴백 — 3D 가 조용히 비활성, 기존 경로 그대로');
  var cv = findById(document.body, 'cv');
  ok('2D 캔버스(#cv) 존재·표시 유지', !!cv && cv.style.display !== 'none', cv && ('display=' + JSON.stringify(cv.style.display)));
  ok('view3d 토글 컨트롤 생성(장식 반영)', !!findById(document.body, 'view3d'));
  ok('step-0007 노브 그대로(srcJump)', !!findById(document.body, 'srcJump'));

  console.log('\n③ 이벤트 경로 — 장식된 actions/clickModes(toast 미러 래퍼)가 무오류인가');
  try {
    handle.draw();
    var seed1 = findById(document.body, 'seed1'); seed1.dispatch('click');
    ok('버튼 action(seedPools1, 래핑) 무오류', true);
    cv.dispatch('click');
    ok('2D 캔버스 클릭(clickMode life, 래핑) 무오류', true);
    var jmp = findById(document.body, 'srcJump'); jmp.value = '8'; jmp.dispatch('input');
    ok('srcJump 슬라이더 → sim.p.srcJump 반영', handle.sim().p.srcJump === 8, 'srcJump=' + handle.sim().p.srcJump);
    var v3 = findById(document.body, 'view3d'); v3.checked = false; v3.dispatch('change');
    v3.checked = true; v3.dispatch('change');
    ok('view3d 토글(view 전용 — 시뮬 무관) 무오류', true);
    handle.draw(); handle.reset();
    ok('draw()/reset() 재호출 무오류', true);
  } catch (e) { ok('이벤트 경로 무오류', false, e.message + '\n' + e.stack); }

  console.log('\n④ 파라미터 불변 — 장식 전후 시뮬 결정론(같은 시드 200 tick 해시 일치)');
  try {
    var params = engine.defaultParams(panel);
    var a = core.createSim(42, params); core.run(a, 200);
    var b = core.createSim(42, engine.defaultParams(hws3d.attach(panel))); core.run(b, 200);
    ok('attach 전후 동일 궤적', core.hashState(a) === core.hashState(b), core.hashState(a));
  } catch (e) { ok('파라미터 불변', false, e.message); }
}

console.log('\n' + (fails === 0 ? '✅ 3D DOM 스모크 통과 — 장식·폴백·이벤트 경로 무오류' : '❌ ' + fails + ' 건 실패'));
process.exit(fails === 0 ? 0 : 1);
