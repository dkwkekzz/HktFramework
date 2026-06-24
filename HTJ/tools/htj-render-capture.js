// tools/htj-render-capture.js — 범용 헤드리스 캡처 러너 (장면 통일 U1·확인용 도구).
//
//   왜: step 마다 capture.js 가 "장면 셋업 + 엔진 루프 + PNG"를 *매번 새로* 짰다. 이 러너 하나가
//   *모든* step 의 캡처를 대신한다 — viewer/scenes/step_NNNN.js(시나리오 SSOT 1벌)를 읽어
//   init→advance 를 frames 마크까지 굴리고, 각 마크에서 toFrame(world) 을 모아 tools/htj-capture.js
//   로 PNG 를 쓴다. viewer 라이브와 *같은 장면 모듈* 을 소비한다(픽셀 동일 아닌 *세계* 동일).
//
//   확인용 도구다 — engine 을 *읽기만* 한다(세계↔확인용 단방향). Node 전용.
//
//   실행:
//     node tools/htj-render-capture.js <NNNN> [outPng]
//       기본 outPng = steps/step_NNNN/capture.png
//   장면 모듈 계약(viewer/scenes/step_NNNN.js):
//     { init(w), advance(w,p), frames:[step…], toFrame(w)->{pts}, makeWorld?()->w, captureOpts?, defaults? }
//     · frames 에 0 이 있으면 t=0(init 직후)도 캡처한다.
'use strict';
const fs = require('fs'), path = require('path');
const Cap = require('./htj-capture.js');

function main() {
  const id = (process.argv[2] || '').replace(/[^0-9]/g, '').padStart(4, '0');
  if (!id || id === '0000') { console.error('사용법: node tools/htj-render-capture.js <NNNN> [outPng]'); process.exit(2); }

  const scenePath = path.resolve(__dirname, '../viewer/scenes/step_' + id + '.js');
  if (!fs.existsSync(scenePath)) { console.error(`장면 모듈 없음: ${path.relative(process.cwd(), scenePath)} (아직 scenes/ 로 안 옮긴 step)`); process.exit(2); }
  const scene = require(scenePath);
  if (typeof scene.init !== 'function' || typeof scene.toFrame !== 'function') { console.error('장면 모듈에 init/toFrame 없음'); process.exit(2); }

  const out = path.resolve(process.argv[3] || path.resolve(__dirname, '../steps/step_' + id + '/capture.png'));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const w = scene.makeWorld ? scene.makeWorld() : { N: scene.N || 24 };
  const p = scene.defaults || {};
  scene.init(w);

  const marks = (scene.frames && scene.frames.length) ? scene.frames.slice() : [1];
  const maxStep = Math.max(...marks);
  const frames = [];
  if (marks.includes(0)) frames.push(scene.toFrame(w));               // t=0(init 직후) 옵션
  for (let s = 1; s <= maxStep; s++) {
    scene.advance(w, p);
    if (marks.includes(s)) frames.push(scene.toFrame(w));
  }

  const dim = Cap.writeFramesPNG(out, frames, scene.captureOpts || { N: 48 });
  const deps = frames.map(f => f.depositCount).filter(v => v != null);
  console.log(`\n=== 헤드리스 캡처(범용 러너): step_${id} ===`);
  console.log(`  장면: viewer/scenes/step_${id}.js (viewer 라이브와 같은 한 벌)`);
  console.log(`  프레임 ${frames.length}개 @ steps ${marks.join(',')} · 캔버스 ${dim.Wd}×${dim.Hd}px`);
  if (deps.length) console.log(`  퇴적 수(프레임별): ${deps.join(' → ')}`);
  console.log(`  스크린샷: ${path.relative(process.cwd(), out)}`);
  console.log(`\n결과: 캡처 PASS ✅ (per-step capture.js 없이 장면 1벌로 생성)\n`);
}

main();
