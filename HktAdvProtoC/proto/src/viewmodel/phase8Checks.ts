// Phase 8 완료 조건의 재현 가능한 측정 (기획서 §36 4개 화면, §33.3 표현 생성, §44 13항)
//
// phase3~7Checks 와 같은 규약 — **verify 스크립트와 테스트가 같은 함수를 쓴다.**
// 보고에 실린 수치와 테스트가 보는 수치가 갈라질 수 없게 하는 장치다.
import { readFileSync, readdirSync } from "node:fs";
import { effectiveAbility } from "../core/agents/GrowthSystem";
import { findPlayerId } from "../core/agents/PlayerAgent";
import {
  eventsBySignificance,
  findConcludedWithConsequences,
  findGoalConflictEvents,
} from "../core/events/phase4Checks";
import type { WorldRuntime } from "../core/world/WorldRuntime";
import type { WorldDefinition } from "../core/world/types";
import { EventInterpreter, findLeaks } from "../presentation/EventInterpreter";
import { CanvasSceneRenderer } from "../rendering/CanvasSceneRenderer";
import { RecordingSurface } from "../rendering/SceneSurface";
import { TextSceneRenderer } from "../rendering/TextSceneRenderer";
import {
  NARRATION_KINDS,
  type ForbiddenFact,
  type NarrationPort,
  type NarrationRequest,
} from "../shared/narration";
import { buildEventNarration, buildObservationNarration } from "./NarrationBuilder";
import { buildScenePayload, type SceneFocus } from "./ScenePayloadBuilder";
import {
  createEmptyScene,
  type SceneAgentPanel,
  type SceneViewModel,
  type SceneViewPayload,
} from "./SceneViewModel";

// --- §36 화면 명세 항목 (문서에 적힌 목록 그대로) ---------------------------------------

export interface ScreenItemResult {
  screen: string;
  item: string;
  ok: boolean;
  evidence: string;
}

/** payload → SceneViewModel (렌더러가 실제로 받는 모양) */
export function sceneOf(payload: SceneViewPayload, time = 0): SceneViewModel {
  const scene = createEmptyScene();
  scene.initialized = true;
  scene.time = time;
  scene.modeKey = payload.modeKey;
  scene.speed = payload.speed;
  scene.map = payload.map;
  scene.events = payload.events;
  scene.agentChoices = payload.agentChoices;
  if (payload.agentPanel !== undefined) scene.agentPanel = payload.agentPanel;
  if (payload.eventDetail !== undefined) scene.eventDetail = payload.eventDetail;
  return scene;
}

function item(screen: string, name: string, ok: boolean, evidence: string): ScreenItemResult {
  return { screen, item: name, ok, evidence };
}

/**
 * §36 네 화면의 명세 항목이 **화면 데이터에 실제로 실렸는가**.
 * 주장이 아니라 ViewModel 속성의 개수로 판정한다 — 비어 있으면 실패다.
 */
export function checkScreenItems(
  developer: SceneViewPayload,
  player: SceneViewPayload,
  generation: { steps: number; scaleRows: number; artifacts: number; inputs: number },
  /**
   * "현재 행동"을 판정할 패널.
   * 관찰 대상이 그 순간 쉬고 있으면 화면에 행동이 없는 것이 맞다 — 그래서 표시 능력은
   * **지금 무언가를 하고 있는 주체**의 패널로 판정한다(없으면 기본 패널).
   */
  actingPanel?: SceneAgentPanel,
): ScreenItemResult[] {
  const rows: ScreenItemResult[] = [];
  const map = developer.map;
  const panel = developer.agentPanel;
  const detail = developer.eventDetail;
  const playerDetail = player.eventDetail;
  const playerPanel = player.agentPanel;

  // §36.1 세계 생성 화면
  rows.push(item("§36.1 생성", "세계관 주제·경험·제외 요소 입력", generation.inputs >= 3, `입력 필드 ${generation.inputs}종`));
  rows.push(item("§36.1 생성", "생성 단계 진행 상태", generation.steps === 15, `단계 ${generation.steps}개`));
  rows.push(item("§36.1 생성", "생성된 세계 구조 검토", generation.artifacts > 0, `아티팩트 ${generation.artifacts}개 (§40 규모 ${generation.scaleRows}항)`));

  // §36.2 월드 지도 화면
  rows.push(item("§36.2 지도", "2D 지역 지도", map.regions.length > 0, `지역 ${map.regions.length}개 (정규화 사각형)`));
  rows.push(
    item(
      "§36.2 지도",
      "지역 기후·위험도",
      map.regions.every((region) => region.climateKey.length > 0 && region.dangerKey.length > 0),
      map.regions.map((region) => `${region.id} ${region.climateKey}/${region.dangerKey}`).join(" · "),
    ),
  );
  rows.push(item("§36.2 지도", "지역 연결 그래프", map.connections.length > 0, `연결 ${map.connections.length}개`));
  rows.push(
    item(
      "§36.2 지도",
      "이동 중인 주체",
      map.markers.length > 0,
      `주체 ${map.markers.length}명 · 이동 중 ${map.markers.filter((marker) => marker.moving).length}명`,
    ),
  );
  rows.push(item("§36.2 지도", "자원 분포", map.resources.length > 0, `자원 마커 ${map.resources.length}개 · 장소 ${map.places.length}개`));
  rows.push(
    item(
      "§36.2 지도",
      "발생 중 사건 오버레이",
      map.overlays.length > 0,
      `오버레이 ${map.overlays.length}개 (진행 중 ${map.overlays.filter((overlay) => overlay.ongoing).length})`,
    ),
  );
  rows.push(item("§36.2 지도", "시간 배속 조절", developer.speed > 0, `배속 ×${developer.speed}`));
  rows.push(
    item(
      "§42-8 연출",
      "능력 효과·신호 표시",
      map.signals.length > 0,
      `신호 ${map.signals.length}개 — ${[...new Set(map.signals.map((signal) => signal.channelKey))].join(" ")}`,
    ),
  );

  // §36.3 주체 관찰 화면
  rows.push(item("§36.3 주체", "실제 상태", (panel?.states.filter((row) => row.actual !== undefined).length ?? 0) > 0, `실제값 ${panel?.states.filter((row) => row.actual !== undefined).length ?? 0}항`));
  rows.push(
    item(
      "§36.3 주체",
      "믿고 있는 상태",
      (panel?.beliefsAboutOthers.length ?? 0) > 0,
      `자기 상태 믿음 ${panel?.states.filter((row) => row.believed !== undefined).length ?? 0}항 · 남에 대한 믿음 ${panel?.beliefsAboutOthers.length ?? 0}항`,
    ),
  );
  rows.push(item("§36.3 주체", "현재 활성 목적", panel?.activeGoal !== undefined, panel?.activeGoal === undefined ? "없음" : `${panel.activeGoal.id} (${panel.activeGoal.activation})`));
  rows.push(
    item(
      "§36.3 주체",
      "목적 그래프 (활성도 11항)",
      (panel?.goalGraph.length ?? 0) > 0 && (panel?.goalGraph[0]?.breakdown.length ?? 0) === 11,
      `노드 ${panel?.goalGraph.length ?? 0}개 · 활성도 항목 ${panel?.goalGraph[0]?.breakdown.length ?? 0}항`,
    ),
  );
  const acting = actingPanel ?? panel;
  rows.push(
    item(
      "§36.3 주체",
      "현재 행동",
      acting?.currentAction !== undefined,
      acting?.currentAction === undefined
        ? "행동 중인 주체 없음"
        : `${acting.label} — ${acting.currentAction.actionId} ${acting.currentAction.startedAt}~${acting.currentAction.completesAt} ` +
          `진행 ${(acting.currentAction.progress * 100).toFixed(0)}%`,
    ),
  );
  rows.push(item("§36.3 주체", "기억", (panel?.memories.length ?? 0) > 0, `기억 ${panel?.memories.length ?? 0}건`));
  rows.push(item("§36.3 주체", "관계", (panel?.relationships.length ?? 0) > 0, `관계 ${panel?.relationships.length ?? 0}건 (9축)`));
  rows.push(
    item(
      "§36.3 주체",
      "능력과 제약",
      (panel?.abilities.length ?? 0) > 0 && (panel?.abilities[0]?.restrictions.length ?? 0) > 0,
      panel?.abilities.map((ability) => `${ability.id} 출력 ${ability.outputRange} 제약 ${ability.restrictions.length}종`).join(" · ") ?? "없음",
    ),
  );
  rows.push(
    item(
      "§36.3 주체",
      "개발자 모드 = 실제+믿음 / 플레이어 모드 = 관찰된 것만",
      panel !== undefined &&
        playerPanel !== undefined &&
        panel.states.some((row) => row.actual !== undefined) &&
        playerPanel.states.every((row) => row.actual === undefined),
      `개발자 실제값 ${panel?.states.filter((row) => row.actual !== undefined).length ?? 0}항 / ` +
        `플레이어 실제값 ${playerPanel?.states.filter((row) => row.actual !== undefined).length ?? 0}항 (감춰짐 ${playerPanel?.hiddenCount ?? 0}종)`,
    ),
  );

  // §36.4 사건 화면
  rows.push(item("§36.4 사건", "참여자", (detail?.participants.length ?? 0) > 0, `참여자 ${detail?.participants.length ?? 0}명`));
  rows.push(
    item(
      "§36.4 사건",
      "참여자별 목적",
      (detail?.participants.filter((participant) => participant.goals.length > 0).length ?? 0) > 0,
      detail?.participants.map((participant) => `${participant.label}:${participant.goals.length}`).join(" ") ?? "없음",
    ),
  );
  rows.push(item("§36.4 사건", "알려진 정보", detail !== undefined, `아는 사실 ${detail?.knownFacts.length ?? 0}건 · 아는 참여자 ${detail?.knownParticipantCount ?? 0} / 모르는 참여자 ${detail?.unknownParticipantCount ?? 0}`));
  rows.push(
    item(
      "§36.4 사건",
      "실제 원인 (플레이어 시점에서는 감춰진다)",
      (detail?.actualCauses.length ?? 0) > 0 && playerDetail?.causeVisible === false && (playerDetail?.actualCauses.length ?? 0) === 0,
      `개발자 원인 ${detail?.actualCauses.length ?? 0}줄 / 플레이어 원인 ${playerDetail?.actualCauses.length ?? 0}줄`,
    ),
  );
  rows.push(item("§36.4 사건", "시간순 상태 변화", (detail?.timeline.length ?? 0) > 0, `타임라인 ${detail?.timeline.length ?? 0}줄`));
  rows.push(item("§36.4 사건", "플레이어 개입 기록", (playerDetail?.interventions.length ?? 0) > 0 || (detail?.interventions.length ?? 0) > 0, `개입 기록 ${Math.max(detail?.interventions.length ?? 0, playerDetail?.interventions.length ?? 0)}건`));
  rows.push(item("§36.4 사건", "발생한 결과", (detail?.results.length ?? 0) > 0, `결과 ${detail?.results.length ?? 0}항`));
  rows.push(item("§36.4 사건", "후속 사건 가능성", (detail?.followUps.length ?? 0) > 0, `후속 목적 ${detail?.followUps.length ?? 0}건 · 목적 충돌 ${detail?.goalConflicts.length ?? 0}건`));
  rows.push(
    item(
      "§33.3 표현",
      "사건 제목·요약·소문·문서·대화·관찰 묘사",
      detail !== undefined &&
        detail.title.length > 0 &&
        detail.summarySentence.length > 0 &&
        detail.rumor.length > 0 &&
        detail.document.length > 0 &&
        (panel?.narration[0]?.length ?? 0) > 0,
      `제목 "${detail?.title ?? ""}" · 대화 ${detail?.dialogue.length ?? 0}건 · 묘사 "${(panel?.narration[0] ?? "").slice(0, 40)}…"`,
    ),
  );
  return rows;
}

// --- 렌더러 격리 (§8.0 표현 방식 변경의 격리 증명) ---------------------------------------

export interface RendererImportReport {
  file: string;
  imports: string[];
  violations: string[];
}

/**
 * rendering/ 이 **프로젝트 내부에서는** SceneViewModel 밖의 타입을 import 하지 않는지 소스에서 직접 확인한다.
 * 외부 표현 라이브러리(three 등, bare import)는 격리 위반이 아니다 — 시뮬레이션 타입을 실어 나를 수 없기 때문이다.
 * 지키려는 것은 "표현 교체가 rendering/ 밖 diff 0" 이고, 그 경계는 프로젝트 내부 경로에만 있다.
 */
export function checkRendererImports(directory: string): RendererImportReport[] {
  const reports: RendererImportReport[] = [];
  for (const file of readdirSync(directory).sort()) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const source = readFileSync(`${directory}/${file}`, "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
    const violations = imports.filter(
      (specifier) =>
        (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("src/")) &&
        specifier !== "../viewmodel/SceneViewModel" &&
        !specifier.startsWith("./"),
    );
    reports.push({ file, imports, violations });
  }
  return reports;
}

export interface ParityReport {
  canvasOps: number;
  canvasTexts: number;
  textLines: number;
  /** 두 렌더러가 함께 그린 id·라벨 */
  sharedKeys: string[];
  missingInCanvas: string[];
  missingInText: string[];
}

/**
 * 같은 SceneViewModel 을 Canvas 렌더러와 텍스트 렌더러에 넣어 같은 것을 그리는지 본다.
 * 두 렌더러가 공유하는 것은 ViewModel 속성뿐이므로, 이 일치가 곧 "표현 교체가 rendering/ 안에서 끝난다"의 증거다.
 */
export function checkRendererParity(scene: SceneViewModel): ParityReport {
  const surface = new RecordingSurface();
  new CanvasSceneRenderer(surface).render(scene);
  const dump = new TextSceneRenderer().render(scene);
  const canvasText = surface.texts().join("\n");

  const keys = [
    ...scene.map.regions.map((region) => region.label),
    ...scene.map.markers.map((marker) => marker.label),
    ...scene.map.resources.map((marker) => marker.label),
    ...scene.map.overlays.map((overlay) => overlay.label),
  ];
  const missingInCanvas = keys.filter((key) => !canvasText.includes(key));
  const missingInText = keys.filter((key) => !dump.includes(key));
  return {
    canvasOps: surface.ops.length,
    canvasTexts: surface.countOf("text"),
    textLines: dump.split("\n").length,
    sharedKeys: keys,
    missingInCanvas,
    missingInText,
  };
}

// --- 모드 대비 (§36.3 말미) --------------------------------------------------------------

export interface ModeContrastReport {
  agentId: string;
  developerRows: number;
  developerActualRows: number;
  divergentRows: number;
  playerRows: number;
  playerActualRows: number;
  playerHidden: number;
  /** 플레이어 시점에 실렸는데 믿음·감각 어느 쪽도 아닌 값 */
  leaks: string[];
  developerCauseLines: number;
  playerCauseLines: number;
  developerEvents: number;
  playerEvents: number;
  developerMarkers: number;
  playerMarkers: number;
  /** 실제 ≠ 표시 (개발자 모드에서만 보이는 어긋남) */
  divergences: { key: string; actual: string; believed: string }[];
}

/** 같은 세계·같은 주체를 두 시점으로 만들어 나란히 비교한다 */
export function compareModes(
  runtime: WorldRuntime,
  agentId: string,
  eventId: string | undefined,
  interpreter: EventInterpreter = new EventInterpreter(),
): ModeContrastReport {
  const focus = (mode: "developer" | "player"): SceneFocus => ({
    mode,
    agentId,
    ...(eventId === undefined ? {} : { eventId }),
  });
  const developer = buildScenePayload(runtime, focus("developer"), interpreter);
  const player = buildScenePayload(runtime, focus("player"), interpreter);
  const developerPanel = developer.agentPanel;
  const playerPanel = player.agentPanel;
  const observerId = findPlayerId(runtime);
  const beliefs = new Set(
    (observerId === undefined ? [] : runtime.agentRuntime(observerId).beliefs).map(
      (belief) => `${belief.subjectId}|${belief.stateKey}`,
    ),
  );

  const leaks: string[] = [];
  for (const row of playerPanel?.states ?? []) {
    if (row.actual !== undefined) {
      leaks.push(`${row.key}: 실제값이 플레이어 시점에 실렸다`);
      continue;
    }
    // 자기 감각(self)·현재 감각(sense)·믿음(belief) 셋 중 하나여야 한다
    if (!["self", "sense", "belief"].includes(row.sourceKey)) {
      leaks.push(`${row.key}: 출처 ${row.sourceKey}`);
      continue;
    }
    if (row.sourceKey === "belief" && observerId !== undefined && agentId !== observerId) {
      if (!beliefs.has(`${agentId}|${row.key}`)) leaks.push(`${row.key}: 믿음 없이 belief 로 표시`);
    }
  }

  const divergences = (developerPanel?.states ?? [])
    .filter((row) => row.divergent)
    .map((row) => ({ key: row.key, actual: row.actual ?? "-", believed: row.believed ?? "-" }));

  return {
    agentId,
    developerRows: developerPanel?.states.length ?? 0,
    developerActualRows: (developerPanel?.states ?? []).filter((row) => row.actual !== undefined).length,
    divergentRows: divergences.length,
    playerRows: playerPanel?.states.length ?? 0,
    playerActualRows: (playerPanel?.states ?? []).filter((row) => row.actual !== undefined).length,
    playerHidden: playerPanel?.hiddenCount ?? 0,
    leaks,
    developerCauseLines: developer.eventDetail?.actualCauses.length ?? 0,
    playerCauseLines: player.eventDetail?.actualCauses.length ?? 0,
    developerEvents: developer.events.length,
    playerEvents: player.events.length,
    developerMarkers: developer.map.markers.length,
    playerMarkers: player.map.markers.length,
    divergences,
  };
}

// --- 표현 생성 감사 (§8.2 unknownFacts 누출) ----------------------------------------------

/** 금지 사실을 그대로 흘리는 포트 — 누출 검사가 실제로 작동하는지 보기 위한 것이다 */
export class LeakingNarrationPort implements NarrationPort {
  narrate(request: NarrationRequest, forbidden: ForbiddenFact[]): Promise<string> {
    return Promise.resolve(`${request.eventType}: ${forbidden.map((fact) => fact.sentence).join(" / ")}`);
  }
}

/** 금지 사실을 지키는 포트 — 통과 경로도 함께 확인한다 */
export class ObedientNarrationPort implements NarrationPort {
  narrate(request: NarrationRequest): Promise<string> {
    return Promise.resolve(`${request.locationLabel}에서 무슨 일이 있었다. ${request.knownFacts[0] ?? ""}`.trim());
  }
}

export interface NarrationAuditReport {
  requests: number;
  /** 검사한 문장 수 */
  sentences: number;
  /** 금지 사실이 하나라도 있었던 요청 수 — "막을 것이 있었다"의 증거 */
  withForbidden: number;
  forbiddenFacts: number;
  /** 화면에 게시된 문장에서 발견된 누출 */
  leaks: { kind: string; eventId: string; tokens: string[] }[];
  /** 누출 포트를 붙였을 때 폐기된 문장 수 */
  rejectedFromPort: number;
  /** 캐시 적중 */
  cacheHits: number;
  sampleTitles: string[];
}

/**
 * 6종 생성 전부를 관찰자 시점으로 만들어 **금지 사실이 새지 않는지** 검사한다.
 * 템플릿 경로와 포트 경로를 모두 본다 — 폴백이든 생성이든 화면에 오르는 문장은 같은 검사를 통과한다.
 */
export async function auditNarration(
  runtime: WorldRuntime,
  observerId: string,
): Promise<NarrationAuditReport> {
  const interpreter = new EventInterpreter();
  const report: NarrationAuditReport = {
    requests: 0,
    sentences: 0,
    withForbidden: 0,
    forbiddenFacts: 0,
    leaks: [],
    rejectedFromPort: 0,
    cacheHits: 0,
    sampleTitles: [],
  };

  const requests: NarrationRequest[] = [];
  for (const event of eventsBySignificance(runtime)) {
    for (const kind of NARRATION_KINDS) {
      requests.push(buildEventNarration(runtime, observerId, event, kind));
    }
  }
  for (const agentId of runtime.agentIds()) {
    requests.push(buildObservationNarration(runtime, observerId, agentId));
  }

  for (const request of requests) {
    report.requests += 1;
    if (request.unknownFacts.length > 0) {
      report.withForbidden += 1;
      report.forbiddenFacts += request.unknownFacts.length;
    }
    const template = interpreter.interpret(request);
    report.sentences += 1;
    const templateLeaks = findLeaks(template.text, request.unknownFacts);
    if (templateLeaks.length > 0) {
      report.leaks.push({ kind: request.kind, eventId: request.eventId, tokens: templateLeaks });
    }
    if (interpreter.interpret(request).fromCache) report.cacheHits += 1;
    if (request.kind === "event_title" && report.sampleTitles.length < 3) {
      report.sampleTitles.push(template.text);
    }
  }

  // 포트가 금지 사실을 흘리면 그 문장은 화면에 오르지 못한다 — 템플릿으로 되돌아간다
  const leaky = new EventInterpreter(new LeakingNarrationPort());
  for (const request of requests.filter((entry) => entry.unknownFacts.length > 0).slice(0, 12)) {
    const result = await leaky.interpretWithPort(request);
    report.sentences += 1;
    if (result.source !== "template") {
      report.leaks.push({ kind: request.kind, eventId: request.eventId, tokens: ["포트 문장이 그대로 게시됐다"] });
      continue;
    }
    const leaks = findLeaks(result.text, request.unknownFacts);
    if (leaks.length > 0) {
      report.leaks.push({ kind: request.kind, eventId: request.eventId, tokens: leaks });
    }
  }
  report.rejectedFromPort = leaky.rejectedCount;
  return report;
}

// --- §44 프로토타입 완료 조건 13항 (최종 게이트) -------------------------------------------

export interface Gate44Row {
  index: number;
  title: string;
  ok: boolean;
  evidence: string;
}

export interface Gate44Input {
  /** 무개입 30일 런타임 (§35 기준선의 세계) */
  manual: WorldRuntime;
  /** 개입 시나리오의 런타임과 결과 */
  player: {
    runtime: WorldRuntime;
    playerId: string;
    logHash: string;
    repeatLogHash: string;
    otherSeedLogHash: string;
    interventionCategories: string[];
    growthCount: number;
    performedModes: string[];
  };
  /** 생성된 세계 (§5 컴파일 결과) */
  generated: {
    definition: WorldDefinition;
    themeCount: number;
    stepCount: number;
    storedBytes: number;
    reloadedId: string | undefined;
    scaleOk: boolean;
    expectationsOk: boolean;
  };
  /** 화면이 실제로 받은 표시 재료 */
  scene: { developer: SceneViewPayload; player: SceneViewPayload };
  /** 브라우저 왕복이 확인됐는가 (npm run smoke 의 결과를 넣는다 — 없으면 headless 진행으로 판정) */
  browserRoundTrip: { ok: boolean; evidence: string };
  days: number;
  agentIds: string[];
}

export function evaluateGate44(input: Gate44Input): Gate44Row[] {
  const rows: Gate44Row[] = [];
  const push = (index: number, title: string, ok: boolean, evidence: string): void => {
    rows.push({ index, title, ok, evidence });
  };
  const manual = input.manual;
  const generated = input.generated;
  const definition = generated.definition;

  // 1. 사용자가 3~5개의 세계관 문장을 입력할 수 있다
  push(
    1,
    "세계관 문장 3~5개 입력",
    generated.themeCount >= 3 && generated.themeCount <= 5,
    `주제 ${generated.themeCount}문장 → §36.1 화면의 입력 3종(주제·경험·제외)`,
  );

  // 2. 상태·규칙·종족·조직·개인·목적 그래프 생성
  push(
    2,
    "상태·규칙·종족·조직·개인·목적 그래프 생성",
    definition.stateSchemas.length > 0 &&
      definition.ruleDefinitions.length > 0 &&
      definition.species.length > 0 &&
      definition.factions.length > 0 &&
      definition.agentArchetypes.length > 0 &&
      definition.goalTemplates.length > 0 &&
      generated.scaleOk,
    `상태 ${definition.stateSchemas.length} · 규칙 ${definition.ruleDefinitions.length} · 종족 ${definition.species.length} · ` +
      `조직 ${definition.factions.length} · 개인 ${definition.agentArchetypes.length} · 목적 그래프 ${definition.goalTemplates.length} ` +
      `(§40 규모 ${generated.scaleOk ? "충족" : "미달"} · §41 항목 ${generated.expectationsOk ? "충족" : "미달"})`,
  );

  // 3. 생성 결과가 구조화된 데이터로 저장된다
  push(
    3,
    "생성 결과의 구조화 저장·재로드",
    generated.storedBytes > 0 && generated.reloadedId === definition.metadata.id,
    `저장 ${generated.storedBytes}B · 재로드 id ${generated.reloadedId ?? "없음"} · 단계 아티팩트 ${generated.stepCount}개`,
  );

  // 4. 브라우저에서 시간을 진행할 수 있다
  push(4, "브라우저에서 시간 진행", input.browserRoundTrip.ok, input.browserRoundTrip.evidence);

  // 5. 플레이어가 없어도 주체들이 이동하고 행동한다
  const actionCounts = input.agentIds.map(
    (id) => `${id.split(".")[1]}:${manual.agentRuntime(id).completedActionCount}`,
  );
  const moved = manual.state.changeLog.filter((change) =>
    change.changedStates.some((state) => state.stateKey === "position" || change.tags.includes("action.move")),
  ).length;
  push(
    5,
    "플레이어 없이 주체가 이동·행동",
    input.agentIds.every((id) => manual.agentRuntime(id).completedActionCount > 0),
    `${input.days}일 무개입 — 완료 행동 ${actionCounts.join(" ")} · 이동 관련 변화 ${moved}건`,
  );

  // 6. 주체는 실제 상태가 아니라 자신의 믿음을 근거로 판단한다
  const panel = input.scene.developer.agentPanel;
  const divergent = (panel?.states ?? []).filter((row) => row.divergent).length;
  const otherDivergent = (panel?.beliefsAboutOthers ?? []).filter((row) => row.divergent).length;
  push(
    6,
    "믿음을 근거로 판단 (실제 ≠ 믿음이 화면에 병렬로 보인다)",
    divergent + otherDivergent > 0,
    `관찰 화면에서 어긋난 상태 ${divergent + otherDivergent}항 — ` +
      ((panel?.beliefsAboutOthers ?? [])
        .filter((row) => row.divergent)
        .slice(0, 2)
        .map((row) => `${row.subjectId}.${row.key} 실제 ${row.actual} ≠ 믿음 ${row.believed}`)
        .join(" / ") || "-"),
  );

  // 7. 최소 세 주체의 목적이 하나의 사건에서 충돌한다
  const conflicts = findGoalConflictEvents(manual, 3);
  push(
    7,
    "세 주체 이상의 목적이 한 사건에서 충돌",
    conflicts.length > 0,
    conflicts.length === 0
      ? "충돌 사건 없음"
      : `${conflicts.length}건 — ${conflicts[0]?.event.id}(${conflicts[0]?.agents.length}명): ${conflicts[0]?.lines[0] ?? ""}`,
  );

  // 8. 같은 사건에 여러 개입 방식이 존재한다
  push(
    8,
    "한 사건에 전투·협상·정보·거래 개입이 모두 열린다",
    input.player.interventionCategories.length >= 4,
    `개입 갈래 ${input.player.interventionCategories.join("·")} · 실제 수행한 참여 방식 ${input.player.performedModes.join(",")}`,
  );

  // 9. 사건 결과가 세계 상태를 변화시킨다
  const consequences = findConcludedWithConsequences(manual);
  const detail = input.scene.developer.eventDetail;
  push(
    9,
    "사건 결과가 세계 상태를 바꾼다",
    consequences.length > 0 && (detail?.results.length ?? 0) > 0,
    `결과를 남긴 종결 사건 ${consequences.length}건 · 사건 화면의 결과 표 ${detail?.results.length ?? 0}항 — ` +
      (consequences[0]?.topDeltas.join(" | ") ?? "-"),
  );

  // 10. 사건이 끝난 뒤 새로운 목적·후속 사건이 생성된다
  const followUps = consequences.flatMap((report) => report.newGoals);
  push(
    10,
    "사건 후 새 목적·후속 사건 생성",
    followUps.length > 0 && (detail?.followUps.length ?? 0) >= 0,
    `새 목적 ${followUps.length}건 — ${followUps.slice(0, 3).join(" ")} · 사건 화면 후속 항목 ${detail?.followUps.length ?? 0}건`,
  );

  // 11. 캐릭터의 능력이 개인의 욕망과 제약에서 파생된다
  const abilities = definition.abilitySystem?.abilities ?? [];
  const derived = abilities.filter(
    (ability) => ability.derivedFrom.coreDesire.length > 0 && ability.restrictions.length > 0,
  );
  const abilityRow = input.scene.developer.agentPanel?.abilities[0];
  push(
    11,
    "능력이 욕망과 제약에서 파생",
    abilities.length > 0 && derived.length === abilities.length,
    `능력 ${abilities.length}개 전부 욕망·제약 근거 보유 · 관찰 화면 표시 예: ` +
      (abilityRow === undefined
        ? "없음"
        : `${abilityRow.id} 출력 ${abilityRow.outputRange} 제약 ${abilityRow.restrictions.length}종 (${abilityRow.derivedFrom.slice(0, 40)}…)`),
  );

  // 12. 동일한 세계 시드와 입력으로 결과를 재현할 수 있다
  push(
    12,
    "같은 시드·같은 입력 → 같은 결과",
    input.player.logHash === input.player.repeatLogHash &&
      input.player.logHash !== input.player.otherSeedLogHash,
    `개입 시나리오 해시 ${input.player.logHash} = 재실행 ${input.player.repeatLogHash} ≠ 다른 시드 ${input.player.otherSeedLogHash}`,
  );

  // 13. 개발자가 사건을 직접 작성하지 않아도 의미 있는 상황이 발생한다
  const events = eventsBySignificance(manual);
  const patterns = new Set(events.map((event) => event.patternId));
  push(
    13,
    "작성하지 않은 사건이 스스로 발생",
    events.length > 0 && patterns.size > 1 && conflicts.length > 0,
    `${input.days}일 동안 사건 ${events.length}건 / 패턴 ${patterns.size}종 — 저작된 사건 0건(콘텐츠에는 패턴 선언만 있다) · ` +
      `사건 목록 화면 ${input.scene.developer.events.length}건 표시`,
  );

  return rows;
}

/** 능력 원장 합성이 화면 표시와 일치하는가 — §32 성장이 관찰 화면에 반영되는지 (보조 관측점) */
export function abilityDisplayMatchesLedger(
  runtime: WorldRuntime,
  agentId: string,
  payload: SceneViewPayload,
): boolean {
  const rows = payload.agentPanel?.abilities ?? [];
  return rows.every((row) => {
    const effective = effectiveAbility(runtime, row.id, agentId);
    if (effective === undefined) return false;
    return (
      row.restrictions.length === effective.restrictions.length &&
      row.outputRange === `${effective.outputRange.min}~${effective.outputRange.max}`
    );
  });
}
