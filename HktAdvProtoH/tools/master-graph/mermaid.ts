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

/** Mermaid 노드 선언 — 모양이 종류를, 접미 기호가 구현 상태를 말한다 */
function declare(node: GraphNode): string {
  const label = short(node.id);
  switch (node.type) {
    case 'world_state':
      return `  ${node.id}[/"${safe(label)}"/]`;
    case 'actor':
      return `  ${node.id}(["${safe(label)}"])`;
    case 'goal':
      return `  ${node.id}{{"${safe(label)}"}}`;
    case 'possibility':
      return `  ${node.id}["${safe(label)}"]`;
    case 'capability':
      return `  ${node.id}["${OVERLAY_MARK[node.overlay ?? 'MISSING']} ${safe(label)}"]`;
    default:
      return `  ${node.id}>"${safe(label)}"]`;
  }
}

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

  // ── 1. 인과 뼈대 ────────────────────────────────────────────────────
  out('## 인과 뼈대 — WorldState → Goal → Possibility');
  out();
  out('세계의 사정이 Goal 을 만들고, 각 Goal 은 여러 Possibility 로 갈린다 (OR).');
  out();
  out('```mermaid');
  out('flowchart LR');
  const backbone = new Set(['world_state', 'actor', 'goal', 'possibility']);
  for (const n of nodes.filter((x) => backbone.has(x.type))) out(declare(n));
  out();
  for (const e of graph.edges) {
    if (!graph.nodes.has(e.to)) continue;
    const a = graph.nodes.get(e.from)!;
    const b = graph.nodes.get(e.to)!;
    if (!backbone.has(a.type) || !backbone.has(b.type)) continue;
    if (e.kind === 'causes') out(`  ${e.from} --> ${e.to}`);
    else if (e.kind === 'wants') out(`  ${e.from} -.-> ${e.to}`);
    else if (e.kind === 'achieves') out(`  ${e.to} --> ${e.from}`); // 갈래는 Goal 에서 뻗어 나가게 그린다
    else if (e.kind === 'motivation') out(`  ${e.from} --> ${e.to}`);
    else if (e.kind === 'opposes') out(`  ${e.from} -. 방해 .-> ${e.to}`);
    else if (e.kind === 'creates_goal') out(`  ${e.from} == 새 Goal ==> ${e.to}`);
  }
  out();
  out('  classDef world fill:#1f2d3d,stroke:#4a6785,color:#dbe6f2;');
  out('  classDef actor fill:#2d2438,stroke:#6b5b8a,color:#e5dcf0;');
  out('  classDef goal fill:#3a2f1c,stroke:#8a7440,color:#f0e6cd;');
  out('  classDef poss fill:#1c3330,stroke:#3f7d6f,color:#d6f0e9;');
  const cls = (t: string) => nodes.filter((n) => n.type === t).map((n) => n.id).join(',');
  if (cls('world_state')) out(`  class ${cls('world_state')} world;`);
  if (cls('actor')) out(`  class ${cls('actor')} actor;`);
  if (cls('goal')) out(`  class ${cls('goal')} goal;`);
  if (cls('possibility')) out(`  class ${cls('possibility')} poss;`);
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

  // ── 2. Goal 별 갈래와 준비도 ────────────────────────────────────────
  out('## 갈래별 준비도 — 어느 경로가 세계에 가장 가까운가');
  out();
  out('요구 Capability 중 이미 세계에 있는 것의 비율. `IMPLEMENTED` 1.0 · `PARTIAL` 0.5 로 센다.');
  out();
  out('| Possibility | 달성 Goal | 준비도 | 아직 없는 요구 |');
  out('|---|---|---:|---|');
  const ranked = [...graph.readiness.entries()].sort((a, b) => {
    if (a[1].unspecified !== b[1].unspecified) return a[1].unspecified ? 1 : -1;
    return b[1].score - a[1].score;
  });
  for (const [id, r] of ranked) {
    const node = graph.nodes.get(id)!;
    const goals = ((node.raw.achieves as string[]) ?? []).map(short).join(' · ') || '—';
    // 5칸은 전부 갖췄을 때만 채운다 — 4/5 와 2/2 가 같은 모양이면 게이지가 거짓말을 한다
    const filled = r.score === 1 ? 5 : Math.min(4, Math.round(r.score * 5));
    const gauge = r.unspecified
      ? '요구 미기재'
      : `${'●'.repeat(filled)}${'○'.repeat(5 - filled)} ${r.implemented}/${r.total}`;
    const blockers = r.blockers.map(short).join(' · ') || '없음';
    out(`| \`${short(id)}\` | ${goals} | ${gauge} | ${blockers} |`);
  }
  out();

  // ── 3. Capability 요구 그물 ─────────────────────────────────────────
  out('## 요구 그물 — Possibility → Capability (AND)');
  out();
  out('한 Possibility 가 성립하려면 이어진 Capability 가 **전부** 있어야 한다.');
  out();
  out('```mermaid');
  out('flowchart LR');
  const used = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind !== 'requires') continue;
    const b = graph.nodes.get(e.to);
    if (!b || b.type !== 'capability') continue;
    used.add(e.from);
    used.add(e.to);
  }
  for (const n of nodes.filter((x) => used.has(x.id))) out(declare(n));
  out();
  for (const e of graph.edges) {
    if (e.kind !== 'requires') continue;
    const b = graph.nodes.get(e.to);
    if (!b || b.type !== 'capability') continue;
    out(`  ${e.from} --> ${e.to}`);
  }
  out();
  out('  classDef impl fill:#16351f,stroke:#3f8a52,color:#d8f2df;');
  out('  classDef part fill:#3a3315,stroke:#9a8a2e,color:#f2ecd0;');
  out('  classDef miss fill:#2a2a2e,stroke:#5c5c66,color:#b8b8c2;');
  out('  classDef poss fill:#1c3330,stroke:#3f7d6f,color:#d6f0e9;');
  const caps = (o: string) =>
    nodes.filter((n) => n.type === 'capability' && n.overlay === o && used.has(n.id)).map((n) => n.id).join(',');
  if (caps('IMPLEMENTED')) out(`  class ${caps('IMPLEMENTED')} impl;`);
  if (caps('PARTIAL')) out(`  class ${caps('PARTIAL')} part;`);
  if (caps('MISSING')) out(`  class ${caps('MISSING')} miss;`);
  const usedPoss = nodes.filter((n) => n.type === 'possibility' && used.has(n.id)).map((n) => n.id).join(',');
  if (usedPoss) out(`  class ${usedPoss} poss;`);
  out('```');
  out();

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
