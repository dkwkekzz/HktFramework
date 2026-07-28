// 최소 셸 페이지 (Phase 0 스텝 9 → Phase 1 스텝 7 확장)
// SceneViewModel 만 소비한다 — tick 숫자 하나도, 개체 상태 하나도 코어에서 직접 읽지 않는다 (분해 원칙 5).
import { FIRST_WORLD_CORPUS, FIRST_WORLD_ID, FIRST_WORLD_SEED_INPUT } from "../content/first-world";
import { DEFAULT_PLAYER_AGENT_ID, buildPlayerWorld } from "../content/player-world";
import { compileWorld } from "../generation/CompilerPipeline";
import { PROTOTYPE_SCALE } from "../generation/GenerationTypes";
import { RecordedTextGenerationPort } from "../generation/RecordedTextGenerationPort";
import type { SimulationHost, WorkerResponse } from "../shared/protocol";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "../shared/time";
import {
  buildGenerationView,
  createEmptyGenerationView,
  type GenerationViewModel,
} from "../viewmodel/GenerationViewModel";
import { ViewModelBuilder } from "../viewmodel/ViewModelBuilder";
import type { SceneEntity, SceneViewModel } from "../viewmodel/SceneViewModel";
import { WorkerHost } from "./WorkerHost";

const host: SimulationHost = new WorkerHost();
const builder = new ViewModelBuilder();

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`요소 없음: ${id}`);
  return node as T;
}

const seedInput = el<HTMLInputElement>("seed");
const initButton = el<HTMLButtonElement>("init");
const initPlayerButton = el<HTMLButtonElement>("init-player");
const hourButton = el<HTMLButtonElement>("advance-hour");
const dayButton = el<HTMLButtonElement>("advance-day");
const weekButton = el<HTMLButtonElement>("advance-week");
const statusView = el<HTMLElement>("status");
const worldView = el<HTMLElement>("world");
const playerAgentInput = el<HTMLInputElement>("player-agent");
const attachButton = el<HTMLButtonElement>("attach");
const detachButton = el<HTMLButtonElement>("detach");
const playerView = el<HTMLElement>("player");
const themesInput = el<HTMLTextAreaElement>("themes");
const experiencesInput = el<HTMLTextAreaElement>("experiences");
const prohibitedInput = el<HTMLTextAreaElement>("prohibited");
const genSeedInput = el<HTMLInputElement>("gen-seed");
const generateButton = el<HTMLButtonElement>("generate");
const useGeneratedButton = el<HTMLButtonElement>("use-generated");
const generationView = el<HTMLElement>("generation");

function renderEntity(entity: SceneEntity): string {
  const place =
    entity.position === undefined
      ? ""
      : ` @${entity.position.x.toFixed(0)},${entity.position.y.toFixed(0)}` +
        (entity.elevation === undefined ? "" : `,${entity.elevation.toFixed(0)}`);
  const goal =
    entity.topGoal === undefined ? "" : ` → ${entity.topGoal.id}(${entity.topGoal.activation})`;
  const badges = entity.stateBadges.map((badge) => `${badge.key}=${badge.value}`).join(" ");
  return `[${entity.kind}] ${entity.label}${place}${goal}\n    ${badges}`;
}

function render(scene: SceneViewModel): void {
  // 렌더는 ViewModel 속성 그대로 — 해석 없음
  const running = scene.initialized;
  hourButton.disabled = !running;
  dayButton.disabled = !running;
  weekButton.disabled = !running;
  attachButton.disabled = !running || scene.player !== undefined;
  detachButton.disabled = !running || scene.player === undefined;
  if (!running) {
    statusView.textContent = "세계 없음 — 시드를 입력하고 생성하세요.";
    worldView.textContent = "";
    return;
  }

  const globals = scene.globalBadges.map((badge) => `${badge.key}=${badge.value}`).join(", ");
  statusView.textContent = [
    `${scene.day}일차 ${String(Math.floor(scene.minuteOfDay / 60)).padStart(2, "0")}:${String(scene.minuteOfDay % 60).padStart(2, "0")} (tick ${scene.time})`,
    `개체 ${scene.entities.length}개`,
    globals.length > 0 ? `세계 상태: ${globals}` : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  // 지역별로 묶어 보여준다 — 묶음 키도 ViewModel 의 속성(regionId)이다
  const groups = new Map<string, SceneEntity[]>();
  for (const entity of scene.entities) {
    const key = entity.position?.regionId ?? "(위치 없음)";
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [entity]);
    else list.push(entity);
  }
  worldView.textContent = [...groups.entries()]
    .map(([regionId, entities]) => `# ${regionId}\n${entities.map(renderEntity).join("\n")}`)
    .join("\n\n");
}

function applyResponses(responses: WorkerResponse[]): void {
  let message = "";
  for (const response of responses) {
    switch (response.type) {
      case "world_initialized":
        builder.markInitialized();
        break;
      case "state_patch":
        builder.applyPatch(response.patch);
        break;
      case "player_view":
        builder.setPlayerView(response.view);
        break;
      case "player_action_result":
        message = response.outcome.accepted
          ? `${response.outcome.actionId} 시작 (완료 ${response.outcome.completesAt})`
          : `거절 — ${response.outcome.reason ?? ""}`;
        break;
      case "error":
        statusView.textContent = `오류: ${response.message}`;
        return;
      default:
        break;
    }
  }
  const scene = builder.buildScene();
  render(scene);
  renderPlayer(scene, message);
}

initButton.addEventListener("click", () => {
  const worldSeed = Number(seedInput.value) || 0;
  builder.setPlayerView(undefined);
  void host.request({ type: "initialize_world", worldSeed }).then(applyResponses);
});

// Phase 7 층을 얹은 세계 — 수동 세계 + §30 참여 방식 행동 + §32 성장 규칙
initPlayerButton.addEventListener("click", () => {
  const worldSeed = Number(seedInput.value) || 0;
  builder.setPlayerView(undefined);
  playerAgentInput.value = DEFAULT_PLAYER_AGENT_ID;
  void host
    .request({ type: "initialize_world", worldSeed, definition: buildPlayerWorld(worldSeed) })
    .then(applyResponses);
});

function advance(amount: number): void {
  void host.request({ type: "advance_time", amount }).then(applyResponses);
}

hourButton.addEventListener("click", () => advance(TICKS_PER_HOUR));
dayButton.addEventListener("click", () => advance(TICKS_PER_DAY));
weekButton.addEventListener("click", () => advance(7 * TICKS_PER_DAY));

// --- 플레이어 패널 (§31, §30) ---------------------------------------------------------
// 여기에는 "무엇을 숨길까"의 판단이 한 줄도 없다 — 코어의 지식 필터를 통과한 것만 도착하기 때문이다.

function escapeText(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}

function renderPlayer(scene: SceneViewModel, message: string): void {
  const panel = scene.player;
  if (panel === undefined) {
    playerView.innerHTML = scene.initialized
      ? "조작 중인 주체가 없다 — 세계는 그대로 흐른다(§44-5). 위에서 주체를 지정해 개입할 수 있다."
      : "";
    return;
  }

  const facts = panel.facts.map((badge) => `${badge.key}=${badge.value}`).join(" ");
  const goals = panel.goals.map((goal) => `${goal.id}(${goal.activation})`).join(" · ");
  const doing =
    panel.currentAction === undefined
      ? "지금은 아무것도 하지 않는다"
      : `${panel.currentAction.actionId} ${panel.currentAction.targets} (완료 ${panel.currentAction.completesAt})`;

  const actions = panel.actionPanel
    .map(
      (option, index) =>
        `<div><button data-action="${index}">${escapeText(option.name)}</button> ` +
        `${escapeText(option.targets)} — ${escapeText(option.goalId)} · 점수 ${option.score} · ${option.duration} · 위험 ${option.risk}` +
        `${option.approachFor === undefined ? "" : ` (먼저 다가간다 → ${escapeText(option.approachFor)})`}</div>`,
    )
    .join("");

  const events = panel.eventPanel
    .map(
      (item) =>
        `<div>· ${escapeText(item.title)} [${escapeText(item.type)}] 시급도 ${item.urgency}\n` +
        `    아는 참여자 ${escapeText(item.knownParticipants.join(", ")) || "없음"} / 모르는 참여자 ${item.unknownParticipantCount}명\n` +
        `    아는 사실 ${escapeText(item.knownFacts.join(" | ")) || "없음"}\n` +
        `    개입 가능 ${escapeText(item.interactions.join(" "))}</div>`,
    )
    .join("");

  const offers = panel.growthOffers
    .map(
      (offer, offerIndex) =>
        `<div>성장 선택 — ${escapeText(offer.key)}\n` +
        offer.options
          .map(
            (option, optionIndex) =>
              `    <button data-offer="${offerIndex}" data-option="${optionIndex}">${escapeText(option.restriction)}</button> ` +
              `(부담 ${option.severity} → ${escapeText(option.grants)})`,
          )
          .join("\n") +
        `</div>`,
    )
    .join("");

  const journal = panel.journal
    .slice(-40)
    .reverse()
    .map((entry) => `${entry.at} [${entry.kind}] ${escapeText(entry.key)} ${escapeText(entry.detail)}`)
    .join("\n");

  playerView.innerHTML =
    `<b>${escapeText(panel.label)}</b> (${escapeText(panel.playerId)}) — ${escapeText(doing)}\n` +
    `${escapeText(facts)}\n목적: ${escapeText(goals)}\n아직 모르는 개체 ${panel.undiscoveredCount}\n` +
    (message.length === 0 ? "" : `<b>${escapeText(message)}</b>\n`) +
    `<hr /><b>지금 할 수 있는 것 (${panel.actionPanel.length})</b>${actions}` +
    (offers.length === 0 ? "" : `<hr /><b>성장 (§32)</b>${offers}`) +
    (panel.growthLog.length === 0
      ? ""
      : `<details><summary>성장 기록 ${panel.growthLog.length}건</summary><pre>${escapeText(panel.growthLog.join("\n"))}</pre></details>`) +
    `<hr /><b>아는 사건 (${panel.eventPanel.length})</b>${events || "<div>아직 없음</div>"}` +
    `<details><summary>저널 ${panel.journal.length}줄</summary><pre>${journal}</pre></details>`;

  for (const button of playerView.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
    button.addEventListener("click", () => {
      const option = panel.actionPanel[Number(button.dataset["action"])];
      if (option === undefined) return;
      void host
        .request({
          type: "execute_player_action",
          action: { actionId: option.actionId, targetIds: option.targetIds },
        })
        .then(applyResponses);
    });
  }
  for (const button of playerView.querySelectorAll<HTMLButtonElement>("button[data-offer]")) {
    button.addEventListener("click", () => {
      const offer = panel.growthOffers[Number(button.dataset["offer"])];
      const option = offer?.options[Number(button.dataset["option"])];
      if (offer === undefined || option === undefined) return;
      void host
        .request({ type: "accept_growth", offerId: offer.offerId, optionId: option.id })
        .then(applyResponses);
    });
  }
}

attachButton.addEventListener("click", () => {
  void host
    .request({ type: "attach_player", agentId: playerAgentInput.value.trim() })
    .then(applyResponses);
});

detachButton.addEventListener("click", () => {
  builder.setPlayerView(undefined);
  void host.request({ type: "detach_player" }).then(applyResponses);
});

// --- 세계 생성 화면 (§36.1) ----------------------------------------------------------
// 화면은 GenerationViewModel 속성만 읽는다 — WorldDefinition 도 아티팩트 원본도 만지지 않는다.
const lines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

themesInput.value = FIRST_WORLD_SEED_INPUT.themes.join("\n");
experiencesInput.value = (FIRST_WORLD_SEED_INPUT.desiredExperiences ?? []).join("\n");
prohibitedInput.value = (FIRST_WORLD_SEED_INPUT.prohibitedElements ?? []).join("\n");

// 생성 결과는 화면이 해석하지 않는다 — 프로토콜에 그대로 실어 보낼 뿐이다(분해 원칙 5)
let generated: unknown;
let generatedSeed = 0;

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] ?? char);
}

function renderGeneration(view: GenerationViewModel): void {
  if (view.idle) {
    generationView.innerHTML = "";
    return;
  }
  const mark = (status: string): string => (status === "failed" ? "✗" : status === "reused" ? "=" : "✓");
  const steps = view.steps
    .map(
      (step) =>
        `<div class="${step.status === "failed" ? "fail" : ""}">${mark(step.status)} ${String(step.index).padStart(2)} ` +
        `${escapeHtml(step.title)} — ${escapeHtml(step.summary)}${step.callCount > 0 ? ` (생성 호출 ${step.callCount})` : ""}` +
        `${step.error === undefined ? "" : `\n    ${escapeHtml(step.error)}`}</div>` +
        (step.artifactJson.length === 0
          ? ""
          : `<details><summary>단계 산출물 보기</summary><pre>${escapeHtml(step.artifactJson)}</pre></details>`),
    )
    .join("");
  const scale = view.scale
    .map((row) => `${row.ok ? "✓" : "✗"} ${row.item} ${row.actual}/${row.target}`)
    .join(" · ");
  const expectations = view.expectations
    .map((item) => `${item.ok ? "✓" : "✗"} ${escapeHtml(item.item)}: ${escapeHtml(item.evidence)}`)
    .join("\n");
  const badges = view.badges.map((badge) => `${badge.key} ${badge.value}`).join(" · ");
  const issues =
    view.issues.length === 0
      ? "정합성 검증 통과"
      : `<span class="fail">${view.issues.map((issue) => escapeHtml(`[${issue.level}] ${issue.message}`)).join("\n")}</span>`;

  generationView.innerHTML =
    `<h3>${escapeHtml(view.title)}</h3><div>${badges}</div><hr />${steps}<hr />` +
    `<div><b>§40 규모</b>\n${escapeHtml(scale)}</div><hr />` +
    `<div><b>§41 자동 생성 결과</b>\n${expectations}</div><hr /><div>${issues}</div>`;
}

generateButton.addEventListener("click", () => {
  const worldSeed = Number(genSeedInput.value) || 0;
  generateButton.disabled = true;
  generationView.textContent = "생성 중…";
  // 오프라인 목 포트 — 실제 LLM 어댑터도 같은 TextGenerationPort 뒤에 들어온다 (§2.1)
  const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS);
  void compileWorld({
    port,
    seedInput: {
      title: "제약의 대륙",
      themes: lines(themesInput.value),
      desiredExperiences: lines(experiencesInput.value),
      prohibitedElements: lines(prohibitedInput.value),
    },
    worldSeed,
    worldId: FIRST_WORLD_ID,
  })
    .then((result) => {
      const view = buildGenerationView(result, PROTOTYPE_SCALE, {
        callCount: port.calls.length,
        maxInputBytes: port.maxInputBytes,
      });
      generated = result.definition;
      generatedSeed = view.worldSeed;
      useGeneratedButton.disabled = result.issues.length > 0;
      renderGeneration(view);
    })
    .catch((error: unknown) => {
      generationView.innerHTML = `<span class="fail">생성 중단 — ${escapeHtml(
        error instanceof Error ? error.message : String(error),
      )}</span>`;
    })
    .finally(() => {
      generateButton.disabled = false;
    });
});

useGeneratedButton.addEventListener("click", () => {
  if (generated === undefined) return;
  void host
    .request({ type: "initialize_world", worldSeed: generatedSeed, definition: generated })
    .then(applyResponses);
});

const initialScene = builder.buildScene();
render(initialScene);
renderPlayer(initialScene, "");
renderGeneration(createEmptyGenerationView());
