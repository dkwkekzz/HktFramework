// Capability ↔ 작업(Frontier 후보 · Cycle) 연결 수집 — 두 층의 접합점을 뷰어에 보이게 한다.
//
// graph/*.yaml 은 의미만 담고, 어느 후보가 어느 Capability 를 겨냥하며 어느 Cycle 이
// 그것을 세웠는가는 frontier/*.md 와 cycles/*/01-cycle.md 의 MASTER TRACE 가 소유한다.
// 여기서 그 둘(+ 노드의 overlay_evidence 가 인용한 Cycle)을 읽어 노드별로 겹친다.
// 읽기만 한다 — 어떤 원본도 수정하지 않는다.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MasterGraph } from './model';

export interface WorkCandidate {
  fr: string; // FR-…
  track: string; // ITEM · COMBAT …
  status: string; // Status 줄 (PROPOSED …)
  selected: boolean; // 그 트랙의 SELECTED 가 이 후보를 가리키는가
}

export interface WorkCycle {
  id: string; // 디렉터리 이름
  status: string; // 01-cycle.md 의 STATUS
}

export interface WorkLinks {
  /** nodeId → 이 노드를 겨냥한 후보와 이 노드를 다룬 Cycle */
  byNode: Record<string, { candidates: WorkCandidate[]; cycles: WorkCycle[] }>;
}

const MC_RE = /\bMC-[A-Z0-9-]+\b/g;
const CYCLE_RE = /\bC(?:-[A-Z]+-\d+|\d{3})\b/g;

/** STATUS 값 정규화 — 날짜·괄호 꼬리를 떼고 상태어만 남긴다 */
function statusWord(v: string | undefined): string {
  return (v ?? '?').trim().split(/\s{2,}|\(/)[0]?.trim() ?? '?';
}

function cycleStatus(cyclesDir: string, dirName: string): string {
  const p = join(cyclesDir, dirName, '01-cycle.md');
  if (!existsSync(p)) return '?';
  return statusWord(readFileSync(p, 'utf8').match(/^STATUS\s+(.+)$/m)?.[1]);
}

export function collectWorkLinks(packDir: string, graph: MasterGraph): WorkLinks {
  const byNode: WorkLinks['byNode'] = {};
  const slot = (id: string) => (byNode[id] ??= { candidates: [], cycles: [] });
  const cyclesDir = join(packDir, 'cycles');
  const cycleDirs = existsSync(cyclesDir)
    ? readdirSync(cyclesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];
  const dirOf = (bare: string) => cycleDirs.find((d) => d === bare || d.startsWith(`${bare}-`));

  // ① Frontier 후보 → 겨냥한 Capability. 후보 블록 전체에서 MC 언급을 줍는다 —
  //    Target 이 아닌 인용도 섞이지만, 접합의 후보를 놓치는 것보다 낫다 (관찰용).
  const frontierDir = join(packDir, 'master', 'frontier');
  if (existsSync(frontierDir)) {
    for (const f of readdirSync(frontierDir)) {
      if (!f.endsWith('.md') || f === 'README.md') continue;
      const track = f.replace(/\.md$/, '').toUpperCase();
      const text = readFileSync(join(frontierDir, f), 'utf8');
      const selectedText = text.match(/## SELECTED\s*\n+```text\n([\s\S]*?)```/)?.[1] ?? '';
      for (const rawBlock of text.split(/^### /m).slice(1)) {
        const block = rawBlock.split(/\n## /)[0] ?? rawBlock; // 뒤따르는 절(## SELECTED 등)을 삼키지 않는다
        const fr = block.match(/^(FR-[A-Z0-9-]+)/)?.[1];
        if (!fr) continue;
        const status = block.match(/Status\s+([A-Z]+)/)?.[1] ?? '?';
        const selected = selectedText.includes(fr);
        for (const mc of new Set(block.match(MC_RE) ?? [])) {
          if (graph.nodes.has(mc)) slot(mc).candidates.push({ fr, track, status, selected });
        }
      }
    }
  }

  // ② Cycle 의 MASTER TRACE → 다룬 Capability
  for (const dir of cycleDirs) {
    const p = join(cyclesDir, dir, '01-cycle.md');
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    const trace = text.match(/## MASTER TRACE\n([\s\S]*?)(?=\n## |$)/)?.[1];
    if (!trace) continue;
    const status = statusWord(text.match(/^STATUS\s+(.+)$/m)?.[1]);
    for (const mc of new Set(trace.match(MC_RE) ?? [])) {
      if (graph.nodes.has(mc)) slot(mc).cycles.push({ id: dir, status });
    }
  }

  // ③ 노드의 overlay_evidence 가 인용한 Cycle — MASTER TRACE 이전(옛 번호공간) 보완
  for (const n of graph.nodes.values()) {
    const ev = typeof n.raw['overlay_evidence'] === 'string' ? (n.raw['overlay_evidence'] as string) : '';
    for (const bare of new Set(ev.match(CYCLE_RE) ?? [])) {
      const dir = dirOf(bare);
      if (!dir) continue;
      const s = slot(n.id);
      if (!s.cycles.some((c) => c.id === dir)) s.cycles.push({ id: dir, status: cycleStatus(cyclesDir, dir) });
    }
  }

  for (const s of Object.values(byNode)) s.cycles.sort((a, b) => a.id.localeCompare(b.id));
  return { byNode };
}
