// 목적 그래프 검증기 — 데이터를 담지 않는다. objective-graph.json 을 읽어
// 참조 무결성만 확인한다. 원본은 objective-graph.json 하나뿐이다.
// 실행: node data/validate-graph.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const path = join(dirname(fileURLToPath(import.meta.url)), "objective-graph.json");
const g = JSON.parse(readFileSync(path, "utf8"));
const meta = g.meta || {};
const nodeTypes = meta.nodeTypes ? Object.keys(meta.nodeTypes) : null;
const relTypes = Array.isArray(meta.relationTypes) ? meta.relationTypes : null;

const errors = [];
const warnings = [];

// 1) id 중복
const ids = new Set();
for (const n of g.nodes || []) {
  if (!n.id) errors.push("id 없는 노드");
  else if (ids.has(n.id)) errors.push(`중복 id: ${n.id}`);
  else ids.add(n.id);
  if (nodeTypes && n.type && !nodeTypes.includes(n.type)) warnings.push(`알 수 없는 노드 타입 ${n.type} (${n.id})`);
}

// 2) parent 참조 + 순환
const byId = new Map((g.nodes || []).map((n) => [n.id, n]));
for (const n of g.nodes || []) {
  if (n.parent && !ids.has(n.parent)) errors.push(`parent 참조 오류: ${n.id} -> ${n.parent}`);
  // 순환 검사
  let cur = n, seen = new Set(), hops = 0;
  while (cur && cur.parent && hops++ < 1000) {
    if (seen.has(cur.id)) { errors.push(`parent 순환: ${n.id}`); break; }
    seen.add(cur.id); cur = byId.get(cur.parent);
  }
}

// 3) link 참조 + 관계 타입
for (const l of g.links || []) {
  if (!ids.has(l.source)) errors.push(`link source 오류: ${l.source}`);
  if (!ids.has(l.target)) errors.push(`link target 오류: ${l.target}`);
  if (relTypes && l.type && !relTypes.includes(l.type)) warnings.push(`알 수 없는 관계 타입 ${l.type} (${l.source}->${l.target})`);
}

// 요약
const byType = {};
for (const n of g.nodes || []) byType[n.type] = (byType[n.type] || 0) + 1;
console.log(`노드 ${(g.nodes || []).length} · 관계 ${(g.links || []).length}`);
console.log("타입별:", JSON.stringify(byType));
if (warnings.length) console.log("경고:\n  " + warnings.join("\n  "));
if (errors.length) { console.error("오류:\n  " + errors.join("\n  ")); process.exit(1); }
console.log("검증 통과 — 참조 무결성 이상 없음.");
