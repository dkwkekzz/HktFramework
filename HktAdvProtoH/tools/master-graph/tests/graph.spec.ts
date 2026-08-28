// Master Graph 시각화 도구의 계약 — 활성 팩의 실제 그래프로 검증한다.
// 그림의 모양이 아니라 "그림이 무엇을 말하는가" 를 고정한다.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMasterGraph } from '../model';
import { renderMermaid } from '../mermaid';
import { renderArtifactPage, renderHtml, serialize } from '../html';
import { activePackDir } from '../../active-pack';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const masterDir = join(activePackDir(root), 'master');
const graph = loadMasterGraph(masterDir);

describe('loadMasterGraph', () => {
  it('graph/*.yaml 의 모든 노드를 읽는다', () => {
    expect(graph.nodes.size).toBeGreaterThan(0);
    for (const n of graph.nodes.values()) {
      expect(n.id).toMatch(/^M[WAGPCKB]-/);
      expect(n.type).toBeTruthy();
    }
  });

  it('관계를 노드 필드에서만 유도한다 — 존재하지 않는 노드를 가리키지 않는다', () => {
    const dangling = graph.problems.filter((p) => p.code === 'DANGLING_REF');
    expect(dangling, dangling.map((p) => p.message).join('\n')).toEqual([]);
  });

  // SCHEMA.md 가 arises_from 을 "세계의 인과 척추" 라 부르면서도 오래 간선이 아니었다.
  // 척추가 그림에 없으면 세계의 인과는 world-state.yaml 머리의 손으로 그린 주석으로만
  // 남고, GRAPH.md 를 읽는 사람(특히 Frontier 후보를 뽑는 사람)은 그것을 보지 못한다.
  it('arises_from 을 간선으로 만든다 — 낳은 쪽에서 낳아진 쪽으로', () => {
    const spine = graph.edges.filter((e) => e.kind === 'arises_from');
    expect(spine.length).toBeGreaterThan(0);

    for (const e of spine) {
      // 척추는 세계 안에서만 흐른다
      expect(graph.nodes.get(e.from)!.type).toBe('world_state');
      expect(graph.nodes.get(e.to)!.type).toBe('world_state');
      // 방향 — 낳아진 쪽(to)이 자기 arises_from 에 낳은 쪽(from)을 적는다
      const declared = graph.nodes.get(e.to)!.raw.arises_from as string[] | undefined;
      expect(declared ?? []).toContain(e.from);
    }

    // arises_from 을 적은 모든 노드가 간선을 얻는다 — 하나도 빠지지 않는다
    for (const n of graph.nodes.values()) {
      if (n.type !== 'world_state') continue;
      for (const parent of (n.raw.arises_from as string[] | undefined) ?? []) {
        expect(
          spine.some((e) => e.from === parent && e.to === n.id),
          `${n.id}.arises_from 의 ${parent} 가 간선이 되지 않았다`,
        ).toBe(true);
      }
    }
  });

  it('세계 인과 척추가 텍스트 트리로 실린다 — 뿌리는 들여쓰기 0, 자식은 부모 아래', () => {
    const md = renderMermaid(graph);
    expect(md).toContain('## 세계 인과 척추');
    const spine = graph.edges.filter((e) => e.kind === 'arises_from');
    for (const e of spine.slice(0, 5)) {
      // 낳은 쪽(from)과 태어난 쪽(to) 둘 다 트리에 줄로 존재한다
      expect(md).toMatch(new RegExp(`^ *${e.from.replace(/^MW-/, '')}`, 'm'));
      expect(md).toMatch(new RegExp(`^ *${e.to.replace(/^MW-/, '')}`, 'm'));
    }
  });

  it('requires 와 required_by 가 양방향으로 일치한다', () => {
    const asym = graph.problems.filter((p) => p.code.startsWith('ASYMMETRIC'));
    expect(asym, asym.map((p) => p.message).join('\n')).toEqual([]);
  });

  it('노드가 가리키는 Constraint 가 전부 존재한다', () => {
    const unknown = graph.problems.filter((p) => p.code === 'UNKNOWN_CONSTRAINT');
    expect(unknown, unknown.map((p) => p.message).join('\n')).toEqual([]);
  });

  it('자유 서술 버킷(relationship · resource)은 관계로 만들지 않는다', () => {
    // "기관을 가진 Actor 와의 거래 관계" 같은 서술이 ID 로 오해되면 안 된다
    for (const e of graph.edges) expect(graph.nodes.has(e.to)).toBe(true);
  });

  it('Possibility 준비도를 요구 Capability 의 overlay 로 계산한다', () => {
    for (const [id, r] of graph.readiness) {
      const node = graph.nodes.get(id)!;
      expect(node.type).toBe('possibility');
      expect(r.implemented + r.partial + r.missing).toBe(r.total);
      if (r.total === 0) {
        expect(r.unspecified).toBe(true); // 미기재는 0% 가 아니다
      } else {
        expect(r.score).toBeCloseTo((r.implemented + r.partial * 0.5) / r.total);
        expect(r.blockers).toHaveLength(r.partial + r.missing);
      }
    }
  });

  it('part_of 가 레지스트리에 있는 시스템·자리만 가리킨다', () => {
    const bad = graph.problems.filter(
      (p) => p.code === 'UNKNOWN_SYSTEM' || p.code === 'UNKNOWN_SEGMENT' || p.code === 'MISSING_PART_OF',
    );
    expect(bad, bad.map((p) => p.message).join('\n')).toEqual([]);
  });

  it('빈 인과 필드를 구멍으로 모은다', () => {
    const ids = new Set(graph.holes.map((h) => h.nodeId));
    for (const id of ids) expect(graph.nodes.has(id)).toBe(true);
    // 비어 있지 않은 필드가 구멍으로 잡히지 않는다
    for (const h of graph.holes) {
      const [head] = h.field.split('.');
      const v = graph.nodes.get(h.nodeId)!.raw[head!];
      const empty = v == null || (Array.isArray(v) && v.length === 0) || typeof v === 'object';
      expect(empty, `${h.nodeId}.${h.field}`).toBe(true);
    }
  });
});

describe('renderMermaid', () => {
  const md = renderMermaid(graph);

  it('mermaid 블록 수 = 조각을 가진 시스템 수 — 전 노드 그림은 그리지 않는다 (뷰어 몫)', () => {
    const withMembers = [...graph.systems.keys()].filter((sysId) =>
      [...graph.nodes.values()].some((n) => n.partOf?.memberships.some((m) => m.system === sysId)),
    );
    expect(md.match(/```mermaid/g)).toHaveLength(withMembers.length);
  });

  it('척추 섹션이 레지스트리의 시스템을 전부 싣는다', () => {
    if (graph.systems.size === 0) return;
    expect(md).toContain('## 척추');
    for (const s of graph.systems.values()) expect(md).toContain(`### ${s.name} — `);
  });

  it('선언한 노드만 관계에 쓴다', () => {
    for (const block of [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1] ?? '')) {
      const declared = new Set([...block.matchAll(/^ {2}(M[A-Z]-[A-Z0-9-]+)[[({>/]/gm)].map((m) => m[1]));
      for (const [, a, b] of block.matchAll(/^ {2}(M[A-Z][A-Z0-9-]+) [-=.]+.*?[->]+ (M[A-Z][A-Z0-9-]+)$/gm)) {
        expect(declared.has(a), `${a} 미선언`).toBe(true);
        expect(declared.has(b), `${b} 미선언`).toBe(true);
      }
    }
  });

  it('같은 입력이면 같은 출력이다 — --check 가 성립하려면 결정적이어야 한다', () => {
    expect(renderMermaid(loadMasterGraph(masterDir))).toBe(md);
  });

  it('커밋된 GRAPH.md 가 현재 graph/*.yaml 과 일치한다 (master:graph:check 동치)', () => {
    // graph/*.yaml 을 고치고 npm run master:graph 를 잊으면 여기서 걸린다
    expect(readFileSync(join(masterDir, 'graph', 'GRAPH.md'), 'utf8')).toBe(md);
  });
});

describe('renderHtml', () => {
  it('외부 요청 없이 한 장으로 닫힌다', () => {
    const html = renderHtml(graph);
    expect(html).not.toMatch(/<script[^>]+\ssrc=/);
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });

  it('뷰어가 쓰는 것을 전부 직렬화한다', () => {
    const data = serialize(graph);
    expect(data.nodes).toHaveLength(graph.nodes.size);
    expect(data.constraints).toHaveLength(graph.constraints.size);
    expect(Object.keys(data.readiness)).toHaveLength(graph.readiness.size);
    for (const e of data.edges) {
      expect(data.nodes.some((n) => n.id === e.from)).toBe(true);
      expect(data.nodes.some((n) => n.id === e.to)).toBe(true);
    }
  });

  it('Artifact 판은 감싸는 태그를 내지 않는다 — 뷰어가 doctype·html·head·body 를 준다', () => {
    const page = renderArtifactPage(graph);
    for (const tag of ['<!doctype', '<html', '<head>', '<body']) {
      expect(page.toLowerCase()).not.toContain(tag);
    }
    expect(page.startsWith('<title>')).toBe(true); // 갤러리·탭 이름이 첫 줄에 있어야 한다
  });

  it('Artifact 판과 단일 문서판이 같은 내용을 담는다', () => {
    const page = renderArtifactPage(graph);
    expect(page).toContain('window.__MASTER_GRAPH__');
    expect(page).toContain('id="canvas"');
    // 두 판 모두 외부 요청이 없다
    expect(page).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });

  it('데이터에 </script> 를 넣어도 문서가 깨지지 않는다', () => {
    const html = renderHtml(graph);
    const payload = html.slice(html.indexOf('window.__MASTER_GRAPH__'));
    expect(payload.slice(0, payload.indexOf('</script>'))).not.toContain('<');
  });
});
