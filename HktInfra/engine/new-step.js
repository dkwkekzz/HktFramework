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
 *   3. step-NNNN.md 골격 생성 (CLAUDE.md 필수 절 목차). 직관 정리는 concepts 가 아니라 reviews/ 묶음 감사로 일원화.
 *
 * 하지 않는 일: 코드 복사·박스 헤더 치환(박스 파일의 step 번호 = *마지막 수정 step* 으로 둔다 = 의미 있는 기록)·
 *   새 프로토콜/박스 로직·STATE.md 갱신 — 그건 에이전트의 일(src/ 의 닿는 박스 파일만 Edit + verify 셸에 새 모드).
 * 안전: md 가 이미 있으면 중단(덮어쓰지 않음). baseline 스냅샷은 src 가 지금 *닫힌* 상태일 때만 의미 있다.
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
if (fs.existsSync(nextMd)) { console.error('이미 존재: ' + nextMd + ' — 중단(덮어쓰지 않음)'); process.exit(1); }

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

// 3. md 골격 — 압축형: agent 가 *한 일(delta)* + review 가 *확인할 재현 정보* 만.
//    인과·직관 서사는 reviews/(infra-review), "지금 어디/다음"은 STATE.md 가 가진다(중복 0).
fs.writeFileSync(nextMd, `# step-${N} — (TODO: 더한 한 조각 한 줄)

> 직전 step-${C} · 권위 [STATE.md](STATE.md) · 척추 [SPINE.md](SPINE.md) · 코드 \`src/\`(제자리) · reg=src vs baseline 비트 대조

## 한 일 (delta)

(TODO: 박스 \`src/<box>.js\` — 더한 메커니즘 1~3줄 · 계층:<6계층 중> · OFF 플래그 <name>(OFF→baseline 비트 동일=회귀 0) · verify.js 새 모드 <mode>)

## 검증 (수치 = \`node run.js\` / \`node run.js spine\` 출력)

(TODO: reg 0 · 결정론 전파 · 권위/수렴 · 가설 <mode>:<핵심 수치 1개> · spine ALL OK)

## 척추 5항 + 한계

(TODO: ①tick ②결정론 ③권위 ④은닉 ⑤headless — 편차·이슈·정직한 한계·의외의 발견 있으면 한 줄, 없으면 "이상 없음")
`);

console.log(`스캐폴드 완료: step-${C} → step-${N} (단일 src/ 모델)
  baseline 스냅샷: src/*.js → baseline/ (${snapped.length}개 박스 — 직전 step 동결·reg 대조)
  src/STEP: ${C} → ${N}
  생성: step-${N}.md

남은 일 (에이전트 — src/ 의 닿는 박스 파일만 Edit, 통복사 없음):
  1. src/<박스>.js — 이번 한 조각의 프로토콜/박스 + OFF 플래그 (수정한 파일 헤더만 step-${N} 으로 갱신)
  2. src/verify.js — 이번 step 의 새 가설 모드로 교체(kit.MODES['<mode>']=fn·kit.ORDER.splice). NETPREV 는 ../baseline 고정(불변).
  3. step-${N}.md — 압축 골격 3절 채우기(한 일·검증·척추+한계 / 수치=verify 출력 / 서사 금지 — 인과는 reviews/, 다음은 STATE)
  4. node run.js && node run.js spine 통과 확인 (reg = src vs baseline 비트 동일)
  5. STATE.md §1~6 갱신 + §7 INDEX 1줄 append
  6. node engine/close-step.js (닫기 게이트) → 통과 시 git tag step-${N}`);
