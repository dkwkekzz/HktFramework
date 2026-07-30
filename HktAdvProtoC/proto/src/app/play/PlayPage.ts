// 플레이 화면 (Phase-9 §9.2·§9.3) — 게임으로서의 진입 절차와 MMORPG 조작.
//
// 진입 절차가 "관찰자 없는 플레이어 시점"을 구조적으로 막는다:
//   ① 세계 선택(보관함/기본) → ② 주체 선택 → ③ attach + 플레이어 시점 → 렌더 시작.
// 이 파일은 SceneViewModel 속성·프로토콜 메시지·렌더러만 안다 — 시뮬레이션 의미 해석은 없다(분해 원칙 5).
import { PlaySceneRenderer } from "../../rendering/PlaySceneRenderer";
import { createCanvasSurface } from "../../rendering/SceneSurface";
import type { PlayableAgentCard, WorldPackageStageBadge } from "../../shared/protocol";
import type { SceneActionOption, SceneMapMarker, SceneMapRegion, SceneViewModel } from "../../viewmodel/SceneViewModel";
import { badgeLine, el, escapeHtml, type PageContext } from "../shell";
import type { StoredWorld, WorldLibrary } from "../WorldLibrary";
import { VirtualJoystick } from "./VirtualJoystick";

/** 시간 루프 주기 (ms) — 한 번에 배속만큼의 tick 을 민다. §44-5: 시간을 미는 주체가 버튼에서 루프로 바뀔 뿐이다 */
const TICK_INTERVAL_MS = 500;
/** 스티어(WASD·조이스틱) 목표 갱신 주기 (ms) */
const STEER_INTERVAL_MS = 250;
/** 스티어 한 번이 내다보는 거리 (지역 거리 단위) */
const STEER_STEP = 10;
/** 플레이 배속 단계 — 한 루프가 무는 tick 수 */
const PLAY_SPEEDS = [1, 2, 4];

type PlayPhase = "select" | "agents" | "playing";

export class PlayPage {
  private readonly canvas = el<HTMLCanvasElement>("play-canvas");
  private readonly worldsView = el<HTMLElement>("play-worlds");
  private readonly agentsView = el<HTMLElement>("play-agents");
  private readonly statusView = el<HTMLElement>("play-status");
  private readonly targetView = el<HTMLElement>("play-target");
  private readonly actionsView = el<HTMLElement>("play-actions");
  private readonly panelView = el<HTMLElement>("play-panel");
  private readonly growthView = el<HTMLElement>("play-growth");
  private readonly renderer: PlaySceneRenderer;
  private readonly joystick: VirtualJoystick;

  private phase: PlayPhase = "select";
  /** 빌트인 세계도 §3 패키지 경로로 들어온다 — export_world 응답을 기다리는 중인가 */
  private awaitingPackage = false;
  private playerId = "";
  private selectedId?: string;
  private destination?: { regionId: string; fx: number; fy: number };
  private lastScene: SceneViewModel | undefined;
  private paused = false;
  private speedIndex = 0;
  private panelOpen = false;
  private tickTimer: number | undefined;
  private steerTimer: number | undefined;
  private readonly pressed = new Set<string>();
  /** 핀치 줌 추적 — pointerId → 마지막 좌표 */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance: number | undefined;

  constructor(
    private readonly ctx: PageContext,
    private readonly library: WorldLibrary,
  ) {
    const context = this.canvas.getContext("2d");
    if (context === null) throw new Error("플레이 캔버스를 만들 수 없다");
    this.renderer = new PlaySceneRenderer(createCanvasSurface(context, this.canvas.width, this.canvas.height));
    this.joystick = new VirtualJoystick(el<HTMLElement>("play-joystick"), el<HTMLElement>("play-knob"));

    el<HTMLButtonElement>("play-pause").addEventListener("click", () => this.togglePause());
    el<HTMLButtonElement>("play-speed").addEventListener("click", () => this.cycleSpeed());
    el<HTMLButtonElement>("play-exit").addEventListener("click", () => this.exitToSelect());
    el<HTMLButtonElement>("play-panel-toggle").addEventListener("click", () => this.togglePanel());
    el<HTMLButtonElement>("play-zoom-in").addEventListener("click", () => this.renderer.zoomBy(1.2));
    el<HTMLButtonElement>("play-zoom-out").addEventListener("click", () => this.renderer.zoomBy(1 / 1.2));

    this.bindCanvas();
    this.bindKeyboard();
  }

  // --- 진입 절차 ------------------------------------------------------------------------

  /** #play 진입 — 세계 선택부터 시작한다 */
  enter(): void {
    this.stopLoops();
    this.phase = "select";
    this.showPhase();
    this.renderWorldList();
  }

  /** #studio 로 떠날 때 — 루프만 멈춘다(세계는 그대로 흐를 수 있게 남긴다) */
  leave(): void {
    this.stopLoops();
  }

  private showPhase(): void {
    el<HTMLElement>("play-select").hidden = this.phase !== "select";
    el<HTMLElement>("play-agent-select").hidden = this.phase !== "agents";
    el<HTMLElement>("play-stage").hidden = this.phase !== "playing";
  }

  /** §3 모듈 1~6 처리 보고 한 줄 요약 — 카드가 "이 세계가 어떤 가공을 거쳤는가"를 그대로 보여 준다 */
  private stageLine(stages: WorldPackageStageBadge[]): string {
    return stages
      .map((stage) => `<span title="${escapeHtml(stage.evidence)}">${stage.ok ? "✓" : "✗"}${escapeHtml(stage.id)}</span>`)
      .join(" ");
  }

  private renderWorldList(): void {
    const stored = this.library.list();
    const rows = [
      `<div class="play-card" data-world="builtin"><b>침묵림 변두리 — 개입 (기본 세계)</b>` +
        `<small>선택하면 §3 모듈 1~6 을 지금 돌려 패키지로 굽고 그것을 불러온다 (§30·§32 층 포함)</small></div>`,
      ...stored.map(
        (entry) =>
          `<div class="play-card" data-world="${escapeHtml(entry.id)}"><b>${escapeHtml(entry.label)}</b>` +
          `<small>${escapeHtml(entry.worldId)} · 보관 ${escapeHtml(entry.savedAt.slice(0, 19).replace("T", " "))}</small>` +
          `<small class="play-stages">${this.stageLine(entry.stages ?? [])}</small>` +
          `<button class="play-remove" data-remove="${escapeHtml(entry.id)}">삭제</button></div>`,
      ),
    ].join("");
    this.worldsView.innerHTML =
      rows +
      (stored.length === 0
        ? `<p class="hint">보관된 세계가 없다 — 스튜디오의 ① 세계 생성에서 만들고 "플레이 패키지로 보관"을 누르면 여기 나타난다.</p>`
        : "");

    for (const card of this.worldsView.querySelectorAll<HTMLElement>(".play-card")) {
      card.addEventListener("click", () => {
        const key = card.dataset["world"];
        if (key === undefined) return;
        this.startWorld(key === "builtin" ? undefined : this.library.find(key));
      });
    }
    for (const button of this.worldsView.querySelectorAll<HTMLButtonElement>("button[data-remove]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = button.dataset["remove"];
        if (id === undefined) return;
        this.library.remove(id);
        this.renderWorldList();
      });
    }
  }

  /**
   * ① 세계 선택 — **모든 세계가 패키지 경로로 들어온다** (§3: 1~6 정적 가공 → 7 로드).
   * 보관된 세계는 그 패키지를, 빌트인은 지금 export_world 로 구워서 쓴다.
   */
  private startWorld(stored: StoredWorld | undefined): void {
    const worldSeed = Number(el<HTMLInputElement>("play-seed").value) || 0;
    this.phase = "agents";
    this.showPhase();
    if (stored === undefined) {
      this.awaitingPackage = true;
      this.agentsView.innerHTML = "<p class='hint'>§3 모듈 1~6 을 돌려 패키지를 굽는 중…</p>";
      this.ctx.send({ type: "export_world", world: "player", worldSeed });
      return;
    }
    this.loadPackage(stored.json);
  }

  /** 빌트인 세계의 패키지가 도착했다 — 보관된 세계와 같은 로드 경로로 합류한다 */
  onWorldPackage(json: string): void {
    if (!this.awaitingPackage || this.phase !== "agents") return;
    this.awaitingPackage = false;
    this.loadPackage(json);
  }

  /** ② 패키지 로드 + 주체 목록 요청 (요청은 순서대로 처리된다) */
  private loadPackage(json: string): void {
    const worldSeed = Number(el<HTMLInputElement>("play-seed").value) || 0;
    this.ctx.send({ type: "initialize_world", worldSeed, package: json });
    this.ctx.send({ type: "request_playable_agents" });
    this.agentsView.innerHTML = "<p class='hint'>세계를 올리는 중…</p>";
  }

  /** ② 주체 선택 카드 — playable_agents 응답이 채운다 */
  onPlayableAgents(agents: PlayableAgentCard[]): void {
    if (this.phase !== "agents") return;
    if (agents.length === 0) {
      this.agentsView.innerHTML = "<p class='hint'>조작할 수 있는 주체가 없다.</p>";
      return;
    }
    this.agentsView.innerHTML = agents
      .map(
        (agent) =>
          `<div class="play-card" data-agent="${escapeHtml(agent.id)}"><b>${escapeHtml(agent.label)}</b>` +
          `<small>${escapeHtml(agent.speciesLabel)} · ${escapeHtml(agent.regionLabel)}</small>` +
          `<small>${escapeHtml(badgeLine(agent.badges, " · "))}</small></div>`,
      )
      .join("");
    for (const card of this.agentsView.querySelectorAll<HTMLElement>(".play-card")) {
      card.addEventListener("click", () => {
        const agentId = card.dataset["agent"];
        if (agentId !== undefined) this.startPlaying(agentId);
      });
    }
  }

  /** ③ attach + 플레이어 시점 — 이 순간부터만 플레이 렌더가 시작된다 (검은 화면의 구조적 해소) */
  private startPlaying(agentId: string): void {
    this.playerId = agentId;
    delete this.selectedId;
    delete this.destination;
    this.ctx.send({ type: "attach_player", agentId });
    this.ctx.send({ type: "set_view", mode: "player" });
    this.phase = "playing";
    this.paused = false;
    this.speedIndex = 0;
    this.showPhase();
    this.startLoops();
  }

  private exitToSelect(): void {
    this.stopLoops();
    this.ctx.send({ type: "detach_player" });
    this.ctx.send({ type: "set_view", mode: "developer" });
    this.phase = "select";
    this.showPhase();
    this.renderWorldList();
  }

  // --- 실시간 루프 (§9.3) ----------------------------------------------------------------

  private startLoops(): void {
    this.stopLoops();
    this.tickTimer = window.setInterval(() => {
      if (this.paused || this.phase !== "playing") return;
      this.ctx.send({ type: "advance_time", amount: PLAY_SPEEDS[this.speedIndex] ?? 1 });
    }, TICK_INTERVAL_MS);
    this.steerTimer = window.setInterval(() => this.steer(), STEER_INTERVAL_MS);
  }

  private stopLoops(): void {
    if (this.tickTimer !== undefined) window.clearInterval(this.tickTimer);
    if (this.steerTimer !== undefined) window.clearInterval(this.steerTimer);
    this.tickTimer = undefined;
    this.steerTimer = undefined;
    this.pressed.clear();
  }

  private togglePause(): void {
    this.paused = !this.paused;
    el<HTMLButtonElement>("play-pause").textContent = this.paused ? "▶ 재개" : "⏸ 일시정지";
  }

  private cycleSpeed(): void {
    this.speedIndex = (this.speedIndex + 1) % PLAY_SPEEDS.length;
    el<HTMLButtonElement>("play-speed").textContent = `×${PLAY_SPEEDS[this.speedIndex]}`;
  }

  private togglePanel(): void {
    this.panelOpen = !this.panelOpen;
    this.panelView.hidden = !this.panelOpen;
    if (this.lastScene !== undefined) this.renderPanels(this.lastScene);
  }

  // --- 입력 (§9.3 표) --------------------------------------------------------------------

  private bindKeyboard(): void {
    const keys = new Map([
      ["w", "up"], ["arrowup", "up"],
      ["s", "down"], ["arrowdown", "down"],
      ["a", "left"], ["arrowleft", "left"],
      ["d", "right"], ["arrowright", "right"],
    ]);
    window.addEventListener("keydown", (event) => {
      if (this.phase !== "playing") return;
      const target = event.target as HTMLElement | null;
      if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const direction = keys.get(event.key.toLowerCase());
      if (direction === undefined) return;
      event.preventDefault();
      this.pressed.add(direction);
    });
    window.addEventListener("keyup", (event) => {
      const direction = keys.get(event.key.toLowerCase());
      if (direction !== undefined) this.pressed.delete(direction);
    });
  }

  /** WASD·조이스틱 방향 → 목표점 이동 명령. 프로토콜은 click-to-move 하나로 수렴한다 */
  private steer(): void {
    if (this.phase !== "playing" || this.paused) return;
    let dx = 0;
    let dy = 0;
    if (this.pressed.has("up")) dy -= 1;
    if (this.pressed.has("down")) dy += 1;
    if (this.pressed.has("left")) dx -= 1;
    if (this.pressed.has("right")) dx += 1;
    const stick = this.joystick.state.direction;
    if (stick !== undefined) {
      dx += stick.x;
      dy += stick.y;
    }
    const length = Math.hypot(dx, dy);
    if (length < 0.2) return;
    const local = this.playerLocal();
    if (local === undefined) return;
    const x = local.x + (dx / length) * STEER_STEP;
    const y = local.y + (dy / length) * STEER_STEP;
    this.ctx.send({ type: "player_move", x, y });
    this.destination = {
      regionId: local.region.id,
      fx: Math.min(1, Math.max(0, x / Math.max(1, local.region.worldSize.width))),
      fy: Math.min(1, Math.max(0, y / Math.max(1, local.region.worldSize.height))),
    };
  }

  /** 조작 주체의 지역 좌표 — 장면의 표시 속성에서 역산한다(worldSize 는 그 용도로 실려 온다) */
  private playerLocal(): { region: SceneMapRegion; marker: SceneMapMarker; x: number; y: number } | undefined {
    const scene = this.lastScene;
    if (scene === undefined) return undefined;
    const marker = scene.map.markers.find((entry) => entry.id === this.playerId);
    if (marker === undefined) return undefined;
    const region = scene.map.regions.find((entry) => entry.id === marker.regionId);
    if (region === undefined) return undefined;
    const fx = (marker.point.x - region.rect.x) / Math.max(1e-6, region.rect.w);
    const fy = (marker.point.y - region.rect.y) / Math.max(1e-6, region.rect.h);
    return { region, marker, x: fx * region.worldSize.width, y: fy * region.worldSize.height };
  }

  private bindCanvas(): void {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        if (a !== undefined && b !== undefined) this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.pointers.size === 2 && this.pinchDistance !== undefined) {
        const [a, b] = [...this.pointers.values()];
        if (a === undefined || b === undefined) return;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > 0 && this.pinchDistance > 0) this.renderer.zoomBy(distance / this.pinchDistance);
        this.pinchDistance = distance;
      }
    });
    const release = (event: PointerEvent): void => {
      this.pointers.delete(event.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = undefined;
    };
    this.canvas.addEventListener("pointerup", (event) => {
      release(event);
      if (this.pointers.size === 0 && this.pinchDistance === undefined) this.tap(event);
    });
    this.canvas.addEventListener("pointercancel", release);
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.renderer.zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    });
  }

  /** 탭/클릭 — 마커=대상 지정, 게이트=지역 이동, 빈 땅=click-to-move */
  private tap(event: PointerEvent): void {
    if (this.phase !== "playing") return;
    const rect = this.canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / Math.max(1, rect.width)) * this.canvas.width;
    const py = ((event.clientY - rect.top) / Math.max(1, rect.height)) * this.canvas.height;
    const pick = this.renderer.pick(px, py);

    if (pick.kind === "marker") {
      if (pick.id === this.playerId || pick.id === this.selectedId) delete this.selectedId;
      else this.selectedId = pick.id;
      if (this.lastScene !== undefined) this.render(this.lastScene);
      return;
    }
    if (pick.kind === "gate") {
      if (!pick.open) {
        this.ctx.notify(`닫힌 길이다 — ${pick.label} (§13 통행 조건)`);
        return;
      }
      this.ctx.send({ type: "player_travel", toRegionId: pick.toRegionId });
      delete this.destination;
      return;
    }
    if (pick.kind === "ground") {
      const local = this.playerLocal();
      if (local === undefined) return;
      if (pick.regionId !== local.region.id) {
        this.ctx.notify("다른 지역이다 — 게이트(⇄)로 건넌다");
        return;
      }
      const x = pick.fx * local.region.worldSize.width;
      const y = pick.fy * local.region.worldSize.height;
      this.ctx.send({ type: "player_move", x, y });
      this.destination = { regionId: pick.regionId, fx: pick.fx, fy: pick.fy };
    }
  }

  // --- 렌더 (같은 SceneViewModel 소비) ---------------------------------------------------

  render(scene: SceneViewModel): void {
    if (this.phase !== "playing") return;
    this.lastScene = scene;

    // 목적지에 닿았으면 표식을 거둔다 — 도착 판정은 표시 분율의 근접으로 충분하다
    const local = this.playerLocal();
    if (this.destination !== undefined && local !== undefined && this.destination.regionId === local.region.id) {
      const fx = local.x / Math.max(1, local.region.worldSize.width);
      const fy = local.y / Math.max(1, local.region.worldSize.height);
      if (Math.hypot(fx - this.destination.fx, fy - this.destination.fy) < 0.01) delete this.destination;
    }
    // 대상이 시야에서 사라지면(지식 필터) 선택도 놓는다
    if (this.selectedId !== undefined && this.findMarker(scene, this.selectedId) === undefined) {
      delete this.selectedId;
    }

    this.renderer.render(scene, {
      ...(this.selectedId === undefined ? {} : { selectedId: this.selectedId }),
      ...(this.destination === undefined ? {} : { destination: this.destination }),
    });
    this.renderHud(scene);
    this.renderPanels(scene);
  }

  private findMarker(scene: SceneViewModel, id: string): SceneMapMarker | undefined {
    const { map } = scene;
    return (
      map.markers.find((m) => m.id === id) ??
      map.resources.find((m) => m.id === id) ??
      map.places.find((m) => m.id === id) ??
      map.factions.find((m) => m.id === id)
    );
  }

  private renderHud(scene: SceneViewModel): void {
    const player = scene.player;
    const marker = this.findMarker(scene, this.playerId);
    const gauge = marker?.gauge;
    const doing =
      player?.currentAction === undefined
        ? ""
        : `<div class="hint">${escapeHtml(player.currentAction.actionId)} → ${escapeHtml(player.currentAction.targets)}</div>`;
    this.statusView.innerHTML =
      `<b>${escapeHtml(player?.label ?? this.playerId)}</b>` +
      (gauge === undefined
        ? ""
        : `<div class="play-bar"><div class="play-bar-fill" style="width:${Math.round(gauge.value * 100)}%"></div></div>`) +
      doing;

    // 대상 카드 — 아는 사실만 (지식 필터를 통과해 온 배지)
    const selected = this.selectedId === undefined ? undefined : this.findMarker(scene, this.selectedId);
    if (selected === undefined) {
      this.targetView.hidden = true;
    } else {
      this.targetView.hidden = false;
      const entity = scene.entities.find((entry) => entry.id === selected.id);
      const facts = (entity?.stateBadges ?? selected.badges).slice(0, 6);
      this.targetView.innerHTML =
        `<b>${escapeHtml(selected.label)}</b> <small>${escapeHtml(badgeLine(facts, " · "))}</small>`;
    }

    this.renderActions(scene);
  }

  /** 하단 행동 바 — §31 후보를 대상으로 거른다. 근접 부족은 approach 후보가 이미 처리한다(§30) */
  private renderActions(scene: SceneViewModel): void {
    const player = scene.player;
    if (player === undefined) {
      this.actionsView.innerHTML = "";
      return;
    }
    const forTarget = (option: SceneActionOption): boolean =>
      this.selectedId === undefined
        ? option.targetIds.length === 0 || (option.targetIds.length === 1 && option.targetIds[0] === this.playerId)
        : option.targetIds.includes(this.selectedId);
    const options = player.actionPanel.filter(forTarget).slice(0, 8);
    this.actionsView.innerHTML = options
      .map(
        (option, index) =>
          `<button class="play-action" data-action="${index}" title="${escapeHtml(option.goalId)} · 위험 ${escapeHtml(option.risk)}">` +
          `${escapeHtml(option.name)}<small>${escapeHtml(option.duration)}</small></button>`,
      )
      .join("");
    for (const button of this.actionsView.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
      button.addEventListener("click", () => {
        const option = options[Number(button.dataset["action"])];
        if (option === undefined) return;
        this.ctx.send({
          type: "execute_player_action",
          action: { actionId: option.actionId, targetIds: option.targetIds },
        });
        delete this.destination;
      });
    }
  }

  private renderPanels(scene: SceneViewModel): void {
    const player = scene.player;
    // 성장 선택 (§32) — 제안이 있으면 모달로 앞세운다
    if (player !== undefined && player.growthOffers.length > 0) {
      this.growthView.hidden = false;
      this.growthView.innerHTML = player.growthOffers
        .map(
          (offer, offerIndex) =>
            `<div><b>성장 (§32)</b> — ${escapeHtml(offer.key)}` +
            offer.options
              .map(
                (option, optionIndex) =>
                  `<button data-offer="${offerIndex}" data-option="${optionIndex}">` +
                  `${escapeHtml(option.restriction)}<small>부담 ${escapeHtml(option.severity)} → ${escapeHtml(option.grants)}</small></button>`,
              )
              .join("") +
            `</div>`,
        )
        .join("");
      for (const button of this.growthView.querySelectorAll<HTMLButtonElement>("button[data-offer]")) {
        button.addEventListener("click", () => {
          const offer = player.growthOffers[Number(button.dataset["offer"])];
          const option = offer?.options[Number(button.dataset["option"])];
          if (offer === undefined || option === undefined) return;
          this.ctx.send({ type: "accept_growth", offerId: offer.offerId, optionId: option.id });
        });
      }
    } else {
      this.growthView.hidden = true;
    }

    if (!this.panelOpen || player === undefined) return;
    const journal = player.journal
      .slice(-20)
      .reverse()
      .map((entry) => `<div>${escapeHtml(entry.at)} [${escapeHtml(entry.kind)}] ${escapeHtml(entry.detail)}</div>`)
      .join("");
    const events = player.eventPanel
      .slice(0, 8)
      .map((item) => `<div>· ${escapeHtml(item.title)} <small>시급도 ${escapeHtml(item.urgency)}</small></div>`)
      .join("");
    this.panelView.innerHTML =
      `<b>아는 사건 (${player.eventPanel.length})</b>${events || "<div class='hint'>아직 없음</div>"}` +
      `<hr /><b>저널</b>${journal || "<div class='hint'>아직 없음</div>"}`;
  }
}
