import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { runScenario, sha256Tagged } from '@hkt/v0-module-contract';
import { IdFactory } from '../../src/id.js';
import { Rng } from '../../src/rng.js';
import { TickClock } from '../../src/clock.js';
import { deriveSeed } from '../../src/seed.js';
import { createV2Module, executeV2 } from '../../src/module.js';
import { v2Scenarios } from '../../scenarios/index.js';

const MODULE_DIR = fileURLToPath(new URL('../..', import.meta.url));

describe('계약과 구현의 정합', () => {
  const contract = parseYaml(readFileSync(join(MODULE_DIR, 'MODULE.yaml'), 'utf8')) as {
    id: string;
    depends_on: string[];
    scenarios: string[];
  };

  it('MODULE.yaml 의 scenarios 목록이 구현과 같다', () => {
    expect(contract.scenarios).toEqual(v2Scenarios.map((scenario) => scenario.id));
  });

  it('선행은 V0 하나다 (원문 「8」)', () => {
    expect(contract.depends_on).toEqual(['V0']);
    expect(createV2Module(v2Scenarios).dependencies).toEqual(['V0']);
  });
});

describe('시나리오 전량 실행', () => {
  it.each(v2Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s 통과',
    (_id, scenario) => {
      const run = runScenario(scenario, 'V2');
      const failed = run.assertions.filter((assertion) => !assertion.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);

      // 원문 「24」의 구획이 모두 채워진다
      expect(run.view.purpose).not.toBe('');
      expect(run.view.input.length).toBeGreaterThan(0);
      expect(run.view.candidates.length).toBeGreaterThan(0);
      expect(run.view.result).not.toBe('');
      expect(run.view.reasons.length).toBeGreaterThan(0);
      expect(run.view.before).not.toBe('');
      expect(run.view.after).not.toBe('');
      expect(run.view.checks.length).toBe(run.assertions.length);
    },
  );
});

/**
 * V2 가 실제로 쓰일 모습 — 원문 29장의 시뮬레이션 루프를 축소한 것이다.
 * 주체 여럿이 여러 틱 동안 결정을 내리고, 그 전 과정을 두 번 돌려 사건 로그가 같은지 본다.
 */
describe('축소 시뮬레이션 리플레이', () => {
  const WORLD_SEED = 20260730n;
  const SUBJECTS = ['npc_hunter', 'npc_trader', 'npc_guard'];

  interface Event {
    id: string;
    tick: number;
    subjectId: string;
    action: string;
    roll: number;
  }

  function simulate(
    options: { extraStream?: boolean; extraIdKind?: boolean; worldSeed?: bigint } = {},
  ): Event[] {
    const worldSeed = options.worldSeed ?? WORLD_SEED;
    const clock = new TickClock({ msPerTick: 100 });
    const ids = new IdFactory(deriveSeed({ worldSeed }));
    const log: Event[] = [];

    for (let step = 0; step < 10; step += 1) {
      for (const [index, subjectId] of SUBJECTS.entries()) {
        const rng = Rng.fromComponents({
          worldSeed,
          tick: clock.tick,
          subjectId,
          decisionCounter: index,
          situationId: 'sit_market',
        });

        // 나중에 추가되는 소비자 — 기존 결정을 흔들면 안 된다
        if (options.extraStream) {
          const perception = rng.fork('perception');
          for (let draw = 0; draw < 3; draw += 1) perception.nextFloat();
        }
        if (options.extraIdKind) ids.next('perception_record');

        const action = rng.weighted([
          { value: 'trade', weight: 3 },
          { value: 'move', weight: 5 },
          { value: 'rest', weight: 2 },
        ]);
        log.push({
          id: ids.next('event'),
          tick: clock.tick,
          subjectId,
          action,
          roll: rng.nextInt(0, 20),
        });
      }
      clock.advance(1);
    }
    return log;
  }

  it('같은 세계 시드로 100회 재생하면 사건 로그가 같다 (GI-12)', () => {
    const digests = new Set(
      Array.from({ length: 100 }, () => sha256Tagged(JSON.stringify(simulate()))),
    );
    expect(digests.size).toBe(1);
  });

  it('주체·틱마다 서로 다른 시드를 받는다', () => {
    const seeds = new Set<string>();
    for (let tick = 0; tick < 10; tick += 1) {
      for (const [index, subjectId] of SUBJECTS.entries()) {
        seeds.add(
          deriveSeed({
            worldSeed: WORLD_SEED,
            tick,
            subjectId,
            decisionCounter: index,
            situationId: 'sit_market',
          }).toString(16),
        );
      }
    }
    expect(seeds.size).toBe(30);
  });

  it('세계 시드가 다르면 다른 역사가 나온다', () => {
    const baseline = simulate();
    const otherWorld = simulate({ worldSeed: WORLD_SEED + 1n });

    // 사건 하나하나는 우연히 같을 수 있으므로 로그 전체로 비교한다
    expect(sha256Tagged(JSON.stringify(otherWorld))).not.toBe(
      sha256Tagged(JSON.stringify(baseline)),
    );
    // 행동 선택도 어딘가에서는 갈라져야 한다
    expect(otherWorld.map((event) => event.action)).not.toEqual(
      baseline.map((event) => event.action),
    );
  });

  it('소비자를 새로 추가해도 기존 사건이 바뀌지 않는다', () => {
    const baseline = simulate();
    const withExtraStream = simulate({ extraStream: true });
    expect(withExtraStream.map((event) => ({ ...event, id: '' }))).toEqual(
      baseline.map((event) => ({ ...event, id: '' })),
    );
  });

  it('새 종류의 id 를 발급해도 기존 사건 id 가 밀리지 않는다', () => {
    const baseline = simulate();
    const withExtraKind = simulate({ extraIdKind: true });
    expect(withExtraKind.map((event) => event.id)).toEqual(baseline.map((event) => event.id));
  });

  it('사건 id 는 로그 전체에서 유일하다', () => {
    const log = simulate();
    expect(new Set(log.map((event) => event.id)).size).toBe(log.length);
  });

  it('틱은 되감기지 않는다', () => {
    const log = simulate();
    for (let index = 1; index < log.length; index += 1) {
      expect((log[index] as Event).tick).toBeGreaterThanOrEqual((log[index - 1] as Event).tick);
    }
  });
});

describe('모듈 출력의 리플레이', () => {
  it('같은 입력 100회 실행에서 digest 가 하나다 (원문 V2 대표 검증)', () => {
    const input = {
      worldSeed: '20260730',
      components: { tick: 7, subjectId: 'npc_1', decisionCounter: 1, situationId: 'sit_1' },
      draws: 32,
      idKinds: ['event', 'entity'],
      ticks: 8,
      forks: ['perception', 'deliberation'],
    };
    const digests = new Set(Array.from({ length: 100 }, () => executeV2(input).digest));
    expect(digests.size).toBe(1);
  });
});

describe('수직 통합 슬라이스', () => {
  // VS0 은 K0~K3 을 포함한다 (원문 「20」 VS0).
  it.todo('VS0 결정적 세계 변화 — K0~K3 등록 후 실행');
});
