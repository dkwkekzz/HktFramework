// 방(Region) 표현 — C001 Observable Result ①~⑤ 를 결정 Layer 단독으로 검증한다.
// World 미기동. 관찰 결과 fixture(백왕령 · 숲 가장자리)만으로 "region/depth/role → 무엇을 그릴지" 를 본다.
//
// fixture 의 hash 는 실제 값을 적어 두지 않는다 — 산법은 기구의 것이므로 테스트 안에서
// 내 데이터(content/regions)로 채운다. 불일치 케이스는 일부러 다른 값을 넣는다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import { regionEntryTitle } from '../region-presentation';
import { descriptionHash } from '../../../engine/world-authoring/description';
import { regionSpec } from '../../regions/index';
import { REGISTERED_SPRITE_IDS } from '../sprites';
import whiteKingDomain from './fixtures/region-white-king-domain.fixture.json';
import forestEdge from './fixtures/region-forest-edge.fixture.json';

/** fixture 의 region.hash 를 내 Description 의 hash 로 채운다 — 세계와 같은 땅을 보는 상태 */
function withHash(fixture: GameViewSnapshot, hash?: string): GameViewSnapshot {
  const spec = regionSpec(fixture.region.id);
  if (!spec) throw new Error(`fixture 의 region '${fixture.region.id}' 가 content/regions 에 없다`);
  return {
    ...fixture,
    region: { id: fixture.region.id, hash: hash ?? descriptionHash(spec.space) },
  };
}

const civil = withHash(whiteKingDomain as GameViewSnapshot);
const outer = withHash(forestEdge as GameViewSnapshot);

describe('① 방의 바닥 — Region extent 만큼의 면', () => {
  it('백왕령에 서면 zones 의 첫째가 방 바닥 — 내 Description 의 extent 네 꼭짓점', () => {
    const plan = resolvePresentation(civil);

    // C006 CHANGED — 방 바닥 말고도 settlement area 의 테두리가 함께 그려진다
    // (C006 Observable Result ⑥ "도시 area 의 테두리가 보인다"). 그래서 개수를 박지 않고
    // **방 바닥이 여전히 첫째 zone 인가**를 지킨다.
    expect(plan.zones.length).toBeGreaterThanOrEqual(1);
    const zone = plan.zones[0]!;
    expect(zone.id).toBe('region:WHITE_KING_DOMAIN');
    expect(zone.shape.kind).toBe('polygon');
    if (zone.shape.kind !== 'polygon') throw new Error('polygon 이어야 한다');
    expect(zone.shape.points).toEqual([
      { x: -20, z: -20 },
      { x: 20, z: -20 },
      { x: 20, z: 20 },
      { x: -20, z: 20 },
    ]);
    // 채움은 옅고 테두리는 진하다
    expect(zone.fill?.opacity).toBeGreaterThanOrEqual(0.25);
    expect(zone.fill?.opacity).toBeLessThanOrEqual(0.35);
    expect(zone.edge?.opacity).toBeGreaterThan(zone.fill!.opacity);
  });

  it('civil 과 outer 의 바닥 색이 다르다 — 색이 곧 깊이다', () => {
    const civilZone = resolvePresentation(civil).zones[0]!;
    const outerZone = resolvePresentation(outer).zones[0]!;

    expect(outerZone.id).toBe('region:FOREST_EDGE');
    expect(civilZone.fill?.color).not.toBe(outerZone.fill?.color);
    expect(civilZone.edge?.color).not.toBe(outerZone.edge?.color);
  });

  // C026 CHANGED — 어긋남은 **늘 떠 있던 이름 뒤**가 아니라 들어선 순간의 제목에서 말한다
  // (R4 · SPEC-008 이 지면의 이름표를 걷었다). 사실도 문구도 그대로이고 자리만 옮겼다.
  it('세계가 보낸 hash 가 내 데이터와 다르면 진입 제목이 그 사실을 말한다 — 그리기는 계속된다', () => {
    const mismatched = withHash(whiteKingDomain as GameViewSnapshot, 'deadbeef');
    const plan = resolvePresentation(mismatched);

    expect(plan.zones.length).toBeGreaterThanOrEqual(1);
    expect(plan.zones[0]?.label).toBeUndefined();
    expect(regionEntryTitle(mismatched, undefined)).toContain('세계와 다른 땅을 보고 있다');
    expect(regionEntryTitle(mismatched, undefined)).toContain('백왕령');
  });
});

describe('② 방 이름 — id → 이름 표', () => {
  // C026 CHANGED (SPEC-008) — 지면 구역에는 이름표가 없다. 같은 표(REGION_NAMES)가
  // 이제 **들어선 프레임의 제목**을 짓는다 (SPEC-010: 한 번 지나가고 사라진다).
  it('지면에는 이름표가 없고, 방에 들어선 순간의 제목이 방 이름이다', () => {
    expect(resolvePresentation(civil).zones[0]?.label).toBeUndefined();
    expect(resolvePresentation(outer).zones[0]?.label).toBeUndefined();
    expect(regionEntryTitle(civil, undefined)).toContain('백왕령');
    expect(regionEntryTitle(outer, 'WHITE_KING_DOMAIN')).toContain('숲 가장자리');
    // 같은 방에 머무는 동안은 다시 뜨지 않는다
    expect(regionEntryTitle(outer, 'FOREST_EDGE')).toBeUndefined();
  });

  it('모르는 region id 면 zones 가 비고 예외가 없다 — 바닥 없이도 게임은 돈다', () => {
    const unknown: GameViewSnapshot = {
      ...civil,
      scene: 'UNCHARTED',
      region: { id: 'UNCHARTED', hash: '00000000' },
    };

    const plan = resolvePresentation(unknown);
    expect(plan.zones).toEqual([]);
    expect(plan.entities.length).toBeGreaterThan(0); // 나머지는 그대로 그려진다
  });
});

describe('③ 출구 표식 — anchor 자리의 표식 하나, 목적지 이름은 없다', () => {
  it('region-exit 존재는 region-exit:open 으로 그려지고 전이 종류(road)의 색이 곱해진다', () => {
    const plan = resolvePresentation(civil);
    const exit = plan.entities.find((e) => e.id === 'FOREST_PATH');

    expect(exit?.spriteId).toBe('region-exit:open');
    expect(exit?.size).toBe(2.0);
    expect(exit?.tint).toBeDefined(); // road → 표의 색
    expect(exit?.cameraFollow).toBe(false);
    expect(exit?.label).toBeUndefined(); // 목적지 이름은 어디에도 없다
    expect(exit?.nameplate).toBeUndefined();
    expect(exit?.position).toEqual({ x: 0, z: 18 }); // anchor 자리 그대로
  });

  it('출구 표식의 그림은 등록되어 있다 (placeholder 가 아니다)', () => {
    expect(REGISTERED_SPRITE_IDS).toContain('region-exit:open');
  });
});

describe('④ 건너기 — transit interaction 에 키와 프롬프트가 붙는다', () => {
  it('가용하면 key · keyLabel · prompt, 대상은 Connector 의 id', () => {
    const transit = resolvePresentation(civil).interactions.find((i) => i.id === 'transit');

    expect(transit?.available).toBe(true);
    expect(transit?.targetEntityId).toBe('FOREST_PATH');
    expect(transit?.key).toBe('KeyQ');
    expect(transit?.keyLabel).toBe('Q');
    expect(transit?.prompt).toBe('건너기');
    expect(transit?.unavailableText).toBeUndefined();
  });

  it('불가면 세계가 보낸 사유 코드가 문구로 — 판정은 세계의 것 그대로', () => {
    const transit = resolvePresentation(outer).interactions.find((i) => i.id === 'transit');

    expect(transit?.available).toBe(false);
    expect(transit?.key).toBe('KeyQ'); // 키는 여전히 안내된다
    expect(transit?.unavailableText).toContain('행동이 끝나야');
  });
});

// C027 CHANGED — 깊이는 상시 HUD 를 떠나 판의 줄이 되었다 (SPEC-006). 문구를 옮기는
// 규칙 자체는 그대로이므로, 재는 자리만 옮긴다.
const depthRow = (v: GameViewSnapshot) =>
  resolvePresentation(v).targetFrame?.rows.find((r) => r.id === 'place.depth');

describe('⑤ 깊이 문구 — region.depth 의 태그가 판의 줄에서 문구로 바뀐다', () => {
  it('civil → 문명권', () => {
    expect(depthRow(civil)).toMatchObject({ label: '깊이', value: '문명권' });
  });

  it('outer → 문명의 경계를 넘었다', () => {
    expect(depthRow(outer)).toMatchObject({ label: '깊이', value: '문명의 경계를 넘었다' });
  });

  it('건너기 거절 사유(unknown-connector · wrong-region)도 문구가 있다', () => {
    const rejected: GameViewSnapshot = {
      ...civil,
      interactions: civil.interactions.map((i) =>
        i.id === 'transit' ? { ...i, available: false, reason: 'wrong-region' } : i,
      ),
    };
    const transit = resolvePresentation(rejected).interactions.find((i) => i.id === 'transit');
    expect(transit?.unavailableText).toBe('여기서 갈 수 있는 길이 아니다');
  });
});

describe('④ 건너면 화면이 바뀐다 — 두 관찰 결과의 차이가 곧 화면의 차이다', () => {
  it('scene · 바닥 색 · 이름 · 깊이 문구가 함께 바뀌고, 몸은 상대 anchor 자리에 선다', () => {
    const before = resolvePresentation(civil);
    const after = resolvePresentation(outer);

    expect(before.terrain).toBe('WHITE_KING_DOMAIN');
    expect(after.terrain).toBe('FOREST_EDGE');
    expect(before.zones[0]?.fill?.color).not.toBe(after.zones[0]?.fill?.color);
    // 이름은 지면이 아니라 진입 제목이 말한다 (C026 R4)
    expect(regionEntryTitle(civil, undefined)).not.toBe(regionEntryTitle(outer, 'WHITE_KING_DOMAIN'));
    expect(after.entities.find((e) => e.cameraFollow)?.position).toEqual({ x: 0, z: -18 });
    // 숲 가장자리에는 내 몸과 출구뿐이다 (SPEC-007 경계)
    expect(after.entities.map((e) => e.id)).toEqual(['player', 'FOREST_PATH']);
  });
});
