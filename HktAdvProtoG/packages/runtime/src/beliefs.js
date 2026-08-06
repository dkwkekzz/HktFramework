// R4·R5 — 믿음과 기억. 주체는 실제 세계가 아니라 자기가 믿는 세계에서 산다.
//
// 믿음은 지각에서만 자란다. 세계 상태를 직접 읽는 경로는 없다 —
// 그게 있으면 주체가 전지적이 되고, "몰라서 생기는 이야기"가 전부 사라진다.
//
// 같은 사실이라도 어떤 채널로 왔느냐에 따라 다르게 믿는다:
//   직접 본 것  fidelity 1.0 → 크기 그대로, 확신 높음
//   소문        fidelity 0.5 → 크기 1/0.5 = 2배로 부풀고, 확신 낮음
// 이것이 SC-C01-R4-01 (과장된 목격 소문 대 실제 흔적 → 상이한 믿음) 이다.
//
// 기억(R5)은 믿음이 시간과 함께 흐려지는 방식이다. 위협의 기억은 남아서
// 다음 행동을 조심스럽게 만든다 (SC-C01-R5-BASE-01).
import { stableSort, stateHash } from '../../verification/src/deterministic.js';

/** 자국이 무엇에 대한 소식인지 — 행동 원자에서 주제를 읽는다 */
export const BEHAVIOR_TOPICS = {
  'stalk-prey': { topic: 'threat', magnitude: 1 },
  stalk: { topic: 'threat', magnitude: 1 },
  hunt: { topic: 'threat', magnitude: 2 },
  fight: { topic: 'threat', magnitude: 3 },
  capture: { topic: 'opportunity', magnitude: 2 },
  'raid-pasture': { topic: 'threat', magnitude: 3 },
  migrate: { topic: 'movement', magnitude: 1 },
  'relocate-lair': { topic: 'movement', magnitude: 2 },
  'trample-colony': { topic: 'depletion', magnitude: 2 },
  'gather-herbs': { topic: 'depletion', magnitude: 1 },
  'dress-carcass': { topic: 'opportunity', magnitude: 1 },
  breed: { topic: 'abundance', magnitude: 1 },
  graze: { topic: 'abundance', magnitude: 1 },
  regenerate: { topic: 'abundance', magnitude: 1 },
  'issue-cull-contract': { topic: 'contract', magnitude: 2 },
  'issue-subjugation-contract': { topic: 'contract', magnitude: 3 },
  'suspend-cull-contract': { topic: 'contract', magnitude: 1 },
  'report-sighting': { topic: 'threat', magnitude: 2 },
  'spread-rumor': { topic: 'threat', magnitude: 2 },
};

/** 기억은 흐려진다 — 위협일수록 오래 남는다 (tick 당 감쇠) */
export const MEMORY_DECAY = { threat: 0.02, depletion: 0.05, contract: 0.03, default: 0.08 };

const decayOf = (topic) => MEMORY_DECAY[topic] ?? MEMORY_DECAY.default;

/**
 * R4·R5 — 주체별 믿음 장부.
 * 믿음의 열쇠는 (장소, 주제) 다: "골짜기는 위험하다", "습지는 말랐다".
 */
export class BeliefLedger {
  #bySubject = new Map();

  #ensure(subjectId) {
    if (!this.#bySubject.has(subjectId))
      this.#bySubject.set(subjectId, { subject: subjectId, beliefs: new Map(), memories: [] });
    return this.#bySubject.get(subjectId);
  }

  /** R4 — 지각한 것을 믿음으로 바꾼다. 채널 충실도가 크기와 확신을 함께 정한다 */
  observe(subjectId, perceptions, { tick = 0 } = {}) {
    const entry = this.#ensure(subjectId);
    for (const p of perceptions) {
      const topic = BEHAVIOR_TOPICS[p.behavior];
      if (!topic || !p.at) continue;
      const key = `${p.at}:${topic.topic}`;
      // 흐린 채널일수록 크기가 부풀고 확신은 떨어진다 — 소문이 과장되는 이유
      const magnitude = Number((topic.magnitude / p.fidelity).toFixed(3));
      // 확신 = 채널이 얼마나 사실을 옮기는가 x 자국이 얼마나 또렷했는가
      const confidence = Number((p.fidelity * (p.legibility ?? 1)).toFixed(3));
      const prev = entry.beliefs.get(key);
      // 더 확신이 큰 소식이 이긴다 (직접 본 것이 소문을 덮어쓴다). 같으면 최신이 이긴다
      if (prev && (prev.confidence > confidence || (prev.confidence === confidence && prev.tick > p.tick))) continue;
      entry.beliefs.set(key, {
        key, at: p.at, topic: topic.topic, magnitude, confidence,
        tick: p.tick, via: p.channel, direct: p.direct,
        because: p.description, sourceEventId: p.sourceEventId,
      });
      entry.memories.push({
        tick: p.tick, topic: topic.topic, at: p.at, magnitude,
        via: p.channel, description: p.description,
      });
    }
    return this;
  }

  /** 한 주체가 지금 믿는 세계 */
  of(subjectId) {
    const entry = this.#bySubject.get(subjectId);
    if (!entry) return { subject: subjectId, beliefs: [], memories: [] };
    return {
      subject: subjectId,
      beliefs: stableSort([...entry.beliefs.values()], (a, b) => a.key.localeCompare(b.key)),
      memories: [...entry.memories],
    };
  }

  believes(subjectId, at, topic) {
    return this.#bySubject.get(subjectId)?.beliefs.get(`${at}:${topic}`) ?? null;
  }

  /**
   * R5 — 지금 tick 에서 그 기억이 갖는 무게. 오래될수록 옅어진다.
   * 위협 기억이 남아 있으면 그 장소로 가는 행동이 조심스러워진다.
   */
  weight(subjectId, at, topic, tick) {
    const entry = this.#bySubject.get(subjectId);
    if (!entry) return 0;
    let total = 0;
    for (const m of entry.memories) {
      if (m.at !== at || m.topic !== topic) continue;
      const faded = m.magnitude * (1 - decayOf(topic) * Math.max(0, tick - m.tick));
      if (faded > 0) total += faded;
    }
    return Number(total.toFixed(3));
  }

  subjects() { return [...this.#bySubject.keys()].sort(); }

  /**
   * 완료 조건 — 주체별 믿음 대 실제 상태 diff.
   * 믿는 것과 실제가 어긋난 곳이 곧 이야기가 생기는 지점이다.
   */
  diff(subjectId, actualState) {
    const rows = [];
    for (const b of this.of(subjectId).beliefs) {
      const place = actualState.region?.places?.[b.at] ?? {};
      const actual = b.topic === 'depletion'
        ? Object.values(place.yields ?? {}).reduce((s, v) => s + v, 0)
        : (place.lastArrival ?? null);
      rows.push({
        key: b.key, at: b.at, topic: b.topic,
        believed: b.magnitude, confidence: b.confidence, via: b.via, direct: b.direct,
        actual, because: b.because,
      });
    }
    return stableSort(rows, (a, b) => a.key.localeCompare(b.key));
  }

  hash() {
    return stateHash(this.subjects().map((id) => ({ id, beliefs: this.of(id).beliefs })));
  }
}

/** 배역 전체가 자기 지각으로 믿음을 갱신한다 */
export function updateBeliefs(ledger, perceptionsBySubject, { tick = 0 } = {}) {
  for (const subjectId of Object.keys(perceptionsBySubject).sort())
    ledger.observe(subjectId, perceptionsBySubject[subjectId], { tick });
  return ledger;
}
