import { sha256Tagged } from '@hkt/v0-module-contract';
import type { ModuleContext, ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import { TickClock } from './clock.js';
import { IdFactory } from './id.js';
import { Rng } from './rng.js';
import { deriveSeed, seedLabel, type SeedComponents } from './seed.js';

/** 시드 구성요소 — JSON 으로 오갈 수 있게 worldSeed 만 문자열로 받는다. */
export interface V2Input {
  /** 10진 문자열. JSON 에 bigint 를 직접 담을 수 없어서 문자열로 받는다. */
  worldSeed: string;
  components?: Omit<SeedComponents, 'worldSeed'>;
  /** 뽑을 난수 개수 */
  draws: number;
  /** 발급할 id 종류 (종류마다 하나씩) */
  idKinds?: string[];
  /** 진행할 틱 수 */
  ticks?: number;
  /** 열어 볼 하위 스트림 이름표 */
  forks?: string[];
  /** 틱당 밀리초 (기본 100 = 10Hz) */
  msPerTick?: number;
}

export interface V2Output {
  /** 파생된 64비트 시드 (16진수) */
  seed: string;
  /** 조합 규칙의 정규 표기 — 무엇으로부터 이 시드가 나왔는지 */
  seedLabel: string;
  floats: number[];
  ints: number[];
  ids: string[];
  forkSamples: { label: string; seed: string; firstFloat: number }[];
  timeline: { tick: number; timeMs: number }[];
  /** 위 전체의 해시 — 100회 재실행에서 이 값이 하나여야 한다 */
  digest: string;
}

export const V2_VERSION = '0.1.0';

export const V2_PURPOSE =
  '시간·ID·무작위성을 결정적 자원으로 제공해, 같은 시드와 같은 입력이면 언제나 같은 난수열·같은 ID·같은 틱 진행이 나오게 한다.';

/** 원문 29장의 조합 규칙으로 시드를 파생하고, 세 자원(난수·ID·시계)을 한 번에 굴린다. */
export function executeV2(input: V2Input): V2Output {
  const components: SeedComponents = {
    worldSeed: BigInt(input.worldSeed),
    ...(input.components ?? {}),
  };
  const seed = deriveSeed(components);

  const rng = new Rng(seed);
  const floats: number[] = [];
  const ints: number[] = [];
  for (let draw = 0; draw < input.draws; draw += 1) {
    floats.push(rng.nextFloat());
    ints.push(rng.nextInt(0, 100));
  }

  const idFactory = new IdFactory(seed);
  const ids = (input.idKinds ?? []).map((kind) => idFactory.next(kind));

  const forkSamples = (input.forks ?? []).map((label) => {
    const child = rng.fork(label);
    return { label, seed: child.seed.toString(16), firstFloat: child.nextFloat() };
  });

  const clock = new TickClock(
    input.msPerTick === undefined ? {} : { msPerTick: input.msPerTick },
  );
  const timeline = clock.timeline(input.ticks ?? 0);

  const body = { seed: seed.toString(16), floats, ints, ids, forkSamples, timeline };
  return {
    ...body,
    seedLabel: seedLabel(components),
    digest: sha256Tagged(JSON.stringify(body)),
  };
}

export function createV2Module(
  scenarios: ModuleDefinition<V2Input, V2Output>['scenarios'],
): ModuleDefinition<V2Input, V2Output> {
  return {
    id: 'V2',
    version: V2_VERSION,
    purpose: V2_PURPOSE,
    dependencies: ['V0'],
    validateInput,
    execute: (input: V2Input, _context: ModuleContext) => executeV2(input),
    validateOutput,
    scenarios,
  };
}

/**
 * 입력 검증.
 *
 * V1(schema)로 대신할 수 있지만 원문 「8」이 V2 의 선행을 V0 하나로 규정하므로, 선언에 없는 의존을
 * 만들지 않는다. 대신 `schemas/` 에 같은 계약을 JSON Schema 로 두고, 저장소 규약 검사가 그 스키마를
 * V1 로 컴파일해 형식을 강제한다.
 */
export function validateInput(input: unknown): V2Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('V2 입력은 객체여야 한다.');
  }
  const value = input as Record<string, unknown>;

  if (typeof value['worldSeed'] !== 'string' || !/^-?\d+$/.test(value['worldSeed'])) {
    throw new TypeError('`worldSeed` 는 10진 정수 문자열이어야 한다.');
  }
  if (
    typeof value['draws'] !== 'number' ||
    !Number.isInteger(value['draws']) ||
    value['draws'] < 0 ||
    value['draws'] > 100_000
  ) {
    throw new TypeError('`draws` 는 0~100000 의 정수여야 한다.');
  }

  const components = value['components'];
  if (components !== undefined) {
    if (components === null || typeof components !== 'object' || Array.isArray(components)) {
      throw new TypeError('`components` 는 객체여야 한다.');
    }
    const record = components as Record<string, unknown>;
    for (const key of ['tick', 'decisionCounter'] as const) {
      const item = record[key];
      if (item !== undefined && (!Number.isInteger(item) || (item as number) < 0)) {
        throw new TypeError(`\`components.${key}\` 는 0 이상의 정수여야 한다.`);
      }
    }
    for (const key of ['subjectId', 'situationId'] as const) {
      if (record[key] !== undefined && typeof record[key] !== 'string') {
        throw new TypeError(`\`components.${key}\` 는 문자열이어야 한다.`);
      }
    }
    for (const key of Object.keys(record)) {
      if (!['tick', 'subjectId', 'decisionCounter', 'situationId'].includes(key)) {
        throw new TypeError(`\`components\` 에 모르는 항목이 있다: ${key}`);
      }
    }
  }

  for (const key of ['idKinds', 'forks'] as const) {
    const list = value[key];
    if (list === undefined) continue;
    if (!Array.isArray(list) || !list.every((item) => typeof item === 'string' && item !== '')) {
      throw new TypeError(`\`${key}\` 는 비어 있지 않은 문자열 배열이어야 한다.`);
    }
  }

  const ticks = value['ticks'];
  if (ticks !== undefined && (!Number.isInteger(ticks) || (ticks as number) < 0)) {
    throw new TypeError('`ticks` 는 0 이상의 정수여야 한다.');
  }
  const msPerTick = value['msPerTick'];
  if (msPerTick !== undefined && (typeof msPerTick !== 'number' || msPerTick <= 0)) {
    throw new TypeError('`msPerTick` 은 0 보다 큰 수여야 한다.');
  }

  return input as V2Input;
}

/** MODULE.yaml 의 invariants 중 출력만 보고 판정할 수 있는 것들. */
export function validateOutput(output: V2Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `V2 출력/${path}`, message });
  };

  output.floats.forEach((value, index) => {
    if (!(value >= 0 && value < 1)) {
      at(`floats/${index}`, 'E_INVARIANT_float_must_be_unit_interval', `[0,1) 밖이다: ${value}`);
    }
  });
  output.ints.forEach((value, index) => {
    if (!Number.isInteger(value) || value < 0 || value >= 100) {
      at(`ints/${index}`, 'E_INVARIANT_int_must_be_in_range', `[0,100) 밖이다: ${value}`);
    }
  });

  const unique = new Set(output.ids);
  if (unique.size !== output.ids.length) {
    at('ids', 'E_INVARIANT_id_must_be_unique_within_run', `중복 id 가 있다: ${output.ids.join(', ')}`);
  }

  for (let index = 1; index < output.timeline.length; index += 1) {
    const previous = output.timeline[index - 1] as { tick: number; timeMs: number };
    const current = output.timeline[index] as { tick: number; timeMs: number };
    if (current.tick <= previous.tick || current.timeMs <= previous.timeMs) {
      at(
        `timeline/${index}`,
        'E_INVARIANT_clock_must_advance_monotonically',
        `틱과 시각은 단조 증가해야 한다: ${previous.tick}→${current.tick}`,
      );
    }
  }

  // 이름표가 다르면 시드도 달라야 한다. 같은 이름표가 두 번 오는 것은 정상이며 같은 시드가 맞다.
  const labels = new Set(output.forkSamples.map((sample) => sample.label));
  const seeds = new Set(output.forkSamples.map((sample) => sample.seed));
  if (labels.size !== seeds.size) {
    at(
      'forkSamples',
      'E_INVARIANT_forked_stream_must_be_distinct',
      `이름표 ${labels.size}종에 시드가 ${seeds.size}종이다 — 서로 다른 이름표가 같은 스트림을 가리킨다.`,
    );
  }

  const recomputed = sha256Tagged(
    JSON.stringify({
      seed: output.seed,
      floats: output.floats,
      ints: output.ints,
      ids: output.ids,
      forkSamples: output.forkSamples,
      timeline: output.timeline,
    }),
  );
  if (recomputed !== output.digest) {
    at('digest', 'E_INVARIANT_digest_must_match_body', `저장 ${output.digest} / 재계산 ${recomputed}`);
  }

  return issues;
}
