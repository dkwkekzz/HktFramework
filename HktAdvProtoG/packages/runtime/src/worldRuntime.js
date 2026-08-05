// R0·R1 — 세계 상태 저장소와 사건 경유 전이.
//
// 불변 규칙(공리 AX-EVENT-SOURCED): 상태는 commit() 밖에서 바뀌지 않는다.
//   · 읽기(state())는 깊이 얼린 스냅샷을 준다 — 손에 쥔 것을 고쳐도 세계는 안 바뀐다
//   · 쓰기는 사건 하나를 통해서만. 사건은 존재론 어휘로 검증되고, 전이는 공리로 검증되고,
//     통과한 것만 로그에 남고 상태가 된다. 거부되면 상태도 로그도 그대로다.
//   · 확정된 사건은 R2 현상을 남긴다 — 세계의 변화에는 언제나 자국이 있다
//
// 사건 로그·리플레이는 Foundation 의 EventLog 를 그대로 쓴다 (REUSE — 재구현하지 않는다).
import { EventLog } from '../../events/src/eventLog.js';
import { validateTransition, changedPaths } from '../../ontology/src/axioms.js';
import { stateHash } from '../../verification/src/deterministic.js';
import { PhenomenonStream } from './phenomena.js';

function deepFreeze(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  for (const k of Object.keys(v)) deepFreeze(v[k]);
  return Object.freeze(v);
}

/** 사건이 존재론에 등록된 타입인지, 필수 payload 를 갖췄는지 (오류 은폐 금지 — 던진다) */
export function validateEvent(ontology, type, payload) {
  if (!ontology.has('event-type', type)) throw new Error(`미등록 사건 타입: ${type}`);
  const spec = ontology.get('event-type', type);
  const missing = (spec.requiredPayload ?? []).filter((k) => payload?.[k] === undefined);
  if (missing.length) throw new Error(`사건 payload 누락: ${type} — ${missing.join(',')}`);
  return spec;
}

export class WorldRuntime {
  #state; #log; #axioms; #ontology; #reducers; #catalog; #phenomena;
  #paths = new Map();   // 상태 경로 → 그 경로를 바꾼 사건 id 들 (done 조건: 상태를 사건으로 설명)

  constructor({ state, ontology, axioms, reducers, phenomenonCatalog }) {
    if (!state) throw new Error('WorldRuntime 에 초기 상태 필수');
    if (!ontology) throw new Error('WorldRuntime 에 존재론 필수');
    if (!axioms) throw new Error('WorldRuntime 에 공리 레지스트리 필수');
    if (!reducers) throw new Error('WorldRuntime 에 리듀서 필수');
    if (!phenomenonCatalog) throw new Error('WorldRuntime 에 현상 카탈로그 필수');
    this.#state = structuredClone(state);
    this.#ontology = ontology;
    this.#axioms = axioms;
    this.#reducers = reducers;
    this.#catalog = phenomenonCatalog;
    this.#log = new EventLog('ev');
    this.#phenomena = new PhenomenonStream();
  }

  get tick() { return this.#state.tick; }
  get log() { return this.#log; }
  get phenomena() { return this.#phenomena; }

  /** 읽기 전용 스냅샷 — 이걸 고쳐도 세계는 바뀌지 않는다 (사건 없는 변경의 첫 방벽) */
  state() { return deepFreeze(structuredClone(this.#state)); }
  hash() { return stateHash(this.#state); }

  /**
   * 세계를 바꾸는 유일한 문. 거부되면 { ok: false, violations } 를 주고 아무것도 바꾸지 않는다.
   * behavior 는 이 변화를 일으킨 행동 원자 — Q 가 선언한 것이어야 하고, 그게 남길 자국을 정한다.
   */
  commit({ type, payload, behavior, strategy = null, tick = this.#state.tick, traceId = null, at = null, actor = null }) {
    validateEvent(this.#ontology, type, payload);
    const entry = this.#catalog.byBehavior[behavior];
    if (!entry) throw new Error(`현상 카탈로그에 없는 행동: ${behavior} — Q 가 선언하지 않은 행동은 세계를 바꾸지 못한다`);

    const reducer = this.#reducers[type];
    if (!reducer) throw new Error(`리듀서 없는 사건 타입: ${type}`);

    const before = this.#state;
    const candidateEvent = { type, payload, tick, traceId, behavior };
    const after = reducer(structuredClone(before), candidateEvent);
    after.tick = tick;

    // 공리 검증 — 사건을 동봉해 전이 자체를 심사한다
    const verdict = validateTransition(
      { before, after, input: { events: [candidateEvent], observedPaths: before.observedPaths ?? [] } },
      this.#axioms,
    );
    if (!verdict.passed) return { ok: false, violations: verdict.violations, event: null, phenomena: [] };

    // 사건은 세계를 바꾼다. 아무것도 바꾸지 않은 사건은 거짓 기록이므로 남기지 않는다 —
    // 마른 땅에서 캐거나 없는 계약을 처리하려는 시도가 여기서 걸린다 (자국도 안 남는다)
    const paths = changedPaths(before, after).filter((p) => p !== 'tick');
    if (paths.length === 0) {
      return {
        ok: false, event: null, phenomena: [],
        violations: [{
          severity: 'error', violationCode: 'EVENT_NO_EFFECT',
          message: `세계를 바꾸지 않는 사건: ${type} (${behavior}) — 시도는 있었으나 소득이 없다`,
          statePaths: [],
        }],
      };
    }
    const event = this.#log.append(type, payload, { tick, traceId });
    event.behavior = behavior;
    event.statePaths = paths;
    this.#state = after;
    for (const p of paths) {
      if (!this.#paths.has(p)) this.#paths.set(p, []);
      this.#paths.get(p).push(event.id);
    }
    event.strategy = strategy;
    const phenomena = this.#phenomena.emit(entry, {
      tick, at, sourceEventId: event.id, traceId, actor, strategy,
    });
    return { ok: true, violations: [], event, phenomena };
  }

  /**
   * 완료 조건 — 임의 상태 조회가 사건 이력으로 완전히 설명된다.
   * 경로를 주면 그 경로(와 하위 경로)를 바꾼 사건을 순서대로 돌려준다.
   */
  explain(path) {
    const hits = [];
    for (const [p, ids] of this.#paths)
      if (p === path || p.startsWith(`${path}.`)) hits.push(...ids);
    const seen = new Set(hits);
    return this.#log.list()
      .filter((ev) => seen.has(ev.id))
      .map((ev) => ({
        id: ev.id, seq: ev.seq, tick: ev.tick, type: ev.type, behavior: ev.behavior,
        traceId: ev.traceId, statePaths: ev.statePaths,
        phenomena: this.#phenomena.fromEvent(ev.id).map((p) => p.id),
      }));
  }

  /** 사건이 건드리지 않은 상태 경로 — 초기 상태에서 한 번도 안 바뀐 것들은 여기 안 나온다 */
  explainedPaths() { return [...this.#paths.keys()].sort(); }

  /** 결정성 — 로그를 처음부터 재생하면 같은 상태가 나와야 한다 */
  replay(initialState) {
    const rebuilt = this.#log.list().reduce((s, ev) => {
      const next = this.#reducers[ev.type](s, ev);
      next.tick = ev.tick;
      return next;
    }, structuredClone(initialState));
    return { state: rebuilt, hash: stateHash(rebuilt) };
  }
}
