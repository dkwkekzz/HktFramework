// 인식과 믿음 (§10, §23) — 실제 상태와 믿음이 갈라지는 지점을 좁게 검증한다.
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { emitObservationEffect } from "../world/Signals";
import { WorldRuntime } from "../world/WorldRuntime";
import type { ObservationEffect } from "../world/types";
import { findBelief } from "./BeliefStore";
import { processObservationSignals } from "./PerceptionSystem";

const BEAST = "creature.echo_beast_mother";
const RESEARCHER = "agent.rion";

function newRuntime(): WorldRuntime {
  const runtime = new WorldRuntime(buildManualWorld(1));
  bootstrapWorld(runtime);
  return runtime;
}

/** 관찰자를 신호원 옆에 세운다 — 거리 판정을 통과시키기 위한 준비 */
function placeBeside(runtime: WorldRuntime, moverId: string, anchorId: string, offset = 0): void {
  const anchor = runtime.store.entity(anchorId).position!;
  runtime.store.moveEntity(moverId, { ...anchor, x: anchor.x + offset });
}

const traceEffect: ObservationEffect = {
  signalId: "signal.residue_trace",
  channels: ["energy_sense", "trace"],
  strength: 70,
  tags: ["creature_trace"],
  claim: { subject: "actor", stateKey: "protecting_offspring", value: true, confidence: 0.64 },
};

describe("인식 시스템 (§23)", () => {
  it("가까이 있으면 신호를 관찰하고 믿음이 생긴다", () => {
    const runtime = newRuntime();
    placeBeside(runtime, RESEARCHER, BEAST, 3);
    emitObservationEffect(runtime, traceEffect, { actorId: BEAST });
    const outcomes = processObservationSignals(runtime);

    expect(outcomes.map((o) => o.observerId)).toContain(RESEARCHER);
    const belief = findBelief(runtime.agentRuntime(RESEARCHER), BEAST, "protecting_offspring");
    expect(belief?.believedValue).toBe(true);
    // Phase 3: 확신은 신호가 주장한 값 그대로가 아니라
    // (채널 정확도 × 신호 세기 × 주장 확신) + 기존 확신의 병합이다 (§23)
    expect(belief?.confidence).toBeGreaterThan(0);
    expect(belief?.confidence).toBeLessThan(0.64);
  });

  it("멀리 있으면 같은 신호를 관찰하지 못한다 (3D 거리 감쇠)", () => {
    const runtime = newRuntime();
    placeBeside(runtime, RESEARCHER, BEAST, 60);
    emitObservationEffect(runtime, traceEffect, { actorId: BEAST });
    expect(processObservationSignals(runtime)).toEqual([]);
    expect(findBelief(runtime.agentRuntime(RESEARCHER), BEAST, "protecting_offspring")).toBeUndefined();
  });

  it("맞는 감각이 없으면 관찰하지 못한다 (채널 일치)", () => {
    const runtime = newRuntime();
    placeBeside(runtime, RESEARCHER, BEAST, 3);
    emitObservationEffect(
      runtime,
      { ...traceEffect, channels: ["vibration"] }, // 인간에게 없는 감각
      { actorId: BEAST },
    );
    expect(processObservationSignals(runtime)).toEqual([]);
  });

  it("지역이 다르면 관찰하지 못한다", () => {
    const runtime = newRuntime();
    emitObservationEffect(runtime, traceEffect, { actorId: BEAST }); // 관찰자들은 마을에 있다
    expect(processObservationSignals(runtime)).toEqual([]);
  });

  it("자기가 낸 신호는 자신이 관찰하지 않는다", () => {
    const runtime = newRuntime();
    emitObservationEffect(runtime, traceEffect, { actorId: BEAST });
    expect(processObservationSignals(runtime).map((o) => o.observerId)).not.toContain(BEAST);
  });

  it("신호의 주장은 실제 상태와 다를 수 있다 — 믿음은 신호를 따른다 (§10)", () => {
    const runtime = newRuntime();
    placeBeside(runtime, "agent.kael", BEAST, 3);
    const attack = runtime.index.actions.get("action.attack")!;
    emitObservationEffect(runtime, attack.visibleSignals[0]!, { actorId: BEAST });
    processObservationSignals(runtime);

    // 실제 공격성은 12 인데, 신호는 90 이라고 주장한다
    expect(runtime.store.readNumber(BEAST, "aggression")).toBe(12);
    expect(findBelief(runtime.agentRuntime("agent.kael"), BEAST, "aggression")?.believedValue).toBe(90);
    // 관찰은 관찰자 자신의 상태로도 이어진다 — 여기서부터 규칙(state_changed)이 받는다
    expect(runtime.store.readNumber("agent.kael", "known_threat_level")).toBe(90);
  });

  it("강한 신호는 재판단 플래그를 세운다 (§26 important_observation)", () => {
    const runtime = newRuntime();
    placeBeside(runtime, RESEARCHER, BEAST, 3);
    emitObservationEffect(runtime, traceEffect, { actorId: BEAST });
    processObservationSignals(runtime);
    expect(runtime.agentRuntime(RESEARCHER).flags).toContain("important_observation");
  });

  it("믿음은 덮어써지고 근거가 누적된다 (Phase 1 간이 갱신)", () => {
    const runtime = newRuntime();
    placeBeside(runtime, "agent.kael", BEAST, 3);
    const attack = runtime.index.actions.get("action.attack")!;
    emitObservationEffect(runtime, attack.visibleSignals[0]!, { actorId: BEAST });
    processObservationSignals(runtime);

    const belief = findBelief(runtime.agentRuntime("agent.kael"), BEAST, "aggression")!;
    // 초기 소문(rumor.caravan_attack)에 목격 근거가 더해진다
    expect(belief.sourceIds[0]).toBe("rumor.caravan_attack");
    expect(belief.sourceIds.length).toBe(2);
  });
});
