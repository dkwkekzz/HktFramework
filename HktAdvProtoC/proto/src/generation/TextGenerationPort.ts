// 생성 AI 어댑터 경계 (기획서 §2.1 · §33 / Phase-5 "공통 기반")
//
// 코어(core/)와 시뮬레이션은 이 파일을 **전혀 모른다**. 생성기는 이 포트 뒤에서만 LLM 을 만나고,
// 실행 가능한 데이터(WorldDefinition)만 밖으로 내보낸다. 그래서 AI 없이도 세계는 항상 실행된다.
//
// 두 가지 계약을 강제한다.
//  ① 출력 계약  — 모든 호출은 JSON Schema 를 들고 간다. 검증 실패 시 오류 목록을 붙여 최대 2회 재생성(§34).
//  ② 입력 계약  — "월드 상태 전체를 전달하지 않는다"(§33). 구조화 입력만, 크기 상한 안에서.
import { validateAgainstSchema } from "../core/rules/RuleSchema";

export type JsonSchema = Record<string, unknown>;

/** 생성 호출의 구조화 입력 — 자유 텍스트 덩어리가 아니라 이름 붙은 필드의 모음이다 */
export type StructuredInput = Record<string, unknown>;

export interface GenerationTask {
  /** 단계 id (+ 분할 호출의 항목 키). 녹화 코퍼스의 키이자 아티팩트 이름이다 */
  taskId: string;
  systemPrompt: string;
  input: StructuredInput;
  outputSchema: JsonSchema;
  /** 직전 시도의 스키마 검증 오류 — 재생성 호출에만 실린다 */
  previousErrors?: string[];
}

export interface TextGenerationPort {
  generate(task: GenerationTask): Promise<unknown>;
}

// --- 입력 계약 (§33) ----------------------------------------------------------

/** 한 호출이 실어 나를 수 있는 입력 상한. 월드 상태 전체(개체 수백 개)는 이 안에 절대 들어오지 않는다 */
export const MAX_INPUT_BYTES = 12288;

/**
 * 월드 상태를 통째로 넘기려는 시도를 기계적으로 막는다.
 * 여기 있는 키는 런타임 상태의 서명이다 — 생성 입력에 나타나면 즉시 오류.
 */
const FORBIDDEN_INPUT_KEYS = [
  "entities",
  "simulationTime",
  "agentRuntimes",
  "worldState",
  "state",
  "changeLog",
  "beliefs",
  "relationships",
  "snapshot",
];

export interface InputContractViolation {
  taskId: string;
  reason: string;
}

/** 구조화 입력 계약 검사 — 위반 목록을 돌려준다(비어 있으면 통과) */
export function checkInputContract(task: GenerationTask): InputContractViolation[] {
  const violations: InputContractViolation[] = [];
  const json = JSON.stringify(task.input ?? {});
  const bytes = json.length;
  if (bytes > MAX_INPUT_BYTES) {
    violations.push({
      taskId: task.taskId,
      reason: `입력이 상한을 넘었다 — ${bytes}B > ${MAX_INPUT_BYTES}B (§33 구조화 정보만 전달)`,
    });
  }
  const walk = (value: unknown, path: string, depth: number): void => {
    if (depth > 8 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_INPUT_KEYS.includes(key)) {
        violations.push({
          taskId: task.taskId,
          reason: `월드 런타임 상태를 전달하려 한다 — ${path}.${key} (§33)`,
        });
      }
      walk(child, `${path}.${key}`, depth + 1);
    }
  };
  walk(task.input, "input", 0);
  return violations;
}

// --- 출력 계약 (§34) ----------------------------------------------------------

export class GenerationFailure extends Error {
  constructor(
    readonly taskId: string,
    readonly errors: string[],
    readonly attempts: number,
  ) {
    super(`생성 단계 중단 — ${taskId} (${attempts}회 시도)\n${errors.join("\n")}`);
    this.name = "GenerationFailure";
  }
}

export interface GenerationAttempt {
  taskId: string;
  attempt: number;
  ok: boolean;
  errors: string[];
  inputBytes: number;
}

export interface GenerationTelemetry {
  attempts: GenerationAttempt[];
  violations: InputContractViolation[];
}

export function createTelemetry(): GenerationTelemetry {
  return { attempts: [], violations: [] };
}

/**
 * 스키마 검증 래퍼 — 생성기는 항상 이 함수로만 포트를 부른다.
 * 실패하면 오류 목록을 붙여 재생성(총 3회 시도 = 최초 + 2회), 그래도 실패면 단계 중단(§5.2).
 */
export async function generateChecked<T>(
  port: TextGenerationPort,
  task: GenerationTask,
  telemetry: GenerationTelemetry = createTelemetry(),
  maxRetries = 2,
): Promise<T> {
  const violations = checkInputContract(task);
  telemetry.violations.push(...violations);
  if (violations.length > 0) {
    throw new GenerationFailure(task.taskId, violations.map((v) => v.reason), 0);
  }

  let errors: string[] = [];
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const request: GenerationTask =
      attempt === 1 ? task : { ...task, previousErrors: errors };
    const raw = await port.generate(request);
    errors = validateAgainstSchema(raw, task.outputSchema, task.outputSchema, task.taskId);
    telemetry.attempts.push({
      taskId: task.taskId,
      attempt,
      ok: errors.length === 0,
      errors: [...errors],
      inputBytes: JSON.stringify(task.input).length,
    });
    if (errors.length === 0) return raw as T;
  }
  throw new GenerationFailure(task.taskId, errors, maxRetries + 1);
}
