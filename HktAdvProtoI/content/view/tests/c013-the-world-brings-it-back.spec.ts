// C013 — 세계가 되돌린다 · 화면 쪽 검증 시나리오
// (spec SPEC-003 · SPEC-004 · SPEC-006 · SPEC-007 의 화면 몫 · SPEC-005 문구 · R9)
//
// 되돌아옴은 **눈으로 읽히는 예보**다. 그래서 이 층에서 재는 것은 다섯이다:
//   ① 그림   — 형태 넷 저마다 available · depleted · recovering 셋이 다른 그림이다
//   ② 흙     — 되돌아오는 중인 둘레가 바닥난 동안보다 짙고 캐기 전과 같게 그려진다
//   ③ 자리   — 원천이 옮겨 서면 그림도 흙도 그 마디로 따라간다
//   ④ 구덩이 — 무너진 자리가 **마디마다 쌓여** 지면에 선다. 그리고 뿌리 선이 그려진다
//   ⑤ 침묵   — 그 모든 것 위에 글자는 하나도 없다. 이름과 사유는 지목했을 때만 판이 답한다
//
// **마디도 흔적도 붕괴도 투영되지 않는다.** 화면이 세계에게서 받는 것은 원천의 `state` ·
// `position` · `siteIndex` · `collapsedSites` · 걸린 `conditions` 뿐이고, 마디의 좌표와
// 둘레·붕괴의 모양은 관찰자가 자기 content/regions 를 읽어 **스스로** 얻는다
// (C005~C007 · C011 · C012 의 규율 그대로). 그래서 이 파일은 세계를 기동하지 않는다 —
// 같은 봉투에서 원천의 한 자리만 갈아 끼워 두 화면을 견준다.
//
// 이 파일은 이 Cycle 이 새로 쓴 화면 코드를 **읽지 않고** 쓴다 (c011 · c012 의 선례).
// **판정 방식** — spec 이 줄의 id 도 문구도 색의 값도 정하지 않았으므로 둘로 잰다:
//   말   의미 코드의 문구(codeText)가 판 어딘가에 실렸는가 (C026 하네스 그대로)
//   그림 같은 봉투에서 한 자리만 바꾼 두 화면을 **차이로** 견준다
// 개수는 단언하지 않는다 — 다른 Cycle 이 줄이나 구역을 더해도 깨지면 안 된다.

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { codeText } from '../code-text';
import { compileRegion } from '../../../engine/world-authoring/compile';
import {
  areasOf,
  curvesOf,
  descriptionHash,
  pointsOf,
  polylineStrip,
  type CurveOp,
  type XZ,
} from '../../../engine/world-authoring/description';
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
  PRESENCE_LAYER,
  RECOVERY_STALLED,
  RESOURCE_LAYER,
  TRACE_LAYER,
  type ResourceSourceSpec,
} from '../../regions/resource-ecology';

// ── 계약이 준 형 (C011 · C012 · C027 이 적어 둔 그대로) ───────────────

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

/** 이 Cycle 이 관찰 계약에 더한 자리들 (spec Observable) */
type SourceView = EntityView & {
  conditions?: readonly string[];
  siteIndex?: number;
  collapsedSites?: readonly number[];
};

// ── 방과 데이터 ───────────────────────────────────────────────────────
//
// 생체 광석 지대 — 이 Cycle 의 자국이 모두 서는 방이다. 노두는 마디 넷을 가진 유일한 원천이고
// (뿌리 곡선), 마디마다 둘레 흔적 원과 붕괴 원이 함께 있다.

const BIO_ORE_FIELD = 'BIO_ORE_FIELD';
const ORE_OUTCROP = 'ORE_OUTCROP';

const AVAILABLE = 'available';
const DEPLETED = 'depleted';
const RECOVERING = 'recovering';

/** 거절 사유 — 되돌아오는 중이다 (spec R3 · 기본형 ④) */
const SOURCE_RECOVERING = 'source-recovering';
const SOURCE_DEPLETED = 'source-depleted';

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

function ecologyOf(regionId: string, id: string): ResourceSourceSpec {
  const found = regionSpec(regionId)?.resourceEcology?.sources.find((s) => s.id === id);
  if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다`);
  return found;
}

const OUTCROP_SPEC = ecologyOf(BIO_ORE_FIELD, ORE_OUTCROP);

/** 노두의 뿌리 곡선 — points 넷이 곧 마디 넷이다 (좌표를 적지 않는다) */
function rootCurve(): CurveOp {
  const tag = OUTCROP_SPEC.siteCurve;
  if (!tag) throw new Error('노두가 마디 곡선을 밝히지 않았다');
  const curve = curvesOf(spaceOf(BIO_ORE_FIELD), PRESENCE_LAYER, tag)[0];
  if (!curve) throw new Error(`뿌리 곡선(presence · ${tag})이 데이터에 없다`);
  return curve;
}

const ROOT_CURVE = rootCurve();
/** 마디 목록 — 이 Cycle 의 자리는 전부 여기서 온다 */
const SITES: XZ[] = ROOT_CURVE.points.map((p) => ({ x: p.x, z: p.z }));

/** op id 로 집는 원 — traceOps · collapseOps 가 마디 순서 그대로 가리킨다 */
function circleOp(opId: string): { center: XZ; radius: number } {
  const op = spaceOf(BIO_ORE_FIELD).ops.find((o) => o.id === opId);
  if (!op || op.kind !== 'area' || op.shape.kind !== 'circle') {
    throw new Error(`데이터에 원 op '${opId}' 가 없다`);
  }
  return { center: op.shape.center, radius: op.shape.radius };
}

const traceCircleAt = (site: number) => {
  const opId = OUTCROP_SPEC.traceOps?.[site];
  if (!opId) throw new Error(`마디 ${site} 의 둘레 흔적 area 가 없다`);
  return circleOp(opId);
};
const collapseCircleAt = (site: number) => {
  const opId = OUTCROP_SPEC.collapseOps?.[site];
  if (!opId) throw new Error(`마디 ${site} 의 붕괴 area 가 없다`);
  return circleOp(opId);
};

/** 방 바닥의 흔적 구역 (polygon) — 둘레 원과 견주기 위한 자리 */
const FLOOR_AREA = areasOf(spaceOf(BIO_ORE_FIELD), TRACE_LAYER).find(
  (a) => a.shape.kind === 'polygon',
)!;

/** 노두가 처음 서는 자리 — C011 이 놓은 resource point 이자 마디 0 이다 */
const OUTCROP_POINT = pointsOf(spaceOf(BIO_ORE_FIELD), RESOURCE_LAYER).find(
  (p) => p.tag === ORE_OUTCROP,
)!.position;

/** 마디 어디에서도 넉넉히 떨어진, 지나갈 수 있는 자리 하나 — 내 몸이 설 자리 */
function farStandingSpot(): XZ {
  let best: XZ | undefined;
  let bestDistance = -1;
  for (let iz = 0; iz < ORE_WORLD.rows; iz++) {
    for (let ix = 0; ix < ORE_WORLD.cols; ix++) {
      const x = ORE_WORLD.extent.minX + ix * ORE_WORLD.resolution;
      const z = ORE_WORLD.extent.minZ + iz * ORE_WORLD.resolution;
      if (!isTraversableAt(ORE_WORLD, x, z)) continue;
      const distance = Math.min(...SITES.map((s) => Math.hypot(x - s.x, z - s.z)));
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

// ── 봉투 (손으로 짓는다 — c011 · c012 의 선례) ────────────────────────

const ME: EntityView = {
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: ME_AT.x, z: ME_AT.z },
};

interface SourceOptions {
  state?: string;
  conditions?: readonly string[];
  siteIndex?: number;
  collapsedSites?: readonly number[];
}

function source(
  id: string,
  form: string,
  material: string,
  at: XZ,
  options: SourceOptions = {},
): SourceView {
  return {
    id,
    role: 'resource-source',
    state: options.state ?? AVAILABLE,
    kind: form,
    material,
    position: { x: at.x, z: at.z },
    ...(options.conditions ? { conditions: options.conditions } : {}),
    ...(options.siteIndex === undefined ? {} : { siteIndex: options.siteIndex }),
    ...(options.collapsedSites ? { collapsedSites: options.collapsedSites } : {}),
  } as SourceView;
}

/** 노두 하나 — 마디 번호를 주면 그 마디에 세운다 (자리는 데이터가 소유한다) */
const outcrop = (options: SourceOptions = {}): SourceView =>
  source(ORE_OUTCROP, FORM_OUTCROP, BIO_ORE, SITES[options.siteIndex ?? 0]!, {
    siteIndex: 0,
    ...options,
  });

const MOVE: InteractionView = { id: 'move', role: 'move-to', available: true };
const mineOffer = (available: boolean, reason?: string): InteractionView => ({
  id: 'mine',
  role: 'harvest-source',
  targetEntityId: ORE_OUTCROP,
  available,
  ...(reason ? { reason } : {}),
});

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
    interactions: options.interactions ?? [MOVE, mineOffer(true)],
    hud: [{ id: 'region.depth', kind: 'label', value: 'wild' }, ...SELF_HUD],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

/** 노두가 그 phase 로 그 마디에 선 방 — 무너진 마디도 함께 준다 */
const room = (options: SourceOptions = {}): GameViewSnapshot => {
  const phase = options.state ?? AVAILABLE;
  const offer =
    phase === AVAILABLE
      ? mineOffer(true)
      : mineOffer(false, phase === RECOVERING ? SOURCE_RECOVERING : SOURCE_DEPLETED);
  return made({ entities: [ME, outcrop(options)], interactions: [MOVE, offer] });
};

// ── 화면 만들기 (c011 · c012 의 선례 그대로) ──────────────────────────

type Designation = { entityId: string } | { ground: { x: number; z: number } };

function resolveWith(snapshot: GameViewSnapshot, designation?: Designation): Scene {
  return resolvePresentation(snapshot, undefined, {
    ...(designation ? { designation } : {}),
  } as Parameters<typeof resolvePresentation>[2]) as Scene;
}

const look = (snapshot: GameViewSnapshot): Scene => resolveWith(snapshot);
const point = (snapshot: GameViewSnapshot, entityId: string): Scene =>
  resolveWith(snapshot, { entityId });
const pointGround = (snapshot: GameViewSnapshot, at: XZ): Scene =>
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

function circleZones(scene: Scene, center: XZ, radius: number): Zone[] {
  return scene.zones.filter(
    (zone) =>
      zone.shape.kind === 'circle' &&
      near(zone.shape.center.x, center.x) &&
      near(zone.shape.center.z, center.z) &&
      near(zone.shape.radius, radius),
  );
}

/** 그 구역이 어떻게 그려졌는가 — id 는 빼고 **보이는 것**만 (C012 하네스 그대로) */
const paintOf = (zone: Zone): string =>
  JSON.stringify({ fill: zone.fill ?? null, edge: zone.edge ?? null });

const shapesOf = (scene: Scene): string[] => scene.zones.map((z) => JSON.stringify(z.shape)).sort();

/** 마디 i 의 둘레 흔적 구역 — 그 마디의 trace 원과 같은 원이다 */
function ringZoneAt(scene: Scene, site: number): Zone | undefined {
  const c = traceCircleAt(site);
  return circleZones(scene, c.center, c.radius)[0];
}

/** 그 둘레가 얼마나 짙게 그려졌는가 — 그려지지 않았으면 0 (없는 것은 가장 옅다) */
const ringInk = (scene: Scene, site: number): number => ringZoneAt(scene, site)?.fill?.opacity ?? 0;

/**
 * 방 바닥의 흔적 구역 — 바닥 흔적 area 와 같은 모양이면서 **같은 흙으로** 그려진 구역이다
 * (C012 하네스 그대로 — 방의 테두리 구역도 같은 모양으로 서므로 색을 함께 본다).
 */
function floorTraceZone(scene: Scene): Zone {
  const soil = ringZoneAt(scene, 0)?.fill?.color;
  const shape = JSON.stringify(FLOOR_AREA.shape);
  const found = scene.zones.find(
    (z) => JSON.stringify(z.shape) === shape && z.fill?.color === soil,
  );
  if (!found) throw new Error('방 바닥의 흔적 구역이 그려지지 않았다');
  return found;
}

const collapseZonesAt = (scene: Scene, site: number): Zone[] => {
  const c = collapseCircleAt(site);
  return circleZones(scene, c.center, c.radius);
};

/** 다각형 안인가 — 뿌리 선이 마디를 지나는지 보기 위한 판정 (짝수-홀수 규칙) */
function insidePolygon(polygon: readonly XZ[], p: XZ): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const crosses = a.z > p.z !== b.z > p.z;
    if (crosses && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

const polygonZones = (scene: Scene): { zone: Zone; points: readonly XZ[] }[] =>
  scene.zones
    .filter((z) => z.shape.kind === 'polygon')
    .map((z) => ({ zone: z, points: (z.shape as { kind: 'polygon'; points: XZ[] }).points }));

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 (화면 몫) 되돌아오는 중이 눈에 보인다', () => {
  /** 형태 넷 — 자리는 견주기 위한 것일 뿐이다 (그림은 kind + state 가 정한다) */
  const FORMS = [
    { id: 'MOLT_LITTER', form: FORM_MOLT_LITTER, material: ORE_EATER_MOLT, at: { x: -8, z: 6 } },
    { id: 'RUIN_SPOIL', form: FORM_SPOIL_PILE, material: ORE_EATER_MOLT, at: { x: -4, z: 4 } },
    { id: 'ORE_OUTCROP', form: FORM_OUTCROP, material: BIO_ORE, at: OUTCROP_POINT },
    { id: 'ROOT_NODULE', form: FORM_ROOT_NODULE, material: BIO_ORE, at: { x: -12, z: 2 } },
  ] as const;

  /** 넷이 나란히 선 봉투 — 하나만 그 phase 로 둔다 */
  const fourWith = (id: string, phase: string): GameViewSnapshot =>
    made({
      entities: [
        ME,
        ...FORMS.map((one) =>
          source(one.id, one.form, one.material, one.at, {
            state: one.id === id ? phase : AVAILABLE,
          }),
        ),
      ],
      interactions: [MOVE],
    });

  const spriteOf = (id: string, phase: string): string =>
    sceneEntity(look(fourWith(id, phase)), id)!.spriteId;

  it('S-031 형태 넷 저마다 available · depleted · recovering 이 **셋 다 다른 그림**이다', () => {
    for (const one of FORMS) {
      const three = [AVAILABLE, DEPLETED, RECOVERING].map((phase) => spriteOf(one.id, phase));
      expect({ id: one.id, distinct: new Set(three).size }).toEqual({ id: one.id, distinct: 3 });
      // 그리고 셋 다 실물이다 — 그림표에 자리가 있다 (빈 키로 얼버무리지 않는다)
      expect({ id: one.id, drawn: three.every((key) => key.length > 0) }).toEqual({
        id: one.id,
        drawn: true,
      });
    }
  });

  it('S-032 되돌아오는 중인 그림 넷이 저마다 다르다 — 하나로 뭉뚱그리지 않는다', () => {
    const backs = FORMS.map((one) => spriteOf(one.id, RECOVERING));
    expect(new Set(backs).size).toBe(FORMS.length);
    // 크기도 실물이다 — 그림이 사라지는 것이 아니다
    for (const one of FORMS) {
      const drawn = sceneEntity(look(fourWith(one.id, RECOVERING)), one.id)!;
      expect({ id: one.id, sized: drawn.size > 0 }).toEqual({ id: one.id, sized: true });
    }
  });

  it('S-033 (경계) 되돌아오지 않는 원천의 그림은 한 픽셀도 바뀌지 않는다', () => {
    for (const one of FORMS) {
      const after = look(fourWith(one.id, RECOVERING));
      const before = look(fourWith(one.id, AVAILABLE));
      for (const other of FORMS.filter((f) => f.id !== one.id)) {
        expect({ back: one.id, other: other.id, drawn: sceneEntity(after, other.id) }).toEqual({
          back: one.id,
          other: other.id,
          drawn: sceneEntity(before, other.id),
        });
      }
    }
  });

  it('S-034 지목하면 "되돌아오는 중이라 캘 수 없다" 가 그 자리에서 읽힌다', () => {
    const scene = point(room({ state: RECOVERING }), ORE_OUTCROP);
    expect(rowsSay(scene, SOURCE_RECOVERING)).toBe(true);
    // 그리고 고갈의 사유와 갈린다 — 셋이 한 말로 뭉뚱그려지지 않는다
    expect(rowsSay(scene, SOURCE_DEPLETED)).toBe(false);
    expect(rowsSay(point(room({ state: DEPLETED }), ORE_OUTCROP), SOURCE_DEPLETED)).toBe(true);
    // 그 사유 때문에 선 줄이 실제로 하나 더 있다 (문구를 몰라도 차이로 잰다)
    expect(extraRows(scene, point(room(), ORE_OUTCROP)).length).toBeGreaterThan(0);
    // 지목한 것은 세계 안에서도 표시된다 (C027 그대로)
    expect(scene.highlight?.entityId).toBe(ORE_OUTCROP);
    expect(frameSays(scene, FORM_OUTCROP)).toBe(true);
  });
});

describe('SPEC-004 (화면 몫) 되돌아오는 중이면 그 자리 흙이 다시 짙어진다', () => {
  it('S-041 되돌아오는 중인 둘레가 바닥난 동안보다 짙다 — 걸어가기 전에 읽히는 예보다', () => {
    const spent = ringZoneAt(look(room({ state: DEPLETED })), 0);
    const back = ringZoneAt(look(room({ state: RECOVERING })), 0);
    expect(spent?.fill).toBeDefined();
    expect(back?.fill).toBeDefined();
    expect(back!.fill!.opacity).toBeGreaterThan(spent!.fill!.opacity);
  });

  it('S-042 그 짙기가 캐기 전과 **같은 값**이다 — 세계가 말한 것 그대로', () => {
    const fresh = ringZoneAt(look(room({ state: AVAILABLE })), 0)!;
    const back = ringZoneAt(look(room({ state: RECOVERING })), 0)!;
    expect(paintOf(back)).toBe(paintOf(fresh));
    // 그리고 바닥난 동안의 그림과는 다르다
    expect(paintOf(ringZoneAt(look(room({ state: DEPLETED })), 0)!)).not.toBe(paintOf(fresh));
  });

  it('S-043 (경계) 방 바닥의 흙은 어느 phase 에서도 달라지지 않는다', () => {
    const floor = paintOf(floorTraceZone(look(room())));
    for (const phase of [DEPLETED, RECOVERING]) {
      expect({ phase, floor: paintOf(floorTraceZone(look(room({ state: phase })))) }).toEqual({
        phase,
        floor,
      });
    }
  });

  it('S-044 흙도 마디를 따라간다 — 옮겨 선 마디가 짙어지고 옛 마디는 옅어진다', () => {
    // Given 노두가 마디 1 로 옮겨 서서 되돌아오는 중인 방
    const moved = look(room({ state: RECOVERING, siteIndex: 1, collapsedSites: [0] }));
    const home = look(room({ state: AVAILABLE, siteIndex: 0 }));
    // Then 지금 마디의 둘레는 캐기 전 마디 0 만큼 짙고
    expect(ringInk(moved, 1)).toBe(ringInk(home, 0));
    // 옛 마디의 둘레는 더 이상 그만큼 짙지 않다 (그 원천의 둘레가 아니게 되었다)
    expect(ringInk(moved, 0)).toBeLessThan(ringInk(home, 0));
    // 그리고 아직 한 번도 서지 않은 마디의 둘레도 짙지 않다
    expect(ringInk(home, 1)).toBeLessThan(ringInk(home, 0));
  });
});

describe('SPEC-006 (화면 몫) 자리를 옮기는 원천은 다음 마디에 선다', () => {
  it('S-061 원천의 그림이 옮겨 선 마디에 그려진다 — 세계가 말한 자리 그대로', () => {
    for (const site of [0, 1, 2, 3]) {
      const drawn = sceneEntity(look(room({ state: RECOVERING, siteIndex: site })), ORE_OUTCROP)!;
      expect({ site, x: drawn.position.x, z: drawn.position.z }).toEqual({
        site,
        x: SITES[site]!.x,
        z: SITES[site]!.z,
      });
    }
  });

  it('S-062 땅 위에 뿌리 선이 그려진다 — 마디 넷을 지나는 띠 하나', () => {
    const scene = look(room());
    const strip = polylineStrip(ROOT_CURVE.points, ROOT_CURVE.width);
    expect(strip.length).toBeGreaterThan(0);
    // **판정 방식** — spec 은 띠의 폭도 색도 정하지 않았다. 그래서 "마디를 전부 지나면서
    // 방 전체를 덮지는 않는" 다각형으로 집는다: 마디에서 멀리 떨어진 내 자리(ME_AT)는 품지
    // 않는다 (방 테두리 · 바닥 흔적 같은 넓은 다각형과 갈리는 자리다).
    const drawn = polygonZones(scene).filter(
      (z) => SITES.every((s) => insidePolygon(z.points, s)) && !insidePolygon(z.points, ME_AT),
    );
    expect(drawn.length).toBeGreaterThan(0);
    // 그리고 실제로 보인다 (채움이든 테두리든 하나는 있다)
    expect(drawn.some((z) => !!(z.zone.fill || z.zone.edge))).toBe(true);
  });
});

describe('SPEC-007 (화면 몫) 옛 자리는 무너진 채 쌓인다', () => {
  it('S-071 무너진 마디마다 구덩이가 지면에 선다 — 원천이 떠난 자리에도', () => {
    // Given 마디 둘이 무너지고 원천은 마디 2 에 선 방
    const scene = look(room({ state: AVAILABLE, siteIndex: 2, collapsedSites: [0, 1] }));
    for (const site of [0, 1]) {
      const zones = collapseZonesAt(scene, site);
      expect({ site, drawn: zones.length > 0 }).toEqual({ site, drawn: true });
      for (const zone of zones) {
        expect({ site, seen: !!(zone.fill || zone.edge) }).toEqual({ site, seen: true });
      }
    }
    // And 아직 무너지지 않은 마디에는 구덩이가 없다
    for (const site of [2, 3]) {
      expect({ site, zones: collapseZonesAt(scene, site) }).toEqual({ site, zones: [] });
    }
  });

  it('S-072 (경계) 무너진 마디가 없으면 구덩이도 없다', () => {
    const scene = look(room());
    for (const site of [0, 1, 2, 3]) {
      expect({ site, zones: collapseZonesAt(scene, site) }).toEqual({ site, zones: [] });
    }
  });

  it('S-073 지목하면 판이 지날 수 없다고 답한다 — 원천이 거기 없는데도', () => {
    const moved = room({ state: AVAILABLE, siteIndex: 1, collapsedSites: [0] });
    const scene = pointGround(moved, collapseCircleAt(0).center);
    expect(rowsSay(scene, BLOCK_COLLAPSED)).toBe(true);
    // 무너지지 않은 마디의 자리는 그렇지 않다
    expect(rowsSay(pointGround(moved, collapseCircleAt(2).center), BLOCK_COLLAPSED)).toBe(false);
  });

  it('S-074 (경계) 땅은 다시 그려지지 않는다 — 구덩이는 **얹히는** 것이다', () => {
    // Given 캐기 전의 땅 (컴파일 결과 전부)
    const before = JSON.stringify(compiledWorld(BIO_ORE_FIELD));
    const beforeHash = hashOf(BIO_ORE_FIELD);
    const fresh = look(room());
    // When 마디 둘이 무너지고 원천이 옮겨 선 방을 그린다
    const lived = look(room({ state: RECOVERING, siteIndex: 2, collapsedSites: [0, 1] }));
    // Then 땅의 모양(방 · 바닥 · 뿌리 선 같은 다각형)은 하나도 사라지지 않았고
    const livedShapes = shapesOf(lived);
    for (const shape of shapesOf(fresh).filter((s) => s.includes('polygon'))) {
      expect({ shape, kept: livedShapes.includes(shape) }).toEqual({ shape, kept: true });
    }
    // 무너진 자리는 **더해진** 것이다 (있던 것을 갈아 끼우지 않는다)
    expect(livedShapes.length).toBeGreaterThanOrEqual(
      shapesOf(fresh).filter((s) => s.includes('polygon')).length + 2,
    );
    // And 컴파일 결과도 그 방의 hash 도 한 값 바뀌지 않았다
    expect(JSON.stringify(compiledWorld(BIO_ORE_FIELD))).toBe(before);
    expect(hashOf(BIO_ORE_FIELD)).toBe(beforeHash);
  });
});

describe('R9 세계 위에는 글자가 없다', () => {
  it('S-081 되돌아오는 중이든 옮겨 섰든 무너졌든 이름표도 글자도 서지 않는다', () => {
    const scenes = [
      look(room({ state: RECOVERING })),
      look(room({ state: RECOVERING, siteIndex: 1, collapsedSites: [0] })),
      look(room({ state: DEPLETED, conditions: [RECOVERY_STALLED] })),
    ];
    for (const scene of scenes) {
      const drawn = sceneEntity(scene, ORE_OUTCROP)!;
      expect({ label: drawn.label, nameplate: drawn.nameplate }).toEqual({
        label: undefined,
        nameplate: undefined,
      });
      for (const zone of scene.zones) {
        expect({ id: zone.id, label: zone.label }).toEqual({ id: zone.id, label: undefined });
      }
    }
  });
});

describe('문구', () => {
  it('S-091 이 Cycle 이 더한 코드에 사람이 읽을 말이 붙어 있다', () => {
    for (const code of [SOURCE_RECOVERING, RECOVERY_STALLED, BLOCK_COLLAPSED, SOURCE_DEPLETED]) {
      expect({ code, text: codeText(code) }).not.toEqual({ code, text: code });
    }
    // 그리고 되돌아오는 중과 고갈이 **다른 말**이다
    expect(codeText(SOURCE_RECOVERING)).not.toBe(codeText(SOURCE_DEPLETED));
  });

  it('S-092 멎은 원천을 지목하면 "되돌아옴이 멎었다" 가 그 자리에 선다 (C012 그대로)', () => {
    const scene = point(room({ state: DEPLETED, conditions: [RECOVERY_STALLED] }), ORE_OUTCROP);
    expect(rowsSay(scene, RECOVERY_STALLED)).toBe(true);
    expect(rowsSay(point(room({ state: DEPLETED }), ORE_OUTCROP), RECOVERY_STALLED)).toBe(false);
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 짙어지는 흙이 **예보로 읽혀 미리 가서 기다리게 되는가** — 구역의 짙기는 숫자 하나이고 그것이 사람 눈에 갈리는지는 이 층에서 잴 것이 없다 (촬영이 답할 자리 · C011 · C012 가 남긴 결손 그대로)',
  );
  it.todo(
    'GAP: 되돌아오는 중인 그림이 **되돌아오는 중으로 읽히는가** — 그림 키가 셋으로 갈리는 것까지가 이 층의 몫이고, 그 그림이 무엇으로 보이는지는 촬영이 답한다',
  );
  it.todo(
    'GAP: 뿌리 선이 **길을 따라 이어지는 하나의 선으로** 보이는가 — SceneGroundZone 은 모양과 색뿐이어서 띠의 인상은 이 층에서 잴 것이 없다 (촬영이 답할 자리)',
  );
  it.todo(
    'GAP: 화면이 세계와 **같은 진행**을 그리는가 — 이 파일은 봉투 하나를 손으로 지어 화면만 본다. 시간이 실제로 그 값을 만드는지는 세계 쪽 시나리오가 잰다',
  );
});
