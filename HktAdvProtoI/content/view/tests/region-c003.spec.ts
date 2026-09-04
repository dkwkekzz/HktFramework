// 작은 문 · 큰 방 · 돌아올 수 없는 길의 표현 — C003 Observable Result ①~⑥ 을 결정 Layer 단독으로 검증한다.
// World 미기동. 관찰 계약이 허락하는 값(depth deep · transition falling · river · 새 Region id 셋)만
// 손으로 지어 넣고 "그 값이 화면의 무엇이 되는가" 를 본다.
//
// 여기서 보는 것은 전부 **표**다 — 방 이름 · 깊이 색과 문구 · 종류 색 · 표식 그림 · 시점 거리.
// 봉투의 형은 하나도 만지지 않았으므로(값의 가짓수만 늘었다) 미등록 값에는 C001 의 폴백이 그대로 걸린다.
//
// 시점 거리는 세계가 보내지 않는다 — 관찰자가 자기 content/regions 데이터를 읽어 정한다
// (spec Observable · 원칙 2). 그래서 이 검증도 World 없이 성립한다.

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import { descriptionHash } from '../../../engine/world-authoring/description';
import { regionSpec } from '../../regions/index';
import { REGISTERED_SPRITE_IDS } from '../sprites';
import { DEPTH_PRESENTATIONS, TRANSITION_TINTS, regionName } from '../region-presentation';
import treeInnerWorld from './fixtures/region-tree-inner-world.fixture.json';
import heartLake from './fixtures/region-heart-lake.fixture.json';

/** fixture 의 region.hash 를 내 Description 의 hash 로 채운다 — 세계와 같은 땅을 보는 상태 */
function withHash(fixture: GameViewSnapshot): GameViewSnapshot {
  const spec = regionSpec(fixture.region.id);
  if (!spec) throw new Error(`fixture 의 region '${fixture.region.id}' 가 content/regions 에 없다`);
  return { ...fixture, region: { id: fixture.region.id, hash: descriptionHash(spec.space) } };
}

/** 출구 표식 하나 — 관찰 계약이 싣는 것만 (id · role · state · kind · position) */
function exit(id: string, kind: string, state: 'open' | 'locked' = 'open'): EntityView {
  return { id, role: 'region-exit', state, kind, position: { x: 0, z: 18 } };
}

function transit(targetEntityId: string, reason?: string): InteractionView {
  return reason === undefined
    ? { id: 'transit', role: 'transit-connector', targetEntityId, available: true }
    : { id: 'transit', role: 'transit-connector', targetEntityId, available: false, reason };
}

/** 최소 관찰 결과 — 내 몸 하나 + 넘겨준 출구들 (region-c002.spec.ts 의 선례 그대로) */
function snapshot(
  regionId: string,
  depth: string,
  entities: EntityView[] = [],
  interactions: InteractionView[] = [],
): GameViewSnapshot {
  const spec = regionSpec(regionId);
  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: regionId,
    region: { id: regionId, hash: spec ? descriptionHash(spec.space) : '00000000' },
    standingConditions: [], // C006 ADDED — 조건 area 밖에 선 관찰자는 빈 목록이다
    observer: { id: 'observer-a', characterId: 'player', acknowledgedMark: 0 },
    entities: [
      { id: 'player', role: 'player-character', state: 'idle', kind: 'rabbit-swordsman', position: { x: 0, z: 0 } },
      ...entities,
    ],
    interactions,
    hud: [{ id: 'region.depth', kind: 'label', value: depth }],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

const inner = withHash(treeInnerWorld as GameViewSnapshot);
const lake = withHash(heartLake as GameViewSnapshot);

const luma = (c: number) => ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff);

describe('② 심부 — depth 태그가 넷이 된다', () => {
  it('deep 의 바닥 색이 civil · outer · wild 어느 것과도 다르다 — 네 깊이가 네 색이다', () => {
    const { civil, outer, wild, deep } = DEPTH_PRESENTATIONS as Record<
      string,
      { fill: number; edge: number }
    >;
    expect(deep).toBeDefined();
    for (const other of [civil, outer, wild]) {
      expect(deep!.fill).not.toBe(other!.fill);
      expect(deep!.edge).not.toBe(other!.edge);
    }
    expect(new Set([civil, outer, wild, deep].map((d) => d!.fill)).size).toBe(4);
    // 밝기의 방향(더 어둡다/밝다)은 단언하지 않는다 — spec 은 "바닥 색이 또 바뀐다" 만 말하고
    // deep 을 어느 쪽으로 칠할지는 정하지 않았다 (표현의 결정 · 보고 ②).
    expect(luma(deep!.fill)).not.toBe(luma(wild!.fill));
  });

  it('큰 방에 서면 바닥이 deep 색으로 칠해지고 이름이 붙는다', () => {
    const plan = resolvePresentation(inner);

    expect(plan.zones).toHaveLength(1);
    const zone = plan.zones[0]!;
    expect(zone.id).toBe('region:TREE_INNER_WORLD');
    expect(zone.fill?.color).toBe((DEPTH_PRESENTATIONS as Record<string, { fill: number }>).deep!.fill);
    expect(zone.label).toBe('거목 내부 세계');
  });

  it('HUD 깊이가 심부를 읽는다 — 야생 다음 한 마디', () => {
    for (const v of [inner, lake]) {
      expect(resolvePresentation(v).hud.find((h) => h.id === 'region.depth')).toMatchObject({
        widget: 'label',
        label: '깊이',
        value: '법칙이 낯설어지는 심부',
      });
    }
  });

  it('이 Cycle 이 더한 방 셋의 이름이 표에 있다 — 방을 더하는 것은 표 한 줄이다', () => {
    expect(regionName('RED_EYE_TREE')).toBe('붉은 눈의 거목');
    expect(regionName('TREE_INNER_WORLD')).toBe('거목 내부 세계');
    expect(regionName('HEART_LAKE')).toBe('심장 호수');
  });
});

describe('①⑤ 새 전이 색 — falling · river 가 종류로 갈린다', () => {
  it('falling · river 가 표에 있고 기존 다섯과도 서로와도 다른 색이다', () => {
    const tints = TRANSITION_TINTS as Record<string, number>;
    expect(tints.falling).toBeDefined();
    expect(tints.river).toBeDefined();
    const seven = ['road', 'trail', 'door', 'pass', 'interaction', 'falling', 'river'].map(
      (k) => tints[k],
    );
    expect(seven.every((t) => t !== undefined)).toBe(true);
    expect(new Set(seven).size).toBe(7); // 일곱 종류가 일곱 색이다
  });

  it('큰 방의 두 출구가 door · falling 으로 서로 다른 색이다 — 표의 값이 그대로 온다', () => {
    const plan = resolvePresentation(inner);
    const tintOf = (id: string) => plan.entities.find((e) => e.id === id)?.tint;

    expect(tintOf('TREE_INNER_DOOR')).toBe((TRANSITION_TINTS as Record<string, number>).door);
    expect(tintOf('TREE_FALL')).toBe((TRANSITION_TINTS as Record<string, number>).falling);
    expect(tintOf('TREE_FALL')).not.toBe(tintOf('TREE_INNER_DOOR'));
  });

  it('심장 호수의 표식은 하나뿐이고 river 색의 열린 표식이다 (Observable Result ⑤)', () => {
    const plan = resolvePresentation(lake);
    const marks = plan.entities.filter((e) => e.spriteId?.startsWith('region-exit:'));

    expect(marks).toHaveLength(1);
    expect(marks[0]?.id).toBe('HEART_RIVER');
    expect(marks[0]?.spriteId).toBe('region-exit:open');
    expect(marks[0]?.tint).toBe((TRANSITION_TINTS as Record<string, number>).river);
    expect(marks[0]?.size).toBe(2.0);
    expect(marks[0]?.label).toBeUndefined(); // 물길 너머는 여전히 밝히지 않는다
    // 떨어져 선 자리(0, 0) 에는 아무 표식도 없다 — 세계가 보내지 않았으므로 그리지도 않는다
    expect(marks.some((m) => m.position?.x === 0 && m.position?.z === 0)).toBe(false);
  });

  it('falling 도 여느 출구와 같은 표식이다 — 특별한 그림을 두지 않는다', () => {
    const plan = resolvePresentation(
      snapshot('TREE_INNER_WORLD', 'deep', [exit('TREE_FALL', 'falling')]),
    );
    const fall = plan.entities.find((e) => e.id === 'TREE_FALL');
    expect(fall?.spriteId).toBe('region-exit:open');
    expect(REGISTERED_SPRITE_IDS).toContain('region-exit:open');
  });
});

describe('③ 큰 방은 바닥이 넓을 뿐 — 시점은 방 크기를 따라가지 않는다', () => {
  // V4 CHANGED — "방을 한 화면에 맞춘다" 는 규칙을 두지 않는다 (RegionGraphRooms 불변 조건
  // "방은 공간일 뿐이다"). 시점은 몸을 따르고 extent 는 바닥의 경계일 뿐이다 —
  // Region 이 대륙급이 되어도 시점 거리는 그대로여야 하기 때문이다.
  it('한 변 80 인 방의 바닥은 그만큼 넓다 — 넓어지는 것은 바닥이지 시점이 아니다', () => {
    const plan = resolvePresentation(inner);
    const zone = plan.zones[0]!;
    if (zone.shape.kind !== 'polygon') throw new Error('polygon 이어야 한다');
    expect(zone.shape.points).toEqual([
      { x: -40, z: -40 },
      { x: 40, z: -40 },
      { x: 40, z: 40 },
      { x: -40, z: 40 },
    ]);
  });

  it('장면 지시에 시점 거리가 실리지 않는다 — 방 크기는 카메라로 새지 않는다', () => {
    for (const plan of [resolvePresentation(inner), resolvePresentation(lake)]) {
      expect(plan).not.toHaveProperty('viewDistance');
    }
  });

  it('모르는 region id 면 바닥이 없다 — 바닥 없이도 게임은 돈다 (폴백)', () => {
    expect(resolvePresentation(snapshot('UNCHARTED', 'abyss')).zones).toHaveLength(0);
  });
});

describe('⑥ 물길로 나온 자리 — 아까 그 방인데 선 자리가 다르다', () => {
  it('숲 안쪽의 바닥 색과 이름은 그대로이고 출구 다섯 중 하나가 닫힌 표식이다', () => {
    const plan = resolvePresentation(
      snapshot(
        'FOREST_DEEP',
        'wild',
        [
          exit('DEEP_TRAIL', 'trail'),
          exit('NEST_TRAIL', 'trail'),
          exit('ORE_TRAIL', 'trail'),
          exit('TREE_APPROACH', 'interaction'),
          exit('ANCIENT_GATE', 'door', 'locked'),
        ],
      ),
    );
    expect(plan.zones[0]?.label).toBe('숲 안쪽');
    expect(plan.zones[0]?.fill?.color).toBe(
      (DEPTH_PRESENTATIONS as Record<string, { fill: number }>).wild!.fill,
    );
    const marks = plan.entities.filter((e) => e.spriteId?.startsWith('region-exit:'));
    expect(marks).toHaveLength(5);
    expect(marks.filter((m) => m.spriteId === 'region-exit:locked').map((m) => m.id)).toEqual([
      'ANCIENT_GATE',
    ]);
  });

  it('물길로 나온 자리와 거목으로 나갔던 자리가 화면에서 다른 곳이다', () => {
    // 세계가 보낸 자리 그대로 그린다 — 표현이 자리를 지어내지 않는다
    const at = (z: number) =>
      resolvePresentation({
        ...snapshot('FOREST_DEEP', 'wild'),
        entities: [
          {
            id: 'player',
            role: 'player-character',
            state: 'idle',
            kind: 'rabbit-swordsman',
            position: { x: 14, z },
          },
        ],
      } as GameViewSnapshot).entities.find((e) => e.id === 'player')?.position;

    expect(at(-8)).toEqual({ x: 14, z: -8 });
    expect(at(-8)).not.toEqual({ x: 0, z: 18 });
  });
});

describe('폴백 — 값이 늘어도 화면은 멈추지 않는다 (봉투 형이 그대로이므로)', () => {
  it('모르는 depth 는 문구가 코드 그대로이고 바닥은 내 데이터의 depth 로 칠해진다', () => {
    const plan = resolvePresentation(snapshot('TREE_INNER_WORLD', 'abyss'));
    expect(plan.hud.find((h) => h.id === 'region.depth')?.value).toBe('abyss');
    expect(plan.zones[0]?.fill?.color).toBe(
      (DEPTH_PRESENTATIONS as Record<string, { fill: number }>).deep!.fill,
    );
  });

  it('모르는 전이 종류는 색 없이 열린 표식이다 — falling · river 가 늘어도 폴백은 그대로다', () => {
    const plan = resolvePresentation(
      snapshot('HEART_LAKE', 'deep', [exit('SOME_NEW_EXIT', 'tunnel')]),
    );
    const e = plan.entities.find((x) => x.id === 'SOME_NEW_EXIT');
    expect(e?.spriteId).toBe('region-exit:open');
    expect(e?.tint).toBeUndefined();
  });

  it('사유 코드 문구는 C002 그대로다 — 새 전이에도 같은 문구가 붙는다', () => {
    const plan = resolvePresentation(
      snapshot('HEART_LAKE', 'deep', [exit('HEART_RIVER', 'river')], [
        transit('HEART_RIVER', 'out-of-range'),
      ]),
    );
    const t = plan.interactions.find((i) => i.id === 'transit');
    expect(t?.available).toBe(false);
    expect(t?.key).toBe('KeyQ');
    expect(t?.unavailableText).toBeDefined();
    // 목적지의 이름은 어디에도 없다
    expect(JSON.stringify(plan)).not.toContain('숲 안쪽');
  });
});
