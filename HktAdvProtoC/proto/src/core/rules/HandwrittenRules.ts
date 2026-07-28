// 수동 세계의 규칙 20개 (기획서 §11 의미 준수, Phase-1 "규칙 20개 분류")
//
// Phase 1 의 규칙은 TS 함수지만 트리거·관찰 효과는 데이터로 선언한다.
// Phase 2 는 각 규칙의 run 본문을 conditions/effects JSON 으로 옮기기만 하면 된다 — 1:1 이관 체크리스트가 곧 이 목록이다.
//
//  신진대사 4 : rule.hunger_growth / rule.hunger_health_decay / rule.eat_effect / rule.rest_recovery
//  자원 순환 4 : rule.forest_resource_regrowth / rule.village_food_consumption / rule.hunt_yield / rule.trade_transfer
//  생태     4 : rule.echo_beast_feeding / rule.offspring_threat_change / rule.territory_pressure / rule.attack_resolution
//  사회     4 : rule.trade_price / rule.report_propagation / rule.threat_sighting_fear / rule.subjugation_call
//  관찰 신호 4 : rule.movement_trace / rule.attack_noise / rule.carcass_discovery / rule.residue_trace
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "../../shared/time";
import { entitiesByType, entitiesNear } from "../world/Queries";
import { emitObservationEffect } from "../world/Signals";
import type { WorldRuntime } from "../world/WorldRuntime";
import type { RuleContext, HandwrittenRule } from "./RuleRegistry";

/**
 * 규칙 상수 — 매직 넘버를 규칙 본문에 흩지 않는다.
 * 결정론에 직접 영향을 주는 값이므로 런타임 변경 수단은 두지 않는다(시드 재현성 §44-12).
 */
export const RULE_TUNING = {
  hungerPerHour: 1,
  starvationHungerThreshold: 70,
  starvationHealthLoss: 2,
  eatHungerRelief: 40,
  eatEnergyGain: 10,
  restEnergyGain: 30,
  restHealthGain: 3,
  restFearRelief: 6,
  factionFoodPerMember: 1.2,
  /** 하루치 배급이 덜어 주는 허기 — 허기 증가(24/일)보다 작다. 소속은 굶주림을 늦출 뿐이다 */
  dailyRation: 26,
  huntYieldBase: 12,
  huntYieldVariance: 9,
  tradeFoodUnit: 20,
  tradeWealthDivisor: 10,
  residuePerFeeding: 2,
  feedingHungerRelief: 15,
  residueSearchRadius: 80,
  intruderRadius: 60,
  offspringThreatBase: 35,
  offspringThreatPerIntruder: 25,
  offspringThreatDecay: 4,
  territoryPressureRatio: 0.8,
  aggressionRisePerPressure: 3,
  aggressionPressureThreshold: 70,
  attackDamageBase: 15,
  attackDamageVariance: 10,
  attackFearShock: 25,
  basePrice: 20,
  scarcityPriceWeight: 0.4,
  minPrice: 5,
  maxPrice: 80,
  reportFearGain: 10,
  fearFollowsThreat: 0.4,
  subjugationThreatThreshold: 60,
  subjugationFoodThreshold: 60,
} as const;

const HUMAN_SPECIES = "species.human";
const ECHO_BEAST_SPECIES = "species.echo_beast";

function agentsOf(runtime: WorldRuntime): string[] {
  return entitiesByType(runtime, "agent").map((e) => e.id);
}

function speciesOf(runtime: WorldRuntime, agentId: string): string {
  const value = runtime.store.read(agentId, "species_id");
  return typeof value === "string" ? value : "";
}

/** 행동에 선언된 관찰 효과(§21 visibleSignals)를 신호로 내보낸다 */
function emitActionSignals(ctx: RuleContext, actionId: string, signalId: string): void {
  const action = ctx.runtime.index.actions.get(actionId);
  if (action === undefined || ctx.subjectId === undefined) return;
  for (const effect of action.visibleSignals) {
    if (effect.signalId !== signalId) continue;
    emitObservationEffect(ctx.runtime, effect, {
      actorId: ctx.subjectId,
      ...(ctx.targetIds[0] !== undefined ? { targetId: ctx.targetIds[0] } : {}),
    });
  }
}

/** 규칙 자신에 선언된 관찰 효과(§11 observations)를 신호로 내보낸다 */
function emitRuleSignals(ctx: RuleContext): void {
  if (ctx.subjectId === undefined) return;
  for (const effect of ctx.rule.observations ?? []) {
    emitObservationEffect(ctx.runtime, effect, { actorId: ctx.subjectId });
  }
}

// --- 신진대사 4 ----------------------------------------------------------------

const hungerGrowth: HandwrittenRule = {
  id: "rule.hunger_growth",
  name: "허기 증가",
  scope: "global",
  priority: 100,
  triggers: [{ type: "interval", interval: TICKS_PER_HOUR }],
  derivedFromAxioms: ["axiom.life_must_be_sustained"],
  run: (ctx) => {
    for (const agentId of agentsOf(ctx.runtime)) {
      ctx.runtime.store.modify(agentId, "hunger", "add", RULE_TUNING.hungerPerHour);
    }
  },
};

const hungerHealthDecay: HandwrittenRule = {
  id: "rule.hunger_health_decay",
  name: "허기가 체력을 갉는다",
  scope: "global",
  priority: 95,
  triggers: [{ type: "interval", interval: TICKS_PER_HOUR }],
  derivedFromAxioms: ["axiom.life_must_be_sustained"],
  run: (ctx) => {
    for (const agentId of agentsOf(ctx.runtime)) {
      if (ctx.runtime.store.readNumber(agentId, "hunger") > RULE_TUNING.starvationHungerThreshold) {
        ctx.runtime.store.modify(agentId, "health", "add", -RULE_TUNING.starvationHealthLoss);
      }
    }
  },
};

const eatEffect: HandwrittenRule = {
  id: "rule.eat_effect",
  name: "식사 효과",
  scope: "entity",
  priority: 50,
  triggers: [{ type: "action_executed", actionId: "action.eat" }],
  derivedFromAxioms: ["axiom.life_must_be_sustained"],
  run: (ctx) => {
    if (ctx.subjectId === undefined) return;
    // 식량 소모는 행동 비용(§27-7)에서 이미 지불됐다 — 여기서는 효과만 적용한다
    ctx.runtime.store.modify(ctx.subjectId, "hunger", "add", -RULE_TUNING.eatHungerRelief);
    ctx.runtime.store.modify(ctx.subjectId, "energy", "add", RULE_TUNING.eatEnergyGain);
  },
};

const restRecovery: HandwrittenRule = {
  id: "rule.rest_recovery",
  name: "휴식 회복",
  scope: "entity",
  priority: 50,
  triggers: [{ type: "action_executed", actionId: "action.rest" }],
  derivedFromAxioms: ["axiom.life_must_be_sustained"],
  run: (ctx) => {
    if (ctx.subjectId === undefined) return;
    ctx.runtime.store.modify(ctx.subjectId, "energy", "add", RULE_TUNING.restEnergyGain);
    ctx.runtime.store.modify(ctx.subjectId, "health", "add", RULE_TUNING.restHealthGain);
    ctx.runtime.store.modify(ctx.subjectId, "fear", "add", -RULE_TUNING.restFearRelief);
  },
};

// --- 자원 순환 4 ---------------------------------------------------------------

const forestResourceRegrowth: HandwrittenRule = {
  id: "rule.forest_resource_regrowth",
  name: "침묵림 자원 재생",
  scope: "region",
  priority: 80,
  triggers: [{ type: "interval", interval: 6 * TICKS_PER_HOUR }],
  derivedFromAxioms: ["axiom.dangerous_places_are_rich"],
  run: (ctx) => {
    for (const node of entitiesByType(ctx.runtime, "resource")) {
      if (!node.tags.includes("harvestable")) continue;
      const regrowth = ctx.runtime.store.readNumber(node.id, "regrowth");
      if (regrowth > 0) ctx.runtime.store.modify(node.id, "amount", "add", regrowth);
    }
  },
};

/**
 * 마을 식량 소비 — 비축을 헐어 구성원을 먹인다.
 * 비축이 모자라면 배급도 그만큼만 나온다. 조직의 식량이 개인의 허기로 이어지는 유일한 통로이며,
 * 비축이 마르는 순간 "굶주림 → 사냥 → 숲 → 접촉"의 연쇄가 시작된다.
 */
const villageFoodConsumption: HandwrittenRule = {
  id: "rule.village_food_consumption",
  name: "마을 식량 소비",
  scope: "global",
  priority: 80,
  triggers: [{ type: "interval", interval: TICKS_PER_DAY }],
  derivedFromAxioms: ["axiom.life_must_be_sustained"],
  run: (ctx) => {
    for (const faction of entitiesByType(ctx.runtime, "faction")) {
      const need = ctx.runtime.store.readNumber(faction.id, "member_count") * RULE_TUNING.factionFoodPerMember;
      if (need <= 0) continue;
      const reserve = ctx.runtime.store.readNumber(faction.id, "food_reserve");
      const taken = Math.min(need, reserve);
      if (taken <= 0) continue;
      ctx.runtime.store.modify(faction.id, "food_reserve", "add", -taken);
      const ration = (taken / need) * RULE_TUNING.dailyRation;
      for (const agentId of agentsOf(ctx.runtime)) {
        if (ctx.runtime.store.read(agentId, "faction_id") !== faction.id) continue;
        ctx.runtime.store.modify(agentId, "hunger", "add", -ration);
      }
    }
  },
};

const huntYield: HandwrittenRule = {
  id: "rule.hunt_yield",
  name: "사냥 산출",
  scope: "entity",
  priority: 50,
  triggers: [{ type: "action_executed", actionId: "action.hunt" }],
  derivedFromAxioms: ["axiom.dangerous_places_are_rich"],
  run: (ctx) => {
    const nodeId = ctx.targetIds[0];
    if (ctx.subjectId === undefined || nodeId === undefined) return;
    const available = ctx.runtime.store.readNumber(nodeId, "amount");
    if (available <= 0) return;
    const rng = ctx.runtime.rngFor(ctx.subjectId);
    const attempt = RULE_TUNING.huntYieldBase + rng.nextInt(RULE_TUNING.huntYieldVariance);
    const yielded = Math.min(available, attempt);
    ctx.runtime.store.modify(nodeId, "amount", "add", -yielded);
    ctx.runtime.store.modify(ctx.subjectId, "carried_food", "add", yielded);
  },
};

const tradeTransfer: HandwrittenRule = {
  id: "rule.trade_transfer",
  name: "거래 이전",
  scope: "relationship",
  priority: 40, // 가격 결정(rule.trade_price, 60) 뒤에 실행된다
  triggers: [{ type: "action_executed", actionId: "action.trade" }],
  derivedFromAxioms: ["axiom.scarcity_creates_exchange"],
  run: (ctx) => {
    const factionId = ctx.targetIds[0];
    if (ctx.subjectId === undefined || factionId === undefined) return;
    const carried = ctx.runtime.store.readNumber(ctx.subjectId, "carried_food");
    const amount = Math.min(carried, RULE_TUNING.tradeFoodUnit);
    if (amount <= 0) return;
    const price = ctx.runtime.store.readGlobal("food_price");
    ctx.runtime.store.modify(ctx.subjectId, "carried_food", "add", -amount);
    ctx.runtime.store.modify(factionId, "food_reserve", "add", amount);
    ctx.runtime.store.modify(
      ctx.subjectId,
      "wealth",
      "add",
      (amount * (typeof price === "number" ? price : RULE_TUNING.basePrice)) /
        RULE_TUNING.tradeWealthDivisor,
    );
  },
};

// --- 생태 4 --------------------------------------------------------------------

const echoBeastFeeding: HandwrittenRule = {
  id: "rule.echo_beast_feeding",
  name: "반향수 섭식(능력 잔재)",
  scope: "global",
  priority: 70,
  triggers: [{ type: "interval", interval: 12 * TICKS_PER_HOUR }],
  derivedFromAxioms: ["axiom.creatures_absorb_ability_residue"],
  run: (ctx) => {
    for (const agentId of agentsOf(ctx.runtime)) {
      if (speciesOf(ctx.runtime, agentId) !== ECHO_BEAST_SPECIES) continue;
      const field = entitiesNear(ctx.runtime, agentId, RULE_TUNING.residueSearchRadius, (e) =>
        e.tags.includes("residue_source"),
      )[0];
      if (field === undefined) continue;
      const available = ctx.runtime.store.readNumber(field.id, "amount");
      if (available < RULE_TUNING.residuePerFeeding) continue;
      ctx.runtime.store.modify(field.id, "amount", "add", -RULE_TUNING.residuePerFeeding);
      ctx.runtime.store.modify(agentId, "carried_residue", "add", RULE_TUNING.residuePerFeeding);
      ctx.runtime.store.modify(agentId, "hunger", "add", -RULE_TUNING.feedingHungerRelief);
    }
  },
};

const offspringThreatChange: HandwrittenRule = {
  id: "rule.offspring_threat_change",
  name: "새끼 위협도 변화",
  scope: "entity",
  priority: 70,
  triggers: [{ type: "interval", interval: TICKS_PER_HOUR }],
  derivedFromAxioms: ["axiom.life_protects_what_it_values"],
  run: (ctx) => {
    for (const agentId of agentsOf(ctx.runtime)) {
      if (!ctx.runtime.store.readBoolean(agentId, "protecting_offspring")) continue;
      const intruders = entitiesNear(
        ctx.runtime,
        agentId,
        RULE_TUNING.intruderRadius,
        (e) => e.type === "agent" && e.states["species_id"] === HUMAN_SPECIES,
      );
      if (intruders.length > 0) {
        ctx.runtime.store.modify(
          agentId,
          "offspring_threat",
          "set",
          RULE_TUNING.offspringThreatBase + intruders.length * RULE_TUNING.offspringThreatPerIntruder,
        );
      } else {
        ctx.runtime.store.modify(agentId, "offspring_threat", "add", -RULE_TUNING.offspringThreatDecay);
      }
    }
  },
};

const territoryPressure: HandwrittenRule = {
  id: "rule.territory_pressure",
  name: "영역 압박",
  scope: "entity",
  priority: 60,
  triggers: [{ type: "state_changed", stateKey: "offspring_threat" }],
  derivedFromAxioms: ["axiom.life_protects_what_it_values"],
  run: (ctx) => {
    if (ctx.subjectId === undefined) return;
    const threat = ctx.runtime.store.readNumber(ctx.subjectId, "offspring_threat");
    ctx.runtime.store.modify(
      ctx.subjectId,
      "territory_pressure",
      "set",
      threat * RULE_TUNING.territoryPressureRatio,
    );
    if (threat > RULE_TUNING.aggressionPressureThreshold) {
      ctx.runtime.store.modify(ctx.subjectId, "aggression", "add", RULE_TUNING.aggressionRisePerPressure);
    }
  },
};

const attackResolution: HandwrittenRule = {
  id: "rule.attack_resolution",
  name: "공격 판정",
  scope: "relationship",
  priority: 50,
  triggers: [{ type: "action_executed", actionId: "action.attack" }],
  derivedFromAxioms: ["axiom.life_protects_what_it_values"],
  run: (ctx) => {
    const targetId = ctx.targetIds[0];
    if (ctx.subjectId === undefined || targetId === undefined) return;
    const rng = ctx.runtime.rngFor(ctx.subjectId);
    const damage = RULE_TUNING.attackDamageBase + rng.nextInt(RULE_TUNING.attackDamageVariance);
    ctx.runtime.store.modify(targetId, "health", "add", -damage);
    ctx.runtime.store.modify(targetId, "fear", "add", RULE_TUNING.attackFearShock);
  },
};

// --- 사회 4 --------------------------------------------------------------------

const tradePrice: HandwrittenRule = {
  id: "rule.trade_price",
  name: "거래 가격",
  scope: "global",
  priority: 60, // 이전(rule.trade_transfer, 40)보다 먼저 가격을 정한다
  triggers: [{ type: "action_executed", actionId: "action.trade" }],
  derivedFromAxioms: ["axiom.scarcity_creates_exchange"],
  run: (ctx) => {
    const factionId = ctx.targetIds[0];
    if (factionId === undefined) return;
    const reserve = ctx.runtime.store.readNumber(factionId, "food_reserve");
    const price = RULE_TUNING.basePrice + (100 - reserve) * RULE_TUNING.scarcityPriceWeight;
    ctx.runtime.store.setGlobal(
      "food_price",
      Math.min(RULE_TUNING.maxPrice, Math.max(RULE_TUNING.minPrice, price)),
    );
  },
};

const reportPropagation: HandwrittenRule = {
  id: "rule.report_propagation",
  name: "보고 → 조직 믿음 전파",
  scope: "relationship",
  priority: 50,
  triggers: [{ type: "action_executed", actionId: "action.report" }],
  derivedFromAxioms: ["axiom.organizations_act_on_reports"],
  run: (ctx) => {
    const factionId = ctx.targetIds[0];
    if (ctx.subjectId === undefined || factionId === undefined) return;
    const reported = ctx.runtime.store.readNumber(ctx.subjectId, "known_threat_level");
    const current = ctx.runtime.store.readNumber(factionId, "threat_belief");
    if (reported > current) ctx.runtime.store.modify(factionId, "threat_belief", "set", reported);
    ctx.runtime.store.modify(factionId, "fear", "add", RULE_TUNING.reportFearGain);
  },
};

const threatSightingFear: HandwrittenRule = {
  id: "rule.threat_sighting_fear",
  name: "위협 목격 → 공포",
  scope: "entity",
  priority: 55,
  triggers: [{ type: "state_changed", stateKey: "known_threat_level" }],
  derivedFromAxioms: ["axiom.belief_drives_behavior"],
  run: (ctx) => {
    if (ctx.subjectId === undefined) return;
    const threat = ctx.runtime.store.readNumber(ctx.subjectId, "known_threat_level");
    const fear = ctx.runtime.store.readNumber(ctx.subjectId, "fear");
    if (threat <= fear) return;
    ctx.runtime.store.modify(
      ctx.subjectId,
      "fear",
      "add",
      (threat - fear) * RULE_TUNING.fearFollowsThreat,
    );
  },
};

const subjugationCall: HandwrittenRule = {
  id: "rule.subjugation_call",
  name: "토벌 소집 조건",
  scope: "global",
  priority: 45,
  triggers: [
    { type: "state_changed", stateKey: "threat_belief" },
    { type: "state_changed", stateKey: "food_reserve" },
  ],
  derivedFromAxioms: ["axiom.organizations_act_on_reports"],
  run: (ctx) => {
    if (ctx.subjectId === undefined) return;
    const entity = ctx.runtime.store.findEntity(ctx.subjectId);
    if (entity === undefined || entity.type !== "faction") return;
    const threat = ctx.runtime.store.readNumber(ctx.subjectId, "threat_belief");
    const reserve = ctx.runtime.store.readNumber(ctx.subjectId, "food_reserve");
    // 위협을 믿고 있고 동시에 굶주릴 때만 토벌을 소집한다 — 둘 중 하나로는 움직이지 않는다
    if (threat > RULE_TUNING.subjugationThreatThreshold && reserve < RULE_TUNING.subjugationFoodThreshold) {
      ctx.runtime.store.modify(ctx.subjectId, "subjugation_ordered", "set", true);
    }
  },
};

// --- 관찰 신호 4 ---------------------------------------------------------------

const movementTrace: HandwrittenRule = {
  id: "rule.movement_trace",
  name: "이동 흔적",
  scope: "entity",
  priority: 30,
  triggers: [
    { type: "action_executed", actionId: "action.move" },
    { type: "action_executed", actionId: "action.track" },
    { type: "action_executed", actionId: "action.flee" },
  ],
  derivedFromAxioms: ["axiom.actions_leave_signs"],
  run: (ctx) => {
    if (ctx.subjectId === undefined || ctx.actionId === undefined) return;
    ctx.runtime.store.modify(ctx.subjectId, "recent_presence", "set", true);
    emitActionSignals(ctx, ctx.actionId, "signal.movement_trace");
  },
};

const attackNoise: HandwrittenRule = {
  id: "rule.attack_noise",
  name: "공격 소음",
  scope: "entity",
  priority: 30,
  triggers: [{ type: "action_executed", actionId: "action.attack" }],
  derivedFromAxioms: ["axiom.actions_leave_signs"],
  run: (ctx) => {
    emitActionSignals(ctx, "action.attack", "signal.attack_noise");
  },
};

const carcassDiscovery: HandwrittenRule = {
  id: "rule.carcass_discovery",
  name: "사체 발견",
  scope: "entity",
  priority: 30,
  triggers: [{ type: "action_executed", actionId: "action.hunt" }],
  derivedFromAxioms: ["axiom.actions_leave_signs"],
  run: (ctx) => {
    emitActionSignals(ctx, "action.hunt", "signal.carcass");
  },
};

/**
 * 흔적 잔류 — 반향수가 잔재를 흡수하면 그 자리에 흔적이 남는다.
 * 이 흔적은 "공격성"이 아니라 "새끼를 지키는 중"이라고 주장한다 — 같은 생물을 두고 믿음이 갈리는 지점(§10).
 */
const residueTrace: HandwrittenRule = {
  id: "rule.residue_trace",
  name: "흔적 잔류",
  scope: "entity",
  priority: 30,
  triggers: [{ type: "state_changed", stateKey: "carried_residue" }],
  derivedFromAxioms: ["axiom.actions_leave_signs", "axiom.creatures_absorb_ability_residue"],
  observations: [
    {
      signalId: "signal.residue_trace",
      channels: ["energy_sense", "trace"],
      strength: 70,
      tags: ["creature_trace", "important"],
      claim: {
        subject: "actor",
        stateKey: "protecting_offspring",
        value: true,
        confidence: 0.64,
      },
    },
  ],
  run: (ctx) => {
    emitRuleSignals(ctx);
  },
};

export const HANDWRITTEN_RULES: HandwrittenRule[] = [
  hungerGrowth,
  hungerHealthDecay,
  eatEffect,
  restRecovery,
  forestResourceRegrowth,
  villageFoodConsumption,
  huntYield,
  tradeTransfer,
  echoBeastFeeding,
  offspringThreatChange,
  territoryPressure,
  attackResolution,
  tradePrice,
  reportPropagation,
  threatSightingFear,
  subjugationCall,
  movementTrace,
  attackNoise,
  carcassDiscovery,
  residueTrace,
];
