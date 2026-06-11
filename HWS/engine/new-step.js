#!/usr/bin/env node
'use strict';
/* HWS 스캐폴드 — 새 step 골격을 기계적으로 생성한다 (에이전트 토큰 절약: 복사·치환은 기계가, 에이전트는 델타만 Edit).
 *
 * 사용: node engine/new-step.js [NNNN]     (생략 시 최대 step 번호 + 1)
 *
 * 하는 일:
 *   1. step-PPPP/{panel.js,verify.js} → step-NNNN/ 복사 + 자기참조 치환
 *      (`step-PPPP/` 경로 · `HWS_PANEL_PPPP` 식별자 · `HWS step-PPPP` 헤더만 — 프로즈의 옛 step 언급은 보존)
 *   2. step-PPPP.html → step-NNNN.html 복사 + 치환 (title 은 TODO placeholder)
 *   3. step-NNNN.md 골격 생성 (CLAUDE.md 의 필수 절 목차)
 *
 * 하지 않는 일: hws-laws.js(법칙 1개 + 노브 + LAW_ORDER)·STATE.md 갱신 — 그건 에이전트의 일.
 * 안전: 대상 파일이 하나라도 이미 있으면 중단. 직전 step 파일은 *읽기만*(닫은 step 불변).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pad = n => String(n).padStart(4, '0');

const nums = fs.readdirSync(ROOT)
  .map(n => /^step-(\d{4})$/.exec(n)).filter(Boolean)
  .map(m => parseInt(m[1], 10))
  .filter(n => fs.existsSync(path.join(ROOT, 'step-' + pad(n), 'panel.js')))
  .sort((a, b) => a - b);
if (!nums.length) { console.error('step-NNNN 디렉토리를 찾지 못함'); process.exit(1); }

const prev = nums[nums.length - 1];
const next = process.argv[2] ? parseInt(process.argv[2], 10) : prev + 1;
if (!Number.isInteger(next) || next <= prev) { console.error(`잘못된 step 번호: ${process.argv[2]} (직전 ${pad(prev)} 보다 커야 함)`); process.exit(1); }

const P = pad(prev), N = pad(next);
const prevDir = path.join(ROOT, 'step-' + P);
const nextDir = path.join(ROOT, 'step-' + N);
const nextHtml = path.join(ROOT, `step-${N}.html`);
const nextMd = path.join(ROOT, `step-${N}.md`);
for (const f of [nextDir, nextHtml, nextMd]) {
  if (fs.existsSync(f)) { console.error('이미 존재: ' + f + ' — 중단(덮어쓰지 않음)'); process.exit(1); }
}

// 자기참조만 치환 — 프로즈의 역사적 step 언급(예: "step-0030 zArena 류")은 건드리지 않는다.
const sub = s => s
  .split(`step-${P}/`).join(`step-${N}/`)
  .split(`HWS_PANEL_${P}`).join(`HWS_PANEL_${N}`)
  .split(`HWS step-${P}`).join(`HWS step-${N}`);

fs.mkdirSync(nextDir);
for (const f of ['panel.js', 'verify.js']) {
  fs.writeFileSync(path.join(nextDir, f), sub(fs.readFileSync(path.join(prevDir, f), 'utf8')));
}

let html = sub(fs.readFileSync(path.join(ROOT, `step-${P}.html`), 'utf8'));
html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>HWS step-${N} — (TODO: 제목)</title>`);
fs.writeFileSync(nextHtml, html);

fs.writeFileSync(nextMd, `# step-${N} — (TODO: 제목 — 더한 한 조각 한 줄)

> 직전: [step-${P}](step-${P}.md) · 현재 위치·다음 가설의 권위: [STATE.md](STATE.md) · 척추: [SPINE.md](SPINE.md)

## 검증 질문

(TODO: 본 thesis 한 단락 — 이 step 이 답할 질문과 닫는 조건)

## 0. 쉽게 풀어 쓴 설명 (먼저 읽기 — 전문 기호 없이)

(TODO: 비전문가용 — 내부 약칭·기호·노브명 금지. 이 단계가 답한 질문 → 무엇을 바꿨나 → 무엇을 발견했나 → 왜 중요한가 → 솔직한 한계)

## 1. 6요소 지도

| # | 요소 | 이번 step |
|---|------|-----------|
| 1 | 터 (Ground) | |
| 2 | 흐름량 (Quantity) | |
| 3 | 법칙 (Law) | |
| 4 | 구동 (Drive) | |
| 5 | 자원 (Resource) | |
| 6 | 생명 (Life) | |

## 2. 메커니즘 — (TODO: 더한 법칙 1개 + 노브 + LAW_ORDER 자리; 노브=0 → early-return = 회귀 0)

### 무엇을 *안* 바꿨나 (다음으로 전가)

## 3. 검증 결과 (가설 4기둥 + 척추 체크 4항) — 시드 [42, 7, 1234, 99, 2026]

(TODO: 문서의 수치 = verify 출력. \`node step-${N}/verify.js all\` + \`node engine/validate/verify-sim-engine.js\`)

### 척추 체크 4항

## 4. 의외의 발견

## 5. 정직한 한계

## 6. 다음

(권위는 [STATE.md](STATE.md) §2)
`);

console.log(`스캐폴드 완료: step-${P} → step-${N}
  생성: step-${N}/panel.js · step-${N}/verify.js · step-${N}.html · step-${N}.md
  치환: step-${P}/ → step-${N}/ · HWS_PANEL_${P} → HWS_PANEL_${N} · "HWS step-${P}" 헤더

남은 일 (에이전트 — Edit 로만, 전체 Write 금지):
  1. engine/hws-laws.js — 법칙 1개 + DEFAULTS 노브 + LAW_ORDER 한 자리 (노브=0 → early-return)
  2. step-${N}/verify.js — 가설 시나리오 교체 (reg 는 새 노브=0 토글로 갱신)
  3. step-${N}/panel.js — 헤더 주석·title/subtitle·새 노브 행 1개 (프로즈의 "직전 step-${P}" 언급 갱신)
     + presets(데모 아레나)·가설 수치 통계를 *이번 가설*(verify 새 시나리오)에 맞게 갱신 — "한 클릭으로 보이는" 가독성 유지(PANEL.md "presets" 절)
  4. step-${N}.html — title·법칙 주석 갱신
  5. step-${N}.md — 골격 채우기 (수치 = verify 출력)
  6. golden-sim.json 가법 키 + verify-sim-engine.js 시나리오 (미존재 시 no-op 규칙)
  7. STATE.md §1~6 갱신 + §7 INDEX 1줄 append`);
