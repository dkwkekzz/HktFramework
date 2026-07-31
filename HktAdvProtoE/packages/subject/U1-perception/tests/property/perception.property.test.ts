import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { StoreOperation } from '@hkt/k0-entity-state';
import { NATURAL_LAWS } from '@hkt/s1-natural-state';
import { SUBJECT_LAWS } from '@hkt/u0-subject-core';
import {
  executeU1,
  validateOutput,
  MISS,
  U1_CHANNELS,
  type U1Input,
} from '../../src/index.js';
import {
  COMPONENT_DEFINITIONS,
  SCENE_RULES,
  WIDE_LAYOUT,
  WORLD_SEED,
  body,
  person,
  FULL_SENSES,
} from '../../scenarios/fixtures.js';

/** 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다. */
const RUN = { seed: 20260731, numRuns: 100 } as const;

/**
 * 무작위 마을 — 벽이 있기도 없기도, 사람이 가깝기도 멀기도 한 세계.
 *
 * 귀 없는 사람, 몸 없는 주체, 능력 없는 사람, 아무 일도 일어나지 않는 날이 모두 나온다.
 * 그런 세계가 필요하다 — "누군가는 늘 본다"를 가정한 필터는 아무도 없는 날에 조용히 틀린다.
 */
const villageArb = fc
  .record({
    wall: fc.boolean(),
    wallX: fc.integer({ min: 6, max: 14 }),
    watcherX: fc.integer({ min: 1, max: 40 }),
    hermitX: fc.integer({ min: 1, max: 60 }),
    audioThreshold: fc.integer({ min: 0, max: 12 }).map((value) => value / 2),
    deaf: fc.boolean(),
    attuned: fc.boolean(),
    bodiless: fc.boolean(),
    ring: fc.boolean(),
    blast: fc.boolean(),
    natural: fc.boolean(),
    subjectLaws: fc.boolean(),
    ticks: fc.integer({ min: 0, max: 4 }),
  })
  .map((village): U1Input => {
    const watcherSenses = village.deaf
      ? Object.fromEntries(Object.entries(FULL_SENSES).filter(([channel]) => channel !== 'audio'))
      : FULL_SENSES;
    const operations: StoreOperation[] = [
      {
        op: 'spawn',
        id: 'chapel_bell',
        kind: 'fixture',
        tags: ['bell'],
        components: { position: { x: 5, y: 3, z: 0 }, wear: { tolls: 0 } },
      },
      {
        op: 'spawn',
        id: 'powder_keg',
        kind: 'fixture',
        tags: ['powder'],
        components: { position: { x: 5, y: 3, z: 0 }, mass: { kg: 5 } },
      },
      body('watcher_body', { x: village.watcherX, y: 3 }),
      body('hermit_body', { x: village.hermitX, y: 3 }),
      person({ id: 'watcher', bodies: ['watcher_body'], senses: watcherSenses }),
      person({
        id: 'hermit',
        bodies: village.bodiless ? [] : ['hermit_body'],
        senses: { ...FULL_SENSES, audio: village.audioThreshold },
        ...(village.attuned ? { capabilities: ['sense_aura'] } : {}),
      }),
    ];
    if (village.wall) {
      operations.push({
        op: 'spawn',
        id: 'stone_wall',
        kind: 'structure',
        tags: ['wall'],
        components: {
          position: { x: village.wallX, y: 3, z: 0 },
          extent: { x: 0.5, y: 4, z: 2 },
          barrier: { solid: true, opaque: true },
        },
      });
    }

    const script: NonNullable<U1Input['script']> = [];
    if (village.ring) script.push({ tick: 1, intent: { id: 't1_toll', actor: 'chapel_bell', verb: 'toll' } });
    if (village.blast) {
      script.push({ tick: 1, intent: { id: 't1_blast', actor: 'powder_keg', verb: 'detonate' } });
    }

    return {
      world: { components: COMPONENT_DEFINITIONS, operations },
      layout: WIDE_LAYOUT,
      worldSeed: WORLD_SEED,
      ticks: village.ticks,
      script,
      rules: SCENE_RULES,
      ...(village.natural ? { naturalLaws: NATURAL_LAWS } : {}),
      ...(village.subjectLaws ? { subjectLaws: SUBJECT_LAWS } : {}),
    };
  });

describe('속성: 지각', () => {
  it('어떤 마을에서도 출력 불변조건이 깨지지 않는다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        expect(validateOutput(executeU1(input))).toEqual([]);
      }),
      RUN,
    );
  });

  it('지각은 세계를 바꾸지 않는다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        const output = executeU1(input);
        expect(output.storeHash).toBe(output.storeHashAfterPerceiving);
        expect(output.audit.everyChangeHasAnEvent).toBe(true);
      }),
      RUN,
    );
  });

  it('같은 세계는 같은 지각을 만든다 (GI-12)', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        expect(executeU1(input).digest).toBe(executeU1(input).digest);
        expect(executeU1(input).resimulatedLogHash).toBe(executeU1(input).logHash);
      }),
      RUN,
    );
  });

  it('세계에 없는 현상은 아무도 지각하지 않는다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        const output = executeU1(input);
        const known = new Set(output.phenomena.map((entry) => entry.id));
        for (const entry of output.perceived) expect(known.has(entry.phenomenonId)).toBe(true);
      }),
      RUN,
    );
  });

  it('닿은 것은 모두 문턱을 넘었고, 못 닿은 것은 모두 이유를 든다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        const output = executeU1(input);
        for (const entry of output.perceived) {
          expect(entry.strength).toBeGreaterThanOrEqual(entry.threshold);
          expect(U1_CHANNELS).toContain(entry.channel);
        }
        for (const miss of output.misses) expect(miss.message).not.toBe('');
      }),
      RUN,
    );
  });

  it('막는 것을 지나온 시각 지각은 하나도 없다 — 시선은 끊긴다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        for (const entry of executeU1(input).perceived) {
          if (entry.channel === 'visual') expect(entry.dampedBy).toEqual([]);
        }
      }),
      RUN,
    );
  });

  it('의념은 능력을 가진 주체에게만 닿는다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        const output = executeU1(input);
        const attuned = new Set(
          output.perceived.filter((entry) => entry.channel === 'aura').map((entry) => entry.perceiverId),
        );
        for (const subject of attuned) {
          expect(
            output.misses.some(
              (miss) => miss.perceiverId === subject && miss.code === MISS.NO_CAPABILITY,
            ),
            `${subject} 가 능력 없이 의념을 느꼈다`,
          ).toBe(false);
        }
      }),
      RUN,
    );
  });

  it('벽 너머의 것을 눈으로 본 사람은 없다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        const output = executeU1(input);
        for (const entry of output.perceived) {
          if (entry.channel !== 'visual') continue;
          // 시각이 닿았다면 그 짝이 되는 E_SIGHT_BLOCKED 는 있을 수 없다.
          const contradiction = output.misses.some(
            (miss) =>
              miss.perceiverId === entry.perceiverId &&
              miss.phenomenonId === entry.phenomenonId &&
              miss.channel === 'visual' &&
              miss.code === MISS.SIGHT_BLOCKED,
          );
          expect(contradiction).toBe(false);
        }
      }),
      RUN,
    );
  });

  it('전언이 없으면 보고도 소문도 하나도 없다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        for (const entry of executeU1(input).perceived) {
          expect(entry.via).toBeNull();
          expect(['report', 'rumor']).not.toContain(entry.channel);
        }
      }),
      RUN,
    );
  });

  it('몸이 없는 주체는 공간으로 아무것도 얻지 못한다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        const output = executeU1(input);
        const hermit = output.reports.find((report) => report.subjectId === 'hermit');
        const bodiless = (input.world.operations as StoreOperation[]).some(
          (operation) =>
            operation.op === 'spawn' &&
            operation.id === 'hermit' &&
            JSON.stringify(operation.components?.['body']) === JSON.stringify({ entity_ids: [] }),
        );
        if (!bodiless) return;
        expect(hermit?.known ?? []).toEqual([]);
      }),
      RUN,
    );
  });

  it('짧게 굴린 세계는 길게 굴린 세계의 앞부분이다', () => {
    fc.assert(
      fc.property(villageArb, fc.integer({ min: 0, max: 4 }), (input, shorter) => {
        const cut = Math.min(shorter, input.ticks);
        const short = executeU1({ ...input, ticks: cut });
        const long = executeU1(input);
        expect(JSON.stringify(short.series)).toBe(JSON.stringify(long.series.slice(0, cut)));
      }),
      RUN,
    );
  });

  it('사건이 없으면 현상도 없다', () => {
    fc.assert(
      fc.property(villageArb, (input) => {
        const output = executeU1(input);
        if (output.events === 0) expect(output.phenomena).toEqual([]);
        expect(output.phenomena.length + output.gaps.length).toBeLessThanOrEqual(
          output.events - output.silentEvents + output.gaps.length,
        );
      }),
      RUN,
    );
  });
});
