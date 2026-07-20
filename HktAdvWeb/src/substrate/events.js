// =====================================================================
// 사건 기록 — append-only EventLog (step A5)
// ---------------------------------------------------------------------
// 모든 상태 변화는 사건으로 기록된다. aftermath 연쇄·파문·event 술어의 원천.
// 사건: {t, actor, verb, target, tags, delta, energy, stage?}
// (Design-StepPlan §3 A5)
// =====================================================================

export class EventLog {
  constructor() {
    this.events = [];
    this._t = 0; // 이산 틱 카운터 (단조 증가)
  }

  // 사건 추가 — t 는 자동 부여. delta·energy 는 필수(에너지 수지와 함께 기록).
  append({ actor, verb, target = null, tags = [], delta = {}, energy = 0, stage = null }) {
    if (!verb) throw new Error('사건에 verb 가 필수다');
    if (energy === undefined || energy === null) {
      throw new Error('사건은 에너지 수지(energy)와 함께 기록되어야 한다');
    }
    const ev = { t: ++this._t, actor, verb, target, tags: [...tags], delta, energy, stage };
    this.events.push(ev);
    return ev;
  }

  // verb / target_tag / 기간별 count — A4 event 연산자의 실체.
  count({ verb, target_tag, since, until } = {}) {
    return this.query({ verb, target_tag, since, until }).length;
  }

  query({ verb, target_tag, target, since, until } = {}) {
    return this.events.filter((e) => {
      if (verb !== undefined && e.verb !== verb) return false;
      if (target !== undefined && e.target !== target) return false;
      if (target_tag !== undefined && !e.tags.includes(target_tag)) return false;
      if (since !== undefined && e.t < since) return false;
      if (until !== undefined && e.t > until) return false;
      return true;
    });
  }

  all() {
    return [...this.events];
  }
}
