// V1 눈 검증 — V3 브라우저 Lab 이 아직 없으므로 터미널에 같은 7요소를 출력한다.
// (입력 / 처리 과정 / 후보 / 선택 결과 / 상태 전후 / 실패 이유 / 인과)
// V3 완성 시 이 출력이 /lab/v1 의 diff 뷰로 그대로 옮겨간다.
//
//   실행: node packages/core/verify/v1.ts

import {
  createRandom,
  nextInt,
  pick,
  split,
  stateHash,
} from '../src/v1/index.ts';
import { firstDivergence, runToyWorld, type ToyEvent } from './v1-toy-world.ts';

const SEED_A = '배고픈 인간 1 + 음식 1';
const SEED_B = '배고픈 인간 1 + 음식 2';
const RUNS = 100;

const line = (): void => console.log('─'.repeat(78));
const heading = (text: string): void => {
  line();
  console.log(text);
  line();
};

function formatEvent(event: ToyEvent): string {
  const amount = event.amount >= 0 ? `+${String(event.amount)}` : String(event.amount);
  return `t${String(event.tick).padStart(2, '0')} ${event.subjectId} ${event.action.padEnd(7)} ${amount.padStart(3)}`;
}

// ① 입력 ─────────────────────────────────────────────────────────────────────
heading('① 입력 — 무엇을 넣었나');
console.log(`시드 A       : ${SEED_A}`);
console.log(`시드 B       : ${SEED_B}   (한 글자만 다른 시드)`);
console.log(`틱 / 주체 수 : 20 tick × 3 subject = 60 event`);
console.log(`반복 실행    : ${String(RUNS)}회`);

// ② 처리 과정 ────────────────────────────────────────────────────────────────
const runA = runToyWorld(SEED_A);
heading('② 처리 과정 — 사건 로그 (앞 6개 / 뒤 3개)');
for (const event of runA.events.slice(0, 6)) console.log(`  ${formatEvent(event)}`);
console.log('  …');
for (const event of runA.events.slice(-3)) console.log(`  ${formatEvent(event)}`);

// ③ 후보 / ④ 선택 결과 ───────────────────────────────────────────────────────
heading('③ 후보 · ④ 선택 결과 — 난수는 후보 중 무엇을 골랐나');
const ACTIONS = ['forage', 'rest', 'trade', 'flee'] as const;
const sampleRoot = createRandom(SEED_A);
for (let index = 0; index < 3; index += 1) {
  const label = `sample-${String(index)}`;
  const stream = split(sampleRoot, label);
  const [afterAction, action] = pick(stream, ACTIONS);
  const [, amount] = nextInt(afterAction, -3, 4);
  console.log(
    `  ${label}  후보 [${ACTIONS.join(' ')}]  →  선택 ${action.padEnd(7)} amount ${String(amount).padStart(2)}`,
  );
}
console.log('  (같은 라벨을 다시 split 하면 항상 같은 선택이 나온다)');

// ⑤ 상태 전후 + 해시 비교표 ──────────────────────────────────────────────────
heading(`⑤ 상태 전후 — 같은 시드 ${String(RUNS)}회 실행 해시 비교표`);
const stateHashes = new Map<string, number>();
const eventHashes = new Map<string, number>();
for (let run = 0; run < RUNS; run += 1) {
  const current = runToyWorld(SEED_A);
  stateHashes.set(current.stateHash, (stateHashes.get(current.stateHash) ?? 0) + 1);
  eventHashes.set(current.eventHash, (eventHashes.get(current.eventHash) ?? 0) + 1);
}
console.log('  대상        해시                 실행 수   판정');
for (const [hash, count] of stateHashes) {
  console.log(`  최종 상태   ${hash}   ${String(count).padStart(5)}   ${count === RUNS ? '동일 ✔' : '갈라짐 ✘'}`);
}
for (const [hash, count] of eventHashes) {
  console.log(`  사건 순서   ${hash}   ${String(count).padStart(5)}   ${count === RUNS ? '동일 ✔' : '갈라짐 ✘'}`);
}
console.log('');
console.log('  초기 재고   ' + JSON.stringify(Object.fromEntries(Object.keys(runA.world.stock).map((id) => [id, 10]))));
console.log('  최종 재고   ' + JSON.stringify(runA.world.stock));

// ⑥ 실패 이유 ────────────────────────────────────────────────────────────────
const runB = runToyWorld(SEED_B);
const divergence = firstDivergence(runA, runB);
heading('⑥ 실패 이유 — 시드가 다르면 어디서부터 갈라지는가');
console.log(`  A 상태 해시 ${runA.stateHash}`);
console.log(`  B 상태 해시 ${runB.stateHash}   ${runA.stateHash === runB.stateHash ? '동일 ✘(검출 실패)' : '상이 ✔'}`);
if (divergence === null) {
  console.log('  분기 지점   없음 ✘ — 서로 다른 시드가 같은 사건을 냈다');
} else {
  console.log(`  분기 지점   사건 #${String(divergence.index)}`);
  console.log(`    기대(A)   ${divergence.left ? formatEvent(divergence.left) : '(없음)'}`);
  console.log(`    실제(B)   ${divergence.right ? formatEvent(divergence.right) : '(없음)'}`);
}

// ⑦ 인과 ─────────────────────────────────────────────────────────────────────
heading('⑦ 인과 — 왜 이 결과가 나왔나');
console.log('  시드 → createRandom → 주체·틱 라벨로 split → 행동·수량 선택 → 재고 변화');
console.log('  사건 순서는 (tick, subjectId, action) 안정 정렬로 고정 — 처리 순서와 무관하다');
console.log('  상태 해시는 키 순서를 정규화한 뒤 계산 — 같은 상태면 같은 문자열');
console.log('');
console.log(`  검증 대상 상태 해시 함수 자체의 고정점: stateHash({tick:1}) = ${stateHash({ tick: 1 })}`);

const deterministic = stateHashes.size === 1 && eventHashes.size === 1;
const detects = runA.stateHash !== runB.stateHash && divergence !== null;
line();
console.log(`판정: 결정성 ${deterministic ? '통과 ✔' : '실패 ✘'} · 비결정 검출력 ${detects ? '통과 ✔' : '실패 ✘'}`);
line();

if (!deterministic || !detects) process.exitCode = 1;
