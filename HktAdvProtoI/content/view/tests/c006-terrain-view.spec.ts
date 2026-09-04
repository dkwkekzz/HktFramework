// C006 — 땅이 막고 흐른다 · View 쪽 검증
//
// 세계 쪽은 content/world/tests/c006-land-blocks-and-flows.spec.ts 가 잰다. 여기서 재는 것은
// **관찰자만이 가진 것** 셋이다:
//   ① 규칙 표의 자리가 옮겨졌는가 — world 와 view 가 같은 파일을 읽는가 (spec Reuse "규칙 표의 자리")
//   ② 젖은 땅과 거목이 화면에 나오는가 (Observable Result ② ④)
//   ③ 세계가 보낸 코드가 사람이 읽을 말이 되는가 (Observable Result ① ⑤)
//
// 이 Cycle 이 새로 쓴 view 파일을 읽지 않고 쓴다 — 그래서 export 의 이름을 모른다.
// c005-terrain-view.spec.ts 의 선례대로 **형으로** 고른다.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as biomeRules from '../biome-rules';
import * as terrainPresentation from '../terrain-presentation';
import { codeText } from '../code-text';
import { compileRegion } from '../../../engine/world-authoring/compile';
import { createTerrain, type TerrainPalette } from '../../../engine/view-kernel/terrain/terrain';
import type { RegionDescription } from '../../../engine/world-authoring/description';
import { REGISTERED_SPRITE_IDS } from '../sprites';
import { REGION_SPECS, START_REGION_ID, regionSpec } from '../../regions';
import {
  BLOCK_STEEP,
  BLOCK_WATER,
  COMPILE_RULES,
  CONDITION_RIDGE,
  CONDITION_RIVER,
  CONDITION_TREE,
  SURFACE_WET,
} from '../../regions/terrain-rules';

/** spec 이 이름까지 준 것 — landmark point 의 tag */
const TREE_TAG = 'WHITE_GIANT_TREE';

const domain = (): RegionDescription => regionSpec(START_REGION_ID)!.space;
const compiled = () => compileRegion(domain(), COMPILE_RULES);

/** 이 팩의 색 표 — colorOf 를 가진 것 (c005 의 선례 그대로 이름이 아니라 형으로 고른다) */
function findPalette(): TerrainPalette {
  const values = Object.values(terrainPresentation as Record<string, unknown>);
  const asPalette = values.find(
    (v): v is TerrainPalette => !!v && typeof v === 'object' && typeof (v as TerrainPalette).colorOf === 'function',
  );
  if (asPalette) return asPalette;
  const asFactory = values.find((v): v is () => TerrainPalette => {
    if (typeof v !== 'function' || v.length > 0) return false;
    try {
      const made = (v as () => unknown)();
      return !!made && typeof made === 'object' && typeof (made as TerrainPalette).colorOf === 'function';
    } catch {
      return false;
    }
  });
  if (asFactory) return asFactory();
  throw new Error(
    `content/view/terrain-presentation.ts 에서 색 표를 찾지 못했다 — 찾은 것: ${Object.keys(
      terrainPresentation,
    ).join(', ')}`,
  );
}

const PALETTE = findPalette();

/**
 * spriteCanvas 가 쓰는 document 를 흉내 낸다 — 그리는 층은 실제 화면 없이도 돌아야 한다.
 * (engine/view-kernel/tests/terrain.spec.ts 의 선례 그대로. 없으면 표식만 조용히 빠진다)
 */
function stubDocument(): () => void {
  const before = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect: () => {} }),
    }),
  };
  return () => {
    (globalThis as { document?: unknown }).document = before;
  };
}

// ─────────────────────────────────────────────────────────────
describe('SPEC-006 (view) — 규칙 표는 하나뿐이다', () => {
  it('V-001 view 의 표가 content/regions 의 표 그 자체다 — 값이 아니라 같은 것이다', () => {
    // Given view 가 내보내는 것들
    const values = Object.values(biomeRules as Record<string, unknown>);
    // Then 그 가운데 regions 의 COMPILE_RULES 와 **같은 객체**가 있다.
    // 값을 베껴 둔 것이 아니라 자리를 옮기고 가리키게 한 것이다 (spec "규칙 표의 자리")
    expect(values).toContain(COMPILE_RULES as unknown);
  });

  it('V-002 (경계) 해상도와 임계는 C005 의 값 그대로다 — 자리만 옮겼다', () => {
    expect(COMPILE_RULES.resolution).toBe(1); // 확정 4
    const slopes = COMPILE_RULES.surface
      .filter((rule) => rule.nearCurve === undefined)
      .map((rule) => rule.maxSlope)
      .filter((v): v is number => v !== undefined)
      .sort((a, b) => a - b);
    expect(slopes.map((v) => Math.round((v * 180) / Math.PI))).toEqual([15, 45]);
  });
});

describe('SPEC-004 (view) — 강가는 다른 색이다', () => {
  it('V-003 젖음 색이 나머지 표면 색과 모두 다르다', () => {
    const tags = compiled().world.surfaceTags;
    expect(tags).toContain(SURFACE_WET);
    const wet = PALETTE.colorOf(SURFACE_WET);
    expect(typeof wet).toBe('number');
    for (const tag of tags) {
      if (tag === SURFACE_WET) continue;
      expect({ tag, same: PALETTE.colorOf(tag) === wet }).toEqual({ tag, same: false });
    }
  });

  it('V-004 그린 땅에 젖은 vertex 가 실제로 나온다 — 강가 띠가 화면에 있다', () => {
    const region = compiled();
    const wetIndex = region.view.surfaceTags.indexOf(SURFACE_WET);
    expect(wetIndex).toBeGreaterThanOrEqual(0);
    const drawn = region.view.chunks.some((chunk) => [...chunk.surface].includes(wetIndex));
    expect(drawn).toBe(true);
  });
});

describe('SPEC-008 (view) — 거목이 그려진다', () => {
  it('V-005 표가 거목 태그에 그림을 준다 — 모르는 태그에는 아무것도 주지 않는다', () => {
    expect(typeof PALETTE.instanceOf).toBe('function');
    const drawn = PALETTE.instanceOf!(TREE_TAG);
    expect(drawn).not.toBeNull();
    expect(typeof drawn!.spriteId).toBe('string');
    expect(drawn!.spriteId.length).toBeGreaterThan(0);
    expect(drawn!.worldHeight).toBeGreaterThan(0);
    // 표에 없는 태그는 그리지 않는다 — 없는 것을 지어내지 않는다
    expect(PALETTE.instanceOf!('c006-test:no-such-instance') ?? null).toBeNull();
  });

  it('V-006 그 그림이 이 팩에 실제로 있다 — 지어낸 이름이 아니다', () => {
    const drawn = PALETTE.instanceOf!(TREE_TAG)!;
    expect(REGISTERED_SPRITE_IDS).toContain(drawn.spriteId);
  });

  it('V-007 그리면 instance 하나가 지형 group 에 붙는다 — 자리는 컴파일이 준 그 자리다', () => {
    const restore = stubDocument();
    try {
      const region = compiled();
      expect(region.view.instances.length).toBe(1);
      const instance = region.view.instances[0]!;
      const object = createTerrain(region.view, PALETTE);

      const sprites = object.children.filter((child): child is THREE.Sprite => child instanceof THREE.Sprite);
      expect(sprites.length).toBe(1);
      const sprite = sprites[0]!;
      expect(sprite.position.x).toBeCloseTo(instance.position.x, 6);
      expect(sprite.position.z).toBeCloseTo(instance.position.z, 6);
      // 발이 땅에 닿고 머리가 그 위다 — 가운데가 지면 + 키의 절반이다
      const drawn = PALETTE.instanceOf!(instance.tag)!;
      expect(sprite.position.y).toBeCloseTo(instance.y + drawn.worldHeight / 2, 6);
      expect(sprite.scale.x).toBeCloseTo(drawn.worldHeight, 6);
    } finally {
      restore();
    }
  });

  // C008 이 이 주장을 **좁혔다** — 미로의 식물이 서면서 "sprite 가 하나도 없다" 는 더는 참이 아니다.
  // 재려던 것은 **그릴 것이 없으면 그리지 않는가** 이므로, 컴파일 결과가 내보낸 instance 수와
  // 실제로 붙은 sprite 수가 같은가로 좁힌다 (그릴 것이 없는 방은 그대로 0 이다).
  it('V-008 (경계) 그릴 것이 없는 방에는 sprite 가 붙지 않는다 — 있는 만큼만 붙는다', () => {
    const restore = stubDocument();
    try {
      for (const spec of REGION_SPECS.filter((s) => s.id !== START_REGION_ID)) {
        const compiled = compileRegion(spec.space, COMPILE_RULES).view;
        const drawable = compiled.instances.filter((instance) => PALETTE.instanceOf?.(instance.tag));
        const object = createTerrain(compiled, PALETTE);
        const sprites = object.children.filter((child) => child instanceof THREE.Sprite);
        expect({ region: spec.id, sprites: sprites.length }).toEqual({
          region: spec.id,
          sprites: drawable.length,
        });
      }
    } finally {
      restore();
    }
  });
});

describe('SPEC-002 · 003 · 007 (view) — 세계의 코드가 사람의 말이 된다', () => {
  it('V-009 막힘의 사유 둘이 문구가 된다 — 코드가 그대로 새어 나오지 않는다', () => {
    for (const code of [BLOCK_STEEP, BLOCK_WATER]) {
      const text = codeText(code);
      expect({ code, text }).not.toEqual({ code, text: code }); // 미등록이면 코드 그대로 나온다
      expect(text.length).toBeGreaterThan(0);
    }
    // 둘이 서로 다른 말이다 — 무엇이 막았는지가 화면에서 갈린다
    expect(codeText(BLOCK_STEEP)).not.toBe(codeText(BLOCK_WATER));
  });

  it('V-010 조건 셋이 서로 다른 문구가 된다 — 산 · 강 · 거목', () => {
    const codes = [CONDITION_RIDGE, CONDITION_RIVER, CONDITION_TREE];
    const texts = codes.map((code) => codeText(code));
    for (let i = 0; i < codes.length; i++) {
      expect({ code: codes[i], text: texts[i] }).not.toEqual({ code: codes[i], text: codes[i] });
    }
    expect(new Set(texts).size).toBe(3);
  });

  it('V-011 (경계) 표에 없는 코드가 와도 멈추지 않는다 — 코드 그대로 드러난다', () => {
    const unknown = 'c006-test:no-such-code';
    expect(codeText(unknown)).toBe(unknown);
  });
});
