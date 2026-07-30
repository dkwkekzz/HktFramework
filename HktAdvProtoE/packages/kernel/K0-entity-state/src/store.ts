import { sha256Tagged, type VerificationIssue } from '@hkt/v0-module-contract';
import { canonicalJson } from '@hkt/v1-schema';
import { ComponentRegistry } from './components.js';
import { StoreRejection } from './errors.js';
import {
  NAME_PATTERN,
  STORE_ISSUE,
  type ComponentSnapshot,
  type ComponentType,
  type EntityId,
  type EntitySpec,
  type EntityState,
  type JsonObject,
  type JsonValue,
} from './types.js';

/** 소유권 컴포넌트의 이름. GI-11(고유 자원의 중복 소유 금지)의 감사 대상이다. */
export const OWNERSHIP_COMPONENT = 'ownership';

/** 저장소 내부 표현. 밖으로 나가지 않는다. */
interface EntityRecord {
  readonly id: EntityId;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly components: ReadonlyMap<ComponentType, JsonObject>;
}

/**
 * 실체·상태 저장소 (원문 「9」 K0).
 *
 * ## 왜 불변인가
 *
 * 원문 「9」 K0 의 금지 사항은 "다른 모듈이 내부 Map을 직접 수정하는 것"이다. 잠금이나 규약으로
 * 막으면 언젠가 뚫린다 — 그래서 **고칠 수 있는 손잡이 자체를 만들지 않는다.** 모든 변경은 새 저장소를
 * 돌려주고, 읽기는 동결된 사본만 내보낸다. 거부된 연산은 원본을 그대로 돌려주므로(같은 참조),
 * "실패했는데 절반만 반영되었다"가 구조적으로 불가능하다.
 */
export class EntityStore {
  readonly registry: ComponentRegistry;
  readonly #entities: ReadonlyMap<EntityId, EntityRecord>;
  readonly #byKind: ReadonlyMap<string, readonly EntityId[]>;
  readonly #byComponent: ReadonlyMap<ComponentType, readonly EntityId[]>;

  private constructor(
    registry: ComponentRegistry,
    entities: ReadonlyMap<EntityId, EntityRecord>,
    byKind: ReadonlyMap<string, readonly EntityId[]>,
    byComponent: ReadonlyMap<ComponentType, readonly EntityId[]>,
  ) {
    this.registry = registry;
    this.#entities = entities;
    this.#byKind = byKind;
    this.#byComponent = byComponent;
  }

  static empty(registry: ComponentRegistry = ComponentRegistry.of()): EntityStore {
    return new EntityStore(registry, new Map(), new Map(), new Map());
  }

  // -------------------------------------------------------------------------
  // 읽기 — 동결된 사본만 내보낸다
  // -------------------------------------------------------------------------

  get size(): number {
    return this.#entities.size;
  }

  has(id: EntityId): boolean {
    return this.#entities.has(id);
  }

  /** 실체 하나의 완전한 상태. 없으면 `null` — 빈 객체를 돌려주지 않는다. */
  get(id: EntityId): EntityState | null {
    const record = this.#entities.get(id);
    return record ? toState(record) : null;
  }

  /** 없으면 거부한다. 조회 실패를 조용히 넘기고 싶지 않은 자리에서 쓴다. */
  require(id: EntityId, at = `entity/${id}`): EntityState {
    const state = this.get(id);
    if (!state) {
      throw new StoreRejection(STORE_ISSUE.UNKNOWN_ENTITY, at, `없는 실체다: ${id}`);
    }
    return state;
  }

  /** 실체 id 오름차순 전체 목록. */
  ids(): EntityId[] {
    return [...this.#entities.keys()].sort();
  }

  list(): EntityState[] {
    return this.ids().map((id) => toState(this.#entities.get(id) as EntityRecord));
  }

  component(id: EntityId, type: ComponentType): JsonObject | null {
    return this.#entities.get(id)?.components.get(type) ?? null;
  }

  /** 타입별 인덱스 — 종류로 고른다. */
  byKind(kind: string): readonly EntityId[] {
    return this.#byKind.get(kind) ?? [];
  }

  /** 타입별 인덱스 — 컴포넌트 보유로 고른다. */
  withComponent(type: ComponentType): readonly EntityId[] {
    return this.#byComponent.get(type) ?? [];
  }

  kinds(): string[] {
    return [...this.#byKind.keys()].sort();
  }

  componentTypes(): ComponentType[] {
    return [...this.#byComponent.keys()].sort();
  }

  // -------------------------------------------------------------------------
  // 쓰기 — 언제나 새 저장소를 돌려준다
  // -------------------------------------------------------------------------

  spawn(spec: EntitySpec): EntityStore {
    assertName(spec.id, STORE_ISSUE.ID_FORMAT, `entity/${spec.id}`, '실체 id');
    assertName(spec.kind, STORE_ISSUE.KIND_FORMAT, `entity/${spec.id}/kind`, '실체 종류');
    if (this.#entities.has(spec.id)) {
      throw new StoreRejection(
        STORE_ISSUE.DUPLICATE_ID,
        `entity/${spec.id}`,
        `이미 있는 실체 id 다: ${spec.id}`,
      );
    }

    const tags = normalizeTags(spec.tags ?? [], `entity/${spec.id}/tags`);
    const components = new Map<ComponentType, JsonObject>();
    for (const type of Object.keys(spec.components ?? {}).sort()) {
      const data = (spec.components as Record<ComponentType, JsonObject>)[type] as JsonObject;
      this.registry.assertValid(type, data, `entity/${spec.id}/components/${type}`);
      components.set(type, deepFreeze(structuredCopy(data)));
    }

    const record: EntityRecord = Object.freeze({
      id: spec.id,
      kind: spec.kind,
      tags,
      components,
    });

    const entities = new Map(this.#entities);
    entities.set(spec.id, record);
    return new EntityStore(
      this.registry,
      entities,
      indexAdd(this.#byKind, spec.kind, spec.id),
      [...components.keys()].reduce(
        (index, type) => indexAdd(index, type, spec.id),
        this.#byComponent,
      ),
    );
  }

  despawn(id: EntityId): EntityStore {
    const record = this.#requireRecord(id, `entity/${id}`);
    const entities = new Map(this.#entities);
    entities.delete(id);
    return new EntityStore(
      this.registry,
      entities,
      indexRemove(this.#byKind, record.kind, id),
      [...record.components.keys()].reduce(
        (index, type) => indexRemove(index, type, id),
        this.#byComponent,
      ),
    );
  }

  /** 컴포넌트를 쓴다. 같은 종류를 다시 쓰면 **덮어쓴다** — 쌓이지 않는다(GI-11). */
  setComponent(id: EntityId, type: ComponentType, data: JsonObject): EntityStore {
    const at = `entity/${id}/components/${type}`;
    const record = this.#requireRecord(id, at);
    this.registry.assertValid(type, data, at);

    const components = new Map(record.components);
    const existed = components.has(type);
    components.set(type, deepFreeze(structuredCopy(data)));

    const entities = new Map(this.#entities);
    entities.set(id, Object.freeze({ ...record, components }));
    return new EntityStore(
      this.registry,
      entities,
      this.#byKind,
      existed ? this.#byComponent : indexAdd(this.#byComponent, type, id),
    );
  }

  removeComponent(id: EntityId, type: ComponentType): EntityStore {
    const at = `entity/${id}/components/${type}`;
    const record = this.#requireRecord(id, at);
    if (!record.components.has(type)) {
      throw new StoreRejection(STORE_ISSUE.MISSING_COMPONENT, at, `그 실체에 없는 컴포넌트다: ${type}`);
    }
    const components = new Map(record.components);
    components.delete(type);

    const entities = new Map(this.#entities);
    entities.set(id, Object.freeze({ ...record, components }));
    return new EntityStore(
      this.registry,
      entities,
      this.#byKind,
      indexRemove(this.#byComponent, type, id),
    );
  }

  attachTag(id: EntityId, tag: string): EntityStore {
    const at = `entity/${id}/tags`;
    const record = this.#requireRecord(id, at);
    assertName(tag, STORE_ISSUE.TAG_FORMAT, at, '태그');
    if (record.tags.includes(tag)) return this;

    const entities = new Map(this.#entities);
    entities.set(id, Object.freeze({ ...record, tags: normalizeTags([...record.tags, tag], at) }));
    return new EntityStore(this.registry, entities, this.#byKind, this.#byComponent);
  }

  removeTag(id: EntityId, tag: string): EntityStore {
    const at = `entity/${id}/tags`;
    const record = this.#requireRecord(id, at);
    if (!record.tags.includes(tag)) return this;

    const entities = new Map(this.#entities);
    entities.set(
      id,
      Object.freeze({ ...record, tags: Object.freeze(record.tags.filter((item) => item !== tag)) }),
    );
    return new EntityStore(this.registry, entities, this.#byKind, this.#byComponent);
  }

  // -------------------------------------------------------------------------
  // 스냅샷 · 해시 · 감사
  // -------------------------------------------------------------------------

  snapshot(): ComponentSnapshot {
    const entities = this.list();
    const byKind = mapToRecord(this.#byKind);
    const byComponent = mapToRecord(this.#byComponent);
    return Object.freeze({
      entities,
      byKind,
      byComponent,
      hash: sha256Tagged(canonicalJson({ entities, byKind, byComponent } as unknown as JsonValue)),
    });
  }

  /** 스냅샷 본문의 해시. 같은 내용이면 만들어진 경로와 무관하게 같다. */
  hash(): string {
    return this.snapshot().hash;
  }

  /** 스냅샷에서 저장소를 되살린다. 되살린 저장소의 해시는 원본과 같아야 한다. */
  static restore(
    snapshot: ComponentSnapshot,
    registry: ComponentRegistry = ComponentRegistry.of(),
  ): EntityStore {
    let store = EntityStore.empty(registry);
    for (const entity of [...snapshot.entities].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      store = store.spawn({
        id: entity.id,
        kind: entity.kind,
        tags: entity.tags,
        components: entity.components,
      });
    }
    return store;
  }

  /**
   * 저장소 스스로에 대한 감사.
   *
   * 인덱스는 쓰기마다 조금씩 갱신되므로 언젠가 실제 내용과 갈라질 수 있다. 갈라진 인덱스는
   * 질의(K1)를 조용히 틀리게 만든다 — 그래서 전수 재계산과 대조한다.
   */
  audit(): VerificationIssue[] {
    const issues: VerificationIssue[] = [];
    const at = (path: string, code: string, message: string): void => {
      issues.push({ code, path: `K0 저장소/${path}`, message });
    };

    const expectedKind = new Map<string, EntityId[]>();
    const expectedComponent = new Map<ComponentType, EntityId[]>();
    for (const id of this.ids()) {
      const record = this.#entities.get(id) as EntityRecord;
      if (record.id !== id) {
        at(`entity/${id}`, 'E_INVARIANT_entity_id_must_be_unique', `키 ${id} 와 내용 ${record.id} 가 다르다.`);
      }
      pushInto(expectedKind, record.kind, id);
      for (const type of record.components.keys()) pushInto(expectedComponent, type, id);
    }

    const compare = (
      label: string,
      actual: ReadonlyMap<string, readonly EntityId[]>,
      expected: ReadonlyMap<string, readonly EntityId[]>,
    ): void => {
      const keys = [...new Set([...actual.keys(), ...expected.keys()])].sort();
      for (const key of keys) {
        const left = JSON.stringify(actual.get(key) ?? []);
        const right = JSON.stringify(expected.get(key) ?? []);
        if (left !== right) {
          at(
            `${label}/${key}`,
            'E_INVARIANT_type_index_must_agree_with_store',
            `인덱스 ${left} · 전수 재계산 ${right}`,
          );
        }
      }
    };
    compare('byKind', this.#byKind, expectedKind);
    compare('byComponent', this.#byComponent, expectedComponent);

    // GI-11 — 소유권은 한 실체에 하나뿐이고(컴포넌트 키가 보장한다), 소유자는 실재해야 한다.
    for (const id of this.withComponent(OWNERSHIP_COMPONENT)) {
      const ownership = this.component(id, OWNERSHIP_COMPONENT);
      const ownerId = ownership?.['ownerId'];
      if (typeof ownerId !== 'string' || !this.has(ownerId)) {
        at(
          `entity/${id}/components/${OWNERSHIP_COMPONENT}/ownerId`,
          'E_INVARIANT_owned_entity_must_have_single_owner',
          `소유자 ${JSON.stringify(ownerId)} 가 세계에 없다 (GI-11).`,
        );
      }
    }

    return issues;
  }

  #requireRecord(id: EntityId, at: string): EntityRecord {
    const record = this.#entities.get(id);
    if (!record) {
      throw new StoreRejection(STORE_ISSUE.UNKNOWN_ENTITY, at, `없는 실체다: ${id}`);
    }
    return record;
  }
}

// ---------------------------------------------------------------------------

function toState(record: EntityRecord): EntityState {
  const components: Record<ComponentType, JsonObject> = {};
  for (const type of [...record.components.keys()].sort()) {
    components[type] = record.components.get(type) as JsonObject;
  }
  return Object.freeze({
    id: record.id,
    kind: record.kind,
    tags: record.tags,
    components: Object.freeze(components),
  });
}

function assertName(value: string, code: (typeof STORE_ISSUE)[keyof typeof STORE_ISSUE], at: string, label: string): void {
  if (typeof value !== 'string' || !NAME_PATTERN.test(value)) {
    throw new StoreRejection(code, at, `${label}는 소문자 snake_case 여야 한다: ${JSON.stringify(value)}`);
  }
}

function normalizeTags(tags: readonly string[], at: string): readonly string[] {
  for (const tag of tags) assertName(tag, STORE_ISSUE.TAG_FORMAT, at, '태그');
  return Object.freeze([...new Set(tags)].sort());
}

/** 입력을 그대로 들고 있지 않는다 — 넘겨준 쪽이 나중에 고쳐도 저장소가 흔들리지 않게 한다. */
function structuredCopy<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  return Object.freeze(value);
}

function indexAdd(
  index: ReadonlyMap<string, readonly EntityId[]>,
  key: string,
  id: EntityId,
): ReadonlyMap<string, readonly EntityId[]> {
  const next = new Map(index);
  const current = next.get(key) ?? [];
  if (current.includes(id)) return next;
  next.set(key, Object.freeze([...current, id].sort()));
  return next;
}

function indexRemove(
  index: ReadonlyMap<string, readonly EntityId[]>,
  key: string,
  id: EntityId,
): ReadonlyMap<string, readonly EntityId[]> {
  const next = new Map(index);
  const current = (next.get(key) ?? []).filter((item) => item !== id);
  if (current.length === 0) next.delete(key);
  else next.set(key, Object.freeze(current));
  return next;
}

function mapToRecord(index: ReadonlyMap<string, readonly EntityId[]>): Record<string, EntityId[]> {
  const out: Record<string, EntityId[]> = {};
  for (const key of [...index.keys()].sort()) out[key] = [...(index.get(key) as readonly EntityId[])];
  return out;
}

function pushInto(map: Map<string, EntityId[]>, key: string, id: EntityId): void {
  const current = map.get(key);
  if (current) current.push(id);
  else map.set(key, [id]);
}
