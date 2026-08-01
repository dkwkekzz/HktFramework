// V3 눈 검증 — Lab 자신은 브라우저에서 보는 것이 본 검증이다.
// 이 스크립트는 그 전에 확인할 수 있는 것을 확인한다:
//   ① 모든 페이지가 화면 7요소를 채우는가 ② 페이지가 결정적으로 그려지는가
//   ③ 정적 HTML 로 뽑히는가 (브라우저를 못 띄우는 환경에서도 눈으로 볼 수 있게)
//
//   실행: node packages/lab/verify/v3.ts
//   브라우저: npm run dev --workspace @hkt/lab  →  http://localhost:5173/#/v1

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stateHash } from '@hkt/core/v1';
import { formatSuite, runScenarios } from '@hkt/scenarios';

import { LAB_PAGES, SECTION_KEYS, findByClass, shellView, toHtml, pageFor } from '../src/index.ts';
import { v3Scenarios } from '../suites/v3.ts';

const outDir = new URL('../dist-static/', import.meta.url);

const line = (): void => console.log('─'.repeat(78));
const heading = (text: string): void => {
  line();
  console.log(text);
  line();
};

heading('① 입력 — 등록된 Lab 페이지');
for (const page of LAB_PAGES) {
  console.log(`  ${page.id.padEnd(4)} ${page.route.padEnd(6)} ${page.title}`);
}

heading('②③④ 처리 · 후보 · 선택 — 페이지별 7요소 충족과 판정');
console.log('  모듈  섹션  빈칸  판정        화면 해시');
let allOk = true;
for (const page of LAB_PAGES) {
  const view = page.render();
  const sections = findByClass(view, 'section');
  const empties = findByClass(view, 'empty');
  const verdict = findByClass(view, 'verdict')[0];
  const passed = (verdict?.attrs?.['class'] ?? '').includes('ok');
  const sectionsOk = sections.length === SECTION_KEYS.length && empties.length === 0;
  if (!passed || !sectionsOk) allOk = false;
  console.log(
    `  ${page.id.padEnd(5)} ${String(sections.length).padStart(4)} ${String(empties.length).padStart(5)}  ${
      passed ? '통과 ✔' : '실패 ✘'
    }      ${stateHash(view)}`,
  );
}

heading('⑤ 상태 전후 — 같은 입력이면 같은 화면인가 (렌더 결정성)');
let deterministic = true;
for (const page of LAB_PAGES) {
  const first = stateHash(page.render());
  const second = stateHash(page.render());
  if (first !== second) deterministic = false;
  console.log(`  ${page.id.padEnd(5)} ${first === second ? '동일 ✔' : '갈라짐 ✘'}  ${first}`);
}

// 정적 HTML 로도 뽑아 둔다 — 브라우저를 못 띄우는 환경에서 파일로 열어 볼 수 있게.
mkdirSync(outDir, { recursive: true });
for (const page of LAB_PAGES) {
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>Lab ${page.id}</title>
<style>body{background:#0f1115;color:#dfe3ea;font:14px/1.6 ui-monospace,monospace;margin:0}
table{border-collapse:collapse;width:100%;background:#171a21}th,td{border:1px solid #272c36;padding:6px 10px;text-align:left;vertical-align:top}
.verdict.ok{color:#4ade80}.verdict.bad{color:#f87171}.path{color:#fbbf24}.empty{color:#8b93a3}
.shell{display:grid;grid-template-columns:220px 1fr}.content{padding:20px}a{color:#60a5fa}</style>
</head><body>${toHtml(shellView(pageFor(page.route)))}</body></html>
`;
  writeFileSync(new URL(`${page.id.toLowerCase()}.html`, outDir), html, 'utf8');
}
console.log('');
console.log(`  정적 HTML: ${fileURLToPath(outDir)} (브라우저 없이 파일로 열어 볼 수 있다)`);

const suite = runScenarios(v3Scenarios);
heading('⑥ 실패 이유 — 시나리오 3종 (V2 실행기)');
console.log(formatSuite(suite));

heading('⑦ 인과 — 왜 이렇게 만들었나');
console.log('  렌더러는 순수 함수 상태 → VNode 다 — 화면도 다른 상태 원소처럼 검증된다 (원칙 ③)');
console.log('  브라우저는 VNode 를 DOM 으로 옮기기만 한다 — 판단 로직이 화면에 숨지 않는다');
console.log('  Lab 은 core·scenarios·contracts 를 소스 그대로 실행한다 — 서버와 같은 코드, 같은 해시');
console.log('  본 검증은 브라우저다: npm run dev --workspace @hkt/lab → http://localhost:5173/#/v1');

line();
console.log(
  `판정: 7요소 충족 ${allOk ? '통과 ✔' : '실패 ✘'} · 렌더 결정성 ${deterministic ? '통과 ✔' : '실패 ✘'} · 시나리오 ${suite.failed === 0 ? '통과 ✔' : '실패 ✘'}`,
);
line();

if (!allOk || !deterministic || suite.failed > 0) process.exitCode = 1;
