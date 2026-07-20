// =====================================================================
// 재해석 스캐너 (step E1)
// ---------------------------------------------------------------------
// 세계는 재료를 생성하지 않는다 — 재해석한다 (불변 원칙 ④). demand 가 주어지면
// **이미 존재하는** 세계 요소를 속성 매칭으로 스캔해 Stage 후보(§4.5)로 감싼다.
// supplies·obstacles 는 요소의 실제 속성·주변 상태에서 파생한다 — 발명하지 않는다.
// 스캐너는 읽기 전용이며, 후보의 발견은 C1 경로(정보 재료)로만 — 스캔 결과가 곧바로
// BeliefView 에 꽂히지 않는다.
// (Design-StepPlan §7 E1)
// =====================================================================
import { hasProp } from '../substrate/substance.js';

function resolveValue(v, constants = {}) {
  if (typeof v === 'string' && v.startsWith('const.')) {
    const key = v.slice('const.'.length);
    if (!(key in constants)) throw new Error(`알 수 없는 상수 참조: 'const.${key}'`);
    return constants[key];
  }
  return v;
}

// 요소의 실제 속성에서 obstacles 를 파생한다 (발명 금지 — 실속성만 근거).
function deriveObstacles(el) {
  const obs = [];
  if ((el.properties['오염도'] ?? 0) > 0) obs.push('접촉 오염 위험');
  if (el.properties['소멸타이머'] !== undefined) obs.push('시간 경과 시 소멸');
  return obs;
}

// 하나의 보유형 demand 를 세계에 대고 스캔 → StageCandidate[]. (읽기 전용)
export function scan(demand, world, ctx = {}) {
  if (!demand?.property) return []; // 상태형(when)은 요소 스캔 대상이 아니다 (E2 (c) 가 처리)
  const constants = ctx.constants ?? {};
  const lexicon = ctx.lexicon ?? world?.lexicon ?? null;
  const { name, op } = demand.property;
  if (lexicon) lexicon.get(name); // 미등재 속성 거부
  const value = resolveValue(demand.property.value, constants);

  const matched = world.all().filter((el) => hasProp(el, name, op, value, lexicon));
  return matched.map((el) => ({
    // §4.5 Stage 스키마로 감싼다. id 는 재해석 후보임을 표시(실 무대 편입은 발견 후).
    candidateFor: { kind: demand.kind, property: { name, op, value } },
    source: `${el.archetype ?? el.id} — 목적 관점에서 재해석된 기회`,
    fromElement: el.id,
    // supplies ⊆ 요소의 실속성 (요소가 실제로 가진 속성만 공급으로 노출)
    supplies: Object.entries(el.properties).map(([property, currentValue]) => ({
      property, currentValue, rule: '요소의 실제 속성에서 파생',
    })),
    obstacles: deriveObstacles(el),
    discovered: false, // 발견은 C1 경로로만 — 스캔이 곧바로 믿음에 꽂히지 않는다
  }));
}

// 노드의 모든 보유형 demand 를 스캔 → { demand, candidates }[].
export function scanForNode(node, world, ctx = {}) {
  return (node.demand ?? [])
    .filter((d) => d.property)
    .map((d) => ({ demand: d, candidates: scan(d, world, ctx) }));
}
