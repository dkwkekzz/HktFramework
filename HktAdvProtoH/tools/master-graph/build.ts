// Master Graph 시각화 — master/graph/*.yaml 을 사람이 볼 수 있는 두 형태로 낸다.
//
//   npm run master:graph          GRAPH.md (Mermaid 스냅샷) 와 graph-view.html (인터랙티브) 을 만든다
//   npm run master:graph:check    아무것도 쓰지 않고 정합성과 GRAPH.md 최신 여부만 확인한다
//
// master/ 의 어떤 원본도 이 도구가 수정하지 않는다 — 읽고 그릴 뿐이다.
// 그림을 그리려면 어차피 참조를 전부 훑어야 하므로, 같은 통과에서 무결성 검사도 겸한다.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMasterGraph } from './model';
import { renderMermaid } from './mermaid';
import { renderHtml } from './html';
import { activePackDir } from '../active-pack';

function projectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

const MERMAID_FILE = 'graph/GRAPH.md';
const HTML_FILE = 'graph/graph-view.html';

export function run(argv: string[]): number {
  const checkOnly = argv.includes('--check');
  const root = projectRoot();
  const masterDir = join(activePackDir(root), 'master');

  if (!existsSync(join(masterDir, 'graph'))) {
    console.error(`master/graph 가 없다: ${masterDir}`);
    return 1;
  }

  const graph = loadMasterGraph(masterDir);
  const mermaid = renderMermaid(graph);
  const mermaidPath = join(masterDir, MERMAID_FILE);
  const htmlPath = join(masterDir, HTML_FILE);

  const errors = graph.problems.filter((p) => p.severity === 'ERROR');
  const warns = graph.problems.filter((p) => p.severity === 'WARN');

  if (checkOnly) {
    let failed = false;
    for (const p of graph.problems) console.log(`${p.severity === 'ERROR' ? '✗' : '·'} ${p.code} — ${p.message}`);
    if (errors.length > 0) {
      console.error(`\n정합성 실패 — ERROR ${errors.length}건`);
      failed = true;
    }
    const current = existsSync(mermaidPath) ? readFileSync(mermaidPath, 'utf8') : '';
    if (current !== mermaid) {
      console.error(`\n${MERMAID_FILE} 가 graph/*.yaml 과 어긋난다 — npm run master:graph 로 다시 만들 것`);
      failed = true;
    }
    if (!failed) {
      console.log(
        `\n정합성 통과 — 노드 ${graph.nodes.size} · 관계 ${graph.edges.length} · Constraint ${graph.constraints.size}` +
          (warns.length ? ` (WARN ${warns.length})` : ''),
      );
    }
    return failed ? 1 : 0;
  }

  writeFileSync(mermaidPath, mermaid, 'utf8');
  writeFileSync(htmlPath, renderHtml(graph), 'utf8');

  const rel = (p: string) => relative(root, p);
  console.log(`노드 ${graph.nodes.size} · 관계 ${graph.edges.length} · Constraint ${graph.constraints.size} · 구멍 ${graph.holes.length}`);
  for (const p of graph.problems) console.log(`  ${p.severity === 'ERROR' ? '✗' : '·'} ${p.code} — ${p.message}`);
  console.log(`\n  ${rel(mermaidPath)}   Mermaid 스냅샷 — PR·GitHub 에서 그대로 렌더된다`);
  console.log(`  ${rel(htmlPath)}   브라우저로 열어 관찰한다 (생성물 — 커밋하지 않는다)`);
  return errors.length > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(run(process.argv.slice(2)));
}
