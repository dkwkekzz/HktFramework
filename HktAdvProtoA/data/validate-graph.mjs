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

// 4) §16 구조 감사 (트리 §14·§16 — 고립 금지·요소는 목적에 연결·해결 방법 다중성)
//    기본은 요약 카운트만. `--audit` 로 대상 목록 전체 출력.
const AUDIT = process.argv.includes("--audit");
const audit = { isolated: [], underConnected: [], singleSolution: [] };
{
  const linked = new Set();
  const gLinksOf = new Map(); // 노드 -> 연결된 G 노드 집합
  for (const l of g.links || []) {
    linked.add(l.source); linked.add(l.target);
    const s = byId.get(l.source), t = byId.get(l.target);
    if (s && t) {
      if (t.type === "G") { if (!gLinksOf.has(l.source)) gLinksOf.set(l.source, new Set()); gLinksOf.get(l.source).add(l.target); }
      if (s.type === "G") { if (!gLinksOf.has(l.target)) gLinksOf.set(l.target, new Set()); gLinksOf.get(l.target).add(l.source); }
    }
  }
  const hasChild = new Set();
  for (const n of g.nodes || []) if (n.parent) hasChild.add(n.parent);

  for (const n of g.nodes || []) {
    // 고립 노드 — 관계·부모·자식 어디에도 안 걸린 노드 (H 역사·EV 사건은 면제)
    if (n.type === "H" || n.type === "EV") continue;
    const connected = linked.has(n.id) || n.parent || hasChild.has(n.id);
    if (!connected) audit.isolated.push(n.id);
    // 요소(E/R/L/K/T)는 최소 2개 목적에 연결 (트리 §14 근거 없는 요소 금지)
    if (["E", "R", "L", "K", "T"].includes(n.type)) {
      const gc = (gLinksOf.get(n.id)?.size) || 0;
      if (gc < 2) audit.underConnected.push(`${n.id}(${gc}목적)`);
    }
    // 말단 G 는 해결 방법 2개 이상 (트리 §17-13 해결 방법 다중성)
    if (n.type === "G" && !hasChild.has(n.id)) {
      const sol = n.detail?.["해결 방법"];
      const cnt = Array.isArray(sol) ? sol.length : (sol ? 1 : 0);
      if (cnt < 2) audit.singleSolution.push(`${n.id}(${cnt})`);
    }
  }
}

// 요약
const byType = {};
for (const n of g.nodes || []) byType[n.type] = (byType[n.type] || 0) + 1;
console.log(`노드 ${(g.nodes || []).length} · 관계 ${(g.links || []).length}`);
console.log("타입별:", JSON.stringify(byType));
console.log(`§16 감사: 고립 노드 ${audit.isolated.length} · 요소 저연결(<2목적) ${audit.underConnected.length} · 말단 단일해결 ${audit.singleSolution.length}` + (AUDIT ? "" : "  (--audit 로 목록)"));
if (AUDIT) {
  if (audit.isolated.length) console.log("  고립:", audit.isolated.join(", "));
  if (audit.underConnected.length) console.log("  저연결:", audit.underConnected.join(", "));
  if (audit.singleSolution.length) console.log("  단일해결:", audit.singleSolution.join(", "));
}
if (warnings.length) console.log("경고:\n  " + warnings.join("\n  "));
if (errors.length) { console.error("오류:\n  " + errors.join("\n  ")); process.exit(1); }
console.log("검증 통과 — 참조 무결성 이상 없음.");
