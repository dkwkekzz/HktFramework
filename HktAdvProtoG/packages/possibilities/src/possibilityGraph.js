// P0·P1·P2·P3·P4·P5 — 행동 원자, 의존 대응 전략, 가능성 문법, 지연 확장, 목적 선택·유지, 행동 계획.
//
// 원칙:
// - 전략은 주체가 실제로 가진 행동 후보(S 계층 profile.behaviors)로만 구성될 수 있다 (P2 가능성 문법).
// - 후보는 활성 목적의 의존 계열에 대해서만 펼친다 (P3 지연 확장).
// - 선택은 이득·비용·위험의 명시적 점수로 하고, 모든 후보의 점수를 설명으로 남긴다 (설명 가능성).
import { stableSort, stateHash } from '../../verification/src/deterministic.js';
import { DEPENDENCY_KINDS } from '../../dependencies/src/dependencyGraph.js';

/** P0 — 행동 원자: 주체의 행동 후보 하나를 세계 효과와 함께 지칭한다 */
export function makeAtom({ behavior, effect }) {
  if (!behavior) throw new Error('행동 원자에 behavior 필수');
  if (!effect) throw new Error(`행동 원자 ${behavior} 에 effect 필수`);
  return { behavior, effect };
}

/**
 * P1·P2 — 의존 대응 전략.
 * actors: {archetypes?: [], roles?: []} — 이 전략을 쓸 수 있는 주체
 * estimate: (ctx, subject, pressureRow) → {gain, cost, risk}
 */
export function makeStrategy({ id, kind, actors, atoms, target = null, estimate, interventionFamily = null, rationale }) {
  if (!id) throw new Error('전략에 id 필수');
  if (!DEPENDENCY_KINDS.includes(kind)) throw new Error(`전략 ${id} 의 미지 의존 계열: ${kind}`);
  if (!atoms?.length) throw new Error(`전략 ${id} 에 행동 원자 필수`);
  if (typeof estimate !== 'function') throw new Error(`전략 ${id} 에 estimate 필수`);
  if (!rationale) throw new Error(`전략 ${id} 에 근거 필수`);
  if (!(actors?.archetypes?.length || actors?.roles?.length)) throw new Error(`전략 ${id} 에 수행 주체 필수`);
  return { id, kind, actors, atoms, target, estimate, interventionFamily, rationale };
}

/** 주체가 이 전략의 수행 자격과 행동 후보를 전부 갖췄는가 (P2 가능성 문법) */
export function canPerform(subject, strategy) {
  const byArchetype = strategy.actors.archetypes?.includes(subject.archetype) ?? false;
  const byRole = subject.role ? (strategy.actors.roles?.includes(subject.role) ?? false) : false;
  if (!byArchetype && !byRole) return false;
  const owned = new Set(subject.behaviors ?? []);
  return strategy.atoms.every((a) => owned.has(a.behavior));
}

/** P3 — 지연 확장: 활성 목적의 계열에 대해서만 후보를 펼친다 */
export function expandCandidates(catalog, subject, kind) {
  return stableSort(catalog.filter((s) => s.kind === kind && canPerform(subject, s)), (a, b) => a.id.localeCompare(b.id));
}

/** 절박할수록 이득을 크게 친다 — 굶주린 주체가 위험을 감수하는 이유 */
export function scoreOf({ gain, cost, risk }, pressure) {
  return gain * (1 + pressure) - cost - risk;
}

/**
 * P4 — 목적 선택과 유지.
 * 지배 결핍을 목적으로 삼되, 직전 목적이 있으면 hysteresis 만큼 넘어야 갈아탄다 (목적 흔들림 방지).
 */
export function selectGoal(holderPressure, previousGoal = null, { hysteresis = 0.15 } = {}) {
  const ranked = stableSort(Object.entries(holderPressure?.kinds ?? {}), (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [topKind, topPressure] = ranked[0] ?? [null, 0];
  if (!topKind || topPressure <= 0) return { kind: null, pressure: 0, kept: false, reason: '결핍 없음' };
  if (previousGoal && previousGoal !== topKind) {
    const prev = holderPressure.kinds[previousGoal] ?? 0;
    if (prev > 0 && topPressure - prev < hysteresis)
      return { kind: previousGoal, pressure: prev, kept: true, reason: `유지 (${topKind} 와 격차 ${(topPressure - prev).toFixed(2)} < ${hysteresis})` };
  }
  return { kind: topKind, pressure: topPressure, kept: previousGoal === topKind, reason: '최대 결핍' };
}

/**
 * P5 — 전략 선택과 행동 계획. 모든 후보의 점수를 설명으로 남긴다.
 * 반환 null = 목적 없음(결핍 없음). candidates 가 비면 chosen 없이 이유를 남긴다.
 */
export function planFor({ catalog, subject, ctx, pressures, holderPressure, previousGoal = null, goalOptions }) {
  const goal = selectGoal(holderPressure, previousGoal, goalOptions);
  if (!goal.kind) return { subject: subject.id, goal, candidates: [], chosen: null, reason: goal.reason };

  const row = pressures.find((p) => p.holder === subject.id && p.kind === goal.kind) ?? null;
  const candidates = expandCandidates(catalog, subject, goal.kind).map((s) => {
    const est = s.estimate(ctx, subject, row);
    return {
      id: s.id, target: s.target, interventionFamily: s.interventionFamily, rationale: s.rationale,
      atoms: s.atoms.map((a) => a.behavior), effects: s.atoms.map((a) => a.effect),
      ...est, score: scoreOf(est, goal.pressure),
    };
  });
  const ranked = stableSort(candidates, (a, b) => b.score - a.score || a.id.localeCompare(b.id));
  // 이득이 0 인 수단만 남았다면 계획을 세우지 않는다 — "결핍은 있으나 지금 쓸 방법이 없다"
  const chosen = ranked.find((c) => c.gain > 0) ?? null;
  return {
    subject: subject.id,
    archetype: subject.role ? `player:${subject.role}` : subject.archetype,
    goal,
    candidates: ranked,
    chosen,
    reason: chosen
      ? `${chosen.id}: 이득 ${chosen.gain} x 절박도 ${(1 + goal.pressure).toFixed(2)} − 비용 ${chosen.cost} − 위험 ${chosen.risk} = ${chosen.score.toFixed(2)}`
      : ranked.length
        ? `${goal.kind} 결핍에 실효 있는 수단 없음 (후보 ${ranked.length}건 전부 이득 0)`
        : `${goal.kind} 결핍에 쓸 수 있는 전략 없음`,
  };
}

/** 배역 전체의 계획 — 결정적 순서로 낸다 */
export function planAll({ catalog, ctx, evaluation, previousGoals = {}, goalOptions }) {
  const plans = Object.values(ctx.subjects)
    .map((subject) => planFor({
      catalog, subject, ctx,
      pressures: evaluation.pressures,
      holderPressure: evaluation.byHolder[subject.id],
      previousGoal: previousGoals[subject.id] ?? null,
      goalOptions,
    }));
  const sorted = stableSort(plans, (a, b) => a.subject.localeCompare(b.subject));
  return { plans: sorted, hash: stateHash(sorted.map((p) => ({ s: p.subject, g: p.goal.kind, c: p.chosen?.id ?? null }))) };
}

/** 카탈로그 정합 — 원자를 실제로 가진 주체가 없는 전략은 죽은 출력이다 */
export function validateCatalog(catalog, sampleSubjects) {
  const errors = [];
  const seen = new Set();
  for (const s of catalog) {
    if (seen.has(s.id)) errors.push(`중복 전략 id: ${s.id}`);
    seen.add(s.id);
    if (!sampleSubjects.some((subj) => canPerform(subj, s)))
      errors.push(`수행 가능한 주체가 없는 전략: ${s.id} (원자 ${s.atoms.map((a) => a.behavior).join(',')})`);
  }
  return errors;
}
