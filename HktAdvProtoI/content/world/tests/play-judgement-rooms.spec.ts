// Play 실주행 판정 반영 — 세계 쪽 (RoomBecomesLand Q6 · Q7 · RoomBearsMaterial · RoomNeverSame).
//
// Human 의 실주행 답 다섯을 코드로 옮긴 것이 세계에서 참인지 잰다.
//   ① 거목의 줄기가 몸을 세운다 — 표식 point 둘레가 막힌 땅이고 사유 코드는 landmark-trunk 다
//   ② 자율 존재의 순회가 시작 자리와 거목을 비켜 간다 — 배치 데이터의 사실
//   ③ 낮밤을 타는 원천 — 밤에만 서고, 낮에는 그 자리에 없으며 사유가 철의 것과 갈린다
//   ④ 흩어진 것들이 숲의 방마다 선다 — 형태 셋이 데이터에서 자리를 얻는다
//   ⑤ 철을 타는 방이 늘었다 — 폐허 · 둥지 · 거목의 자락이 그 철에만 걸린다

import { describe, expect, it } from 'vitest';
import { compileRegion } from '../../../engine/world-authoring/compile';
import { blockedReasonAt, isTraversableAt } from '../../../engine/world-authoring/query';
import { pointsOf } from '../../../engine/world-authoring/description';
import {
  BLOCK_LANDMARK,
  COMPILE_RULES,
  EXPLORER_RUIN,
  FOREST_EDGE,
  FORM_GLOW_CAP,
  FORM_HUSK_SHARD,
  FORM_ORE_PEBBLE,
  LANDMARK_LAYER,
  LANDMARK_TRUNK_RADIUS,
  PREDATOR_NEST,
  RED_EYE_TREE,
  REGION_SPECS,
  RESOURCE_LAYER,
  WHITE_KING_DOMAIN,
  regionSpec,
} from '../../regions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { createWorld } from '../index';
import { NOT_THIS_HOUR } from '../semantic/region-phase';
import { sourcesInRegion } from '../semantic/resource';
import { DAY_SECONDS, NIGHT_SECONDS } from '../semantic/clock';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';

const terrainOf = (id: string) => compileRegion(regionSpec(id)!.space, COMPILE_RULES).world;
const sourceEntity = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const conditionsOf = (v: GameViewSnapshot) => v.standingConditions;

function wait(w: WorldDriver, seconds: number, step = 1): void {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}

describe('① 거목의 줄기가 몸을 세운다 (RoomBecomesLand Q7)', () => {
  it('표식 point 둘레 반경 안은 막힌 땅이고 사유는 landmark-trunk 다 — 그 밖은 그대로다', () => {
    const t = terrainOf(WHITE_KING_DOMAIN);
    const tree = pointsOf(regionSpec(WHITE_KING_DOMAIN)!.space, LANDMARK_LAYER)[0]!.position;
    expect(isTraversableAt(t, tree.x, tree.z)).toBe(false);
    expect(blockedReasonAt(t, tree.x, tree.z)).toBe(BLOCK_LANDMARK);
    // 반경 바로 밖은 걸을 수 있다 — 몸이 놓이는 (0, 0) 도 그대로다
    expect(isTraversableAt(t, tree.x + LANDMARK_TRUNK_RADIUS + 1, tree.z)).toBe(true);
    expect(isTraversableAt(t, 0, 0)).toBe(true);
  });

  it('줄기 안으로 걸으려는 요청은 그 사유로 거절된다 — 문구는 View 의 표가 옮긴다', () => {
    const w = driveWorld({ npcs: [] });
    const tree = pointsOf(regionSpec(WHITE_KING_DOMAIN)!.space, LANDMARK_LAYER)[0]!.position;
    expect(w.dispatch({ interactionId: 'move', position: { x: tree.x, z: tree.z } })).toMatchObject({
      status: 'failure',
      reason: BLOCK_LANDMARK,
    });
    expect(w.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } }).status).toBe('success');
  });

  it('(경계) 표식이 없는 방은 한 값도 달라지지 않는다 — 이 사유가 서는 방은 표식을 가진 방뿐이다', () => {
    for (const spec of REGION_SPECS) {
      const t = terrainOf(spec.id);
      const hasLandmark = pointsOf(spec.space, LANDMARK_LAYER).length > 0;
      // 사유 표(blockedTags)는 규칙 표 그대로 모든 방에 같지만, 그 사유로 **막힌 칸**은 표식이 있는 방에만 있다
      const index = t.blockedTags.indexOf(BLOCK_LANDMARK);
      const blockedByTrunk = [...t.blocked].some((i) => i === index);
      expect({ id: spec.id, seen: blockedByTrunk }).toEqual({
        id: spec.id,
        seen: hasLandmark,
      });
    }
  });
});

describe('② 자율 존재의 순회가 시작 자리와 거목을 비켜 간다 (RoomBecomesLand Q6)', () => {
  it('기본 배치의 자율 존재는 걸을 수 있는 자리만 돌고 그 자리는 시작 자리에서 몸 셋 너머다', () => {
    const w = driveWorld();
    const v = w.observe();
    const t = terrainOf(WHITE_KING_DOMAIN);
    const npcs = v.entities.filter((e) => e.role === 'npc-character');
    expect(npcs.length).toBeGreaterThan(0);
    for (const npc of npcs) {
      expect(isTraversableAt(t, npc.position.x, npc.position.z)).toBe(true);
      expect(Math.hypot(npc.position.x, npc.position.z)).toBeGreaterThan(3);
    }
  });
});

describe('③ 낮밤을 타는 원천 (RoomBearsMaterial · RoomNeverSame Q25)', () => {
  const glow = sourcesInRegion(FOREST_EDGE).find((s) => s.form === FORM_GLOW_CAP)!;
  const besideGlow = { x: glow.position.x + 1, z: glow.position.z };
  const stand = (clock: string) =>
    driveWorld({ npcs: [], actorRegion: FOREST_EDGE, actorPosition: besideGlow, actorItems: { pickaxe: 3 }, clock });

  it('낮에는 그 자리에 없고 밤에는 선다 — 그 원천을 캘 수 있다', () => {
    const day = stand('STILL:DAY');
    expect(sourceEntity(day.observe(), glow.id)).toBeUndefined();
    const night = stand('STILL:NIGHT');
    expect(sourceEntity(night.observe(), glow.id)?.state).toBe('available');
    expect(night.dispatch({ interactionId: 'mine', targetEntityId: glow.id }).status).toBe('success');
  });

  it('낮에 캐려 하면 "지금은 때가 아니다" 로 거절된다 — 철의 사유와 갈린다', () => {
    const day = stand('STILL:DAY');
    expect(day.dispatch({ interactionId: 'mine', targetEntityId: glow.id })).toMatchObject({
      status: 'failure',
      reason: NOT_THIS_HOUR,
    });
  });

  it('해가 지면 그 자리에 서고 해가 뜨면 사라진다 — 세계 시각이 굴린다', () => {
    const w = stand('STILL:DAY');
    expect(sourceEntity(w.observe(), glow.id)).toBeUndefined();
    wait(w, DAY_SECONDS + 1);
    expect(sourceEntity(w.observe(), glow.id)).toBeDefined();
    wait(w, NIGHT_SECONDS);
    expect(sourceEntity(w.observe(), glow.id)).toBeUndefined();
  });

  it('(경계) 낮밤을 밝히지 않은 원천은 낮에도 밤에도 그대로 선다', () => {
    const plain = sourcesInRegion(FOREST_EDGE).find((s) => s.form === FORM_HUSK_SHARD)!;
    for (const clock of ['STILL:DAY', 'STILL:NIGHT']) {
      const w = driveWorld({ npcs: [], actorRegion: FOREST_EDGE, actorPosition: plain.position, clock });
      expect({ clock, seen: sourceEntity(w.observe(), plain.id) !== undefined }).toEqual({ clock, seen: true });
    }
  });
});

describe('④ 흩어진 것들이 숲의 방마다 선다 (RoomBearsMaterial)', () => {
  it('형태 셋이 여섯 방에서 자리를 얻고, 하나뿐이던 방에도 원천이 여럿이다', () => {
    const forms = new Set([FORM_ORE_PEBBLE, FORM_HUSK_SHARD, FORM_GLOW_CAP]);
    for (const region of [FOREST_EDGE, 'FOREST_DEEP', 'BIO_ORE_FIELD', PREDATOR_NEST, EXPLORER_RUIN, RED_EYE_TREE]) {
      const mine = sourcesInRegion(region);
      expect({ region, scattered: mine.filter((s) => forms.has(s.form)).length > 0 }).toEqual({ region, scattered: true });
      expect(mine.length).toBeGreaterThanOrEqual(3);
      // 자리는 전부 Description 의 point 가 준다 — 지어낸 자리가 없다
      const placed = new Set(pointsOf(regionSpec(region)!.space, RESOURCE_LAYER).map((p) => p.tag));
      for (const s of mine) expect(placed.has(s.id)).toBe(true);
    }
  });

  it('흩어진 것은 걸어 설 수 있는 자리에 선다 — 막힌 땅 위에 서지 않는다', () => {
    for (const spec of REGION_SPECS) {
      const t = terrainOf(spec.id);
      for (const s of sourcesInRegion(spec.id)) {
        if (![FORM_ORE_PEBBLE, FORM_HUSK_SHARD, FORM_GLOW_CAP].includes(s.form)) continue;
        expect({ id: s.id, walkable: isTraversableAt(t, s.position.x, s.position.z) }).toEqual({ id: s.id, walkable: true });
      }
    }
  });
});

describe('⑤ 철을 타는 방이 늘었다 (RoomNeverSame)', () => {
  const at = (region: string, x: number, z: number, clock: string) =>
    driveWorld({ npcs: [], actorRegion: region, actorPosition: { x, z }, clock });

  it('폐허의 더미 둘레는 스밈에만 위험으로 읽힌다', () => {
    expect(conditionsOf(at(EXPLORER_RUIN, -4, 4, 'STILL').observe())).toEqual([]);
    expect(conditionsOf(at(EXPLORER_RUIN, -4, 4, 'SEEP').observe())).toContain('hazard/ecology');
  });

  it('둥지의 사체 둘레는 긴 밤에만 깊어지고 위험해진다', () => {
    const still = at(PREDATOR_NEST, -6, 4, 'STILL').observe();
    const night = at(PREDATOR_NEST, -6, 4, 'LONG_NIGHT').observe();
    const depth = (v: GameViewSnapshot) => v.hud.find((h) => h.id === 'region.depth')?.value;
    expect(depth(still)).toBe('wild');
    expect(depth(night)).toBe('deep');
    expect(conditionsOf(night)).toContain('hazard/creature');
  });

  it('(경계) 밝히지 않은 방은 어느 철에도 그대로다 — 미로의 심장', () => {
    for (const clock of ['STILL', 'SEEP', 'LONG_NIGHT', 'TURN']) {
      const v = at('MAZE_HEART', 0, 0, clock).observe();
      expect({ clock, conditions: conditionsOf(v) }).toEqual({ clock, conditions: [] });
    }
  });
});

// 이 파일이 쓰는 것 가운데 아직 부르지 않은 것을 컴파일이 지우지 않게 한다
void createWorld;
void OBSERVER;
void TICK_INTERVAL;
