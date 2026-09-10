// World Authoring — 뼈대 생성기 (T3 CHANGED · space · graph · resourceEcology · phases · ecology ·
// T2 확장 CHANGED · access).
//
// **굳힌 파일이 컴파일되는 것까지가 이 생성기의 일이다.** 값이 맞아도 형이 다르면 방은 서지 못한다 —
// 그래서 AuthoredSource 는 컨텐츠의 원천 표와 같은 형이고, 시험이 굳힌 파일을 실제로 컴파일한다.
//
// RegionBrief(T2) 하나에서 방 하나의 **뼈대**를 낸다 — Description 의 op 들, 그 방이 들이는
// Connector 들, 그리고 방 이름 한 줄. `world:author` 가 이것을 파일로 굳힌다.
//
// **뼈대이지 완성이 아니다.** 손으로 쓴 방들이 지닌 실측 근거(왜 반경 10 인가 · 왜 깊이 9 인가)를
// 생성기가 지어낼 수는 없다. 생성기가 대는 것은 **서기는 하는 방** 하나다 — 검사 아홉(T1)을
// 통과하고, 놓인 원천에 걸어 닿을 수 있는 방.
//
// **게임 명사가 없다.** 어느 갈래가 어떤 땅을 얻고 어느 역할이 얼마나 주는지, 어떤 탄생 방식이
// 얼마나 걸리고 어느 갈래의 방이 어느 철에 달라지는지는 전부 `AuthorTemplates` 로 받는다
// (content/authoring/templates). 이 파일이 아는 것은 "갈래마다 땅 묶음이 있다 · 역할마다
// 기본형이 있다 · 방식마다 기본형이 있다" 는 형뿐이다.
//
// **지어내지 않는다.** 표에 기본형이 없는 탄생 방식 · 표에 없는 세계 상태는 값이 되지 못한다 —
// 그때 내는 것은 지어낸 값이 아니라 `unauthored` 의 한 줄(왜 못 냈는가)이다.
//
// **결정론.** 같은 brief 는 언제나 같은 방을 낸다 — seed 는 brief 를 해시한 값이고,
// 자리는 전부 그 seed 와 배열 순서에서 나온다. 시각도 난수도 쓰지 않는다.

import type { CompiledWorldTerrain } from './compiled';
import type { AnswerKey, RegionBrief } from './brief';
import { isUnanswered, unansweredKeys } from './brief';
import type { AreaOp, PointOp, RegionDescription, RegionOp, StampOp, XZ } from './description';
import { isTraversableAt } from './query';

/**
 * 땅 한 자국 — **방 크기에 견준 비율**로 적는다. 절대 좌표를 두지 않으므로
 * 같은 묶음이 큰 방에도 작은 방에도 선다.
 */
export interface TerrainRecipe {
  id: string;
  stamp: StampOp['stamp'];
  /** 방 반지름에 대한 비 (−1 … 1) */
  center: XZ;
  /** 방 반지름에 대한 비 */
  radius: number;
  /** 방 반지름에 대한 비 */
  height: number;
  falloff?: number;
}

/** 역할별 원천 기본형 — 얼마나 주는가 · 어떻게 다시 나는가 · 무너지는가 · 얼마 만에 */
export interface SourceDefaults {
  supply: string;
  harvests: number;
  collapses?: boolean;
  /**
   * 되돌아오기까지의 시간 규모 (초). **brief 가 답하지 않는다** — 시간 규모는 지어낼 값이
   * 아니라 이 세계가 정한 상수라, 역할마다의 기본형으로 온다 (supply · harvests 와 같은 자리).
   */
  recoverySeconds: number;
}

/** 깊이별 방의 크기와 흔적의 바탕 세기 */
export interface DepthDefaults {
  /** 방 반지름 — extent 는 이것의 두 배 정사각형이다 */
  half: number;
  /** 이 깊이의 흔적 바탕 세기 */
  traceBase: number;
}

/**
 * 탄생 방식별 기본형 — 얼마나 걸리는가 · 얼마나 머무는가 · 개체군을 어떻게 묻는가 (T3 ADDED).
 *
 * 원천의 `SourceDefaults` 와 같은 자리다: brief 가 답하지 않는 **시간 규모와 요구의 꼴**은
 * 지어낼 값이 아니라 이 세계가 방식마다 정해 둔 상수라, 방식의 이름으로 여기서 온다.
 */
export interface BirthDefaults {
  /** 결속에 걸리는 세계 초 */
  bindingSeconds: number;
  /** 태어난 뒤 머무는 세계 초 — 밝히지 않으면 BORN 다음 tick 에 곧장 DORMANT */
  spentSeconds?: number;
  /** 다 차면 어디로 — 밝혀만 두는 자리다 */
  transition: { from: string; to: string };
  /** 그 방식이 개체군에 거는 요구 — 없으면 걸지 않는다 */
  populationRequirement?: { kind: string; value: number; unmetCode: string };
  /** 소비하는 원천이 서 있지 않을 때의 모자람 코드 */
  sourceUnmetCode: string;
}

/**
 * 재료가 아닌 세계 상태 하나가 어떤 요구가 되는가 (T3 ADDED).
 *
 * brief 는 "무엇으로 맺히는가" 를 재료와 상태로 갈라 답할 뿐이고, 그 상태가 세계에서
 * **어떻게 물어지는가**(무슨 갈래의 요구이고 못 찼을 때 무슨 코드인가)는 컨텐츠의 것이다.
 * 표에 없는 상태는 요구가 되지 않는다 — 모르는 상태를 요구로 지어내지 않는다.
 */
export interface StateRequirement {
  kind: string;
  unmetCode: string;
}

/** 개체군의 기본형 — 방마다 달라지지 않는 값들 (T3 ADDED) */
export interface PopulationDefaults {
  /** 탄생 하나가 그 방에 올리는 소란 — 밝히지 않으면 올리지 않는다 */
  birthDisturbance?: number;
  /** 값 n 번째 자락의 반지름 = half × radiusStep × n */
  radiusStep: number;
}

/**
 * 갈래별 철 덧씌움 하나 — 원천 둘레의 자락에 건다 (T3 ADDED).
 *
 * 땅 묶음(`TerrainRecipe`)이 갈래마다 오는 것과 같은 자리다: 어느 갈래의 방이 어느 철에
 * 어떻게 읽히는가는 이 세계의 판단이지 생성기의 것이 아니다.
 */
export interface PhaseRecipe {
  /** 어느 철 */
  season: string;
  /** 그 철에 그 자락이 어느 깊이로 읽히는가 */
  depth?: string;
  /** 그 철에 그 자락이 어느 위험으로 읽히는가 */
  hazard?: string;
}

export interface AuthorTemplates {
  anchorLayer: string;
  resourceLayer: string;
  traceLayer: string;
  /** 흔적 세기 → 태그. 세기의 상한도 컨텐츠가 안다 */
  traceTag(level: number): string;
  byDepth: Readonly<Record<string, DepthDefaults>>;
  /** 표에 없는 깊이의 방 */
  depthFallback: DepthDefaults;
  /** 갈래별 땅 묶음 */
  terrainByKind: Readonly<Record<string, readonly TerrainRecipe[]>>;
  /** 갈래가 없거나 표에 없는 방의 땅 */
  terrainFallback: readonly TerrainRecipe[];
  sourceByRole: Readonly<Record<string, SourceDefaults>>;
  /** 떼의 자락이 사는 layer */
  presenceLayer: string;
  /** 깊이 · 위험 덧씌움 area 가 사는 layer 둘 */
  depthLayer: string;
  hazardLayer: string;
  /** 탄생 방식별 기본형 — 표에 없는 방식이 오면 그 탄생지는 서지 않는다 (지어내지 않는다) */
  birthByMode: Readonly<Record<string, BirthDefaults>>;
  /** 재료가 아닌 세계 상태 → 요구. 표에 없는 상태는 요구가 되지 않는다 */
  stateRequirement: Readonly<Record<string, StateRequirement>>;
  population: PopulationDefaults;
  /** 갈래별 철 덧씌움 */
  phaseByKind: Readonly<Record<string, readonly PhaseRecipe[]>>;
  /**
   * 물음의 흔적이 사는 layer (T2 확장 ADDED).
   *
   * 흔적은 layer 하나에 갇히지 않으나(손으로 쓴 방들은 trace 와 clue 에 나눠 두었다) **생성기가
   * 낼 자리는 하나**다 — 어느 흔적이 어느 layer 로 읽혀야 하는지는 잰 적이 없어 지어내지 않는다.
   */
  clueLayer: string;
}

/** 생성기가 내는 원천 하나 — 컨텐츠의 원천 표와 같은 이름들이다 */
/**
 * 생성기가 내는 원천 하나 — 컨텐츠의 원천 표와 **같은 이름 · 같은 형**이다.
 *
 * 같아야 하는 이유는 하나다: 이 값이 그대로 글자가 되어 `content/regions/<방>.ts` 에 굳고,
 * 그 파일은 컴파일되어야 한다. 이름 하나만 달라도(traceOp/traceOps) 굳힌 방이 서지 못한다.
 */
export interface AuthoredSource {
  id: string;
  materialId: string;
  /** 무엇이 그것을 낳았는가 — brief 가 답한다 */
  worldCause: string;
  form: string;
  carrier: string;
  opportunity: string;
  supply: string;
  /** 무엇이 그것을 되돌리는가 — brief 가 답한다 */
  recoveryCause: string;
  harvests: number;
  collapses?: boolean;
  /** 얼마 만에 되돌아오는가 — 역할별 기본형이 정한다 */
  recoverySeconds: number;
  /** 이 원천 둘레의 흔적 op 들 — 고갈이 한 단계 낮출 자리 */
  traceOps: string[];
}

export interface AuthoredConnector {
  id: string;
  from: { region: string; anchor: string };
  to: { region: string; anchor: string };
  direction: 'bidirectional' | 'one-way';
  transition: string;
}

/**
 * 결속의 요구 하나 — 컨텐츠의 요구 표와 **같은 형**이다 (T3 ADDED).
 *
 * 컨텐츠 쪽은 갈래마다 필드가 갈리는 합집합이지만 생성기는 한 형으로 낸다 — 갈래에 따라
 * 밝히는 필드가 다를 뿐이고, 밝히지 않은 키는 굳힐 때 나가지 않는다.
 * 키 차례는 컨텐츠의 그것과 같다: 무엇을 묻는가 → 누구에게 → 얼마를 → 못 차면 무슨 말인가.
 */
export interface AuthoredLifeRequirement {
  kind: string;
  sourceId?: string;
  populationId?: string;
  value?: number;
  unmetCode: string;
}

/**
 * 생성기가 내는 탄생지 하나 — 컨텐츠의 탄생지 표와 **같은 이름 · 같은 형 · 같은 차례**다.
 *
 * 원천(`AuthoredSource`)이 그런 그대로다: 이 값이 그대로 글자가 되어 방 파일에 굳고 그 파일은
 * 컴파일되어야 하므로, 이름 하나 차례 하나가 달라도 굳힌 방이 서지 못한다.
 *
 * **자리는 여기 없다** — 자리는 그 방 Description 의 resource layer point 가 소유하고,
 * 탄생지의 id 와 point 의 tag 가 같은 이름으로 이어진다 (원천이 세운 그 어법).
 */
export interface AuthoredLifeSite {
  id: string;
  /** 어떻게 태어나는가 — brief 가 답한다 */
  mode: string;
  /** 무엇이 그것을 낳았는가 — brief 가 답한다 */
  worldCause: string;
  form: string;
  /** 무엇으로 맺히는가 — 재료와, 재료가 아닌 세계 상태 */
  source: { materials: string[]; states: string[] };
  /** 무엇이 이것을 일으키고 무엇을 요구하는가 */
  condition: { regionRule: string; requires: AuthoredLifeRequirement[] };
  /** 다 차면 어디로 — 방식별 기본형이 정한다 (밝혀만 두는 자리다) */
  transition: { from: string; to: string };
  consumes: string[];
  /** 남기는 것이 없으면 이 키를 두지 않는다 — 빈 배열을 굳혀 두면 없음이 목록으로 읽힌다 */
  leaves?: string[];
  spentSeconds?: number;
  /**
   * 전조와 그 뒤에 남는 것. 생성기가 내는 전조는 **하나**이고 뒤에 남는 것은 **없다** —
   * 자락이 무엇을 뜻하는지(가려짐 · 옅어짐 · 선 자리의 말)는 잰 적이 없어 지어내지 않는다.
   */
  traces: { before: { op: string }[]; after: string[] };
  ecologicalRole: string;
  population: string;
  bindingSeconds: number;
}

/** 생성기가 내는 개체군 하나 — 컨텐츠의 개체군 표와 같은 이름 · 같은 차례다 */
export interface AuthoredPopulation {
  id: string;
  scale: number;
  declineCause: string;
  presence?: string;
  presenceOps?: string[];
  birthDisturbance?: number;
}

/**
 * 개체군 사이의 관계 하나. `via` 는 생성기가 내지 않는다 —
 * 두 끝이 어느 방에 사는지를 brief 하나로는 알 수 없다 (아래 authorRegion 의 주석).
 */
export interface AuthoredLink {
  from: string;
  to: string;
  kind: string;
  via?: string;
}

/** 그 방이 품은 생명 계통 — 낼 것이 하나도 없으면 이 자리 자체를 내지 않는다 */
export interface AuthoredEcology {
  lifeFormation?: AuthoredLifeSite[];
  populations?: AuthoredPopulation[];
  links?: AuthoredLink[];
  /** 탄생지가 하나도 없는 방이 밝히는 사유 — 없음이 침묵이 아니라 답이 된다 */
  absenceReason?: string;
}

/** 그 철에 이 방이 달라지는 것 — 밝히지 않은 것은 달라지지 않는다 */
export interface AuthoredPhaseSeason {
  depthOverlay?: { areaId: string; depth: string }[];
  hazardExtend?: { areaId: string; hazard: string }[];
}

/**
 * 방의 위상. 생성기가 내는 것은 **철별 덧씌움 하나**뿐이다 —
 * 깨어난 방(awake) · 늘 걸리는 것(standing) · 뒤척임(onTurn)은 잰 적이 없어 내지 않는다.
 */
export interface AuthoredPhases {
  seasons: Record<string, AuthoredPhaseSeason>;
}

/**
 * 요구 하나 — 컨텐츠의 요구 표와 **같은 형 · 같은 키 차례**다 (T2 확장 ADDED).
 *
 * 넷 다 선택이고, 밝힌 갈래가 전부 참이어야 그 Lock 이 열린다. **아무것도 밝히지 않은 요구는
 * 생성기가 내지 않는다** — 요구가 없는 것과 같은 것을 굳혀 두면 형이 거짓말을 한다.
 */
export interface AuthoredLockRequirement {
  property?: string;
  time?: { seasons: string[] };
  state?: { region: string; patterns: string[] };
  knowledge?: string;
}

/**
 * 그 요구를 알아낼 흔적 하나 — 가리키는 것은 그 방 Description 의 **op id** 다.
 * `showsOnBody` 는 내지 않는다: 무엇이 몸에 걸려야 하는지는 brief 가 답하지 않았다.
 */
export interface AuthoredLockTrace {
  op: string;
}

/** 생성기가 내는 Lock 하나 — 컨텐츠의 Lock 표와 같은 이름 · 같은 형 · 같은 차례다 */
export interface AuthoredLock {
  id: string;
  at: { kind: string; ref: string };
  strength: string;
  requires: AuthoredLockRequirement[];
  /** 거짓이면 키를 두지 않는다 — 밝히지 않은 것과 밝혀서 거짓인 것을 가르지 않는다 */
  important?: boolean;
  traces: AuthoredLockTrace[];
  reason?: string;
}

/**
 * 그 방이 묻는 것 — 낼 것이 하나도 없으면 이 자리 자체를 내지 않는다 (ecology 의 어법).
 *
 * 둘은 **함께 서지 않는다**: 묻는 방이면 `locks` 이고, 묻지 않는 방이면 `silence` 다.
 */
export interface AuthoredAccess {
  locks?: AuthoredLock[];
  /** 왜 묻지 않는가 — 묻지 않는 방만 (ecology.absenceReason 의 어법) */
  silence?: string;
}

export interface AuthoredSpec {
  id: string;
  depth: string;
  space: RegionDescription;
  resourceEcology?: { sources: AuthoredSource[] };
  /** 키 차례는 컨텐츠의 RegionSpec 그대로다 — resourceEcology 다음 · access 앞 */
  phases?: AuthoredPhases;
  /** 키 차례는 컨텐츠의 RegionSpec 그대로다 — phases 다음 · ecology 앞 */
  access?: AuthoredAccess;
  ecology?: AuthoredEcology;
}

export interface AuthoredRegion {
  spec: AuthoredSpec;
  /** 이 방이 들이는 Connector 들 — graph 에 이어 붙일 줄들 */
  connectors: AuthoredConnector[];
  /** 방 이름 — view 표에 이어 붙일 줄 */
  name: string;
  /**
   * 이웃 쪽에 늘어야 하는 anchor 들. 생성기는 **그 방의 땅을 모르므로 자리를 정하지 못한다** —
   * 이름만 대고, 놓지 않으면 검사 ⑤(missing-anchor)가 잡는다.
   */
  neighbourAnchors: { region: string; anchor: string }[];
  /** 이 방이 아직 답하지 못한 질문들 — 뼈대는 서되 비어 있다는 것이 함께 나온다 */
  unanswered: AnswerKey[];
  /**
   * 형은 맞았으나 기본형이 없어 내지 못한 것들 — 지어내는 대신 왜 못 냈는지를 남긴다 (T3 ADDED).
   *
   * `unanswered` 곁에 선다: 저것은 **사람이 아직 답하지 않은 것**이고 이것은 **답은 있는데
   * 세계의 표에 그 어휘가 없는 것**이다. 둘 다 뼈대는 서되 비어 있다는 것이 함께 나온다.
   */
  unauthored: { what: string; why: string }[];
}

/** brief 를 해시한 값 — 컴파일 재현의 열쇠이자 자리를 고르는 유일한 난수원 */
export function briefSeed(brief: RegionBrief): number {
  const text = JSON.stringify(brief);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 이름 하나를 op id 로 — 손으로 쓴 방들의 규약(kebab)을 따른다 */
function slug(name: string): string {
  return name.toLowerCase().replace(/_/g, '-');
}

/** 소수 둘로 끊는다 — 좌표가 글자로 굳어도 같은 값이어야 한다 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 원 위의 i 번째 자리 — 남쪽에서 시작해 시계 반대로 돈다 */
function onRing(half: number, ratio: number, index: number, count: number, turn = 0): XZ {
  const angle = -Math.PI / 2 + (2 * Math.PI * (index + turn)) / Math.max(count, 1);
  return {
    x: round2(Math.cos(angle) * half * ratio),
    z: round2(Math.sin(angle) * half * ratio),
  };
}

/** 그 자리에서 걸어 닿는 격자 칸들 — 4방 이웃으로 번진다 */
function reachable(world: CompiledWorldTerrain, from: XZ): Set<number> {
  const { cols, rows } = world;
  const indexOf = (col: number, row: number) => row * cols + col;
  const nearest = (value: number, min: number) =>
    Math.min(Math.max(Math.round((value - min) / world.resolution), 0), Math.max(cols, rows) - 1);
  const startCol = Math.min(nearest(from.x, world.extent.minX), cols - 1);
  const startRow = Math.min(nearest(from.z, world.extent.minZ), rows - 1);
  const seen = new Set<number>();
  if (world.traversable[indexOf(startCol, startRow)] !== 1) return seen;
  const queue: number[] = [indexOf(startCol, startRow)];
  seen.add(queue[0]!);
  while (queue.length > 0) {
    const at = queue.pop()!;
    const col = at % cols;
    const row = (at - col) / cols;
    const steps: [number, number][] = [
      [col - 1, row],
      [col + 1, row],
      [col, row - 1],
      [col, row + 1],
    ];
    for (const [c, r] of steps) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const next = indexOf(c, r);
      if (seen.has(next)) continue;
      if (world.traversable[next] !== 1) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/** 그 자리가 닿는 칸들 안에 있는가 */
function isReached(world: CompiledWorldTerrain, reached: Set<number>, at: XZ): boolean {
  const col = Math.round((at.x - world.extent.minX) / world.resolution);
  const row = Math.round((at.z - world.extent.minZ) / world.resolution);
  if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) return false;
  return reached.has(row * world.cols + col);
}

export interface AuthorInput {
  brief: RegionBrief;
  templates: AuthorTemplates;
  /**
   * 그 방을 어떻게 컴파일하는가 — 주면 생성기가 **놓은 자리에 걸어 닿는지 재 보고** 옮긴다.
   * 주지 않으면 자리만 고르고 재지 않는다 (그때도 지어내지 않는다 — 잰 적이 없을 뿐이다).
   */
  compile?: (space: RegionDescription) => CompiledWorldTerrain;
}

/**
 * brief 하나 → 방 하나의 뼈대.
 *
 * op 순서는 언제나 같다: anchor → 땅 → 흔적 바탕 → 원천 둘레 흔적 → 원천 →
 * 철 덧씌움 area → 탄생지 전조 자락 → 탄생지 point → 떼의 자락 → 물음의 흔적.
 * 순서가 다르면 다른 Description 이므로 (description.ts) 이 순서가 곧 결정론의 일부다.
 */
export function authorRegion(input: AuthorInput): AuthoredRegion {
  const { brief, templates, compile } = input;
  const seed = briefSeed(brief);
  const depth = templates.byDepth[brief.depth] ?? templates.depthFallback;
  const half = depth.half;
  /** 형은 맞았으나 세계의 표에 어휘가 없어 내지 못한 것들 — 아래에서 하나씩 쌓인다 */
  const unauthored: { what: string; why: string }[] = [];

  // ── anchor — 이웃 하나에 자리 하나. 둘레를 고루 나눠 선다
  const connectors: AuthoredConnector[] = [];
  const neighbourAnchors: { region: string; anchor: string }[] = [];
  const anchorOps: PointOp[] = [];
  const used = new Map<string, number>();
  brief.neighbours.forEach((neighbour, index) => {
    const seen = (used.get(neighbour.region) ?? 0) + 1;
    used.set(neighbour.region, seen);
    // 같은 방으로 두 번 가면 이름이 갈려야 한다 — Connector 는 둘이고 자리도 둘이다
    const tag = seen === 1 ? `${brief.id}_${neighbour.region}` : `${brief.id}_${neighbour.region}_${seen}`;
    const at = onRing(half, 0.9, index, brief.neighbours.length);
    anchorOps.push({
      id: `anchor-${slug(tag)}`,
      kind: 'point',
      layer: templates.anchorLayer,
      tag,
      position: at,
    });
    connectors.push({
      id: tag,
      from: { region: brief.id, anchor: tag },
      to: { region: neighbour.region, anchor: tag },
      direction: neighbour.direction,
      transition: neighbour.transition,
    });
    // 아직 짓지 않은 곳에는 anchor 가 없어도 된다 (검사 ⑤ 도 경계는 보지 않는다)
    if (!neighbour.frontier) neighbourAnchors.push({ region: neighbour.region, anchor: tag });
  });

  // ── 땅 — 갈래가 고른다. 갈래가 없으면 기본형
  const recipes = brief.kinds.flatMap((kind) => templates.terrainByKind[kind] ?? []);
  const terrainOps: StampOp[] = (recipes.length > 0 ? recipes : templates.terrainFallback).map(
    (recipe) => ({
      id: recipe.id,
      kind: 'stamp',
      stamp: recipe.stamp,
      center: { x: round2(recipe.center.x * half), z: round2(recipe.center.z * half) },
      radius: round2(recipe.radius * half),
      height: round2(recipe.height * half),
      ...(recipe.falloff === undefined ? {} : { falloff: recipe.falloff }),
    }),
  );

  const extent = { minX: -half, maxX: half, minZ: -half, maxZ: half };
  const base: RegionOp[] = [...anchorOps, ...terrainOps];

  const sources = brief.answers.worth.sources;
  const birth = brief.answers.birth;
  // 표에 기본형이 있는 탄생만 낸다 — 없는 것은 지어내지 않고 **왜 못 냈는지**를 남긴다.
  // 시간 규모도 요구의 꼴도 방식이 정하는 것이라, 방식을 모르면 낼 수 있는 값이 하나도 없다
  const births = birth.born.filter((born) => {
    if (templates.birthByMode[born.mode] !== undefined) return true;
    unauthored.push({
      what: born.id,
      why: `탄생 방식의 기본형이 표에 없다: ${born.mode}`,
    });
    return false;
  });

  // ── 자리 — 고리 위에서 고르되, 컴파일러를 받았으면 **걸어 닿는지 재고** 옮긴다.
  // 놓을 것이 하나도 없으면 재지 않는다 (컴파일도 하지 않는다 — 잴 일이 없다)
  const TURNS = 16;
  const placing = sources.length > 0 || births.length > 0;
  const world = placing ? compile?.({ id: brief.id, extent, seed, ops: base }) : undefined;
  const reached = world && anchorOps[0] ? reachable(world, anchorOps[0].position) : undefined;
  const place = (ratio: number, index: number, count: number): XZ => {
    for (let turn = 0; turn < TURNS; turn++) {
      // seed 가 첫 후보를 고르고, 거기서부터 한 바퀴 돈다 — 같은 brief 면 같은 자리다
      const at = onRing(half, ratio, index, count, ((seed % TURNS) + turn) / TURNS);
      if (!world || !reached) return at;
      if (isTraversableAt(world, at.x, at.z) && isReached(world, reached, at)) return at;
    }
    // 한 바퀴를 다 돌아도 닿는 자리가 없으면 첫 후보를 그대로 둔다 —
    // 지어내 옮기지 않고, 검사와 시험이 그 사실을 잡게 둔다
    return onRing(half, ratio, index, count, (seed % TURNS) / TURNS);
  };

  const placements: XZ[] = sources.map((_, index) => place(0.45, index, sources.length));
  // 탄생지는 원천보다 **바깥 고리**에서 고른다 — 같은 고리에 서면 두 계통의 자리가 겹친다
  const sitePlacements: XZ[] = births.map((_, index) => place(0.7, index, births.length));

  // ── 흔적 — 방 전체에 바탕 한 겹, 원천 둘레에 한 단계 짙게.
  // 바탕은 원천의 것이 아니라 **방의 것**이라 탄생지만 있는 방에도 깔린다 (그 위에 전조가 선다)
  const traceOps: AreaOp[] = placing
    ? [
        {
          id: `trace-${slug(brief.id)}-base`,
          kind: 'area',
          layer: templates.traceLayer,
          tag: templates.traceTag(depth.traceBase),
          shape: {
            kind: 'polygon',
            points: [
              { x: -half, z: -half },
              { x: half, z: -half },
              { x: half, z: half },
              { x: -half, z: half },
            ],
          },
        },
        ...sources.map((source, index) => ({
          id: `trace-${slug(source.id)}`,
          kind: 'area' as const,
          layer: templates.traceLayer,
          tag: templates.traceTag(depth.traceBase + 1),
          shape: { kind: 'circle' as const, center: placements[index]!, radius: round2(half * 0.35) },
        })),
      ]
    : [];

  const sourceOps: PointOp[] = sources.map((source, index) => ({
    id: `source-${slug(source.id)}`,
    kind: 'point',
    layer: templates.resourceLayer,
    tag: source.id,
    position: placements[index]!,
  }));

  const authored: AuthoredSource[] = sources.map((source, index) => {
    const role = templates.sourceByRole[source.role];
    // 키 차례가 컨텐츠의 원천 표와 같다 — 굳힌 글자가 손으로 쓴 방들과 같은 모양이어야 한다
    return {
      id: source.id,
      materialId: source.material,
      worldCause: source.worldCause,
      form: source.form,
      carrier: source.heldBy,
      opportunity: source.role,
      supply: role?.supply ?? source.role,
      recoveryCause: source.recoveryCause,
      harvests: role?.harvests ?? 1,
      ...(role?.collapses ? { collapses: true } : {}),
      recoverySeconds: role?.recoverySeconds ?? 60,
      // 바탕이 0 번이므로 원천 둘레는 index + 1 번이다
      traceOps: [traceOps[index + 1]!.id],
    };
  });

  // ── 철 — 갈래가 고른다. 걸 자락은 **첫 원천 둘레**이고, 원천이 없는 방은 걸 자락이 없다
  const phaseOps: AreaOp[] = [];
  const seasons: Record<string, AuthoredPhaseSeason> = {};
  const phaseCentre = placements[0];
  if (phaseCentre !== undefined) {
    for (const recipe of brief.kinds.flatMap((kind) => templates.phaseByKind[kind] ?? [])) {
      const season = (seasons[recipe.season] ??= {});
      // 원천 둘레 흔적과 **같은 반지름**이다 — 같은 자리를 다른 layer 로 읽는 것이므로
      const shape = () =>
        ({ kind: 'circle', center: { ...phaseCentre }, radius: round2(half * 0.35) }) as const;
      if (recipe.depth !== undefined) {
        const id = `depth-${slug(brief.id)}-${slug(recipe.season)}`;
        phaseOps.push({ id, kind: 'area', layer: templates.depthLayer, tag: recipe.depth, shape: shape() });
        (season.depthOverlay ??= []).push({ areaId: id, depth: recipe.depth });
      }
      if (recipe.hazard !== undefined) {
        const id = `hazard-${slug(brief.id)}-${slug(recipe.season)}`;
        phaseOps.push({ id, kind: 'area', layer: templates.hazardLayer, tag: recipe.hazard, shape: shape() });
        (season.hazardExtend ??= []).push({ areaId: id, hazard: recipe.hazard });
      }
    }
  }

  // ── 탄생지의 전조 자락 — 탄생지마다 **하나**다. 원천 둘레와 같은 세기이고 더 좁다
  const siteTraceOps: AreaOp[] = births.map((born, index) => ({
    id: `trace-${slug(born.id)}-before`,
    kind: 'area',
    layer: templates.traceLayer,
    tag: templates.traceTag(depth.traceBase + 1),
    shape: { kind: 'circle', center: sitePlacements[index]!, radius: round2(half * 0.25) },
  }));

  // 탄생지의 자리 — 원천과 **같은 layer** 의 point 다 (탄생지의 id 가 곧 그 tag 다)
  const siteOps: PointOp[] = births.map((born, index) => ({
    id: `site-${slug(born.id)}`,
    kind: 'point',
    layer: templates.resourceLayer,
    tag: born.id,
    position: sitePlacements[index]!,
  }));

  const lifeFormation: AuthoredLifeSite[] = births.map((born, index) => {
    // 위 filter 가 표에 있는 것만 남겼다
    const defaults = templates.birthByMode[born.mode]!;
    const requires: AuthoredLifeRequirement[] = [
      // ① 먹는 원천은 **서 있어야** 한다 — 모자람 코드는 방식별 기본형이 준다
      ...born.consumes.map((sourceId) => ({
        kind: 'source-available',
        sourceId,
        unmetCode: defaults.sourceUnmetCode,
      })),
      // ② 재료가 아닌 세계 상태 — 표에 없는 상태는 **거르고 지나간다**.
      // 무엇을 물어야 하는지도 못 찼을 때 무슨 말인지도 모르는 채로 요구를 지어내지 않는다
      ...born.from.states.flatMap((state) => {
        const requirement = templates.stateRequirement[state];
        return requirement === undefined
          ? []
          : [{ kind: requirement.kind, unmetCode: requirement.unmetCode }];
      }),
      // ③ 방식이 개체군에 거는 요구 — 묻는 개체군은 그 탄생이 값을 올리는 그것이다
      ...(defaults.populationRequirement === undefined
        ? []
        : [
            {
              kind: defaults.populationRequirement.kind,
              populationId: born.population,
              value: defaults.populationRequirement.value,
              unmetCode: defaults.populationRequirement.unmetCode,
            },
          ]),
    ];
    // 키 차례가 컨텐츠의 탄생지 표와 같다 — 원천이 그런 그대로다
    return {
      id: born.id,
      mode: born.mode,
      worldCause: born.worldCause,
      form: born.form,
      source: { materials: [...born.from.materials], states: [...born.from.states] },
      condition: { regionRule: born.regionRule, requires },
      transition: { from: defaults.transition.from, to: defaults.transition.to },
      consumes: [...born.consumes],
      // 남기는 것이 없으면 키를 두지 않는다 — 빈 목록을 굳히면 "아무것도 남기지 않는다" 가
      // "목록이 비어 있다" 로 읽힌다 (밝히지 않은 것과 밝혀서 빈 것은 다르다)
      ...(born.leaves.length === 0 ? {} : { leaves: [...born.leaves] }),
      ...(defaults.spentSeconds === undefined ? {} : { spentSeconds: defaults.spentSeconds }),
      // 전조는 위에서 낸 그 하나이고, 뒤에 남는 것은 **없다** — 태어난 뒤 무엇이 남는지는
      // brief 가 답하지 않았으므로 지어내지 않는다
      traces: { before: [{ op: siteTraceOps[index]!.id }], after: [] },
      ecologicalRole: born.ecologicalRole,
      population: born.population,
      bindingSeconds: defaults.bindingSeconds,
    };
  });

  // ── 떼 — brief 가 밝힌 개체군을 그대로 옮기되, 자락은 **의미 코드를 밝힌 것**에만 선다
  const presenceOps: AreaOp[] = [];
  const populations: AuthoredPopulation[] = birth.populations.map((population) => {
    // 그 값을 올리는 첫 탄생지 둘레에 돈다 — 나는 자리가 없으면 방의 한가운데다
    const bornAt = births.findIndex((born) => born.population === population.id);
    const centre = bornAt < 0 ? { x: 0, z: 0 } : sitePlacements[bornAt]!;
    const ops: string[] = [];
    if (population.presence !== undefined) {
      // 값 1..상한 마다 하나 — 값만큼이 앞에서부터 서므로 뒤로 갈수록 넓어진다
      for (let n = 1; n <= population.scale; n++) {
        const id = `presence-${slug(population.id)}-${n}`;
        presenceOps.push({
          id,
          kind: 'area',
          layer: templates.presenceLayer,
          tag: population.presence,
          shape: {
            kind: 'circle',
            center: { ...centre },
            radius: round2(half * templates.population.radiusStep * n),
          },
        });
        ops.push(id);
      }
    }
    // 키 차례가 컨텐츠의 개체군 표와 같다
    return {
      id: population.id,
      scale: population.scale,
      declineCause: population.declineCause,
      ...(population.presence === undefined ? {} : { presence: population.presence }),
      ...(ops.length === 0 ? {} : { presenceOps: ops }),
      // 소란은 **탄생이 올리는 것**이라, 그 방에서 나는 것이 없으면 실을 자리가 없다
      ...(bornAt < 0 || templates.population.birthDisturbance === undefined
        ? {}
        : { birthDisturbance: templates.population.birthDisturbance }),
    };
  });

  // ── 관계 — 부르는 것은 전부 from 쪽의 일이다 (그 관계를 밝히는 것은 from 이 사는 방이다).
  // `via` 는 내지 않는다 — 두 끝이 어느 방에 사는지를 brief 하나로는 알 수 없다.
  // 같은 방이면 밝힐 이음이 없고, 방을 넘으면 사람이 붙인다 (renderSeams 가 그 자리를 댄다)
  const links: AuthoredLink[] = births.flatMap((born) =>
    born.calls.map((called) => ({ from: born.population, to: called, kind: 'CALLS' })),
  );

  // ── 물음 — 이 방이 묻는 것을 옮기고, 그것을 **알아낼 흔적의 자리**를 낸다 (T2 확장 ADDED).
  //
  // brief 는 흔적의 **이름**만 대고 자리는 대지 않는다 (원천 · 탄생지가 그런 그대로) — 어느
  // 자락이 어디 서야 하는가는 땅의 일이라 생성기가 낸다. 흔적 없는 Lock 은 알아낼 길이 없는
  // 요구이므로(검사 ㊶) Lock 마다 **하나 이상**을 낸다.
  //
  // 여기서 컴파일을 다시 하지 않는다 — 물음만 있고 원천도 탄생도 없는 방은 위에서 잰 적이
  // 없으므로(`placing`) 자리를 고르되 걸어 닿는지는 재지 않는다. `placing` 을 물음까지 넓히면
  // 그 방에 흔적 바탕 한 겹이 새로 깔려 지금 서 있는 방들의 땅이 달라진다 — 물음을 적자고
  // 땅을 바꾸지 않는다 (컴파일러를 주지 않았을 때와 같은 자리다: 잰 적이 없을 뿐이다).
  const asking = brief.answers.asking;
  const clueOps: AreaOp[] = [];
  const locks: AuthoredLock[] = asking.locks.map((lock, index) => {
    // **문에 걸린 물음인가** — 그 방이 낸 Connector 의 id 를 가리키면 그 문의 anchor 자리다.
    // 문 곁에 그 문의 흔적이 서는 것이 이 규칙의 뜻이라, 고리에서 다시 고르지 않는다.
    // `at.kind` 로 가리지 않는 것은 갈래의 어휘를 engine 이 알지 못하기 때문이다 (계약의 것이다)
    const anchor = anchorOps.find((op) => op.tag === lock.at.ref);
    const at =
      anchor === undefined ? place(0.55, index, asking.locks.length) : { ...anchor.position };
    // 이름을 댄 만큼, 대지 않았으면 하나 — 그때 흔적의 이름은 그 물음 자신의 이름이다
    const names = lock.traces.length === 0 ? [lock.id] : lock.traces;
    const traces: AuthoredLockTrace[] = names.map((name, n) => {
      const id = `clue-${slug(lock.id)}-${n + 1}`;
      clueOps.push({
        id,
        kind: 'area',
        layer: templates.clueLayer,
        tag: name,
        // 탄생지 전조와 **같은 반지름**이다 — 자리 하나를 가리키는 자락이라는 뜻이 같다
        shape: { kind: 'circle', center: { ...at }, radius: round2(half * 0.25) },
      });
      return { op: id };
    });
    const requires: AuthoredLockRequirement[] = lock.requires.flatMap((requirement) => {
      // **아무 갈래도 밝히지 않은 요구는 거른다** — 요구가 없는 것과 같은 것을 굳혀 두면
      // 형이 거짓말을 한다 (밝히지 않은 것과 밝혀서 빈 것을 가르는 그 규율의 반대편이다)
      const said =
        requirement.property !== undefined ||
        requirement.seasons.length > 0 ||
        requirement.state !== undefined ||
        requirement.knowledge !== undefined;
      if (!said) return [];
      // 키 차례가 컨텐츠의 요구 표와 같다 — 성질 → 철 → 그 방의 지금 → 아는 것
      return [
        {
          ...(requirement.property === undefined ? {} : { property: requirement.property }),
          ...(requirement.seasons.length === 0
            ? {}
            : { time: { seasons: [...requirement.seasons] } }),
          ...(requirement.state === undefined
            ? {}
            : {
                state: {
                  region: requirement.state.region,
                  patterns: [...requirement.state.patterns],
                },
              }),
          ...(requirement.knowledge === undefined ? {} : { knowledge: requirement.knowledge }),
        },
      ];
    });
    // 키 차례가 컨텐츠의 Lock 표와 같다 — 원천 · 탄생지가 그런 그대로다
    return {
      id: lock.id,
      at: { kind: lock.at.kind, ref: lock.at.ref },
      strength: lock.strength,
      requires,
      // 중요하지 않으면 키를 두지 않는다 — 거짓을 굳히면 "밝히지 않았다" 와 갈리지 않는다
      ...(lock.important ? { important: true } : {}),
      traces,
      ...(lock.reason === undefined ? {} : { reason: lock.reason }),
    };
  });

  // 침묵과 물음은 **함께 서지 않는다**. 묻는 방이면 물음 하나이고, 묻지 않는다고 **답했으면**
  // 그 답이 곧 사유다 (탄생의 absenceReason 이 선 그 자리 그대로 — 없음이 침묵이 아니라 답이
  // 된다). 미답은 사유가 아니다: 아직 답하지 않은 것을 굳히면 도구가 "여기는 원래 묻지 않는다"
  // 와 "여기는 아직 안 정했다" 를 갈라 읽지 못한다 — 그때는 이 자리 자체를 내지 않는다
  const access: AuthoredAccess | undefined =
    locks.length > 0 ? { locks } : isUnanswered(asking.said) ? undefined : { silence: asking.said };

  // ── 생명 계통 — 낼 것이 하나도 없으면 이 자리 자체를 내지 않는다 (resourceEcology 의 어법).
  // 키 차례는 컨텐츠의 RegionEcology 그대로다
  const ecology: AuthoredEcology = {
    ...(lifeFormation.length === 0 ? {} : { lifeFormation }),
    ...(populations.length === 0 ? {} : { populations }),
    ...(links.length === 0 ? {} : { links }),
    // 태어나는 것이 하나도 없다고 **답했으면** 그 답이 곧 사유다 — 없음이 침묵이 아니라
    // 답이 된다. 미답은 사유가 아니다: 아직 답하지 않은 것을 사유로 굳히면 형이 거짓말을 하고,
    // 도구가 "여기는 원래 없다" 와 "여기는 아직 안 만들었다" 를 갈라 읽지 못한다
    ...(birth.born.length === 0 && !isUnanswered(birth.said)
      ? { absenceReason: birth.said }
      : {}),
  };

  return {
    spec: {
      id: brief.id,
      depth: brief.depth,
      space: {
        id: brief.id,
        extent,
        seed,
        ops: [
          ...base,
          ...traceOps,
          ...sourceOps,
          ...phaseOps,
          ...siteTraceOps,
          ...siteOps,
          ...presenceOps,
          ...clueOps,
        ],
      },
      ...(sources.length === 0 ? {} : { resourceEcology: { sources: authored } }),
      // 갈래가 철을 말하지 않았거나 걸 자락이 없으면 위상을 내지 않는다
      ...(Object.keys(seasons).length === 0 ? {} : { phases: { seasons } }),
      // 묻지도 않고 왜 묻지 않는지도 답하지 않은 방은 이 자리 자체가 없다
      ...(access === undefined ? {} : { access }),
      ...(Object.keys(ecology).length === 0 ? {} : { ecology }),
    },
    connectors,
    name: brief.name,
    neighbourAnchors,
    unanswered: unansweredKeys(brief),
    unauthored,
  };
}
