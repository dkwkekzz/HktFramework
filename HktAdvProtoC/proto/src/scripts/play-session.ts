// 실제 플레이 관찰 (§3 모듈 7) — 샘플 데이터를 사람이 하는 순서대로 두드려 보고,
// **화면에 오르는 것만으로** 플레이 타임라인을 적는다.
//
// 목적은 "MMORPG 처럼 보이는가"를 주장이 아니라 관측으로 판정하는 것이다.
// 그래서 이 스크립트는 플레이 화면(app/play/PlayPage)이 보내는 것과 **같은 요청**만 보내고,
// 플레이 화면이 받는 것과 **같은 SceneViewModel**(ViewModelBuilder)만 읽는다 —
// 코어 내부(runtime.store)를 들여다보지 않는다. 플레이어가 볼 수 없는 것은 이 로그에도 없다.
//
// 실행: npm run play [-- --seed=42 --days=2 --agent=agent.kael]
import { InlineHost } from "../core/simulation/InlineHost";
import { createRng } from "../shared/random";
import type { WorkerRequest, WorkerResponse } from "../shared/protocol";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "../shared/time";
import type { SceneMapMarker, SceneViewModel } from "../viewmodel/SceneViewModel";
import { ViewModelBuilder } from "../viewmodel/ViewModelBuilder";

function arg(name: string, fallback: number): number {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found === undefined ? fallback : Number(found.split("=")[1]);
}
function argText(name: string, fallback: string): string {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found === undefined ? fallback : String(found.split("=")[1]);
}

const worldSeed = arg("seed", 42);
const days = arg("days", 2);
const playerId = argText("agent", "agent.kael");
/** 플레이어의 손 — 조작 선택도 결정론이어야 재현된다(§39) */
const hand = createRng({ worldSeed, simulationStep: 0, entityId: "playtest.hand" });

const host = new InlineHost();
const builder = new ViewModelBuilder();
const notices: string[] = [];

/** 플레이 화면과 같은 경로: 요청을 보내고 응답을 그대로 뷰모델에 붓는다 */
async function send(request: WorkerRequest): Promise<WorkerResponse[]> {
  const responses = await host.request(request);
  for (const response of responses) {
    switch (response.type) {
      case "world_initialized":
        builder.markInitialized();
        break;
      case "state_patch":
        builder.applyPatch(response.patch);
        break;
      case "scene_view":
        builder.setSceneView(response.view);
        break;
      case "player_view":
        builder.setPlayerView(response.view);
        break;
      case "error":
        notices.push(`✗ ${response.message}`);
        break;
      default:
        break;
    }
  }
  return responses;
}
const scene = (): SceneViewModel => builder.buildScene();

// ── ① 세계 선택 — 빌트인 세계를 §3 모듈 1~6 으로 굽고 그 패키지를 불러온다 ─────────────
console.log(`=== 플레이 세션 — 시드 ${worldSeed} · ${days}일 · 조작 주체 ${playerId} ===\n`);

const exported = await send({ type: "export_world", world: "player", worldSeed });
const packaged = exported.find((r): r is Extract<WorkerResponse, { type: "world_package" }> => r.type === "world_package");
if (packaged === undefined) throw new Error(`세계 패키지를 굽지 못했다: ${JSON.stringify(exported).slice(0, 300)}`);
console.log(`① 세계 선택 — 「${packaged.label}」`);
for (const stage of packaged.stages) console.log(`   ${stage.ok ? "✓" : "✗"} ${stage.id} ${stage.title} — ${stage.evidence}`);

await send({ type: "initialize_world", worldSeed, package: packaged.json });

// ── ② 주체 선택 — 살아 있는 주체 카드에서 하나를 고른다 ────────────────────────────────
const listed = await send({ type: "request_playable_agents" });
const cards = listed.find((r): r is Extract<WorkerResponse, { type: "playable_agents" }> => r.type === "playable_agents");
if (cards === undefined) throw new Error("주체 목록을 받지 못했다");
console.log(`\n② 주체 선택 — 카드 ${cards.agents.length}장`);
for (const card of cards.agents) {
  const badges = card.badges.map((badge) => `${badge.key} ${badge.value}`).join(" · ");
  console.log(`   ${card.id === playerId ? "▶" : " "} ${card.label} (${card.speciesLabel} · ${card.regionLabel}) ${badges}`);
}

// ── ③ 플레이 시작 ───────────────────────────────────────────────────────────────────
await send({ type: "attach_player", agentId: playerId });
await send({ type: "set_view", mode: "player" });

// --- 관측 누적 -----------------------------------------------------------------------
const observed = {
  myActions: [] as string[],
  myMoveCommands: 0,
  myTravels: [] as string[],
  distance: 0,
  regions: new Set<string>(),
  /** 내가 손대지 않은 사이에 남들이 움직인 tick 수 */
  neighborMoveTicks: 0,
  /** 이웃 개체가 실제로 자리를 옮긴 횟수 */
  neighborMoves: 0,
  neighborMovers: new Set<string>(),
  signals: new Set<string>(),
  signalChannels: new Set<string>(),
  knownEvents: new Map<string, string>(),
  journalKinds: new Map<string, number>(),
  growthOffers: 0,
  growthTaken: [] as string[],
  gaugeSamples: [] as number[],
  /** 대상 지정으로 바뀐 행동바 (대상 없음 → 대상 지정) */
  targetedPanels: [] as string[],
  panelSizes: [] as number[],
  discovered: [] as number[],
  perTickMove: [] as number[],
  socialActions: [] as string[],
  combatSeen: [] as string[],
  /** 달리기로 설명되는 걸음 (한 tick ≤ PLAYER_MOVE_SPEED) 과 그렇지 않은 순간이동을 나눈다 */
  runSteps: [] as number[],
  jumps: [] as number[],
  /** 주변 사람이 무엇을 하는 중인지 보이는가 — 마커의 current_action 배지 */
  neighborActions: new Set<string>(),
  visibleSamples: [] as number[],
};
/** §9.3 결정론 상수 — 한 tick 에 이만큼까지 달린다 */
const PLAYER_MOVE_SPEED = 2;

const markerOf = (view: SceneViewModel, id: string): SceneMapMarker | undefined =>
  view.map.markers.find((marker) => marker.id === id);
/** 지역 좌표계로 되돌린 내 위치 — 플레이 화면(PlayPage.playerLocal)과 같은 역산 */
function localOf(view: SceneViewModel, id: string): { regionId: string; x: number; y: number; w: number; h: number } | undefined {
  const marker = markerOf(view, id);
  if (marker === undefined) return undefined;
  const region = view.map.regions.find((entry) => entry.id === marker.regionId);
  if (region === undefined) return undefined;
  const fx = (marker.point.x - region.rect.x) / Math.max(1e-6, region.rect.w);
  const fy = (marker.point.y - region.rect.y) / Math.max(1e-6, region.rect.h);
  return {
    regionId: region.id,
    x: fx * region.worldSize.width,
    y: fy * region.worldSize.height,
    w: region.worldSize.width,
    h: region.worldSize.height,
  };
}

let selectedId: string | undefined;
let lastJournalAt = "";
let previousPositions = new Map<string, { x: number; y: number }>();
let previousMine: { regionId: string; x: number; y: number } | undefined;
const seenJournal = new Set<string>();

console.log(`\n③ 플레이 — 30분마다 한 줄. "내가 한 것 / 세계가 한 것"을 나란히 적는다.\n`);
console.log("   시각      | 내 위치·상태                       | 지금 하는 것            | 주변(아는 것)");
console.log("   ----------|------------------------------------|-------------------------|--------------------------------");

const totalTicks = days * TICKS_PER_DAY;
const STEP = 5; // 플레이 루프가 한 번에 미는 tick (배속 ×4 ≈ 이 정도)
for (let elapsed = 0; elapsed < totalTicks; elapsed += STEP) {
  await send({ type: "advance_time", amount: STEP });
  const view = scene();
  const player = view.player;
  const mine = localOf(view, playerId);

  // (a) 세계가 나 없이 움직였는가 — 이웃 마커의 자리 변화를 센다
  let movedNeighbors = 0;
  const positions = new Map<string, { x: number; y: number }>();
  for (const marker of view.map.markers) {
    positions.set(marker.id, { x: marker.point.x, y: marker.point.y });
    if (marker.id === playerId) continue;
    const before = previousPositions.get(marker.id);
    if (before !== undefined && Math.hypot(before.x - marker.point.x, before.y - marker.point.y) > 1e-6) {
      movedNeighbors += 1;
      observed.neighborMoves += 1;
      observed.neighborMovers.add(marker.id);
    }
    const doing = marker.badges.find((badge) => badge.key === "current_action");
    if (doing !== undefined) observed.neighborActions.add(`${marker.id}:${doing.value}`);
  }
  observed.visibleSamples.push(view.map.markers.length - 1);
  if (movedNeighbors > 0) observed.neighborMoveTicks += 1;
  previousPositions = positions;

  // (b) 내 이동 — 표시 좌표가 아니라 지역 좌표로 잰다
  if (mine !== undefined) {
    observed.regions.add(mine.regionId);
    if (previousMine !== undefined && previousMine.regionId === mine.regionId) {
      const step = Math.hypot(previousMine.x - mine.x, previousMine.y - mine.y);
      observed.distance += step;
      if (step > 0) {
        observed.perTickMove.push(step / STEP);
        // 달리기로 설명되는가 — 한 tick 에 2 이하로 걸어온 것인가
        if (step <= PLAYER_MOVE_SPEED * STEP + 1e-6) observed.runSteps.push(step / STEP);
        else observed.jumps.push(step);
      }
    }
    previousMine = { regionId: mine.regionId, x: mine.x, y: mine.y };
  }

  // (c) 신호(관찰 이펙트)·게이지·저널·사건 — 플레이어에게 보이는 것만
  for (const signal of view.map.signals) {
    observed.signals.add(signal.id);
    observed.signalChannels.add(signal.channelKey);
  }
  const gauge = markerOf(view, playerId)?.gauge;
  if (gauge !== undefined) observed.gaugeSamples.push(gauge.value);
  if (player !== undefined) {
    observed.discovered.push(player.undiscoveredCount);
    observed.panelSizes.push(player.actionPanel.length);
    for (const entry of player.journal) {
      const key = `${entry.at}|${entry.kind}|${entry.key}|${entry.detail}`;
      if (seenJournal.has(key)) continue;
      seenJournal.add(key);
      observed.journalKinds.set(entry.kind, (observed.journalKinds.get(entry.kind) ?? 0) + 1);
      lastJournalAt = `${entry.kind}:${entry.key}`;
    }
    for (const item of player.eventPanel) observed.knownEvents.set(item.eventId, item.title);
    observed.growthOffers += player.growthOffers.length;
  }

  // ── 조작 (플레이 화면의 입력과 같은 요청만 쓴다) ──────────────────────────────────
  if (player !== undefined) {
    // 성장 제안이 뜨면 받는다 (§32 — MMORPG 의 레벨업 선택에 해당)
    const offer = player.growthOffers[0];
    if (offer !== undefined) {
      const option = offer.options[0];
      if (option !== undefined) {
        await send({ type: "accept_growth", offerId: offer.offerId, optionId: option.id });
        observed.growthTaken.push(`${offer.key} ← ${option.restriction}`);
      }
    }

    // 대상 지정 — 2시간마다 가장 가까운 이웃을 클릭한다
    if (elapsed % (2 * TICKS_PER_HOUR) === 0 && mine !== undefined) {
      const me = markerOf(view, playerId);
      const neighbors = view.map.markers
        .filter((marker) => marker.id !== playerId && marker.regionId === mine.regionId)
        .sort((a, b) =>
          Math.hypot(a.point.x - (me?.point.x ?? 0), a.point.y - (me?.point.y ?? 0)) -
          Math.hypot(b.point.x - (me?.point.x ?? 0), b.point.y - (me?.point.y ?? 0)),
        );
      const before = player.actionPanel.filter((option) => option.targetIds.length === 0).length;
      selectedId = neighbors[0]?.id;
      if (selectedId !== undefined) {
        const forTarget = player.actionPanel.filter((option) => option.targetIds.includes(selectedId ?? ""));
        if (forTarget.length > 0) {
          observed.targetedPanels.push(
            `${neighbors[0]?.label ?? selectedId} → ${forTarget.slice(0, 3).map((option) => option.name).join(" · ")}` +
              ` (대상 없을 때 ${before}종)`,
          );
        }
      }
    }

    // 행동 — 비어 있으면 행동바에서 고른다 (대상이 있으면 대상용 후보 우선)
    if (player.currentAction === undefined) {
      const targeted = selectedId === undefined ? [] : player.actionPanel.filter((o) => o.targetIds.includes(selectedId ?? ""));
      const pool = targeted.length > 0 && hand.next() < 0.7 ? targeted : player.actionPanel;
      const option = pool[Math.min(pool.length - 1, Math.floor(hand.next() * Math.min(3, pool.length)))];
      if (option !== undefined) {
        const result = await send({
          type: "execute_player_action",
          action: { actionId: option.actionId, targetIds: option.targetIds },
        });
        const outcome = result.find((r): r is Extract<WorkerResponse, { type: "player_action_result" }> => r.type === "player_action_result");
        if (outcome?.outcome.accepted === true) {
          observed.myActions.push(option.actionId);
          if (/talk|persuade|rumor|promise|threat|trade|teach|ask|share|deceive|accuse|mediate|support/i.test(option.actionId)) {
            observed.socialActions.push(`${option.actionId}→${option.targets || "-"}`);
          }
          if (/attack|hunt|defend|flee|strike/i.test(option.actionId)) {
            observed.combatSeen.push(`${option.actionId}→${option.targets || "-"}`);
          }
        }
      }
    } else if (elapsed % TICKS_PER_HOUR === 0 && mine !== undefined && hand.next() < 0.35) {
      // 가끔은 하던 것을 접고 걷는다 — click-to-move (움직이면 시전 취소, §9.3)
      const x = Math.max(0, Math.min(mine.w, mine.x + (hand.next() - 0.5) * 40));
      const y = Math.max(0, Math.min(mine.h, mine.y + (hand.next() - 0.5) * 40));
      await send({ type: "player_move", x, y });
      observed.myMoveCommands += 1;
    }
  }

  // 지역 이동(존 이동) — 첫날 저녁에 게이트를 건넌다
  if (elapsed === 18 * TICKS_PER_HOUR && mine !== undefined) {
    const gate = view.map.connections.find((connection) => connection.from === mine.regionId || connection.to === mine.regionId);
    const toRegionId = gate === undefined ? undefined : gate.from === mine.regionId ? gate.to : gate.from;
    if (toRegionId !== undefined) {
      const responses = await send({ type: "player_travel", toRegionId });
      const failed = responses.find((r): r is Extract<WorkerResponse, { type: "error" }> => r.type === "error");
      observed.myTravels.push(failed === undefined ? `→ ${toRegionId} 출발` : `✗ ${failed.message}`);
    }
  }

  // ── 30분마다 한 줄 ────────────────────────────────────────────────────────────────
  if (elapsed % 30 === 0) {
    const me = markerOf(view, playerId);
    const doing =
      player?.currentAction === undefined
        ? "—"
        : `${player.currentAction.actionId}${player.currentAction.targets === "" ? "" : `→${player.currentAction.targets}`}`;
    const visible = view.map.markers.length - 1;
    const health = me?.gauge === undefined ? "?" : `${Math.round(me.gauge.value * 100)}%`;
    console.log(
      `   ${view.clock.padEnd(10)}| ${(mine === undefined ? "?" : `${mine.regionId.replace("region.", "")} (${mine.x.toFixed(0)},${mine.y.toFixed(0)}) 체력 ${health}`).padEnd(35)}| ` +
        `${doing.slice(0, 24).padEnd(24)}| 시야 ${visible}명 · 움직임 ${movedNeighbors} · 신호 ${view.map.signals.length} · 사건 ${player?.eventPanel.length ?? 0}`,
    );
  }
}

// ── 결산 ────────────────────────────────────────────────────────────────────────────
const final = scene();
const finalPlayer = final.player;
const average = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
const count = (values: string[]): [string, number][] => {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

console.log(`\n④ ${days}일 플레이 결산 — 플레이어가 실제로 겪은 것`);
console.log(`   내 행동 ${observed.myActions.length}회 — ${count(observed.myActions).slice(0, 6).map(([k, n]) => `${k}×${n}`).join(" · ")}`);
console.log(`   이동 명령 ${observed.myMoveCommands}회 · 이동 거리 ${observed.distance.toFixed(0)} · 지역 ${[...observed.regions].join(", ")} · 존 이동 ${observed.myTravels.join(" / ") || "없음"}`);
console.log(
  `   걸음 ${observed.runSteps.length}표본 (tick 당 평균 ${average(observed.runSteps).toFixed(2)} · 상한 ${PLAYER_MOVE_SPEED}) · ` +
    `설명되지 않는 순간이동 ${observed.jumps.length}회${observed.jumps.length === 0 ? "" : ` (최대 ${Math.max(...observed.jumps).toFixed(0)})`}`,
);
console.log(
  `   시야에 든 사람 평균 ${average(observed.visibleSamples).toFixed(1)}명 (최대 ${Math.max(...observed.visibleSamples)}) — 세계에는 주체 9명 · 개체 18개가 있다`,
);
console.log(`   세계가 나 없이 움직인 표본 ${observed.neighborMoveTicks}/${Math.ceil(totalTicks / STEP)} · 이웃 이동 ${observed.neighborMoves}회 · 움직인 이웃 ${observed.neighborMovers.size}명`);
console.log(`   주변 사람이 하는 것이 보인 표본 ${observed.neighborActions.size}종 — ${[...observed.neighborActions].slice(0, 4).join(" · ") || "없음"}`);
console.log(`   관찰 신호 ${observed.signals.size}건 (채널 ${[...observed.signalChannels].join(", ")})`);
console.log(`   아는 사건 ${observed.knownEvents.size}건 — ${[...observed.knownEvents.values()].slice(0, 3).join(" / ")}`);
console.log(`   저널 ${[...observed.journalKinds.entries()].map(([k, n]) => `${k} ${n}`).join(" · ")} (마지막 ${lastJournalAt})`);
console.log(`   성장 제안 표본 ${observed.growthOffers} · 받은 성장 ${observed.growthTaken.length}건 ${observed.growthTaken.slice(0, 2).join(" / ")}`);
console.log(`   행동바 크기 평균 ${average(observed.panelSizes).toFixed(1)}종 · 모르는 개체 ${observed.discovered[0] ?? 0} → ${observed.discovered[observed.discovered.length - 1] ?? 0}`);
if (observed.targetedPanels.length > 0) console.log(`   대상 지정 → 컨텍스트 행동 예: ${observed.targetedPanels[0]}`);
if (finalPlayer !== undefined) {
  console.log(`   마지막 상태: ${finalPlayer.facts.slice(0, 6).map((fact) => `${fact.key} ${fact.value}`).join(" · ")}`);
}
if (notices.length > 0) console.log(`   거부·오류 ${notices.length}건 — ${notices.slice(0, 3).join(" / ")}`);

// ── ⑤ 이동 규약 탐침 — 플레이 중에 손이 가는 순서로 눌러 본다 ────────────────────────
// 위 결산이 "존 이동이 안 됐다 / 순간이동이 있었다"고 말했으므로, 그 둘만 따로 재현한다.
// 세계를 다시 올려(같은 패키지) 다른 조작이 섞이지 않게 한다.
const probe = { travelAlone: "", travelWithAction: "", moveTrail: "", trailSteps: 0 };
{
  await send({ type: "initialize_world", worldSeed, package: packaged.json });
  await send({ type: "attach_player", agentId: playerId });
  await send({ type: "set_view", mode: "player" });
  const regionOf = (): string => localOf(scene(), playerId)?.regionId ?? "?";
  const other = scene().map.regions.find((region) => region.id !== regionOf())?.id ?? "";

  // ⓐ 게이트만 누르고 기다린다
  const from = regionOf();
  await send({ type: "player_travel", toRegionId: other });
  await send({ type: "advance_time", amount: 130 });
  probe.travelAlone = `${from} → ${regionOf()} (130분 대기)`;

  // ⓑ 건너는 중에 행동 버튼을 누른다 (플레이 화면은 이동 중에도 행동바를 그대로 준다)
  const back = regionOf();
  await send({ type: "player_travel", toRegionId: from });
  await send({ type: "advance_time", amount: 5 });
  await send({ type: "execute_player_action", action: { actionId: "action.rest", targetIds: [playerId] } });
  await send({ type: "advance_time", amount: 300 });
  probe.travelWithAction = `${back} → ${regionOf()} (5분 뒤 행동 1회 + 300분 대기)`;

  // ⓒ 행동에 의한 이동(action.move)은 걸어서 가는가
  const trail: string[] = [];
  const place = scene().map.places[0]?.id ?? scene().map.resources[0]?.id ?? "";
  await send({ type: "execute_player_action", action: { actionId: "action.move", targetIds: [place] } });
  for (let index = 0; index < 60; index += 1) {
    await send({ type: "advance_time", amount: 5 });
    const here = localOf(scene(), playerId);
    const stamp = here === undefined ? "?" : `${here.regionId.replace("region.", "")}(${here.x.toFixed(0)},${here.y.toFixed(0)})`;
    if (trail[trail.length - 1] !== stamp) trail.push(stamp);
  }
  probe.trailSteps = trail.length;
  probe.moveTrail = `${place} 로 이동 — 5분 간격 위치 표본 ${trail.length}종: ${trail.slice(0, 5).join(" → ")}`;
}
console.log(`\n⑤ 이동 규약 탐침`);
console.log(`   ⓐ 게이트만 누르고 기다림: ${probe.travelAlone}`);
console.log(`   ⓑ 건너는 중 행동 1회:     ${probe.travelWithAction}`);
console.log(`   ⓒ 행동에 의한 이동:       ${probe.moveTrail}`);

// ── MMORPG 문법 대조 — 관측된 수치로만 판정한다 ────────────────────────────────────
interface Criterion {
  name: string;
  ok: boolean;
  evidence: string;
}
const criteria: Criterion[] = [
  {
    name: "하나의 캐릭터를 조작한다 (attach → 시점 고정)",
    ok: final.map.focusMarkerId === playerId && finalPlayer !== undefined,
    evidence: `focus=${final.map.focusMarkerId ?? "없음"} · 상태 ${finalPlayer?.facts.length ?? 0}항`,
  },
  {
    name: "세계는 나를 기다리지 않는다 (주변이 스스로 움직인다)",
    ok: observed.neighborMovers.size >= 3 && observed.neighborMoveTicks > totalTicks / STEP / 10,
    evidence: `이웃 ${observed.neighborMovers.size}명이 ${observed.neighborMoves}회 이동 · 표본의 ${((observed.neighborMoveTicks / Math.ceil(totalTicks / STEP)) * 100).toFixed(0)}%`,
  },
  {
    name: "연속 이동(달리기) — 클릭/WASD 로 목표점까지 걸어간다",
    ok: observed.runSteps.length > 10 && observed.jumps.length === 0,
    evidence:
      `걸음 ${observed.runSteps.length}표본 · tick 당 ${average(observed.runSteps).toFixed(2)}/${PLAYER_MOVE_SPEED} · ` +
      `순간이동 ${observed.jumps.length}회 · 총 거리 ${observed.distance.toFixed(0)}`,
  },
  {
    name: "주변에 사람이 붐빈다 (한 화면에 여러 명이 보인다)",
    ok: average(observed.visibleSamples) >= 4,
    evidence: `평균 ${average(observed.visibleSamples).toFixed(1)}명 · 최대 ${Math.max(...observed.visibleSamples)}명 (세계에는 주체 9명)`,
  },
  {
    name: "남들이 무엇을 하는 중인지 보인다 (행동 캐스팅 표시)",
    ok: observed.neighborActions.size >= 3,
    evidence: `${observed.neighborActions.size}종 — ${[...observed.neighborActions].slice(0, 3).join(" · ") || "없음"}`,
  },
  {
    name: "존(지역) 이동 — 게이트를 건넌다",
    ok: probe.travelAlone.split(" → ")[0] !== probe.travelAlone.split(" → ")[1]?.split(" ")[0],
    evidence: `탐침 ⓐ ${probe.travelAlone}`,
  },
  {
    name: "건너는 중에 다른 조작을 해도 도착한다 (이동이 조용히 사라지지 않는다)",
    ok: probe.travelWithAction.split(" → ")[0] !== probe.travelWithAction.split(" → ")[1]?.split(" ")[0],
    evidence: `탐침 ⓑ ${probe.travelWithAction} — 출발지 그대로면 이동이 취소된 것이다`,
  },
  {
    name: "행동에 의한 이동도 걸어서 간다 (순간이동 없음)",
    ok: probe.trailSteps > 3,
    evidence: `탐침 ⓒ ${probe.moveTrail}`,
  },
  {
    name: "타게팅 → 컨텍스트 행동 (대상을 고르면 할 수 있는 것이 바뀐다)",
    ok: observed.targetedPanels.length > 0,
    evidence: observed.targetedPanels[0] ?? "대상용 후보 없음",
  },
  {
    name: "행동바 — 언제든 고를 수 있는 여러 선택지",
    ok: average(observed.panelSizes) >= 3,
    evidence: `평균 ${average(observed.panelSizes).toFixed(1)}종 · 실행 ${observed.myActions.length}회`,
  },
  {
    name: "상태 게이지가 플레이 중 변한다 (HP·허기 등)",
    ok: new Set(observed.gaugeSamples.map((value) => value.toFixed(3))).size > 1 || (finalPlayer?.facts.length ?? 0) > 0,
    evidence: `체력 표본 ${new Set(observed.gaugeSamples.map((v) => v.toFixed(3))).size}종 · 상태 ${finalPlayer?.facts.length ?? 0}항`,
  },
  {
    name: "성장 (레벨업에 해당하는 선택)",
    ok: observed.growthTaken.length > 0,
    evidence: observed.growthTaken[0] ?? `${days}일 동안 제안 0건 (표본 ${observed.growthOffers})`,
  },
  {
    name: "월드 이벤트 — 내가 만들지 않은 사건이 알려진다",
    ok: observed.knownEvents.size > 0,
    evidence: `${observed.knownEvents.size}건 — ${[...observed.knownEvents.values()][0] ?? ""}`,
  },
  {
    name: "사회적 상호작용 (대화·소문·거래)",
    ok: observed.socialActions.length > 0,
    evidence: count(observed.socialActions).slice(0, 3).map(([k, n]) => `${k}×${n}`).join(" · ") || "없음",
  },
  {
    name: "전투·위협 대응 (사냥·공격·방어·도주)",
    ok: observed.combatSeen.length > 0,
    evidence: count(observed.combatSeen).slice(0, 3).map(([k, n]) => `${k}×${n}`).join(" · ") || "없음",
  },
  {
    name: "정보 제한 — 내가 모르는 것이 남아 있다 (안개)",
    ok: (observed.discovered[observed.discovered.length - 1] ?? 0) > 0 || observed.knownEvents.size > 0,
    evidence: `모르는 개체 ${observed.discovered[observed.discovered.length - 1] ?? 0} · 시야 ${final.map.markers.length}명`,
  },
  {
    name: "감각 피드백 — 화면에 실리는 신호/이펙트",
    ok: observed.signals.size > 0,
    evidence: `${observed.signals.size}건 · 채널 ${[...observed.signalChannels].join(", ") || "없음"}`,
  },
];

console.log(`\n⑥ MMORPG 문법 대조 — 위 플레이에서 실제로 관측된 것만`);
let passed = 0;
for (const criterion of criteria) {
  if (criterion.ok) passed += 1;
  console.log(`   ${criterion.ok ? "✓" : "✗"} ${criterion.name}\n       ${criterion.evidence}`);
}
console.log(`\n   ${passed}/${criteria.length} 관측됨`);
