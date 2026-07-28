// ViewModelBuilder — patch 를 구독해 SceneViewModel 을 증분 갱신한다 (Phase 0 §0.6)
// 시뮬레이션 속성 → 표시 속성 변환은 전부 여기서 끝난다. 렌더러·페이지에는 해석 코드가 없어야 한다.
import type { PlayerKnowledgeView, PlayerKnownEntity } from "../shared/player";
import type { EntityState, WorldStatePatch } from "../shared/state";
import { tickToDay, tickToMinuteOfDay } from "../shared/time";
import {
  createEmptyMap,
  createEmptyScene,
  type SceneActionOption,
  type SceneBadge,
  type SceneEntity,
  type SceneEventPanelItem,
  type SceneGrowthOffer,
  type SceneJournalEntry,
  type ScenePlayerPanel,
  type SceneViewModel,
  type SceneViewPayload,
} from "./SceneViewModel";

/** 표시용 값 변환 — 소수점 정리·빈 값 제거는 표현이 아니라 "표시 대상 선별"이므로 빌더의 몫이다 */
function formatValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  if (typeof value === "string") return value.length === 0 ? undefined : value;
  return String(value);
}

function toBadges(record: Record<string, unknown>): SceneBadge[] {
  const badges: SceneBadge[] = [];
  for (const key of Object.keys(record).sort()) {
    const value = formatValue(record[key]);
    if (value !== undefined) badges.push({ key, value });
  }
  return badges;
}

function toSceneEntity(entity: EntityState): SceneEntity {
  const scene: SceneEntity = {
    id: entity.id,
    kind: entity.type,
    label: entity.id,
    stateBadges: toBadges(entity.states),
    tags: [...entity.tags],
  };
  // 활성 목적은 "지금 이 개체가 무엇을 하려는가"라 표시 가치가 높다 — 가장 높은 것 하나만 싣는다
  const topGoal = entity.activeGoals?.[0];
  if (topGoal !== undefined) {
    scene.topGoal = { id: topGoal.goalId, activation: Math.round(topGoal.activation) };
  }
  if (entity.position !== undefined) {
    // 3D→2D 톱다운 투영 — z 는 표시 속성 elevation 으로 (공간 데이터는 3D, 렌더는 2D)
    const { regionId, x, y, z } = entity.position;
    scene.position = { regionId, x, y };
    scene.elevation = z;
  }
  return scene;
}

/** 플레이어가 아는 개체 → 표시 속성. 값은 이미 믿음·감각을 통과한 것이다(§7.2) */
function toKnownSceneEntity(known: PlayerKnownEntity): SceneEntity {
  const scene: SceneEntity = {
    id: known.id,
    kind: known.kind,
    label: known.label,
    // 확신은 표시 속성이다 — 같은 값이라도 얼마나 믿는지가 다르다(§10)
    stateBadges: known.facts.map((fact) => ({
      key: fact.key,
      value: fact.source === "belief" ? `${fact.value}?${fact.confidence.toFixed(2)}` : fact.value,
    })),
    tags: [...known.tags],
  };
  if (known.position !== undefined) {
    const { regionId, x, y, z } = known.position;
    scene.position = { regionId, x, y };
    scene.elevation = z;
  }
  return scene;
}

function toActionOption(option: PlayerKnowledgeView["options"][number]): SceneActionOption {
  const scene: SceneActionOption = {
    actionId: option.actionId,
    name: option.name,
    targets: option.targetLabels.join(", "),
    targetIds: [...option.targetIds],
    goalId: option.goalId,
    score: option.score.toFixed(1),
    duration: `${option.duration}분`,
    risk: option.expectedRisk.toFixed(0),
  };
  if (option.approachFor !== undefined) scene.approachFor = option.approachFor;
  return scene;
}

export class ViewModelBuilder {
  private entities = new Map<string, SceneEntity>();
  private globals = new Map<string, string>();
  private time = 0;
  private speed = 1;
  private initialized = false;
  private playerView: PlayerKnowledgeView | undefined;
  /** 시뮬레이션 쪽 빌더가 만든 표시 재료 (§36.2~§36.4) — 여기서는 담기만 한다 */
  private payload: SceneViewPayload | undefined;

  markInitialized(): void {
    this.initialized = true;
    this.entities.clear();
    this.globals.clear();
    this.playerView = undefined;
    this.payload = undefined;
  }

  /** 지도·사건·주체 패널 (§36.2~§36.4) — 이미 해석이 끝난 속성이므로 그대로 장면에 얹는다 */
  setSceneView(payload: SceneViewPayload): void {
    this.payload = payload;
  }

  /** 코어가 지식 필터를 통과시켜 보낸 데이터 — 빌더는 표시 속성으로 옮기기만 한다 */
  setPlayerView(view: PlayerKnowledgeView | undefined): void {
    this.playerView = view;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  applyPatch(patch: WorldStatePatch): void {
    this.time = patch.time;
    for (const entity of patch.upserts) {
      this.entities.set(entity.id, toSceneEntity(entity));
    }
    for (const id of patch.removedIds) {
      this.entities.delete(id);
    }
    if (patch.globalStates !== undefined) {
      for (const key of Object.keys(patch.globalStates)) {
        this.globals.set(key, String(patch.globalStates[key]));
      }
    }
  }

  buildScene(): SceneViewModel {
    const scene = createEmptyScene();
    scene.time = this.time;
    scene.day = tickToDay(this.time);
    scene.minuteOfDay = tickToMinuteOfDay(this.time);
    scene.clock =
      `${scene.day}일차 ${String(Math.floor(scene.minuteOfDay / 60)).padStart(2, "0")}:` +
      `${String(scene.minuteOfDay % 60).padStart(2, "0")}`;
    scene.speed = this.speed;
    scene.initialized = this.initialized;
    scene.globalBadges = [...this.globals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, value }));

    const payload = this.payload;
    if (payload !== undefined) {
      scene.modeKey = payload.modeKey;
      scene.speed = payload.speed;
      scene.map = payload.map;
      scene.events = payload.events;
      scene.agentChoices = payload.agentChoices;
      if (payload.agentPanel !== undefined) scene.agentPanel = payload.agentPanel;
      if (payload.eventDetail !== undefined) scene.eventDetail = payload.eventDetail;
    } else {
      scene.map = createEmptyMap();
    }

    const player = this.playerView;
    if (player === undefined) {
      // 개발자 시점 — 세계가 보이는 그대로 (§36.3 개발자 모드의 선행 형태)
      scene.entities = [...this.entities.values()].sort((a, b) => a.id.localeCompare(b.id));
      return scene;
    }

    // 플레이어 시점 — patch 의 실제 상태는 장면에 오르지 않는다. 아는 것만 그린다.
    scene.entities = [player.self, ...player.known]
      .map(toKnownSceneEntity)
      .sort((a, b) => a.id.localeCompare(b.id));
    scene.player = this.buildPlayerPanel(player);
    return scene;
  }

  private buildPlayerPanel(view: PlayerKnowledgeView): ScenePlayerPanel {
    const journal: SceneJournalEntry[] = view.journal.map((entry) => ({
      at: `${tickToDay(entry.at)}일 ${String(Math.floor(tickToMinuteOfDay(entry.at) / 60)).padStart(2, "0")}시`,
      kind: entry.kind,
      key: entry.key,
      detail: entry.detail,
    }));
    const eventPanel: SceneEventPanelItem[] = view.events.map((brief) => ({
      eventId: brief.eventId,
      type: brief.type,
      title: brief.title,
      knownParticipants: [...brief.knownParticipants],
      unknownParticipantCount: brief.unknownParticipantCount,
      knownFacts: brief.knownFacts.map(
        (fact) => `${fact.subjectId}.${fact.stateKey}=${String(fact.believedValue)}(확신 ${fact.confidence.toFixed(2)})`,
      ),
      interactions: [...brief.possibleInteractions],
      urgency: brief.timeSensitivity.toFixed(2),
    }));
    const growthOffers: SceneGrowthOffer[] = view.growthOffers.map((offer) => ({
      offerId: offer.id,
      key: offer.key,
      options: offer.options.map((option) => ({
        id: option.id,
        restriction: option.restriction,
        severity: String(option.severity),
        grants: option.grants.map((grant) => `${grant.type}:${grant.key} +${grant.amount}`).join(", "),
      })),
    }));

    const panel: ScenePlayerPanel = {
      playerId: view.playerId,
      label: view.self.label,
      facts: view.self.facts.map((fact) => ({ key: fact.key, value: fact.value })),
      goals: view.goals.map((goal) => ({ id: goal.id, activation: goal.activation })),
      actionPanel: view.options.map(toActionOption),
      journal,
      eventPanel,
      growthOffers,
      growthLog: view.growthLog.map(
        (change) =>
          `${tickToDay(change.at)}일 [${change.type}] ${change.key} ${String(change.previousValue)}→${String(change.newValue)} @${change.sourceEventId}`,
      ),
      undiscoveredCount: view.undiscoveredCount,
    };
    if (view.currentAction !== undefined) {
      panel.currentAction = {
        actionId: view.currentAction.actionId,
        targets: view.currentAction.targetIds.join(", "),
        completesAt: view.currentAction.completesAt,
      };
    }
    return panel;
  }
}
