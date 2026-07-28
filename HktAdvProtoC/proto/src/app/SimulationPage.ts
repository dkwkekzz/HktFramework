// 월드 지도 + 주체 관찰 화면 (기획서 §36.2, §36.3, §31 / Phase-8 §8.1)
//
// 지도는 Canvas 렌더러가, 주체 관찰은 텍스트 렌더러와 같은 속성이 그린다.
// **모드 전환은 "빌더에게 시점을 알려 주는 요청"이다** — 이 파일에는 무엇을 감출지 정하는 코드가 없다(§8.0).
import { CanvasSceneRenderer } from "../rendering/CanvasSceneRenderer";
import { createCanvasSurface } from "../rendering/SceneSurface";
import { TextSceneRenderer } from "../rendering/TextSceneRenderer";
import type { ThreeSceneRenderer } from "../rendering/ThreeSceneRenderer";
import type {
  SceneAgentPanel,
  SceneViewModel,
  SceneViewMode,
} from "../viewmodel/SceneViewModel";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "../shared/time";
import { badgeLine, el, escapeHtml, type PageContext } from "./shell";

/** §36.2 시간 배속 — 한 번의 진행이 무는 시간 */
const SPEED_STEPS = [1, 2, 6, 24];

export class SimulationPage {
  private readonly canvas = el<HTMLCanvasElement>("map");
  private readonly statusView = el<HTMLElement>("status");
  private readonly agentView = el<HTMLElement>("agent");
  private readonly agentSelect = el<HTMLSelectElement>("agent-select");
  private readonly playerView = el<HTMLElement>("player");
  private readonly worldView = el<HTMLElement>("world");
  private readonly speedView = el<HTMLElement>("speed-view");
  private readonly canvas3d = el<HTMLCanvasElement>("map3d");
  private readonly text = new TextSceneRenderer();
  private renderer: CanvasSceneRenderer | undefined;
  /** §37 표현 교체 증명 — 같은 SceneViewModel 을 소비하는 세 번째 렌더러. 3D 탭을 처음 열 때 만든다 */
  private threeRenderer: ThreeSceneRenderer | undefined;
  private view3d = false;
  private lastScene: SceneViewModel | undefined;
  private speed = 1;
  private message = "";

  constructor(private readonly ctx: PageContext) {
    const context = this.canvas.getContext("2d");
    if (context !== null) {
      this.renderer = new CanvasSceneRenderer(
        createCanvasSurface(context, this.canvas.width, this.canvas.height),
      );
    }

    el<HTMLButtonElement>("init").addEventListener("click", () => {
      this.ctx.send({ type: "initialize_world", worldSeed: this.seedValue(), world: "manual" });
    });
    el<HTMLButtonElement>("init-player").addEventListener("click", () => {
      this.ctx.send({ type: "initialize_world", worldSeed: this.seedValue(), world: "player" });
    });
    el<HTMLButtonElement>("advance-hour").addEventListener("click", () => this.advance(TICKS_PER_HOUR));
    el<HTMLButtonElement>("advance-day").addEventListener("click", () => this.advance(TICKS_PER_DAY));
    el<HTMLButtonElement>("advance-week").addEventListener("click", () => this.advance(7 * TICKS_PER_DAY));
    el<HTMLButtonElement>("speed-up").addEventListener("click", () => this.changeSpeed(1));
    el<HTMLButtonElement>("speed-down").addEventListener("click", () => this.changeSpeed(-1));

    el<HTMLButtonElement>("mode-developer").addEventListener("click", () => this.setMode("developer"));
    el<HTMLButtonElement>("mode-player").addEventListener("click", () => this.setMode("player"));

    el<HTMLButtonElement>("view-2d").addEventListener("click", () => this.setView3d(false));
    el<HTMLButtonElement>("view-3d").addEventListener("click", () => this.setView3d(true));

    el<HTMLButtonElement>("attach").addEventListener("click", () => {
      this.ctx.send({ type: "attach_player", agentId: el<HTMLInputElement>("player-agent").value.trim() });
    });
    el<HTMLButtonElement>("detach").addEventListener("click", () => {
      // 조작을 놓으면 플레이어 시점은 성립하지 않는다 — 관찰자 없는 "관찰된 세계"를 만들지 않는다
      this.setMode("developer");
      this.ctx.send({ type: "detach_player" });
    });

    this.agentSelect.addEventListener("change", () => {
      const agentId = this.agentSelect.value;
      this.ctx.send({ type: "set_view", agentId: agentId.length === 0 ? null : agentId });
    });
  }

  setMessage(message: string): void {
    this.message = message;
  }

  private seedValue(): number {
    return Number(el<HTMLInputElement>("seed").value) || 0;
  }

  private advance(amount: number): void {
    this.ctx.send({ type: "advance_time", amount: amount * this.speed });
  }

  private changeSpeed(direction: number): void {
    const index = SPEED_STEPS.indexOf(this.speed);
    const next = SPEED_STEPS[Math.min(SPEED_STEPS.length - 1, Math.max(0, index + direction))];
    if (next === undefined) return;
    this.speed = next;
    this.ctx.send({ type: "set_speed", speed: next });
  }

  private setMode(mode: SceneViewMode): void {
    this.ctx.send({ type: "set_view", mode });
  }

  /** 2D↔3D 전환 — 표현의 선택일 뿐이라 Worker 왕복이 없다. 같은 장면을 다른 렌더러가 다시 그린다 */
  private setView3d(on: boolean): void {
    this.view3d = on;
    this.canvas.hidden = on;
    this.canvas3d.hidden = !on;
    el<HTMLButtonElement>("view-2d").classList.toggle("active", !on);
    el<HTMLButtonElement>("view-3d").classList.toggle("active", on);
    if (on && this.threeRenderer === undefined) {
      // three.js 는 3D 를 처음 열 때만 내려받는다 — 2D 만 쓰는 로드가 무거워지지 않게(코드 분할)
      void import("../rendering/ThreeSceneRenderer").then(({ ThreeSceneRenderer }) => {
        if (!this.view3d) return;
        this.threeRenderer = new ThreeSceneRenderer(this.canvas3d);
        this.threeRenderer.start();
        if (this.lastScene !== undefined) this.threeRenderer.render(this.lastScene);
      });
      return;
    }
    if (on) {
      this.threeRenderer?.start();
      if (this.lastScene !== undefined) this.threeRenderer?.render(this.lastScene);
    } else {
      this.threeRenderer?.stop();
      if (this.lastScene !== undefined) this.renderer?.render(this.lastScene);
    }
  }

  render(scene: SceneViewModel): void {
    const running = scene.initialized;
    for (const id of ["advance-hour", "advance-day", "advance-week", "speed-up", "speed-down"]) {
      el<HTMLButtonElement>(id).disabled = !running;
    }
    el<HTMLButtonElement>("attach").disabled = !running || scene.player !== undefined;
    el<HTMLButtonElement>("detach").disabled = !running || scene.player === undefined;
    el<HTMLButtonElement>("mode-developer").classList.toggle("active", scene.modeKey === "developer");
    el<HTMLButtonElement>("mode-player").classList.toggle("active", scene.modeKey === "player");
    this.speedView.textContent = `×${scene.speed}`;

    if (!running) {
      this.statusView.textContent = "세계 없음 — 시드를 입력하고 시작하세요.";
      this.worldView.textContent = "";
      this.agentView.textContent = "";
      this.playerView.textContent = "";
      return;
    }

    this.statusView.textContent = [
      `${scene.clock} (tick ${scene.time}) · 시점 ${scene.modeKey === "developer" ? "개발자" : "플레이어"}`,
      `개체 ${scene.entities.length}개 · ${badgeLine(scene.map.legend)}`,
      scene.globalBadges.length === 0 ? "" : `세계 상태: ${badgeLine(scene.globalBadges, ", ")}`,
      this.message,
    ]
      .filter((line) => line.length > 0)
      .join("\n");

    this.lastScene = scene;
    if (this.view3d) this.threeRenderer?.render(scene);
    else this.renderer?.render(scene);
    // 같은 SceneViewModel 을 텍스트로도 그린다 — 표현 방식이 렌더러 밖으로 새지 않는다는 증거(§8.0)
    this.worldView.textContent = this.text.render(scene);

    this.renderAgentChoices(scene);
    // 지금 어느 시점인가는 장면이 말해 준다 — 페이지가 따로 기억한 값을 믿지 않는다
    this.renderAgentPanel(scene.agentPanel, scene.modeKey);
    this.renderPlayer(scene);
  }

  private renderAgentChoices(scene: SceneViewModel): void {
    const current = scene.agentPanel?.agentId ?? this.agentSelect.value;
    const options = ['<option value="">(관찰 대상 선택)</option>']
      .concat(
        scene.agentChoices.map(
          (choice) =>
            `<option value="${escapeHtml(choice.id)}"${choice.id === current ? " selected" : ""}>` +
            `${escapeHtml(choice.label)} (${escapeHtml(choice.id)})</option>`,
        ),
      )
      .join("");
    if (this.agentSelect.innerHTML !== options) this.agentSelect.innerHTML = options;
  }

  /** §36.3 목록 8항목 — 속성을 표로 옮기기만 한다 */
  private renderAgentPanel(panel: SceneAgentPanel | undefined, modeKey: SceneViewMode): void {
    if (panel === undefined) {
      this.agentView.innerHTML =
        modeKey === "player"
          ? "플레이어 시점에는 관찰자가 필요하다 — 아래에서 한 주체를 조작하면 그가 보는 것만 보인다."
          : "관찰할 주체를 고르세요.";
      return;
    }
    const stateRows = panel.states
      .map(
        (row) =>
          `<tr class="${row.divergent ? "diverge" : ""}"><td>${escapeHtml(row.key)}</td>` +
          `<td>${escapeHtml(row.actual ?? "—")}</td>` +
          `<td>${escapeHtml(row.believed ?? "—")}${row.confidence === undefined ? "" : ` <small>확신 ${row.confidence}</small>`}</td>` +
          `<td>${row.observable ? "" : "관찰불가"}</td><td>${escapeHtml(row.sourceKey)}</td></tr>`,
      )
      .join("");
    const otherRows = panel.beliefsAboutOthers
      .map(
        (row) =>
          `<tr class="${row.divergent ? "diverge" : ""}"><td>${escapeHtml(row.subjectId)}.${escapeHtml(row.key)}</td>` +
          `<td>${escapeHtml(row.actual ?? "—")}</td><td>${escapeHtml(row.believed ?? "—")} <small>확신 ${row.confidence ?? "-"}</small></td></tr>`,
      )
      .join("");
    const goals = panel.goalGraph
      .map(
        (node) =>
          `<div>${node.active ? "★" : "·"} <b>${escapeHtml(node.id)}</b> 활성도 ${node.activation} / 긴급 ${node.urgency} ` +
          `<small>${escapeHtml(node.sourceKey)}</small>\n    ${escapeHtml(node.description)}` +
          `\n    <small>${escapeHtml(badgeLine(node.breakdown, " "))}</small>` +
          (node.edges.length === 0
            ? ""
            : `\n    <small>엣지 ${escapeHtml(node.edges.map((edge) => `${edge.relation}→${edge.to}(${edge.weight})`).join(" "))}</small>`) +
          `</div>`,
      )
      .join("");
    const memories = panel.memories
      .slice(0, 12)
      .map(
        (memory) =>
          `<div>${escapeHtml(memory.at)} [${escapeHtml(memory.type)}] ${escapeHtml(memory.summary)} ` +
          `<small>중요 ${memory.relevance} · 강도 ${memory.intensity} · 확신 ${memory.confidence}</small></div>`,
      )
      .join("");
    const relations = panel.relationships
      .map(
        (relation) =>
          `<div>→ ${escapeHtml(relation.label)} <small>${escapeHtml(badgeLine(relation.axes, " "))} · 비밀 ${relation.secretCount}</small>` +
          relation.promises.map((promise) => `\n    약속 [${escapeHtml(promise.status)}] ${escapeHtml(promise.detail)}`).join("") +
          `</div>`,
      )
      .join("");
    const abilities = panel.abilities
      .map(
        (ability) =>
          `<div><b>${escapeHtml(ability.id)}</b> ${escapeHtml(ability.purpose)} ` +
          `<small>출력 ${escapeHtml(ability.outputRange)} · 숙련 ${ability.mastery} · ${escapeHtml(ability.operation)}/${escapeHtml(ability.medium)}</small>` +
          ability.restrictions
            .map((restriction) => `\n    제약 ${escapeHtml(restriction.description)} (부담 ${restriction.severity})`)
            .join("") +
          `\n    약점 ${escapeHtml(ability.weakness)}\n    근거 ${escapeHtml(ability.derivedFrom)}` +
          `\n    실행 ${escapeHtml(ability.actionIds.join(" "))} / ${escapeHtml(ability.ruleIds.join(" "))}</div>`,
      )
      .join("");

    this.agentView.innerHTML =
      `<div><b>${escapeHtml(panel.label)}</b> (${escapeHtml(panel.agentId)}) — ${escapeHtml(badgeLine(panel.badges))}</div>` +
      panel.narration.map((sentence) => `<div class="narration">${escapeHtml(sentence)}</div>`).join("") +
      (panel.activeGoal === undefined
        ? ""
        : `<div>활성 목적 <b>${escapeHtml(panel.activeGoal.id)}</b> (${panel.activeGoal.activation}) — ${escapeHtml(panel.activeGoal.description)}</div>`) +
      (panel.currentAction === undefined
        ? `<div>현재 행동 없음</div>`
        : `<div>현재 행동 <b>${escapeHtml(panel.currentAction.label)}</b> → ${escapeHtml(panel.currentAction.targets)} ` +
          `<small>${escapeHtml(panel.currentAction.startedAt)} ~ ${escapeHtml(panel.currentAction.completesAt)} (${(panel.currentAction.progress * 100).toFixed(0)}%)</small></div>`) +
      `<hr /><b>① 실제 상태 / ② 믿음 상태</b>` +
      `<table><tr><th>상태</th><th>실제</th><th>믿음</th><th></th><th>출처</th></tr>${stateRows}</table>` +
      (panel.hiddenCount === 0 ? "" : `<div class="hint">감춰진 상태 ${panel.hiddenCount}종 — 이 시점에서는 보이지 않는다</div>`) +
      (otherRows.length === 0
        ? ""
        : `<hr /><b>남에 대한 믿음 (§10)</b><table><tr><th>대상.상태</th><th>실제</th><th>믿음</th></tr>${otherRows}</table>`) +
      `<hr /><b>④ 목적 그래프 (활성도 11항)</b>${goals || "<div>없음</div>"}` +
      `<hr /><b>⑥ 기억 ${panel.memories.length}건</b>${memories || "<div>없음</div>"}` +
      `<hr /><b>⑦ 관계 ${panel.relationships.length}건</b>${relations || "<div>없음</div>"}` +
      `<hr /><b>⑧ 능력과 제약 ${panel.abilities.length}건</b>${abilities || "<div>없음</div>"}`;
  }

  // --- 플레이어 개입 (§31, §30) --------------------------------------------------------
  // 여기에도 "무엇을 숨길까"의 판단이 한 줄도 없다 — 코어의 지식 필터를 통과한 것만 도착하기 때문이다.

  private renderPlayer(scene: SceneViewModel): void {
    const panel = scene.player;
    if (panel === undefined) {
      this.playerView.innerHTML = scene.initialized
        ? "조작 중인 주체가 없다 — 세계는 그대로 흐른다(§44-5). 위에서 주체를 지정해 개입할 수 있다."
        : "";
      return;
    }

    const actions = panel.actionPanel
      .map(
        (option, index) =>
          `<div><button data-action="${index}">${escapeHtml(option.name)}</button> ` +
          `${escapeHtml(option.targets)} — ${escapeHtml(option.goalId)} · 점수 ${option.score} · ${option.duration} · 위험 ${option.risk}` +
          `${option.approachFor === undefined ? "" : ` (먼저 다가간다 → ${escapeHtml(option.approachFor)})`}</div>`,
      )
      .join("");
    const events = panel.eventPanel
      .map(
        (item) =>
          `<div>· ${escapeHtml(item.title)} [${escapeHtml(item.type)}] 시급도 ${item.urgency}\n` +
          `    아는 참여자 ${escapeHtml(item.knownParticipants.join(", ")) || "없음"} / 모르는 참여자 ${item.unknownParticipantCount}명\n` +
          `    아는 사실 ${escapeHtml(item.knownFacts.join(" | ")) || "없음"}\n` +
          `    개입 가능 ${escapeHtml(item.interactions.join(" "))}</div>`,
      )
      .join("");
    const offers = panel.growthOffers
      .map(
        (offer, offerIndex) =>
          `<div>성장 선택 — ${escapeHtml(offer.key)}\n` +
          offer.options
            .map(
              (option, optionIndex) =>
                `    <button data-offer="${offerIndex}" data-option="${optionIndex}">${escapeHtml(option.restriction)}</button> ` +
                `(부담 ${option.severity} → ${escapeHtml(option.grants)})`,
            )
            .join("\n") +
          `</div>`,
      )
      .join("");
    const journal = panel.journal
      .slice(-40)
      .reverse()
      .map((entry) => `${entry.at} [${entry.kind}] ${escapeHtml(entry.key)} ${escapeHtml(entry.detail)}`)
      .join("\n");
    const doing =
      panel.currentAction === undefined
        ? "지금은 아무것도 하지 않는다"
        : `${panel.currentAction.actionId} ${panel.currentAction.targets} (완료 ${panel.currentAction.completesAt})`;

    this.playerView.innerHTML =
      `<b>${escapeHtml(panel.label)}</b> (${escapeHtml(panel.playerId)}) — ${escapeHtml(doing)}\n` +
      `${escapeHtml(badgeLine(panel.facts, " "))}\n` +
      `목적: ${escapeHtml(panel.goals.map((goal) => `${goal.id}(${goal.activation})`).join(" · "))}\n` +
      `아직 모르는 개체 ${panel.undiscoveredCount}\n` +
      `<hr /><b>지금 할 수 있는 것 (${panel.actionPanel.length})</b>${actions}` +
      (offers.length === 0 ? "" : `<hr /><b>성장 (§32)</b>${offers}`) +
      (panel.growthLog.length === 0
        ? ""
        : `<details><summary>성장 기록 ${panel.growthLog.length}건</summary><pre>${escapeHtml(panel.growthLog.join("\n"))}</pre></details>`) +
      `<hr /><b>아는 사건 (${panel.eventPanel.length})</b>${events || "<div>아직 없음</div>"}` +
      `<details><summary>저널 ${panel.journal.length}줄</summary><pre>${journal}</pre></details>`;

    for (const button of this.playerView.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
      button.addEventListener("click", () => {
        const option = panel.actionPanel[Number(button.dataset["action"])];
        if (option === undefined) return;
        this.ctx.send({
          type: "execute_player_action",
          action: { actionId: option.actionId, targetIds: option.targetIds },
        });
      });
    }
    for (const button of this.playerView.querySelectorAll<HTMLButtonElement>("button[data-offer]")) {
      button.addEventListener("click", () => {
        const offer = panel.growthOffers[Number(button.dataset["offer"])];
        const option = offer?.options[Number(button.dataset["option"])];
        if (offer === undefined || option === undefined) return;
        this.ctx.send({ type: "accept_growth", offerId: offer.offerId, optionId: option.id });
      });
    }
  }
}
