// W0·W1·W2·W3·W4·W5·W6 — 요구 정규화, 다중 주체 요구 병합, 규칙·상태·공간 실체화,
// 압축 역사, 잠재/암시/정식/관찰 상태 구분.
//
// 원칙: 세계 요소는 요구에서만 나온다. 근거(calledBy) 없는 요소는 만들 수 없고,
// 관찰된 요소는 사건 없이 바뀌지 않는다 (관찰 세계 고정 공리).
import { stableSort, stateHash } from '../../verification/src/deterministic.js';
import { validateWorldProposal } from '../../ontology/src/axioms.js';

/** W0 — 요구 정규화: 종류·대상만 남기고 근거를 접는다 */
export function normalizeRequirements(graph) {
  return stableSort(graph.requirements.map((r) => ({
    id: r.id, kind: r.kind, ref: r.ref, description: r.description,
    calledBy: r.derivedFrom.map((d) => d.strategy),
    actors: [...new Set(r.derivedFrom.flatMap((d) => d.actors))].sort(),
    dependencyKinds: [...new Set(r.derivedFrom.map((d) => d.dependencyKind))].sort(),
  })), (a, b) => a.id.localeCompare(b.id));
}

/**
 * W1 — 다중 주체 요구 병합: 같은 (종류, 대상) 요구는 하나의 세계 요소가 된다.
 * 여러 주체가 같은 장소를 요구하면 장소가 여러 개 생기는 것이 아니라 하나로 합쳐진다.
 */
export function mergeRequirements(normalized) {
  const byRef = new Map();
  for (const r of normalized) {
    const key = `${r.kind}:${r.ref}`;
    const entry = byRef.get(key) ?? { kind: r.kind, ref: r.ref, requirementIds: [], calledBy: [], actors: [], dependencyKinds: [] };
    entry.requirementIds.push(r.id);
    entry.calledBy.push(...r.calledBy);
    entry.actors.push(...r.actors);
    entry.dependencyKinds.push(...r.dependencyKinds);
    byRef.set(key, entry);
  }
  return stableSort([...byRef.values()].map((e) => ({
    ...e,
    requirementIds: [...new Set(e.requirementIds)].sort(),
    calledBy: [...new Set(e.calledBy)].sort(),
    actors: [...new Set(e.actors)].sort(),
    dependencyKinds: [...new Set(e.dependencyKinds)].sort(),
  })), (a, b) => `${a.kind}:${a.ref}`.localeCompare(`${b.kind}:${b.ref}`));
}

/** 요소 상태 구분 (W6) */
export const ELEMENT_STATES = ['latent', 'implied', 'canonical', 'observed'];

export class CanonicalWorld {
  constructor({ places, routes, rules, resources, history, merged, seed }) {
    this.seed = seed;
    this.places = places;
    this.routes = routes;
    this.rules = rules;
    this.resources = resources;
    this.history = history;
    this.merged = merged;
    this.observedPaths = [];
  }

  /** W6 — 요소 분류: 요구가 없으면 잠재, 요구는 있으나 실체 없으면 암시, 실체화되면 정식, 관찰되면 관찰 */
  classify(kind, ref) {
    const called = this.merged.some((m) => m.kind === kind && m.ref === ref && m.calledBy.length > 0);
    const realized = kind === 'space' ? (ref in this.places || ref in this.routes)
      : kind === 'rule' ? ref in this.rules
        : kind === 'resource' ? ref in this.resources : called;
    if (!called) return 'latent';
    if (!realized) return 'implied';
    return this.observedPaths.some((p) => p.startsWith(`region.places.${ref}`) || p.startsWith(`region.routes.${ref}`))
      ? 'observed' : 'canonical';
  }

  /** 요소의 존재 근거 — "이 장소는 왜 있는가" */
  provenance(kind, ref) {
    const m = this.merged.find((x) => x.kind === kind && x.ref === ref);
    if (!m) return null;
    return { requirementIds: m.requirementIds, calledBy: m.calledBy, actors: m.actors, dependencyKinds: m.dependencyKinds };
  }

  markObserved(paths) { for (const p of paths) if (!this.observedPaths.includes(p)) this.observedPaths.push(p); }

  hash() { return stateHash({ places: this.places, routes: this.routes, rules: this.rules, resources: this.resources, history: this.history }); }
}

/**
 * 세계 변경 제안은 공리 검증을 통과해야만 반영된다 (SC-C01-W-02·W-03).
 * 반환 {accepted, report}. 거부된 제안은 세계를 건드리지 않는다.
 */
export function proposeChange(world, proposal, axioms) {
  const report = validateWorldProposal({ proposal, observedPaths: world.observedPaths }, axioms);
  if (!report.passed) return { accepted: false, report };
  for (const c of proposal.creates ?? []) {
    if (c.kind === 'space') world.places[c.ref] = { ...(world.places[c.ref] ?? {}), ...c.attrs };
    if (c.kind === 'rule') world.rules[c.ref] = c.attrs;
    if (c.kind === 'resource') world.resources[c.ref] = c.attrs?.stock ?? 0;
  }
  return { accepted: true, report };
}

/** 근거 없는 세계 요소는 임의 배치다 — lint 오류 */
export function validateWorld(world) {
  const errors = [];
  for (const id of Object.keys(world.places))
    if (!world.provenance('space', id)) errors.push(`요구 근거 없는 장소: ${id}`);
  for (const id of Object.keys(world.routes))
    if (!world.provenance('space', id)) errors.push(`요구 근거 없는 경로: ${id}`);
  for (const id of Object.keys(world.rules))
    if (!world.provenance('rule', id)) errors.push(`요구 근거 없는 규칙: ${id}`);
  for (const id of Object.keys(world.resources))
    if (!world.provenance('resource', id)) errors.push(`요구 근거 없는 자원: ${id}`);
  for (const h of world.history)
    if (!h.causes?.length) errors.push(`원인 없는 역사: ${h.id}`);
  return errors;
}
