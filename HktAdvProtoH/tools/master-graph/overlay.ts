// Overlay 렌더 — master/overlay.md 를 graph/*.yaml 에서 생성한다 (GRAPH.md 와 같은 방식).
//
// 표의 값은 노드 필드가 소유한다:
//   Capability   overlay · overlay_evidence · overlay_gap
//   Possibility  overlay_missing · overlay_note (구현 여부 판정이 아니라 경로 요약)
//   MW/MA/MK     implemented · implemented_note
// 섹션 구성·산문은 graph/overlay-notes.yaml 이 소유한다.
// "층이 요구하는 것" 표는 demands × overlay 에서 계산한다 — 손으로 쓰지 않는다.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { MasterGraph, GraphNode } from './model';

interface NotesRow {
  label: string;
  ids: string[];
}

interface NotesSection {
  kind: 'capability' | 'world' | 'possibility-head' | 'possibility' | 'zones';
  title: string;
  intro?: string;
  rows?: (string | { label: string; ids: string[] })[];
}

interface OverlayNotes {
  version: number;
  header: string;
  sections: NotesSection[];
  holes: string;
}

function rows(section: NotesSection): { label: string; first: string; rest: string[] }[] {
  const out: { label: string; first: string; rest: string[] }[] = [];
  for (const r of section.rows ?? []) {
    const label = typeof r === 'string' ? r : r.label;
    const ids = typeof r === 'string' ? [r] : r.ids;
    const [first, ...rest] = ids;
    if (!first) throw new Error(`overlay-notes 행에 id 가 없다: ${label} (${section.title})`);
    out.push({ label, first, rest });
  }
  return out;
}

function raw(node: GraphNode | undefined, field: string): string {
  const v = node?.raw?.[field];
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
}

const CRITERIA = `## 판정 기준

\`\`\`text
IMPLEMENTED   그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
PARTIAL       일부만 닫혔거나, 닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다
MISSING       세계에 그 의미가 없다
\`\`\`

근거 칸에는 Cycle ID 또는 코드 실측을 적는다. **주장만 적지 않는다.**
Constraint Violation 과 혼동하지 않는다 — 여기는 **있는가/없는가**이지 **허용되는가**가 아니다.`;

const UPDATE_PATH = `## 갱신 경로

이 파일은 생성물이다 — Feedback 이 고치는 것은 노드 필드다.

\`\`\`text
cycles/<CycleId>/08-verification.md 의 MASTER FEEDBACK
        ↓
guides/master-feedback.md (Feedback — 위쪽 접합점 반영)
        ↓
graph/*.yaml 노드의 overlay · overlay_evidence · overlay_gap ·
overlay_missing · overlay_note · implemented · implemented_note
(+ 섹션 구성이 바뀌면 graph/overlay-notes.yaml)
        ↓
npm run master:graph  →  이 파일 재생성 (경위는 feedback/<CycleId>.md 소유)
\`\`\`

Cycle Agent 가 이 파일을 직접 편집하지 않는다.`;

export function renderOverlay(graph: MasterGraph, masterDir: string): { text: string; warnings: string[] } {
  const notes = parseYaml(readFileSync(join(masterDir, 'graph', 'overlay-notes.yaml'), 'utf8')) as OverlayNotes;
  const warnings: string[] = [];
  const listed = new Set<string>();
  const out: string[] = [];

  out.push('# Capability Overlay');
  out.push('');
  out.push('<!-- 생성물 — 손으로 고치지 않는다. 원본: graph/*.yaml 노드 필드 + graph/overlay-notes.yaml · 재생성: npm run master:graph -->');
  out.push('');
  out.push(notes.header.trimEnd());
  out.push('');
  out.push(CRITERIA);

  const node = (id: string, where: string): GraphNode | undefined => {
    const n = graph.nodes.get(id);
    if (!n) warnings.push(`overlay-notes ${where} 가 없는 노드를 가리킨다: ${id}`);
    return n;
  };

  for (const sec of notes.sections) {
    out.push('');
    out.push(`${sec.kind === 'possibility' || sec.kind === 'zones' ? '###' : '##'} ${sec.title}`);
    if (sec.intro) {
      out.push('');
      out.push(sec.intro.trimEnd());
    }
    if (sec.kind === 'possibility-head') continue;

    out.push('');
    if (sec.kind === 'capability') {
      out.push('| Capability | 상태 | 근거 | 부족한 것 |');
      out.push('|---|---|---|---|');
      for (const r of rows(sec)) {
        listed.add(r.first);
        r.rest.forEach((id) => listed.add(id));
        const n = node(r.first, sec.title);
        const status = (n?.overlay as string) ?? '?';
        for (const id of r.rest) {
          const other = graph.nodes.get(id);
          if (other && other.overlay !== n?.overlay)
            warnings.push(`묶인 행의 상태가 갈린다 — 행을 나눌 것: ${r.label} (${r.first}=${n?.overlay} · ${id}=${other.overlay})`);
        }
        out.push(`| ${r.label} | ${status} | ${raw(n, 'overlay_evidence') || '—'} | ${raw(n, 'overlay_gap') || '—'} |`);
      }
    } else if (sec.kind === 'world') {
      out.push('| Node | 상태 | 지금 세계에 있는 것 / 없는 것 |');
      out.push('|---|---|---|');
      for (const r of rows(sec)) {
        const n = node(r.first, sec.title);
        out.push(`| ${r.label} | ${raw(n, 'implemented') || '?'} | ${raw(n, 'implemented_note') || '—'} |`);
      }
    } else if (sec.kind === 'possibility') {
      out.push('| Possibility | 요구 중 없는 것 | 비고 |');
      out.push('|---|---|---|');
      for (const r of rows(sec)) {
        const n = node(r.first, sec.title);
        out.push(`| ${r.label} | ${raw(n, 'overlay_missing') || '—'} | ${raw(n, 'overlay_note') || '—'} |`);
      }
    } else if (sec.kind === 'zones') {
      out.push('| 층 | demands | 지금 채워진 것 |');
      out.push('|---|---|---|');
      for (const r of rows(sec)) {
        const n = node(r.first, sec.title);
        const demands = (n?.raw?.demands as string[]) ?? [];
        const filled = demands.filter((d) => graph.nodes.get(d)?.overlay === 'IMPLEMENTED');
        const partial = demands.filter((d) => graph.nodes.get(d)?.overlay === 'PARTIAL');
        const missing = demands.filter((d) => !graph.nodes.get(d) || graph.nodes.get(d)?.overlay === 'MISSING');
        const short = (id: string) => id.replace(/^MC-/, '');
        const detail = [
          missing.length ? `없음: ${missing.map(short).join(' · ')}` : '',
          partial.length ? `절반: ${partial.map(short).join(' · ')}` : '',
        ]
          .filter(Boolean)
          .join(' / ');
        out.push(`| ${r.label} | ${demands.join(' · ')} | ${filled.length} / ${demands.length}${detail ? ` (${detail})` : ''} |`);
      }
    }
  }

  out.push('');
  out.push('## 지금 세계에서 가장 큰 구멍');
  out.push('');
  out.push(notes.holes.trimEnd());
  out.push('');
  out.push(UPDATE_PATH);
  out.push('');

  // 누락 경고 — overlay 를 가진 Capability 가 어느 표에도 없다
  for (const n of graph.nodes.values()) {
    if (n.type === 'capability' && n.overlay && !listed.has(n.id))
      warnings.push(`overlay 를 가진 Capability 가 overlay-notes 의 어느 표에도 없다: ${n.id}`);
  }

  return { text: out.join('\n'), warnings };
}
