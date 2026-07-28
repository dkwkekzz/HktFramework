// 세계 생성 컴파일러 테스트 (Phase-5 DoD "mock 포트로 파이프라인 전체가 오프라인 테스트된다")
//
// AI 없이 도는 것이 요점이다 — 모든 케이스가 녹화 코퍼스와 목 포트만 쓴다.
import { describe, expect, it } from "vitest";
import { FIRST_WORLD_CORPUS, FIRST_WORLD_ID, FIRST_WORLD_SEED_INPUT } from "../content/first-world";
import { bootstrapWorld } from "../core/world/WorldBootstrap";
import { WorldRuntime } from "../core/world/WorldRuntime";
import { hashValue } from "../shared/hash";
import { compileWorld } from "./CompilerPipeline";
import { calculateAbilityOutputRange, calculateResourceRarity, placeInRegion } from "./derivations";
import { PROTOTYPE_SCALE } from "./GenerationTypes";
import { checkFirstWorldItems, checkScale, costsGrowWithOutput, summarizeAbilities } from "./phase5Checks";
import { RecordedTextGenerationPort } from "./RecordedTextGenerationPort";
import { SymbolTable } from "./SymbolTable";
import {
  checkInputContract,
  generateChecked,
  GenerationFailure,
  createTelemetry,
  type GenerationTask,
} from "./TextGenerationPort";

const options = {
  seedInput: FIRST_WORLD_SEED_INPUT,
  worldSeed: 42,
  worldId: FIRST_WORLD_ID,
};

describe("세계 생성 컴파일러", () => {
  it("§41 다섯 문장에서 §5 의 15단계를 오프라인으로 완주한다", async () => {
    const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS);
    const result = await compileWorld({ port, ...options });

    expect(result.steps.map((step) => step.index)).toEqual([...Array(15)].map((_, i) => i + 1));
    expect(result.steps.every((step) => step.status === "ok")).toBe(true);
    expect(result.issues).toEqual([]);
    // 분할 호출 — 규칙 묶음·종족·조직·능력·목적·인물이 항목 단위로 나뉘어 불린다(§5.2)
    expect(port.calls.length).toBeGreaterThan(50);
    expect(port.taskIds).toContain("species/species.echo_beast");
    expect(port.taskIds).toContain("agents/agent.rion");
  });

  it("§40 규모 표와 §41 의 10항목을 모두 채운다", async () => {
    const result = await compileWorld({ port: new RecordedTextGenerationPort(FIRST_WORLD_CORPUS), ...options });
    for (const row of checkScale(result.definition, PROTOTYPE_SCALE)) {
      expect(row.ok, `${row.item}: ${row.actual} (목표 ${row.target})`).toBe(true);
    }
    for (const item of checkFirstWorldItems(result.definition)) {
      expect(item.ok, `${item.item}: ${item.evidence}`).toBe(true);
    }
  });

  it("생성된 정의가 손대지 않고 런타임에 로드된다", async () => {
    const result = await compileWorld({ port: new RecordedTextGenerationPort(FIRST_WORLD_CORPUS), ...options });
    const runtime = new WorldRuntime(result.definition);
    expect(() => bootstrapWorld(runtime)).not.toThrow();
    expect(Object.keys(runtime.state.entities).length).toBe(result.definition.bootstrap.entities.length);
  });

  it("능력은 욕망에서 파생되고, 출력이 클수록 대가가 크다 (§16, §34)", async () => {
    const result = await compileWorld({ port: new RecordedTextGenerationPort(FIRST_WORLD_CORPUS), ...options });
    const rows = summarizeAbilities(result.definition.abilitySystem?.abilities ?? []);
    expect(rows).toHaveLength(PROTOTYPE_SCALE.abilityUsers);
    expect(rows.every((row) => row.restrictions > 0 && row.hasBacklash)).toBe(true);
    expect(rows.every((row) => row.derivedFrom.length > 0)).toBe(true);
    expect(costsGrowWithOutput(rows)).toBe(true);
  });

  it("아티팩트에서 재개하면 생성 호출 없이 같은 세계가 나온다", async () => {
    const first = await compileWorld({ port: new RecordedTextGenerationPort(FIRST_WORLD_CORPUS), ...options });
    // 녹화가 하나도 없는 포트 — 호출이 일어나면 즉시 실패한다
    const emptyPort = new RecordedTextGenerationPort({});
    const resumed = await compileWorld({ port: emptyPort, ...options, resumeFrom: first.artifacts });

    expect(emptyPort.calls).toHaveLength(0);
    expect(resumed.steps.every((step) => step.status === "reused")).toBe(true);
    expect(hashValue(resumed.definition)).toBe(hashValue(first.definition));
  });

  it("같은 시드면 같은 세계, 다른 시드면 배치가 달라진다 (§5.4)", async () => {
    const a = await compileWorld({ port: new RecordedTextGenerationPort(FIRST_WORLD_CORPUS), ...options });
    const b = await compileWorld({ port: new RecordedTextGenerationPort(FIRST_WORLD_CORPUS), ...options });
    const other = await compileWorld({
      port: new RecordedTextGenerationPort(FIRST_WORLD_CORPUS),
      ...options,
      worldSeed: 43,
    });

    expect(hashValue(a.definition)).toBe(hashValue(b.definition));
    expect(hashValue(other.definition)).not.toBe(hashValue(a.definition));
    // 달라지는 것은 코드가 뽑은 좌표뿐 — 정의의 나머지는 같다
    expect(hashValue(other.definition.ruleDefinitions)).toBe(hashValue(a.definition.ruleDefinitions));
    expect(hashValue(other.definition.bootstrap)).not.toBe(hashValue(a.definition.bootstrap));
  });

  it("스키마 검증에 실패하면 오류를 붙여 재생성한다 (§34)", async () => {
    // 첫 시도에만 필수 필드를 지운다 — 두 번째 시도는 정상 응답
    const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS, (taskId, attempt, response) => {
      if (taskId !== "axioms" || attempt > 1) return response;
      return (response as { id: string }[]).map(({ id }) => ({ id }));
    });
    const result = await compileWorld({ port, ...options });

    const retried = port.calls.filter((call) => call.taskId === "axioms");
    expect(retried).toHaveLength(2);
    expect(retried[1]!.hadPreviousErrors).toBe(true);
    expect(result.telemetry.attempts.filter((attempt) => !attempt.ok)).toHaveLength(1);
    expect(result.issues).toEqual([]);
  });

  it("세 번 시도해도 스키마를 못 맞추면 단계를 중단한다", async () => {
    const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS, (taskId, _attempt, response) =>
      taskId === "axioms" ? "명제를 만들었습니다" : response,
    );
    await expect(compileWorld({ port, ...options })).rejects.toThrow(/2단계 실패/);
    expect(port.calls.filter((call) => call.taskId === "axioms")).toHaveLength(3);
  });

  it("월드 상태 전체를 실으려 하면 호출 자체가 막힌다 (§33)", async () => {
    const task: GenerationTask = {
      taskId: "test",
      systemPrompt: "",
      input: { world: { entities: { "agent.kael": { states: {} } } } },
      outputSchema: { type: "array" },
    };
    expect(checkInputContract(task)).toHaveLength(1);
    await expect(
      generateChecked(new RecordedTextGenerationPort({ test: [] }), task, createTelemetry()),
    ).rejects.toBeInstanceOf(GenerationFailure);
  });

  it("모든 생성 호출의 입력이 구조화되어 있고 상한 안에 있다", async () => {
    const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS);
    const result = await compileWorld({ port, ...options });
    expect(result.telemetry.violations).toEqual([]);
    expect(port.maxInputBytes).toBeLessThan(4096);
    // 어떤 호출도 자유 텍스트 한 덩어리가 아니라 이름 붙은 필드를 받는다
    expect(port.calls.every((call) => call.inputKeys.length > 0)).toBe(true);
  });
});

describe("심볼 테이블", () => {
  it("선언되지 않은 id 참조를 잡아낸다", () => {
    const symbols = new SymbolTable();
    symbols.declare("rule", "rule.exists");
    symbols.collectReferences({ productionRules: ["rule.exists", "rule.missing"] }, "resources");
    const unresolved = symbols.unresolved();
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]!.id).toBe("rule.missing");
    expect(unresolved[0]!.kind).toBe("rule");
  });

  it("뒤 단계에서 선언되는 참조는 미해결로 남지 않는다", () => {
    const symbols = new SymbolTable();
    symbols.collectReferences({ goalId: "goal.survive" }, "pressures");
    expect(symbols.unresolved()).toHaveLength(1);
    symbols.declare("goal", "goal.survive");
    expect(symbols.unresolved()).toHaveLength(0);
  });
});

describe("코드가 계산하는 파생값 (§5.1 각주)", () => {
  it("§13 희귀도 공식을 그대로 쓴다", () => {
    expect(calculateResourceRarity(92, 14, 28)).toBeCloseTo(92 * 0.55 + 86 * 0.3 + 72 * 0.15, 6);
    // 위험할수록·닿기 어려울수록 희귀하다
    expect(calculateResourceRarity(90, 10, 20)).toBeGreaterThan(calculateResourceRarity(10, 90, 80));
  });

  it("§16 절차 7 — 제약이 셀수록 출력 상한이 커진다", () => {
    const weak = calculateAbilityOutputRange([30], [5], 40);
    const strong = calculateAbilityOutputRange([80], [16], 40);
    expect(strong.max).toBeGreaterThan(weak.max);
    expect(strong.min).toBeLessThan(strong.max);
  });

  it("좌표는 시드와 개체 id 로만 정해진다", () => {
    const bounds = { width: 100, height: 80, depth: 10 };
    const a = placeInRegion(42, "agent.kael", "region.village", bounds);
    const b = placeInRegion(42, "agent.kael", "region.village", bounds);
    const other = placeInRegion(43, "agent.kael", "region.village", bounds);
    expect(a).toEqual(b);
    expect(other).not.toEqual(a);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThanOrEqual(bounds.width);
  });
});
