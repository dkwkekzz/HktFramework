// Master Graph → 인터랙티브 HTML 뷰어 (단일 파일 · 외부 의존성 없음).
//
// 레이아웃·인터랙션은 viewer.js 가, 색은 viewer.css 가 소유한다.
// 이 파일은 그래프를 JSON 으로 직렬화해 그 둘과 함께 한 장으로 묶는다.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREE_REQUIRE_BUCKETS, type MasterGraph } from './model';
import type { WorkLinks } from './works';

const here = dirname(fileURLToPath(import.meta.url));

/** 뷰어가 먹는 형태로 그래프를 납작하게 만든다 */
export function serialize(graph: MasterGraph, works?: WorkLinks) {
  const holesByNode = new Map<string, string[]>();
  for (const h of graph.holes) {
    holesByNode.set(h.nodeId, [...(holesByNode.get(h.nodeId) ?? []), h.field]);
  }

  return {
    nodes: [...graph.nodes.values()].map((n) => ({
      id: n.id,
      type: n.type,
      text: n.text,
      overlay: n.overlay ?? null,
      partOf: n.partOf ?? null,
      constraints: n.constraints,
      eval: n.constraintEvaluation,
      holes: holesByNode.get(n.id) ?? [],
      raw: n.raw,
      file: n.file,
    })),
    edges: graph.edges.filter((e) => graph.nodes.has(e.to)),
    constraints: [...graph.constraints.values()].map((c) => ({
      id: c.id,
      statement: c.statement,
      rationale: c.rationale,
      scope: c.scope,
      status: c.status,
      supports: c.supports,
      conflictsWith: c.conflictsWith,
      nodes: graph.constrainedBy.get(c.id) ?? [],
    })),
    readiness: Object.fromEntries(graph.readiness),
    systems: [...graph.systems.values()],
    problems: graph.problems,
    freeBuckets: [...FREE_REQUIRE_BUCKETS],
    works: works?.byNode ?? {},
  };
}

const TITLE = 'Master Intent Graph';

/** <style> 와 페이지 본문 — 두 산출물이 공유한다 */
function renderParts(graph: MasterGraph, works?: WorkLinks): { style: string; body: string } {
  const css = readFileSync(join(here, 'viewer.css'), 'utf8');
  const js = readFileSync(join(here, 'viewer.js'), 'utf8');
  const data = JSON.stringify(serialize(graph, works)).replace(/</g, '\\u003c');

  const nodes = [...graph.nodes.values()];
  const count = (t: string) => nodes.filter((n) => n.type === t).length;
  const overlay = (o: string) => nodes.filter((n) => n.type === 'capability' && n.overlay === o).length;
  const errors = graph.problems.filter((p) => p.severity === 'ERROR').length;

  const style = `<style>
${css}
</style>`;

  const body = `<header>
  <h1>Master Intent Graph</h1>
  <div class="stats">
    <span>노드 <b>${graph.nodes.size}</b></span>
    <span>WorldState <b>${count('world_state')}</b></span>
    <span>Goal <b>${count('goal')}</b></span>
    <span>Possibility <b>${count('possibility')}</b></span>
    <span>Capability <b>${count('capability')}</b></span>
    <span><i class="sw sw-impl"></i>IMPLEMENTED <b>${overlay('IMPLEMENTED')}</b></span>
    <span><i class="sw sw-part"></i>PARTIAL <b>${overlay('PARTIAL')}</b></span>
    <span><i class="sw sw-miss"></i>MISSING <b>${overlay('MISSING')}</b></span>
    <span>구멍 <b>${graph.holes.length}</b></span>
    <span>정합 문제 <b>${errors} ERROR · ${graph.problems.length - errors} WARN</b></span>
  </div>
</header>

<main>
  <aside>
    <div class="sec">
      <h2>찾기</h2>
      <input type="search" id="q" placeholder="ID · 본문 검색" autocomplete="off">
    </div>

    <div class="sec">
      <h2>렌즈</h2>
      <div class="toggles">
        <label class="tg" id="only-missing"><span class="dot sw-miss"></span>아직 세계에 없는 것만</label>
        <label class="tg" id="only-holes"><span class="dot" style="border-color:var(--hole);background:var(--hole)"></span>구멍 있는 노드만</label>
      </div>
    </div>

    <div class="sec">
      <h2>갈래 준비도</h2>
      <p class="hint">요구 Capability 중 이미 세계에 있는 것의 비율. 위쪽이 다음 Cycle 에 가장 가까운 경로다.</p>
      <div id="ranks"></div>
    </div>

    <div class="sec">
      <h2>관계</h2>
      <p class="hint">눌러서 끄고 켠다.</p>
      <div class="toggles" id="legend"></div>
    </div>

    <div class="sec">
      <h2>척추 — 어느 시스템의 조각인가</h2>
      <p class="hint">고르면 그 시스템에 속한 Capability 만 남는다. 점선 = 잠정(grounded: false).</p>
      <div id="systems"></div>
    </div>

    <div class="sec">
      <h2>Constraint — 무엇을 거르나</h2>
      <p class="hint">고르면 그 원칙 아래 있는 노드만 남는다. 숫자는 걸린 노드 수다.</p>
      <div id="lenses"></div>
    </div>

    <div class="sec">
      <h2>정합성</h2>
      <div id="problems"></div>
    </div>
  </aside>

  <div id="canvas">
    <svg id="graph"></svg>
    <div class="zoombar">
      <button id="zoom-out" title="축소">−</button>
      <button id="zoom-in" title="확대">+</button>
      <button id="zoom-fit" title="전체 보기">⤢</button>
    </div>
  </div>

  <div id="detail"></div>
</main>

<script>window.__MASTER_GRAPH__ = ${data};</script>
<script>
${js}
</script>`;

  return { style, body };
}

/** 브라우저로 직접 여는 단일 문서 */
export function renderHtml(graph: MasterGraph, works?: WorkLinks): string {
  const { style, body } = renderParts(graph, works);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
${style}
</head>
<body>
${body}
</body>
</html>
`;
}

/** Artifact 게시용 — 뷰어가 doctype·html·head·body 를 감싸므로 그 태그를 내지 않는다.
 *  손으로 껍데기를 벗기지 않도록 도구가 이 형태까지 만들어 둔다. */
export function renderArtifactPage(graph: MasterGraph, works?: WorkLinks): string {
  const { style, body } = renderParts(graph, works);
  return `<title>${TITLE}</title>
${style}
${body}
`;
}
