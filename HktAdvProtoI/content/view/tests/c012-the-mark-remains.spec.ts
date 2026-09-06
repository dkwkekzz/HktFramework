// C012 — 캐면 세계가 달라진다 · 화면 쪽 검증 시나리오
// (spec SPEC-004 · SPEC-005 · SPEC-006 의 화면 몫 · SPEC-007 의 화면 몫)
//
// 이 Cycle 의 자국 넷 가운데 **셋이 화면의 것**이다.
//   ① 외형   — 네 자연 형태 저마다 available 과 depleted 가 다른 그림이다
//   ② 흔적   — 고갈된 원천 둘레의 흙이 한 단계 옅게 그려진다
//   ③ 통행   — 무너진 자리가 지면에 서고, 지목하면 판이 "지날 수 없다" 고 답한다
//   ④ 의존   — 노두를 지목하면 "되돌아옴이 멎었다" 가 그 자리에 선다
//
// **흔적도 붕괴도 투영되지 않는다.** 화면이 세계에게서 받는 것은 원천의 `state`(phase)와
// 걸린 `conditions` 뿐이고, 어디가 무너지는지·어느 흙이 얼마나 짙은지는 관찰자가 자기
// content/regions 를 컴파일해 **스스로** 얻는다 (C005~C007 · C011 의 규율 그대로).
// 그래서 이 파일의 시나리오는 언제나 **같은 봉투에서 원천의 state 하나만 바꾸어** 두 화면을
// 견주는 꼴이다 — 세계를 기동하지 않는다.
//
// 이 파일은 이 Cycle 이 새로 쓴 화면 코드를 **읽지 않고** 쓴다 (c011 · c026 · c027 의 선례).
// 아는 것은 spec 이 준 계약뿐이다:
//   resolvePresentation(snapshot, motions?, { designation })  designation = {entityId} | {ground:{x,z}}
//   SceneState.targetFrame { title, subtitle?, rows[{ id, label, value, progress?, muted? }] }
//   SceneState.zones[]     { id, shape, fill?, edge?, label? }
//   SceneEntity            { id, spriteId, position, size, label?, nameplate? }
//
// **판정 방식** — spec 이 줄의 id 도 문구도 색의 값도 정하지 않았으므로 둘로 잰다:
//   말   의미 코드의 문구(codeText)가 판 어딘가에 실렸는가 (C026 하네스 그대로)
//   그림 같은 봉투에서 state 하나만 바꾼 두 화면을 **차이로** 견준다
//
// 개수는 단언하지 않는다 — 다른 Cycle 이 줄이나 구역을 더해도 깨지면 안 된다.

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
  BLOCK_COLLAPSED,
  FORM_MOLT_LITTER,
  FORM_OUTCROP,
  FORM_ROOT_NODULE,
  FORM_SPOIL_PILE,
  ORE_EATER_MOLT,
  RECOVERY_STALLED,
  RESOURCE_LAYER,
  TRACE_LAYER,
  soilStainLevel,
} from '../../regions/resource-ecology';

// ── 계약이 준 형 (C011 · C027 이 적어 둔 그대로) ──────────────────────

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

/** 원천에 걸린 조건 코드가 실리는 자리 (C012 가 더한 protocol 의 자리) */
type SourceView = EntityView & { conditions?: readonly string[] };

// ── 방과 데이터 ───────────────────────────────────────────────────────
//
// 생체 광석 지대 — 이 Cycle 의 자국 셋이 모두 서는 방이다.
//   바닥 흔적 3 · 노두 둘레 흔적 4 (반경 7) · 붕괴 자리 (반경 2)
// 그래서 노두가 고갈되면 둘레 흔적 4 → 3 이 되어 **그 방 바닥과 같은 단계**가 된다.
// "한 단계 옅다" 를 색의 값을 모른 채 잴 수 있는 자리가 여기다 (아래 SPEC-005).

const BIO_ORE_FIELD = 'BIO_ORE_FIELD';
const ORE_OUTCROP = 'ORE_OUTCROP';

const AVAILABLE = 'available';
const DEPLETED = 'depleted';

const spaceOf = (regionId: string) => {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return spec.space;
};

function compiledWorld(regionId: string): CompiledWorldTerrain {
  return compileRegion(spaceOf(regionId), COMPILE_RULES).world;
}

const hashOf = (regionId: string): string => descriptionHash(spaceOf(regionId));

const ORE_WORLD = compiledWorld(BIO_ORE_FIELD);

/** 노두가 서야 할 자리 — Description 의 resource point 가 소유한다 (좌표를 적지 않는다) */
const OUTCROP_AT = pointsOf(spaceOf(BIO_ORE_FIELD), RESOURCE_LAYER).find(
  (p) => p.kind === 'point' && p.tag === ORE_OUTCROP,
)!.position;

/** 무너지면 구덩이가 될 자리 — Description 의 resource layer area 가 소유한다 */
const COLLAPSE_AREA = areasOf(spaceOf(BIO_ORE_FIELD), RESOURCE_LAYER).find(
  (a) => a.tag === ORE_OUTCROP,
)!;
const COLLAPSE_CIRCLE =
  COLLAPSE_AREA.shape.kind === 'circle'
    ? COLLAPSE_AREA.shape
    : (() => {
        throw new Error('붕괴 자리가 원이 아니다 — 데이터가 바뀌었다');
      })();

/** 흔적 구역들 — 바닥(3)과 노두 둘레(4) */
const TRACE_AREAS = areasOf(spaceOf(BIO_ORE_FIELD), TRACE_LAYER);
const RING_AREA = TRACE_AREAS.find((a) => a.shape.kind === 'circle')!;
const FLOOR_AREA = TRACE_AREAS.find((a) => a.shape.kind === 'polygon')!;
const RING_LEVEL = soilStainLevel(RING_AREA.tag);
const FLOOR_LEVEL = soilStainLevel(FLOOR_AREA.tag);

/** 노두에서 멀리 떨어진, 지나갈 수 있는 자리 하나 — 내 몸이 설 자리 */
function farStandingSpot(): { x: number; z: number } {
  let best: { x: number; z: number } | undefined;
  let bestDistance = -1;
  for (let iz = 0; iz < ORE_WORLD.rows; iz++) {
    for (let ix = 0; ix < ORE_WORLD.cols; ix++) {
      const x = ORE_WORLD.extent.minX + ix * ORE_WORLD.resolution;
      const z = ORE_WORLD.extent.minZ + iz * ORE_WORLD.resolution;
      if (!isTraversableAt(ORE_WORLD, x, z)) continue;
      const distance = Math.hypot(x - OUTCROP_AT.x, z - OUTCROP_AT.z);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = { x, z };
      }
    }
  }
  if (!best) throw new Error('광석 지대에 설 자리가 없다');
  return best;
}

const ME_AT = farStandingSpot();

// ── 봉투 (손으로 짓는다 — c011 · c027 의 선례) ────────────────────────

const ME: EntityView = {
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: ME_AT.x, z: ME_AT.z },
};

/** 원천 하나 — 관찰 계약이 싣는다고 한 자리만 채운다 */
function source(
  id: string,
  form: string,
  material: string,
  at: { x: number; z: number },
  options: { state?: string; conditions?: readonly string[] } = {},
): SourceView {
  return {
    id,
    role: 'resource-source',
    state: options.state ?? AVAILABLE,
    kind: form,
    material,
    position: { x: at.x, z: at.z },
    ...(options.conditions ? { conditions: options.conditions } : {}),
  } as SourceView;
}

const outcrop = (options: { state?: string; conditions?: readonly string[] } = {}): SourceView =>
  source(ORE_OUTCROP, FORM_OUTCROP, BIO_ORE, OUTCROP_AT, options);

const MOVE: InteractionView = { id: 'move', role: 'move-to', available: true };
const HARVEST_READY: InteractionView = {
  id: 'mine',
  role: 'harvest-source',
  targetEntityId: ORE_OUTCROP,
  available: true,
};
const HARVEST_SPENT: InteractionView = {
  id: 'mine',
  role: 'harvest-source',
  targetEntityId: ORE_OUTCROP,
  available: false,
  reason: 'source-depleted',
};

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
  const region = options.region ?? BIO_ORE_FIELD;
  return {
    specId: 'VIEW-BASIC-COMBAT-POLICY-001',
    scene: region,
    region: { id: region, hash: hashOf(region) },
    standingConditions: [],
    observer: { id: 'observer-a', characterId: ME.id, acknowledgedMark: 0 },
    entities: options.entities ?? [ME, outcrop()],
    interactions: options.interactions ?? [MOVE, HARVEST_READY],
    hud: options.hud ?? [{ id: 'region.depth', kind: 'label', value: 'wild' }, ...SELF_HUD],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

/** 노두 하나가 선 방 — 고갈 여부만 갈아 끼운다 */
const roomWith = (spent: boolean): GameViewSnapshot =>
  made({
    entities: [ME, outcrop({ state: spent ? DEPLETED : AVAILABLE })],
    interactions: [MOVE, spent ? HARVEST_SPENT : HARVEST_READY],
  });

// ── 화면 만들기 (c011 · c027 의 선례 그대로) ──────────────────────────

type Designation = { entityId: string } | { ground: { x: number; z: number } };

function resolveWith(snapshot: GameViewSnapshot, designation?: Designation): Scene {
  return resolvePresentation(snapshot, undefined, {
    ...(designation ? { designation } : {}),
  } as Parameters<typeof resolvePresentation>[2]) as Scene;
}

const look = (snapshot: GameViewSnapshot): Scene => resolveWith(snapshot);
const point = (snapshot: GameViewSnapshot, entityId: string): Scene =>
  resolveWith(snapshot, { entityId });
const pointGround = (snapshot: GameViewSnapshot, at: { x: number; z: number }): Scene =>
  resolveWith(snapshot, { ground: { x: at.x, z: at.z } });

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}

const rowsOf = (scene: Scene): TargetFrameRow[] => frameOf(scene).rows;

const rowTexts = (scene: Scene): string[] =>
  rowsOf(scene).flatMap((row) => [String(row.label ?? ''), String(row.value ?? '')]);

const frameTexts = (scene: Scene): string[] => {
  const frame = frameOf(scene);
  return [frame.title ?? '', frame.subtitle ?? '', ...rowTexts(scene)];
};

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

// ── 지면 구역을 집는 자리 ─────────────────────────────────────────────

type Zone = SceneState['zones'][number];

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** 그 원과 같은 자리·같은 크기로 그려진 구역들 */
function circleZones(scene: Scene, center: { x: number; z: number }, radius: number): Zone[] {
  return scene.zones.filter(
    (zone) =>
      zone.shape.kind === 'circle' &&
      near(zone.shape.center.x, center.x) &&
      near(zone.shape.center.z, center.z) &&
      near(zone.shape.radius, radius),
  );
}

/** 그 구역이 어떻게 그려졌는가 — id 는 빼고 **보이는 것**만 (id 는 방마다 다르다) */
const paintOf = (zone: Zone): string =>
  JSON.stringify({ fill: zone.fill ?? null, edge: zone.edge ?? null });

/** 구역의 모양만 — 그림이 달라져도 모양은 같아야 한다 (덧씌움이지 재컴파일이 아니다) */
const shapesOf = (scene: Scene): string[] => scene.zones.map((z) => JSON.stringify(z.shape)).sort();

/** 노두 둘레의 흔적 구역 — 그 방 Description 의 trace circle 과 같은 원이다 */
function ringZone(scene: Scene): Zone {
  const ring = RING_AREA.shape as { kind: 'circle'; center: { x: number; z: number }; radius: number };
  const found = circleZones(scene, ring.center, ring.radius)[0];
  if (!found) throw new Error('노두 둘레의 흔적 구역이 그려지지 않았다');
  return found;
}

/**
 * 방 바닥의 흔적 구역 — 바닥 흔적 area 와 같은 모양이면서 **같은 흙으로** 그려진 구역이다.
 *
 * 방의 테두리 구역도 같은 모양(방의 extent)으로 서므로 모양만으로는 갈리지 않는다.
 * 그래서 "둘레 흔적과 같은 색으로 칠해졌는가" 를 함께 본다 — 흔적은 한 흙의 짙기 차이다.
 */
function floorTraceZone(scene: Scene): Zone {
  const soil = ringZone(scene).fill?.color;
  const shape = JSON.stringify(FLOOR_AREA.shape);
  const found = scene.zones.find(
    (z) => JSON.stringify(z.shape) === shape && z.fill?.color === soil,
  );
  if (!found) throw new Error('방 바닥의 흔적 구역이 그려지지 않았다');
  return found;
}

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 자국 ① 외형이 바뀐다', () => {
  /** 네 자연 형태 — 자리는 견주기 위한 것일 뿐이다 (그림은 kind + state 가 정한다) */
  const FORMS = [
    { id: 'MOLT_LITTER', form: FORM_MOLT_LITTER, material: ORE_EATER_MOLT, at: { x: -8, z: 6 } },
    { id: 'RUIN_SPOIL', form: FORM_SPOIL_PILE, material: ORE_EATER_MOLT, at: { x: -4, z: 4 } },
    { id: 'ORE_OUTCROP', form: FORM_OUTCROP, material: BIO_ORE, at: OUTCROP_AT },
    { id: 'ROOT_NODULE', form: FORM_ROOT_NODULE, material: BIO_ORE, at: { x: -12, z: 2 } },
  ] as const;

  /** 넷이 나란히 선 봉투 — 형태를 나란히 견주기 위해 손으로 짓는다 (세계의 배치가 아니다) */
  const fourWith = (spentId?: string): GameViewSnapshot =>
    made({
      entities: [
        ME,
        ...FORMS.map((one) =>
          source(one.id, one.form, one.material, one.at, {
            state: one.id === spentId ? DEPLETED : AVAILABLE,
          }),
        ),
      ],
      interactions: [MOVE],
    });

  it('S-041 네 자연 형태 저마다 available 과 depleted 가 다른 그림이다', () => {
    for (const one of FORMS) {
      const fresh = sceneEntity(look(fourWith()), one.id);
      const spent = sceneEntity(look(fourWith(one.id)), one.id);
      expect({ id: one.id, fresh: !!fresh, spent: !!spent }).toEqual({
        id: one.id,
        fresh: true,
        spent: true,
      });
      expect({ id: one.id, same: fresh!.spriteId === spent!.spriteId }).toEqual({
        id: one.id,
        same: false,
      });
      // 그리고 고갈된 그림도 실물이다 — 그림이 사라지는 것이 아니다
      expect({ id: one.id, drawn: spent!.spriteId.length > 0 && spent!.size > 0 }).toEqual({
        id: one.id,
        drawn: true,
      });
    }
  });

  it('S-042 네 형태의 고갈된 그림이 저마다 다르다 — 하나로 뭉뚱그리지 않는다', () => {
    const spent = FORMS.map((one) => sceneEntity(look(fourWith(one.id)), one.id)!.spriteId);
    expect(new Set(spent).size).toBe(FORMS.length);
  });

  it('S-043 (경계) 고갈되지 않은 원천의 그림은 한 픽셀도 바뀌지 않는다', () => {
    const before = look(fourWith());
    for (const one of FORMS) {
      const after = look(fourWith(one.id));
      for (const other of FORMS.filter((f) => f.id !== one.id)) {
        expect({ spent: one.id, other: other.id, drawn: sceneEntity(after, other.id) }).toEqual({
          spent: one.id,
          other: other.id,
          drawn: sceneEntity(before, other.id),
        });
      }
    }
  });

  it('S-044 (경계) 고갈돼도 세계 위 글자는 없다 (RULE-QUIET-GROUND-001 그대로)', () => {
    const scene = look(roomWith(true));
    const drawn = sceneEntity(scene, ORE_OUTCROP)!;
    expect({ label: drawn.label, nameplate: drawn.nameplate }).toEqual({
      label: undefined,
      nameplate: undefined,
    });
    for (const zone of scene.zones) {
      expect({ id: zone.id, label: zone.label }).toEqual({ id: zone.id, label: undefined });
    }
  });
});

describe('SPEC-005 자국 ② 둘레 흙이 옅어진다', () => {
  it('S-051 이 방의 데이터가 이 시나리오의 전제 그대로다 — 바닥 3 · 노두 둘레 4', () => {
    // (전제가 데이터에서 바뀌면 아래 두 it 의 판정이 성립하지 않는다 — 여기서 먼저 붙잡는다)
    expect({ floor: FLOOR_LEVEL, ring: RING_LEVEL }).toEqual({
      floor: FLOOR_LEVEL,
      ring: FLOOR_LEVEL + 1,
    });
  });

  it('S-052 고갈된 원천 둘레의 구역이 캐기 전과 다르게 그려진다', () => {
    const ring = RING_AREA.shape as { kind: 'circle'; center: { x: number; z: number }; radius: number };
    const fresh = circleZones(look(roomWith(false)), ring.center, ring.radius);
    const spent = circleZones(look(roomWith(true)), ring.center, ring.radius);
    expect(fresh.length).toBeGreaterThan(0);
    expect(spent.length).toBe(fresh.length);
    expect(spent.map(paintOf)).not.toEqual(fresh.map(paintOf));
  });

  it('S-053 그 그림이 실제로 **옅다** — 캐기 전보다 흐리게 그려진다', () => {
    // 판정 방식 — spec 은 색의 값을 정하지 않았다. "옅다" 를 값으로 잴 수 있는 자리는
    // 그 구역의 채움 짙기(opacity)뿐이므로 그것으로 잰다.
    const freshRing = ringZone(look(roomWith(false)));
    const spentRing = ringZone(look(roomWith(true)));
    expect(freshRing.fill).toBeDefined();
    expect(spentRing.fill).toBeDefined();
    expect(spentRing.fill!.opacity).toBeLessThan(freshRing.fill!.opacity);
  });

  it('S-054 그 옅기가 **한 단계** 다 — 같은 방 바닥의 흙과 같은 그림이 된다', () => {
    // 이 방에서는 노두 둘레가 4 이고 바닥이 3 이다 (S-051). 한 단계 옅어지면 바닥과 같은
    // 단계가 되므로 "바닥의 흙과 같게 그려졌는가" 가 곧 '한 단계' 의 판정이다.
    const freshScene = look(roomWith(false));
    const spentScene = look(roomWith(true));
    const floor = floorTraceZone(freshScene);
    // 캐기 전에는 바닥보다 짙고
    expect(paintOf(ringZone(freshScene))).not.toBe(paintOf(floor));
    // 캐고 나면 바닥과 같다
    expect(paintOf(ringZone(spentScene))).toBe(paintOf(floor));
  });

  it('S-055 (경계) 방 바닥의 흙은 달라지지 않는다', () => {
    expect(paintOf(floorTraceZone(look(roomWith(true))))).toBe(
      paintOf(floorTraceZone(look(roomWith(false)))),
    );
  });
});

describe('SPEC-006 (화면 몫) 자국 ③ 무너진 자리', () => {
  it('S-061 고갈되면 무너진 자리가 지면에 선다 — 데이터의 붕괴 area 와 같은 원이다', () => {
    const fresh = circleZones(look(roomWith(false)), COLLAPSE_CIRCLE.center, COLLAPSE_CIRCLE.radius);
    const spent = circleZones(look(roomWith(true)), COLLAPSE_CIRCLE.center, COLLAPSE_CIRCLE.radius);
    // Given 캐기 전에는 그런 구역이 없다 — 아직 무너지지 않았다
    expect(fresh).toEqual([]);
    // Then 고갈된 뒤에는 선다, 그리고 실제로 보인다 (채움이든 테두리든 하나는 있다)
    expect(spent.length).toBeGreaterThan(0);
    for (const zone of spent) {
      expect({ id: zone.id, drawn: !!(zone.fill || zone.edge) }).toEqual({ id: zone.id, drawn: true });
    }
  });

  it('S-062 지목하면 판이 지날 수 없다고 답한다 — 걸어가 거절당하기 전에 안다', () => {
    // Given 무너진 자리 한 가운데를 지목한다
    const spent = pointGround(roomWith(true), COLLAPSE_CIRCLE.center);
    // Then 그 사유가 판에 실린다
    expect(rowsSay(spent, BLOCK_COLLAPSED)).toBe(true);
  });

  it('S-063 (경계) 고갈 전에는 그 말이 판에 없다 — 그 자리는 아직 지날 수 있다', () => {
    const fresh = pointGround(roomWith(false), COLLAPSE_CIRCLE.center);
    expect(rowsSay(fresh, BLOCK_COLLAPSED)).toBe(false);
    // 그리고 그 말 때문에 선 줄이 고갈된 판에는 하나 더 있다
    const spent = pointGround(roomWith(true), COLLAPSE_CIRCLE.center);
    expect(extraRows(spent, fresh).length).toBeGreaterThan(0);
  });

  it('S-064 (경계) 무너진 자리 밖은 달라지지 않는다 — 내가 선 자리는 그대로 답한다', () => {
    const fresh = pointGround(roomWith(false), ME_AT);
    const spent = pointGround(roomWith(true), ME_AT);
    expect(rowsSay(spent, BLOCK_COLLAPSED)).toBe(false);
    expect(rowsOf(spent).map(rowKey)).toEqual(rowsOf(fresh).map(rowKey));
  });

  it('S-065 (경계) 구역의 모양은 그대로다 — 그림이 얹힐 뿐 땅이 다시 그려지지 않는다', () => {
    // 무너진 자리 하나가 더 서는 것 말고는 모양이 하나도 바뀌지 않는다
    const fresh = shapesOf(look(roomWith(false)));
    const spent = shapesOf(look(roomWith(true)));
    for (const shape of fresh) {
      expect({ shape, kept: spent.includes(shape) }).toEqual({ shape, kept: true });
    }
  });
});

describe('SPEC-007 (화면 몫) 자국 ④ 되돌아옴이 멎었다', () => {
  const stalled = (): GameViewSnapshot =>
    made({
      entities: [ME, outcrop({ conditions: [RECOVERY_STALLED] })],
      interactions: [MOVE, HARVEST_READY],
    });

  it('S-071 조건이 걸린 원천을 지목하면 판에 recovery-stalled 가 선다', () => {
    const scene = point(stalled(), ORE_OUTCROP);
    expect(scene.targetFrame).toBeDefined();
    expect(rowsSay(scene, RECOVERY_STALLED)).toBe(true);
  });

  it('S-072 (경계) 걸린 것이 없으면 그 줄이 서지 않는다', () => {
    const plain = point(made(), ORE_OUTCROP);
    expect(rowsSay(plain, RECOVERY_STALLED)).toBe(false);
    // 그 조건 때문에 선 줄이 실제로 하나 더 있다 (문구를 몰라도 차이로 잰다)
    expect(extraRows(point(stalled(), ORE_OUTCROP), plain).length).toBeGreaterThan(0);
  });

  it('S-073 (경계) 멎었다고 해서 캘 수 없는 것이 아니다 — 채취 줄은 그대로 선다', () => {
    const scene = point(stalled(), ORE_OUTCROP);
    // 걸 수 없다는 사유는 실리지 않는다 (봉투의 mine 은 available 이다)
    expect(rowsSay(scene, 'source-depleted')).toBe(false);
    // 그리고 그 대상이 주는 행동 때문에 선 줄은 여전히 있다
    const without = point(
      made({ entities: [ME, outcrop({ conditions: [RECOVERY_STALLED] })], interactions: [MOVE] }),
      ORE_OUTCROP,
    );
    expect(extraRows(scene, without).length).toBeGreaterThan(0);
  });

  it('S-074 (경계) 조건은 지목했을 때만 말이 된다 — 세계 위에는 글자가 없다', () => {
    const scene = look(stalled());
    const drawn = sceneEntity(scene, ORE_OUTCROP)!;
    expect({ label: drawn.label, nameplate: drawn.nameplate }).toEqual({
      label: undefined,
      nameplate: undefined,
    });
  });
});

describe('문구', () => {
  it('S-081 이 Cycle 이 더한 코드 셋에 사람이 읽을 말이 붙어 있다', () => {
    for (const code of [BLOCK_COLLAPSED, 'source-depleted', RECOVERY_STALLED]) {
      expect({ code, text: codeText(code) }).not.toEqual({ code, text: code });
    }
  });

  it('S-082 고갈된 원천을 지목하면 그 종류와 사유가 함께 읽힌다', () => {
    const scene = point(roomWith(true), ORE_OUTCROP);
    expect(frameSays(scene, FORM_OUTCROP)).toBe(true);
    expect(rowsSay(scene, 'source-depleted')).toBe(true);
    // 그리고 지목한 것이 세계 안에서도 표시된다 (C027 그대로 — 고갈돼도 지목된다)
    expect(scene.highlight?.entityId).toBe(ORE_OUTCROP);
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 흔적의 한 단계 차이가 **사람 눈에** 보이는가 — 구역의 색은 숫자 하나이고 두 단계가 눈으로 갈리는지는 이 층에서 잴 수 없다 (촬영이 답할 자리 · C011 이 남긴 결손 그대로)',
  );
  it.todo(
    'GAP: 무너진 자리가 **구덩이로** 읽히는가 — SceneGroundZone 은 색과 테두리뿐이어서 "파였다" 는 인상은 이 층에서 잴 것이 없다 (촬영이 답할 자리)',
  );
  it.todo(
    'GAP: 두 관찰자의 화면이 같은 자국을 보이는가 — 이 파일은 봉투 하나를 손으로 지어 화면만 본다. 사람을 건너가는 것은 세계 쪽 시나리오(SPEC-008)가 잰다',
  );
});
