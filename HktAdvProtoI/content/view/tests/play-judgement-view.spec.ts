// Play 실주행 판정 반영 — 화면 쪽 (RoomBecomesLand Q6 · RuleBoundRoom · RoomAnswersWhenAsked · RoomNeverSame).
//
//   ① 나아가지 못하는 몸이 왜 서 있는지 한 번 말한다 (movement-reading) · 걸음의 앞 거리가 빠르기를 따른다
//   ② 시점의 상하가 25°~45° 에 묶인다
//   ③ 규칙을 품은 방이 자기 규칙을 말한다 — 들어설 때 · 판의 줄 · 임박한 재배열 · 닫힌 길의 이름 · 잠긴 문의 힌트
//   ④ 지금 걸린 위상의 자락이 땅에 선다 · 때가 바뀐 순간 한 마디

import { describe, expect, it } from 'vitest';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { TILT_MAX, TILT_MIN, clampTilt } from '../../../engine/view-kernel/camera/orientation';
import { descriptionHash } from '../../../engine/world-authoring/description';
import type { EntityView, GameViewSnapshot, RegionStateView } from '../../protocol/gameview';
import { FANTASY_MAZE, FOREST_EDGE, MAZE_HEART_GATE, regionSpec } from '../../regions/index';
import { codeText } from '../code-text';
import {
  KEY_LOOKAHEAD_MIN,
  STALL_SECONDS,
  blockingBodies,
  createStallWatch,
  keyLookahead,
  stallNotice,
  watchStall,
} from '../movement-reading';
import { clockChangeNotice, phaseZones } from '../phase-presentation';
import {
  PRESSURE_WARNING_RATIO,
  closedPassageNames,
  passageName,
  regionNotice,
  regionRuleHint,
} from '../region-presentation';
import { resolvePresentation } from '../resolve';

type Scene = SceneState & { targetFrame?: { rows: { id: string; label: string; value: string }[] } };

const DEGREE = Math.PI / 180;

function snapshotOf(
  region: string,
  self: { x: number; z: number },
  extra: Partial<GameViewSnapshot> & { state?: RegionStateView; entities?: EntityView[] } = {},
): GameViewSnapshot {
  const { state, entities = [], ...rest } = extra;
  return {
    specId: 'VIEW-BASIC-COMBAT-POLICY-001',
    scene: region,
    region: {
      id: region,
      hash: descriptionHash(regionSpec(region)!.space),
      disturbance: { value: 0, threshold: 300, phase: 'dormant' }, memory: { turns: 0, awakenings: { times: 0 }, passages: [], births: [] },
      ...(state ? { state } : {}),
    },
    standingConditions: [],
    tracks: [],
    presences: [],
    clock: { dayPhase: 'DAY', season: 'STILL', dayIndex: 0, seasonCycle: 0 },
    observer: { id: 'observer-a', characterId: 'player', acknowledgedMark: 0 },
    entities: [
      {
        id: 'player',
        role: 'player-character',
        state: 'move',
        kind: 'rabbit-swordsman',
        position: self,
        body: { radius: 0.85, height: 3.4, mass: 1, facing: { x: 1, z: 0 }, velocity: { x: 0, z: 0 } },
        attributes: {
          energy: 10,
          energyMaximum: 10,
          moveMode: 'walk',
          control: 'player',
          tempoStats: { moveSpeed: 6, runSpeedMultiplier: 1.8, actionSpeed: 1 },
          modifiers: { energyCharge: 1, energyConsume: 1, moveSpeed: 1, actionSpeed: 1 },
        },
      } as EntityView,
      ...entities,
    ],
    interactions: [{ id: 'move', role: 'move-to', available: true }],
    hud: [
      { id: 'region.depth', kind: 'label', value: regionSpec(region)!.depth },
      { id: 'world.time', kind: 'counter', value: 100 },
    ],
    strikes: [],
    debug: { open: false },
    commands: [],
    ...rest,
  } as GameViewSnapshot;
}

const wanderer = (x: number, z: number): EntityView =>
  ({
    id: 'npc-1',
    role: 'npc-character',
    state: 'idle',
    kind: 'wanderer',
    name: 'Wanderer 1',
    position: { x, z },
    body: { radius: 0.7, height: 2.8, mass: 1, facing: { x: 1, z: 0 }, velocity: { x: 0, z: 0 } },
  }) as EntityView;

describe('① 나아가지 못하는 몸 (RoomBecomesLand Q6)', () => {
  it('닿아 있는 몸의 이름을 읽는다 — 떨어진 몸은 세지 않는다', () => {
    expect(blockingBodies(snapshotOf(FOREST_EDGE, { x: 0, z: 0 }, { entities: [wanderer(1.5, 0)] }))).toEqual(['Wanderer 1']);
    expect(blockingBodies(snapshotOf(FOREST_EDGE, { x: 0, z: 0 }, { entities: [wanderer(6, 0)] }))).toEqual([]);
  });

  it('걸으려는데 제자리면 STALL_SECONDS 뒤 한 번 말하고, 나아가면 다시 잰다', () => {
    const watch = createStallWatch();
    const stuck = snapshotOf(FOREST_EDGE, { x: 0, z: 0 }, { entities: [wanderer(1.5, 0)] });
    const said: string[] = [];
    for (let t = 0; t < STALL_SECONDS * 3; t += 0.1) {
      const text = watchStall(watch, stuck, true, 0.1);
      if (text !== undefined) said.push(text);
    }
    expect(said).toEqual([codeText('move.blocked-by-body', 'Wanderer 1')]);
    // 나아가면 재는 것이 처음부터다 — 다시 막히면 다시 말한다
    expect(watchStall(watch, snapshotOf(FOREST_EDGE, { x: -3, z: 0 }), true, 0.1)).toBeUndefined();
    let again: string | undefined;
    for (let t = 0; t < STALL_SECONDS * 2; t += 0.1) again ??= watchStall(watch, snapshotOf(FOREST_EDGE, { x: -3, z: 0 }), true, 0.1);
    expect(again).toBe(codeText('move.stalled'));
  });

  it('(경계) 걷지 않으면 아무 말도 없다 — 서 있는 것은 막힌 것이 아니다', () => {
    const watch = createStallWatch();
    const stuck = snapshotOf(FOREST_EDGE, { x: 0, z: 0 }, { entities: [wanderer(1.5, 0)] });
    for (let t = 0; t < STALL_SECONDS * 3; t += 0.1) expect(watchStall(watch, stuck, false, 0.1)).toBeUndefined();
  });

  it('발밑이 막힌 땅이면 그 사유를 말한다 — 숲 가장자리 분지의 급경사', () => {
    // 분지 (10, 0) 반경 10 · 급경사 띠 3.16~8 — (5, 0) 은 그 띠 안이다
    expect(stallNotice(snapshotOf(FOREST_EDGE, { x: 5, z: 0 }))).toBe(codeText('move.stalled-on', codeText('too-steep')));
  });

  it('걸음의 앞 거리는 걷기에서 최소값이고 달리기에서 빠르기를 따른다', () => {
    const walking = snapshotOf(FOREST_EDGE, { x: 0, z: 0 });
    expect(keyLookahead(walking)).toBe(KEY_LOOKAHEAD_MIN);
    const running = snapshotOf(FOREST_EDGE, { x: 0, z: 0 });
    (running.entities[0]!.attributes as { moveMode: string }).moveMode = 'run';
    expect(keyLookahead(running)).toBeCloseTo(6 * 1.8 * 0.25, 5);
    expect(keyLookahead(running)).toBeLessThan(8); // 강 폭 · 미로 통로 폭 아래다
  });
});

describe('② 시점의 상하 (RoomAnswersWhenAsked)', () => {
  it('25° 에서 45° 사이에 묶인다 — 기본 시점(30°)은 그 안이다', () => {
    expect(TILT_MIN).toBeCloseTo(25 * DEGREE, 6);
    expect(TILT_MAX).toBeCloseTo(45 * DEGREE, 6);
    expect(clampTilt(0)).toBe(TILT_MIN);
    expect(clampTilt(Math.PI / 2)).toBe(TILT_MAX);
    expect(clampTilt(Math.PI / 6)).toBeCloseTo(Math.PI / 6, 9);
  });
});

describe('③ 규칙을 품은 방이 자기 규칙을 말한다 (RuleBoundRoom)', () => {
  const maze = (state: RegionStateView) => snapshotOf(FANTASY_MAZE, { x: -30, z: 30 }, { state });
  const rows = (s: GameViewSnapshot) => (resolvePresentation(s) as Scene).targetFrame!.rows;

  it('미로에는 규칙의 한 줄이 있고 규칙 없는 방에는 없다', () => {
    expect(regionRuleHint(FANTASY_MAZE)).toBeDefined();
    expect(regionRuleHint(FOREST_EDGE)).toBeUndefined();
    const ruleRow = rows(maze({ pattern: 'DEFAULT', pressure: 10, pressureLimit: 120 })).find((r) => r.id === 'place.rule');
    expect(ruleRow?.value).toBe(regionRuleHint(FANTASY_MAZE));
    expect(rows(snapshotOf(FOREST_EDGE, { x: 0, z: 0 })).some((r) => r.id === 'place.rule')).toBe(false);
  });

  it('압력이 임계의 3/4 을 넘으면 "곧 바뀐다" 를, 재배열 직후에는 닫힌 길의 이름을 말한다', () => {
    expect(regionNotice(maze({ pattern: 'DEFAULT', pressure: 10, pressureLimit: 120 }))).toBeUndefined();
    expect(regionNotice(maze({ pattern: 'DEFAULT', pressure: 120 * PRESSURE_WARNING_RATIO, pressureLimit: 120 }))).toBe(
      codeText('maze-pressure-high'),
    );
    const justNow = maze({ pattern: 'P1', pressure: 0, pressureLimit: 120, rearrangedAt: 99 });
    expect(regionNotice(justNow)).toBe(codeText('maze-rearranged.closed', closedPassageNames(justNow).join(' · ')));
    expect(closedPassageNames(justNow)).toEqual([passageName('AB'), passageName('CD')]);
  });

  it('판의 통로 줄에 통로의 이름이 선다', () => {
    // (0, 20) 은 북쪽 복도(AB) 안이다
    const inCorridor = snapshotOf(FANTASY_MAZE, { x: 0, z: 20 }, { state: { pattern: 'DEFAULT', pressure: 0, pressureLimit: 120 } });
    const passage = rows(inCorridor).find((r) => r.id === 'place.passage');
    expect(passage?.value).toContain(passageName('AB'));
    expect(passage?.value).toContain(codeText('place.passage.open'));
  });

  it('잠긴 심장 문을 지목하면 힌트 줄이 서고, 열린 문에는 없다', () => {
    const gate = (state: 'open' | 'locked'): EntityView =>
      ({ id: MAZE_HEART_GATE, role: 'region-exit', state, kind: 'door', position: { x: 30, z: 30 } }) as EntityView;
    const seeGate = (state: 'open' | 'locked') =>
      (resolvePresentation(snapshotOf(FANTASY_MAZE, { x: 28, z: 30 }, { entities: [gate(state)] }), undefined, {
        designation: { entityId: MAZE_HEART_GATE },
      }) as Scene).targetFrame!.rows;
    expect(seeGate('locked').some((r) => r.id === 'being.hint')).toBe(true);
    expect(seeGate('open').some((r) => r.id === 'being.hint')).toBe(false);
  });
});

describe('④ 위상의 자락이 땅에 선다 · 때가 바뀐 순간 (RoomNeverSame)', () => {
  it('숲 가장자리의 안쪽 출구 자락은 스밈에만 붉은 띠와 깊이의 색으로 선다', () => {
    const still = phaseZones(snapshotOf(FOREST_EDGE, { x: 0, z: 0 }));
    expect(still).toEqual([]);
    const seep = phaseZones(
      snapshotOf(FOREST_EDGE, { x: 0, z: 0 }, { clock: { dayPhase: 'DAY', season: 'SEEP', dayIndex: 3, seasonCycle: 0 } }),
    );
    expect(seep.map((z) => z.id)).toEqual([
      `phase-depth:${FOREST_EDGE}:depth-edge-deep-trail`,
      `phase-hazard:${FOREST_EDGE}:hazard-edge-deep-trail`,
    ]);
    // 장면에도 그 구역들이 실린다
    const scene = resolvePresentation(
      snapshotOf(FOREST_EDGE, { x: 0, z: 0 }, { clock: { dayPhase: 'DAY', season: 'SEEP', dayIndex: 3, seasonCycle: 0 } }),
    );
    expect(scene.zones.some((z) => z.id.startsWith('phase-hazard:'))).toBe(true);
  });

  it('깨어난 방의 자락도 선다 — 생체 광석 지대', () => {
    const awake = snapshotOf('BIO_ORE_FIELD', { x: 0, z: 0 });
    awake.region.disturbance = { value: 300, threshold: 300, phase: 'awake' };
    expect(phaseZones(awake).map((z) => z.id)).toContain('phase-hazard:BIO_ORE_FIELD:hazard-ore-outcrop');
  });

  it('철이 바뀌면 그 철의 이름으로, 낮밤이 바뀌면 그 말로 한 번 말한다', () => {
    const still = { dayPhase: 'DAY', season: 'STILL', dayIndex: 0, seasonCycle: 0 } as const;
    expect(clockChangeNotice(undefined, still)).toBeUndefined();
    expect(clockChangeNotice(still, still)).toBeUndefined();
    expect(clockChangeNotice(still, { ...still, dayPhase: 'NIGHT' })).toBe(codeText('clock.turned.night'));
    expect(clockChangeNotice(still, { ...still, season: 'SEEP' })).toBe(
      codeText('clock.turned.season', codeText('clock.season.seep')),
    );
  });
});
