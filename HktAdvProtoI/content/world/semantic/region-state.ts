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

import { tagsAt } from '../../../engine/world-authoring/query';
import { REGION_SPECS, regionSpec, type RegionSpec } from '../../regions';
import type { WorldPosition } from './position';
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

/** 거절 사유 코드 — 지금 패턴이 열지 않은 통로다. 문구는 View 의 표가 옮긴다 */
export const PASSAGE_CLOSED = 'passage-closed';

/** 그 방이 품은 규칙 — 없으면 규칙 없는 방이다 (State 도 서지 않는다) */
export function regionRuleOf(regionId: string): RegionRuleSpec | undefined {
  return regionSpec(regionId)?.rule;
}

/**
 * 세계가 설 때의 Region State 들 — `rule` 을 가진 방마다 첫 패턴 · 압력 0 으로 선다.
 *
 * 규칙 없는 방에는 자리 자체가 없다 — 없는 것을 0 으로 지어내지 않는다 (SPEC-007 경계).
 * 되살린 세계는 이것을 부르지 않는다: State 는 스냅샷에서 그대로 온다 (SPEC-009).
 */
export function createRegionStates(): Record<string, RegionRuleState> {
  const states: Record<string, RegionRuleState> = {};
  for (const spec of REGION_SPECS) {
    const first = spec.rule?.patterns[0];
    if (!first) continue;
    states[spec.id] = { pattern: first.name, pressure: 0 };
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
  regionStates: Record<string, RegionRuleState>,
  regionId: string,
  position: WorldPosition,
): boolean {
  const rule = regionRuleOf(regionId);
  const regionState = regionStates[regionId];
  if (!rule || !regionState) return false;
  const terrain = regionTerrain(regionId);
  if (!terrain) return false;

  const here = tagsAt(terrain, position.x, position.z, rule.passageLayer);
  if (here.length === 0) return false;
  const open = openPassageTags(rule, regionState.pattern);
  return !here.some((tag) => open.includes(tag));
}
