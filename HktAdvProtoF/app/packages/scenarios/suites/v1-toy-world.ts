// V1 검증용 장난감 세계 — V1 원시요소만으로 굴러가는 최소 실행.
//
// 이 파일이 core/src 가 아니라 scenarios 패키지에 있는 이유: V1 의 계약 산출물은
// TickClock·SeededRandom·DeterministicId·stableSort·stateHash 다섯뿐이다 (MODULES.md V1 행).
// 장난감 세계는 그 다섯이 실제로 결정성을 만들어내는지 보이기 위한 검증 도구이지
// 세계 모델이 아니다 — 진짜 세계 상태는 O2 에서 정의된다.

import {
  advance,
  compareBy,
  compareChain,
  compareStrings,
  createClock,
  createRandom,
  deterministicId,
  nextInt,
  pick,
  split,
  stableSort,
  stateHash,
  type Id,
  type Seed,
  type StateHash,
  type Tick,
} from '@hkt/core/v1';

/** 장난감 세계의 사건 — 누가, 몇 틱에, 무엇을, 얼마나. */
export interface ToyEvent {
  readonly tick: Tick;
  readonly subjectId: Id;
  readonly action: string;
  readonly amount: number;
}

/** 장난감 세계의 상태 — 주체별 재고. */
export interface ToyWorld {
  readonly tick: Tick;
  readonly stock: Record<Id, number>;
}

/** 한 번의 실행 결과. */
export interface ToyRun {
  readonly world: ToyWorld;
  readonly events: readonly ToyEvent[];
  readonly stateHash: StateHash;
  readonly eventHash: StateHash;
}

const ACTIONS = ['forage', 'rest', 'trade', 'flee'] as const;

/** 시드에서 주체 ID 를 만든다 — 이름이 같으면 실행마다 같은 ID. */
function toySubjects(count: number): Id[] {
  return Array.from({ length: count }, (_, index) =>
    deterministicId('toy-subject', 'v1-toy-world', index),
  );
}

/**
 * 장난감 세계를 ticks 만큼 굴린다.
 * 주체마다 난수 스트림을 split 으로 나누므로, 주체 처리 순서가 서로의 난수에 영향을 주지 않는다.
 */
export function runToyWorld(seed: Seed, ticks = 20, subjectCount = 3): ToyRun {
  const subjects = toySubjects(subjectCount);
  const root = createRandom(seed);
  const stock: Record<Id, number> = {};
  for (const id of subjects) stock[id] = 10;

  const events: ToyEvent[] = [];
  let clock = createClock(0);

  for (let step = 0; step < ticks; step += 1) {
    clock = advance(clock);
    // 이 틱에서 각 주체가 무엇을 얼마나 했는지 — 주체별 독립 스트림.
    for (const subjectId of subjects) {
      const stream = split(root, `${subjectId}@${String(clock.tick)}`);
      const [afterAction, action] = pick(stream, ACTIONS);
      const [, amount] = nextInt(afterAction, -3, 4);
      events.push({ tick: clock.tick, subjectId, action, amount });
      stock[subjectId] = (stock[subjectId] ?? 0) + amount;
    }
  }

  // 사건 순서는 (틱, 주체 ID, 행동) 로 안정 정렬해 고정한다.
  const ordered = stableSort(
    events,
    compareChain<ToyEvent>(
      compareBy((event) => event.tick),
      compareBy((event) => event.subjectId),
      (a, b) => compareStrings(a.action, b.action),
    ),
  );

  const world: ToyWorld = { tick: clock.tick, stock };
  return {
    world,
    events: ordered,
    stateHash: stateHash(world),
    eventHash: stateHash(ordered),
  };
}

/** 두 실행에서 사건이 최초로 갈라진 지점 — 없으면 null. (V2 "최초 분기 상태 경로" 의 선행 형태) */
export function firstDivergence(
  left: ToyRun,
  right: ToyRun,
): { readonly index: number; readonly left: ToyEvent | null; readonly right: ToyEvent | null } | null {
  const length = Math.max(left.events.length, right.events.length);
  for (let index = 0; index < length; index += 1) {
    const a = left.events[index] ?? null;
    const b = right.events[index] ?? null;
    if (stateHash(a) !== stateHash(b)) {
      return { index, left: a, right: b };
    }
  }
  return null;
}
