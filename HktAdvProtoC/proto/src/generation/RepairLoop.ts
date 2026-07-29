// 수정 루프 (기획서 §42-6 "모순과 누락을 검사하고 생성 결과를 다시 수정한다" / Phase-6 §6.3)
//
//   WorldDefinition → 정적 검증 ─error→ 해당 생성 단계만 재실행(Issue 를 프롬프트에 첨부)
//           ↓ pass
//      시뮬레이션 테스트 ─fail→ 원인 단계 매핑 후 재생성
//           ↓ pass
//         공개 가능
//
// 재생성은 전체 재컴파일이 아니라 **원인 단계 앞까지의 아티팩트를 재사용**한 증분 재실행이다.
// 루프 상한을 넘으면 고치지 못한 Issue 목록을 그대로 남기고 사람 검토로 넘긴다.
import type { WorldDefinition } from "../core/world/types";
import { compileWorld, type CompileOptions, type CompileResult, type ValidationIssue } from "./CompilerPipeline";
import type { RepairRecording } from "./RecordedTextGenerationPort";
import { runSimulationTest, type SimulationTestResult } from "./SimulationTester";
import { validateWorld, type ValidationReport } from "./WorldValidator";

/** 이슈 코드 → 다시 돌릴 생성 단계 (§5 의 1~15). 여러 단계가 걸리면 가장 앞 단계부터 다시 돈다 */
export const ISSUE_TO_STEPS: Record<string, number[]> = {
  // --- §34 정적 검증 -----------------------------------------------------------------
  "schema.rule": [5],
  "schema.rule-engine": [5],
  "schema.world": [5],
  "state.schema": [4],
  "rule.target-exists": [5],
  "resource.source": [6],
  "species.need": [7],
  "faction.lifecycle": [8],
  "faction.hidden": [8],
  "agent.goal": [10],
  "action.cost": [11],
  "ability.cost-scaling": [9],
  "event.multi-agent": [12],
  "goal.no-infinite": [10],
  unknown_reference: [5],
  world_validation: [5],
  definition_not_loadable: [13],
  // --- §35 시뮬레이션 판정 (Phase-6 §6.3 매핑 표) ---------------------------------------
  "sim.run": [13],
  "sim.all-agents-act": [10, 11],
  "sim.dominant-action": [5, 11],
  "sim.resource-collapse": [6, 5],
  "sim.resource-explosion": [6, 5],
  "sim.faction-collapse": [8],
  "sim.event-variety": [12],
  "sim.no-stagnation": [5, 11],
};

export interface RepairRound {
  round: number;
  /** 이 라운드가 판정한 세계 */
  validation: ValidationReport;
  /** 정적 검증을 통과했을 때만 돈다 */
  simulation?: SimulationTestResult;
  /** 이 라운드에서 잡힌 오류 */
  issues: ValidationIssue[];
  /** 이슈가 가리키는 생성 단계 */
  targetSteps: number[];
  /** 실제로 다시 돌린 첫 단계 (없으면 재생성하지 않았다) */
  restartFrom?: number;
  /** 포트가 실제로 내놓은 수정 (오프라인 녹화에서는 이 목록이 비면 같은 세계가 다시 나온다) */
  applied: { taskId: string; note: string }[];
  accepted: boolean;
}

export interface RepairResult {
  definition: WorldDefinition;
  compile: CompileResult;
  rounds: RepairRound[];
  accepted: boolean;
  /** 마지막까지 남은 오류 — 상한 초과 시 사람이 읽을 목록이다 */
  remainingIssues: ValidationIssue[];
  finalValidation: ValidationReport;
  finalSimulation?: SimulationTestResult;
}

export interface RepairOptions extends CompileOptions {
  /** §35 는 30일 */
  days?: number;
  /** 루프 상한 (Phase-6 §6.3 — 3회) */
  maxRounds?: number;
}

/** 포트가 수정 라운드를 받아들일 수 있는가 (오프라인 녹화 포트가 구현한다) */
interface RepairablePort {
  applyRepair(round: number, issueCodes: readonly string[]): RepairRecording[];
}

function isRepairable(port: unknown): port is RepairablePort {
  return typeof (port as RepairablePort).applyRepair === "function";
}

/** 이슈 목록 → 다시 돌릴 단계 목록 (오름차순, 중복 제거) */
export function stepsForIssues(issues: readonly ValidationIssue[]): number[] {
  const steps = new Set<number>();
  for (const entry of issues) {
    for (const step of ISSUE_TO_STEPS[entry.code] ?? []) steps.add(step);
  }
  return [...steps].sort((a, b) => a - b);
}

/**
 * 생성 → 검증 → 수정 → 합격 (§42-6).
 * 상한 안에서 합격하지 못하면 accepted=false 와 남은 Issue 목록을 돌려준다 — 숨기지 않는다.
 */
export async function compileWithRepair(options: RepairOptions): Promise<RepairResult> {
  const maxRounds = options.maxRounds ?? 3;
  const days = options.days ?? 30;
  const rounds: RepairRound[] = [];

  let compiled = await compileWorld(options);
  let validation = validateWorld(compiled.definition);
  let simulation: SimulationTestResult | undefined;

  for (let round = 1; ; round++) {
    // ① 정적 검증 — 오류가 있으면 시뮬레이션까지 가지 않는다(§34 게이트)
    const staticIssues = [
      ...compiled.issues.filter((entry) => entry.level === "error"),
      ...validation.issues.filter((entry) => entry.level === "error"),
    ];
    simulation = undefined;
    let issues = staticIssues;

    // ② 정적 통과 → 자동 시뮬레이션 (§35)
    if (staticIssues.length === 0) {
      simulation = await runSimulationTest({ definition: compiled.definition, worldSeed: options.worldSeed, days });
      issues = simulation.warnings.filter((entry) => entry.level === "error");
    }

    if (issues.length === 0) {
      rounds.push({
        round,
        validation,
        ...(simulation === undefined ? {} : { simulation }),
        issues: [],
        targetSteps: [],
        applied: [],
        accepted: true,
      });
      return {
        definition: compiled.definition,
        compile: compiled,
        rounds,
        accepted: true,
        remainingIssues: [],
        finalValidation: validation,
        ...(simulation === undefined ? {} : { finalSimulation: simulation }),
      };
    }

    const targetSteps = stepsForIssues(issues);
    const restartFrom = targetSteps[0];
    const codes = [...new Set(issues.map((entry) => entry.code))];

    // ③ 상한 초과 — 사람 검토로 넘긴다
    if (round >= maxRounds || restartFrom === undefined) {
      rounds.push({
        round,
        validation,
        ...(simulation === undefined ? {} : { simulation }),
        issues,
        targetSteps,
        applied: [],
        accepted: false,
      });
      return {
        definition: compiled.definition,
        compile: compiled,
        rounds,
        accepted: false,
        remainingIssues: issues,
        finalValidation: validation,
        ...(simulation === undefined ? {} : { finalSimulation: simulation }),
      };
    }

    // ④ 원인 단계 재생성 — 앞 단계 아티팩트는 그대로 재사용한다
    const applied = isRepairable(options.port) ? options.port.applyRepair(round, codes) : [];
    rounds.push({
      round,
      validation,
      ...(simulation === undefined ? {} : { simulation }),
      issues,
      targetSteps,
      restartFrom,
      applied: applied.map((entry) => ({ taskId: entry.taskId, note: entry.note })),
      accepted: false,
    });

    compiled = await compileWorld({ ...options, resumeFrom: compiled.artifacts.before(restartFrom) });
    validation = validateWorld(compiled.definition);
  }
}
