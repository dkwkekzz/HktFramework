// World Semantic — Region State (C008 ADDED)
//
// 땅의 통행이 처음으로 State 가 된다. C007 까지 방의 모든 사실은 Description 을 컴파일해
// 얻는 **유도된 사실**(semantic/terrain.ts)이었다 — 같은 데이터면 언제나 같은 답이므로
// 저장하지 않았다. 이 Cycle 이 더하는 셋(pattern · pressure · rearrangedAt)은 다르다:
// 세계가 겪은 일의 결과이므로 Description 에서 유도되지 않는다. **저장된다** —
// 스냅샷에 실리고 그래서 STATE_VERSION 이 오른다 (spec State 절 · R5).
//
// 규칙은 방의 이름을 알지 못한다. 여기가 아는 것은 "rule 을 가진 방" 뿐이고, 그 방이
// 미로인지 무엇인지는 데이터(content/regions)에만 있다 (C004 가 세운 규율).
//
// 컴파일 결과는 이 State 가 바뀌어도 한 값도 바뀌지 않는다 (spec R3 · SPEC-006 경계) —
// 열림/닫힘은 컴파일된 area 위에 State 가 덧씌워진 것이지 땅이 다시 만들어지는 것이 아니다.
//
// C012 CHANGED — 방 하나의 State 가 규칙과 원천을 **함께** 든다 (RegionState). 규칙은 통로의
// 열림/닫힘을 들고, 원천은 "몇 번 캤고 고갈되었는가" 를 든다. 둘 다 세계가 겪은 일의 결과이므로
// 저장되고, 둘 다 **없는 방에는 자리 자체가 없다** — 규칙 없는 방에 rule 을, 원천 없는 방에
// sources 를 지어내지 않는다 (C008 SPEC-007 경계의 규율 그대로).

import { tagsAt } from '../../../engine/world-authoring/query';
import { REGION_SPECS, regionSpec, type RegionSpec } from '../../regions';
import type { WorldPosition } from './position';
import { RECOVERY_VISIBLE_FRACTION } from './world-state';
import { inflowOf, nextStandableSite, sourcesInRegion } from './resource';
import { regionTerrain } from './terrain';

/** 그 방이 품은 규칙의 데이터 — content/regions 가 소유하는 형을 그대로 든다 */
export type RegionRuleSpec = NonNullable<RegionSpec['rule']>;

/** 방 하나가 기억하는 것 — 지금 열린 통로 집합의 이름 · 쌓인 압력 · 마지막으로 바뀐 시각 */
export interface RegionRuleState {
  /** 지금 열려 있는 통로 집합의 이름 (규칙 데이터의 patterns 중 하나) */
  pattern: string;
  /** 쌓인 압력 — 0 이상. 임계에서 0 으로 돌아간다 */
  pressure: number;
  /** 마지막으로 패턴이 바뀐 세계 시각. 한 번도 안 바뀌었으면 없다 */
  rearrangedAt?: number;
}

/**
 * 원천 하나의 지금 (C012 ADDED · C013 CHANGED) — 몇 번 캤고, 되돌아옴이 얼마나 왔고,
 * 지금 어느 마디에 서 있고, 어느 마디가 무너진 채 남았는가.
 *
 * 자리 · 재료 · 캘 수 있는 횟수 · 되돌아옴의 길이는 여기 없다. 그것들은 언제나 데이터에서
 * 다시 오는 정적 사실이고 (content/regions · semantic/resource.ts), 여기 있는 것은
 * **세계가 겪은 일**뿐이다.
 */
export interface ResourceSourceState {
  /** 캘 수 있는가 · 다 캤는가 · 되돌아오는 중인가 (C013 CHANGED — 셋이 되었다) */
  phase: 'available' | 'depleted' | 'recovering';
  /** 몇 번 캤는가 (0 부터). phase 에서 유도되지 않으므로 함께 저장한다. 되돌아오면 0 이다 */
  taken: number;
  /**
   * 되돌아옴이 얼마나 왔는가 — **세계 초** (C013 ADDED). available 이면 언제나 0 이다.
   * 관찰에는 실리지 않는다 — 언제 돌아오는지 세계는 말하지 않는다 (spec Observable).
   */
  progress: number;
  /**
   * 지금 선 **마디**의 번호 (C013 ADDED · 기본 0). 마디가 하나뿐인 원천은 언제나 0 이다.
   * 마디의 좌표는 여기 없다 — 데이터(presence 곡선)가 소유한다.
   */
  siteIndex: number;
  /**
   * **무너진 채 남은** 마디 번호들 (C013 ADDED) — 무너지지 않는 원천에는 자리 자체가 없다.
   * 원천이 떠나도 그 자리는 지날 수 없다 (spec R5).
   */
  collapsedSites?: number[];
}

/**
 * 방 하나가 기억하는 것 (C012 CHANGED) — 규칙과 원천을 함께 든다.
 *
 * 둘 다 있을 수도, 하나만 있을 수도, 둘 다 없을 수도 있다. 없는 것은 자리가 없다 —
 * 규칙 없는 방의 rule 도 원천 없는 방의 sources 도 지어내지 않는다.
 */
export interface RegionState {
  /** 그 방이 품은 규칙의 지금 — 규칙 없는 방에는 없다 */
  rule?: RegionRuleState;
  /** 그 방이 낳는 원천들의 지금 (원천 id → State) — 원천 없는 방에는 없다 */
  sources?: Record<string, ResourceSourceState>;
}

/** 거절 사유 코드 — 지금 패턴이 열지 않은 통로다. 문구는 View 의 표가 옮긴다 */
export const PASSAGE_CLOSED = 'passage-closed';

/** 그 방이 품은 규칙 — 없으면 규칙 없는 방이다 (State 도 서지 않는다) */
export function regionRuleOf(regionId: string): RegionRuleSpec | undefined {
  return regionSpec(regionId)?.rule;
}

/**
 * 세계가 설 때의 Region State 들 — `rule` 을 가진 방은 첫 패턴 · 압력 0 으로,
 * 원천을 가진 방은 원천마다 available · taken 0 으로 선다 (C012 CHANGED).
 * 다만 **유입 흐름을 가진 원천은 고갈로 선다** (C014 CHANGED · spec R4).
 *
 * 규칙 없는 방에 rule 은, 원천 없는 방에 sources 는 자리 자체가 없다 — 없는 것을 지어내지
 * 않는다 (SPEC-007 경계). 둘 다 없는 방은 State 자체가 없다 (백왕령이 그렇다).
 * 되살린 세계는 이것을 부르지 않는다: State 는 스냅샷에서 그대로 온다 (SPEC-009).
 *
 * 원천의 자리는 여기서 짓지 않는다 — **서 있는 원천**(RULE-RESOURCE-PLACEMENT-001 이 세운 것)
 * 에게만 State 를 준다. 데이터에 적혀 있어도 자리를 못 얻은 원천은 세계에 없기 때문이다.
 */
export function createRegionStates(): Record<string, RegionState> {
  const states: Record<string, RegionState> = {};
  for (const spec of REGION_SPECS) {
    const state: RegionState = {};

    const first = spec.rule?.patterns[0];
    if (first) state.rule = { pattern: first.name, pressure: 0 };

    const sources = sourcesInRegion(spec.id);
    if (sources.length > 0) {
      const sourceStates: Record<string, ResourceSourceState> = {};
      // C013 CHANGED — 아직 아무 일도 겪지 않은 원천: 캘 수 있고 · 한 번도 캐지 않았고 ·
      // 되돌아올 것이 없고(progress 0) · 첫 마디에 선다. 무너진 마디는 하나도 없으므로
      // collapsedSites 는 자리 자체가 없다 (빈 배열로 지어내지 않는다).
      //
      // C014 CHANGED (spec R4) — **유입 흐름을 가진 원천만 고갈로 선다.** 실려 와야 생기는
      // 것이므로 세계가 설 때는 아직 거기 없고, 관찰자에게 "아직 실려 오지 않았다" 와
      // "다 캐 갔다" 는 같은 사실이다 — 거기 지금 없다는 것 (spec 기본형 ④). phase 를 넷으로
      // 늘리지 않고 C013 의 셋으로 같은 것을 말한다. 규칙이 스스로 도달할 수 있는 State 만
      // 세운다: 다 캔 것과 한 값도 다르지 않다 (taken = harvests · progress 0).
      //
      // **어느 원천인지 이름으로 알지 못한다** — 아는 것은 "유입 흐름을 가진 원천" 이라는
      // 형뿐이고, 흐름의 표는 데이터의 것이다 (R13).
      for (const source of sources) {
        sourceStates[source.id] = inflowOf(source.id)
          ? { phase: 'depleted', taken: source.harvests, progress: 0, siteIndex: 0 }
          : { phase: 'available', taken: 0, progress: 0, siteIndex: 0 };
      }
      state.sources = sourceStates;
    }

    if (state.rule || state.sources) states[spec.id] = state;
  }
  return states;
}

/**
 * 순환의 **다음 한 칸** — 배열 순서가 곧 다음 패턴이고 마지막 다음은 처음이다.
 * 모르는 이름이면 처음으로 되돌린다 (데이터가 바뀐 뒤 되살린 세계).
 */
export function nextPatternName(rule: RegionRuleSpec, current: string): string {
  const patterns = rule.patterns;
  const index = patterns.findIndex((pattern) => pattern.name === current);
  const next = patterns[(index + 1) % patterns.length] ?? patterns[0];
  return next ? next.name : current;
}

/**
 * 지금 열려 있는 통로 태그들 — 패턴 표에서 그 이름의 줄을 읽는다.
 * 모르는 이름이면 열린 통로가 없다 (지어내지 않는다).
 */
export function openPassageTags(rule: RegionRuleSpec, pattern: string): readonly string[] {
  return rule.patterns.find((entry) => entry.name === pattern)?.open ?? [];
}

/**
 * 그 자리가 **지금 닫혀 있는 통로 안**인가 — RULE-MOVE-001 의 새 전제가 읽는다.
 *
 * 자리 판정은 컴파일 결과에 그대로 묻는다 (`tagsAt`) — 통로는 컴파일된 area 이고,
 * State 는 그 위에 열림/닫힘만 덧씌운다. 규칙 없는 방 · 땅이 없는 방 · 통로 밖의 자리는
 * 언제나 거짓이다 — 이 전제가 없는 것과 같다.
 *
 * 겹친 통로 area 가 여럿이면 **하나라도 열려 있으면 열린 자리**로 친다 — 닫힘이 이기면
 * 열린 통로 위를 걸으면서도 막히는 자리가 생긴다.
 */
export function isClosedPassageAt(
  regionStates: Record<string, RegionState>,
  regionId: string,
  position: WorldPosition,
): boolean {
  const rule = regionRuleOf(regionId);
  const regionState = regionStates[regionId]?.rule;
  if (!rule || !regionState) return false;
  const terrain = regionTerrain(regionId);
  if (!terrain) return false;

  const here = tagsAt(terrain, position.x, position.z, rule.passageLayer);
  if (here.length === 0) return false;
  const open = openPassageTags(rule, regionState.pattern);
  return !here.some((tag) => open.includes(tag));
}

/**
 * 세계가 설 때의 패턴을 밝힌 대로 세운다 — 검증·촬영용 초기 배치 (C009 ADDED · WorldSetup.regionPatterns).
 *
 * 규칙을 하나도 바꾸지 않는다: 여기서 세운 패턴도 그 다음부터는 압력이 굴린다.
 * 밝히지 않은 방은 첫 패턴 그대로다.
 *
 * 손잡이가 세계를 깨뜨리지 않게 **모르는 것은 조용히 무시한다** — 규칙 없는 방의 이름도,
 * 그 방의 패턴 표에 없는 이름도 그냥 지나간다 (없는 패턴을 세우면 열린 통로가 하나도 없는
 * 방이 되어 몸이 갇힌다).
 */
export function applyPatternSetup(
  states: Record<string, RegionState>,
  patterns: Record<string, string> | undefined,
): Record<string, RegionState> {
  if (!patterns) return states;
  for (const [regionId, name] of Object.entries(patterns)) {
    const state = states[regionId]?.rule;
    const rule = regionRuleOf(regionId);
    if (!state || !rule) continue;
    if (!rule.patterns.some((entry) => entry.name === name)) continue;
    state.pattern = name;
  }
  return states;
}

/**
 * 세계가 설 때 원천이 **어느 phase 로 서는가**를 밝힌 대로 세운다 —
 * 검증·촬영용 초기 배치 (C012 ADDED · WorldSetup.sourcePhases).
 *
 * regionPatterns 와 **같은 갈래**의 손잡이다: 캐서 닿을 수 있는 State 를 캐지 않고
 * 시작하기 위한 것이며 **세계의 규칙을 하나도 바꾸지 않는다.** 여기서 세운 phase 위에서도
 * 채취(RULE-MINE-001 · -COMPLETE-001)와 자국의 셋(외형 · 흔적 · 통행)이 그대로 굴러간다.
 *
 * **규칙이 스스로 도달할 수 있는 State 만 세운다** — phase 와 나머지가 어긋난 State 를
 * 만들지 않는다 (C013 CHANGED · spec R1 · R6 의 전이를 그대로 흉내 낸다).
 *   depleted    taken = harvests · progress 0 · 무너지는 원천이면 collapsedSites 에 지금 마디
 *   recovering  taken = harvests · progress = 눈에 보이기 시작하는 임계 ·
 *               자리를 옮기는 원천이면 siteIndex 가 다음 마디 · 무너지는 원천이면 옛 마디가 무너진 채
 *   available   taken 0 · progress 0 (아직 아무 일도 겪지 않은 것과 같다)
 *
 * 손잡이가 세계를 깨뜨리지 않게 **모르는 것은 조용히 무시한다** — 서 있지 않은 원천 id 도,
 * 이 세계에 없는 phase 이름도 그냥 지나간다 (applyPatternSetup 의 선례).
 */
export function applySourcePhaseSetup(
  states: Record<string, RegionState>,
  phases: Record<string, string> | undefined,
): Record<string, RegionState> {
  if (!phases) return states;
  for (const [regionId, regionState] of Object.entries(states)) {
    if (!regionState.sources) continue;
    for (const source of sourcesInRegion(regionId)) {
      const phase = phases[source.id];
      const sourceState = regionState.sources[source.id];
      if (!sourceState) continue;
      if (phase === 'available') {
        sourceState.phase = 'available';
        sourceState.taken = 0;
        sourceState.progress = 0;
      } else if (phase === 'depleted') {
        sourceState.phase = 'depleted';
        sourceState.taken = source.harvests;
        sourceState.progress = 0;
        // 지금 마디에서 고갈되었으므로 그 마디가 무너진다 (RULE-MINE-COMPLETE-001 이 하는 그대로)
        if (source.collapses) sourceState.collapsedSites = [sourceState.siteIndex];
      } else if (phase === 'recovering') {
        sourceState.phase = 'recovering';
        sourceState.taken = source.harvests;
        sourceState.progress = source.recoverySeconds * RECOVERY_VISIBLE_FRACTION;
        // 캐서 고갈된 마디는 무너진 채 남고, 자리를 옮기는 원천은 그 다음 마디로 옮겨 선다
        // (RULE-SOURCE-RECOVERY-001 이 임계를 넘을 때 하는 그대로 · 옛 마디를 먼저 무너뜨린다)
        const here = sourceState.siteIndex;
        if (source.collapses) sourceState.collapsedSites = [here];
        const next = nextStandableSite(source, here, sourceState.collapsedSites);
        if (next !== null) sourceState.siteIndex = next;
      }
    }
  }
  return states;
}
