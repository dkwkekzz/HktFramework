// C011 — 흔적이 원천으로 데려간다 · 화면 쪽 검증 시나리오 (spec SPEC-008 · SPEC-009)
//
// 이 Cycle 의 화면 몫은 둘이다.
//   ⑧ 세계 위에 재료의 **글자가 없다** — 원천 위에 이름표도 수량도 없고 지면 구역에도 이름이 없다.
//      그러면서 원천의 **그림 자체는** 그 자리에 선다 (그것은 표식이 아니라 실물이다).
//   ⑨ 물으면 답한다 — 원천을 지목하면 판에 그 종류가 서고, 그 대상이 주는 행동(채취)이 서며,
//      걸 수 없으면 사유가 그 자리에 있다. 풀면 판은 내 몸으로 돌아간다 (C027 그대로).
//
// 그리고 **흔적을 화면이 지면에 그리는가**도 여기서 본다 — 흔적은 관찰 결과에 실리지 않고
// 관찰자가 자기 content/regions 를 컴파일해 스스로 얻는다 (spec Observable · C005~C007 의 규율).
// 그래서 기대값의 원본은 그 방 Description 의 trace layer area 다.
//
// 이 파일은 이 Cycle 이 새로 쓴 화면 코드를 **읽지 않고** 쓴다 (c026 · c027 의 선례).
// 아는 것은 spec 이 준 계약뿐이다:
//   resolvePresentation(snapshot, motions?, { designation })  designation = {entityId} | {ground:{x,z}}
//   SceneState.targetFrame { title, subtitle?, rows[{ id, label, value, progress?, muted? }] }
//   SceneState.zones[]     { id, shape, fill?, edge?, label? }
//   SceneEntity            { id, spriteId, position, label?, nameplate? }
//
// **판정 방식** — spec 이 줄의 id 와 문구를 정하지 않았으므로 "그 사실이 판 어딘가에 실렸는가" 로 잰다:
// 줄의 label·value 를 이어 붙인 글에서 의미 코드의 문구(codeText)를 찾는다 (C026 · C027 하네스 그대로).
// 문구를 모르는 자리는 **차이로** 잰다 — 같은 봉투에서 한 가지만 바꾼 두 판의 줄 집합을 견준다.
//
// 개수는 단언하지 않는다 — 다른 Cycle 이 줄을 더해도 깨지면 안 된다 (있음과 행동만 본다).

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { codeText } from '../code-text';
import { compileRegion } from '../../../engine/world-authoring/compile';
import { areasOf, descriptionHash, pointsOf } from '../../../engine/world-authoring/description';
import { isTraversableAt } from '../../../engine/world-authoring/query';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { regionSpec } from '../../regions/index';
import { COMPILE_RULES } from '../../regions/terrain-rules';
import {
  BIO_ORE,
  FORM_ROOT_NODULE,
  RESOURCE_LAYER,
  TRACE_LAYER,
  soilStainLevel,
} from '../../regions/resource-ecology';

// ── 계약이 준 형 (C026 · C027 이 적어 둔 그대로) ──────────────────────

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

// ── 방과 데이터 ───────────────────────────────────────────────────────
//
// 붉은 눈의 거목 — 원천 하나(뿌리혹)와 흔적 둘(바닥 3 · 둘레 5)이 있는 방이다.
// 백왕령은 이 계통이 하나도 닿지 않은 방 (SPEC-007) — 견주는 자리로 쓴다.

const RED_EYE_TREE = 'RED_EYE_TREE';
const WHITE_KING = 'WHITE_KING_DOMAIN';
const ROOT_NODULE = 'ROOT_NODULE';

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

const spaceOf = (regionId: string) => regionSpec(regionId)!.space;

/** 원천이 서야 할 자리 — 그 방 Description 의 resource point 가 소유한다 (좌표를 적지 않는다) */
const NODULE_AT = pointsOf(spaceOf(RED_EYE_TREE), RESOURCE_LAYER).find(
  (p) => p.tag === ROOT_NODULE,
)!.position;

/** 흔적 구역들 — 화면이 그려야 할 것의 원본 */
const TRACE_AREAS = areasOf(spaceOf(RED_EYE_TREE), TRACE_LAYER);

const TREE_WORLD = compiledWorld(RED_EYE_TREE);

/** 원천에서 떨어진, 지나갈 수 있는 자리 하나 — 내 몸이 설 자리 */
function farStandingSpot(): { x: number; z: number } {
  let best: { x: number; z: number } | undefined;
  let bestDistance = -1;
  for (let iz = 0; iz < TREE_WORLD.rows; iz++) {
    for (let ix = 0; ix < TREE_WORLD.cols; ix++) {
      const x = TREE_WORLD.extent.minX + ix * TREE_WORLD.resolution;
      const z = TREE_WORLD.extent.minZ + iz * TREE_WORLD.resolution;
      if (!isTraversableAt(TREE_WORLD, x, z)) continue;
      const distance = Math.hypot(x - NODULE_AT.x, z - NODULE_AT.z);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = { x, z };
      }
    }
  }
  if (!best) throw new Error('거목의 방에 설 자리가 없다');
  return best;
}

const ME_AT = farStandingSpot();

// ── 봉투 (손으로 짓는다 — c027 의 선례) ───────────────────────────────

const ME: EntityView = {
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: ME_AT.x, z: ME_AT.z },
};

/** 뿌리혹 — 관찰 계약이 싣는다고 한 여섯 자리만 채운다 (남은 양도 이름표도 없다) */
const NODULE: EntityView = {
  id: ROOT_NODULE,
  role: 'resource-source',
  state: 'available',
  kind: FORM_ROOT_NODULE,
  material: BIO_ORE,
  position: { x: NODULE_AT.x, z: NODULE_AT.z },
};

const MOVE: InteractionView = { id: 'move', role: 'move-to', available: true };

/** 지금은 멀어서 걸 수 없는 채취 — 사유가 판에 실리는지 보는 자리 */
const HARVEST_FAR: InteractionView = {
  id: 'mine',
  role: 'harvest-source',
  targetEntityId: ROOT_NODULE,
  available: false,
  reason: 'out-of-range',
};

/** 걸 수 있는 채취 */
const HARVEST_READY: InteractionView = {
  id: 'mine',
  role: 'harvest-source',
  targetEntityId: ROOT_NODULE,
  available: true,
};

/** 내 몸의 것 — 아직 아무것도 캐지 않았으므로 재료 자리가 없다 (SPEC-010) */
const SELF_HUD = [
  { id: 'tool.hasMiningTool', kind: 'flag' as const, value: true },
  { id: 'player.action', kind: 'label' as const, value: 'idle' },
  { id: 'world.time', kind: 'counter' as const, value: 100 },
  { id: 'observers.present', kind: 'counter' as const, value: 1 },
];

interface Made {
  region?: string;
  entities?: EntityView[];
  interactions?: InteractionView[];
  hud?: GameViewSnapshot['hud'];
}

function made(options: Made = {}): GameViewSnapshot {
  const region = options.region ?? RED_EYE_TREE;
  return {
    specId: 'VIEW-BASIC-COMBAT-POLICY-001',
    scene: region,
    region: { id: region, hash: hashOf(region) },
    standingConditions: [],
    observer: { id: 'observer-a', characterId: ME.id, acknowledgedMark: 0 },
    entities: options.entities ?? [ME, NODULE],
    interactions: options.interactions ?? [MOVE, HARVEST_FAR],
    hud: options.hud ?? [{ id: 'region.depth', kind: 'label', value: 'deep' }, ...SELF_HUD],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

// ── 화면 만들기 (c027 의 선례 그대로) ─────────────────────────────────

type Designation = { entityId: string } | { ground: { x: number; z: number } };

function resolveWith(snapshot: GameViewSnapshot, designation?: Designation): Scene {
  return resolvePresentation(snapshot, undefined, {
    ...(designation ? { designation } : {}),
  } as Parameters<typeof resolvePresentation>[2]) as Scene;
}

const look = (snapshot: GameViewSnapshot): Scene => resolveWith(snapshot);
const point = (snapshot: GameViewSnapshot, entityId: string): Scene =>
  resolveWith(snapshot, { entityId });

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}

const rowsOf = (scene: Scene): TargetFrameRow[] => frameOf(scene).rows;

function rowTexts(scene: Scene): string[] {
  return rowsOf(scene).flatMap((row) => [String(row.label ?? ''), String(row.value ?? '')]);
}

function frameTexts(scene: Scene): string[] {
  const frame = frameOf(scene);
  return [frame.title ?? '', frame.subtitle ?? '', ...rowTexts(scene)];
}

/** 짧은 태그가 다른 말 속에서 우연히 걸리지 않도록 (C026 하네스) */
function said(texts: readonly string[], needle: string): boolean {
  if (needle.length >= 3) return texts.some((text) => text.includes(needle));
  return texts.some((text) => text.split(/[^\p{L}\p{N}:._-]+/u).includes(needle));
}

const rowsSay = (scene: Scene, code: string): boolean => said(rowTexts(scene), codeText(code));
const frameSays = (scene: Scene, code: string): boolean => said(frameTexts(scene), codeText(code));

const rowKey = (row: TargetFrameRow): string => `${row.id}|${row.label}|${row.value}`;

/** 그 판에만 있는 줄들 — "그 사실 때문에 선 줄" 을 문구 없이 집는다 (C027 하네스) */
function extraRows(scene: Scene, other: Scene): TargetFrameRow[] {
  const pool = rowsOf(other).map(rowKey);
  const extra: TargetFrameRow[] = [];
  for (const row of rowsOf(scene)) {
    const at = pool.indexOf(rowKey(row));
    if (at >= 0) pool.splice(at, 1);
    else extra.push(row);
  }
  return extra;
}

const sceneEntity = (scene: Scene, id: string) => scene.entities.find((e) => e.id === id);

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-008 화면에 재료 표식이 없다', () => {
  it('S-081 원천 위에 글자가 하나도 없다 — 라벨도 이름표도 수량도 서지 않는다', () => {
    // Given 원천이 선 방을 그린다
    const scene = look(made());
    const drawn = sceneEntity(scene, ROOT_NODULE);
    // Then 그림은 있고, 그 위의 글자는 없다
    expect(drawn).toBeDefined();
    expect({ label: drawn!.label, nameplate: drawn!.nameplate }).toEqual({
      label: undefined,
      nameplate: undefined,
    });
  });

  it('S-082 지면 표식이 없다 — 구역 어디에도 이름이 붙지 않는다 (RULE-QUIET-GROUND-001)', () => {
    const scene = look(made());
    for (const zone of scene.zones) {
      expect({ id: zone.id, label: zone.label }).toEqual({ id: zone.id, label: undefined });
    }
  });

  it('S-083 (경계) 원천의 그림 자체는 그 자리에 선다 — 그것은 표식이 아니라 실물이다', () => {
    const scene = look(made());
    const drawn = sceneEntity(scene, ROOT_NODULE)!;
    expect(typeof drawn.spriteId).toBe('string');
    expect(drawn.spriteId.length).toBeGreaterThan(0);
    expect({ x: drawn.position.x, z: drawn.position.z }).toEqual({ x: NODULE_AT.x, z: NODULE_AT.z });
    expect(drawn.size).toBeGreaterThan(0);
  });

  it('S-084 흔적은 지면에 그려진다 — 그 방 Description 의 trace area 마다 구역이 선다', () => {
    // Given 이 방에는 흔적이 둘 이상 깔려 있다 (바닥 하나 · 원천 둘레 하나)
    expect(TRACE_AREAS.length).toBeGreaterThan(1);
    const scene = look(made());
    const circles = scene.zones.filter((zone) => zone.shape.kind === 'circle');
    const polygons = scene.zones.filter((zone) => zone.shape.kind === 'polygon');
    for (const area of TRACE_AREAS) {
      expect(soilStainLevel(area.tag)).toBeGreaterThan(0);
      if (area.shape.kind === 'circle') {
        const center = area.shape.center;
        const radius = area.shape.radius;
        const hit = circles.some(
          (zone) =>
            zone.shape.kind === 'circle' &&
            Math.hypot(zone.shape.center.x - center.x, zone.shape.center.z - center.z) < 0.01 &&
            Math.abs(zone.shape.radius - radius) < 0.01,
        );
        expect({ tag: area.tag, drawn: hit }).toEqual({ tag: area.tag, drawn: true });
      } else {
        expect({ tag: area.tag, drawn: polygons.length > 0 }).toEqual({ tag: area.tag, drawn: true });
      }
    }
    // And 그려진 구역은 실제로 보인다 (채움이든 테두리든 하나는 있다)
    for (const zone of scene.zones) {
      expect({ id: zone.id, drawn: !!(zone.fill || zone.edge) }).toEqual({ id: zone.id, drawn: true });
    }
  });

  it('S-085 (경계) 흔적 없는 방에는 흔적 구역이 서지 않는다 — 없는 것을 그리지 않는다', () => {
    // Given 백왕령에는 trace layer 가 하나도 없다 (SPEC-007)
    expect(areasOf(spaceOf(WHITE_KING), TRACE_LAYER)).toEqual([]);
    const civil = look(made({ region: WHITE_KING, entities: [{ ...ME }], interactions: [MOVE] }));
    // Then 거목의 방에 선 흔적 둘레(원)와 같은 구역이 여기에는 없다
    const circle = TRACE_AREAS.map((area) => area.shape).find(
      (shape): shape is { kind: 'circle'; center: { x: number; z: number }; radius: number } =>
        shape.kind === 'circle',
    );
    expect(circle).toBeDefined();
    const here = civil.zones.some(
      (zone) =>
        zone.shape.kind === 'circle' &&
        Math.abs(zone.shape.radius - circle!.radius) < 0.01 &&
        Math.hypot(zone.shape.center.x - circle!.center.x, zone.shape.center.z - circle!.center.z) <
          0.01,
    );
    expect(here).toBe(false);
  });
});

describe('SPEC-009 물으면 원천이 답한다', () => {
  it('S-091 원천을 지목하면 판에 그 종류가 선다', () => {
    // Given 원천이 선 방 / When 그것을 지목한다
    const scene = point(made(), ROOT_NODULE);
    // Then 판이 서고, 그 자연 형태가 읽힌다 (문구 표를 거친다 — 미등록이면 코드 그대로 선다)
    expect(scene.targetFrame).toBeDefined();
    expect(frameSays(scene, FORM_ROOT_NODULE)).toBe(true);
  });

  it('S-092 그 대상이 주는 행동으로 채취가 선다', () => {
    // Given 채취가 이 원천을 겨냥하고 있다 / When 지목한다
    const scene = point(made(), ROOT_NODULE);
    // Then 그 행동 때문에 선 줄이 실제로 있다 (같은 봉투에서 그 행동만 뺀 판과 견준다 · C027 어법)
    const without = point(made({ interactions: [MOVE] }), ROOT_NODULE);
    expect(extraRows(scene, without).length).toBeGreaterThan(0);
  });

  it('S-093 걸 수 없으면 사유가 그 자리에 있다 — 걸어가 거절당하기 전에 안다', () => {
    const far = point(made(), ROOT_NODULE);
    expect(rowsSay(far, HARVEST_FAR.reason!)).toBe(true);
    // And 걸 수 있게 되면 그 사유는 사라진다
    const ready = point(made({ interactions: [MOVE, HARVEST_READY] }), ROOT_NODULE);
    expect(rowsSay(ready, HARVEST_FAR.reason!)).toBe(false);
  });

  it('S-094 (경계) 지목을 풀면 판은 내 몸으로 돌아간다 (C027 그대로)', () => {
    const pointed = point(made(), ROOT_NODULE);
    const released = look(made());
    // Then 판은 여전히 서 있으나 원천의 것이 아니다
    expect(released.targetFrame).toBeDefined();
    expect(frameTexts(released).join('\n')).not.toBe(frameTexts(pointed).join('\n'));
    expect(frameSays(released, FORM_ROOT_NODULE)).toBe(false);
    // And 지목 표식도 풀린다
    expect(released.highlight?.entityId).toBeUndefined();
  });

  it('S-095 지목한 원천이 세계 안에서 표시된다 — 내가 누른 것과 판이 말하는 것이 같다', () => {
    const scene = point(made(), ROOT_NODULE);
    expect(scene.highlight?.entityId).toBe(ROOT_NODULE);
  });

  it('S-096 (경계) 원천의 남은 양도 재료의 쓰임도 판에 없다 — 물어도 이 층은 모른다', () => {
    // 판정 방식 — spec 은 "쓰임이 없다" 를 코드로 말하지 않았다. 봉투가 싣지 않은 것은
    // 판도 지어낼 수 없으므로, 여기서는 "봉투에 없는 값이 판에 뜨지 않는가" 로만 잰다.
    const scene = point(made(), ROOT_NODULE);
    const texts = frameTexts(scene).join('\n');
    for (const invented of ['recipe', 'craft', '조합', '쓰임']) {
      expect({ invented, said: texts.includes(invented) }).toEqual({ invented, said: false });
    }
  });
});

describe('SPEC-010 (화면 몫) 지닌 재료가 이름과 수로 뜬다', () => {
  // spec 의 SPEC-010 은 "자리가 있는가" 를 세계 쪽에서 판정한다. 화면 쪽 몫은 그 자리에
  // **무엇이 적히는가** 다 — Observable Result 7 "HUD 에 그 재료의 이름과 수가 뜬다.
  // 무엇에 쓰는지는 아무 데도 없다".
  const withMaterial = () =>
    made({
      hud: [
        { id: 'region.depth', kind: 'label', value: 'deep' },
        { id: `inventory.${BIO_ORE}`, kind: 'counter', value: 1 },
        ...SELF_HUD,
      ],
    });

  it('S-0104 캔 재료의 자리가 HUD 에 서고, 수가 함께 뜬다', () => {
    const scene = look(withMaterial());
    const slot = scene.hud.find((item) => item.id === `inventory.${BIO_ORE}`);
    expect(slot).toBeDefined();
    expect(String(slot!.value)).toContain('1');
  });

  it('S-0105 그 자리는 코드가 아니라 재료의 이름으로 읽힌다', () => {
    const scene = look(withMaterial());
    const slot = scene.hud.find((item) => item.id === `inventory.${BIO_ORE}`)!;
    const written = [String(slot.label ?? ''), String(slot.value ?? '')].join(' ');
    // 코드를 그대로 내걸지 않는다 — 문구 표를 거친 이름이 선다
    expect(written).not.toContain(`inventory.${BIO_ORE}`);
    expect(written).toContain(codeText(BIO_ORE));
  });

  it('S-0106 (경계) 가지지 않은 재료의 자리는 화면에도 없다 — 0 으로 지어내지 않는다', () => {
    const scene = look(made());
    expect(scene.hud.some((item) => item.id.startsWith('inventory.'))).toBe(false);
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 흔적의 단계가 **눈에 짙기 차이로** 보이는가 — SceneGroundZone 의 색은 숫자 하나이고, 두 단계의 색이 사람 눈에 구별되는지는 이 층에서 잴 수 없다 (촬영이 답할 자리)',
  );
  it.todo(
    'GAP: 미니맵에 재료 표식이 없다 (SPEC-008 "미니맵도 없다") — SceneState 에 미니맵 자리가 아직 없어 견줄 것이 없다',
  );
});

