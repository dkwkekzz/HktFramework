// GenerationViewModel — 세계 생성 화면(§36.1)이 참조할 수 있는 유일한 데이터 (분해 원칙 5)
//
// SceneViewModel 과 같은 규약이다: "표시 대상의 속성"만 담고, 의미 해석은 전부 빌더에서 끝낸다.
// 화면은 WorldDefinition·아티팩트 원본을 직접 읽지 않는다.
import type { CompileResult, StepReport } from "../generation/CompilerPipeline";
import type { WorldScale } from "../generation/GenerationTypes";
import { checkFirstWorldItems, checkScale } from "../generation/phase5Checks";

export interface GenerationStepView {
  index: number;
  /** 단계 id — §36.1 승격분(항목 재생성)이 이 키로 증분 재실행을 요청한다 (Phase-6 §6.3) */
  id: string;
  title: string;
  /** ok=생성됨, reused=아티팩트 재사용, failed=중단 */
  status: "ok" | "reused" | "failed";
  summary: string;
  callCount: number;
  error?: string;
  /** 단계 산출물 JSON (검토용, §36.1 "생성된 세계 구조 검토") */
  artifactJson: string;
}

export interface GenerationScaleView {
  item: string;
  target: string;
  actual: number;
  ok: boolean;
}

export interface GenerationViewModel {
  /** 아직 생성을 시작하지 않았는가 */
  idle: boolean;
  title: string;
  steps: GenerationStepView[];
  scale: GenerationScaleView[];
  /** §41 자동 생성 항목 점검 */
  expectations: { item: string; ok: boolean; evidence: string }[];
  issues: { level: string; message: string }[];
  /** 요약 배지 — 호출 수·최대 입력 등 */
  badges: { key: string; value: string }[];
  /** 생성된 세계 id — 시뮬레이션 화면으로 넘길 열쇠 */
  worldId?: string;
  /** 이 세계를 실행할 시드 (§5.4 — 정의에 고정되어 있다) */
  worldSeed: number;
}

export function createEmptyGenerationView(): GenerationViewModel {
  return { idle: true, title: "", steps: [], scale: [], expectations: [], issues: [], badges: [], worldSeed: 0 };
}

/** 아티팩트 JSON 은 화면에서 접기 위해 길이를 제한한다 — 원본은 저장소에 남는다 */
const ARTIFACT_PREVIEW_CHARS = 4000;

export function buildGenerationView(
  result: CompileResult,
  scale: WorldScale,
  extra: { callCount: number; maxInputBytes: number },
): GenerationViewModel {
  const definition = result.definition;
  const artifacts = new Map(result.artifacts.list().map((artifact) => [artifact.stepId, artifact]));
  const steps: GenerationStepView[] = result.steps.map((step: StepReport) => {
    const artifact = artifacts.get(step.id);
    const json = artifact === undefined ? "" : JSON.stringify(artifact.data, null, 2);
    return {
      index: step.index,
      id: step.id,
      title: step.title,
      status: step.status,
      summary: step.summary,
      callCount: step.taskIds.length,
      ...(step.error === undefined ? {} : { error: step.error }),
      artifactJson:
        json.length > ARTIFACT_PREVIEW_CHARS ? `${json.slice(0, ARTIFACT_PREVIEW_CHARS)}\n… (생략)` : json,
    };
  });

  return {
    idle: false,
    title: definition.metadata.title,
    steps,
    scale: checkScale(definition, scale),
    expectations: checkFirstWorldItems(definition),
    issues: result.issues.map((issue) => ({ level: issue.level, message: `${issue.targetId}: ${issue.message}` })),
    badges: [
      { key: "생성 호출", value: `${extra.callCount}회` },
      { key: "최대 입력", value: `${extra.maxInputBytes}B` },
      { key: "심볼", value: `${result.symbols.size}개` },
      { key: "규칙", value: `${definition.ruleDefinitions.length}개` },
      { key: "개체", value: `${definition.bootstrap.entities.length}개` },
    ],
    worldId: definition.metadata.id,
    worldSeed: definition.metadata.worldSeed,
  };
}
