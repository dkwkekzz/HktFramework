// C026 — 자리를 지목하면 그 자리의 사실이 선다 · 시나리오 테스트
//
// 이 Cycle 은 **세계를 한 자리도 바꾸지 않는다** (spec World Change). 바뀌는 것은 결정 Layer 가
// 만드는 SceneState 와 클릭의 뜻뿐이다. 그래서 시나리오가 서는 자리는 content/world/tests 가 아니라
// 여기다: 관찰 결과(봉투) + 관찰자의 지목 → SceneState 를 보고 단언한다. World 는 기동하지 않는다.
//
// 이 파일은 이 Cycle 이 새로 쓴 코드를 **읽지 않고** 쓴다 (c006-terrain-view.spec.ts 의 선례).
// 그래서 줄의 id 도, 문구의 어법도, 판이 무슨 말로 적는지도 모른다. 아는 것은 spec 이 준 계약뿐이다:
//
//   resolvePresentation(snapshot, motions?, { designation })   designation = {entityId} | {ground:{x,z}}
//   SceneState.targetFrame { title, subtitle?, rows[{ id, label, value, progress?, muted? }] }
//   SceneState.highlight   { entityId?, ground?, color, opacity, radius }
//   pointerRules(pick, scene) → { kind: 'request' | 'designate' | 'clear' } | null
//
// **판정 방식** — spec 이 줄의 id 와 문구를 정하지 않았으므로, 단언은 "그 사실이 판 어딘가에
// 실렸는가" 로 한다: 줄의 label·value 를 이어 붙인 글에서 **의미 코드의 문구**(codeText)를 찾는다.
// 세 글자 이상이면 포함으로, 한두 글자면 토큰으로 찾는다 ('A' 같은 짧은 태그가 다른 말 속에서
// 우연히 걸리지 않도록). 문구가 아직 표에 없으면 codeText 가 코드를 그대로 주므로 어느 쪽이든 선다.
//
// 개수는 단언하지 않는다 — 다른 Cycle 이 줄을 더해도 깨지면 안 된다 (있음과 행동만 본다).

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot, RegionStateView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { pointerRules } from '../pointer-rules';
import { codeText } from '../code-text';
import { compileRegion } from '../../../engine/world-authoring/compile';
import { descriptionHash } from '../../../engine/world-authoring/description';
import { blockedReasonAt, isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { regionSpec } from '../../regions/index';
import {
  BLOCK_STEEP,
  BLOCK_WATER,
  CITY_TAG,
  COMPILE_RULES,
  CONDITION_RIDGE,
  CONDITION_RIVER,
  CONDITION_TREE,
  SETTLEMENT_LAYER,
  SURFACE_FLAT,
  SURFACE_STEEP,
  SURFACE_WET,
} from '../../regions/terrain-rules';
import { CELL_LAYER, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import whiteKingDomain from './fixtures/region-white-king-domain.fixture.json';

// ── 계약이 준 형 ──────────────────────────────────────────────────────
//
// spec 이 SceneState 에 는다고 말한 두 자리를 **글로 적힌 그대로** 여기 둔다.
// (engine 이 그 형을 세우면 같은 모양이 된다 — 이 파일은 그것을 읽지 않고 쓴다)

interface TargetFrameRow {
  id: string;
  label: string;
  value: string | number;
  progress?: number;
  muted?: boolean;
}

interface TargetFrame {
  title: string;
  subtitle?: string;
  rows: TargetFrameRow[];
}

interface Highlight {
  entityId?: string;
  ground?: { x: number; z: number };
  color: number;
  opacity: number;
  radius: number;
}

type Scene = SceneState & { targetFrame?: TargetFrame; highlight?: Highlight };

// ── 하네스 ────────────────────────────────────────────────────────────

const WHITE_KING = 'WHITE_KING_DOMAIN';
const MAZE = 'FANTASY_MAZE';

/** 그 방의 컴파일 결과 — 관찰자가 자기 Description 을 세계와 같은 규칙으로 읽은 것 (확정 12) */
function compiledWorld(regionId: string): CompiledWorldTerrain {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return compileRegion(spec.space, COMPILE_RULES).world;
}

function hashOf(regionId: string): string {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return descriptionHash(spec.space);
}

/** fixture 의 hash 를 내 Description 의 hash 로 채운다 — 세계와 같은 땅을 보는 상태 (region.spec.ts 선례) */
function withHash(fixture: GameViewSnapshot, hash?: string): GameViewSnapshot {
  return { ...fixture, region: { ...fixture.region, hash: hash ?? hashOf(fixture.region.id) } };
}

const civil = withHash(whiteKingDomain as GameViewSnapshot);

/**
 * 미로의 관찰 결과 — fixture 를 새로 두지 않고 손으로 짓는다 (region-c003.spec.ts 의 선례).
 * 봉투에 새로 실리는 것은 하나도 없다: C008 까지의 자리(region.state · hud)만 채운다.
 */
function mazeSnapshot(state?: RegionStateView, hash?: string): GameViewSnapshot {
  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: MAZE,
    region: { id: MAZE, hash: hash ?? hashOf(MAZE), ...(state ? { state } : {}) },
    standingConditions: [],
    observer: { id: 'observer-a', characterId: 'player', acknowledgedMark: 0 },
    entities: [
      {
        id: 'player',
        role: 'player-character',
        state: 'idle',
        kind: 'rabbit-swordsman',
        position: { x: -30, z: 30 },
      },
    ],
    interactions: [{ id: 'move', role: 'move-to', available: true }],
    hud: [
      { id: 'region.depth', kind: 'label', value: 'deep' },
      { id: 'world.time', kind: 'counter', value: 100 },
    ],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

const MAZE_STATE: RegionStateView = {
  pattern: 'DEFAULT',
  pressure: 60,
  pressureLimit: 120,
};

/** 지목 없이 본 화면 */
function look(snapshot: GameViewSnapshot): Scene {
  return resolvePresentation(snapshot) as Scene;
}

/** 자리를 지목하고 본 화면 — 관찰자가 쥔 값 하나만 더 넘긴다 (세계로는 아무것도 나가지 않는다) */
function designate(snapshot: GameViewSnapshot, x: number, z: number): Scene {
  return resolvePresentation(snapshot, undefined, {
    designation: { ground: { x, z } },
  } as Parameters<typeof resolvePresentation>[2]) as Scene;
}

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}

/** 줄들의 글 — label 과 value 를 각각 하나의 글로 본다 */
function rowTexts(scene: Scene): string[] {
  return frameOf(scene).rows.flatMap((row) => [String(row.label ?? ''), String(row.value ?? '')]);
}

/** 판 전체의 글 — 제목·부제까지 (어디인가 · 어긋남은 제목 쪽에 설 수 있다) */
function frameTexts(scene: Scene): string[] {
  const frame = frameOf(scene);
  return [frame.title ?? '', frame.subtitle ?? '', ...rowTexts(scene)];
}

/** 짧은 태그가 다른 말 속에서 우연히 걸리지 않도록 — 세 글자 이상은 포함, 아니면 토큰 */
function said(texts: readonly string[], needle: string): boolean {
  if (needle.length >= 3) return texts.some((text) => text.includes(needle));
  return texts.some((text) => text.split(/[^\p{L}\p{N}:._-]+/u).includes(needle));
}

/** 그 의미 코드가 판의 줄에 실렸는가 (문구 표를 거친다 — 미등록이면 코드 그대로 찾는다) */
const rowsSay = (scene: Scene, code: string): boolean => said(rowTexts(scene), codeText(code));
const frameSays = (scene: Scene, code: string): boolean => said(frameTexts(scene), codeText(code));

/** 조건에 맞는 첫 자리 — 좌표를 박아 두지 않는다 (데이터가 바뀌면 자리도 함께 옮겨 간다) */
function findPlace(
  world: CompiledWorldTerrain,
  match: (x: number, z: number, surface: string) => boolean,
): { x: number; z: number } {
  for (let iz = 0; iz < world.rows; iz++) {
    for (let ix = 0; ix < world.cols; ix++) {
      const x = world.extent.minX + ix * world.resolution;
      const z = world.extent.minZ + iz * world.resolution;
      const surface = world.surfaceTags[world.surface[iz * world.cols + ix] ?? 0] ?? '';
      if (match(x, z, surface)) return { x, z };
    }
  }
  throw new Error('그런 자리가 이 방에 없다 — 데이터가 바뀌었으면 조건을 함께 고쳐야 한다');
}

const WHITE_KING_WORLD = compiledWorld(WHITE_KING);
const MAZE_WORLD = compiledWorld(MAZE);

/** 평지이고 지나갈 수 있는 자리 */
const FLAT = findPlace(
  WHITE_KING_WORLD,
  (x, z, surface) => surface === SURFACE_FLAT && isTraversableAt(WHITE_KING_WORLD, x, z),
);
/** 젖었지만 걸어 다닐 수 있는 자리 — 물 밖의 물가 띠 */
const WET = findPlace(
  WHITE_KING_WORLD,
  (x, z, surface) => surface === SURFACE_WET && isTraversableAt(WHITE_KING_WORLD, x, z),
);
/** 급경사로 막힌 자리 */
const STEEP = findPlace(
  WHITE_KING_WORLD,
  (x, z) => blockedReasonAt(WHITE_KING_WORLD, x, z) === BLOCK_STEEP,
);
/** 물로 막힌 자리 */
const WATER = findPlace(
  WHITE_KING_WORLD,
  (x, z) => blockedReasonAt(WHITE_KING_WORLD, x, z) === BLOCK_WATER,
);
/** 도시이면서 조건도 걸린 자리 — 겹친 것이 전부 실리는가를 보는 자리 */
const CITY = findPlace(WHITE_KING_WORLD, (x, z) => {
  const tags = tagsAt(WHITE_KING_WORLD, x, z, SETTLEMENT_LAYER);
  return tags.includes(CITY_TAG) && tags.length >= 2;
});
/** 아무 area 에도 걸리지 않은 자리 */
const BARE = findPlace(
  WHITE_KING_WORLD,
  (x, z) => tagsAt(WHITE_KING_WORLD, x, z, SETTLEMENT_LAYER).length === 0,
);

/** 미로 — 구역 A 의 한가운데(통로 밖)와 A|B 통로 위 */
const CELL_A_CENTER = { x: -20, z: 20 };
const PASSAGE_AB = { x: 0, z: 20 };

const SETTLEMENT_TAGS = [CONDITION_RIDGE, CONDITION_RIVER, CONDITION_TREE, CITY_TAG];

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-001 지목하면 판이 선다', () => {
  it('S-001 방 안의 한 점을 지목하면 그 자리를 제목으로 하는 판 하나가 서고 사실이 줄로 실린다', () => {
    // Given 백왕령에 선 관찰자 / When 평지 한 점을 지목한다
    const scene = designate(civil, FLAT.x, FLAT.z);
    // Then 판이 서고 제목이 있고 줄이 있다 (개수는 묻지 않는다 — 있음만 본다)
    expect(scene.targetFrame).toBeDefined();
    expect(typeof frameOf(scene).title).toBe('string');
    expect(frameOf(scene).title.length).toBeGreaterThan(0);
    expect(frameOf(scene).rows.length).toBeGreaterThan(0);
    // 줄마다 부를 이름과 읽을 값이 있다
    for (const row of frameOf(scene).rows) {
      expect(typeof row.id).toBe('string');
      expect(row.id.length).toBeGreaterThan(0);
      expect(row.value === undefined).toBe(false);
    }
  });

  // C027 CHANGED — 이 둘이 재던 "판이 없다" 는 C027 SPEC-005 가 갈아엎었다: 지목이 없으면
  // 판은 **내가 선 자리**를 진다. 남는 주장은 "지목한 것의 판이 아니다" 와 "표식이 없다" 이고,
  // 그것이 이 Cycle 의 경계였다 — 세계 위에 아무도 지목하지 않은 자국이 남지 않는 것.
  it('S-002 (경계) 지목하지 않았으면 지목의 표식이 없다', () => {
    // Given 같은 화면 / When 아무것도 지목하지 않는다
    const scene = look(civil);
    // Then 세계 위에 표식이 없다 — 아무도 지목하지 않은 자리를 표시하면 그것이 거짓말이다
    expect(scene.highlight).toBeUndefined();
    // 그리고 판이 서더라도 그것은 **지목한 자리**의 판이 아니다 (C027 SPEC-005)
    expect(scene.targetFrame?.title).not.toBe(designate(civil, FLAT.x, FLAT.z).targetFrame?.title);
  });

  it('S-003 (경계) 지목을 풀면 지목한 것의 판과 표식이 사라진다', () => {
    // Given 지목해 판이 선 상태 / When 지목을 놓고 같은 봉투를 다시 읽는다
    const designated = designate(civil, FLAT.x, FLAT.z);
    expect(designated.targetFrame).toBeDefined();
    const cleared = resolvePresentation(civil, undefined, {} as Parameters<
      typeof resolvePresentation
    >[2]) as Scene;
    // Then 표식이 없고, 판은 지목했을 때의 그 판이 아니다
    expect(cleared.highlight).toBeUndefined();
    expect(cleared.targetFrame?.subtitle).not.toBe(designated.targetFrame?.subtitle);
  });

  it('S-004 내가 누른 자리가 세계 안에서 강조된다 — 누른 것과 판이 말하는 것이 같은 자리다', () => {
    // Given / When 젖은 자리 하나를 지목한다
    const scene = designate(civil, WET.x, WET.z);
    // Then 강조 지시가 그 좌표를 가리킨다 (Observable Result ②)
    expect(scene.highlight).toBeDefined();
    expect(scene.highlight!.ground).toEqual({ x: WET.x, z: WET.z });
    expect(typeof scene.highlight!.color).toBe('number');
    expect(scene.highlight!.opacity).toBeGreaterThan(0);
    expect(scene.highlight!.radius).toBeGreaterThan(0);
  });

  it('S-005 (경계) 판은 자판을 잡지 않는다 — 겹쳐 뜨는 표면이 열리지 않는다', () => {
    // Given / When 지목한다
    const before = look(civil);
    const after = designate(civil, FLAT.x, FLAT.z);
    // Then 열린 표면(SceneSurface)의 수가 늘지 않는다 — 판은 늘 떠 있는 원소다 (E3)
    const open = (scene: Scene) => scene.surfaces.filter((surface) => surface.open).length;
    expect(open(after)).toBe(open(before));
  });
});

describe('SPEC-002 땅이 어떤지 말한다', () => {
  it('S-006 평지를 지목하면 표면이 실리고 막힘 사유는 실리지 않는다', () => {
    // Given 지날 수 있는 평지 / When 지목한다
    const scene = designate(civil, FLAT.x, FLAT.z);
    // Then 표면이 실리고, 막을 이유가 없으므로 사유가 없다
    expect(rowsSay(scene, SURFACE_FLAT)).toBe(true);
    expect(rowsSay(scene, BLOCK_STEEP)).toBe(false);
    expect(rowsSay(scene, BLOCK_WATER)).toBe(false);
  });

  it('S-007 젖은 자리를 지목하면 표면이 젖음으로 실린다', () => {
    const scene = designate(civil, WET.x, WET.z);
    expect(rowsSay(scene, SURFACE_WET)).toBe(true);
  });

  it('S-008 급경사를 지목하면 걸어가기 전에 못 지나가는 사유가 읽힌다', () => {
    // Given 세계가 막는 자리 (blockedReasonAt = too-steep)
    expect(blockedReasonAt(WHITE_KING_WORLD, STEEP.x, STEEP.z)).toBe(BLOCK_STEEP);
    // When 지목한다 / Then 사유가 판에 선다 (Observable Result ③)
    const scene = designate(civil, STEEP.x, STEEP.z);
    expect(rowsSay(scene, BLOCK_STEEP)).toBe(true);
  });

  it('S-009 강을 지목하면 물의 사유가 실린다 — 급경사와 다른 말이다', () => {
    const scene = designate(civil, WATER.x, WATER.z);
    expect(rowsSay(scene, BLOCK_WATER)).toBe(true);
    // 두 사유가 한 판에서 섞이지 않는다 — 무엇이 막았는지가 갈린다
    expect(rowsSay(scene, BLOCK_STEEP)).toBe(false);
  });

  it('S-010 (경계) 지목해서 얻은 답과 걸어가서 얻은 답이 같다 — 둘이 같은 함수를 같은 데이터로 부른다', () => {
    // Given 방을 고르게 훑는 표본 (격자 전체를 stride 로 샘플한다)
    const stride = 7;
    let blocked = 0;
    let open = 0;
    for (let iz = 0; iz < WHITE_KING_WORLD.rows; iz += stride) {
      for (let ix = 0; ix < WHITE_KING_WORLD.cols; ix += stride) {
        const x = WHITE_KING_WORLD.extent.minX + ix * WHITE_KING_WORLD.resolution;
        const z = WHITE_KING_WORLD.extent.minZ + iz * WHITE_KING_WORLD.resolution;
        // When 그 자리를 지목한다
        const scene = designate(civil, x, z);
        // Then 이동 규칙이 그 점에 대해 내리는 판정과 판의 줄이 어긋나지 않는다
        const reason = blockedReasonAt(WHITE_KING_WORLD, x, z);
        for (const code of [BLOCK_STEEP, BLOCK_WATER]) {
          expect({ x, z, code, said: rowsSay(scene, code) }).toEqual({
            x,
            z,
            code,
            said: reason === code,
          });
        }
        if (reason === null) open++;
        else blocked++;
      }
    }
    // 표본이 두 경우를 모두 담았는지 — 담지 않았으면 위의 대조는 아무것도 재지 않은 것이다
    expect(blocked).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(0);
  });
});

describe('SPEC-003 무엇이 걸렸는지 말한다', () => {
  it('S-011 도시 자리를 지목하면 걸린 area 태그가 전부 실린다 — 하나로 줄이지 않는다', () => {
    // Given 도시이면서 조건도 걸린 자리
    const tags = tagsAt(WHITE_KING_WORLD, CITY.x, CITY.z, SETTLEMENT_LAYER);
    expect(tags.length).toBeGreaterThanOrEqual(2);
    // When 지목한다 / Then 걸린 것이 전부 실린다 (C006 safe-by 와 같은 규율)
    const scene = designate(civil, CITY.x, CITY.z);
    for (const tag of tags) {
      expect({ tag, said: rowsSay(scene, tag) }).toEqual({ tag, said: true });
    }
  });

  it('S-012 미로의 구역과 통로가 실리고, 통로는 지금 열려 있는지도 함께 실린다', () => {
    // Given A|B 통로 위의 한 점 — 구역 둘과 통로 하나가 걸린다
    expect(tagsAt(MAZE_WORLD, PASSAGE_AB.x, PASSAGE_AB.z, CELL_LAYER)).toEqual(['A', 'B']);
    expect(tagsAt(MAZE_WORLD, PASSAGE_AB.x, PASSAGE_AB.z, PASSAGE_LAYER)).toEqual(['AB']);

    // When 그 점을 지목한다 (지금 패턴은 DEFAULT — AB 가 열려 있다)
    const opened = designate(mazeSnapshot(MAZE_STATE), PASSAGE_AB.x, PASSAGE_AB.z);
    // Then 걸린 구역이 **전부** 실린다 — 둘 중 하나로 줄이지 않는다
    for (const tag of ['A', 'B']) {
      expect({ tag, said: rowsSay(opened, tag) }).toEqual({ tag, said: true });
    }

    // And 통로의 지금 열림이 함께 실린다 — 패턴이 P1 이면 같은 자리의 답이 달라진다.
    // (통로의 답이 판에 없으면 두 글이 같아지므로, 이 대조가 곧 그 줄의 존재 증명이다.
    //  통로 태그의 **이름**(AB)까지 적을 것인가는 spec 이 정하지 않았다 — 표현의 결정이므로
    //  여기서 강요하지 않고 TODO 의 감사 항목으로 넘긴다)
    const closed = designate(
      mazeSnapshot({ ...MAZE_STATE, pattern: 'P1' }),
      PASSAGE_AB.x,
      PASSAGE_AB.z,
    );
    expect(rowTexts(closed).join('\n')).not.toBe(rowTexts(opened).join('\n'));
  });

  it('S-013 (경계) 아무 area 에도 걸리지 않은 점이면 그 목록이 비어 있다', () => {
    // Given 조건에도 도시에도 들지 않는 자리
    expect(tagsAt(WHITE_KING_WORLD, BARE.x, BARE.z, SETTLEMENT_LAYER)).toEqual([]);
    // When 지목한다 / Then 어떤 area 태그도 실리지 않는다 (없는 것을 지어내지 않는다)
    const scene = designate(civil, BARE.x, BARE.z);
    for (const tag of SETTLEMENT_TAGS) {
      expect({ tag, said: rowsSay(scene, tag) }).toEqual({ tag, said: false });
    }
  });
});

describe('SPEC-004 규칙을 품은 방이면 그 State 도 말한다', () => {
  it('S-014 미로 안의 점을 지목하면 그 방의 지금 State 가 실린다 — 값은 봉투의 region.state 다', () => {
    // Given 규칙을 품은 방의 봉투 (pattern DEFAULT · pressure 60 / 120)
    const scene = designate(mazeSnapshot(MAZE_STATE), CELL_A_CENTER.x, CELL_A_CENTER.z);
    // Then 패턴이 실린다
    expect(rowsSay(scene, MAZE_STATE.pattern)).toBe(true);
    // And 압력도 실린다 — 숫자로 적히거나 채움(progress)으로 실린다
    const asNumber = said(rowTexts(scene), String(MAZE_STATE.pressure));
    const asProgress = frameOf(scene).rows.some(
      (row) =>
        row.progress !== undefined &&
        Math.abs(row.progress - MAZE_STATE.pressure / MAZE_STATE.pressureLimit) < 0.01,
    );
    expect(asNumber || asProgress).toBe(true);
  });

  it('S-015 (경계) 규칙을 품지 않은 방에서는 그 줄이 아예 없다 — 0 으로 지어내지 않는다', () => {
    // Given 규칙 없는 방(백왕령) — 봉투에 region.state 자리가 없다
    expect((civil.region as { state?: unknown }).state).toBeUndefined();
    // When 지목한다 / Then 패턴도 압력도 실리지 않는다 (C008 SPEC-007 과 같은 경계)
    const scene = designate(civil, FLAT.x, FLAT.z);
    expect(rowsSay(scene, MAZE_STATE.pattern)).toBe(false);
    expect(said(rowTexts(scene), String(MAZE_STATE.pressureLimit))).toBe(false);
  });

  it('S-016 (경계) 같은 방이라도 State 가 실려 오지 않으면 그 줄만 빠진다', () => {
    // Given 같은 방 · 같은 점 — 봉투에 state 가 있는 것과 없는 것
    const withState = designate(mazeSnapshot(MAZE_STATE), CELL_A_CENTER.x, CELL_A_CENTER.z);
    const without = designate(mazeSnapshot(), CELL_A_CENTER.x, CELL_A_CENTER.z);
    // Then State 없는 판의 줄은 있는 판의 줄에 포함된다 — 없어진 것은 규칙 줄뿐이다
    const ids = (scene: Scene) => frameOf(scene).rows.map((row) => row.id);
    for (const id of ids(without)) expect(ids(withState)).toContain(id);
    // And 규칙 줄은 State 가 있을 때만 선다
    expect(ids(withState).filter((id) => !ids(without).includes(id)).length).toBeGreaterThan(0);
    expect(rowsSay(without, MAZE_STATE.pattern)).toBe(false);
  });
});

describe('SPEC-005 지어내지 않는다', () => {
  /** 세계가 다른 땅을 보고 있다 — hash 만 어긋나게 둔 봉투 */
  const mismatched = withHash(whiteKingDomain as GameViewSnapshot, 'ffffffff');

  it('S-017 hash 가 어긋나면 어긋났다는 사실을 판에 적는다', () => {
    // Given 봉투의 hash 가 내 Description 의 hash 와 다르다
    expect(mismatched.region.hash).not.toBe(hashOf(WHITE_KING));
    // When 지목한다 / Then 판이 서고 어긋남이 적힌다 (C001 의 코드를 그대로 쓴다)
    const scene = designate(mismatched, STEEP.x, STEEP.z);
    expect(scene.targetFrame).toBeDefined();
    expect(frameSays(scene, 'region.hash-mismatch')).toBe(true);
  });

  it('S-018 hash 가 어긋나면 땅에서 유도한 줄을 답으로 내놓지 않는다', () => {
    // Given 같은 어긋난 봉투 / When 세계가 막는 자리를 지목한다
    const scene = designate(mismatched, STEEP.x, STEEP.z);
    // Then 표면도 사유도 답으로 서지 않는다 — 내 땅에서 유도한 것이기 때문이다
    expect(rowsSay(scene, SURFACE_STEEP)).toBe(false);
    expect(rowsSay(scene, BLOCK_STEEP)).toBe(false);
  });

  it('S-019 (경계) hash 가 같으면 그 줄들이 정상으로 선다', () => {
    const scene = designate(civil, STEEP.x, STEEP.z);
    expect(rowsSay(scene, BLOCK_STEEP)).toBe(true);
    expect(frameSays(scene, 'region.hash-mismatch')).toBe(false);
  });

  it('S-020 (경계) 모르는 코드는 코드 그대로 뜨고 문구를 지어내지 않는다', () => {
    const unknown = 'c026-test:no-such-code';
    expect(codeText(unknown)).toBe(unknown);
  });
});

describe('SPEC-006 지목은 세계에 아무것도 보내지 않는다', () => {
  const scene = look(civil);

  /**
   * 무엇이 지목을 뜻하는가는 이 Cycle 이 정하는 **입력의 결정**이다 (spec UNRESOLVED "지목의 입력").
   * 그래서 이 테스트는 그 결정을 짚지 않고, 지목을 뜻할 법한 집기들을 늘어놓아 그중 하나가
   * 'designate' 로 읽히는지만 본다 — 무엇이 골라지든 **요청이 아니어야 한다**가 여기서 재는 것이다.
   */
  const designatePicks = () => {
    const ground = { x: FLAT.x, z: FLAT.z };
    const none = { alt: false, shift: false, ctrl: false, meta: false };
    return [
      { entityId: null, ground, modifiers: { ...none, alt: true } },
      { entityId: null, ground, modifiers: { ...none, shift: true } },
      { entityId: null, ground, modifiers: { ...none, ctrl: true } },
      { entityId: null, ground, modifiers: { ...none, meta: true } },
      { entityId: null, ground, modifiers: none, button: 2 },
      { entityId: null, ground, modifiers: none, doubleClick: true },
      { entityId: null, ground, modifiers: none, designate: true },
    ].map((pick) => pick as unknown as Parameters<typeof pointerRules>[0]);
  };

  it('S-021 지목을 뜻하는 집기는 요청이 아니라 지목이다', () => {
    const kinds = designatePicks().map((pick) => pointerRules(pick, scene)?.kind);
    expect(kinds).toContain('designate');
  });

  it('S-022 (경계) 지목으로 읽힌 집기는 요청 몸통을 만들지 않는다 — 나갈 것이 없다', () => {
    for (const pick of designatePicks()) {
      const result = pointerRules(pick, scene);
      if (result?.kind !== 'designate') continue;
      expect(JSON.stringify(result)).not.toContain('interactionId');
    }
  });

  it('S-023 여러 번 지목하고 풀어도 봉투가 한 자리도 달라지지 않는다', () => {
    // Given 미로의 봉투 (규칙을 품은 방 — 압력이 오를 수 있는 곳이다)
    const snapshot = mazeSnapshot(MAZE_STATE);
    const before = JSON.stringify(snapshot);
    // When 여러 자리를 지목하고 푼다
    designate(snapshot, CELL_A_CENTER.x, CELL_A_CENTER.z);
    designate(snapshot, PASSAGE_AB.x, PASSAGE_AB.z);
    look(snapshot);
    // Then 봉투도, 그 안의 압력도 그대로다 — 지목은 이동이 아니다 (SPEC-006 경계)
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(snapshot.region.state?.pressure).toBe(MAZE_STATE.pressure);
  });

  it('S-024 (경계) 다른 관찰자의 화면에는 아무 일도 일어나지 않는다', () => {
    // Given 같은 봉투를 보는 둘 — 하나는 지목하고 하나는 하지 않는다
    const snapshot = mazeSnapshot(MAZE_STATE);
    const otherBefore = look(snapshot);
    designate(snapshot, PASSAGE_AB.x, PASSAGE_AB.z);
    const otherAfter = look(snapshot);
    // Then 지목하지 않은 쪽의 화면은 한 자리도 다르지 않다 (지목은 관찰자가 쥔다 — 확정 7)
    expect(otherAfter).toEqual(otherBefore);
    // C027 CHANGED — 그쪽에도 판은 선다(자기 발밑). 남는 주장은 **표식이 없다** 는 것이다
    expect(otherAfter.highlight).toBeUndefined();
  });

  it.todo(
    'GAP: 실제로 세계로 나간 패킷이 0 인가 — 소켓(app/server)이 필요하다. 여기서는 봉투 불변만 잰다',
  );
});

/**
 * C011 — 백왕령에는 캘 것이 없다 (숲의 재료 계통이 유입되지 않는 방이다). 그래서 "원천을
 * 집으면 채취 요청이 된다" 를 재려면 그 존재를 손으로 얹는다 — 재는 것은 클릭의 뜻이지
 * 백왕령의 데이터가 아니다 (mazeSnapshot 을 손으로 짓는 것과 같은 어법).
 */
const withSource = (snapshot: GameViewSnapshot): GameViewSnapshot => ({
  ...snapshot,
  entities: [
    ...snapshot.entities,
    {
      id: 'MOLT_LITTER',
      role: 'resource-source',
      state: 'available',
      kind: 'molt-litter',
      material: 'ORE_EATER_MOLT',
      position: { x: 8, z: -6 },
    },
  ],
  interactions: [
    ...snapshot.interactions,
    { id: 'mine', role: 'harvest-source', targetEntityId: 'MOLT_LITTER', available: true },
  ],
});

describe('SPEC-007 클릭의 뜻은 정책이 정한다', () => {
  const scene = look(withSource(civil));

  /** 보조키 없이 그냥 누른 것 — C008 까지의 클릭 그대로다 */
  const pick = (over: Record<string, unknown>) =>
    ({
      entityId: null,
      ground: null,
      modifiers: { alt: false, shift: false, ctrl: false, meta: false },
      ...over,
    }) as unknown as Parameters<typeof pointerRules>[0];

  it('S-025 빈 땅을 클릭하면 이동 요청이 된다 — C008 까지와 같다', () => {
    const result = pointerRules(pick({ ground: { x: FLAT.x, z: FLAT.z } }), scene);
    expect(result?.kind).toBe('request');
    // 옛 규칙이 만들던 것과 같은 요청이다 (terrainTarget 인 interaction · 그 좌표)
    expect(JSON.stringify(result)).toContain('"interactionId":"move"');
    expect(JSON.stringify(result)).toContain('"x"');
  });

  it('S-026 원천을 클릭하면 채취 요청이 된다 — C008 까지와 같다', () => {
    const result = pointerRules(pick({ entityId: 'MOLT_LITTER' }), scene);
    expect(result?.kind).toBe('request');
    expect(JSON.stringify(result)).toContain('"interactionId":"mine"');
    expect(JSON.stringify(result)).toContain('"targetEntityId":"MOLT_LITTER"');
  });

  it('S-027 출구 표식을 클릭하면 건너기 요청이 된다 — C008 까지와 같다', () => {
    const result = pointerRules(pick({ entityId: 'FOREST_PATH' }), scene);
    expect(result?.kind).toBe('request');
    expect(JSON.stringify(result)).toContain('"interactionId":"transit"');
    expect(JSON.stringify(result)).toContain('"targetEntityId":"FOREST_PATH"');
  });

  it.todo(
    'GAP: 정책을 주지 않으면 Engine 이 아무 요청도 만들지 않는가 — attachInput 은 브라우저 DOM(클릭 이벤트)이 있어야 돈다',
  );
});

describe('SPEC-008 세계 위에 늘 떠 있는 글자가 없다', () => {
  it('S-028 백왕령(조건 셋 + 도시)의 지면 구역 어느 것에도 이름표가 실리지 않는다', () => {
    const scene = look(civil);
    expect(scene.zones.length).toBeGreaterThan(0);
    for (const zone of scene.zones) {
      expect({ id: zone.id, label: zone.label }).toEqual({ id: zone.id, label: undefined });
    }
  });

  it('S-029 환상의 미로(구역 넷 + 통로 여섯)도 마찬가지다 — 자리와 색과 경계만 남는다', () => {
    const scene = look(mazeSnapshot(MAZE_STATE));
    expect(scene.zones.length).toBeGreaterThan(0);
    for (const zone of scene.zones) {
      expect({ id: zone.id, label: zone.label }).toEqual({ id: zone.id, label: undefined });
    }
  });

  it('S-030 (경계) 구역 자체는 그대로 그려진다 — 걷어낸 것은 글자이지 구역이 아니다', () => {
    // 백왕령 — 방 바닥과 settlement 구역이 여전히 선다
    const civilZones = look(civil).zones;
    expect(civilZones[0]?.id).toBe(`region:${WHITE_KING}`);
    expect(civilZones.some((zone) => zone.id.startsWith('settlement:'))).toBe(true);
    // 미로 — 구역과 통로가 여전히 선다
    const mazeZones = look(mazeSnapshot(MAZE_STATE)).zones;
    expect(mazeZones.some((zone) => zone.id.startsWith('cell:'))).toBe(true);
    expect(mazeZones.some((zone) => zone.id.startsWith('passage:'))).toBe(true);
    // 색과 경계도 그대로다 — 채움이나 테두리 중 하나는 반드시 있다
    for (const zone of [...civilZones, ...mazeZones]) {
      expect({ id: zone.id, drawn: !!(zone.fill || zone.edge) }).toEqual({ id: zone.id, drawn: true });
    }
  });
});

describe('SPEC-009 판은 판일 뿐이다', () => {
  it('S-031 판이 서 있어도 몸을 움직이고 시점을 도는 길이 그대로다', () => {
    // Given / When 판이 선 화면과 서지 않은 화면
    const before = look(civil);
    const after = designate(civil, FLAT.x, FLAT.z);
    // Then 자판이 읽는 자리들이 한 자리도 달라지지 않는다 — 판은 초점을 붙잡지 않는다
    expect(after.interactions).toEqual(before.interactions);
    expect(after.keyHints).toEqual(before.keyHints);
    expect(after.slotBars).toEqual(before.slotBars);
    expect(after.commandSurface).toEqual(before.commandSurface);
  });

  it.todo('GAP: Escape 가 판을 풀고, 판이 없을 때의 Escape 는 지금까지와 같은가 — 지목을 쥐는 것은 조립(app)이고 실제 키 입력이 필요하다');
});

describe('SPEC-010 방 이름은 지나간다', () => {
  it.todo('GAP: 방을 건너 들어서면 그 방의 이름이 한 번 뜨고 사라지는가 — 진입 제목은 SceneState 에 실리지 않는다 (조립이 쥔 이전 방 id 가 필요하다)');
  it.todo('GAP: (경계) 같은 방에 머무는 동안 다시 뜨지 않고 방을 옮기면 다시 한 번 뜨는가 — 같은 이유로 조립 층의 것이다');
});

describe('회귀', () => {
  it('R-001 클릭 셋(빈 땅 이동 · 원천 채취 · 출구 건너기)이 옛 규칙과 같은 요청을 만든다', () => {
    // Given C008 까지의 규칙 — 집은 존재의 첫 interaction, 없으면 terrainTarget 인 interaction
    const scene = look(withSource(civil));
    const legacy = (entityId: string | null, ground: { x: number; z: number } | null) => {
      if (entityId) {
        const interaction = scene.interactions.find((i) => i.targetEntityId === entityId);
        if (interaction) return { interactionId: interaction.id, targetEntityId: entityId };
      }
      if (ground) {
        const terrain = scene.interactions.find((i) => i.terrainTarget);
        if (terrain) return { interactionId: terrain.id, position: ground };
      }
      return null;
    };

    const cases: { entityId: string | null; ground: { x: number; z: number } | null }[] = [
      { entityId: null, ground: { x: FLAT.x, z: FLAT.z } },
      { entityId: 'MOLT_LITTER', ground: null },
      { entityId: 'FOREST_PATH', ground: null },
    ];

    for (const one of cases) {
      const expected = legacy(one.entityId, one.ground)!;
      const pick = {
        ...one,
        modifiers: { alt: false, shift: false, ctrl: false, meta: false },
      } as unknown as Parameters<typeof pointerRules>[0];
      const result = pointerRules(pick, scene);
      // Then 뜻은 요청이고, 그 요청은 옛 규칙이 만들던 것과 같다
      expect({ case: one, kind: result?.kind }).toEqual({ case: one, kind: 'request' });
      const json = JSON.stringify(result);
      expect(json).toContain(`"interactionId":"${expected.interactionId}"`);
      if (expected.targetEntityId) expect(json).toContain(`"targetEntityId":"${expected.targetEntityId}"`);
      if (expected.position) expect(json).toContain(`"z":${expected.position.z}`);
    }
  });

  it('R-002 C008 의 통로 색과 맥동이 그대로다 — 걷어낸 것은 이름표뿐이다', () => {
    // Given 재배열 직후의 미로 (world.time 100 · rearrangedAt 100)
    const snapshot = mazeSnapshot({ ...MAZE_STATE, rearrangedAt: 100 });
    const zones = look(snapshot).zones.filter((zone) => zone.id.startsWith('passage:'));
    expect(zones.length).toBeGreaterThan(0);
    // Then 열린 통로와 닫힌 통로의 테두리 색이 갈리고, 방금 바뀐 통로는 맥동한다
    expect(new Set(zones.map((zone) => zone.edge?.color)).size).toBeGreaterThan(1);
    expect(zones.every((zone) => zone.intensity !== undefined)).toBe(true);
  });

  it('R-003 지목은 판과 표식 말고 화면의 어떤 자리도 건드리지 않는다', () => {
    const strip = (scene: Scene) => {
      const { targetFrame, highlight, ...rest } = scene;
      void targetFrame;
      void highlight;
      return rest;
    };
    expect(strip(designate(civil, WET.x, WET.z))).toEqual(strip(look(civil)));
    const maze = mazeSnapshot(MAZE_STATE);
    expect(strip(designate(maze, PASSAGE_AB.x, PASSAGE_AB.z))).toEqual(strip(look(maze)));
  });
});
