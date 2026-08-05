// Q0·Q1·Q2·Q3 — 세계 요구 추출, 성공 결과와 세계 조건 분리, 범위·중요도 평가, 근거 추적.
//
// 원칙: 요구는 "있으면 좋은 것"이 아니라 **어떤 전략이 성립하려면 세계가 미리 갖춰야 하는 조건**이다.
// 근거(derivedFrom) 없는 요구는 임의 배치이며 lint 오류로 잡는다.
import { stableSort, stateHash } from '../../verification/src/deterministic.js';

export const REQUIREMENT_KINDS = ['space', 'resource', 'rule', 'information', 'counterpart'];

export function makeRequirement({ id, kind, ref, description }) {
  if (!id) throw new Error('요구에 id 필수');
  if (!REQUIREMENT_KINDS.includes(kind)) throw new Error(`요구 ${id} 의 미지 종류: ${kind}`);
  if (!ref) throw new Error(`요구 ${id} 에 지시 대상(ref) 필수`);
  if (!description) throw new Error(`요구 ${id} 에 설명 필수`);
  return { id, kind, ref, description };
}

/**
 * Q0·Q1 — 전략 하나에서 세계 조건과 성공 결과를 분리해 뽑는다.
 * extractor(strategy) → { conditions: [makeRequirement…], outcomes: [{effect, at}] }
 */
export function extractFromStrategy(strategy, extractor) {
  const { conditions = [], outcomes = [] } = extractor(strategy) ?? {};
  if (conditions.length === 0)
    throw new Error(`세계 조건이 없는 전략: ${strategy.id} — 아무 조건 없이 성립하는 전략은 없다`);
  return { conditions, outcomes };
}

/**
 * Q0~Q3 — 카탈로그 전체의 요구 그래프.
 * 같은 요구를 여러 전략이 부르면 근거가 누적되고, 그 수가 요구의 범위(scope)가 된다.
 */
export function buildRequirementGraph(catalog, extractor) {
  const byId = new Map();
  const outcomes = [];
  for (const strategy of stableSort([...catalog], (a, b) => a.id.localeCompare(b.id))) {
    const { conditions, outcomes: outs } = extractFromStrategy(strategy, extractor);
    for (const req of conditions) {
      const entry = byId.get(req.id) ?? { ...req, derivedFrom: [] };
      entry.derivedFrom.push({
        strategy: strategy.id,
        dependencyKind: strategy.kind,
        actors: [...(strategy.actors.archetypes ?? []), ...(strategy.actors.roles ?? []).map((r) => `player:${r}`)].sort(),
        interventionFamily: strategy.interventionFamily,
      });
      byId.set(req.id, entry);
    }
    for (const o of outs) outcomes.push({ strategy: strategy.id, ...o });
  }
  const requirements = stableSort([...byId.values()], (a, b) => a.id.localeCompare(b.id))
    .map((r) => ({
      ...r,
      derivedFrom: stableSort(r.derivedFrom, (a, b) => a.strategy.localeCompare(b.strategy)),
      scope: r.derivedFrom.length,
    }));
  return { requirements, outcomes: stableSort(outcomes, (a, b) => a.strategy.localeCompare(b.strategy)), hash: stateHash({ requirements }) };
}

/**
 * Q2 — 중요도는 세계 상태에서 온다. 그 요구를 부르는 전략의 의존 계열이
 * 지금 실제로 얼마나 결핍되어 있는가를 합산한다 (수행 가능한 주체의 압력만 센다).
 */
export function scoreRequirements(graph, { evaluation, subjects }) {
  const pressureOf = (dependencyKind, actorKeys) => {
    let total = 0;
    for (const s of Object.values(subjects)) {
      const key = s.role ? `player:${s.role}` : s.archetype;
      if (!actorKeys.includes(key)) continue;
      total += evaluation.byHolder[s.id]?.kinds?.[dependencyKind] ?? 0;
    }
    return total;
  };
  const requirements = graph.requirements.map((r) => {
    const importance = r.derivedFrom.reduce((sum, d) => sum + pressureOf(d.dependencyKind, d.actors), 0);
    return { ...r, importance: Number(importance.toFixed(4)) };
  });
  return {
    ...graph,
    requirements: stableSort(requirements, (a, b) => b.importance - a.importance || a.id.localeCompare(b.id)),
  };
}

/** SC-C01-Q-01 — 근거 없는 요구, 요구를 못 내는 전략은 lint 오류다 */
export function validateRequirementGraph(graph, catalog) {
  const errors = [];
  for (const r of graph.requirements) {
    if (!r.derivedFrom.length) errors.push(`근거 없는 요구: ${r.id}`);
    for (const d of r.derivedFrom) {
      if (!catalog.some((s) => s.id === d.strategy)) errors.push(`미지 전략을 근거로 든 요구: ${r.id} ← ${d.strategy}`);
      if (!d.dependencyKind) errors.push(`의존 근거 없는 요구: ${r.id} ← ${d.strategy}`);
      if (!d.actors.length) errors.push(`수행 주체 없는 요구 근거: ${r.id} ← ${d.strategy}`);
    }
  }
  const covered = new Set(graph.requirements.flatMap((r) => r.derivedFrom.map((d) => d.strategy)));
  for (const s of catalog) if (!covered.has(s.id)) errors.push(`세계 요구를 내지 않는 전략: ${s.id}`);
  return errors;
}

/** Q3 — 하나의 요구를 사람이 읽는 근거 사슬로 펼친다 (요구 ← 전략 ← 의존 계열 ← 주체) */
export function explainRequirement(graph, requirementId) {
  const r = graph.requirements.find((x) => x.id === requirementId);
  if (!r) throw new Error(`미지 요구: ${requirementId}`);
  return {
    requirement: r.id,
    kind: r.kind,
    ref: r.ref,
    description: r.description,
    chains: r.derivedFrom.map((d) =>
      `${r.id} ← ${d.strategy} (${d.dependencyKind} 대응${d.interventionFamily ? `, 개입군 ${d.interventionFamily}` : ''}) ← ${d.actors.join('·')}`),
  };
}
