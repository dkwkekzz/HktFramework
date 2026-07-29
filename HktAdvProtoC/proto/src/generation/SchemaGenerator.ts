// 4단계: 세계 상태 스키마 생성 (§9)
import { OBSERVATION_CHANNELS } from "../shared/observation";
import type { StateSchema, SurvivalPressureDefinition, WorldAxiom } from "../core/world/types";
import type { GenerationContext } from "./GenerationTypes";
import { STATE_SCHEMA_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const SCHEMA_TASK = "state_schemas";

const SYSTEM_PROMPT = [
  "너는 세계 생성 컴파일러의 4단계다. 세계 상태를 임의의 문자열로 두지 않고 스키마로 못 박는다(§9).",
  "각 상태는 소유자(ownerType)·자료형·기본값·범위·관찰 가능성·갱신 정책을 갖는다.",
  "관찰 가능한 상태만 observable=true 로 두고, 어떤 감각 채널로 보이는지 반드시 밝힌다 —",
  "관찰 불가 상태는 어떤 신호로도 새어 나가지 않는다(§10 실제 상태와 믿음의 분리).",
  "앞 단계의 압력이 읽는 상태 키는 하나도 빠짐없이 만들어야 한다.",
].join("\n");

/** 조건식이 읽는 상태 키를 모은다 — 스키마 누락을 기계로 잡기 위한 것 */
export function collectStateKeys(value: unknown, into: Set<string> = new Set()): Set<string> {
  const walk = (node: unknown, depth: number): void => {
    if (depth > 24 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, depth + 1));
      return;
    }
    const record = node as Record<string, unknown>;
    for (const field of ["key", "stateKey", "observerStateKey"]) {
      const found = record[field];
      if (typeof found === "string" && found.length > 0) into.add(found);
    }
    for (const child of Object.values(record)) walk(child, depth + 1);
  };
  walk(value, 0);
  return into;
}

export async function generateStateSchemas(
  ctx: GenerationContext,
  axioms: readonly WorldAxiom[],
  pressures: readonly SurvivalPressureDefinition[],
): Promise<StateSchema[]> {
  const requiredKeys = [...collectStateKeys(pressures)].sort();
  const schemas = await generateChecked<StateSchema[]>(
    ctx.port,
    {
      taskId: SCHEMA_TASK,
      systemPrompt: SYSTEM_PROMPT,
      input: {
        axioms: axioms.map((axiom) => ({ id: axiom.id, category: axiom.category, statement: axiom.statement })),
        // 압력이 이미 읽고 있는 상태 키 — 이건 반드시 스키마가 있어야 한다
        requiredStateKeys: requiredKeys,
        observationChannels: OBSERVATION_CHANNELS,
      },
      outputSchema: STATE_SCHEMA_SCHEMA,
    },
    ctx.telemetry,
  );

  const declared = new Set(schemas.map((schema) => schema.id));
  const missing = requiredKeys.filter((key) => !declared.has(key));
  if (missing.length > 0) {
    throw new Error(`압력이 읽는 상태의 스키마가 없다 — ${missing.join(", ")} (§9)`);
  }
  for (const schema of schemas) {
    if (schema.observable && (schema.observationChannels ?? []).length === 0) {
      throw new Error(`관찰 가능한데 채널이 없다 — ${schema.id} (§9 observationChannels)`);
    }
  }
  ctx.symbols.declareAll("state", [...declared]);
  return schemas;
}
