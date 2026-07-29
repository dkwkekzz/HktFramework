// §14 여섯 번째 질문 "과도하게 사용하면 무엇이 발생하는가"의 실측 (G-6)
//
// 선언(overuseRules)이 아니라 **차이**로 증명한다 — 같은 행동이라도 과잉 상태에서만 반동이 온다.
// verify.ts 와 테스트가 같은 함수를 쓴다 (phase3Checks 와 같은 규약).
import { buildManualWorld } from "../../content/manual-world";
import { RuleEngine } from "../rules/RuleEngine";
import { bootstrapWorld } from "./WorldBootstrap";
import { WorldRuntime } from "./WorldRuntime";

export interface OveruseRow {
  resourceId: string;
  ruleId: string;
  ok: boolean;
  evidence: string;
}

function fresh(seed: number): { runtime: WorldRuntime; engine: RuleEngine } {
  const runtime = new WorldRuntime(buildManualWorld(seed));
  bootstrapWorld(runtime);
  return { runtime, engine: new RuleEngine(runtime.definition.ruleDefinitions) };
}

/** 자원 3종의 과용 반동을 과잉/정상 대조로 실측한다 */
export function measureResourceOveruse(seed = 42): OveruseRow[] {
  const rows: OveruseRow[] = [];

  // ① 식량 — 허기가 없는데 또 먹으면 몸이 상한다. 배고픈 식사는 무해하다.
  {
    const { runtime, engine } = fresh(seed);
    runtime.store.modify("agent.kael", "hunger", "set", 0);
    runtime.store.modify("agent.mar", "hunger", "set", 60);
    const kaelBefore = runtime.store.readNumber("agent.kael", "health");
    const marBefore = runtime.store.readNumber("agent.mar", "health");
    engine.dispatchAction(runtime, "action.eat", "agent.kael", []);
    engine.dispatchAction(runtime, "action.eat", "agent.mar", []);
    const kaelLoss = kaelBefore - runtime.store.readNumber("agent.kael", "health");
    const marLoss = marBefore - runtime.store.readNumber("agent.mar", "health");
    rows.push({
      resourceId: "resource.food",
      ruleId: "rule.overeating_strain",
      ok: kaelLoss > 0 && marLoss === 0,
      evidence: `허기 0에서 먹은 kael 체력 −${kaelLoss} / 허기 60에서 먹은 mar 체력 −${marLoss}`,
    });
  }

  // ② 능력 잔재 — 몸에 쌓아 두면(임계 초과) 태운다. 임계 이하 보유는 무해하다.
  {
    const { runtime, engine } = fresh(seed);
    runtime.store.modify("agent.kael", "carried_residue", "set", 6);
    runtime.store.modify("agent.mar", "carried_residue", "set", 2);
    const kaelBefore = runtime.store.readNumber("agent.kael", "health");
    const marBefore = runtime.store.readNumber("agent.mar", "health");
    engine.runInterval(runtime, "rule.residue_overload");
    const kaelLoss = kaelBefore - runtime.store.readNumber("agent.kael", "health");
    const marLoss = marBefore - runtime.store.readNumber("agent.mar", "health");
    const burned = 6 - runtime.store.readNumber("agent.kael", "carried_residue");
    rows.push({
      resourceId: "resource.ability_residue",
      ruleId: "rule.residue_overload",
      ok: kaelLoss > 0 && burned > 0 && marLoss === 0,
      evidence: `잔재 6 보유 kael 체력 −${kaelLoss}·잔재 ${burned} 소실 / 잔재 2 보유 mar 체력 −${marLoss}`,
    });
  }

  // ③ 교역품 — 시장에 과하게 풀면 가격이 무너진다. 적정량 거래는 가격 규칙만 따른다.
  {
    const glut = fresh(seed);
    glut.runtime.store.modify("agent.ren", "carried_goods", "set", 90);
    glut.engine.dispatchAction(glut.runtime, "action.trade", "agent.ren", ["faction.silent_village"]);
    const glutPrice = Number(glut.runtime.store.readGlobal("food_price"));

    const normal = fresh(seed);
    normal.runtime.store.modify("agent.ren", "carried_goods", "set", 10);
    normal.engine.dispatchAction(normal.runtime, "action.trade", "agent.ren", ["faction.silent_village"]);
    const normalPrice = Number(normal.runtime.store.readGlobal("food_price"));

    rows.push({
      resourceId: "resource.trade_goods",
      ruleId: "rule.market_glut",
      ok: glutPrice < normalPrice,
      evidence: `같은 거래를 교역품 90 보유로 하면 가격 ${glutPrice} / 10 보유로 하면 ${normalPrice}`,
    });
  }

  return rows;
}
