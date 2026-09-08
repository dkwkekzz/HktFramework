// World Semantic — Life Site · Population (C022 ADDED)
//
// 세계가 "이 방에서 무엇이 태어나려 하는가" 와 "그 요구가 지금 차 있는가" 를 든다.
//
// **자리와 성질은 세계 State 가 아니다** — 원천이 그런 그대로다 (semantic/resource.ts).
// 탄생지의 자리는 언제나 그 방 Description 의 resource point 에서, 성질은 그 방
// `ecology.lifeFormation` 에서 다시 온다. State 가 드는 것은 **세계가 겪은 일**뿐이다:
// 지금 어느 phase 이고 결속이 얼마나 왔는가 · 개체군의 값이 얼마인가 (semantic/region-state.ts).
//
// 방마다 한 번만 엮어 들고 있는다 (아래 캐시) — 컴파일과 마찬가지로 순수하므로 언제 만들든
// 같은 목록이 나오고, 되살린 세계도 같은 데이터에서 같은 탄생지를 다시 세운다.
//
// **규칙 코드는 어떤 생명도 어떤 탄생지도 이름으로 알지 못한다** (Life F13 · R13 · C004).
// 여기가 아는 것은 "탄생지를 밝힌 방" · "요구를 밝힌 탄생지" 라는 형뿐이고, 그것이 알집인지
// 광식충인지 · 무엇이 모자랄 때 어느 글자가 걸리는지는 전부 데이터(content/regions)에 있다.
//
// **새 layer 도 새 Rule 문법도 별도 Life System 도 없다** (F13 · Life §3.1) — 이 파일은
// semantic/resource.ts 와 같은 갈래의 세계 사실이고, 그것을 굴리는 것은 여느 세계 과정과
// 같은 하나다 (simulation/life-binding.ts).

import { areasOf, findPoint } from '../../../engine/world-authoring/description';
import { areaCoversPoint } from '../../../engine/world-authoring/query';
import {
  REGION_SPECS,
  RESOURCE_LAYER,
  TRACE_LAYER,
  regionSpec,
  type LifeRequirement,
  type LifeSitePhase,
  type LifeSiteSpec,
  type LifeSiteTrace,
  type PopulationSpec,
} from '../../regions';
import type { WorldPosition } from './position';
import { isRainingAt } from './rain';
import type { LifeSiteState, RegionState } from './region-state';
import { findResourceSource, sourceStateOf } from './resource';

/**
 * 거절 사유 코드 — **원천이 아니다** (spec SPEC-002 경계 ①).
 *
 * 알집을 지목했을 때 대상 프레임이 "왜 캘 수 없는가" 를 답할 수 있어야 한다. 바닥남 ·
 * 되돌아오는 중과 갈리는 말이다: 저것들은 **원천인데 지금 캘 수 없다** 이고 이것은
 * 캘 것이 아니다 — 기다릴 대상이 없다. 문구는 View 의 표가 옮긴다.
 */
export const NOT_A_SOURCE = 'not-a-source';

/**
 * 세계가 아는 탄생지 하나 — 성질(ecology.lifeFormation)과 자리(Description 의 resource point)를
 * 엮은 것이다 (ResourceSource 와 같은 갈래).
 *
 * `transition` · `source` · `ecologicalRole` · `traces.after` 는 **밝혀만 둔다** — 이 Cycle 의
 * 규칙은 읽지 않는다 (원천의 carrier · opportunity · supply 가 그런 그대로).
 */
export interface LifeSite {
  id: string;
  regionId: string;
  /** 그 자리에 난 자연 형태 코드 — 관찰의 kind 가 이것이다 */
  form: string;
  /** 그 방 Local Space 의 자리 — 데이터가 소유한다 */
  position: WorldPosition;
  /** 다 차 있는 동안에만 결속이 오르는 요구들 — 데이터 순서 그대로 (결정론) */
  requires: readonly LifeRequirement[];
  /** 전조 자락들 — 데이터 순서 그대로 */
  traces: readonly LifeSiteTrace[];
  /** 결속에 걸리는 세계 초 */
  bindingSeconds: number;
  /** 이 탄생이 값을 올리는 개체군 — 올리는 것은 C023 이다 (밝혀만 둔다) */
  population: string;
}

/** 세계가 아는 개체군 하나 — 성질만이다. 값은 State 가 든다 */
export interface Population extends PopulationSpec {
  regionId: string;
}

// 방 하나당 엮기 한 번. 탄생지가 없는 방도 빈 배열로 담는다 — 그것도 답이다.
const SITES_BY_REGION = new Map<string, readonly LifeSite[]>();

// id → 탄생지 · id → 개체군. 세계가 아는 전부를 한 번 훑어 만든다 (아래 안쪽 두 함수).
let SITE_INDEX: Map<string, LifeSite> | null = null;
let POPULATION_INDEX: Map<string, Population> | null = null;

/**
 * RULE-LIFE-CONDITION-001 (C022 ADDED · spec R2) — 그 방에 **서 있는 탄생지들**.
 *
 * 그 방 `ecology.lifeFormation` 의 탄생지마다, **같은 id 를 tag 로 가진** resource layer
 * point 를 찾아 그 자리에 세운다. 그런 point 가 없는 탄생지는 **서지 않는다** — 자리를
 * 지어내지 않는다 (RULE-RESOURCE-PLACEMENT-001 이 원천에 하는 그 판정 그대로).
 *
 * 순서는 데이터의 순서 그대로다 (결정론). 밝히지 않은 방은 언제나 빈 배열이다.
 */
export function lifeSitesInRegion(regionId: string): readonly LifeSite[] {
  const cached = SITES_BY_REGION.get(regionId);
  if (cached !== undefined) return cached;

  const spec = regionSpec(regionId);
  const sites: LifeSite[] = [];
  for (const site of spec?.ecology?.lifeFormation ?? []) {
    // 자리는 Description 의 것이다 — 여기서 좌표를 짓지 않는다.
    const point = spec ? findPoint(spec.space, RESOURCE_LAYER, site.id) : undefined;
    if (!point) continue;
    sites.push(toLifeSite(site, regionId, { x: point.position.x, z: point.position.z }));
  }

  SITES_BY_REGION.set(regionId, sites);
  return sites;
}

/** 세계가 아는 탄생지 하나 — 모르는 id 면 undefined (방을 가리지 않는다) */
export function findLifeSite(id: string): LifeSite | undefined {
  return siteIndex().get(id);
}

/** 세계가 아는 개체군 하나 — 모르는 id 면 undefined (방을 가리지 않는다) */
export function findPopulation(id: string): Population | undefined {
  return populationIndex().get(id);
}

/**
 * 그 탄생지의 지금 — State 가 없으면 **DORMANT · 진행 0** 으로 친다.
 *
 * 없는 것을 맺힌 것으로 읽지 않는다: State 가 없는 것은 "아직 아무 일도 겪지 않았다" 와
 * 같은 뜻이다 (sourceStateOf 가 available 로 치는 그 규율 그대로).
 *
 * 돌려주는 값을 고쳐도 세계는 바뀌지 않는다 — State 가 없을 때는 새 객체이기 때문이다.
 * 세계를 바꾸는 것은 결속의 전이뿐이다 (원칙 4 · simulation/life-binding.ts).
 */
export function lifeSiteStateOf(
  states: Record<string, RegionState>,
  regionId: string,
  siteId: string,
): LifeSiteState {
  return states[regionId]?.lifeSites?.[siteId] ?? { phase: 'DORMANT', progress: 0 };
}

/**
 * 그 개체군의 지금 값 — State 가 없으면 **0** 이다 (아직 아무것도 살지 않는다).
 * 세계가 모르는 개체군도 0 이다 — 없는 것을 지어내지 않는다.
 */
export function populationValueOf(
  states: Record<string, RegionState>,
  populationId: string,
): number {
  const population = findPopulation(populationId);
  if (!population) return 0;
  return states[population.regionId]?.populations?.[populationId]?.value ?? 0;
}

/**
 * RULE-LIFE-CONDITION-001 (C022 ADDED · spec R2 · SPEC-004) —
 * 그 탄생지에 지금 **모자란 것**들의 조건 코드.
 *
 * 요구마다 지금 차 있는지를 판정하고, **모자란 것마다** 그 요구가 밝힌 코드를 건다.
 * 빈 배열이면 넷이 다 차 있다는 뜻이다 — 차 있는 것은 실리지 않는다: 관찰에 말할 것을
 * 가진 쪽은 모자란 쪽이다 (spec Observable · 원천의 조건 코드가 그런 그대로).
 *
 * 요구의 갈래는 셋이다.
 *   ① 원천이 **있는가** — 그 원천의 phase 가 available 인가. 같은 방이든 다른 방이든 묻는다
 *   ② **비가 오는가** — 세계 시각과 철에서 유도된다 (RULE-RAIN-001 · 저장되지 않는다)
 *   ③ 개체군의 값이 **그 값 이하인가**
 *
 * 경계 ① 요구를 밝히지 않은 탄생지는 늘 차 있는 것으로 읽는다 (빈 배열이다).
 * 경계 ② **세계가 모르는 원천 · 개체군을 가리킨 요구는 차지 않은 것으로 읽는다** — 끊긴
 *        참조는 아무 일도 하지 않고 그 탄생은 서지 않는다 (C021 R3 의 어법). 개체군은 값이
 *        0 으로 읽히므로 "0 이하" 요구는 저절로 차지만, 원천은 없으면 차지 않는다.
 * 경계 ③ **관찰자와 무관하다** — 그 방에 몸이 없어도 매 Tick 돈다 (부르는 쪽이 그렇다).
 *
 * 규칙은 무엇이 모자란지 이름으로 알지 못한다 — 걸리는 글자는 데이터가 준다.
 */
export function lifeUnmetCodes(
  states: Record<string, RegionState>,
  site: LifeSite,
  time: number,
): string[] {
  const codes: string[] = [];
  for (const requirement of site.requires) {
    if (!isRequirementMet(states, requirement, time)) codes.push(requirement.unmetCode);
  }
  return codes;
}

/**
 * RULE-LIFE-SITE-PHASE-001 (C022 ADDED · spec R4) —
 * 그 방에서 **탄생지가 자기 자락에 하는 일**.
 *
 * 위상을 거는 **원인이 여섯째**가 되었다 (철 · 소란 · 지나가는 것 · 상시 · 고갈 · **탄생지**).
 * 형은 흔적의 것 그대로이고 거는 쪽이 하나 늘었을 뿐이다 — 그래서 이 답은 앞의 다섯이 건
 * 것과 **함께** 걸리고 서로 지우지 않는다 (spec R4 경계 ①).
 *
 * 자락마다 답은 둘 중 하나다.
 *   hidden  그 자락이 밝힌 조건 코드가 지금 걸려 있다 → **서지 않는다** (단계 0)
 *   faded   그 탄생지가 지금 결속 중이다 → **한 단계 옅어진다** (재료가 그리로 간다)
 * 둘 다 아닌 자락은 데이터의 단계 그대로다.
 *
 * **땅도 통행 격자도 hash 도 한 값 바뀌지 않는다** (경계 ②) — 이 답은 그 방 Description 의
 * trace area 를 op id 로 가리킬 뿐이다 (원천 둘레가 옅어지는 그 어법 그대로 · C012).
 *
 * 차례는 그 방 탄생지의 차례이고 탄생지 안에서는 자락의 차례다 — State 의 키 순서에 기대지
 * 않는다 (결정론).
 */
export function lifeTraceOverlayIn(
  states: Record<string, RegionState>,
  regionId: string,
  time: number,
): Map<string, { hidden: boolean; faded: boolean }> {
  const overlay = new Map<string, { hidden: boolean; faded: boolean }>();
  for (const site of lifeSitesInRegion(regionId)) {
    if (site.traces.length === 0) continue;
    const binding = lifeSiteStateOf(states, regionId, site.id).phase === 'BINDING';
    // 가려짐을 물어야 하는 자락이 하나라도 있을 때만 요구를 판정한다 — 없으면 물을 것이 없다.
    const unmet = site.traces.some((trace) => trace.hiddenWhen !== undefined)
      ? lifeUnmetCodes(states, site, time)
      : [];
    for (const trace of site.traces) {
      overlay.set(trace.op, {
        hidden: trace.hiddenWhen !== undefined && unmet.includes(trace.hiddenWhen),
        faded: binding && trace.fadesWhileBinding === true,
      });
    }
  }
  return overlay;
}

/**
 * RULE-LIFE-SITE-PHASE-001 (C022 ADDED · spec R4 · SPEC-003 ④) —
 * **결속하는 탄생지의 자락 위에 선 동안** 걸리는 코드들.
 *
 * C019 가 결정면에 준 **접촉 코드**와 같은 자리다: 위험의 코드가 "이 자리가 무엇인가" 라면
 * 이것은 "지금 내가 그것에 닿아 있다" 이다. **위험 태그를 만들지 않는다** — 몸에 아무 일도
 * 하지 않으므로 자락이 아니라 선 자리의 말이다 (spec 기본형 ⑧).
 *
 * 결속 중이 아니면 한 글자도 늘지 않는다. 그 자락이 그 방 Description 에 없거나 밝힌 코드가
 * 없는 탄생지도 마찬가지다 — 없는 것을 지어내지 않는다.
 *
 * 차례는 데이터의 차례다 (결정론). **요구를 묻지 않는다** — 이미 결속 중이라는 것이
 * 요구가 차 있다는 뜻이고, 그래서 시각도 묻지 않는다.
 */
export function lifeStandingCodesAt(
  states: Record<string, RegionState>,
  regionId: string,
  position: WorldPosition,
): string[] {
  const spec = regionSpec(regionId);
  if (!spec) return [];
  const codes: string[] = [];
  for (const site of lifeSitesInRegion(regionId)) {
    if (lifeSiteStateOf(states, regionId, site.id).phase !== 'BINDING') continue;
    for (const trace of site.traces) {
      const code = trace.standingCodeWhileBinding;
      if (code === undefined) continue;
      const area = areasOf(spec.space, TRACE_LAYER).find((it) => it.id === trace.op);
      if (!area) continue;
      if (areaCoversPoint(area.shape, position.x, position.z)) codes.push(code);
    }
  }
  return codes;
}

// ── 안쪽 ─────────────────────────────────────────────────────────────
//
// 탄생지의 자리는 **원천과 같은 layer** 에 적힌다 (RESOURCE_LAYER · spec SPEC-002) —
// 알집은 원천이 아니지만 "땅 위에 선 것" 을 적는 자리를 둘로 만들면 같은 것을 두 곳에서
// 찾게 된다 (F13 — 새 layer 를 만들지 않는다).

/** 데이터의 탄생지 하나를 세계의 것으로 옮긴다 — 여기서 값을 짓지 않는다 */
function toLifeSite(spec: LifeSiteSpec, regionId: string, position: WorldPosition): LifeSite {
  return {
    id: spec.id,
    regionId,
    form: spec.form,
    position,
    requires: spec.condition.requires,
    traces: spec.traces.before,
    bindingSeconds: spec.bindingSeconds,
    population: spec.population,
  };
}

/** 요구 하나가 지금 차 있는가 — 갈래 셋 (RULE-LIFE-CONDITION-001) */
function isRequirementMet(
  states: Record<string, RegionState>,
  requirement: LifeRequirement,
  time: number,
): boolean {
  if (requirement.kind === 'rain') return isRainingAt(time);
  if (requirement.kind === 'population-at-most') {
    return populationValueOf(states, requirement.populationId) <= requirement.value;
  }
  // ① 원천이 있는가 — 세계가 모르는 원천은 **차지 않은 것**이다 (경계 ②).
  const source = findResourceSource(requirement.sourceId);
  if (!source) return false;
  return sourceStateOf(states, source.regionId, source.id).phase === 'available';
}

/** 세계가 아는 모든 방의 탄생지를 id 로 엮은 표 — 첫 물음에 한 번 만든다 */
function siteIndex(): Map<string, LifeSite> {
  if (SITE_INDEX) return SITE_INDEX;
  const index = new Map<string, LifeSite>();
  for (const spec of REGION_SPECS) {
    for (const site of lifeSitesInRegion(spec.id)) index.set(site.id, site);
  }
  SITE_INDEX = index;
  return index;
}

/** 세계가 아는 모든 방의 개체군을 id 로 엮은 표 — 첫 물음에 한 번 만든다 */
function populationIndex(): Map<string, Population> {
  if (POPULATION_INDEX) return POPULATION_INDEX;
  const index = new Map<string, Population>();
  for (const spec of REGION_SPECS) {
    for (const population of spec.ecology?.populations ?? []) {
      index.set(population.id, { ...population, regionId: spec.id });
    }
  }
  POPULATION_INDEX = index;
  return index;
}

/** 그 phase 가 결속을 이어 갈 수 있는 자리인가 — 이 Cycle 이 오가는 것은 앞의 둘이다 */
export function isBindablePhase(phase: LifeSitePhase): boolean {
  return phase === 'DORMANT' || phase === 'BINDING';
}
