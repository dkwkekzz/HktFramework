// C014 — 조건과 흐름, 그리고 보고 · 화면 쪽 검증 시나리오
// (spec SPEC-001 · SPEC-003 · SPEC-004 · SPEC-005 의 표현 몫 · R10)
//
// 이 Cycle 이 화면에 더하는 것은 셋뿐이다 — 그림 아홉 · 문구 둘 · 재료 이름 하나. 그래서 재는 것은:
//   ① 그림   — 원천 셋 저마다 available · depleted · recovering 이 다르고 아홉이 서로 다르다
//   ② 문구   — flow-arrived · condition-unmet 에 사람이 읽을 말이 붙고 지목하면 그 자리에 선다
//   ③ 이름   — 세 번째 재료가 코드가 아니라 이름으로 읽힌다
//   ④ 침묵   — 그 모든 것 위에 글자는 하나도 없다 (labelValue · nameplate · 구역의 이름표)
//   ⑤ 회귀   — 앞의 원천 넷의 그림과 앞의 문구는 한 자도 바뀌지 않는다
//
// **흐름도 주기도 투영되지 않는다.** 화면이 세계에게서 받는 것은 원천의 `state` · `position` ·
// 걸린 `conditions` 뿐이다 (spec Observable). 그래서 이 파일은 세계를 기동하지 않는다 —
// 관찰 봉투를 손으로 지어 화면만 본다 (c011 · c012 · c013 view 시나리오의 선례 그대로).
// 이 Cycle 이 새로 쓴 화면 코드는 **읽지 않았다**. 형태 코드도 적지 않는다 — 데이터에서 읽는다.

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { codeText } from '../code-text';
import { compileRegion } from '../../../engine/world-authoring/compile';
import { descriptionHash, pointsOf, type XZ } from '../../../engine/world-authoring/description';
import { isTraversableAt } from '../../../engine/world-authoring/query';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import {
  BIO_ORE,
  BIO_ORE_FIELD,
  COMPILE_RULES,
  EXPLORER_RUIN,
  FOREST_DEEP,
  FOREST_EDGE,
  HEART_LAKE,
  ORE_EATER_MOLT,
  PREDATOR_NEST,
  RECOVERY_STALLED,
  RED_EYE_TREE,
  RESOURCE_LAYER,
  regionSpec,
  type ResourceSourceSpec,
} from '../../regions/index';

// ── 계약이 준 형 (C011 · C012 · C013 · C027 이 적어 둔 그대로) ────────

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

type Scene = SceneState & { targetFrame?: TargetFrame; highlight?: { entityId?: string } };

/** 원천에 실리는 자리들 (C012 · C013 의 것 그대로) */
type SourceView = EntityView & { conditions?: readonly string[] };

// ── spec 이 동결한 이름과 코드 ────────────────────────────────────────

const NEST_FUNGUS = 'NEST_FUNGUS';
const RIVER_SILT = 'RIVER_SILT';
const LAKE_SILT_BED = 'LAKE_SILT_BED';
const MOLT_LITTER = 'MOLT_LITTER';
const RUIN_SPOIL = 'RUIN_SPOIL';
const ORE_OUTCROP = 'ORE_OUTCROP';
const ROOT_NODULE = 'ROOT_NODULE';

/** 세 번째 재료 */
const GIANT_TREE_FUNGUS = 'GIANT_TREE_FUNGUS';

const AVAILABLE = 'available';
const DEPLETED = 'depleted';
const RECOVERING = 'recovering';

/** 이 Cycle 이 더한 조건 코드 둘 */
const FLOW_ARRIVED = 'flow-arrived';
const CONDITION_UNMET = 'condition-unmet';

/** 앞이 세운 사유·조건 코드 (회귀) */
const SOURCE_DEPLETED = 'source-depleted';
const SOURCE_RECOVERING = 'source-recovering';

// ── 방과 데이터 ───────────────────────────────────────────────────────

const spaceOf = (regionId: string) => {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return spec.space;
};

const terrainMemo = new Map<string, CompiledWorldTerrain>();
function terrainOf(regionId: string): CompiledWorldTerrain {
  const hit = terrainMemo.get(regionId);
  if (hit) return hit;
  const made = compileRegion(spaceOf(regionId), COMPILE_RULES).world;
  terrainMemo.set(regionId, made);
  return made;
}

const hashOf = (regionId: string): string => descriptionHash(spaceOf(regionId));

function ecologyOf(regionId: string, id: string): ResourceSourceSpec {
  const found = regionSpec(regionId)?.resourceEcology?.sources.find((s) => s.id === id);
  if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다 (${regionId})`);
  return found;
}

/** 그 원천이 선 자리 — C011 이 놓은 resource point (좌표를 적지 않는다) */
function pointOf(regionId: string, id: string): XZ {
  const found = pointsOf(spaceOf(regionId), RESOURCE_LAYER).find((p) => p.tag === id);
  if (!found) throw new Error(`데이터에 원천 '${id}' 의 자리가 없다 (${regionId})`);
  return found.position;
}

/** 원천에서 가장 먼, 지나갈 수 있는 자리 하나 — 내 몸이 설 자리 */
function farSpot(regionId: string, from: XZ): XZ {
  const t = terrainOf(regionId);
  let best: XZ | undefined;
  let far = -1;
  for (let iz = 0; iz < t.rows; iz++) {
    for (let ix = 0; ix < t.cols; ix++) {
      const x = t.extent.minX + ix * t.resolution;
      const z = t.extent.minZ + iz * t.resolution;
      if (!isTraversableAt(t, x, z)) continue;
      const distance = Math.hypot(x - from.x, z - from.z);
      if (distance > far) {
        far = distance;
        best = { x, z };
      }
    }
  }
  if (!best) throw new Error(`${regionId} 에 설 자리가 없다`);
  return best;
}

/** 이 Cycle 이 세우는 원천 셋 — 형태 코드는 데이터가 소유한다 */
const ADDED = [
  { id: NEST_FUNGUS, region: PREDATOR_NEST, material: GIANT_TREE_FUNGUS },
  { id: RIVER_SILT, region: FOREST_DEEP, material: BIO_ORE },
  { id: LAKE_SILT_BED, region: HEART_LAKE, material: BIO_ORE },
] as const;

/** C011~C013 이 세운 넷 (회귀) */
const FOUR = [
  { id: MOLT_LITTER, region: FOREST_EDGE, material: ORE_EATER_MOLT },
  { id: RUIN_SPOIL, region: EXPLORER_RUIN, material: ORE_EATER_MOLT },
  { id: ORE_OUTCROP, region: BIO_ORE_FIELD, material: BIO_ORE },
  { id: ROOT_NODULE, region: RED_EYE_TREE, material: BIO_ORE },
] as const;

type One = { id: string; region: string; material: string };

// ── 봉투 (손으로 짓는다 — c011 · c012 · c013 의 선례) ─────────────────

const meAt = (at: XZ): EntityView => ({
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: at.x, z: at.z },
});

interface SourceOptions {
  state?: string;
  conditions?: readonly string[];
}

function sourceView(one: One, options: SourceOptions = {}): SourceView {
  const at = pointOf(one.region, one.id);
  return {
    id: one.id,
    role: 'resource-source',
    state: options.state ?? AVAILABLE,
    kind: ecologyOf(one.region, one.id).form,
    material: one.material,
    position: { x: at.x, z: at.z },
    ...(options.conditions ? { conditions: options.conditions } : {}),
  } as SourceView;
}

const MOVE: InteractionView = { id: 'move', role: 'move-to', available: true };
const mineOffer = (targetEntityId: string, available: boolean, reason?: string): InteractionView => ({
  id: 'mine',
  role: 'harvest-source',
  targetEntityId,
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
  region: string;
  entities: EntityView[];
  interactions?: InteractionView[];
  hud?: { id: string; kind: 'flag' | 'label' | 'counter'; value: number | string | boolean }[];
}

function made(options: Made): GameViewSnapshot {
  return {
    specId: 'VIEW-BASIC-COMBAT-POLICY-001',
    scene: options.region,
    region: { id: options.region, hash: hashOf(options.region) },
    standingConditions: [],
    observer: { id: 'observer-a', characterId: 'player', acknowledgedMark: 0 },
    entities: options.entities,
    interactions: options.interactions ?? [MOVE],
    hud: [
      { id: 'region.depth', kind: 'label', value: 'wild' },
      ...SELF_HUD,
      ...(options.hud ?? []),
    ],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

/** 그 원천이 그 phase 로 선 방 하나 */
function room(one: One, options: SourceOptions = {}): GameViewSnapshot {
  const at = pointOf(one.region, one.id);
  const phase = options.state ?? AVAILABLE;
  const offer =
    phase === AVAILABLE
      ? mineOffer(one.id, true)
      : mineOffer(one.id, false, phase === RECOVERING ? SOURCE_RECOVERING : SOURCE_DEPLETED);
  return made({
    region: one.region,
    entities: [meAt(farSpot(one.region, at)), sourceView(one, options)],
    interactions: [MOVE, offer],
  });
}

// ── 화면 만들기 (c011 · c012 · c013 의 선례 그대로) ──────────────────

type Designation = { entityId: string };

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

/** 그 원천이 그 phase 로 그려진 그림 키 */
const spriteOf = (one: One, phase: string): string =>
  sceneEntity(look(room(one, { state: phase })), one.id)!.spriteId;

const PHASES = [AVAILABLE, DEPLETED, RECOVERING];

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 · SPEC-003 (화면 몫) 원천 셋의 그림이 선다', () => {
  it('S-011 원천 셋 저마다 세 phase 가 **다른 그림**이고 셋 다 실물이다', () => {
    for (const one of ADDED) {
      const three = PHASES.map((phase) => spriteOf(one, phase));
      expect({ id: one.id, distinct: new Set(three).size }).toEqual({ id: one.id, distinct: 3 });
      expect({ id: one.id, drawn: three.every((key) => key.length > 0) }).toEqual({
        id: one.id,
        drawn: true,
      });
    }
  });

  it('S-012 아홉이 서로 다르다 — 셋을 한 그림으로 뭉뚱그리지 않는다', () => {
    const nine = ADDED.flatMap((one) => PHASES.map((phase) => spriteOf(one, phase)));
    expect(nine.length).toBe(9);
    expect(new Set(nine).size).toBe(9);
  });

  it('S-013 어귀의 알갱이와 광맥의 노두는 **같은 재료인데 그림이 다르다** (Observable 5)', () => {
    const silt = ADDED.find((one) => one.id === RIVER_SILT)!;
    const outcrop = FOUR.find((one) => one.id === ORE_OUTCROP)!;
    expect(silt.material).toBe(outcrop.material);
    expect(spriteOf(silt, AVAILABLE)).not.toBe(spriteOf(outcrop, AVAILABLE));
  });

  it('S-014 그 그림이 실제로 그려진다 — 크기가 있고 자리는 세계가 말한 그대로다', () => {
    for (const one of ADDED) {
      const at = pointOf(one.region, one.id);
      const drawn = sceneEntity(look(room(one)), one.id)!;
      expect({ id: one.id, sized: drawn.size > 0 }).toEqual({ id: one.id, sized: true });
      expect({ id: one.id, x: drawn.position.x, z: drawn.position.z }).toEqual({
        id: one.id,
        x: at.x,
        z: at.z,
      });
    }
  });
});

describe('SPEC-004 · SPEC-005 (화면 몫) 조건 코드 둘에 말이 붙는다', () => {
  const silt = ADDED.find((one) => one.id === RIVER_SILT)!;

  it('S-021 이 Cycle 이 더한 코드 둘에 사람이 읽을 말이 붙어 있다', () => {
    for (const code of [FLOW_ARRIVED, CONDITION_UNMET]) {
      expect({ code, text: codeText(code) }).not.toEqual({ code, text: code });
    }
    // 그리고 **다른 말**이다 — "실려 오는 중" 과 "아직 그때가 아니다" 는 다른 사실이다
    expect(codeText(FLOW_ARRIVED)).not.toBe(codeText(CONDITION_UNMET));
  });

  it('S-022 지목하면 "지금 실려 오는 중이다" 가 그 자리에서 읽힌다', () => {
    const scene = point(room(silt, { state: DEPLETED, conditions: [FLOW_ARRIVED] }), RIVER_SILT);
    expect(rowsSay(scene, FLOW_ARRIVED)).toBe(true);
    expect(rowsSay(scene, CONDITION_UNMET)).toBe(false);
    // 그 사실 때문에 선 줄이 실제로 하나 더 있다 (문구를 몰라도 차이로 잰다)
    expect(extraRows(scene, point(room(silt, { state: DEPLETED }), RIVER_SILT)).length).toBeGreaterThan(0);
    // 지목한 것은 세계 안에서도 표시된다 (C027 그대로)
    expect(scene.highlight?.entityId).toBe(RIVER_SILT);
  });

  it('S-023 지목하면 "아직 그때가 아니다" 도 그 자리에서 읽힌다', () => {
    const scene = point(room(silt, { state: DEPLETED, conditions: [CONDITION_UNMET] }), RIVER_SILT);
    expect(rowsSay(scene, CONDITION_UNMET)).toBe(true);
    expect(rowsSay(scene, FLOW_ARRIVED)).toBe(false);
  });

  it('S-024 흐름이 출발에 매달렸으면 "되돌아옴이 멎었다" 가 함께 선다 (C012 의 코드 그대로)', () => {
    const scene = point(
      room(silt, { state: DEPLETED, conditions: [FLOW_ARRIVED, RECOVERY_STALLED] }),
      RIVER_SILT,
    );
    expect(rowsSay(scene, RECOVERY_STALLED)).toBe(true);
    expect(rowsSay(scene, FLOW_ARRIVED)).toBe(true);
  });

  it('S-025 (경계) 걸린 것이 없으면 그 줄도 없다 — 없는 조건을 지어내지 않는다', () => {
    const scene = point(room(silt), RIVER_SILT);
    for (const code of [FLOW_ARRIVED, CONDITION_UNMET, RECOVERY_STALLED]) {
      expect({ code, said: rowsSay(scene, code) }).toEqual({ code, said: false });
    }
  });
});

describe('SPEC-001 (화면 몫) 세 번째 재료가 이름으로 읽힌다', () => {
  const fungus = ADDED.find((one) => one.id === NEST_FUNGUS)!;

  it('S-031 새 재료의 코드에 이름이 붙어 있다 — 앞의 둘과 다른 이름이다', () => {
    expect({ code: GIANT_TREE_FUNGUS, text: codeText(GIANT_TREE_FUNGUS) }).not.toEqual({
      code: GIANT_TREE_FUNGUS,
      text: GIANT_TREE_FUNGUS,
    });
    expect(new Set([GIANT_TREE_FUNGUS, BIO_ORE, ORE_EATER_MOLT].map((code) => codeText(code))).size).toBe(3);
  });

  it('S-032 손에 든 자리가 코드가 아니라 재료의 이름으로 선다 (C011 S-0105 어법)', () => {
    const held = made({
      region: fungus.region,
      entities: [meAt(farSpot(fungus.region, pointOf(fungus.region, fungus.id))), sourceView(fungus)],
      hud: [{ id: `inventory.${GIANT_TREE_FUNGUS}`, kind: 'counter', value: 1 }],
    });
    const scene = look(held);
    const slot = scene.hud.find((item) => item.id === `inventory.${GIANT_TREE_FUNGUS}`);
    expect(slot).toBeDefined();
    const written = [String(slot!.label ?? ''), String(slot!.value ?? '')].join(' ');
    expect(written).not.toContain(`inventory.${GIANT_TREE_FUNGUS}`);
    expect(written).toContain(codeText(GIANT_TREE_FUNGUS));
    expect(String(slot!.value)).toContain('1');
  });

  it('S-033 지목하면 그 자연 형태가 판에서 읽힌다 (C011 S-091 어법)', () => {
    const scene = point(room(fungus), NEST_FUNGUS);
    expect(scene.targetFrame).toBeDefined();
    expect(frameSays(scene, ecologyOf(fungus.region, fungus.id).form)).toBe(true);
  });
});

describe('R10 세계 위에는 글자가 없다', () => {
  it('S-041 원천 셋의 어느 phase · 어느 조건에서도 이름표도 글자도 서지 않는다', () => {
    for (const one of ADDED) {
      const scenes = [
        look(room(one)),
        look(room(one, { state: DEPLETED, conditions: [CONDITION_UNMET] })),
        look(room(one, { state: DEPLETED, conditions: [FLOW_ARRIVED, RECOVERY_STALLED] })),
        look(room(one, { state: RECOVERING })),
      ];
      for (const scene of scenes) {
        const drawn = sceneEntity(scene, one.id)! as typeof scene.entities[number] & {
          labelValue?: unknown;
        };
        expect({ id: one.id, label: drawn.label, nameplate: drawn.nameplate }).toEqual({
          id: one.id,
          label: undefined,
          nameplate: undefined,
        });
        expect({ id: one.id, labelValue: drawn.labelValue }).toEqual({
          id: one.id,
          labelValue: undefined,
        });
        // 그리고 지면의 어느 구역에도 이름표가 서지 않는다
        expect(scene.zones.filter((zone) => zone.label !== undefined)).toEqual([]);
      }
    }
  });
});

describe('회귀', () => {
  it('R-001 (C011~C013) 원천 넷의 그림이 그대로 셋으로 갈린다', () => {
    for (const one of FOUR) {
      const three = PHASES.map((phase) => spriteOf(one, phase));
      expect({ id: one.id, distinct: new Set(three).size }).toEqual({ id: one.id, distinct: 3 });
    }
  });

  it('R-002 (C012 · C013) 앞의 코드들이 여전히 사람의 말을 갖는다', () => {
    for (const code of [SOURCE_DEPLETED, SOURCE_RECOVERING, RECOVERY_STALLED]) {
      expect({ code, text: codeText(code) }).not.toEqual({ code, text: code });
    }
    expect(codeText(SOURCE_RECOVERING)).not.toBe(codeText(SOURCE_DEPLETED));
  });

  it('R-003 새 원천이 선 방들의 땅은 그대로다 — 그림이 땅을 고쳐 그리지 않는다', () => {
    for (const one of ADDED) {
      const before = JSON.stringify(compileRegion(spaceOf(one.region), COMPILE_RULES).world);
      const hash = hashOf(one.region);
      look(room(one, { state: RECOVERING, conditions: [FLOW_ARRIVED] }));
      expect({
        id: one.region,
        world: JSON.stringify(compileRegion(spaceOf(one.region), COMPILE_RULES).world),
        hash: hashOf(one.region),
      }).toEqual({ id: one.region, world: before, hash });
    }
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 실려 오는 중인 그림이 **실려 오는 중으로 읽히는가** — 그림 키가 갈리는 것까지가 이 층의 몫이고, 그 그림이 무엇으로 보이는지는 촬영이 답한다',
  );
  it.todo(
    'GAP: 물길이 불어난 것이 **화면에서 읽히는가** — 흐름은 관찰 계약에 실리지 않으므로 화면이 그릴 것이 없다 (spec Observable · 어귀의 그림과 흙이 대신 말한다)',
  );
  it.todo(
    'GAP: 화면이 세계와 **같은 조건**을 그리는가 — 이 파일은 봉투를 손으로 지어 화면만 본다. 그 코드가 실제로 실리는지는 세계 쪽 시나리오가 잰다',
  );
});
