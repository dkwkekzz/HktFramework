// StateStore — 모든 상태 쓰기의 단일 경로 (Phase-1 §1.1)
// 여기서 ① §9 스키마 검증 ② patch dirty 추적 ③ §28 RawWorldChange 기록 ④ state_changed 트리거 큐
// 네 가지를 동시에 처리한다. 이 경로를 우회해 entity.states 를 직접 쓰는 코드는 존재해서는 안 된다.
import type { ActiveGoalState } from "../../shared/beliefs";
import type { RawWorldChange, StateChange } from "../../shared/change";
import { MAX_CHANGE_LOG } from "../../shared/change";
import type { EntityState, Position, WorldState } from "../../shared/state";
import type { PatchCollector } from "./PatchCollector";
import type { StateSchemaRegistry } from "./StateSchema";
import type { StateOwnerType } from "./types";

export type StateOperation = "set" | "add" | "multiply";

/** 변경 묶음의 맥락 — 어떤 행동/규칙이 일으킨 변화인지 (§28 사건 탐지의 재료) */
export interface ChangeContext {
  sourceId?: string;
  targetIds?: string[];
  locationId?: string;
  tags: string[];
}

interface OpenContext {
  context: ChangeContext;
  changes: StateChange[];
}

/** state_changed 규칙 디스패치 대기 항목 */
export interface StateChangeSignal {
  entityId: string;
  stateKey: string;
  before: unknown;
  after: unknown;
}

export class StateStore {
  private readonly contextStack: OpenContext[] = [];
  private pendingStateChanges: StateChangeSignal[] = [];

  constructor(
    private readonly state: WorldState,
    private readonly schemas: StateSchemaRegistry,
    private readonly patch: PatchCollector,
  ) {}

  // --- 개체 -----------------------------------------------------------------

  entity(entityId: string): EntityState {
    const entity = this.state.entities[entityId];
    if (entity === undefined) throw new Error(`개체 없음: ${entityId}`);
    return entity;
  }

  findEntity(entityId: string): EntityState | undefined {
    return this.state.entities[entityId];
  }

  /** §9 StateOwnerType 결정 — 지역은 location 개체 중 region 태그를 가진 것 */
  ownerTypeOf(entity: EntityState): StateOwnerType {
    switch (entity.type) {
      case "agent":
        return "agent";
      case "faction":
        return "faction";
      case "resource":
        return "resource";
      case "location":
        return entity.tags.includes("region") ? "region" : "location";
    }
  }

  insertEntity(entity: EntityState): void {
    this.state.entities[entity.id] = entity;
    this.patch.markEntity(entity.id);
  }

  // --- 읽기 -----------------------------------------------------------------

  read(entityId: string, stateKey: string): unknown {
    const entity = this.entity(entityId);
    const ownerType = this.ownerTypeOf(entity);
    this.schemas.require(ownerType, stateKey);
    if (this.schemas.isDerived(ownerType, stateKey)) {
      return this.schemas.computeDerived(ownerType, stateKey, (key) => entity.states[key]);
    }
    return entity.states[stateKey];
  }

  readNumber(entityId: string, stateKey: string): number {
    const value = this.read(entityId, stateKey);
    if (typeof value !== "number") {
      throw new Error(`숫자 상태가 아님: ${entityId}.${stateKey} (${String(value)})`);
    }
    return value;
  }

  readBoolean(entityId: string, stateKey: string): boolean {
    return this.read(entityId, stateKey) === true;
  }

  // --- 쓰기 -----------------------------------------------------------------

  /**
   * 상태 변경 단일 경로.
   * derived 상태 쓰기, 미등록 키 쓰기, 타입 불일치는 전부 오류다 (Phase-1 §1.1).
   */
  modify(entityId: string, stateKey: string, op: StateOperation, value: unknown): void {
    const entity = this.entity(entityId);
    const ownerType = this.ownerTypeOf(entity);
    const schema = this.schemas.require(ownerType, stateKey);
    if (schema.updatePolicy === "derived") {
      throw new Error(`파생 상태는 쓸 수 없다: ${ownerType}.${stateKey} (§9 updatePolicy=derived)`);
    }

    const before = entity.states[stateKey];
    let next: unknown;
    if (op === "set") {
      next = value;
    } else {
      if (typeof before !== "number" || typeof value !== "number") {
        throw new Error(`${op} 연산은 숫자 상태에만 쓸 수 있다: ${entityId}.${stateKey}`);
      }
      next = op === "add" ? before + value : before * value;
    }
    const coerced = this.schemas.coerce(schema, next);
    if (Object.is(coerced, before)) return; // 실제 변화 없음 — 기록도 트리거도 없다

    entity.states[stateKey] = coerced;
    this.patch.markEntity(entityId);
    this.recordChange({ entityId, stateKey, before, after: coerced });
  }

  /** 위치 이동 (§13) — 상태와 같은 경로로 기록해 사건 탐지가 놓치지 않게 한다 */
  moveEntity(entityId: string, position: Position): void {
    const entity = this.entity(entityId);
    const before = entity.position;
    entity.position = { ...position };
    this.patch.markEntity(entityId);
    this.recordChange({
      entityId,
      stateKey: "position",
      before: before === undefined ? undefined : { ...before },
      after: { ...position },
    });
  }

  setActiveGoals(entityId: string, goals: ActiveGoalState[]): void {
    const entity = this.entity(entityId);
    entity.activeGoals = goals;
    this.patch.markEntity(entityId);
  }

  // --- 전역 상태 (ownerType="world") -----------------------------------------

  readGlobal(stateKey: string): unknown {
    this.schemas.require("world", stateKey);
    return this.state.globalStates[stateKey];
  }

  setGlobal(stateKey: string, value: unknown): void {
    const schema = this.schemas.require("world", stateKey);
    if (schema.updatePolicy === "derived") {
      throw new Error(`파생 상태는 쓸 수 없다: world.${stateKey}`);
    }
    const coerced = this.schemas.coerce(schema, value);
    if (Object.is(coerced, this.state.globalStates[stateKey])) return;
    this.state.globalStates[stateKey] = coerced;
    this.patch.markGlobal(stateKey);
  }

  // --- 변경 맥락 (§28) --------------------------------------------------------

  /**
   * fn 안에서 일어난 모든 상태 변화를 하나의 RawWorldChange 로 묶는다.
   * 중첩되면 태그를 물려받는다 — "행동 안에서 실행된 규칙"의 변화가 어떤 행동에서 나왔는지 남는다.
   */
  withContext<T>(context: ChangeContext, fn: () => T): T {
    const parent = this.contextStack[this.contextStack.length - 1];
    if (parent !== undefined) {
      context = { ...context, tags: [...parent.context.tags, ...context.tags] };
    }
    this.contextStack.push({ context, changes: [] });
    try {
      return fn();
    } finally {
      const open = this.contextStack.pop()!;
      if (open.changes.length > 0) this.appendChangeLog(open.context, open.changes);
    }
  }

  /**
   * 개체 상태가 아닌 변화(믿음 갱신 등)를 사건 로그에만 남긴다.
   * state_changed 트리거 큐에는 넣지 않는다 — 규칙 트리거는 등록된 상태 키에만 반응한다.
   */
  noteChange(change: StateChange): void {
    const open = this.contextStack[this.contextStack.length - 1];
    if (open === undefined) this.appendChangeLog({ tags: ["uncontextualized"] }, [change]);
    else open.changes.push(change);
  }

  private recordChange(change: StateChange): void {
    this.pendingStateChanges.push(change);
    const open = this.contextStack[this.contextStack.length - 1];
    if (open === undefined) {
      // 맥락 없는 변경 — 부트스트랩 등. 단건으로 기록한다.
      this.appendChangeLog({ tags: ["uncontextualized"] }, [change]);
      return;
    }
    open.changes.push(change);
  }

  private appendChangeLog(context: ChangeContext, changes: StateChange[]): void {
    const record: RawWorldChange = {
      time: this.state.simulationTime,
      targetIds: context.targetIds ?? [],
      tags: context.tags,
      changedStates: changes,
    };
    if (context.sourceId !== undefined) record.sourceId = context.sourceId;
    if (context.locationId !== undefined) record.locationId = context.locationId;
    this.state.changeLog.push(record);
    if (this.state.changeLog.length > MAX_CHANGE_LOG) {
      this.state.changeLog.splice(0, this.state.changeLog.length - MAX_CHANGE_LOG);
    }
  }

  // --- state_changed 트리거 큐 -------------------------------------------------

  /** 마지막 호출 이후 발생한 상태 변화를 가져가고 큐를 비운다 (§11.1 state_changed 디스패치) */
  takeStateChanges(): StateChangeSignal[] {
    const changes = this.pendingStateChanges;
    this.pendingStateChanges = [];
    return changes;
  }
}
