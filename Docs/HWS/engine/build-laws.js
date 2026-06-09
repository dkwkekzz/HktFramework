/* HWS 법칙 번들 생성기 — engine/laws/*.js (도메인 파트, 진실 원천)를 이어붙여 engine/hws-laws.js 를 만든다.
 *
 * 왜: step 마다 자라는 단일 hws-laws.js(800+줄)는 에이전트가 한 번에 못 읽는다(Read 캡 초과). 법칙을 도메인 파트로
 *   쪼개면 한 step 은 *자기 도메인 파트 하나*만 만지면 된다. 브라우저 셸은 여전히 단일 hws-laws.js 를 로드하므로
 *   (번들러 없음·닫힌 step 셸 불변) 생성 산출물을 커밋해 둔다 — 수동 복제가 아니라 *결정론적 생성*('복제 끝낸다' 철학과 정합).
 *
 * 진실 원천 = engine/laws/ 의 파트들. hws-laws.js 는 *생성물* — 직접 편집 금지(verify 가 동기화를 강제).
 *
 * 사용:
 *   node engine/build-laws.js          — 파트에서 hws-laws.js 를 (재)생성.
 *   node engine/build-laws.js --check  — 생성 결과가 커밋된 hws-laws.js 와 일치하는지만 검사(불일치면 exit 1). verify 가 호출.
 *
 * 새 법칙 추가(step 작성법): (1) 노브 → laws/defaults.js  (2) 법칙 함수 → 해당 도메인 파트(flow/star/gene/life/social/measure)
 *   (3) LAW_ORDER 한 자리 + api 한 줄 → laws/order.js  (4) `node engine/build-laws.js` 로 재생성  (5) verify-sim-engine.js 로 회귀 0·골든 확인.
 *   파트 내 함수/const 텍스트 순서는 동작과 무관하다(전부 한 IIFE 스코프 — const 는 평가 시 할당, 법칙은 step() 때 호출).
 */
'use strict';
var fs = require('fs');
var path = require('path');

var LAWS_DIR = path.join(__dirname, 'laws');
var OUT = path.join(__dirname, 'hws-laws.js');

/* 조립 순서(매니페스트). head 가 IIFE 를 열고, order 가 LAW_ORDER·api·IIFE 를 닫는다. 중간 도메인 순서는 동작 무관. */
var MANIFEST = ['head', 'defaults', 'flow', 'star', 'gene', 'life', 'social', 'measure', 'order'];

var BANNER = [
  '/* ⚠ 자동 생성 파일 — 직접 편집하지 말 것. 진실 원천은 engine/laws/*.js.',
  ' * 재생성: `node engine/build-laws.js` · 동기화 검사: `node engine/build-laws.js --check`(verify 가 호출).',
  ' * 법칙 추가법·구조 설명은 engine/build-laws.js 머리말 참조.',
  ' *',
  ' * 진화하는 누적 법칙 집합 — step 이 더해온 항이 *순서 있는 게이트 함수*로 산다(자기 노브=0 → early-return = 회귀 0).',
  ' * 순서 단일 출처 = LAW_ORDER(laws/order.js). 브라우저: window.HWS_LAWS (window.HWS_KERNEL 선행) / Node: module.exports.',
  ' */'
].join('\n');

function build() {
  var parts = MANIFEST.map(function (name) {
    var p = path.join(LAWS_DIR, name + '.js');
    return fs.readFileSync(p, 'utf8').replace(/\s*$/, '');   // 끝 공백 정규화
  });
  return BANNER + '\n' + parts.join('\n\n') + '\n';
}

var out = build();

if (process.argv.indexOf('--check') !== -1) {
  var cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur === out) { console.log('build-laws --check: hws-laws.js 동기화 OK'); process.exit(0); }
  console.error('build-laws --check: FAIL — hws-laws.js 가 laws/*.js 와 어긋남. `node engine/build-laws.js` 로 재생성하라.');
  process.exit(1);
}

fs.writeFileSync(OUT, out);
console.log('생성: engine/hws-laws.js (' + out.split('\n').length + '줄, 파트 ' + MANIFEST.length + '개)');
