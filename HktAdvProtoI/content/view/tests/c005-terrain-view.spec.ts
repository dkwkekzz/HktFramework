// C005 — 땅이 솟는다 · View 쪽 검증 (spec SPEC-004 · SPEC-005)
//
// 세계 쪽은 content/world/tests/c005-land-rises.spec.ts 가 잰다. 여기서 재는 것은
// **컨텐츠가 실제로 쓰는 두 표**다: 표면 규칙 표(경사 임계)와 surface 태그 → 색 표.
//
// 이 Cycle 이 새로 쓴 파일을 읽지 않고 쓴다 — 그래서 export 의 **이름을 모른다**.
// 이름 대신 형으로 고른다(`import * as` 로 모듈 전체를 받아 CompileRules 모양 · TerrainPalette
// 모양을 찾는다). 태그의 이름도 마찬가지로 하드코딩하지 않는다 — 언제나 표의 순서와 경사에서
// 유도한다. spec 이 못박은 것은 임계(45° · 15°)와 해상도(1)이지 이름이 아니다.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as biomeRules from '../biome-rules';
import * as terrainPresentation from '../terrain-presentation';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompileRules, SurfaceRule } from '../../../engine/world-authoring/compiled';
import {
  buildHeightField,
  slopeAtVertex,
  vertexZ,
} from '../../../engine/world-authoring/height-field';
import type { RegionDescription } from '../../../engine/world-authoring/description';
import { createTerrain, type TerrainPalette } from '../../../engine/view-kernel/terrain/terrain';
import { REGION_SPECS, START_REGION_ID, regionSpec } from '../../regions';

const DEG = Math.PI / 180;
const STEEP_SLOPE = 45 * DEG; // 확정 1
const WALK_SLOPE = 15 * DEG; // spec UNRESOLVED 의 기본형

// ── 형으로 고르기 — 이름을 모른 채 표를 찾는다 ─────────────────

const isSurfaceRule = (value: unknown): value is SurfaceRule =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as SurfaceRule).tag === 'string' &&
  ((value as SurfaceRule).maxSlope === undefined || typeof (value as SurfaceRule).maxSlope === 'number');

const isRuleTable = (value: unknown): value is SurfaceRule[] =>
  Array.isArray(value) && value.length > 0 && value.every(isSurfaceRule);

const isCompileRules = (value: unknown): value is CompileRules =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as CompileRules).resolution === 'number' &&
  isRuleTable((value as CompileRules).surface);

/** 이 팩의 컴파일 규칙 — CompileRules 모양이면 그대로, 표만 있으면 해상도를 찾아 붙인다 */
function findCompileRules(): CompileRules {
  const values = Object.values(biomeRules as Record<string, unknown>);
  const whole = values.find(isCompileRules);
  if (whole) return whole;
  const table = values.find(isRuleTable);
  const resolution = values.find((v): v is number => typeof v === 'number' && v > 0 && Number.isFinite(v));
  if (!table || resolution === undefined) {
    throw new Error(
      `content/view/biome-rules.ts 에서 CompileRules 모양의 export 를 찾지 못했다 — 찾은 것: ${Object.keys(
        biomeRules,
      ).join(', ')}`,
    );
  }
  return { resolution, surface: table };
}

/** 이 팩의 색 표 — TerrainPalette 이거나, 태그를 받아 색을 주는 함수이거나, 태그 → 색 기록이다 */
function findPalette(): TerrainPalette {
  const values = Object.values(terrainPresentation as Record<string, unknown>);
  const asPalette = values.find(
    (v): v is TerrainPalette => !!v && typeof v === 'object' && typeof (v as TerrainPalette).colorOf === 'function',
  );
  if (asPalette) return asPalette;

  const probe = 'c005-test:no-such-tag';
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

  const asFunction = values.find((v): v is (tag: string) => number => {
    if (typeof v !== 'function' || v.length !== 1) return false;
    try {
      return typeof (v as (tag: string) => unknown)(probe) === 'number';
    } catch {
      return false;
    }
  });
  if (asFunction) return { colorOf: (tag) => asFunction(tag) };

  const asTable = values.find(
    (v): v is Record<string, number> =>
      !!v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.values(v).length > 0 &&
      Object.values(v).every((c) => typeof c === 'number'),
  );
  if (asTable) return { colorOf: (tag) => asTable[tag] ?? 0x000000 };

  throw new Error(
    `content/view/terrain-presentation.ts 에서 색 표를 찾지 못했다 — 찾은 것: ${Object.keys(
      terrainPresentation,
    ).join(', ')}`,
  );
}

const RULES = findCompileRules();
const PALETTE = findPalette();

const domain = (): RegionDescription => regionSpec(START_REGION_ID)!.space;
const compiled = () => compileRegion(domain(), RULES);
/** 유한 임계들 — 작은 것부터 (이름이 아니라 값으로 가리킨다) */
const thresholds = () =>
  RULES.surface
    .map((rule) => rule.maxSlope)
    .filter((v): v is number => v !== undefined)
    .sort((a, b) => a - b);

// ─────────────────────────────────────────────────────────────
describe('SPEC-004 — 표면이 경사로 갈린다 (컨텐츠의 규칙 표)', () => {
  it('V-001 표가 규칙 셋이고 태그 이름이 서로 다르다', () => {
    expect(RULES.surface.length).toBe(3); // spec 이 못박은 수 — 평지 · 비탈 · 급경사
    expect(new Set(RULES.surface.map((r) => r.tag)).size).toBe(3);
    for (const rule of RULES.surface) expect(rule.tag.length).toBeGreaterThan(0);
  });

  it('V-002 임계가 spec 의 둘이다 — 15° 와 45° (확정 1 · UNRESOLVED 기본형)', () => {
    const [walk, steep] = thresholds();
    expect(thresholds().length).toBe(2);
    expect(walk).toBeCloseTo(WALK_SLOPE, 6);
    expect(steep).toBeCloseTo(STEEP_SLOPE, 6);
  });

  it('V-003 배열 순서가 곧 우선순위다 — 임계가 오름차순이고 마지막 줄만 위가 열려 있다', () => {
    const slopes = RULES.surface.map((r) => r.maxSlope);
    // 마지막 줄이 남은 전부를 받는다 (evaluateSurface 의 규율)
    expect(slopes[slopes.length - 1]).toBeUndefined();
    // 그 앞은 오름차순이다 — 배열 순서로 첫 번째가 이기므로 이 순서가 아니면 뜻이 뒤집힌다
    const finite = slopes.slice(0, -1) as number[];
    expect(finite).toEqual([...finite].sort((a, b) => a - b));
    expect(finite.every((v) => v > 0)).toBe(true);
  });

  it('V-004 해상도가 1 이다 (확정 4 · 결정론 상수)', () => {
    expect(RULES.resolution).toBe(1);
  });

  it('V-005 그 표로 백왕령을 컴파일하면 평평한 남쪽에 첫째 · 능선 허리에 둘째 태그가 붙는다', () => {
    // Given 컨텐츠의 표로 컴파일한 백왕령
    const region = compiled();
    const field = buildHeightField(domain(), RULES.resolution);
    const tags = region.world.surfaceTags;
    const [walk, steep] = thresholds() as [number, number];

    const tagAt = (ix: number, iz: number) => tags[region.world.surface[iz * region.world.cols + ix] ?? 0];

    // Then 남쪽 변(minZ)은 전부 첫째 태그다
    for (let ix = 0; ix < region.world.cols; ix++) {
      expect({ ix, z: vertexZ(field, 0), tag: tagAt(ix, 0) }).toEqual({
        ix,
        z: domain().extent.minZ,
        tag: tags[0],
      });
    }

    // 그리고 경사가 두 임계 사이인 자리는 둘째 태그, 그 위는 셋째 태그다 (이름이 아니라 순서로 가리킨다)
    let waist = 0;
    let steepCount = 0;
    for (let iz = 0; iz < region.world.rows; iz++) {
      for (let ix = 0; ix < region.world.cols; ix++) {
        const slope = slopeAtVertex(field, ix, iz);
        if (slope >= walk && slope < steep) {
          expect(tagAt(ix, iz)).toBe(tags[1]);
          waist++;
        } else if (slope >= steep) {
          expect(tagAt(ix, iz)).toBe(tags[2]);
          steepCount++;
        }
      }
    }
    // 셋이 다 쓰인다 — 걸어 올라가면 발밑 색이 갈린다 (Observable Result ②)
    expect(waist).toBeGreaterThan(0);
    expect(steepCount).toBeGreaterThan(0);
  });

  it('V-006 (경계) 젖음(wet)은 아직 없다 — 표는 경사만 본다', () => {
    // 확정 5 의 넷 중 셋만 쓴다: 규칙 줄이 셋이고 어느 줄도 경사 말고 다른 것을 묻지 않는다
    for (const rule of RULES.surface) {
      expect(Object.keys(rule).sort()).toEqual(
        rule.maxSlope === undefined ? ['tag'] : ['maxSlope', 'tag'],
      );
    }
  });

  it('V-007 (경계) stamp 가 없는 여덟 방은 같은 표로도 첫째 태그 하나뿐이다', () => {
    for (const spec of REGION_SPECS.filter((s) => s.id !== START_REGION_ID)) {
      const region = compileRegion(spec.space, RULES);
      expect({ region: spec.id, used: [...new Set(region.world.surface)] }).toEqual({
        region: spec.id,
        used: [0],
      });
    }
  });
});

describe('SPEC-005 — 색은 표가 정한다', () => {
  const tags = () => compiled().world.surfaceTags;

  it('V-008 태그 셋이 서로 다른 색이다', () => {
    const colors = tags().map((tag) => PALETTE.colorOf(tag));
    for (const color of colors) {
      expect(typeof color).toBe('number');
      expect(Number.isFinite(color)).toBe(true);
    }
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('V-009 그린 땅의 vertex 색이 그 태그의 색이다 — 표가 곱해진다', () => {
    // Given 컨텐츠의 표로 컴파일한 백왕령을 실제로 그린다
    const region = compiled();
    const object = createTerrain(region.view, PALETTE);
    const expected = region.view.surfaceTags.map((tag) => new THREE.Color(PALETTE.colorOf(tag)));

    let checked = 0;
    const seen = new Set<string>();
    object.children.forEach((child, index) => {
      const chunk = region.view.chunks[index]!;
      const color = (child as THREE.Mesh).geometry.getAttribute('color');
      expect(color.count).toBe(chunk.cols * chunk.rows);
      for (let i = 0; i < color.count; i++) {
        const want = expected[chunk.surface[i] ?? 0]!;
        // Then 그 vertex 의 색이 표의 색이다 (버퍼가 float32 라 자리끝만 다르다)
        expect(color.getX(i)).toBeCloseTo(want.r, 6);
        expect(color.getY(i)).toBeCloseTo(want.g, 6);
        expect(color.getZ(i)).toBeCloseTo(want.b, 6);
        seen.add(region.view.surfaceTags[chunk.surface[i] ?? 0]!);
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(0);
    // 셋이 다 화면에 나온다
    expect(seen.size).toBe(region.view.surfaceTags.length);
  });

  it('V-010 (경계) 표에 없는 태그가 와도 멈추지 않는다 — 기본색으로 그려진다', () => {
    // Given 이 팩의 표가 모르는 태그
    const unknown = 'c005-test:no-such-surface';
    expect(tags()).not.toContain(unknown);
    // Then 색을 물어도 던지지 않고 수 하나가 온다 (C001 부터의 폴백 규칙)
    const color = PALETTE.colorOf(unknown);
    expect(typeof color).toBe('number');
    expect(Number.isFinite(color)).toBe(true);

    // 그리고 그 태그만 있는 땅도 그려진다 — 게임이 멈추지 않는다
    const region = compiled();
    const drawn = createTerrain({ ...region.view, surfaceTags: [unknown] }, PALETTE);
    expect(drawn.children.length).toBe(region.view.chunks.length);
  });

  it.todo(
    'GAP: 몸·광맥·출구 표식이 땅에 붙어 함께 오르는 것(Observable Result ⑤)은 그리기의 배선이라 이 층에서 재지 못한다 — 재는 자리가 아직 없다',
  );
});
