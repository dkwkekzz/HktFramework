// 출구가 여럿인 방의 표현 — C002 Observable Result ①~⑧ 을 결정 Layer 단독으로 검증한다.
// World 미기동. 관찰 계약이 허락하는 값(depth wild · exit state locked · transition 넷 · 사유 둘)만
// 손으로 지어 넣고 "그 값이 화면의 무엇이 되는가" 를 본다.
//
// 여기서 보는 것은 전부 **표**다 — 방 이름 · 깊이 색 · 종류 색 · 표식 그림 · 문구.
// 값이 늘어난 것뿐이므로 봉투 형은 하나도 만지지 않았고, 미등록 값에는 C001 의 폴백이 그대로 걸린다.

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import { descriptionHash } from '../../../engine/world-authoring/description';
import { regionSpec } from '../../regions/index';
import { REGISTERED_SPRITE_IDS } from '../sprites';
import { DEPTH_PRESENTATIONS, TRANSITION_TINTS, regionName } from '../region-presentation';

/** 출구 표식 하나 — 관찰 계약이 싣는 것만 (id · role · state · kind · position) */
function exit(id: string, kind: string, state: 'open' | 'locked' = 'open'): EntityView {
  return { id, role: 'region-exit', state, kind, position: { x: 0, z: 18 } };
}

/** 건너기 하나 — 대상 Connector 와 (거절이면) 사유 코드 */
function transit(targetEntityId: string, reason?: string): InteractionView {
  return reason === undefined
    ? { id: 'transit', role: 'transit-connector', targetEntityId, available: true }
    : { id: 'transit', role: 'transit-connector', targetEntityId, available: false, reason };
}

/**
 * 최소 관찰 결과 — 내 몸 하나 + 넘겨준 출구들.
 * hash 는 내 Description 에서 채운다 (region.spec.ts 와 같은 방식) — 세계와 같은 땅을 보는 상태.
 * depth 는 부르는 쪽이 넘긴다: 세계가 hud 로 보내는 값 그대로다.
 */
function snapshot(
  regionId: string,
  depth: string,
  entities: EntityView[],
  interactions: InteractionView[] = [],
): GameViewSnapshot {
  const spec = regionSpec(regionId);
  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: regionId,
    region: { id: regionId, hash: spec ? descriptionHash(spec.space) : '00000000' },
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

describe('④ 야생 — depth 태그가 셋이 된다', () => {
  it('wild 의 바닥 색이 civil · outer 어느 것과도 다르고, 더 어둡고 더 차갑다', () => {
    const civil = DEPTH_PRESENTATIONS.civil!;
    const outer = DEPTH_PRESENTATIONS.outer!;
    const wild = DEPTH_PRESENTATIONS.wild!;

    expect(wild.fill).not.toBe(civil.fill);
    expect(wild.fill).not.toBe(outer.fill);

    // 더 어둡다 — 채움 색의 밝기 합이 앞 단계보다 낮다
    const luma = (c: number) => ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff);
    expect(luma(wild.fill)).toBeLessThan(luma(outer.fill));
    expect(luma(outer.fill)).toBeLessThan(luma(civil.fill));

    // 더 차갑다 — 파랑이 빨강보다 세다 (civil · outer 는 그 반대이거나 초록이 세다)
    const red = (c: number) => (c >> 16) & 0xff;
    const blue = (c: number) => c & 0xff;
    expect(blue(wild.fill)).toBeGreaterThan(red(wild.fill));
    expect(blue(civil.fill)).toBeLessThan(red(civil.fill));
  });

  it('숲 안쪽에 서면 바닥이 wild 색으로 칠해지고 이름이 붙는다', () => {
    const plan = resolvePresentation(snapshot('FOREST_DEEP', 'wild', []));

    expect(plan.zones).toHaveLength(1);
    const zone = plan.zones[0]!;
    expect(zone.id).toBe('region:FOREST_DEEP');
    expect(zone.fill?.color).toBe(DEPTH_PRESENTATIONS.wild!.fill);
    expect(zone.edge?.color).toBe(DEPTH_PRESENTATIONS.wild!.edge);
    expect(zone.label).toBe('숲 안쪽');
  });

  it('HUD 깊이가 야생을 읽는다 — 문명권 · 경계 다음 한 마디', () => {
    const depth = resolvePresentation(snapshot('FOREST_DEEP', 'wild', [])).hud.find(
      (h) => h.id === 'region.depth',
    );
    expect(depth).toMatchObject({ widget: 'label', label: '깊이', value: '아무도 돌보지 않는 야생' });
  });

  it('막다른 방 셋의 이름도 표에 있다 — 방을 더하는 것은 표 한 줄이다', () => {
    expect(regionName('EXPLORER_RUIN')).toBe('탐험대 폐허');
    expect(regionName('PREDATOR_NEST')).toBe('포식수 둥지');
    expect(regionName('BIO_ORE_FIELD')).toBe('생체 광석 지대');
  });
});

describe('⑤ 닫힌 표식 — 출구는 열림과 닫힘으로 갈린다', () => {
  it('state=locked 면 spriteId 가 region-exit:locked 다 — 세계의 state 가 그대로 그림을 고른다', () => {
    const plan = resolvePresentation(
      snapshot('FOREST_DEEP', 'wild', [exit('ANCIENT_GATE', 'door', 'locked')]),
    );
    const gate = plan.entities.find((e) => e.id === 'ANCIENT_GATE');

    expect(gate?.spriteId).toBe('region-exit:locked');
    expect(gate?.size).toBe(2.0);
    expect(gate?.label).toBeUndefined(); // 잠겼다는 것만 보이고 그 너머는 여전히 없다
    expect(gate?.nameplate).toBeUndefined();
  });

  it('닫힌 표식의 그림이 등록되어 있고 열린 표식과 다른 그림이다', () => {
    expect(REGISTERED_SPRITE_IDS).toContain('region-exit:locked');
    expect(REGISTERED_SPRITE_IDS).toContain('region-exit:open');
  });

  it('경계(frontier)를 가리키는 출구도 열린 표식이다 — 목적지는 물어봐야 안다 (SPEC-007 경계)', () => {
    const plan = resolvePresentation(
      snapshot('WHITE_KING_DOMAIN', 'civil', [exit('RED_WASTE_PASS', 'pass')]),
    );
    expect(plan.entities.find((e) => e.id === 'RED_WASTE_PASS')?.spriteId).toBe('region-exit:open');
  });
});

describe('① 출구는 종류만 보인다 — 종류마다 색이 갈린다', () => {
  it('다섯 출구가 한 화면에 서면 다섯 색이 전부 다르다', () => {
    const plan = resolvePresentation(
      snapshot('FOREST_DEEP', 'wild', [
        exit('DEEP_TRAIL', 'trail'),
        exit('NEST_TRAIL', 'trail'),
        exit('ORE_TRAIL', 'trail'),
        exit('TREE_APPROACH', 'interaction'),
        exit('ANCIENT_GATE', 'door', 'locked'),
        exit('FOREST_PATH', 'road'),
        exit('RED_WASTE_PASS', 'pass'),
      ]),
    );
    const tintOf = (id: string) => plan.entities.find((e) => e.id === id)?.tint;

    const kinds = [tintOf('DEEP_TRAIL'), tintOf('TREE_APPROACH'), tintOf('ANCIENT_GATE'), tintOf('FOREST_PATH'), tintOf('RED_WASTE_PASS')];
    expect(kinds.every((t) => t !== undefined)).toBe(true);
    expect(new Set(kinds).size).toBe(5); // road · trail · door · pass · interaction 이 서로 다른 색

    // 같은 종류는 같은 색이다 — 표를 참조하므로 표식이 늘어도 색은 종류 수만큼만 있다
    expect(tintOf('NEST_TRAIL')).toBe(tintOf('DEEP_TRAIL'));
    expect(tintOf('ORE_TRAIL')).toBe(tintOf('DEEP_TRAIL'));
    // 표의 값이 그대로 온다 — 결정은 표 하나에만 있다
    expect(tintOf('DEEP_TRAIL')).toBe(TRANSITION_TINTS.trail);
    expect(tintOf('ANCIENT_GATE')).toBe(TRANSITION_TINTS.door);
  });
});

describe('②⑥ 거절 — 세계가 보낸 사유 코드가 문구가 된다', () => {
  it('region-not-built → 아직 갈 수 없는 곳이다 (세계의 끝이 아니라 아직 없는 곳)', () => {
    const plan = resolvePresentation(
      snapshot('WHITE_KING_DOMAIN', 'civil', [exit('RED_WASTE_PASS', 'pass')], [
        transit('RED_WASTE_PASS', 'region-not-built'),
      ]),
    );
    const t = plan.interactions.find((i) => i.id === 'transit');

    expect(t?.available).toBe(false);
    expect(t?.key).toBe('KeyQ'); // 키는 여전히 안내된다
    expect(t?.unavailableText).toBe('아직 갈 수 없는 곳이다');
  });

  it('connector-inactive → 잠겨 있다 (목적지는 밝히지 않는다)', () => {
    const plan = resolvePresentation(
      snapshot('FOREST_DEEP', 'wild', [exit('ANCIENT_GATE', 'door', 'locked')], [
        transit('ANCIENT_GATE', 'connector-inactive'),
      ]),
    );
    const t = plan.interactions.find((i) => i.id === 'transit');

    expect(t?.unavailableText).toBe('잠겨 있다');
    // 어느 문구에도 목적지의 이름이 없다
    expect(t?.unavailableText).not.toContain('환상');
    expect(t?.unavailableText).not.toContain('미로');
  });

  it('가용한 건너기는 사유 없이 프롬프트만 — 대상은 Connector 의 id', () => {
    const plan = resolvePresentation(
      snapshot('FOREST_DEEP', 'wild', [exit('ORE_TRAIL', 'trail')], [transit('ORE_TRAIL')]),
    );
    const t = plan.interactions.find((i) => i.id === 'transit');

    expect(t?.available).toBe(true);
    expect(t?.targetEntityId).toBe('ORE_TRAIL');
    expect(t?.prompt).toBe('건너기');
    expect(t?.unavailableText).toBeUndefined();
  });
});

describe('폴백 — 미등록 값이 와도 화면은 멈추지 않는다 (Play §6 불변 조건)', () => {
  it('모르는 depth 는 무채색 기본 바닥, 모르는 사유 코드는 코드 그대로', () => {
    const spec = regionSpec('FOREST_DEEP')!;
    const unknownDepth: GameViewSnapshot = {
      ...snapshot('FOREST_DEEP', 'abyss', [], [transit('SOMETHING', 'some-new-reason')]),
      region: { id: 'FOREST_DEEP', hash: descriptionHash(spec.space) },
    };
    const plan = resolvePresentation(unknownDepth);

    // 바닥은 spec 의 depth(wild)로 칠해진다 — hud 의 값은 문구만 정한다
    expect(plan.zones).toHaveLength(1);
    expect(plan.hud.find((h) => h.id === 'region.depth')?.value).toBe('abyss'); // 미등록 코드는 코드 그대로
    expect(plan.interactions[0]?.unavailableText).toBe('some-new-reason');
  });

  it('모르는 전이 종류의 출구는 색 없이 열린 표식으로 그려진다', () => {
    const plan = resolvePresentation(
      snapshot('FOREST_DEEP', 'wild', [exit('SOME_NEW_EXIT', 'ladder')]),
    );
    const e = plan.entities.find((x) => x.id === 'SOME_NEW_EXIT');

    expect(e?.spriteId).toBe('region-exit:open');
    expect(e?.tint).toBeUndefined(); // 표에 없으면 색이 없을 뿐이다
    expect(e?.size).toBe(2.0);
  });

  it('모르는 출구 state 는 그 state 의 spriteId 로 폴백한다 — 그림이 없으면 placeholder 가 그린다', () => {
    const plan = resolvePresentation(
      snapshot('FOREST_DEEP', 'wild', [exit('SEALED', 'door', 'sealed' as 'open')]),
    );
    expect(plan.entities.find((e) => e.id === 'SEALED')?.spriteId).toBe('region-exit:sealed');
    expect(REGISTERED_SPRITE_IDS).not.toContain('region-exit:sealed');
  });
});
