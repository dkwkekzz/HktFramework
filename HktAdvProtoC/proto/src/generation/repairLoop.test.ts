// 수정 루프 테스트 (Phase-6 DoD 3 — "§41 생성 세계가 수정 루프를 거쳐 합격하거나 Issue 목록을 남긴다")
import { describe, expect, it } from "vitest";
import { FIRST_WORLD_CORPUS, FIRST_WORLD_ID, FIRST_WORLD_REPAIRS, FIRST_WORLD_SEED_INPUT } from "../content/first-world";
import { ArtifactStore } from "./ArtifactStore";
import { RecordedTextGenerationPort } from "./RecordedTextGenerationPort";
import { compileWithRepair, ISSUE_TO_STEPS, stepsForIssues } from "./RepairLoop";

const options = { seedInput: FIRST_WORLD_SEED_INPUT, worldSeed: 42, worldId: FIRST_WORLD_ID };

describe("수정 루프", () => {
  it("이슈 코드마다 다시 돌릴 생성 단계가 정해져 있다 (§42-6 매핑)", () => {
    expect(ISSUE_TO_STEPS["agent.goal"]).toEqual([10]);
    expect(ISSUE_TO_STEPS["sim.resource-explosion"]).toEqual([6, 5]);
    // 여러 이슈가 걸리면 가장 앞 단계부터 다시 돈다 — 뒤 단계는 앞 단계 위에서만 성립하기 때문이다
    expect(
      stepsForIssues([
        { level: "error", code: "sim.all-agents-act", targetId: "x", message: "" },
        { level: "error", code: "sim.resource-explosion", targetId: "y", message: "" },
      ]),
    ).toEqual([5, 6, 10, 11]);
  });

  it("아티팩트를 원인 단계 앞까지만 남긴다 (증분 재실행의 근거)", () => {
    const store = new ArtifactStore();
    for (let index = 1; index <= 5; index++) {
      store.save({ stepId: `step${index}`, stepIndex: index, title: `${index}단계`, data: index, taskIds: [] });
    }
    const truncated = store.before(3);
    expect(truncated.list().map((artifact) => artifact.stepIndex)).toEqual([1, 2]);
    // 원본은 그대로다
    expect(store.list()).toHaveLength(5);
  });

  it("§41 생성 세계가 검증 → 수정 → 시뮬레이션을 거쳐 합격한다", async () => {
    const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS, undefined, FIRST_WORLD_REPAIRS);
    const result = await compileWithRepair({ port, ...options });

    expect(result.accepted).toBe(true);
    expect(result.remainingIssues).toEqual([]);
    expect(result.rounds.length).toBeLessThanOrEqual(3);

    // ① 1라운드: 정적 검증이 막는다 — 시뮬레이션까지 가지 않는다
    const first = result.rounds[0]!;
    expect(first.simulation).toBeUndefined();
    expect(first.issues.map((issue) => issue.code).sort()).toEqual(["agent.goal", "state.schema"]);
    expect(first.restartFrom).toBe(4);
    expect(first.applied.map((entry) => entry.taskId).sort()).toEqual(["goals/goal_graph.healer", "rules/wilds"]);

    // ② 2라운드: 정적은 통과하고 §35 판정이 막는다
    const second = result.rounds[1]!;
    expect(second.validation.ok).toBe(true);
    expect(second.simulation?.ok).toBe(false);
    expect(second.issues.map((issue) => issue.code).sort()).toEqual(["sim.all-agents-act", "sim.resource-explosion"]);
    expect(second.restartFrom).toBe(5);

    // ③ 3라운드: 둘 다 통과
    const last = result.rounds[result.rounds.length - 1]!;
    expect(last.accepted).toBe(true);
    expect(last.validation.ok).toBe(true);
    expect(last.simulation?.ok).toBe(true);
    expect(last.simulation?.deadlockedAgents).toEqual([]);
    expect(result.finalSimulation?.ok).toBe(true);
  }, 180_000);

  it("고칠 응답이 없으면 상한에서 멈추고 읽을 수 있는 Issue 목록을 남긴다", async () => {
    // 수정 녹화를 주지 않은 포트 — 같은 세계가 계속 나오므로 루프는 상한에서 끝난다
    const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS);
    const result = await compileWithRepair({ port, ...options, maxRounds: 2 });

    expect(result.accepted).toBe(false);
    expect(result.rounds).toHaveLength(2);
    expect(result.remainingIssues.length).toBeGreaterThan(0);
    for (const issue of result.remainingIssues) {
      expect(issue.message.length).toBeGreaterThan(10);
      expect(issue.targetId.length).toBeGreaterThan(0);
    }
  }, 180_000);
});
