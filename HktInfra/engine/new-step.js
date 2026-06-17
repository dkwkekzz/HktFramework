#!/usr/bin/env node
'use strict';
/* HktInfra 스캐폴드 — 새 step 골격을 기계적으로 연다 (0049 단일 src/ 전환 — 복사 전진[anti-DRY] 폐기).
 *
 * 사용: node engine/new-step.js [NNNN]     (생략 시 src/STEP + 1)
 *
 * 하는 일(코드 통복사 0 — 이제 src/ 한 곳에서 *제자리* 수정):
 *   1. src/*.js → baseline/ 스냅샷(덮어쓰기) — 직전 step(= 지금 닫힌 src) 을 reg 대조용 *동결 1벌*로 굳힌다.
 *      (verify.js 의 NETPREV 는 항상 ../baseline/net-core.js — 더 이상 step 번호 치환 없음 = churn 0.)
 *   2. src/STEP 을 NNNN 으로 전진(현재 step 번호의 단일 권위).
 *   3. step-NNNN.md + step-NNNN-concepts.md 골격 생성 (CLAUDE.md 필수 절 목차).
 *
 * 하지 않는 일: 코드 복사·박스 헤더 치환(박스 파일의 step 번호 = *마지막 수정 step* 으로 둔다 = 의미 있는 기록)·
 *   새 프로토콜/박스 로직·STATE.md 갱신 — 그건 에이전트의 일(src/ 의 닿는 박스 파일만 Edit + verify 셸에 새 모드).
 * 안전: md/concepts 가 이미 있으면 중단(덮어쓰지 않음). baseline 스냅샷은 src 가 지금 *닫힌* 상태일 때만 의미 있다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BASELINE = path.join(ROOT, 'baseline');
const pad = n => String(n).padStart(4, '0');

if (!fs.existsSync(path.join(SRC, 'verify.js'))) { console.error('src/verify.js 없음 — 단일 src/ 구조가 아님(0049 전환 전?)'); process.exit(1); }

const curNum = parseInt((fs.readFileSync(path.join(SRC, 'STEP'), 'utf8') || '').trim(), 10);
if (!Number.isInteger(curNum)) { console.error('src/STEP 을 읽지 못함'); process.exit(1); }
const next = process.argv[2] ? parseInt(process.argv[2], 10) : curNum + 1;
if (!Number.isInteger(next) || next <= curNum) { console.error(`잘못된 step 번호: ${process.argv[2]} (현재 ${pad(curNum)} 보다 커야 함)`); process.exit(1); }

const C = pad(curNum), N = pad(next);
const nextMd = path.join(ROOT, `step-${N}.md`);
const nextConcepts = path.join(ROOT, `step-${N}-concepts.md`);
for (const f of [nextMd, nextConcepts]) {
  if (fs.existsSync(f)) { console.error('이미 존재: ' + f + ' — 중단(덮어쓰지 않음)'); process.exit(1); }
}

// 1. src/*.js → baseline/ 스냅샷 (직전 step 동결 — reg 대조 대상)
fs.mkdirSync(BASELINE, { recursive: true });
for (const f of fs.readdirSync(BASELINE)) if (f.endsWith('.js')) fs.unlinkSync(path.join(BASELINE, f));
const snapped = [];
for (const f of fs.readdirSync(SRC)) {
  if (!f.endsWith('.js')) continue;                  // 박스 코드만(STEP·verify 가설 셸 제외 아님 — verify 도 net-core 와 함께 굳혀 reg 정합)
  if (f === 'verify.js' || f === 'panel.js') continue;  // baseline 은 net-core require 대상 박스만(셸/관찰 불요)
  fs.copyFileSync(path.join(SRC, f), path.join(BASELINE, f));
  snapped.push(f);
}

// 2. src/STEP 전진
fs.writeFileSync(path.join(SRC, 'STEP'), N + '\n');

// 3. md / concepts 골격
fs.writeFileSync(nextMd, `# step-${N} — (TODO: 제목 — 더한 한 조각 한 줄)

> 직전: [step-${C}](step-${C}.md) · 현재 위치·다음 가설의 권위: [STATE.md](STATE.md) · 척추: [SPINE.md](SPINE.md)
> 코드는 단일 소스 \`src/\`(제자리 수정) · 직전 동결 스냅샷 \`baseline/\` · reg 는 src vs baseline 비트 대조.

## 검증 질문

(TODO: 이 step 이 답할 질문과 닫는 조건 — SPINE 6계층의 어느 박스/계약을 채우는가)

## 1. 6계층 지도 ([SPINE.md](SPINE.md) §6)

| 계층 | 이번 step |
|------|-----------|
| 엣지 | |
| 월드 | |
| 게임 서비스 | |
| 이벤트 버스 | |
| 코디네이션 | |
| 데이터 | |

## 2. 메커니즘 — (TODO: 더한 한 조각; 플래그 OFF → baseline 비트 동일 = 회귀 0)

## 3. 검증 결과 (시드 [42,7,1234,99,2026] · \`node run.js\` / \`node run.js spine\`)

(TODO: 문서의 수치 = verify 출력. reg·결정론 전파·권위 보존·수렴·가설)

## 4. 척추 체크 5항

(① 신성한 tick ② 결정론 코어 ③ 권위 단일 소유 ④ 은닉·단일 연결 ⑤ headless·원격 검증)

## 9. 의외의 발견 / 정직한 한계

## 다음 (권위는 [STATE.md](STATE.md) §2)
`);

fs.writeFileSync(nextConcepts, `# step-${N} concepts — (TODO: 영어 제목)

> 정식 기록: [step-${N}.md](step-${N}.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| | | |

## 1. (TODO: 핵심 개념 — 무엇을·왜·어떻게 검증했나)

## 한 줄 요약
`);

console.log(`스캐폴드 완료: step-${C} → step-${N} (단일 src/ 모델)
  baseline 스냅샷: src/*.js → baseline/ (${snapped.length}개 박스 — 직전 step 동결·reg 대조)
  src/STEP: ${C} → ${N}
  생성: step-${N}.md · step-${N}-concepts.md

남은 일 (에이전트 — src/ 의 닿는 박스 파일만 Edit, 통복사 없음):
  1. src/<박스>.js — 이번 한 조각의 프로토콜/박스 + OFF 플래그 (수정한 파일 헤더만 step-${N} 으로 갱신)
  2. src/verify.js — 이번 step 의 새 가설 모드로 교체(kit.MODES['<mode>']=fn·kit.ORDER.splice). NETPREV 는 ../baseline 고정(불변).
  3. step-${N}.md / step-${N}-concepts.md — 골격 채우기 (수치 = verify 출력)
  4. node run.js && node run.js spine 통과 확인 (reg = src vs baseline 비트 동일)
  5. STATE.md §1~6 갱신 + §7 INDEX 1줄 append
  6. node engine/close-step.js (닫기 게이트) → 통과 시 git tag step-${N}`);
