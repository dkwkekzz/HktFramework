// V1 검증 시나리오 3종 — V2 실행기 형식으로 소급 등록 (STATE.md 소급 부채 1번).
// 이전에는 node:test 안에 손으로 쓰여 있었다. 이제 V1 도 다른 모듈과 같은 실행기를 지난다.

import { createRandom, nextInt, pick, shuffle, stateHash } from '@hkt/core/v1';

import {
  defineScenario,
  expectDeterministic,
  expectDifferent,
  expectRejected,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';
import { firstDivergence, runToyWorld, type ToyRun } from './v1-toy-world.ts';

const SEED_A = '배고픈 인간 1 + 음식 1';
const SEED_B = '배고픈 인간 1 + 음식 2';
const RUNS = 100;

/** 정상 — 같은 시드로 100회 실행하면 사건 순서와 최종 상태 해시가 하나로 모인다. */
export const v1SameSeed100 = defineScenario({
  id: 'v1-same-seed-100',
  module: 'V1',
  kind: 'normal',
  purpose: `같은 시드로 ${String(RUNS)}회 실행하면 사건 순서와 최종 상태 해시가 전부 같다.`,
  arrange: (): { readonly seed: string; readonly runs: number } => ({ seed: SEED_A, runs: RUNS }),
  act: ({ seed, runs }) => {
    const first = runToyWorld(seed);
    const stateHashes = new Set<string>();
    const eventHashes = new Set<string>();
    let firstDivergentRun: number | null = null;
    for (let run = 0; run < runs; run += 1) {
      const current = runToyWorld(seed);
      stateHashes.add(current.stateHash);
      eventHashes.add(current.eventHash);
      if (firstDivergentRun === null && firstDivergence(first, current) !== null) {
        firstDivergentRun = run;
      }
    }
    return {
      eventCount: first.events.length,
      stateHashes: [...stateHashes],
      eventHashes: [...eventHashes],
      firstDivergentRun,
      // 저장 → 복원 → 재비교: 리플레이가 성립하는가.
      revivedStateHash: stateHash((JSON.parse(JSON.stringify(first)) as ToyRun).world),
      originalStateHash: first.stateHash,
    };
  },
  assert: (result): Assertion[] => [
    expectState('최종 상태 해시는 1종이다', 1, result.stateHashes.length),
    expectState('사건 해시는 1종이다', 1, result.eventHashes.length),
    expectState('갈라진 실행이 없다', null, result.firstDivergentRun),
    expectState('20틱 × 3주체 = 60 사건', 60, result.eventCount),
    expectState(
      '직렬화 후 복원해도 같은 상태다',
      result.originalStateHash,
      result.revivedStateHash,
    ),
  ],
});

/** 실패 — 시드가 한 글자만 달라도 갈라지고, 최초 분기 지점을 지목한다. */
export const v1SeedDriftDetected = defineScenario({
  id: 'v1-seed-drift-detected',
  module: 'V1',
  kind: 'failure',
  purpose: '시드가 한 글자만 달라도 해시가 갈라지고 최초로 달라진 사건이 지목된다.',
  arrange: (): { readonly seedA: string; readonly seedB: string } => ({
    seedA: SEED_A,
    seedB: SEED_B,
  }),
  act: ({ seedA, seedB }) => {
    const left = runToyWorld(seedA);
    const right = runToyWorld(seedB);
    const divergence = firstDivergence(left, right);
    const tampered = { ...left.world, stock: { ...left.world.stock, injected: 1 } };
    return {
      leftStateHash: left.stateHash,
      rightStateHash: right.stateHash,
      leftEventHash: left.eventHash,
      rightEventHash: right.eventHash,
      divergenceIndex: divergence?.index ?? null,
      divergenceLeft: divergence?.left ?? null,
      divergenceRight: divergence?.right ?? null,
      tamperedHash: stateHash(tampered),
      originalHash: left.stateHash,
    };
  },
  assert: (result): Assertion[] => [
    expectDifferent('상태 해시가 갈라진다', result.leftStateHash, result.rightStateHash),
    expectDifferent('사건 해시가 갈라진다', result.leftEventHash, result.rightEventHash),
    expectTrue(
      '최초 분기 사건이 지목된다',
      typeof result.divergenceIndex === 'number',
      result.divergenceIndex,
    ),
    expectDifferent(
      '분기 지점의 기대와 실제가 실제로 다르다',
      result.divergenceLeft,
      result.divergenceRight,
    ),
    expectDifferent('결과에 손을 대면 즉시 검출된다', result.originalHash, result.tamperedHash),
  ],
});

/** 경계 — 빈 실행·시드 타입 차이·최소 실행·빈 입력 연산. */
export const v1Boundary = defineScenario({
  id: 'v1-boundary',
  module: 'V1',
  kind: 'boundary',
  purpose: '틱 0·주체 0·시드 0 vs "0"·최소 실행·빈 배열 연산에서도 결정성이 유지된다.',
  arrange: (): { readonly emptySeed: string; readonly minimalSeed: string } => ({
    emptySeed: 'empty',
    minimalSeed: 'minimal',
  }),
  act: ({ emptySeed, minimalSeed }) => {
    const empty = runToyWorld(emptySeed, 0, 0);
    const emptyOther = runToyWorld('other-seed', 0, 0);
    const minimal = runToyWorld(minimalSeed, 1, 1);
    return {
      emptyEventCount: empty.events.length,
      emptyTick: empty.world.tick,
      emptyStateHash: empty.stateHash,
      emptyStateHashAgain: runToyWorld(emptySeed, 0, 0).stateHash,
      emptyEventHash: empty.eventHash,
      otherEmptyEventHash: emptyOther.eventHash,
      numericSeedEventHash: runToyWorld(0, 5, 1).eventHash,
      stringSeedEventHash: runToyWorld('0', 5, 1).eventHash,
      minimalEventCount: minimal.events.length,
      minimalFirstTick: minimal.events[0]?.tick ?? null,
    };
  },
  assert: (result): Assertion[] => [
    expectState('빈 세계는 사건이 없다', 0, result.emptyEventCount),
    expectState('빈 세계의 틱은 0이다', 0, result.emptyTick),
    expectState('빈 실행도 재현된다', result.emptyStateHash, result.emptyStateHashAgain),
    expectState(
      '사건이 없으면 시드가 달라도 사건 해시는 같다',
      result.emptyEventHash,
      result.otherEmptyEventHash,
    ),
    expectDifferent(
      '시드 0 과 "0" 은 다른 시드다',
      result.numericSeedEventHash,
      result.stringSeedEventHash,
    ),
    expectState('최소 실행의 사건은 1개다', 1, result.minimalEventCount),
    expectState('최소 실행의 첫 사건은 1틱이다', 1, result.minimalFirstTick),
    expectRejected('빈 배열에서 고를 수 없다', () => pick(createRandom('boundary'), []), /빈 배열/),
    expectRejected('빈 범위에서 뽑을 수 없다', () => nextInt(createRandom('boundary'), 0, 0), /빈 범위/),
    expectState('빈 배열 셔플은 빈 배열이다', [], shuffle(createRandom('boundary'), [])[1]),
    expectDeterministic(
      '빈 실행을 반복해도 결과가 하나다',
      () => runToyWorld('empty', 0, 0).stateHash,
      10,
    ),
  ],
});

export const v1Scenarios = [v1SameSeed100, v1SeedDriftDetected, v1Boundary] as const;
