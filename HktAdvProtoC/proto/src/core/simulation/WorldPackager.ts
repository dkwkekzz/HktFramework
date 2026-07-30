// 세계 패키저 (Phase-9 §9.1) — §3 아키텍처 모듈 1~6 을 **정적 파이프라인**으로 돌려 데이터로 굽는다.
//
// 기획서 §3 의 일곱 모듈에서 1~6 은 제작(정적) 국면이다. 각 모듈은 자기 처리의
// 입력→출력을 줄 단위 기록(details)으로 남긴다 — "무엇이 가공되었는가"가 화면에서 펼쳐진다.
//   1. World Seed Editor  → 입력 원문 (metadata.seedInput 의 문장들)
//   2. World Compiler     → §5 컴파일 단계 기록 (생성 세계) / 컴파일 우회 명시 (수동 정의 세계)
//   3. World Validator    → §34 정적 검증 — 스키마 층 + 의미 검사기 19종의 **개별 판정**
//   4. World Bootstrapper → 배치 실행 → **부트스트랩 스냅샷** (플레이가 그대로 불러올 데이터)
//   5. Simulation Runtime → 사전 실행(§35 축소판) — 일자별 change·사건 관측
//   6. Event Interpreter  → 사전 실행이 남긴 사건을 **실제 해석기(§33.3)** 로 문장화한 표본
// 각 단계는 처리 보고(ok + 수치 근거 + 상세)를 남기고, 7(플레이)은 4의 스냅샷을 **가공 없이 복원**한다.
import { TICKS_PER_DAY } from "../../shared/time";
import type { WorldPackageStageBadge } from "../../shared/protocol";
import { EventInterpreter } from "../../presentation/EventInterpreter";
import { validateWorld } from "../../generation/WorldValidator";
import { buildEventNarration } from "../../viewmodel/NarrationBuilder";
import { RuleEngine } from "../rules/RuleEngine";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { validateWorldDefinition } from "../world/WorldValidation";
import type { WorldDefinition } from "../world/types";
import { WorldRuntime, type RuntimeSnapshot } from "../world/WorldRuntime";
import { SimulationLoop } from "./SimulationLoop";
import { createWorldSystems } from "./WorldSystems";

export const WORLD_PACKAGE_FORMAT = "hktadvc.world.2";

/** 5단계 사전 실행 길이 — 검증용이므로 짧다. 결과 상태는 버려진다(플레이는 4단계 스냅샷에서 시작한다) */
export const PACKAGE_PRERUN_DAYS = 2;

/** 6단계 문장 표본 수 — 중요도 상위 사건만 해석한다 */
const INTERPRET_SAMPLES = 3;

export interface WorldPackageDocument {
  format: string;
  label: string;
  /** 2단계 산출물 — 변하지 않는 세계 구조 (§39 WorldDefinition) */
  definition: WorldDefinition;
  /** 4단계 산출물 — 배치가 끝난 시점의 전체 상태 (§39 WorldSnapshot). 플레이(§3-7)는 이것을 그대로 복원한다 */
  bootstrapSnapshot: RuntimeSnapshot;
  /** 모듈 1~6 의 처리 보고 — 무엇이 가공되어 무엇이 남았는가 */
  stages: WorldPackageStageBadge[];
}

export interface WorldPackageBuild {
  document?: WorldPackageDocument;
  stages: WorldPackageStageBadge[];
  ok: boolean;
}

export interface WorldPackageOptions {
  /**
   * 2단계의 실제 실행 기록 — 생성 세계는 §5 컴파일 15단계의 StepReport 를 문장으로 옮겨 싣는다.
   * 없으면 이 세계는 컴파일을 거치지 않은 수동 정의 세계다 — 그 사실을 보고에 명시한다.
   */
  compileTrace?: string[];
}

/** §3 모듈 1~6 을 순서대로 실행해 패키지를 만든다. 실패한 단계 뒤는 돌지 않는다(파이프라인 규약) */
export function buildWorldPackage(definition: WorldDefinition, options: WorldPackageOptions = {}): WorldPackageBuild {
  const stages: WorldPackageStageBadge[] = [];
  const fail = (): WorldPackageBuild => ({ stages, ok: false });

  // 1. World Seed Editor — 입력 원문이 세계에 실려 있는가 (G-11 metadata.seedInput)
  const seed = definition.metadata.seedInput;
  stages.push({
    id: "1.seed",
    title: "World Seed Editor",
    ok: true,
    evidence:
      seed === undefined
        ? `수동 정의 세계 — 입력 원문 없음 (제목 "${definition.metadata.title}")`
        : `주제 ${seed.themes?.length ?? 0}문장 · 경험 ${seed.desiredExperiences?.length ?? 0} · 제외 ${seed.prohibitedElements?.length ?? 0}`,
    details:
      seed === undefined
        ? [`이 세계는 §4 입력이 아니라 손으로 정의됐다 — 출처: "${definition.metadata.title}" (id ${definition.metadata.id})`]
        : [
            ...(seed.title === undefined ? [] : [`제목: ${seed.title}`]),
            ...(seed.themes ?? []).map((line) => `주제: ${line}`),
            ...(seed.desiredExperiences ?? []).map((line) => `경험: ${line}`),
            ...(seed.prohibitedElements ?? []).map((line) => `제외: ${line}`),
          ],
  });

  // 2. World Compiler — 입력이 실행 데이터로 **어떻게** 변환됐는가.
  // 생성 세계는 §5 컴파일 단계 기록을 그대로 싣고, 수동 세계는 우회 사실을 숨기지 않는다.
  const counts = {
    규칙: definition.ruleDefinitions.length,
    행동: definition.actionDefinitions.length,
    지역: definition.spaces.regions.length,
    종족: definition.species.length,
    조직: definition.factions.length,
    개체: definition.bootstrap.entities.length,
  };
  const countLine = Object.entries(counts)
    .map(([key, value]) => `${key} ${value}`)
    .join(" · ");
  const compiled = counts.규칙 > 0 && counts.행동 > 0 && counts.지역 > 0 && counts.개체 > 0;
  stages.push({
    id: "2.compile",
    title: "World Compiler",
    ok: compiled,
    evidence:
      options.compileTrace === undefined
        ? `§5 컴파일 우회(수동 정의 — 실행 데이터 직접 작성) · ${countLine}`
        : `§5 컴파일 ${options.compileTrace.length}단계 실행 기록 동봉 · ${countLine}`,
    details:
      options.compileTrace ?? [
        "이 세계의 실행 데이터는 §5 컴파일러가 아니라 사람이 직접 작성했다 (Phase 1~7 수동 세계).",
        `산출물: ${countLine}`,
      ],
  });
  if (!compiled) return fail();

  // 3. World Validator — §34 정적 검증 전부: (a) 스키마 층 + (b) 의미 검사기 19종 + 로드 계약.
  // 개별 검사기의 판정이 details 로 남는다 — "검증했다"가 아니라 "무엇을 어떻게 봤는가"다.
  const rules = new RuleEngine(definition.ruleDefinitions);
  const loadIssues = validateWorldDefinition(definition, rules);
  const semantic = validateWorld(definition);
  const validateDetails = [
    `${semantic.schema.ok ? "✓" : "✗"} ${semantic.schema.code} — ${semantic.schema.evidence} (검사 대상 ${semantic.schema.inspected})`,
    ...semantic.checks.map(
      (check) => `${check.ok ? "✓" : "✗"} ${check.code} — ${check.evidence} (검사 대상 ${check.inspected})`,
    ),
    loadIssues.length === 0
      ? "✓ 로드 계약(정의↔규칙 참조 무결성) 위반 0건"
      : `✗ 로드 계약 위반 ${loadIssues.length}건 — ${loadIssues[0] ?? ""}`,
  ];
  const validateOk = semantic.errorCount === 0 && loadIssues.length === 0;
  stages.push({
    id: "3.validate",
    title: "World Validator",
    ok: validateOk,
    evidence: `§34 스키마 층 + 의미 검사기 ${semantic.checks.length}종 — error ${semantic.errorCount} · warning ${semantic.warningCount} · 로드 계약 위반 ${loadIssues.length}`,
    details: validateDetails,
  });
  if (!validateOk) return fail();

  // 4. World Bootstrapper — 배치 실행 → 스냅샷 (§39). 여기까지가 "저장되는 데이터"다
  let snapshot: RuntimeSnapshot;
  let bootEvidence: string;
  const bootDetails: string[] = [];
  try {
    const runtime = new WorldRuntime(definition);
    const systems = createWorldSystems(rules);
    const loop = new SimulationLoop(systems.hooks);
    systems.registerHandlers(loop);
    bootstrapWorld(runtime);
    systems.scheduleInitialEvents(runtime);
    snapshot = runtime.toSnapshot();
    const byType = new Map<string, number>();
    for (const entity of Object.values(snapshot.state.entities)) {
      byType.set(entity.type, (byType.get(entity.type) ?? 0) + 1);
    }
    for (const [type, count] of [...byType.entries()].sort()) bootDetails.push(`배치된 ${type}: ${count}개`);
    bootDetails.push(`주체 런타임(믿음·목적·기억 초기화): ${runtime.agentIds().length}명`);
    bootDetails.push(`예약된 초기 이벤트(interval 규칙·유지·재판단): ${snapshot.scheduler.pending.length}건`);
    bootEvidence = `개체 ${Object.keys(snapshot.state.entities).length} · 주체 ${runtime.agentIds().length} · tick ${snapshot.state.simulationTime}`;
  } catch (error) {
    stages.push({
      id: "4.bootstrap",
      title: "World Bootstrapper",
      ok: false,
      evidence: error instanceof Error ? error.message : String(error),
      details: [],
    });
    return fail();
  }
  stages.push({ id: "4.bootstrap", title: "World Bootstrapper", ok: true, evidence: bootEvidence, details: bootDetails });

  // 5. Simulation Runtime — 사전 실행. 스냅샷 복원본으로 돌리고 결과 상태는 버린다(검증이지 진행이 아니다)
  let prerun: WorldRuntime | undefined;
  const prerunDetails: string[] = [];
  try {
    prerun = WorldRuntime.fromSnapshot(definition, snapshot);
    const systems = createWorldSystems(new RuleEngine(definition.ruleDefinitions));
    const loop = new SimulationLoop(systems.hooks);
    systems.registerHandlers(loop);
    for (let day = 1; day <= PACKAGE_PRERUN_DAYS; day++) {
      const changesBefore = prerun.state.changeLog.length;
      const eventsBefore = prerun.state.events.events.length;
      loop.advance(prerun, TICKS_PER_DAY);
      prerunDetails.push(
        `${day}일차: change +${prerun.state.changeLog.length - changesBefore} · 새 사건 +${prerun.state.events.events.length - eventsBefore}`,
      );
    }
    stages.push({
      id: "5.simulate",
      title: "Simulation Runtime (사전 실행)",
      ok: true,
      evidence: `${PACKAGE_PRERUN_DAYS}일 실행 — change ${prerun.state.changeLog.length} · 사건 ${prerun.state.events.events.length}`,
      details: prerunDetails,
    });
  } catch (error) {
    stages.push({
      id: "5.simulate",
      title: "Simulation Runtime (사전 실행)",
      ok: false,
      evidence: error instanceof Error ? error.message : String(error),
      details: prerunDetails,
    });
    return fail();
  }

  // 6. Event Interpreter — 사전 실행이 남긴 사건을 **실제 해석기**(§33.3 presentation/EventInterpreter)로
  // 문장화한다. 요약기의 ID 형 제목이 아니라 사람이 읽는 제목·요약이 표본으로 남는다.
  const interpreter = new EventInterpreter();
  const top = [...prerun.state.events.events]
    .sort((a, b) => (a.significance === b.significance ? a.id.localeCompare(b.id) : b.significance - a.significance))
    .slice(0, INTERPRET_SAMPLES);
  const sentences: string[] = [];
  for (const event of top) {
    const observer = event.participants[0] ?? "";
    const title = interpreter.interpret(buildEventNarration(prerun, observer, event, "event_title")).text;
    const summary = interpreter.interpret(buildEventNarration(prerun, observer, event, "event_summary")).text;
    sentences.push(`「${title}」 — ${summary}`);
  }
  stages.push({
    id: "6.interpret",
    title: "Event Interpreter",
    ok: true,
    evidence:
      sentences.length === 0
        ? `사건 0건 (${PACKAGE_PRERUN_DAYS}일 사전 실행) — 해석할 것이 없었다`
        : `상위 사건 ${sentences.length}건을 §33.3 해석기로 문장화 (캐시 ${interpreter.cacheSize} · 폐기 ${interpreter.rejectedCount})`,
    details: sentences,
  });

  return {
    document: {
      format: WORLD_PACKAGE_FORMAT,
      label: definition.metadata.title,
      definition,
      bootstrapSnapshot: snapshot,
      stages,
    },
    stages,
    ok: true,
  };
}

/** 패키지 문자열 → 문서. 형식 위반은 이유를 말하며 거부한다 — §34 재검증은 initialize 가 이어서 한다 */
export function parseWorldPackage(json: string): WorldPackageDocument {
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    throw new Error("세계 패키지를 읽을 수 없다 — JSON 이 아니다");
  }
  const pkg = doc as Partial<WorldPackageDocument>;
  if (pkg.format !== WORLD_PACKAGE_FORMAT) {
    throw new Error(`세계 패키지 형식이 아니다 (format=${String(pkg.format)} ≠ ${WORLD_PACKAGE_FORMAT})`);
  }
  if (pkg.definition === undefined || pkg.definition === null || typeof pkg.definition !== "object") {
    throw new Error("세계 패키지에 세계 정의(2단계 산출물)가 없다");
  }
  if (pkg.bootstrapSnapshot === undefined || pkg.bootstrapSnapshot === null) {
    throw new Error("세계 패키지에 부트스트랩 스냅샷(4단계 산출물)이 없다");
  }
  return pkg as WorldPackageDocument;
}
