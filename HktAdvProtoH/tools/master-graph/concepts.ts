// Concept Registry 로더 — master/graph/concepts.yaml (파일럿 · DRAFT) 을 읽어
// 개념 ↔ Capability ↔ 코드 실체의 삼각 대조 데이터를 만든다.
//
//   개념(definition)  기획서 § 가 정의한 것 — 여기서는 그대로 옮겨 적는다
//   실체(anchors)     세계 코드의 대응물 (`경로#심볼`) — 파일 존재 + 심볼 문자열 포함을 검사한다
//   조합(compositions) Capability 가 어떤 개념들의 조합인가 — 역인덱스도 함께 만든다
//
// 읽고 검사할 뿐, 어떤 원본도 수정하지 않는다. 파일이 없으면 조용히 빈 값을 낸다
// (개념 등록부는 파일럿이며 팩마다 있을 필요가 없다).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { MasterGraph } from './model';

export interface ConceptAnchor {
  ref: string; // 원문 `경로#심볼`
  found: boolean; // 파일이 있고 심볼 문자열이 그 안에 있다
}

export interface Concept {
  id: string;
  name: string;
  definition: string; // 기획서 §
  semantic: string;
  anchors: ConceptAnchor[];
  note: string; // anchors 뒤 주석 대신 쓰는 산문은 없다 — yaml 주석은 사람 몫
  usedBy: string[]; // 이 개념을 조합에 쓰는 Capability
}

export interface ConceptComposition {
  capability: string;
  uses: string[];
  note: string;
}

export interface ConceptRegistry {
  status: string; // DRAFT …
  domain: string;
  concepts: Concept[];
  compositions: ConceptComposition[];
  problems: string[]; // 모르는 Capability · 모르는 개념 · 깨진 앵커
}

function checkAnchor(projectRoot: string, ref: string): boolean {
  const [path, symbol] = ref.split('#');
  if (!path) return false;
  const full = join(projectRoot, path);
  if (!existsSync(full)) return false;
  if (!symbol) return true;
  return readFileSync(full, 'utf8').includes(symbol);
}

export function loadConcepts(projectRoot: string, masterDir: string, graph: MasterGraph): ConceptRegistry {
  const empty: ConceptRegistry = { status: '', domain: '', concepts: [], compositions: [], problems: [] };
  const path = join(masterDir, 'graph', 'concepts.yaml');
  if (!existsSync(path)) return empty;

  const raw = parseYaml(readFileSync(path, 'utf8')) as {
    status?: string;
    domain?: string;
    concepts?: Array<{ id?: string; name?: string; definition?: string; semantic?: string; anchors?: string[] }>;
    compositions?: Array<{ capability?: string; uses?: string[]; note?: string }>;
  };

  const problems: string[] = [];
  const concepts: Concept[] = [];
  for (const c of raw.concepts ?? []) {
    if (!c.id) continue;
    concepts.push({
      id: c.id,
      name: c.name ?? c.id,
      definition: c.definition ?? '',
      semantic: (c.semantic ?? '').trim(),
      anchors: (c.anchors ?? []).map((ref) => ({ ref, found: checkAnchor(projectRoot, ref) })),
      note: '',
      usedBy: [],
    });
  }
  const byId = new Map(concepts.map((c) => [c.id, c]));

  const compositions: ConceptComposition[] = [];
  for (const m of raw.compositions ?? []) {
    if (!m.capability) continue;
    if (!graph.nodes.has(m.capability)) problems.push(`compositions: 모르는 Capability ${m.capability}`);
    const uses = m.uses ?? [];
    for (const cn of uses) {
      const c = byId.get(cn);
      if (!c) {
        problems.push(`compositions(${m.capability}): 모르는 개념 ${cn}`);
        continue;
      }
      c.usedBy.push(m.capability);
    }
    compositions.push({ capability: m.capability, uses, note: (m.note ?? '').trim() });
  }

  for (const c of concepts)
    for (const a of c.anchors) if (!a.found) problems.push(`개념 ${c.id}: 앵커가 깨졌다 — ${a.ref}`);

  return { status: raw.status ?? '', domain: raw.domain ?? '', concepts, compositions, problems };
}
