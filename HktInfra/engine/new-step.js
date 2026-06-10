#!/usr/bin/env node
'use strict';
/* HktInfra 스캐폴드 — 새 step 골격을 기계적으로 생성한다 (복사 전진[anti-DRY] 의 *복사*는 기계가, 에이전트는 델타만 Edit).
 *
 * 사용: node engine/new-step.js [NNNN]     (생략 시 최대 step 번호 + 1)
 *
 * 하는 일:
 *   1. step-PPPP/ 의 모든 파일 → step-NNNN/ 복사 + 치환:
 *      - `step-PPPP` → `step-NNNN`           (자기참조: 헤더 주석·usage·로그 문자열)
 *      - `../step-OOOO/` → `../step-PPPP/`   (verify.js 의 reg 대조 require — 직전 step 으로 한 단계 전진)
 *      프로즈의 역사적 step 언급(bare "0016 대비" 등)은 건드리지 않는다.
 *   2. step-NNNN.md + step-NNNN-concepts.md 골격 생성 (CLAUDE.md 필수 절 목차)
 *
 * 하지 않는 일: 새 프로토콜/박스 로직·STATE.md 갱신 — 그건 에이전트의 일.
 * 안전: 대상이 하나라도 이미 있으면 중단. 직전 step 파일은 *읽기만*(동결 단위 불변).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pad = n => String(n).padStart(4, '0');

const nums = fs.readdirSync(ROOT)
  .map(n => /^step-(\d{4})$/.exec(n)).filter(Boolean)
  .map(m => parseInt(m[1], 10))
  .filter(n => fs.existsSync(path.join(ROOT, 'step-' + pad(n), 'verify.js')))
  .sort((a, b) => a - b);
if (!nums.length) { console.error('step-NNNN 디렉토리를 찾지 못함'); process.exit(1); }

const prev = nums[nums.length - 1];
const prevprev = nums.length >= 2 ? nums[nums.length - 2] : null;
const next = process.argv[2] ? parseInt(process.argv[2], 10) : prev + 1;
if (!Number.isInteger(next) || next <= prev) { console.error(`잘못된 step 번호: ${process.argv[2]} (직전 ${pad(prev)} 보다 커야 함)`); process.exit(1); }

const P = pad(prev), N = pad(next), PP = prevprev !== null ? pad(prevprev) : null;
const prevDir = path.join(ROOT, 'step-' + P);
const nextDir = path.join(ROOT, 'step-' + N);
const nextMd = path.join(ROOT, `step-${N}.md`);
const nextConcepts = path.join(ROOT, `step-${N}-concepts.md`);
for (const f of [nextDir, nextMd, nextConcepts]) {
  if (fs.existsSync(f)) { console.error('이미 존재: ' + f + ' — 중단(덮어쓰지 않음)'); process.exit(1); }
}

// 치환 순서 중요: 자기참조(P→N) 먼저, 그 다음 reg 대조 경로(PP→P) — 서로 간섭 없음.
const sub = s => {
  let t = s.split(`step-${P}`).join(`step-${N}`);
  if (PP) t = t.split(`../step-${PP}/`).join(`../step-${P}/`);
  return t;
};

fs.mkdirSync(nextDir);
const copied = [];
for (const f of fs.readdirSync(prevDir)) {
  const src = path.join(prevDir, f);
  if (!fs.statSync(src).isFile()) continue;
  fs.writeFileSync(path.join(nextDir, f), sub(fs.readFileSync(src, 'utf8')));
  copied.push(f);
}

fs.writeFileSync(nextMd, `# step-${N} — (TODO: 제목 — 더한 한 조각 한 줄)

> 직전: [step-${P}](step-${P}.md) · 현재 위치·다음 가설의 권위: [STATE.md](STATE.md) · 척추: [SPINE.md](SPINE.md)

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

## 2. 메커니즘 — (TODO: 더한 한 조각; 플래그 OFF → 직전 step 비트 동일 = 회귀 0)

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

console.log(`스캐폴드 완료: step-${P} → step-${N}
  복사: ${copied.join(' · ')}
  생성: step-${N}.md · step-${N}-concepts.md
  치환: step-${P} → step-${N} (자기참조)${PP ? ` · ../step-${PP}/ → ../step-${P}/ (reg 대조 require)` : ''}

남은 일 (에이전트 — Edit 로만, 전체 Write 금지):
  1. step-${N}/net-core.js (등) — 이번 한 조각의 프로토콜/박스 + OFF 플래그 (헤더 주석 갱신)
  2. step-${N}/verify.js — reg 절의 직전 step 번호 프로즈 갱신 + 가설 모드 교체
  3. step-${N}/host.js·cluster.js — 이번 조각의 스냅샷/재구성 항만 추가
  4. step-${N}.md / step-${N}-concepts.md — 골격 채우기 (수치 = verify 출력)
  5. node run.js && node run.js spine 통과 확인
  6. STATE.md §1~6 갱신 + §7 INDEX 1줄 append`);
