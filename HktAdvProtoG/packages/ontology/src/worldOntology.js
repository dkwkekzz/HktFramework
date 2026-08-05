// O1~O2 — 공통 세계 존재론과 상태 스키마 v1.
// 존재론: 세계 요소(장소·경로·주체 원형·역할·자원·제작물·사건 타입)의 정식 어휘.
// 상태 스키마: 정식 세계 상태의 형태 — 보존 공리의 `state.resources` 관례를 여기서 고정한다.
import { stateHash } from '../../verification/src/deterministic.js';

export const ENTITY_KINDS = [
  'place', 'route', 'subject-archetype', 'player-role', 'resource', 'craft-item', 'event-type',
];

export const ACTOR_KINDS = ['individual', 'organization', 'population'];

export class WorldOntology {
  #entities = new Map(); // kind → Map(id → attrs)

  constructor() { for (const k of ENTITY_KINDS) this.#entities.set(k, new Map()); }

  addEntity(kind, entity) {
    if (!ENTITY_KINDS.includes(kind)) throw new Error(`미지 존재론 종류: ${kind}`);
    if (!entity?.id) throw new Error(`존재론 요소에 id 필수 (${kind})`);
    const bucket = this.#entities.get(kind);
    if (bucket.has(entity.id)) throw new Error(`중복 존재론 요소: ${kind}/${entity.id}`);
    if (kind === 'subject-archetype' && !ACTOR_KINDS.includes(entity.actorKind))
      throw new Error(`주체 원형 ${entity.id} 의 actorKind 불량: ${entity.actorKind}`);
    if (kind === 'craft-item') {
      if (!Array.isArray(entity.inputs) || entity.inputs.length === 0)
        throw new Error(`제작물 ${entity.id} 는 소비 입력이 필요하다 (자원·비용 보존 공리)`);
    }
    bucket.set(entity.id, structuredClone(entity));
  }

  has(kind, id) { return this.#entities.get(kind)?.has(id) ?? false; }
  get(kind, id) {
    const e = this.#entities.get(kind)?.get(id);
    if (!e) throw new Error(`미등록 존재론 요소: ${kind}/${id}`);
    return structuredClone(e);
  }
  listByKind(kind) {
    if (!ENTITY_KINDS.includes(kind)) throw new Error(`미지 존재론 종류: ${kind}`);
    return [...this.#entities.get(kind).values()].map((e) => structuredClone(e));
  }
  idsByKind(kind) { return this.listByKind(kind).map((e) => e.id).sort(); }

  /** 등록 순서와 무관한 결정적 스냅샷 */
  snapshot() {
    const body = {};
    for (const kind of ENTITY_KINDS)
      body[kind] = this.listByKind(kind).sort((a, b) => a.id.localeCompare(b.id));
    return { ...body, hash: stateHash(body) };
  }
}

export const WORLD_STATE_SCHEMA_VERSION = 1;
const STATE_REQUIRED_KEYS = ['schemaVersion', 'tick', 'region', 'subjects', 'resources', 'ownership', 'contracts', 'observedPaths'];

/** 재고를 가질 수 있는 것 = 원자재(resource) + 제작물(craft-item). 둘 다 state.resources 에 산다 */
export function stockableIds(ontology) {
  return [...ontology.idsByKind('resource'), ...ontology.idsByKind('craft-item')].sort();
}

/** 스키마 v1 을 따르는 빈 정식 세계 상태 — 재고 가능한 전 품목을 0 으로 초기화 */
export function createInitialWorldState(ontology) {
  const resources = {};
  for (const id of stockableIds(ontology)) resources[id] = 0;
  return {
    schemaVersion: WORLD_STATE_SCHEMA_VERSION,
    tick: 0,
    region: { places: {}, routes: {} },
    subjects: {},
    resources,
    ownership: {},
    contracts: {},
    observedPaths: [],
  };
}

/** SC-C01-O-01 — 스키마 위반 요소 거부. 오류 목록 반환 (빈 배열 = 통과) */
export function validateWorldState(state, ontology) {
  const errors = [];
  if (state?.schemaVersion !== WORLD_STATE_SCHEMA_VERSION)
    errors.push(`schemaVersion 불량: ${state?.schemaVersion} (기대 ${WORLD_STATE_SCHEMA_VERSION})`);
  for (const k of STATE_REQUIRED_KEYS) if (state?.[k] === undefined) errors.push(`상태 필수 키 누락: ${k}`);
  if (errors.length) return errors;

  const stockable = new Set(stockableIds(ontology));
  for (const id of Object.keys(state.resources))
    if (!stockable.has(id)) errors.push(`미등록 자원 재고: ${id}`);
  for (const [id, qty] of Object.entries(state.resources))
    if (!Number.isFinite(qty) || qty < 0) errors.push(`자원 수량 불량: ${id}=${qty}`);
  for (const id of Object.keys(state.region.places))
    if (!ontology.has('place', id)) errors.push(`미등록 장소: ${id}`);
  for (const id of Object.keys(state.region.routes))
    if (!ontology.has('route', id)) errors.push(`미등록 경로: ${id}`);
  for (const [id, s] of Object.entries(state.subjects))
    if (!ontology.has('subject-archetype', s?.archetype)) errors.push(`미등록 원형의 주체: ${id} (${s?.archetype})`);
  if (!Number.isInteger(state.tick) || state.tick < 0) errors.push(`tick 불량: ${state.tick}`);
  return errors;
}
