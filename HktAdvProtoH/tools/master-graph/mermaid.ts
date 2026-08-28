// Master Graph → Mermaid 스냅샷.
//
// GitHub · PR 리뷰에서 그대로 렌더되는 정적 그림이다. 인터랙션이 필요하면 HTML 뷰어를 쓴다.
// 이 파일은 생성물의 본문을 만들 뿐이고, 쓰는 일은 build.ts 가 한다.

import { layerOf, type MasterGraph, type GraphNode, type Membership } from './model';

const OVERLAY_MARK: Record<string, string> = {
  IMPLEMENTED: '■',
  PARTIAL: '▨',
  MISSING: '□',
};

/** 긴 ID 를 그림용 짧은 이름으로 — 접두사는 색으로 이미 구분된다 */
const short = (id: string): string => id.replace(/^M[WAGPCKB]-/, '').replace(/^DC-/, '');

const safe = (s: string): string => s.replace(/"/g, "'").replace(/[[\]{}()]/g, ' ');

export function renderMermaid(graph: MasterGraph): string {
  const lines: string[] = [];
  const out = (s = '') => lines.push(s);

  const nodes = [...graph.nodes.values()];
  const counts = (t: string) => nodes.filter((n) => n.type === t).length;
  const overlay = (o: string) =>
    nodes.filter((n) => n.type === 'capability' && n.overlay === o).length;

  out('# Master Graph — 스냅샷');
  out();
  out('> **이 파일은 생성물이다.** 손으로 고치지 않는다 — `npm run master:graph` 가 다시 만든다.');
  out('> 원본은 `graph/*.yaml` 과 `constraints/DC-*.yaml` 이다.');
  out('> 인터랙티브 관찰(필터 · 서브그래프 · 상세)은 같은 명령이 만드는 `graph-view.html` 을 연다.');
  out();
  out(
    `노드 ${graph.nodes.size} — WorldState ${counts('world_state')} · Actor ${counts('actor')} · ` +
      `Goal ${counts('goal')} · Possibility ${counts('possibility')} · ` +
      `Capability ${counts('capability')} · Knowledge ${counts('knowledge')}`,
  );
  out();
  out(
    `Capability 구현 상태 — ■ IMPLEMENTED ${overlay('IMPLEMENTED')} · ` +
      `▨ PARTIAL ${overlay('PARTIAL')} · □ MISSING ${overlay('MISSING')}`,
  );
  out();

  // ── 1. 세계 인과 척추 — arises_from 텍스트 트리 ─────────────────────
  // 전 노드 mermaid 는 그리지 않는다 — 사람이 볼 그림은 뷰어(graph-view.html)가 맡고,
  // 이 문서는 agent·PR 이 훑는 표와 트리만 담는다.
  out('## 세계 인과 척추 — arises_from');
  out();
  out('어떤 상태가 어떤 상태를 낳았는가. `→ Goal` 은 그 상태가 발생시키는 Goal(`causes`)이다.');
  out();
  out('```text');
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind !== 'arises_from') continue;
    // 모델의 arises_from 엣지는 낳은 쪽(from) → 태어난 쪽(to) 방향이다
    children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
    hasParent.add(e.to);
  }
  const goalsOf = (id: string): string =>
    [...new Set(
      graph.edges.filter((e) => e.kind === 'causes' && e.from === id).map((e) => short(e.to)),
    )].join(' · ');
  const emitTree = (id: string, depth: number, seen: Set<string>): void => {
    const g = goalsOf(id);
    out(`${'  '.repeat(depth)}${short(id)}${g ? `  → Goal: ${g}` : ''}`);
    if (seen.has(id)) return; // 부모가 둘인 노드 — 두 번째부터는 가지를 펴지 않는다
    seen.add(id);
    for (const c of children.get(id) ?? []) emitTree(c, depth + 1, seen);
  };
  const seen = new Set<string>();
  for (const n of nodes.filter((x) => x.type === 'world_state' && !hasParent.has(x.id))) {
    emitTree(n.id, 0, seen);
  }
  out('```');
  out();

  // ── 1.5 척추 — part_of ─────────────────────────────────────────────
  if (graph.systems.size > 0) {
    out('## 척추 — 어떤 전체의 조각인가 (part_of)');
    out();
    out('Capability 는 시스템(전체)의 조각이다. 시스템과 그 안의 자리(층·칸)의 단일 출처는');
    out('`graph/systems.yaml` 이다. **점선 테두리 = 잠정(grounded: false)** — 근거 문서가');
    out('이름만 대서, 그 전체의 설계 문서가 서면 semantic 을 개정한다.');
    out();

    // 시스템별 소속 색인 — 한 노드가 여러 시스템·여러 자리에 속할 수 있다
    const members = new Map<string, { node: GraphNode; m: Membership }[]>();
    for (const n of nodes) {
      if (n.type !== 'capability') continue;
      for (const m of n.partOf?.memberships ?? []) {
        members.set(m.system, [...(members.get(m.system) ?? []), { node: n, m }]);
      }
    }

    for (const sys of graph.systems.values()) {
      const list = members.get(sys.id) ?? [];
      const statusTag = sys.status !== 'DEFINED' ? ` · **${sys.status}**` : '';
      out(`### ${sys.name} — ${sys.source}${statusTag}`);
      out();
      if (sys.semantic) {
        out(sys.semantic);
        out();
      }
      if (list.length === 0) {
        out('아직 이 시스템에 속한 조각이 없다.');
        out();
        continue;
      }

      out('```mermaid');
      out('flowchart TB');
      let uid = 0;
      const byClass = { impl: [] as string[], part: [] as string[], miss: [] as string[] };
      const byClassStub = { impl: [] as string[], part: [] as string[], miss: [] as string[] };
      const emit = (entry: { node: GraphNode; m: Membership }, indent: string) => {
        const id = `N${uid}`;
        uid += 1;
        const mark = OVERLAY_MARK[entry.node.overlay ?? 'MISSING'];
        out(`${indent}${id}["${mark} ${safe(short(entry.node.id))}"]`);
        const bucket =
          entry.node.overlay === 'IMPLEMENTED' ? 'impl' : entry.node.overlay === 'PARTIAL' ? 'part' : 'miss';
        (entry.node.partOf?.grounded ? byClass : byClassStub)[bucket].push(id);
      };

      // 위층이 위에 오도록 뒤집어 선언한다. 빈 층은 그리지 않는다.
      const segIds: string[] = [];
      [...sys.segments].reverse().forEach((seg, i) => {
        const inSeg = list.filter((e) => e.m.segment === seg.id);
        if (inSeg.length === 0) return;
        const sid = `SEG${i}`;
        segIds.push(sid);
        out(`  subgraph ${sid} ["${safe(seg.name)}"]`);
        for (const e of inSeg) emit(e, '    ');
        out('  end');
      });
      const noSeg = list.filter((e) => !e.m.segment);
      if (noSeg.length > 0) {
        const sid = 'SEGBASE';
        segIds.push(sid);
        out(
          `  subgraph ${sid} ["${sys.segments.length > 0 ? safe('공통 바닥 — 층에 속하지 않는다') : safe(sys.name)}"]`,
        );
        for (const e of noSeg) emit(e, '    ');
        out('  end');
      }
      // 세로로 쌓이게 층 사이를 보이지 않는 선으로 잇는다
      for (let i = 0; i + 1 < segIds.length; i += 1) out(`  ${segIds[i]} ~~~ ${segIds[i + 1]}`);
      out();
      out('  classDef impl fill:#16351f,stroke:#3f8a52,color:#d8f2df;');
      out('  classDef part fill:#3a3315,stroke:#9a8a2e,color:#f2ecd0;');
      out('  classDef miss fill:#2a2a2e,stroke:#5c5c66,color:#b8b8c2;');
      out('  classDef implS fill:#16351f,stroke:#3f8a52,color:#d8f2df,stroke-dasharray:5 4;');
      out('  classDef partS fill:#3a3315,stroke:#9a8a2e,color:#f2ecd0,stroke-dasharray:5 4;');
      out('  classDef missS fill:#2a2a2e,stroke:#5c5c66,color:#b8b8c2,stroke-dasharray:5 4;');
      if (byClass.impl.length) out(`  class ${byClass.impl.join(',')} impl;`);
      if (byClass.part.length) out(`  class ${byClass.part.join(',')} part;`);
      if (byClass.miss.length) out(`  class ${byClass.miss.join(',')} miss;`);
      if (byClassStub.impl.length) out(`  class ${byClassStub.impl.join(',')} implS;`);
      if (byClassStub.part.length) out(`  class ${byClassStub.part.join(',')} partS;`);
      if (byClassStub.miss.length) out(`  class ${byClassStub.miss.join(',')} missS;`);
      out('```');
      out();
    }
  }

  // ── 2. 갈래별 상태는 Capability Overlay 절의 Possibility 표가 담는다 (overlay.ts)

  // ── 3. 요구 그물은 그리지 않는다 — 준비도 표(위)가 같은 사실을 담고,
  //       그림이 필요하면 뷰어가 맡는다.

  // ── 4. Constraint 렌즈 ──────────────────────────────────────────────
  out('## Constraint — 무엇이 걸러지는가');
  out();
  out('Constraint 는 단계가 아니라 각 선택 지점의 Filter 다. 아래는 어떤 노드가 어떤 원칙 아래 있는지다.');
  out();
  out('| Constraint | Scope | 상태 | 걸린 노드 | 한 문장 |');
  out('|---|---|---|---:|---|');
  for (const c of [...graph.constraints.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const n = graph.constrainedBy.get(c.id)?.length ?? 0;
    out(`| \`${short(c.id)}\` | ${c.scope.join(' · ')} | ${c.status} | ${n} | ${c.statement} |`);
  }
  out();

  // ── 5. 구멍 ─────────────────────────────────────────────────────────
  out('## 구멍 — 아직 채워지지 않은 자리');
  out();
  out('빈 인과 필드다. 지어내지 않은 자리이며, 다음에 무엇을 물어야 하는지를 가리킨다.');
  out();
  const byField = new Map<string, string[]>();
  for (const h of graph.holes) byField.set(h.field, [...(byField.get(h.field) ?? []), short(h.nodeId)]);
  out('| 빈 필드 | 개수 | 노드 |');
  out('|---|---:|---|');
  for (const [field, ids] of [...byField.entries()].sort((a, b) => b[1].length - a[1].length)) {
    out(`| \`${field}\` | ${ids.length} | ${ids.join(' · ')} |`);
  }
  out();

  if (graph.problems.length > 0) {
    out('## 정합성 — `npm run master:graph:check` 가 잡은 것');
    out();
    for (const p of graph.problems) out(`- **${p.severity}** \`${p.code}\` — ${p.message}`);
    out();
  }

  return lines.join('\n');
}
