// §16 능력 픽스처 실행 증명 (Phase-2 DoD 3·4).
//
// 능력 정의에는 전용 실행기가 없다 — 행동 체계와 규칙 체계로 분해되어 실행된다(Phase-2 §2.7).
// 여기서는 그 분해가 실제로 굴러가는지 한 사이클(발동 → 제약 위반 → 유지 조건 위반 → 반동)로 확인한다.
import {
  ABILITY_OWNER,
  BYSTANDER,
  CONTRACT_TRUTH,
  buildAbilityFixtureWorld,
  loadAmplificationRule,
} from "../../content/ability-fixture";
import { completeAction, startAction } from "../actions/ActionSystem";
import { findBelief } from "../agents/BeliefStore";
import { evaluateAll } from "../world/Conditions";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { validateWorldDefinition } from "../world/WorldValidation";
import { WorldRuntime } from "../world/WorldRuntime";
import type { CapabilityCheck } from "./capabilities";
import { RuleEngine } from "./RuleEngine";

interface Fixture {
  runtime: WorldRuntime;
  engine: RuleEngine;
}

function fixture(): Fixture {
  const definition = buildAbilityFixtureWorld(11);
  const engine = new RuleEngine(definition.ruleDefinitions);
  const errors = validateWorldDefinition(definition, engine);
  if (errors.length > 0) throw new Error(`능력 픽스처 정의 오류:\n${errors.join("\n")}`);
  const runtime = new WorldRuntime(definition);
  bootstrapWorld(runtime);
  return { runtime, engine };
}

/** 행동을 실제 경로로 한 번 굴린다 — 비용 지불(startAction) → 규칙 실행(completeAction) */
function performAction({ runtime, engine }: Fixture, actionId: string): void {
  const action = runtime.index.actions.get(actionId)!;
  const scheduled = startAction(
    runtime,
    ABILITY_OWNER,
    { action, targetIds: [], goalId: "goal.protect_contract" },
    action.duration,
  );
  completeAction(runtime, engine, ABILITY_OWNER, scheduled);
}

export function runAbilityChecks(): CapabilityCheck[] {
  const checks: CapabilityCheck[] = [];
  const add = (name: string, ok: boolean, evidence: string): void => {
    checks.push({ name, ok, evidence });
  };

  // --- §11.4 예시 규칙이 그대로 로드된다 ----------------------------------------
  {
    const rule = loadAmplificationRule();
    const trigger = rule.triggers[0];
    const condition = rule.conditions[0];
    const amplify = rule.effects[0];
    const observation = rule.observations[0];
    add(
      "§11.4 예시 규칙 로드",
      rule.id === "rule.ability_restriction_amplification" &&
        rule.priority === 80 &&
        trigger?.type === "action_executed" &&
        trigger.actionId === "action.use_ability" &&
        condition?.left.type === "actor_state" &&
        rule.effects.length === 2 &&
        amplify?.type === "modify_state" &&
        amplify.operation === "multiply" &&
        amplify.value === 1.8 &&
        observation?.signalId === "unstable_high_density_energy" &&
        observation.channels[0] === "energy_sense",
      `기획서 §11.4 JSON 그대로 — 트리거 ${trigger?.type}, 조건 1, 효과 ${rule.effects.length}(×${String(amplify?.type === "modify_state" ? amplify.value : "?")}), 신호 ${observation?.signalId}`,
    );
  }

  // --- §16 activationConditions → 행동 actorRequirements -------------------------
  {
    const { runtime } = fixture();
    const action = runtime.index.actions.get("action.use_ability")!;
    const scope = { runtime, actorId: ABILITY_OWNER };
    const allowed = evaluateAll(action.actorRequirements, scope);
    runtime.store.modify(ABILITY_OWNER, "contract_accepted", "set", false);
    const blocked = evaluateAll(action.actorRequirements, scope);
    add(
      "§16 발동 조건 → 행동 요구 조건",
      allowed && !blocked,
      `contract_accepted=true → 발동 가능 ${allowed}, false → ${blocked}`,
    );
  }

  // --- 발동: 비용 + 증폭(§11.4) + 관찰 신호(§16 observableSignals) -----------------
  const active = fixture();
  {
    const staminaBefore = active.runtime.store.readNumber(ABILITY_OWNER, "mental_stamina");
    performAction(active, "action.use_ability");
    const stamina = active.runtime.store.readNumber(ABILITY_OWNER, "mental_stamina");
    const output = active.runtime.store.readNumber(ABILITY_OWNER, "ability_output");
    const risk = active.runtime.store.readNumber(ABILITY_OWNER, "failure_penalty_risk");
    const activeFlag = active.runtime.store.readBoolean(ABILITY_OWNER, "ability_active");
    add(
      "§16 발동 — 비용·증폭·반동 위험",
      stamina === staminaBefore - 12 && activeFlag && output === 90 && risk === 25,
      `mental_stamina ${staminaBefore}→${stamina}, 능력 활성 ${activeFlag}, 출력 50×1.8=${output}, 실패 위험 +${risk}`,
    );

    const signals = active.runtime.state.pendingSignals;
    const abilitySignal = signals.find((s) => s.id.startsWith("signal.contract_symbols"));
    const amplifySignal = signals.find((s) => s.id.startsWith("unstable_high_density_energy"));
    add(
      "§16 관찰 가능 현상 · §11 규칙 신호",
      abilitySignal !== undefined && amplifySignal !== undefined && amplifySignal.strength === 76,
      `행동 신호 ${abilitySignal?.id ?? "(없음)"} / 규칙 신호 ${amplifySignal?.id ?? "(없음)"} strength=${String(amplifySignal?.strength)}`,
    );

    const belief = findBelief(active.runtime.agentRuntime(ABILITY_OWNER), ABILITY_OWNER, "ability_active");
    add(
      "§16 knownBy → 초기 믿음 (§10)",
      belief !== undefined && belief.sourceIds.includes("ability.contract_truth"),
      `agent.sera 의 자기 능력 믿음 출처 ${belief?.sourceIds.join(",") ?? "(없음)"}`,
    );
  }

  // --- 제약 위반: 거짓말이 제약을 깬다 (§16 restrictions) ------------------------
  {
    performAction(active, "action.lie");
    const lied = active.runtime.store.readBoolean(ABILITY_OWNER, "lied_since_activation");
    const valid = active.runtime.store.readBoolean(ABILITY_OWNER, "restriction_valid");
    add(
      "§16 제약 위반 검사",
      lied && !valid,
      `action.lie 실행 → lied_since_activation=${lied}, restriction_valid=${valid}`,
    );
  }

  // --- 유지 조건 위반 → 반동 (§16 maintenanceConditions / failureEffects) ---------
  {
    const before = active.runtime.store.readNumber(ABILITY_OWNER, "memory_integrity");
    const bystanderBefore = active.runtime.store.readNumber(BYSTANDER, "memory_integrity");
    active.engine.runInterval(active.runtime, "rule.ability_maintenance_watch");
    const after = active.runtime.store.readNumber(ABILITY_OWNER, "memory_integrity");
    const bystanderAfter = active.runtime.store.readNumber(BYSTANDER, "memory_integrity");
    const stillActive = active.runtime.store.readBoolean(ABILITY_OWNER, "ability_active");
    const output = active.runtime.store.readNumber(ABILITY_OWNER, "ability_output");
    add(
      "§16 유지 조건 위반 → 반동",
      after === before - 15 && !stillActive && output === 0,
      `감시 규칙 발동 → memory_integrity ${before}→${after}, 능력 활성 ${stillActive}, 출력 ${output}`,
    );
    // F-7 — 반동의 대상은 능력자만이 아니다. 실패 반동이 §11.3 RuleEffect(대상 선택자 포함)이므로
    // "제약을 어기면 곁의 사람이 다친다"가 선언되고, 같은 효과가 감시 규칙에 실려 실제로 걸린다.
    const declaration = CONTRACT_TRUTH.failureEffects.filter(
      (effect) => effect.type === "modify_state" && effect.target.type === "query",
    ).length;
    add(
      "§16 실패 반동이 능력자 밖으로 (§11.3 대상 선택자)",
      declaration > 0 && bystanderAfter === bystanderBefore - 5,
      `선언 — 실패 반동 ${CONTRACT_TRUTH.failureEffects.length}건 중 ${declaration}건이 query 대상(반경 10 안의 사람들) · ` +
        `실행 — 곁의 ${BYSTANDER} memory_integrity ${bystanderBefore}→${bystanderAfter}`,
    );
  }

  // --- 제약이 깨진 뒤에는 증폭도 없다 -------------------------------------------
  {
    const output = active.runtime.store.readNumber(ABILITY_OWNER, "ability_output");
    performAction(active, "action.use_ability");
    const reactivated = active.runtime.store.readNumber(ABILITY_OWNER, "ability_output");
    add(
      "제약 없는 재발동은 증폭되지 않는다 (§11.4 조건)",
      output === 0 && reactivated === 50,
      `거짓말 이후 재발동 → 출력 ${reactivated} (증폭 시 90)`,
    );
  }

  return checks;
}
