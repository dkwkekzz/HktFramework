// 3단계: 생존 압력 생성 (§8)
import type { SurvivalPressureDefinition, WorldAxiom } from "../core/world/types";
import type { GenerationContext } from "./GenerationTypes";
import { PRESSURE_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const PRESSURE_TASK = "pressures";

/** §8 이 열거한 기본 압력 10종 — 프롬프트가 이 목록에서 고르게 한다 */
export const BASE_PRESSURES = [
  "신체 유지",
  "에너지 확보",
  "안전 확보",
  "영역 확보",
  "번식",
  "집단 유지",
  "정체성 유지",
  "신념 유지",
  "정보 확보",
  "미래 위험 대비",
] as const;

const SYSTEM_PROMPT = [
  "너는 세계 생성 컴파일러의 3단계다. '왜 움직여야 하는가'를 만든다(§8).",
  "아래 기본 압력 목록에서 고르되, 모든 종에게 같은 압력을 주지 않는다 — applicableSpeciesTags 로 갈라 준다.",
  "각 압력은 해소 조건(relievedWhen)과 누적 상한(maxUrgency)을 반드시 갖는다.",
  "goalId 는 이 압력이 밀어 올릴 목적이다. 뒤 단계의 목적 그래프가 이 id 를 실제로 만들어야 한다.",
].join("\n");

export async function generatePressures(
  ctx: GenerationContext,
  axioms: readonly WorldAxiom[],
): Promise<SurvivalPressureDefinition[]> {
  const pressures = await generateChecked<SurvivalPressureDefinition[]>(
    ctx.port,
    {
      taskId: PRESSURE_TASK,
      systemPrompt: SYSTEM_PROMPT,
      input: {
        axioms: axioms.map((axiom) => ({ id: axiom.id, statement: axiom.statement, category: axiom.category })),
        basePressures: BASE_PRESSURES,
        speciesCountTarget: ctx.scale.species,
        factionCountTarget: ctx.scale.factions,
      },
      outputSchema: PRESSURE_SCHEMA,
    },
    ctx.telemetry,
  );

  for (const pressure of pressures) {
    if (pressure.relievedWhen.length === 0) {
      throw new Error(`해소 조건 없는 압력 — ${pressure.id} (§8: 해소되지 않으면 영원히 쌓인다)`);
    }
    if (pressure.applicableSpeciesTags.length === 0) {
      throw new Error(`적용 대상 없는 압력 — ${pressure.id}`);
    }
  }
  ctx.symbols.declareAll(
    "pressure",
    pressures.map((pressure) => pressure.id),
  );
  // 압력이 가리키는 목적은 10단계에서 만들어진다 — 미해결 참조로 쌓아 두고 끝에서 판정한다
  ctx.symbols.collectReferences(
    pressures.map((pressure) => pressure.goalId),
    "pressures.goalId",
  );
  return pressures;
}
