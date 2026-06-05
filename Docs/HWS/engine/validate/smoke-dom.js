/* 엔진 DOM 경로 스모크 테스트 — verify-engine.js 가 못 건드리는 mount()·draw()·이벤트 경로를
 * 최소 스텁 DOM/캔버스로 실제 실행해 런타임 오류(undefined 참조·잘못된 호출)를 잡는다.
 * 브라우저 없이 "엔진이 패널로 페이지를 구성하고 한 프레임을 그리고 컨트롤 이벤트를 처리하는지"를 확인.
 * 사용: node engine/validate/smoke-dom.js */
'use strict';
var path = require('path');

/* ── 최소 스텁 DOM + 2D 캔버스 ── */
var rafQueue = [];
function makeCtx() {
  var noop = function () {};
  return {
    createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    putImageData: noop, drawImage: noop, beginPath: noop, arc: noop, stroke: noop,
    moveTo: noop, lineTo: noop, fill: noop, fillRect: noop, strokeRect: noop, fillText: noop,
    imageSmoothingEnabled: false, strokeStyle: '', fillStyle: '', lineWidth: 1, font: ''
  };
}
function makeEl(tag) {
  var el = {
    tagName: tag.toUpperCase(), children: [], _listeners: {},
    id: '', className: '', innerHTML: '', textContent: '', title: '',
    type: '', checked: false, value: '', min: '', max: '', step: '',
    width: 512, height: 512, style: {}, selected: false,
    appendChild: function (c) {
      this.children.push(c);
      /* select.value = 선택된 option 의 value (실DOM 근사) */
      if (this.tagName === 'SELECT' && c.tagName === 'OPTION' && (c.selected || this.value === '')) {
        if (c.selected) this.value = c.value;
        else if (this.value === '') this.value = c.value;
      }
      return c;
    },
    addEventListener: function (ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    dispatch: function (ev) { (this._listeners[ev] || []).forEach(function (f) { f({ clientX: 40, clientY: 40 }); }); },
    getContext: function () { return this._ctx || (this._ctx = makeCtx()); },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width, height: this.height }; }
  };
  return el;
}
var document = {
  body: makeEl('body'),
  createElement: function (t) { return makeEl(t); },
  createTextNode: function (s) { return { _text: s }; }
};
global.window = global;
global.document = document;
global.performance = { now: function () { return 0; } };
global.requestAnimationFrame = function (fn) { rafQueue.push(fn); };

/* 스텁 DOM 에서 id 로 엘리먼트 찾기(테스트용) */
function findById(root, id) {
  if (root.id === id) return root;
  var ch = root.children || [];
  for (var i = 0; i < ch.length; i++) { var r = findById(ch[i], id); if (r) return r; }
  return null;
}

var core = require(path.join(__dirname, '..', '..', 'step-0006', 'sim-core.js'));
var engine = require(path.join(__dirname, '..', 'hws-ui.js'));
var panel = require(path.join(__dirname, 'step-0006.panel.js'));

var fails = 0;
function ok(name, cond, detail) { console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  — ' + detail : '')); if (!cond) fails++; }

console.log('① mount() — 페이지 구성 + 첫 프레임 렌더가 오류 없이 끝나는가');
var handle = null;
try { handle = engine.mount(core, panel); ok('mount 무오류', true); }
catch (e) { ok('mount 무오류', false, e.message + '\n' + e.stack); }

if (handle) {
  console.log('\n② 컨트롤이 패널대로 생성됐는가');
  var seedSel = (function () { // __seed 는 id 없음 — 헤더에서 첫 select 찾기
    var found = null;
    (function walk(n) { if (found) return; if (n.tagName === 'SELECT') { found = n; return; } (n.children || []).forEach(walk); })(document.body);
    return found;
  })();
  ok('시드 셀렉트 기본값 42', seedSel && seedSel.value === '42', seedSel && seedSel.value);
  ok('kA 슬라이더 존재', !!findById(document.body, 'kA'));
  ok('baseCost 슬라이더 존재', !!findById(document.body, 'baseCost'));
  ok('생명 체크 존재', !!findById(document.body, 'life'));
  ok('통계표(table) 생성', (function () { var f = false; (function w(n) { if (n.tagName === 'TABLE') f = true; (n.children || []).forEach(w); })(document.body); return f; })());

  console.log('\n③ 이벤트 경로 — 버튼/체크/슬라이더/클릭이 오류 없이 처리되는가');
  try {
    /* +1 tick 버튼: 헤더 두번째 버튼. id 없으니 라벨로 못 찾음 → step 버튼 직접: handle 없음.
       대신 라이브 노브를 직접 친다. */
    var lifeChk = findById(document.body, 'life'); lifeChk.checked = false; lifeChk.dispatch('change');
    lifeChk.checked = true; lifeChk.dispatch('change');
    ok('life 체크 토글 → sim.p.life 반영', handle.sim().p.life === true);

    var aggChk = findById(document.body, 'agg'), kaRng = findById(document.body, 'kA');
    aggChk.checked = false; aggChk.dispatch('change');
    ok('agg off → 게이트로 kA 파라미터 0', handle.sim().p.kA === 0, 'kA=' + handle.sim().p.kA);
    aggChk.checked = true; aggChk.dispatch('change');
    kaRng.value = '0.30'; kaRng.dispatch('input');
    ok('kA 슬라이더 input → sim.p.kA 반영', Math.abs(handle.sim().p.kA - 0.30) < 1e-9, 'kA=' + handle.sim().p.kA);

    var seed1 = findById(document.body, 'seed1'); seed1.dispatch('click');
    ok('버튼 action(seedPools1) 무오류', true);

    var cv = (function () { var f = null; (function w(n) { if (f) return; if (n.tagName === 'CANVAS') f = n; (n.children || []).forEach(w); })(document.body); return f; })();
    cv.dispatch('click');
    ok('캔버스 클릭(clickMode life) 무오류', true);

    handle.draw(); handle.reset();
    ok('draw()/reset() 재호출 무오류', true);
  } catch (e) { ok('이벤트 경로 무오류', false, e.message + '\n' + e.stack); }
}

console.log('\n' + (fails === 0 ? '✅ DOM 스모크 통과 — mount·렌더·이벤트 경로 무오류' : '❌ ' + fails + ' 건 실패'));
process.exit(fails === 0 ? 0 : 1);
