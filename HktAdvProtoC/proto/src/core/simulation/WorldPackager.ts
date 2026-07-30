// 세계 패키저 (Phase-9 §9.1) — §3 아키텍처 모듈 1~6 을 **정적 파이프라인**으로 돌려 데이터로 굽는다.
//
// 기획서 §3 의 일곱 모듈에서 1~6 은 제작(정적) 국면이다:
//   1. World Seed Editor  → 입력 원문 확인
//   2. World Compiler     → 실행 데이터 확인 (컴파일은 이미 §5 파이프라인/수동 정의가 끝냈다)
//   3. World Validator    → §34 정적 검증
//   4. World Bootstrapper → 배치 실행 → **부트스트랩 스냅샷** (플레이가 그대로 불러올 데이터)
//   5. Simulation Runtime → 사전 실행(§35 의 축소판) — 세계가 실제로 도는가
//   6. Event Interpreter  → 사전 실행이 남긴 사건의 문장 표본
// 각 단계는 처리 보고(ok + 수치 근거)를 남기고, 7(플레이)은 4의 스냅샷을 **가공 없이 복원**한다.
import { TICKS_PER_DAY } from "../../shared/time";
import type { WorldPackageStageBadge } from "../../shared/protocol";
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

/** §3 모듈 1~6 을 순서대로 실행해 패키지를 만든다. 실패한 단계 뒤는 돌지 않는다(파이프라인 규약) */
export function buildWorldPackage(definition: WorldDefinition): WorldPackageBuild {
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
  });

  // 2. World Compiler — 실행 데이터가 실제로 있는가
  const counts = {
    규칙: definition.ruleDefinitions.length,
    행동: definition.actionDefinitions.length,
    지역: definition.spaces.regions.length,
    종족: definition.species.length,
    조직: definition.factions.length,
    개체: definition.bootstrap.entities.length,
  };
  const compiled = counts.규칙 > 0 && counts.행동 > 0 && counts.지역 > 0 && counts.개체 > 0;
  stages.push({
    id: "2.compile",
    title: "World Compiler",
    ok: compiled,
    evidence: Object.entries(counts)
      .map(([key, value]) => `${key} ${value}`)
      .join(" · "),
  });
  if (!compiled) return fail();

  // 3. World Validator — §34 정적 검증 (모순·누락·허상 참조)
  const rules = new RuleEngine(definition.ruleDefinitions);
  const issues = validateWorldDefinition(definition, rules);
  stages.push({
    id: "3.validate",
    title: "World Validator",
    ok: issues.length === 0,
    evidence: issues.length === 0 ? "위반 0건" : `위반 ${issues.length}건 — ${issues[0] ?? ""}`,
  });
  if (issues.length > 0) return fail();

  // 4. World Bootstrapper — 배치 실행 → 스냅샷 (§39). 여기까지가 "저장되는 데이터"다
  let snapshot: RuntimeSnapshot;
  let bootEvidence: string;
  try {
    const runtime = new WorldRuntime(definition);
    const systems = createWorldSystems(rules);
    const loop = new SimulationLoop(systems.hooks);
    systems.registerHandlers(loop);
    bootstrapWorld(runtime);
    systems.scheduleInitialEvents(runtime);
    snapshot = runtime.toSnapshot();
    const agentCount = runtime.agentIds().length;
    bootEvidence = `개체 ${Object.keys(snapshot.state.entities).length} · 주체 ${agentCount} · tick ${snapshot.state.simulationTime}`;
  } catch (error) {
    stages.push({
      id: "4.bootstrap",
      title: "World Bootstrapper",
      ok: false,
      evidence: error instanceof Error ? error.message : String(error),
    });
    return fail();
  }
  stages.push({ id: "4.bootstrap", title: "World Bootstrapper", ok: true, evidence: bootEvidence });

  // 5. Simulation Runtime — 사전 실행. 스냅샷 복원본으로 돌리고 결과 상태는 버린다(검증이지 진행이 아니다)
  let prerun: WorldRuntime | undefined;
  try {
    prerun = WorldRuntime.fromSnapshot(definition, snapshot);
    const systems = createWorldSystems(new RuleEngine(definition.ruleDefinitions));
    const loop = new SimulationLoop(systems.hooks);
    systems.registerHandlers(loop);
    loop.advance(prerun, PACKAGE_PRERUN_DAYS * TICKS_PER_DAY);
    stages.push({
      id: "5.simulate",
      title: "Simulation Runtime (사전 실행)",
      ok: true,
      evidence: `${PACKAGE_PRERUN_DAYS}일 실행 — change ${prerun.state.changeLog.length} · 사건 ${prerun.state.events.events.length}`,
    });
  } catch (error) {
    stages.push({
      id: "5.simulate",
      title: "Simulation Runtime (사전 실행)",
      ok: false,
      evidence: error instanceof Error ? error.message : String(error),
    });
    return fail();
  }

  // 6. Event Interpreter — 사전 실행이 남긴 사건의 문장 표본 (§33.3 제목은 요약기가 이미 만들었다)
  const titles = prerun.state.events.events.slice(0, 3).map((event) => event.title);
  stages.push({
    id: "6.interpret",
    title: "Event Interpreter",
    ok: true,
    evidence: titles.length === 0 ? `사건 0건 (${PACKAGE_PRERUN_DAYS}일 사전 실행)` : titles.join(" / "),
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
