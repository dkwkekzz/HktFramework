// ViewModelBuilder — patch 를 구독해 SceneViewModel 을 증분 갱신한다 (Phase 0 §0.6)
// 시뮬레이션 속성 → 표시 속성 변환은 전부 여기서 끝난다. 렌더러·페이지에는 해석 코드가 없어야 한다.
import type { EntityState, WorldStatePatch } from "../shared/state";
import { tickToDay, tickToMinuteOfDay } from "../shared/time";
import {
  createEmptyScene,
  type SceneBadge,
  type SceneEntity,
  type SceneViewModel,
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

export class ViewModelBuilder {
  private entities = new Map<string, SceneEntity>();
  private globals = new Map<string, string>();
  private time = 0;
  private speed = 1;
  private initialized = false;

  markInitialized(): void {
    this.initialized = true;
    this.entities.clear();
    this.globals.clear();
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
    scene.speed = this.speed;
    scene.initialized = this.initialized;
    scene.entities = [...this.entities.values()].sort((a, b) => a.id.localeCompare(b.id));
    scene.globalBadges = [...this.globals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, value }));
    return scene;
  }
}
