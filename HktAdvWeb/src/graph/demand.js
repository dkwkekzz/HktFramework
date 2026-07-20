// =====================================================================
// demand 판정 — 속성 매칭 (step B2)
// ---------------------------------------------------------------------
// 말단의 demand 를 세계에 대고 판정한다. 불변 원칙 ②의 실행부:
//   보유형(물질·에너지·정보·지식·능력·생명체): 인벤토리·세계를 속성으로 스캔
//   상태형(관계·접근권·환경 상태·시간과 기회): 세계 상태 + 시간 창 판정
// 품목이 아니라 속성이 판정 기준이다 — 서로 다른 archetype 이 같은 demand 를 충족.
// (Design-StepPlan §4 B2)
// =====================================================================
import { evalPred } from '../substrate/predicate.js';
import { hasProp } from '../substrate/substance.js';

const HOLDING_KINDS = new Set(['물질', '에너지', '정보', '지식', '능력', '생명체']);

// const.<이름> 또는 리터럴 해석 (predicate 와 동일 규칙).
function resolveValue(v, constants = {}) {
  if (typeof v === 'string' && v.startsWith('const.')) {
    const key = v.slice('const.'.length);
    if (!(key in constants)) throw new Error(`알 수 없는 상수 참조: 'const.${key}'`);
    return constants[key];
  }
  return v;
}

// demand 항목 하나를 판정한다.
// ctx: { constants, lexicon, actor:{id,inventory}, world, ledger, state, events }
export function matchDemand(actor, demand, world, ctx = {}) {
  const constants = ctx.constants ?? {};
  const lexicon = ctx.lexicon ?? world?.lexicon ?? null;

  // ── 상태형: when 술어 판정 (시간 창 포함) ──
  if (demand.when) {
    const r = evalPred(demand.when, { ...ctx, actor, state: ctx.state });
    const trace = { form: '상태형', kind: demand.kind, when: r.trace, met: r.value };
    // 시간 창 밖이면 "다음 도래" 정보를 최선으로 채운다.
    if (!r.value && r.trace?.op === 'state') {
      trace.nextInfo = describeWindow(r.trace);
    }
    return { met: r.value, kind: demand.kind, candidates: [], trace };
  }

  // ── 보유형: 속성 스캔 ──
  if (demand.property) {
    const { name, op } = demand.property;
    if (lexicon) lexicon.get(name); // 미등재 속성 거부
    const value = resolveValue(demand.property.value, constants);
    const minCount = demand.min_count ?? 1;

    // 에너지·잔고는 원장을 읽는다.
    if (demand.kind === '에너지' && name === '잔고') {
      const bal = actor?.id && ctx.ledger?.has(actor.id) ? ctx.ledger.balance(actor.id) : 0;
      const met = cmp(bal, op, value);
      return { met, kind: demand.kind, candidates: [], trace: { form: '에너지', balance: bal, cmp: { op, value }, met } };
    }

    // 후보 = 보유(인벤토리) ∪ 세계(스캔). 품목 무관, 속성만 본다.
    const inv = (actor?.inventory ?? []).filter((s) => matchKind(s, demand.kind) && hasProp(s, name, op, value, lexicon));
    const ws = world ? world.scan(name, op, value).filter((s) => matchKind(s, demand.kind)) : [];
    const seen = new Set();
    const candidates = [];
    for (const s of [...inv, ...ws]) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      candidates.push({ id: s.id, archetype: s.archetype, source: inv.includes(s) ? '보유' : '세계' });
    }
    const met = candidates.length >= minCount;
    return {
      met, kind: demand.kind, candidates,
      trace: { form: '보유형', kind: demand.kind, property: { name, op, value }, needed: minCount, count: candidates.length, candidates: candidates.map((c) => c.id) },
    };
  }

  throw new Error(`판정 불가 demand (property/when 둘 다 없음): ${JSON.stringify(demand)}`);
}

// 노드의 demand 전 항목을 판정한다 → { met, results[] }.
export function matchAllDemands(actor, demandList, world, ctx = {}) {
  const results = (demandList ?? []).map((d) => matchDemand(actor, d, world, ctx));
  return { met: results.every((r) => r.met), results };
}

function matchKind(s, kind) {
  // kind 미지정이거나 보유형이면 s.kind 로 거른다. s.kind 가 없으면(원천 물질) 통과 허용.
  if (kind == null) return true;
  if (!HOLDING_KINDS.has(kind)) return true;
  return s.kind == null || s.kind === kind;
}

function cmp(a, op, b) {
  switch (op) { case '>=': return a >= b; case '<=': return a <= b; case '>': return a > b;
    case '<': return a < b; case '==': return a === b; case '!=': return a !== b; default: return false; }
}

// 상태형 미충족 시 창 서술 (숫자 없는 진행의 먹이 — trace 재사용).
function describeWindow(stateTrace) {
  const { path, actual, cmp: c } = stateTrace;
  if (!stateTrace.found) return `상태 경로 '${path}' 아직 미정의 — 세계가 이 창을 아직 열지 않았다`;
  return `현재 ${path}=${actual} (요구 ${c.op} ${c.value}) — 창 밖`;
}
