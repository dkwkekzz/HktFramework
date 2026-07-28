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

function toBadges(record: Record<string, unknown>): SceneBadge[] {
  return Object.keys(record)
    .sort()
    .map((key) => ({ key, value: String(record[key]) }));
}

function toSceneEntity(entity: EntityState): SceneEntity {
  const scene: SceneEntity = {
    id: entity.id,
    kind: entity.type,
    label: entity.id,
    stateBadges: toBadges(entity.states),
  };
  if (entity.position !== undefined) scene.position = { ...entity.position };
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
