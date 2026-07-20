// =====================================================================
// 공통 상호작용 법칙 v0 (step A5)
// ---------------------------------------------------------------------
// 상태 변화는 법칙 표(자극→상태전이 + 에너지 지불)를 통해서만 일어난다.
// apply() 가 유일한 상태 변경 경로다: ① 법칙 존재 확인 ② 에너지 지불(A3)
// ③ 상태전이 ④ 사건 기록 을 원자적으로 수행한다. 법칙에 없는 전이는 불가.
// "동사가 늘어도 법칙은 늘지 않는다"(§4.3) — 표를 늘릴 뿐 경로는 하나.
// (Design-StepPlan §3 A5)
// =====================================================================
import { Substance, hasProp } from './substance.js';

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

let _seq = 0; // 산출 재료의 고유 id 부여용 (단조 증가 — 결정론적)
function nextId(prefix) {
  return `${prefix}#${++_seq}`;
}

// 법칙 하나. cond 는 대상 속성 술어(선택), effect 는 산출/전이 계산.
export class Law {
  constructor({ verb, cond = null, energyCost = 0, effect }) {
    if (!verb) throw new Error('법칙에 verb 가 없다');
    if (typeof effect !== 'function') throw new Error(`법칙 '${verb}' 에 effect 가 없다`);
    this.verb = verb;
    this.cond = cond; // {name, op, value} — target 이 만족해야 한다 (없으면 무조건)
    this.energyCost = energyCost;
    this.effect = effect;
  }
}

export class LawTable {
  constructor(lexicon = null) {
    this.lexicon = lexicon;
    this.laws = new Map(); // verb → Law
  }

  register(law) {
    const l = law instanceof Law ? law : new Law(law);
    this.laws.set(l.verb, l);
    return l;
  }

  has(verb) {
    return this.laws.has(verb);
  }

  // 유일한 상태 변경 경로. actor={id, inventory:[]}. target 은 Substance | null.
  apply(actor, verb, target, params = {}, ctx = {}) {
    const { ledger, events, world } = ctx;
    const law = this.laws.get(verb);
    if (!law) throw new Error(`법칙 없음: '${verb}' — 법칙 밖 전이는 불가`);

    // ① 대상 조건 확인
    if (law.cond) {
      if (!target) throw new Error(`법칙 '${verb}' 은 대상이 필요하다`);
      if (!hasProp(target, law.cond.name, law.cond.op, law.cond.value, this.lexicon)) {
        throw new Error(`법칙 '${verb}': 대상이 조건(${law.cond.name} ${law.cond.op} ${law.cond.value})을 만족하지 않는다`);
      }
    }

    // ② 에너지 지불 여력 사전 확인 (원자성 — 부족하면 아무것도 바꾸지 않는다)
    const cost = law.energyCost;
    if (cost > 0) {
      if (!ledger || !actor?.id || !ledger.has(actor.id)) {
        throw new Error(`법칙 '${verb}': 비용 ${cost} 지불 계좌가 없다`);
      }
      if (ledger.balance(actor.id) < cost) {
        throw new Error(`법칙 '${verb}': 에너지 부족 (${ledger.balance(actor.id)} < ${cost})`);
      }
    }

    // ③ 상태전이 계산 (아직 커밋 전 — 순수 계산)
    const result = law.effect({ actor, target, params, lexicon: this.lexicon });
    const adds = (result?.adds ?? []).map((spec) => new Substance(spec, this.lexicon));
    const targetDelta = result?.targetDelta ?? {};

    // ── 커밋 ──
    // ② 지불
    if (cost > 0) ledger.burn(actor.id, cost, `${verb} 비용`);
    // ③ 산출 재료를 인벤토리(및 world)에 편입
    for (const s of adds) {
      actor.inventory.push(s);
      if (world) world.add(s);
    }
    // ③ 대상 속성 전이 (대상이 가진 속성만)
    for (const [name, value] of Object.entries(targetDelta)) {
      if (target && name in target.properties) target.properties[name] = value;
    }
    // ④ 사건 기록 (에너지 수지와 함께)
    let ev = null;
    if (events) {
      ev = events.append({
        actor: actor?.id ?? null,
        verb,
        target: target?.id ?? null,
        tags: target?.tags ?? [],
        delta: { adds: adds.map((s) => s.id), targetDelta },
        energy: cost,
        stage: params.stage ?? null,
      });
    }

    return { adds, targetDelta, energy: cost, event: ev };
  }
}

// ─── 절편에 필요한 동사만 등재 (나머지 15 동사는 표를 비워 둔다) ───

// 채취: 대상에서 물질을 분리해 인벤토리로. 순도(신성잔향보존율)는 정밀도의 함수.
//        거칠수록(정밀도 낮을수록) 오염도 상승 — S-0045 supplies 규칙의 실체.
export const 채취Law = new Law({
  verb: '채취',
  cond: { name: '신성잔향보존율', op: '>=', value: 0 }, // 잔향을 가진 대상만 채취 가능
  energyCost: 1,
  effect: ({ target, params }) => {
    const 정밀도 = clamp01(params['정밀도'] ?? 0.5);
    const base = target.properties['신성잔향보존율'] ?? 0;
    const 보존율 = clamp01(base * 정밀도);   // 정밀할수록 잔향 보존이 높다
    const 오염도 = clamp01(1 - 정밀도);       // 거칠수록 오염이 높다
    return {
      adds: [{
        id: nextId('채취물'),
        archetype: target.archetype ?? '조직조각',
        kind: '물질',
        tags: target.tags ?? [],
        properties: { 신성잔향보존율: 보존율, 오염도 },
      }],
      targetDelta: {},
    };
  },
});

// 관찰: 대상을 바꾸지 않고 정보 재료를 생성한다.
export const 관찰Law = new Law({
  verb: '관찰',
  cond: null,
  energyCost: 0,
  effect: ({ params }) => {
    const 주제 = params['주제'];
    if (!주제) throw new Error("관찰 법칙: params.주제 가 필요하다");
    return {
      adds: [{ id: nextId('관측정보'), kind: '정보', properties: { 주제 } }],
      targetDelta: {},
    };
  },
});

// 실험: 대상에 자극을 가하고 반응을 사건으로 기록한다. 정보 재료(주제)를 산출한다.
//        (가설 검증 루프 C2 의 자극→반응 기록원. 대상 자체는 바꾸지 않는다.)
export const 실험Law = new Law({
  verb: '실험',
  cond: null,
  energyCost: 2,
  effect: ({ params }) => {
    const adds = [];
    if (params['주제']) adds.push({ id: nextId('실험정보'), kind: '정보', properties: { 주제: params['주제'] } });
    return { adds, targetDelta: {} };
  },
});

// 검증: 실개체 등에서 재현을 확인한다 (사건 기록만 — done_when 은 event 횟수로 판정).
export const 검증Law = new Law({
  verb: '검증',
  cond: null,
  energyCost: 2,
  effect: () => ({ adds: [], targetDelta: {} }),
});

// 절편 기본 법칙 표를 만든다.
export function defaultLawTable(lexicon = null) {
  const t = new LawTable(lexicon);
  t.register(채취Law);
  t.register(관찰Law);
  t.register(실험Law);
  t.register(검증Law);
  return t;
}
