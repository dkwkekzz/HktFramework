// =====================================================================
// 믿음 필터 — 액터별 BeliefView (step C1)
// ---------------------------------------------------------------------
// 그래프는 세계의 진실이 아니라 플레이어의 믿음이다 (불변 원칙 ③). 전역 그래프
// (설계자 데이터)에서 그 액터가 발견한 부분만 보인다. 노드·무대는 발견 상태
// (미발견/추정/확인/반증)를 가진다. 전역 데이터는 불변 — 믿음만 바뀐다.
// (Design-StepPlan §5 C1)
// =====================================================================

export const EPISTEMIC = ['미발견', '추정', '확인', '반증'];
export const MISSING = '미발견';

// seed 의 epistemic/discovered 를 절편 시작 시점의 초기 믿음으로 읽는다.
export function initialBeliefs(graph) {
  const m = new Map();
  for (const g of graph.goals) m.set(g.id, g.epistemic ?? MISSING);
  for (const s of graph.stages) m.set(s.id, s.discovered ? '확인' : MISSING);
  return m;
}

export class BeliefView {
  constructor(graph, actorId, initial) {
    this.graph = graph;
    this.actorId = actorId;
    this.state = new Map(initial ?? initialBeliefs(graph));
  }

  static fromGraph(graph, actorId) {
    return new BeliefView(graph, actorId, initialBeliefs(graph));
  }

  stateOf(id) {
    return this.state.get(id) ?? MISSING;
  }

  isDiscovered(id) {
    return this.stateOf(id) !== MISSING;
  }

  set(id, s) {
    if (!EPISTEMIC.includes(s)) throw new Error(`알 수 없는 발견 상태: '${s}'`);
    this.state.set(id, s);
    return this;
  }

  // 발견 이벤트 — 관찰·정보 재료 획득이 미발견 노드를 전이시킨다 (A5 관찰 산출과 연결).
  discover(id, { to = '추정', via = null } = {}) {
    const from = this.stateOf(id);
    if (from === MISSING) this.set(id, to);
    return { type: 'discover', id, from, to: this.stateOf(id), via };
  }

  // epistemic 술어 실판정 (A4 스텁 해제).
  //  {target, is}      → 그 노드의 상태 == is
  //  {tag, is, min_count} → tag 를 가진 노드 중 상태 == is 인 수 >= min_count
  query(spec) {
    if (spec.target !== undefined) {
      return this.stateOf(spec.target) === spec.is;
    }
    if (spec.tag !== undefined) {
      const need = spec.min_count ?? 1;
      let n = 0;
      for (const g of this.graph.goals) {
        if ((g.tags ?? []).includes(spec.tag) && this.stateOf(g.id) === spec.is) n++;
      }
      return n >= need;
    }
    throw new Error(`epistemic 술어에 target/tag 가 없다: ${JSON.stringify(spec)}`);
  }

  // 봇 시점 그래프 — 미발견 노드는 "?" 로만(자식 수 노출), 나머지는 상태와 함께.
  visibleGraph() {
    const out = [];
    for (const g of this.graph.goals) {
      const st = this.stateOf(g.id);
      const childCount = (this.graph.childrenOf.get(g.id) ?? []).length;
      if (st === MISSING) {
        out.push({ id: g.id, masked: true, label: '?', childCount });
      } else {
        out.push({ id: g.id, masked: false, title: g.title, state: st, childCount });
      }
    }
    return out;
  }

  // 미발견 무대는 좌표 대신 탐색 영역 정확도 단계로만 (§6.2: 부채꼴→영역→원).
  visibleStages() {
    return this.graph.stages.map((s) => {
      const st = this.stateOf(s.id);
      return st === MISSING
        ? { id: s.id, masked: true, locality: '영역 미상(방향 부채꼴)' }
        : { id: s.id, masked: false, source: s.source, state: st };
    });
  }

  snapshotStates() {
    return Object.fromEntries(this.state);
  }
}
