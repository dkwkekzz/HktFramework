// §12 "규칙 DSL 은 다음 능력을 지원해야 한다" 10항목 + Phase-2 가 더한 방어선 3항목의 실행 증명.
//
// 주장이 아니라 **실행 결과**를 남긴다 — 각 항목은 규칙을 실제로 돌린 뒤의 상태 수치를 근거로 붙인다.
// vitest 는 ok 가 전부 true 인지 보고, `npm run verify` 는 같은 결과를 표로 찍는다.
import {
  buildRuleLabWorld,
  LAB_AGENTS,
  LAB_OUTSIDER,
  LAB_PARTNER,
  LAB_PLANT,
} from "../../content/rule-lab";
import { completeAction } from "../actions/ActionSystem";
import { SimulationLoop } from "../simulation/SimulationLoop";
import { createWorldSystems } from "../simulation/WorldSystems";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { validateWorldDefinition } from "../world/WorldValidation";
import { WorldRuntime } from "../world/WorldRuntime";
import { RuleEngine } from "./RuleEngine";

export interface CapabilityCheck {
  /** §12 능력 이름 (또는 Phase-2 가 더한 방어선) */
  name: string;
  ok: boolean;
  evidence: string;
}

interface Lab {
  runtime: WorldRuntime;
  engine: RuleEngine;
}

function lab(seed = 7): Lab {
  const definition = buildRuleLabWorld(seed);
  const engine = new RuleEngine(definition.ruleDefinitions);
  const errors = validateWorldDefinition(definition, engine);
  if (errors.length > 0) throw new Error(`규칙 실험실 정의 오류:\n${errors.join("\n")}`);
  const runtime = new WorldRuntime(definition);
  bootstrapWorld(runtime);
  return { runtime, engine };
}

/** 행동 실행 한 번 — 규칙 4개(자원 이동·관계·신호·예약)가 한꺼번에 걸린다 */
function useLabAction(lab: Lab, actorId = LAB_AGENTS[0]!): void {
  lab.engine.dispatchAction(lab.runtime, "action.lab_use", actorId, [LAB_PARTNER]);
}

function num(runtime: WorldRuntime, entityId: string, key: string): number {
  return runtime.store.readNumber(entityId, key);
}

export function runCapabilityChecks(): CapabilityCheck[] {
  const checks: CapabilityCheck[] = [];
  const add = (name: string, ok: boolean, evidence: string): void => {
    checks.push({ name, ok, evidence });
  };

  // --- ① 조건 비교 / ② 상태 변경 ---------------------------------------------
  {
    const { runtime, engine } = lab();
    const before = LAB_AGENTS.map((id) => num(runtime, id, "health"));
    engine.runInterval(runtime, "rule.lab_heal");
    const after = LAB_AGENTS.map((id) => num(runtime, id, "health"));
    // health < 40 인 개체만 회복한다
    const healed = after.filter((v, i) => v !== before[i]).length;
    add(
      "① 조건 비교",
      healed === 1 && after[0] === 25 && after[1] === 60,
      `health<40 만 회복 — a0 ${before[0]}→${after[0]}, a1 ${before[1]}→${after[1]} (회복 대상 ${healed}/${LAB_AGENTS.length})`,
    );
    add("② 상태 변경", after[0] === 25, `modify_state add 5 → a0.health ${before[0]}→${after[0]}`);
  }

  // --- ③ 자원 이동 (부족분 기록 포함) -----------------------------------------
  {
    const { runtime, engine } = lab();
    const fromBefore = num(runtime, LAB_AGENTS[0]!, "stock");
    useLabAction({ runtime, engine });
    const fromAfter = num(runtime, LAB_AGENTS[0]!, "stock");
    const toAfter = num(runtime, LAB_PARTNER, "stock");
    const shortfall = runtime.state.changeLog
      .flatMap((c) => c.changedStates)
      .find((s) => s.stateKey === "shortfall:stock");
    add(
      "③ 자원 이동",
      fromBefore === 20 && fromAfter === 0 && toAfter === 20 && shortfall?.after === 10,
      `30 요청 → 잔량 ${fromBefore} 만큼만 이동 (a0 ${fromBefore}→${fromAfter}, partner 0→${toAfter}), 부족분 ${String(shortfall?.after)} 기록`,
    );
  }

  // --- ④ 개체 생성과 소멸 ------------------------------------------------------
  {
    const { runtime, engine } = lab();
    const countPlants = (): number =>
      Object.values(runtime.state.entities).filter((e) => e.tags.includes("spawned")).length;
    runtime.store.modify(LAB_AGENTS[1]!, "marked", "set", true);
    engine.drainStateChanges(runtime);
    const spawned = countPlants();
    engine.runInterval(runtime, "rule.lab_prune");
    const remaining = countPlants();
    add(
      "④ 개체 생성과 소멸",
      spawned === 1 && remaining === 0,
      `marked=true → 템플릿 개체 ${spawned}개 생성, destroy_entity 후 ${remaining}개`,
    );
  }

  // --- ⑤ 관계 변경 (+ relationship_changed 트리거) -----------------------------
  {
    const { runtime, engine } = lab();
    useLabAction({ runtime, engine });
    const relation = runtime.state.relationships[`${LAB_AGENTS[0]}|${LAB_PARTNER}`] as
      | Record<string, unknown>
      | undefined;
    const echo = num(runtime, LAB_AGENTS[0]!, "trust_echo");
    add(
      "⑤ 관계 변경",
      relation?.["trust"] === 5 && echo === 1,
      `trust 0→${String(relation?.["trust"])}, relationship_changed 트리거로 trust_echo=${echo}`,
    );
  }

  // --- ⑥ 신호 발생 -------------------------------------------------------------
  {
    const { runtime, engine } = lab();
    useLabAction({ runtime, engine });
    const signal = runtime.state.pendingSignals.find((s) => s.id.startsWith("signal.lab_ping"));
    add(
      "⑥ 신호 발생",
      signal !== undefined && signal.claim?.stateKey === "marked" && signal.strength === 80,
      `${signal?.id ?? "(없음)"} strength=${String(signal?.strength)} claim=${String(signal?.claim?.stateKey)}=${String(signal?.claim?.value)}`,
    );
  }

  // --- ⑦ 예약된 효과 -----------------------------------------------------------
  {
    const { runtime, engine } = lab();
    const systems = createWorldSystems(engine);
    const loop = new SimulationLoop(systems.hooks);
    systems.registerHandlers(loop);
    useLabAction({ runtime, engine });
    const immediate = num(runtime, LAB_AGENTS[0]!, "delayed_mark");
    loop.advance(runtime, 10);
    const delayed = num(runtime, LAB_AGENTS[0]!, "delayed_mark");
    add(
      "⑦ 예약된 효과",
      immediate === 0 && delayed === 7,
      `schedule_rule delay=5 → 즉시 ${immediate}, 10 tick 진행 후 ${delayed}`,
    );
  }

  // --- ⑧ 확률적 효과 -----------------------------------------------------------
  {
    const run = (seed: number): string[] => {
      const { runtime, engine } = lab(seed);
      const before = new Map(
        Object.values(runtime.state.entities)
          .filter((e) => e.type === "agent")
          .map((e) => [e.id, num(runtime, e.id, "stock")]),
      );
      engine.runInterval(runtime, "rule.lab_luck");
      return [...before.keys()].filter((id) => num(runtime, id, "stock") !== before.get(id)).sort();
    };
    const first = run(7);
    const same = run(7);
    const other = run(8);
    const total = Object.values(lab().runtime.state.entities).filter((e) => e.type === "agent").length;
    add(
      "⑧ 확률적 효과",
      first.length > 0 &&
        first.length < total &&
        first.join() === same.join() &&
        other.join() !== first.join(),
      `chance=0.5 → 시드7 에서 ${first.length}/${total} 적중(재실행 동일), 시드8 은 ${other.length}/${total} 로 다름`,
    );
  }

  // --- ⑨ 주변 개체 검색 --------------------------------------------------------
  {
    const { runtime, engine } = lab();
    engine.runInterval(runtime, "rule.lab_scan");
    const near = num(runtime, LAB_AGENTS[0]!, "nearby_count"); // x=0, 식물 x=10 → 반경 20 안
    const far = num(runtime, LAB_AGENTS[2]!, "nearby_count"); // x=60 → 반경 밖
    const outside = num(runtime, LAB_OUTSIDER, "nearby_count"); // 다른 지역
    add(
      "⑨ 주변 개체 검색",
      near === 1 && far === 0 && outside === 0,
      `반경 20 내 plant 개수 — a0(거리10)=${near}, a2(거리50)=${far}, 타지역=${outside}`,
    );
  }

  // --- ⑩ 태그 기반 대상 선택 ---------------------------------------------------
  {
    const { runtime, engine } = lab();
    const before = num(runtime, LAB_PLANT, "amount");
    const agentStockBefore = num(runtime, LAB_AGENTS[0]!, "stock");
    engine.runInterval(runtime, "rule.lab_harvest");
    const after = num(runtime, LAB_PLANT, "amount");
    add(
      "⑩ 태그 기반 대상 선택",
      after === before - 1 && num(runtime, LAB_AGENTS[0]!, "stock") === agentStockBefore,
      `tag=plant 만 적중 — plant.amount ${before}→${after}, 주체 상태 불변`,
    );
  }

  // --- Phase-2 방어선: 쿨다운(§11) --------------------------------------------
  {
    const { runtime, engine } = lab();
    engine.runInterval(runtime, "rule.lab_cooldown");
    engine.runInterval(runtime, "rule.lab_cooldown"); // 같은 시각 — 쿨다운에 막힌다
    const blocked = runtime.store.readGlobal("lab_price");
    runtime.state.simulationTime += 60;
    engine.runInterval(runtime, "rule.lab_cooldown");
    const afterCooldown = runtime.store.readGlobal("lab_price");
    add(
      "쿨다운 (§11 cooldown)",
      blocked === 1 && afterCooldown === 2,
      `cooldown=50 — 같은 시각 2회 호출 후 ${String(blocked)}, +60 tick 뒤 ${String(afterCooldown)}`,
    );
  }

  // --- Phase-2 방어선: entity_entered 트리거(§11.1) -----------------------------
  {
    const { runtime, engine } = lab();
    completeAction(runtime, engine, LAB_OUTSIDER, {
      actionId: "action.lab_use",
      targetIds: [LAB_PARTNER],
      startedAt: 0,
      completesAt: 1,
      eventId: "test.entered",
      goalId: "goal.test",
    });
    const mark = num(runtime, LAB_OUTSIDER, "entered_mark");
    add(
      "entity_entered 트리거 (§11.1)",
      mark === 1,
      `지역 이동 완료로 lab_zone 진입 → entered_mark=${mark}`,
    );
  }

  // --- Phase-2 방어선: 연쇄 상한(§34 무한 순환) ---------------------------------
  {
    const { runtime, engine } = lab();
    runtime.store.modify(LAB_AGENTS[0]!, "ping_a", "add", 1);
    const rounds = engine.drainStateChanges(runtime);
    const reported = engine.diagnostics.some((d) => d.includes("상한"));
    add(
      "규칙 연쇄 상한 감지 (§34)",
      reported && rounds === engine.maxCascadeDepth,
      `서로를 깨우는 규칙 2개 → ${rounds}회에서 중단, 진단 ${engine.diagnostics.length}건: ${engine.diagnostics[0] ?? "(없음)"}`,
    );
  }

  return checks;
}
