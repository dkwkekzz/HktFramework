// Phase 9 완료 조건 측정 (design/impl/Phase-9.md §9.4)
//
// ① §3 정적 파이프라인(모듈 1~6)이 전부 처리 보고를 남기고, 플레이(모듈 7)가 4단계 스냅샷을
//    **그대로**(상태 해시 동일) 불러오는가. 변조 패키지는 사유를 말하며 거부되는가.
// ② player_move 가 결정론적인가(같은 명령 시퀀스 → 같은 상태 해시), 목표가 지역 경계로 잘리는가.
// ③ 달리기 규약 — 한 tick 이동 거리 ≤ PLAYER_MOVE_SPEED, 이동 수락이 진행 중 행동을 취소하는가.
// ④ 지역 이동 규약 — §13 연결로 건너 도착하며 entity_entered 가 발화하는가, 무의미한 이동은 거부되는가.
import { buildPlayerWorld } from "../../content/player-world";
import { hashValue } from "../../shared/hash";
import { distance3d } from "../../shared/state";
import type { WorldPackageStageBadge } from "../../shared/protocol";
import { playerActionOptions, executePlayerAction, playerStateOf } from "../agents/PlayerAgent";
import { PLAYER_MOVE_SPEED, requestPlayerMove, requestPlayerTravel } from "../agents/PlayerMovement";
import type { WorldRuntime } from "../world/WorldRuntime";
import { InlineHost } from "./InlineHost";
import { buildWorldPackage } from "./WorldPackager";

const PLAYER = "agent.kael";

function runtimeOf(host: InlineHost): WorldRuntime {
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");
  return runtime;
}

// --- ① §3 정적 파이프라인 + 그대로 로드 -----------------------------------------------

export interface PackagePipelineReport {
  stages: WorldPackageStageBadge[];
  allStagesOk: boolean;
  bakedHash: string;
  loadedHash: string;
  loadedAsIs: boolean;
  entityCount: number;
  tick: number;
  tamperRejected: boolean;
  tamperMessage: string;
  /** 모듈별 실질 처리의 증거 — 단계마다 입력→출력 기록이 실제로 남았는가 */
  allStagesHaveDetails: boolean;
  /** 3단계 details 에 실린 §34 검사기 개별 판정 줄 수 (스키마 층 + 의미 19종 + 로드 계약 ≥ 21) */
  validatorLineCount: number;
  /** 6단계가 실제 해석기 문장을 남겼는가 — ID 가 아니라 사람이 읽는 「제목」—요약 */
  interpreterSentences: string[];
  interpreterIsProse: boolean;
  /** 2단계가 컴파일 실행 기록 또는 우회 사실을 명시했는가 */
  compileProvenanceStated: boolean;
}

export async function measurePackagePipeline(worldSeed: number): Promise<PackagePipelineReport> {
  const build = buildWorldPackage(buildPlayerWorld(worldSeed));
  const validateStage = build.stages.find((stage) => stage.id === "3.validate");
  const interpretStage = build.stages.find((stage) => stage.id === "6.interpret");
  const compileStage = build.stages.find((stage) => stage.id === "2.compile");
  const substance = {
    allStagesHaveDetails: build.stages.length > 0 && build.stages.every((stage) => stage.details.length > 0),
    validatorLineCount: (validateStage?.details ?? []).filter((line) => line.startsWith("✓") || line.startsWith("✗")).length,
    interpreterSentences: interpretStage?.details ?? [],
    // 실제 해석기 문장인가 — 「제목」—요약 꼴이고 공백을 가진 산문이다 (요약기의 ID 형 제목이 아니다)
    interpreterIsProse:
      (interpretStage?.details ?? []).length > 0 &&
      (interpretStage?.details ?? []).every((line) => line.startsWith("「") && line.includes(" ")),
    compileProvenanceStated:
      compileStage !== undefined &&
      (compileStage.evidence.includes("컴파일 우회") || compileStage.evidence.includes("실행 기록 동봉")),
  };
  if (build.document === undefined) {
    return {
      stages: build.stages,
      allStagesOk: false,
      bakedHash: "",
      loadedHash: "",
      loadedAsIs: false,
      entityCount: 0,
      tick: -1,
      tamperRejected: false,
      tamperMessage: "패키지가 만들어지지 않음",
      ...substance,
    };
  }

  // 모듈 7 — 패키지에서 로드. 배치를 다시 하지 않으므로 상태 해시가 4단계 산출물과 같아야 한다
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed, package: JSON.stringify(build.document) });
  const runtime = runtimeOf(host);
  const bakedHash = hashValue(build.document.bootstrapSnapshot.state);
  const loadedHash = hashValue(runtime.state);

  // 변조 패키지 — 형식이 다르면 사유를 말하며 거부한다
  const tampered = await new InlineHost().request({
    type: "initialize_world",
    worldSeed,
    package: JSON.stringify({ format: "nope" }),
  });
  const error = tampered.find((response) => response.type === "error");
  const tamperMessage = error?.type === "error" ? error.message : "";

  return {
    stages: build.stages,
    allStagesOk: build.stages.length === 6 && build.stages.every((stage) => stage.ok),
    bakedHash,
    loadedHash,
    loadedAsIs: bakedHash === loadedHash,
    entityCount: Object.keys(runtime.state.entities).length,
    tick: runtime.state.simulationTime,
    tamperRejected: error !== undefined && tamperMessage.includes("형식"),
    tamperMessage,
    ...substance,
  };
}

// --- ② 이동 결정론 + 경계 클램프 -------------------------------------------------------

export interface MovementDeterminismReport {
  firstHash: string;
  secondHash: string;
  deterministic: boolean;
  clampedTarget: { x: number; y: number } | undefined;
  clampedInsideBounds: boolean;
  regionBounds: { width: number; height: number };
}

async function runMoveSequence(worldSeed: number): Promise<{ host: InlineHost; hash: string }> {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed, world: "player" });
  await host.request({ type: "attach_player", agentId: PLAYER });
  await host.request({ type: "player_move", x: 60, y: 60 });
  await host.request({ type: "advance_time", amount: 5 });
  await host.request({ type: "player_move", x: 20, y: 30 });
  await host.request({ type: "advance_time", amount: 10 });
  return { host, hash: hashValue(runtimeOf(host).state) };
}

export async function measureMovementDeterminism(worldSeed: number): Promise<MovementDeterminismReport> {
  const first = await runMoveSequence(worldSeed);
  const second = await runMoveSequence(worldSeed);

  // 경계 클램프 — 지역 밖 목표는 지역 크기로 잘린다
  const runtime = runtimeOf(first.host);
  requestPlayerMove(runtime, 10_000, 10_000);
  const player = playerStateOf(runtime, PLAYER);
  const target = player?.moveTarget;
  const region = runtime.index.regions.get(target?.regionId ?? "");
  const bounds = { width: region?.bounds.width ?? 0, height: region?.bounds.height ?? 0 };
  return {
    firstHash: first.hash,
    secondHash: second.hash,
    deterministic: first.hash === second.hash,
    clampedTarget: target === undefined ? undefined : { x: target.x, y: target.y },
    clampedInsideBounds:
      target !== undefined && target.x <= bounds.width && target.y <= bounds.height && target.x >= 0 && target.y >= 0,
    regionBounds: bounds,
  };
}

// --- ③ 달리기 규약 ---------------------------------------------------------------------

export interface RunSpeedReport {
  stepDistance: number;
  speedRespected: boolean;
  arrived: boolean;
  arrivalDistance: number;
  actionBeforeMove: string;
  actionCancelledByMove: boolean;
}

export async function measureRunContract(worldSeed: number): Promise<RunSpeedReport> {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed, world: "player" });
  await host.request({ type: "attach_player", agentId: PLAYER });
  const runtime = runtimeOf(host);

  const before = { ...runtime.store.entity(PLAYER).position! };
  await host.request({ type: "player_move", x: before.x + 50, y: before.y });
  await host.request({ type: "advance_time", amount: 1 });
  const after = { ...runtime.store.entity(PLAYER).position! };
  const stepDistance = distance3d(before, after);

  // 도달 — 남은 거리만큼 충분히 진행하면 목표점에 선다
  await host.request({ type: "advance_time", amount: 60 });
  const settled = { ...runtime.store.entity(PLAYER).position! };
  const arrivalDistance = Math.hypot(settled.x - (before.x + 50), settled.y - before.y);

  // 행동 취소 — 행동을 시작해 두고 이동하면 §31 취소 경로를 탄다 (MMORPG "움직이면 시전 취소")
  const option = playerActionOptions(runtime, PLAYER)[0];
  let actionBeforeMove = "";
  let actionCancelledByMove = false;
  if (option !== undefined) {
    executePlayerAction(runtime, { actionId: option.actionId, targetIds: option.targetIds });
    const player = playerStateOf(runtime, PLAYER);
    actionBeforeMove = player?.currentAction?.actionId ?? "";
    requestPlayerMove(runtime, settled.x + 5, settled.y);
    actionCancelledByMove = actionBeforeMove.length > 0 && player?.currentAction === null;
  }

  return {
    stepDistance,
    speedRespected: stepDistance <= PLAYER_MOVE_SPEED + 1e-9,
    arrived: arrivalDistance < 1e-6,
    arrivalDistance,
    actionBeforeMove,
    actionCancelledByMove,
  };
}

// --- ④ 지역 이동 규약 ------------------------------------------------------------------

export interface TravelReport {
  accepted: boolean;
  fromRegion: string;
  travelTicks: number;
  arrivedRegion: string;
  arrivedOnSchedule: boolean;
  enteredRuleFired: boolean;
  sameRegionRejected: string;
  unknownRegionRejected: string;
}

export async function measureTravelContract(worldSeed: number): Promise<TravelReport> {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed, world: "player" });
  await host.request({ type: "attach_player", agentId: PLAYER });
  const runtime = runtimeOf(host);
  const fromRegion = runtime.store.entity(PLAYER).position?.regionId ?? "";

  const outcome = requestPlayerTravel(runtime, "region.silent_forest");
  const player = playerStateOf(runtime, PLAYER);
  const travelTicks = (player?.travel?.arrivesAt ?? runtime.state.simulationTime) - runtime.state.simulationTime;
  await host.request({ type: "advance_time", amount: Math.max(1, travelTicks) });
  const arrivedRegion = runtime.store.entity(PLAYER).position?.regionId ?? "";
  const enteredRuleFired = runtime.state.changeLog.some(
    (change) => change.tags.includes("player_travel") && change.sourceId === PLAYER,
  );

  const sameRegion = requestPlayerTravel(runtime, arrivedRegion);
  const unknown = requestPlayerTravel(runtime, "region.nowhere");

  return {
    accepted: outcome.accepted,
    fromRegion,
    travelTicks,
    arrivedRegion,
    arrivedOnSchedule: arrivedRegion === "region.silent_forest",
    enteredRuleFired,
    sameRegionRejected: sameRegion.accepted ? "" : (sameRegion.reason ?? "거부"),
    unknownRegionRejected: unknown.accepted ? "" : (unknown.reason ?? "거부"),
  };
}
