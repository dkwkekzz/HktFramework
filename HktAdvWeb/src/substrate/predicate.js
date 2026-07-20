// =====================================================================
// 상태 술어 질의 — Predicate DSL v0 평가기 (step A4)
// ---------------------------------------------------------------------
// 세계 상태를 묻는 술어를 데이터(YAML)로 쓰고 기계 평가한다.
// done_when 과 demand 판정의 공용 엔진 (불변 원칙 ①의 실체).
// DSL v0 명세의 정본은 data/objective-graph.yaml 헤더.
//
// evalPred(pred, ctx) → {value, trace}
//   trace 는 각 항의 참/거짓과 근거를 담는다 — 파문 연출과 "숫자 없는 진행"의 먹이.
//
// ctx (전부 선택적 — 단계별 전진 조립):
//   constants  : const.<이름> 해석
//   lexicon    : 속성명 검증 (has/state 의 name)
//   actor      : { id, inventory: [Substance...] }  — has 스캔 대상
//   ledger     : Ledger  — has(에너지·잔고) / state(ledger.<id>.잔고)
//   state      : { world, stage, ... }  — state 경로 해석 루트
//   events     : EventLog — event 연산자 (A5 에서 주입; 없으면 스텁)
//   belief     : BeliefView — epistemic 연산자 (C1 에서 주입; 없으면 스텁)
// =====================================================================
import { compare, OPS } from './compare.js';
import { hasProp } from './substance.js';

// const.<이름> 또는 리터럴 해석.
function resolveValue(v, ctx) {
  if (typeof v === 'string' && v.startsWith('const.')) {
    const key = v.slice('const.'.length);
    const consts = ctx.constants ?? {};
    if (!(key in consts)) {
      throw new Error(`알 수 없는 상수 참조: 'const.${key}'`);
    }
    return consts[key];
  }
  return v;
}

// state 경로 해석: ledger.<id>.잔고 는 원장을, 그 외는 ctx.state 루트를 walk.
function resolvePath(path, ctx) {
  const segs = String(path).split('.');
  if (segs[0] === 'ledger') {
    // ledger.<id>.잔고  — 원장을 상태처럼 읽는다 (A3 연동).
    const id = segs[1];
    if (!ctx.ledger || !ctx.ledger.has(id)) return { found: false, value: undefined };
    return { found: true, value: ctx.ledger.balance(id) };
  }
  let node = ctx.state ?? {};
  for (const seg of segs) {
    if (node == null || typeof node !== 'object' || !(seg in node)) {
      return { found: false, value: undefined };
    }
    node = node[seg];
  }
  return { found: true, value: node };
}

function assertOp(op) {
  if (!OPS.has(op)) throw new Error(`알 수 없는 비교 연산자: '${op}'`);
}

export function evalPred(pred, ctx = {}) {
  if (!pred || typeof pred !== 'object') {
    throw new Error(`술어가 객체가 아니다: ${JSON.stringify(pred)}`);
  }

  if ('all' in pred) return evalAll(pred.all, ctx);
  if ('any' in pred) return evalAny(pred.any, ctx);
  if ('not' in pred) return evalNot(pred.not, ctx);
  if ('has' in pred) return evalHas(pred.has, ctx);
  if ('state' in pred) return evalState(pred.state, ctx);
  if ('epistemic' in pred) return evalEpistemic(pred.epistemic, ctx);
  if ('event' in pred) return evalEvent(pred.event, ctx);

  throw new Error(`미지 술어 연산자: ${Object.keys(pred).join(',')}`);
}

function evalAll(list, ctx) {
  if (!Array.isArray(list)) throw new Error('all 은 배열이어야 한다');
  const children = list.map((p) => evalPred(p, ctx));
  const value = children.every((c) => c.value);
  return { value, trace: { op: 'all', value, children: children.map((c) => c.trace) } };
}

function evalAny(list, ctx) {
  if (!Array.isArray(list)) throw new Error('any 는 배열이어야 한다');
  const children = list.map((p) => evalPred(p, ctx));
  const value = children.some((c) => c.value);
  return { value, trace: { op: 'any', value, children: children.map((c) => c.trace) } };
}

function evalNot(inner, ctx) {
  const c = evalPred(inner, ctx);
  const value = !c.value;
  return { value, trace: { op: 'not', value, child: c.trace } };
}

// 보유형 재료 스캔 — 품목이 아니라 속성으로 (불변 원칙 ②).
function evalHas(spec, ctx) {
  const { kind, property, min_count = 1, epistemic } = spec;
  if (!property || typeof property.name !== 'string') {
    throw new Error('has.property 에 name 이 없다');
  }
  assertOp(property.op);
  if (ctx.lexicon) ctx.lexicon.get(property.name); // 미등재 속성명 거부
  const value = resolveValue(property.value, ctx);

  // 에너지·잔고는 원장을 읽는다.
  if (kind === '에너지' && property.name === '잔고') {
    const id = ctx.actor?.id;
    const bal = id && ctx.ledger?.has(id) ? ctx.ledger.balance(id) : 0;
    const met = compare(bal, property.op, value);
    return {
      value: met,
      trace: { op: 'has', kind, source: 'ledger', balance: bal, cmp: { op: property.op, value }, value: met },
    };
  }

  const inventory = ctx.actor?.inventory ?? [];
  let matched = inventory.filter(
    (s) => (kind == null || s.kind === kind) && hasProp(s, property.name, property.op, value, ctx.lexicon),
  );

  // 발견 상태 제약 — belief 없으면 스텁(충족 불가), 인터페이스만 고정 (C1 에서 실체화).
  let epistemicStub = false;
  if (epistemic !== undefined) {
    if (ctx.belief) {
      matched = matched.filter((s) => ctx.belief.stateOf(s.id) === epistemic);
    } else {
      epistemicStub = true;
      matched = [];
    }
  }

  const met = matched.length >= min_count;
  return {
    value: met,
    trace: {
      op: 'has',
      kind,
      property: { name: property.name, op: property.op, value },
      needed: min_count,
      count: matched.length,
      matched: matched.map((s) => s.id),
      ...(epistemicStub ? { epistemicStub: epistemic } : {}),
      value: met,
    },
  };
}

// 세계 상태 경로 비교.
function evalState(spec, ctx) {
  const { path, op, value } = spec;
  assertOp(op);
  const rhs = resolveValue(value, ctx);
  const { found, value: actual } = resolvePath(path, ctx);
  const met = found ? compare(actual, op, rhs) : false;
  return {
    value: met,
    trace: { op: 'state', path, found, actual, cmp: { op, value: rhs }, value: met },
  };
}

// 발견 상태 질의 — belief 없으면 스텁.
function evalEpistemic(spec, ctx) {
  if (!ctx.belief) {
    return { value: false, trace: { op: 'epistemic', stub: true, spec, value: false } };
  }
  const met = ctx.belief.query(spec);
  return { value: met, trace: { op: 'epistemic', spec, value: met } };
}

// 사건 기록 질의 — events 없으면 스텁 (A5 에서 실체화).
function evalEvent(spec, ctx) {
  const { verb, target_tag, min_count = 1 } = spec;
  if (!ctx.events) {
    return { value: false, trace: { op: 'event', stub: true, spec, value: false } };
  }
  const count = ctx.events.count({ verb, target_tag });
  const met = count >= min_count;
  return {
    value: met,
    trace: { op: 'event', verb, target_tag, needed: min_count, count, value: met },
  };
}
