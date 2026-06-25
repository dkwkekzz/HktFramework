#!/usr/bin/env node
'use strict';
/* HktInfra 닫기 게이트 — step 닫기 체크리스트의 *기계 검증분*을 한 줄로 돈다 (step-0030 도입).
 *
 * 사용: node engine/close-step.js [NNNN] [--no-spine]
 *   NNNN 생략 시 src/STEP(현재 step 권위·0049 단일 src/ 전환). --no-spine 은 작업 중 빠른 반복용(닫기 전 최종 1회는 spine 포함 필수).
 *   통과(exit 0) 후 에이전트가 할 일: 델타 커밋 + `git tag step-NNNN`(역사 고고학 보존 — git + reviews/ 가 옛 동결 step-NNNN/ 디렉토리를 대신한다).
 *
 * 하는 일(기계 판정 가능분):
 *   1. node run.js          — 현재 step 4기둥 (exit 0)
 *   2. node run.js spine    — src 누적 회귀(전 역사 불변을 현재 코드에 단언) (exit 0)
 *   3. 크기 예산 — STATE.md ≤ 30KB · step-NNNN.md ≤ 8KB (압축형: delta+검증+척추, 서사 0)
 *   4. 산출물 존재 — step-NNNN.md (골격 TODO 잔존 검사 포함)
 *   5. STATE.md §7 INDEX 에 [NNNN](step-NNNN.md) 행 존재
 *
 * 하지 않는 일(에이전트 판단): 척추 체크 5항의 *설계* 판정 · 문서 수치 == verify 출력 대조 · §1~6 내용 갱신.
 * 전부 ✓ 면 exit 0 — "닫아도 된다"의 기계 측 절반. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pad = n => String(n).padStart(4, '0');
const KB = n => (n / 1024).toFixed(1) + 'KB';

// 현재 step 번호의 권위 = src/STEP (0049 단일 src/ 전환). 인자로 명시하면 그것을 따른다.
const srcStep = (() => { try { return parseInt(fs.readFileSync(path.join(ROOT, 'src', 'STEP'), 'utf8').trim(), 10); } catch { return null; } })();
const argNum = process.argv.find(a => /^\d+$/.test(a));
const N = pad(argNum ? parseInt(argNum, 10) : srcStep);
const noSpine = process.argv.includes('--no-spine');

let failed = false;
function checkItem(ok, label) { console.log((ok ? '  ✓ ' : '  ✗ ') + label); if (!ok) failed = true; }

console.log(`== close-step step-${N} — 닫기 게이트(기계 판정분) ==`);

// 3·4. 산출물 존재 + 크기 예산 + 골격 잔존
const budgets = [
  ['STATE.md', 30 * 1024],
  [`step-${N}.md`, 8 * 1024],
];
for (const [f, max] of budgets) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { checkItem(false, `${f} — 없음`); continue; }
  const sz = fs.statSync(p).size;
  checkItem(sz <= max, `${f} — ${KB(sz)} / 예산 ${KB(max)}`);
  if (f !== 'STATE.md') {
    const todo = (fs.readFileSync(p, 'utf8').match(/\(TODO:/g) || []).length;   // new-step.js 골격 표식만(본문의 일반 'TODO' 언급은 무관)
    checkItem(todo === 0, `${f} — 골격 표식 "(TODO:" 잔존 ${todo}건`);
  }
}

// 5. STATE §7 INDEX 행
{
  const st = fs.existsSync(path.join(ROOT, 'STATE.md')) ? fs.readFileSync(path.join(ROOT, 'STATE.md'), 'utf8') : '';
  checkItem(st.includes(`[${N}](step-${N}.md)`), `STATE.md §7 INDEX 에 [${N}] 행`);
}

// 6. src/ 박스 크기 가드 (step-0271·도구 갭 #43 — #49 재발 방비)
//   박스 1개=파일 1개 규칙상 한 박스가 >30KB 면 다음 *기능* step 전에 정리(분할/승격) step 이 필요(CLAUDE.md §박스 분할).
//   여기서는 *비실패 경고*만 한다 — 이번 step 닫기를 막지 않되(박스를 키운 기능 step 도 닫게), 그 사실을 매 close 마다 가시화해 #49 가 조용히 재발하지 않게 한다.
{
  const SRC = path.join(ROOT, 'src');
  const LIMIT = 30 * 1024;
  let over = [], maxF = null, maxSz = 0;
  try {
    for (const f of fs.readdirSync(SRC)) {
      if (!f.endsWith('.js')) continue;
      const sz = fs.statSync(path.join(SRC, f)).size;
      if (sz > maxSz) { maxSz = sz; maxF = f; }
      if (sz > LIMIT) over.push(`${f}(${KB(sz)})`);
    }
  } catch {}
  if (over.length) console.log(`  ⚠ src/ 박스 >30KB ${over.length}개: ${over.join(', ')} — 다음 기능 step 전 정리(#49) 권장(닫기는 막지 않음)`);
  else console.log(`  ✓ src/ 박스 크기 — 최대 ${maxF}(${KB(maxSz)}) ≤ 30KB (>30KB 0개)`);
}

// 1·2. 검증 실행 (가장 오래 걸리는 것을 마지막에)
function runJs(args, label) {
  process.stdout.write(`  … node run.js ${args.join(' ')} 실행 중\n`);
  const r = spawnSync('node', ['run.js', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const tail = (r.stdout || '').trim().split('\n').slice(-3).map(l => '      ' + l).join('\n');
  checkItem(r.status === 0, `${label} (exit ${r.status})`);
  if (tail) console.log(tail);
  if (r.status !== 0 && r.stderr) console.log(r.stderr.split('\n').slice(-10).map(l => '      ' + l).join('\n'));
}
runJs([N], `node run.js ${N} — 현재 step 4기둥`);
if (noSpine) console.log('  - spine 사슬 생략(--no-spine) — 닫기 전 최종 1회는 포함할 것');
else runJs(['spine'], 'node run.js spine — 전 시리즈 회귀 사슬');

console.log(failed
  ? `결과: FAIL — step-${N} 은 아직 닫을 수 없다(위 ✗ 해소 후 재실행)`
  : `결과: OK — 기계 판정분 통과. 남은 닫기 판정(에이전트): 척추 5항·문서 수치=verify 출력·STATE §1~6 갱신. 그 후 델타 커밋 + git tag step-${N}.`);
process.exit(failed ? 1 : 0);
