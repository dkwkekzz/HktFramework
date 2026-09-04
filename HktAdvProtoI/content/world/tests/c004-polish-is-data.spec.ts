// C004 — 폴리싱은 데이터로 · 검증 시나리오 (spec SPEC-001 ~ SPEC-007 · SPEC-010)
//
// 이 Cycle 은 새 규칙도 새 방도 짓지 않는다. **앞의 셋이 세운 것이 약속대로 데이터인가**를 잰다.
// 그래서 여기 있는 것은 대부분 "코드를 안 고쳐도 되는가" 의 실측이다.
//
// 세계의 공개 경로로만 본다 — driveWorld 로 굴리고, dispatch / dispatchForOutcome 으로 요청하고,
// observe() 의 관찰 결과와 world.snapshot().state 로 확인한다. 이 Cycle 이 새로 쓴 도구
// (tools/world-editor/observe.ts)는 읽지 않았다. 기대값의 출처는
// cycles/C004-polish-is-data/spec.md 의 표뿐이다.
//
// 총량 단언을 두지 않는다 — 예외는 spec 이 한 방의 관찰 결과로 못박은 자리(숲 안쪽 출구 다섯 ·
// 기본 자율 존재 둘)뿐이다.
//
// 변형(variant) 실측의 규율 — SPEC-005 · SPEC-006 은 **값만 만든다**. 컨텐츠 파일도 규칙 코드도
// 한 줄 바꾸지 않고, 지금 데이터에서 새 Description · 새 Graph · 새 목록을 값으로 지어
// 순수 검사층(checkGraph · reachableRegions · exitsOf · extentContains)과 세계에 그대로 먹인다.

import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkGraph } from '../../../engine/world-authoring/check';
import {
  descriptionHash,
  extentContains,
  pointsOf,
  type RegionDescription,
} from '../../../engine/world-authoring/description';
import {
  exitsOf,
  reachableRegions,
  type RegionGraph,
} from '../../../engine/world-authoring/graph';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import {
  ANCHOR_LAYER,
  CLOSED_CONNECTORS,
  FRONTIER_REGIONS,
  REGION_GRAPH,
  REGION_SPECS,
  START_REGION_ID,
  regionSpec,
} from '../../regions';
import { codeText } from '../../view/code-text';
import {
  DEFAULT_DEPTH_PRESENTATION,
  DEPTH_PRESENTATIONS,
  TRANSITION_TINTS,
  depthPresentation,
} from '../../view/region-presentation';
import { resolvePresentation } from '../../view/resolve';
import { STATE_VERSION, type WorldState } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

// ── spec 의 이름들 (SPEC-001 · SPEC-002 의 표에서만 왔다) ───────
const FOREST_DEEP = 'FOREST_DEEP';
const ANCIENT_GATE = 'ANCIENT_GATE';
const FANTASY_MAZE = 'FANTASY_MAZE';
const DEEP_TRAIL = 'DEEP_TRAIL';
const NEST_TRAIL = 'NEST_TRAIL';
const ORE_TRAIL = 'ORE_TRAIL';
const TREE_APPROACH = 'TREE_APPROACH';
/** 고대 문의 anchor 자리 — C002 의 표 그대로 (숲 안쪽 북서쪽 모서리) */
const ANCIENT_GATE_AT = { x: -13, z: 13 };
/** C008 이 미로를 지은 뒤에도 **아직 경계인** 문 하나 — 이 Cycle 의 주장을 잇는 예시 */
const RED_WASTE_PASS = 'RED_WASTE_PASS';

// ── 하네스 (many-exits · c003 의 선례 그대로) ──────────────────
const solo = { npcs: [] };

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const body = (w: WorldDriver) => state(w).actors.find((a) => a.id === PLAYER)!;
const exits = (v: GameViewSnapshot) => v.entities.filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string) => exits(v).find((e) => e.id === id);
const transits = (v: GameViewSnapshot) => v.interactions.filter((i) => i.id === 'transit');
const descriptions = () => REGION_SPECS.map((r) => r.space);

const askTransit = (w: WorldDriver, connector: string) =>
  w.dispatchForOutcome({ interactionId: 'transit', targetEntityId: connector })[0];
const anchorAt = (region: string, tag: string) =>
  pointsOf(regionSpec(region)!.space, ANCHOR_LAYER).find((p) => p.tag === tag)!.position;

/** 그 방 그 자리에 바로 세운 세계 — 걷지 않고 표식·대답만 보려는 자리 */
const standing = (region: string, at: { x: number; z: number }) =>
  driveWorld({ ...solo, actorRegion: region, actorPosition: at });

// ─────────────────────────────────────────────────────────────
describe('SPEC-001 — 고대 문이 열려 있다', () => {
  const connectorOf = (id: string) => REGION_GRAPH.connectors.find((c) => c.id === id);

  it('S-001 닫힌 Connector 가 하나도 없다 — CLOSED_CONNECTORS 가 비어 있다', () => {
    // Given 세계가 만들어진다 (컨텐츠 데이터가 그대로 온다)
    // Then 닫힌 목록이 비었다 — 이 한 줄이 이 Cycle 의 World Change ① 이다
    expect([...CLOSED_CONNECTORS]).toEqual([]);
  });

  it('S-002 ANCIENT_GATE 는 여전히 Graph 에 있고 from · to · direction · transition 이 C002 그대로다', () => {
    // Then 문은 지워지지 않았다 — 열렸을 뿐이다
    expect(connectorOf(ANCIENT_GATE)).toEqual({
      id: ANCIENT_GATE,
      from: { region: FOREST_DEEP, anchor: ANCIENT_GATE },
      to: { region: FANTASY_MAZE, anchor: ANCIENT_GATE },
      direction: 'one-way',
      transition: 'door',
    });
  });

  it('S-003 (경계) 문을 여는 것과 그 너머를 짓는 것은 따로다 — 아직 안 지은 곳이 남아 있다', () => {
    // C004 는 "고대 문은 열렸지만 그 너머(FANTASY_MAZE)는 아직 경계다" 로 이것을 말했다.
    // C008 이 그 방을 지었으므로 예시가 바뀐다 — 주장은 그대로다: 열린 Connector 가
    // 가리키는 곳이 늘 지어져 있는 것은 아니다 (백왕령의 고개 둘이 지금 그렇다).
    expect([...FRONTIER_REGIONS].length).toBeGreaterThan(0);
    for (const name of FRONTIER_REGIONS) expect(regionSpec(name)).toBeUndefined();
    // 그리고 미로는 이제 경계가 아니라 지어진 방이다 (C008 SPEC-001)
    expect([...FRONTIER_REGIONS]).not.toContain(FANTASY_MAZE);
    expect(regionSpec(FANTASY_MAZE)).toBeDefined();
  });

  it('S-004 (경계) 열림·닫힘은 세계 State 에 들어가지 않고 저장되지도 않는다', () => {
    const saved = driveWorld(solo).world.snapshot();
    for (const key of ['closedConnectors', 'graph', 'regions', 'frontiers']) {
      expect(saved.state).not.toHaveProperty(key);
    }
  });
});

describe('SPEC-002 — 열린 문의 표식과 대답', () => {
  it('S-005 숲 안쪽의 출구 다섯이 전부 state = open 이고 ANCIENT_GATE 의 kind 는 door 그대로다', () => {
    // Given 관찰자의 몸이 FOREST_DEEP 에 있다
    const v = standing(FOREST_DEEP, { x: 0, z: -18 }).observe();
    // Then 다섯이 전부 열려 있다 (spec 이 못박은 한 방의 출구 수)
    expect(exits(v).length).toBe(5);
    expect(exits(v).filter((e) => e.state === 'locked')).toEqual([]);
    for (const id of [ANCIENT_GATE, DEEP_TRAIL, NEST_TRAIL, ORE_TRAIL, TREE_APPROACH]) {
      expect(exitOf(v, id)?.state).toBe('open');
    }
    expect(exitOf(v, ANCIENT_GATE)?.kind).toBe('door');
    expect(transits(v).length).toBe(5);
  });

  it('S-006 아직 짓지 않은 곳을 가리키는 열린 문에 붙어 요청하면 사유는 region-not-built 다', () => {
    // C004 는 고대 문으로 이것을 말했다 — C008 이 그 너머를 지어 이제 받아들여지므로
    // 같은 주장을 아직 경계인 문(백왕령의 고개)으로 잰다. 규칙도 사유 코드도 그대로다.
    const w = standing(START_REGION_ID, anchorAt(START_REGION_ID, RED_WASTE_PASS));
    expect(transits(w.observe()).find((i) => i.targetEntityId === RED_WASTE_PASS)).toMatchObject({
      available: false,
      reason: 'region-not-built',
    });
    expect(askTransit(w, RED_WASTE_PASS)).toMatchObject({
      accepted: false,
      rule: 'RULE-REGION-TRANSIT-001',
      reason: 'region-not-built',
    });
    // 몸은 그 자리 그대로다 (Observable Result ②)
    expect(body(w).regionId).toBe(START_REGION_ID);

    // 그리고 고대 문에서는 이제 받아들여진다 — 규칙이 아니라 데이터가 바뀐 결과다 (C008 SPEC-002)
    const gate = standing(FOREST_DEEP, ANCIENT_GATE_AT);
    expect(transits(gate.observe()).find((i) => i.targetEntityId === ANCIENT_GATE)).toMatchObject({
      available: true,
    });
  });

  it('S-007 (경계) 이 세계의 어떤 방에서도 locked 표식이 나오지 않는다', () => {
    // Given 지어진 방마다 그 방에 서서 관찰한다 (방 목록은 데이터에서 온다)
    for (const spec of REGION_SPECS) {
      const anchor = pointsOf(spec.space, ANCHOR_LAYER)[0];
      if (!anchor) continue;
      const v = standing(spec.id, { x: anchor.position.x, z: anchor.position.z }).observe();
      // Then 닫힌 표식이 하나도 없다
      expect({ region: spec.id, locked: exits(v).filter((e) => e.state === 'locked') }).toEqual({
        region: spec.id,
        locked: [],
      });
    }
  });

  it('S-008 (경계) connector-inactive 는 사유 코드로도 문구로도 그대로 남는다 — 쓰이지 않을 뿐이다', () => {
    // 규칙이 지워지지 않았다: 닫힌 문이 다시 생기면 그대로 쓴다 (SPEC-006 의 변형이 그것을 잰다)
    expect(codeText('connector-inactive')).toBe('잠겨 있다');
    expect(codeText('region-not-built')).toBe('아직 갈 수 없는 곳이다');
  });
});

describe('SPEC-003 — 규칙 코드는 방과 연결의 이름을 모른다', () => {
  // 이름 목록은 **content/regions 에서 온다** — 손으로 적지 않는다.
  // 손으로 적으면 방이 늘 때 이 검사가 조용히 낡는다 (그것이 이 Cycle 이 재는 바로 그 병이다).
  const REGION_IDS = REGION_SPECS.map((r) => r.id);
  const FRONTIER_NAMES = [...FRONTIER_REGIONS];
  const CONNECTOR_IDS = REGION_GRAPH.connectors.map((c) => c.id);
  const WORLD_NOUNS = [...new Set([...REGION_IDS, ...FRONTIER_NAMES, ...CONNECTOR_IDS])];

  const HERE = dirname(fileURLToPath(import.meta.url));
  const ROOT = resolve(HERE, '..', '..', '..'); // HktAdvProtoI
  const CONTENT_WORLD = resolve(HERE, '..'); // content/world
  const CONTENT_REGIONS = join(ROOT, 'content', 'regions'); // 이름이 살아도 되는 자리 (데이터)
  const ENGINE = join(ROOT, 'engine');

  /** 그 디렉터리의 .ts 를 전부 — tests/ 와 node_modules 는 뺀다 (테스트는 이름을 알아도 된다) */
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry === 'tests' || entry === 'node_modules') continue;
        sourceFiles(path, out);
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        out.push(path);
      }
    }
    return out;
  }

  interface Hit {
    file: string;
    line: number;
    name: string;
    text: string;
  }

  function nameHits(dir: string): Hit[] {
    const hits: Hit[] = [];
    // 낱말 경계로 본다 — RED_WASTE 가 RED_WASTE_PASS 안에서 걸리는 일이 없도록.
    // (둘 다 금지된 이름이므로 결과는 같지만, 어느 이름이 어디 있는지가 정확해야 고칠 수 있다)
    const patterns = WORLD_NOUNS.map((name) => ({ name, re: new RegExp(`\\b${name}\\b`) }));
    for (const file of sourceFiles(dir)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((text, index) => {
        for (const { name, re } of patterns) {
          if (re.test(text)) {
            hits.push({ file: relative(ROOT, file), line: index + 1, name, text: text.trim() });
          }
        }
      });
    }
    return hits;
  }

  /** 실패했을 때 **어디를 고쳐야 하는지**가 그대로 보이게 한다 */
  const report = (hits: Hit[]) =>
    hits.map((h) => `${h.file}:${h.line}  ${h.name}  │ ${h.text}`).join('\n');

  it('S-009 이름 목록이 content/regions 에서 왔고 비어 있지 않다 (검사가 헛돌지 않는다)', () => {
    // Given / Then — 검사의 재료가 데이터에서 온다는 것 자체를 먼저 잰다
    expect(REGION_IDS.length).toBeGreaterThan(0);
    expect(FRONTIER_NAMES.length).toBeGreaterThan(0);
    expect(CONNECTOR_IDS.length).toBeGreaterThan(0);
    // 훑을 파일도 있어야 한다
    expect(sourceFiles(CONTENT_WORLD).length).toBeGreaterThan(0);
    expect(sourceFiles(ENGINE).length).toBeGreaterThan(0);
    // 그리고 이 검사가 이름을 **찾을 수 있다** — 이름이 살아도 되는 자리(content/regions)에서는 걸린다.
    // 이것이 없으면 S-010 · S-011 이 헛돌아도 통과한다
    expect(nameHits(CONTENT_REGIONS).length).toBeGreaterThan(0);
  });

  it('S-010 content/world 의 코드(테스트 제외) 어디에도 방·경계·Connector 의 이름이 없다', () => {
    // Given content/world 의 .ts 를 전부 읽는다 (tests/ 는 뺀다)
    // Then 데이터의 이름이 규칙 코드에 하나도 나타나지 않는다
    expect(report(nameHits(CONTENT_WORLD))).toBe('');
  });

  it('S-011 (경계) engine 도 마찬가지다 — 기반은 게임 명사를 모른다', () => {
    expect(report(nameHits(ENGINE))).toBe('');
  });

  it('S-012 (경계) transition 갈래 이름은 이 검사의 대상이 아니다 — 규칙이 갈래에 반응하는 것이 규칙의 내용이다', () => {
    // 'falling' 은 어떤 방이나 연결의 **이름**이 아니라 연결의 **갈래**다.
    // 그래서 목록에 넣지 않았고, 규칙 코드가 그것을 아는 것은 정상이다.
    const kinds = new Set(REGION_GRAPH.connectors.map((c) => c.transition));
    for (const kind of kinds) expect(WORLD_NOUNS).not.toContain(kind);
    // 실제로 규칙 코드가 그 갈래를 안다 — 추락 규칙이 falling 을 읽는다
    const fallRule = readFileSync(join(CONTENT_WORLD, 'simulation', 'region-fall.ts'), 'utf8');
    expect(fallRule).toContain('falling');
  });
});

describe('SPEC-004 — 세계가 시작하는 방은 데이터다', () => {
  it('S-013 시작하는 방의 이름을 content/regions 가 소유한다 — 그 방은 지어져 있다', () => {
    // Given / Then — 이름이 사는 자리가 데이터다 (규칙 코드가 아니다)
    expect(typeof START_REGION_ID).toBe('string');
    expect(REGION_SPECS.map((r) => r.id)).toContain(START_REGION_ID);
  });

  it('S-014 관찰자의 몸 · 기본 자율 존재 둘 · 광맥 하나가 그 방에 선다 (행동은 하나도 바뀌지 않는다)', () => {
    // Given 기본 배치의 세계 (npc 둘 · 광맥 하나)
    const w = driveWorld();
    const s = state(w);
    // Then 셋 다 시작 방이다
    expect(body(w).regionId).toBe(START_REGION_ID);
    const autonomous = s.actors.filter((a) => a.control === 'autonomous');
    expect(autonomous.length).toBe(2); // spec 이 못박은 수
    for (const npc of autonomous) expect(npc.regionId).toBe(START_REGION_ID);
    for (const deposit of s.deposits) expect(deposit.regionId).toBe(START_REGION_ID);
    expect(s.deposits.length).toBe(1); // spec 이 못박은 수
  });
});

// ── 변형 데이터 실측 (SPEC-005 · SPEC-006) ─────────────────────
//
// 아래의 변형은 전부 **값**이다. 컨텐츠 파일에 방을 늘리지 않는다 (spec UNRESOLVED 판정 —
// 남은 경계 셋은 이 Play 밖이거나 C005 의 것이다).

/** 지금 데이터의 Graph 에 값만 얹은 변형 */
const withGraph = (patch: Partial<RegionGraph>): RegionGraph =>
  ({ ...REGION_GRAPH, ...patch }) as RegionGraph;

describe('SPEC-005 — 방을 더하는 것은 데이터다', () => {
  // 변형에만 사는 이름 — 세계의 데이터에는 들어가지 않는다
  const VARIANT_ROOM = 'VARIANT_ROOM';
  const VARIANT_TRAIL = 'VARIANT_TRAIL';

  /** 시작 방의 anchor 하나를 빌려 쓴다 — 이름을 손으로 적지 않으려고 데이터에서 고른다 */
  const startAnchor = () => pointsOf(regionSpec(START_REGION_ID)!.space, ANCHOR_LAYER)[0]!;

  const variantRoom = (): RegionDescription => ({
    id: VARIANT_ROOM,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 1,
    ops: [
      {
        id: 'variant-anchor-1',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: VARIANT_TRAIL,
        position: { x: 0, z: -18 },
      },
    ],
  });

  const variantGraph = (): RegionGraph =>
    withGraph({
      regions: [...REGION_GRAPH.regions, VARIANT_ROOM],
      connectors: [
        ...REGION_GRAPH.connectors,
        {
          id: VARIANT_TRAIL,
          from: { region: START_REGION_ID, anchor: startAnchor().tag },
          to: { region: VARIANT_ROOM, anchor: VARIANT_TRAIL },
          direction: 'bidirectional',
          transition: 'trail',
        },
      ],
    });

  it('S-015 방 하나와 그 방으로 가는 Connector 하나를 값으로 더하면 검사 오류가 0 이다', () => {
    // Given 지금 데이터 + 값으로 지은 방 하나 · Connector 하나 (코드는 한 줄도 바꾸지 않는다)
    const graph = variantGraph();
    const specs = [...descriptions(), variantRoom()];
    // Then 검사가 아무 말도 하지 않는다
    expect(checkGraph(specs, graph, ANCHOR_LAYER, START_REGION_ID)).toEqual([]);
  });

  it('S-016 시작 방에서 새 방까지 닿는다', () => {
    const reached = reachableRegions(variantGraph(), START_REGION_ID);
    expect(reached).toContain(VARIANT_ROOM);
  });

  it('S-017 더한 방에서 나가는 끝이 exitsOf 로 나온다', () => {
    const out = exitsOf(variantGraph(), VARIANT_ROOM);
    expect(out.map((e) => e.connector.id)).toContain(VARIANT_TRAIL);
    // 그 끝의 이쪽은 새 방이고 저쪽은 시작 방이다
    const exit = out.find((e) => e.connector.id === VARIANT_TRAIL)!;
    expect(exit.here.region).toBe(VARIANT_ROOM);
    expect(exit.there.region).toBe(START_REGION_ID);
  });

  it('S-018 (경계) 경계를 지어 방으로 만들면서 경계 목록에서 빼지 않으면 frontier-built 다', () => {
    // Given 경계 하나(데이터가 고른다)에 Description 을 값으로 지어 준다.
    //       그 경계를 가리키는 Connector 들이 쓰는 anchor 를 그대로 만들어 둔다 (검사 ⑤ 를 통과하도록)
    const frontier = FRONTIER_REGIONS[0]!;
    const anchorTags = [
      ...new Set(
        REGION_GRAPH.connectors
          .flatMap((c) => [c.from, c.to])
          .filter((end) => end.region === frontier)
          .map((end) => end.anchor),
      ),
    ];
    const builtFrontier: RegionDescription = {
      id: frontier,
      extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
      seed: 2,
      ops: anchorTags.map((tag, i) => ({
        id: `frontier-anchor-${i}`,
        kind: 'point' as const,
        layer: ANCHOR_LAYER,
        tag,
        position: { x: 0, z: -18 + i },
      })),
    };
    const specs = [...descriptions(), builtFrontier];

    // When 경계 목록을 그대로 두면
    const stillFrontier = checkGraph(specs, REGION_GRAPH, ANCHOR_LAYER, START_REGION_ID);
    // Then 검사가 잡아낸다 (C003 이 RED_EYE_TREE 로 실제로 겪은 순서 그대로)
    expect(stillFrontier.map((i) => i.code)).toContain('frontier-built');
    expect(stillFrontier.find((i) => i.code === 'frontier-built')?.region).toBe(frontier);

    // When 목록에서 빼면
    const removed = checkGraph(
      specs,
      withGraph({ frontiers: FRONTIER_REGIONS.filter((n) => n !== frontier) }),
      ANCHOR_LAYER,
      START_REGION_ID,
    );
    // Then 오류가 0 이다 — 방을 짓는 것도 값 두 개(Description 하나 · 목록 한 줄)의 일이다
    expect(removed).toEqual([]);
  });

  it('S-019 (경계) 변형은 세계의 데이터를 하나도 바꾸지 않는다', () => {
    const before = JSON.stringify({ specs: REGION_SPECS, graph: REGION_GRAPH });
    checkGraph([...descriptions(), variantRoom()], variantGraph(), ANCHOR_LAYER, START_REGION_ID);
    expect(JSON.stringify({ specs: REGION_SPECS, graph: REGION_GRAPH })).toBe(before);
  });
});

describe('SPEC-006 — 방을 넓히는 것도 · 문을 여닫는 것도 데이터다', () => {
  /** 그 방의 extent 밖으로 한 걸음 나간 자리 */
  const justOutside = (extent: { maxX: number }) => ({ x: extent.maxX + 5, z: 0 });

  it('S-020 어느 방의 extent 를 넓힌 변형에서는 그 방 밖이던 좌표가 안이 된다', () => {
    // Given 시작 방의 지금 extent 와, 값만 넓힌 변형
    const now = regionSpec(START_REGION_ID)!.space.extent;
    const out = justOutside(now);
    const wider = { ...now, maxX: now.maxX + 20, minX: now.minX - 20 };

    // Then 같은 좌표의 판정이 갈린다 — 규칙이 읽는 값 하나가 달라졌을 뿐이다
    expect(extentContains(now, out)).toBe(false);
    expect(extentContains(wider, out)).toBe(true);
  });

  it('S-021 지금 데이터에서는 그 좌표가 방 밖이다 — RULE-MOVE-001 이 그 extent 를 읽는다', () => {
    // Given 시작 방에 선 몸
    const w = driveWorld(solo);
    const out = justOutside(regionSpec(START_REGION_ID)!.space.extent);
    // Then 이동이 거절된다 (넓힌 변형이 세계에 들어가면 이 답이 뒤집힌다는 것이 SPEC-006 의 주장이다)
    expect(w.dispatch({ interactionId: 'move', position: out })).toMatchObject({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'out-of-bounds',
    });
    // 시점 거리가 방의 크기를 따라간다는 비례는 C003 이 이미 쟀다 (region-c003.spec.ts) —
    // 여기서는 같은 extent 를 세계와 View 가 함께 읽는다는 것까지만 본다
    expect(regionSpec(START_REGION_ID)!.space.extent.maxX).toBeGreaterThan(0);
  });

  it('S-022 열린 Connector 하나를 닫은 목록에 넣은 변형에서는 그 끝이 locked 로 갈리고 건너기가 connector-inactive 로 거절된다', async () => {
    // Given 닫힘 판정(isConnectorOpen)이 읽는 목록 하나를 **값으로** 바꿔 세계를 세운다.
    //       규칙 코드도 컨텐츠 파일도 손대지 않는다 — 이 목록만 다른 값이다.
    //       (판정이 모듈 상수라 목록을 값으로 주는 방법이 이것뿐이다 — spec 이 침묵한 자리 · 보고 ②)
    vi.resetModules();
    vi.doMock('../../regions', async () => {
      const actual = await vi.importActual<typeof import('../../regions')>('../../regions');
      return { ...actual, CLOSED_CONNECTORS: [ANCIENT_GATE] };
    });
    try {
      const { driveWorld: driveVariant } = await import('./drive');
      const w = driveVariant({ ...solo, actorRegion: FOREST_DEEP, actorPosition: ANCIENT_GATE_AT });
      const v = w.observe() as GameViewSnapshot;

      // Then 그 끝의 state 가 locked 로 갈린다
      expect(v.entities.find((e) => e.id === ANCIENT_GATE)?.state).toBe('locked');
      // 나머지 넷은 그대로 열려 있다 — 값 하나가 한 끝만 바꾼다
      for (const id of [DEEP_TRAIL, NEST_TRAIL, ORE_TRAIL, TREE_APPROACH]) {
        expect(v.entities.find((e) => e.id === id)?.state).toBe('open');
      }
      // 그리고 건너기가 connector-inactive 로 거절된다 (열려 있을 때는 region-not-built 였다)
      expect(
        w.dispatchForOutcome({ interactionId: 'transit', targetEntityId: ANCIENT_GATE })[0],
      ).toMatchObject({
        accepted: false,
        rule: 'RULE-REGION-TRANSIT-001',
        reason: 'connector-inactive',
      });
    } finally {
      vi.doUnmock('../../regions');
      vi.resetModules();
    }
  });

  it('S-023 (경계) 같은 규칙이 두 답을 낸다 — 규칙을 고쳐서 되는 것이 아니다', () => {
    // Given 지금 데이터의 세계 (닫힌 목록이 비었다)
    // Then 같은 규칙 id 가 이번에는 region-not-built 를 낸다 — S-022 와 규칙이 같다.
    // C008 이 미로를 지어 고대 문은 성공이 되었으므로, 아직 경계인 문으로 같은 것을 잰다.
    const w = standing(START_REGION_ID, anchorAt(START_REGION_ID, RED_WASTE_PASS));
    expect(askTransit(w, RED_WASTE_PASS)).toMatchObject({
      rule: 'RULE-REGION-TRANSIT-001',
      reason: 'region-not-built',
    });
  });
});

describe('SPEC-007 — 색과 표식은 표다', () => {
  // 표현의 폴백을 이 Cycle 의 world 테스트에서 함께 잰다 (새 파일을 만들지 않는다).
  // World 는 기동하지 않는다 — 관찰 계약이 허락하는 값만 손으로 지어 넣고
  // "표에 없는 값이 와도 화면이 멈추지 않는가" 만 본다.

  function exit(id: string, kind: string, state: 'open' | 'locked' = 'open'): EntityView {
    return { id, role: 'region-exit', state, kind, position: { x: 0, z: 18 } };
  }

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
        {
          id: 'player',
          role: 'player-character',
          state: 'idle',
          kind: 'rabbit-swordsman',
          position: { x: 0, z: 0 },
        },
        ...entities,
      ],
      interactions,
      hud: [{ id: 'region.depth', kind: 'label', value: depth }],
      strikes: [],
      debug: { open: false },
      commands: [],
    } as GameViewSnapshot;
  }

  const UNKNOWN_DEPTH = 'abyss';
  const UNKNOWN_TRANSITION = 'ladder';

  it('S-024 표에 없는 depth 태그가 와도 멈추지 않는다 — 무채색 기본값으로 결정된다', () => {
    // Given 표에 없는 태그
    expect(DEPTH_PRESENTATIONS[UNKNOWN_DEPTH]).toBeUndefined();
    // Then 기본값이 온다 (판정이 아니라 폴백이다)
    expect(depthPresentation(UNKNOWN_DEPTH)).toEqual(DEFAULT_DEPTH_PRESENTATION);
    // 그리고 화면 결정이 오류 없이 끝난다 — HUD 에는 코드가 그대로 실린다
    const plan = resolvePresentation(snapshot(START_REGION_ID, UNKNOWN_DEPTH));
    expect(plan.hud.find((h) => h.id === 'region.depth')?.value).toBe(UNKNOWN_DEPTH);
  });

  it('S-025 표에 없는 transition 종류로 그려도 멈추지 않는다 — 색 없이 열린 표식이다', () => {
    // Given 표에 없는 갈래
    expect(TRANSITION_TINTS[UNKNOWN_TRANSITION]).toBeUndefined();
    // When 그 갈래의 출구를 그린다
    const plan = resolvePresentation(
      snapshot(START_REGION_ID, 'civil', [exit('VARIANT_EXIT', UNKNOWN_TRANSITION)]),
    );
    const drawn = plan.entities.find((e) => e.id === 'VARIANT_EXIT');
    // Then 표식은 그려지고 색만 없다
    expect(drawn?.spriteId).toBe('region-exit:open');
    expect(drawn?.tint).toBeUndefined();
  });

  it('S-026 색의 유일한 출처가 표다 — 표에 줄이 있으면 색이 붙고 없으면 안 붙는다', () => {
    // Given 지금 데이터가 쓰는 갈래 전부 + 표에 없는 갈래 하나
    const kinds = [
      ...new Set(REGION_GRAPH.connectors.map((c) => c.transition)),
      UNKNOWN_TRANSITION,
    ];
    const plan = resolvePresentation(
      snapshot(
        START_REGION_ID,
        'civil',
        kinds.map((kind) => exit(`EXIT_${kind}`, kind)),
      ),
    );
    // Then 색이 붙은 것과 표에 줄이 있는 것이 정확히 같다
    for (const kind of kinds) {
      const drawn = plan.entities.find((e) => e.id === `EXIT_${kind}`);
      expect({ kind, tinted: drawn?.tint !== undefined }).toEqual({
        kind,
        tinted: TRANSITION_TINTS[kind] !== undefined,
      });
      if (TRANSITION_TINTS[kind] !== undefined) expect(drawn?.tint).toBe(TRANSITION_TINTS[kind]);
    }
  });

  it('S-027 (경계) 표에 없는 것이 오류로 뜨지 않는다 — 미등록 사유 코드는 코드 그대로다', () => {
    const plan = resolvePresentation(
      snapshot(
        START_REGION_ID,
        UNKNOWN_DEPTH,
        [exit('VARIANT_EXIT', UNKNOWN_TRANSITION)],
        [
          {
            id: 'transit',
            role: 'transit-connector',
            targetEntityId: 'VARIANT_EXIT',
            available: false,
            reason: 'some-new-reason',
          },
        ],
      ),
    );
    expect(plan.interactions.find((i) => i.id === 'transit')?.unavailableText).toBe(
      'some-new-reason',
    );
  });
});

describe('SPEC-010 — 앞의 세 Cycle 이 그대로다', () => {
  it('S-028 이 Cycle 은 저장되는 State 를 늘리지 않았다', () => {
    // C004 는 이 값을 'hkt-adv-proto-i/2' 로 못박아 "올리지 않았다" 를 말했다.
    // C008 이 Region State 를 저장하면서 올렸으므로(spec R5) 글자를 재는 것은 더 이상
    // C004 의 주장이 아니다 — 남은 것은 "세계가 찍는 판이 팩의 판과 같다" 다.
    expect(driveWorld(solo).world.snapshot().version).toBe(STATE_VERSION);
  });

  it('S-029 관찰 계약의 갈래가 그대로다 — region-exit 의 state 는 여전히 open | locked 다', () => {
    // 이 세계의 데이터에서 locked 가 나오지 않을 뿐, 갈래가 없어진 것이 아니다 (spec R2).
    // 값으로 닫으면 locked 가 그대로 온다는 것은 S-022 가 실제로 쟀다.
    const v = standing(FOREST_DEEP, { x: 0, z: -18 }).observe();
    for (const e of exits(v)) {
      expect(['open', 'locked']).toContain(e.state);
      expect(Object.keys(e).sort()).toEqual(['id', 'kind', 'position', 'role', 'state'].sort());
    }
  });
});
