// Phase 5 완료 조건 점검 도구 (verify.ts 가 이 함수들의 결과를 그대로 표로 찍는다)
//
// "통과했다"는 주장이 아니라 수치를 남긴다 — CLAUDE.md 검토 규칙.
import { abilityCostWeight } from "./derivations";
import type { AbilityDefinition, WorldDefinition } from "../core/world/types";
import type { WorldScale } from "./GenerationTypes";

export interface ScaleRow {
  item: string;
  target: string;
  actual: number;
  ok: boolean;
}

/** §40 초기 프로토타입의 규모 표를 그대로 대조한다 */
export function checkScale(definition: WorldDefinition, scale: WorldScale): ScaleRow[] {
  const bootstrap = definition.bootstrap.entities;
  const named = new Set(definition.agentArchetypes.map((archetype) => archetype.id));
  const generalEntities = bootstrap.filter(
    (entity) =>
      entity.type !== "location" &&
      !named.has(entity.id) &&
      !definition.factions.some((faction) => faction.id === entity.id) &&
      !definition.factions.some((faction) =>
        (faction.internalGroups ?? []).some((group) => group.id === entity.id),
      ) &&
      entity.id.includes("#"),
  ).length;
  const exact = (item: string, target: number, actual: number): ScaleRow => ({
    item,
    target: String(target),
    actual,
    ok: actual === target,
  });
  const range = (item: string, min: number, max: number, actual: number): ScaleRow => ({
    item,
    target: `${min}~${max}`,
    actual,
    ok: actual >= min && actual <= max,
  });
  return [
    exact("지역", scale.regions, definition.spaces.regions.length),
    exact("세부 장소", scale.locations, definition.spaces.locations.length),
    exact("종족", scale.species, definition.species.length),
    exact("조직", scale.factions, definition.factions.length),
    exact("주요 개인", scale.keyAgents, definition.agentArchetypes.length),
    range("일반 개체", scale.generalEntities.min, scale.generalEntities.max, generalEntities),
    exact("자원", scale.resources, definition.resources.length),
    exact("행동", scale.actions, definition.actionDefinitions.length),
    range("세계 규칙", scale.rules.min, scale.rules.max, definition.ruleDefinitions.length),
    exact("사건 패턴", scale.eventPatterns, definition.eventPatterns.length),
    exact("능력 사용자", scale.abilityUsers, definition.abilitySystem?.abilities.length ?? 0),
  ];
}

export interface FirstWorldItem {
  item: string;
  ok: boolean;
  evidence: string;
}

/** §41 "자동 생성되어야 하는 결과" 10항목 */
export function checkFirstWorldItems(definition: WorldDefinition): FirstWorldItem[] {
  const regions = definition.spaces.regions;
  const species = definition.species;
  const factions = definition.factions;
  const archetypes = definition.agentArchetypes;

  const absorbing = species.filter((entry) =>
    entry.requiredResources.some((need) => need.resourceTag.includes("residue")),
  );
  const byPurpose = (keyword: string) =>
    factions.filter(
      (faction) =>
        faction.publicPurpose.includes(keyword) ||
        faction.hiddenPurposes.some((purpose) => purpose.includes(keyword)),
    );
  // 가장 희귀한 자원(§13 파생 희귀도 최댓값)을 통제하는 조직 = §41 의 "국가 기관"
  const rarest = [...definition.resources].sort(
    (a, b) => Number(b.properties["rarity"] ?? 0) - Number(a.properties["rarity"] ?? 0),
  )[0];
  const controllers = factions.filter((faction) =>
    rarest !== undefined && faction.controlledResources.includes(rarest.id),
  );
  const smugglers = factions.filter((faction) =>
    faction.controlledResources.some((resource) =>
      (definition.resources.find((entry) => entry.id === resource)?.tags ?? []).includes("contraband"),
    ),
  );
  const graphIds = new Set(definition.goalTemplates.map((graph) => graph.id));
  const withGraph = archetypes.filter((archetype) => graphIds.has(archetype.goalGraphId));
  const internalGroups = factions.flatMap((faction) =>
    (faction.internalGroups ?? []).map((group) => `${faction.id}/${group.id}(${group.stance})`),
  );
  const conflictedGroups = factions.filter((faction) => {
    const stances = new Set((faction.internalGroups ?? []).map((group) => group.stance));
    return stances.has("benefits") && stances.has("harmed");
  });

  const item = (name: string, ok: boolean, evidence: string): FirstWorldItem => ({
    item: name,
    ok,
    evidence,
  });
  // 지역이 "생태적으로 다르다" = 위험도와 잔재량이 서로 다르다
  const dangers = regions.map((region) => Number(region.baseStates["danger"] ?? 0));
  const residues = regions.map((region) => Number(region.baseStates["ability_residue"] ?? 0));
  return [
    item(
      "생태적으로 다른 지역 3개",
      regions.length === 3 && new Set(dangers).size === 3 && new Set(residues).size === 3,
      regions.map((r, i) => `${r.name}(위험 ${dangers[i]}·잔재 ${residues[i]})`).join(" / "),
    ),
    item(
      "능력 흔적을 흡수하는 생물 종",
      absorbing.length > 0,
      absorbing.map((s) => `${s.name}(${s.requiredResources.map((n) => n.resourceTag).join(",")})`).join(" / "),
    ),
    item(
      "희귀 자원을 통제하는 국가 기관",
      controllers.length > 0,
      `가장 희귀한 ${rarest?.name}(희귀도 ${rarest?.properties["rarity"]}) 통제 — ${controllers.map((f) => f.name).join(" / ")}`,
    ),
    item("생물을 연구하는 조직", byPurpose("연구").length > 0 || byPurpose("이해").length > 0,
      [...byPurpose("연구"), ...byPurpose("이해")].map((f) => f.name).join(" / ")),
    // 밀수 조직은 말이 아니라 다루는 물건으로 가린다 — 금제 물품을 통제하는 조직이 밀수 조직이다
    item(
      "자원을 밀수하는 조직",
      smugglers.length > 0,
      smugglers.map((f) => `${f.name}[${f.controlledResources.join(",")}]`).join(" / "),
    ),
    item("생태계를 보호하려는 집단", byPurpose("숲").length > 0 || byPurpose("생태").length > 0,
      [...byPurpose("숲"), ...byPurpose("생태")].map((f) => f.name).join(" / ")),
    item(
      "서로 다른 욕망과 능력을 가진 인간 20명",
      archetypes.length === 20 && new Set(archetypes.map((a) => a.currentProblem)).size === 20,
      `${archetypes.length}명 · 서로 다른 현재 문제 ${new Set(archetypes.map((a) => a.currentProblem)).size}종 · 역할 ${new Set(archetypes.map((a) => a.role)).size}종`,
    ),
    item(
      "각 인물의 목적 그래프",
      withGraph.length === archetypes.length,
      `${withGraph.length}/${archetypes.length}명이 실재하는 그래프를 가리킨다 (그래프 ${definition.goalTemplates.length}개)`,
    ),
    item(
      "조직 내부의 파벌과 갈등",
      conflictedGroups.length >= 3,
      `내부 집단 ${internalGroups.length}개 · 수혜/피해가 함께 있는 조직 ${conflictedGroups.length}개 — ${internalGroups.slice(0, 3).join(", ")}…`,
    ),
    item(
      "최소 10개의 사건 패턴",
      definition.eventPatterns.length >= 10,
      `${definition.eventPatterns.length}개 — ${definition.eventPatterns.map((p) => p.type).slice(0, 5).join(", ")}…`,
    ),
  ];
}

export interface AbilityRow {
  id: string;
  owner: string;
  output: number;
  costWeight: number;
  restrictions: number;
  hasBacklash: boolean;
  derivedFrom: string;
}

/** §16 절차 + §34 "강한 능력일수록 제약이나 대가가 증가한다" */
export function summarizeAbilities(abilities: readonly AbilityDefinition[]): AbilityRow[] {
  return [...abilities]
    .map((ability) => ({
      id: ability.id,
      owner: ability.ownerId,
      output: ability.outputRange.max,
      costWeight: abilityCostWeight(
        ability.restrictions.map((restriction) => restriction.severity),
        ability.costs.map((cost) => cost.amount),
      ),
      restrictions: ability.restrictions.length,
      hasBacklash: ability.failureEffects.length > 0,
      derivedFrom: ability.derivedFrom.coreDesire,
    }))
    .sort((a, b) => a.output - b.output);
}

/** 출력이 커질수록 대가도 커지는가 (단조성) */
export function costsGrowWithOutput(rows: readonly AbilityRow[]): boolean {
  return rows.every((row, index) => index === 0 || row.costWeight >= rows[index - 1]!.costWeight);
}

// --- §41 "초기 사건은 수동으로 작성하지 않는다. 초기 상태만 배치한다" 6항 (G-3) ---------

/**
 * 여섯 배치 전부가 **실행 데이터**(상태·믿음·목적 연결)인지 본다.
 * 은닉 동기 2건(밀렵 수요·지도자 은폐)은 hiddenGoalIds 가 생기기 전에는 선언 문자열이었다.
 */
export function checkInitialPlacements(definition: WorldDefinition): FirstWorldItem[] {
  const entities = definition.bootstrap.entities;
  const item = (name: string, ok: boolean, evidence: string): FirstWorldItem => ({ item: name, ok, evidence });

  const village = entities.find((entry) => entry.id === "faction.silent_village");
  const foodReserve = Number(village?.states["food_reserve"] ?? Number.NaN);
  const consumptionRules = definition.ruleDefinitions.filter(
    (rule) =>
      rule.effects.some((effect) => effect.type === "modify_state" && effect.stateKey === "food_reserve") &&
      (rule.id.includes("consumption") || rule.name.includes("소비")),
  );

  const beliefsOf = (predicate: (entity: (typeof entities)[number]) => boolean) =>
    entities.filter(predicate).flatMap((entity) => entity.beliefs ?? []);
  const rumorBeliefs = beliefsOf(() => true).filter(
    (belief) =>
      belief.subjectId.startsWith("creature.") &&
      belief.sourceIds.some((source) => source.includes("rumor") || source.includes("trace")),
  );
  const researcherDoubts = beliefsOf((entity) => entity.tags.includes("researcher")).filter(
    (belief) => belief.subjectId.startsWith("creature.") && belief.sourceIds.some((s) => s.includes("observation")),
  );

  const smugglerFaction = definition.factions.find((faction) =>
    faction.id.includes("smuggler") || faction.hiddenPurposes.some((purpose) => purpose.includes("장기")),
  );
  const organResource = definition.resources.find((resource) =>
    resource.desiredBy.some((desire) => desire.agentTag.includes("smuggler") || desire.agentTag.includes("poacher")),
  );

  const leaderConcealment = definition.factions.find(
    (faction) => faction.id === "faction.silent_village" && faction.hiddenPurposes.length > 0,
  );

  const protectingMother = entities.find((entry) => entry.states["protecting_offspring"] === true);

  return [
    item(
      "마을 식량 비축량이 감소하고 있다",
      Number.isFinite(foodReserve) && consumptionRules.length > 0,
      `초기 비축 ${foodReserve} · 소비 규칙 ${consumptionRules.map((rule) => rule.id).join(",") || "없음"}`,
    ),
    item(
      "교역로 근처에서 변이 생물의 흔적이 발견된다",
      rumorBeliefs.length > 0,
      rumorBeliefs
        .slice(0, 2)
        .map((belief) => `${belief.subjectId}.${belief.stateKey}=${String(belief.believedValue)} ← ${belief.sourceIds[0]}`)
        .join(" / ") || "소문·흔적 믿음 없음",
    ),
    item(
      "연구자는 생물의 행동이 공격이 아니라고 의심한다",
      researcherDoubts.length > 0,
      researcherDoubts
        .slice(0, 1)
        .map((belief) => `${belief.stateKey}=${String(belief.believedValue)} (확신 ${belief.confidence}) ← ${belief.sourceIds[0]}`)
        .join("") || "관찰 근거 믿음 없음",
    ),
    item(
      "밀렵 조직은 생물의 장기를 원한다 (실행 목적 연결)",
      organResource !== undefined &&
        smugglerFaction !== undefined &&
        (smugglerFaction.hiddenGoalIds ?? []).length > 0,
      `수요 자원 ${organResource?.id ?? "없음"} · ${smugglerFaction?.id ?? "조직 없음"} 은닉 목적 ${(smugglerFaction?.hiddenGoalIds ?? []).join(",") || "미연결"}`,
    ),
    item(
      "마을 지도자는 불법 자원 채굴을 숨기고 있다 (실행 목적 연결)",
      leaderConcealment !== undefined && (leaderConcealment.hiddenGoalIds ?? []).length > 0,
      `${leaderConcealment?.hiddenPurposes[0] ?? "은닉 문구 없음"} → ${(leaderConcealment?.hiddenGoalIds ?? []).join(",") || "미연결"}`,
    ),
    item(
      "생물은 새끼를 안전한 지역으로 이동시키려 한다",
      protectingMother !== undefined,
      protectingMother === undefined
        ? "protecting_offspring=true 개체 없음"
        : `${protectingMother.id} protecting_offspring=true · offspring_threat=${String(protectingMother.states["offspring_threat"])}`,
    ),
  ];
}
