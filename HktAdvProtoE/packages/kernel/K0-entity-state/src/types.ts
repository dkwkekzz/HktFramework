/**
 * K0 의 계약 타입.
 *
 * 원문 「9」 K0 은 출력으로 `EntityState` 와 `ComponentSnapshot` 을 규정한다.
 * 여기서 정의하는 형태는 모두 **JSON 으로 표현 가능한 데이터**다 — 저장소에 함수를 담으면
 * 스냅샷을 뜰 수도, 재생할 수도 없다(GI-12).
 */

import type { JsonSchema } from '@hkt/v1-schema';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** 실체 id. 세계 안에서 유일하다. */
export type EntityId = string;
/** 컴포넌트 종류 이름 (`health` · `position` · `ownership` …). */
export type ComponentType = string;

/** 실체 하나의 완전한 읽기 사본 (원문 「9」 K0 의 `EntityState`). */
export interface EntityState {
  id: EntityId;
  kind: string;
  /** 오름차순 정렬 — 선언 순서가 결과를 바꾸지 않는다. */
  tags: readonly string[];
  /** 컴포넌트 종류 오름차순. 값은 모두 동결되어 있다. */
  components: Readonly<Record<ComponentType, JsonObject>>;
}

/** 저장소 전체의 읽기 사본 (원문 「9」 K0 의 `ComponentSnapshot`). */
export interface ComponentSnapshot {
  /** 실체 id 오름차순 */
  entities: EntityState[];
  /** 종류 → 그 종류의 실체 id (오름차순) */
  byKind: Record<string, EntityId[]>;
  /** 컴포넌트 종류 → 그 컴포넌트를 가진 실체 id (오름차순) */
  byComponent: Record<ComponentType, EntityId[]>;
  /** 위 세 항목의 정규 JSON 해시. 같은 내용이면 만들어진 경로와 무관하게 같다. */
  hash: string;
}

/** 컴포넌트 종류 선언. 스키마를 주면 쓰기 시점에 V1 이 형식을 강제한다. */
export interface ComponentDefinition {
  type: ComponentType;
  /** 사람이 읽는 설명 — 판정에 쓰지 않는다. */
  title?: string;
  schema: JsonSchema;
}

/** 실체 생성 명세. */
export interface EntitySpec {
  id: EntityId;
  kind: string;
  tags?: readonly string[];
  components?: Readonly<Record<ComponentType, JsonObject>>;
}

/**
 * 저장소 연산 — 데이터 AST 다.
 *
 * 원문 「23」이 "임의 실행 코드를 콘텐츠 데이터에 삽입"을 금지하므로, 상태 변경 요청도 함수가 아니라
 * 데이터로 적는다. 그래야 사건 로그(K3)에 그대로 실려 재생될 수 있다.
 */
export type StoreOperation =
  | { op: 'spawn'; id: EntityId; kind: string; tags?: readonly string[]; components?: Readonly<Record<ComponentType, JsonObject>> }
  | { op: 'despawn'; id: EntityId }
  | { op: 'set_component'; id: EntityId; type: ComponentType; data: JsonObject }
  | { op: 'remove_component'; id: EntityId; type: ComponentType }
  | { op: 'attach_tag'; id: EntityId; tag: string }
  | { op: 'remove_tag'; id: EntityId; tag: string };

export const STORE_ISSUE = {
  DUPLICATE_ID: 'E_DUPLICATE_ENTITY_ID',
  UNKNOWN_ENTITY: 'E_UNKNOWN_ENTITY',
  UNKNOWN_COMPONENT_TYPE: 'E_UNKNOWN_COMPONENT_TYPE',
  COMPONENT_SCHEMA: 'E_COMPONENT_SCHEMA',
  ID_FORMAT: 'E_ENTITY_ID_FORMAT',
  KIND_FORMAT: 'E_ENTITY_KIND_FORMAT',
  TAG_FORMAT: 'E_TAG_FORMAT',
  MISSING_COMPONENT: 'E_MISSING_COMPONENT',
  UNKNOWN_OPERATION: 'E_UNKNOWN_OPERATION',
} as const;

export type StoreIssueCode = (typeof STORE_ISSUE)[keyof typeof STORE_ISSUE];

/** 실체 id · 종류 · 컴포넌트 종류의 공통 표기. 사건 로그와 경로 표기에 그대로 실린다. */
export const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
