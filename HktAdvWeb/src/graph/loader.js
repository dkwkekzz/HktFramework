// =====================================================================
// seed 그래프 로더 + 정합 검사기 (step B1)
// ---------------------------------------------------------------------
// seed 그래프를 "문서"에서 "검증된 데이터"로 만든다 — 설계의 기계 인수 지점.
// 검사: id 유일성 · 참조 무결(serves/stages/alternatives) · serves DAG 이고
//       뿌리 G-0 에 닿음 · 모든 done_when/demand 술어 파싱(A4) · demand·supplies
//       속성명이 사전에 존재 · verb 는 17 동사이고 말단만 보유 · 죽은 무대 경고.
// 하드 오류가 하나라도 있으면 throw. 경고는 결과에 담아 돌려준다.
// (Design-StepPlan §4 B1)
// =====================================================================
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../paths.js';
import { loadLexicon } from '../substrate/lexicon.js';
import { evalPred, PREDICATE_DSL_VERSION } from '../substrate/predicate.js';
import {
  VERBS, EPISTEMIC_STATES, GOAL_REQUIRED, STAGE_REQUIRED,
  isKnownGoalField, isKnownStageField,
} from './schema.js';

const ID_REF = /[GS]-[0-9A-Za-z.]+/g;

export function loadGraph(file = dataPath('objective-graph.yaml'), opts = {}) {
  const lexicon = opts.lexicon ?? loadLexicon();
  const raw = opts.raw ?? yaml.load(readFileSync(file, 'utf8'));
  return validateGraph(raw, lexicon);
}

export function validateGraph(raw, lexicon) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  const goals = raw?.goals ?? [];
  const stages = raw?.stages ?? [];
  const constants = raw?.constants ?? {};

  // ── 0. meta / DSL 버전 ──
  if (raw?.meta?.predicate_dsl && raw.meta.predicate_dsl !== PREDICATE_DSL_VERSION) {
    err(`predicate_dsl 버전 불일치: 그래프 '${raw.meta.predicate_dsl}' ≠ 평가기 '${PREDICATE_DSL_VERSION}'`);
  }

  // ── 1. id 유일성 (goals + stages 통합 네임스페이스) ──
  const goalsById = new Map();
  const stagesById = new Map();
  const allIds = new Set();
  for (const g of goals) {
    if (!g?.id) { err('id 없는 goal 항목'); continue; }
    if (allIds.has(g.id)) err(`중복 id: '${g.id}'`);
    allIds.add(g.id);
    goalsById.set(g.id, g);
  }
  for (const s of stages) {
    if (!s?.id) { err('id 없는 stage 항목'); continue; }
    if (allIds.has(s.id)) err(`중복 id: '${s.id}'`);
    allIds.add(s.id);
    stagesById.set(s.id, s);
  }

  // ── 2. 노드 필수 필드 + 알 수 없는 필드 경고 ──
  for (const g of goals) {
    if (!g?.id) continue;
    for (const f of GOAL_REQUIRED) {
      if (g[f] === undefined || g[f] === null) err(`${g.id}: 필수 필드 '${f}' 누락`);
    }
    if (g.epistemic !== undefined && !EPISTEMIC_STATES.has(g.epistemic)) {
      err(`${g.id}: 알 수 없는 발견 상태 '${g.epistemic}'`);
    }
    for (const f of Object.keys(g)) {
      if (!isKnownGoalField(f)) warn(`${g.id}: 알 수 없는 필드 '${f}'`);
    }
  }
  for (const s of stages) {
    if (!s?.id) continue;
    for (const f of STAGE_REQUIRED) {
      if (s[f] === undefined || s[f] === null) err(`${s.id}: 필수 필드 '${f}' 누락`);
    }
    for (const f of Object.keys(s)) {
      if (!isKnownStageField(f)) warn(`${s.id}: 알 수 없는 필드 '${f}'`);
    }
  }

  // ── 3. 부모/자식 관계 (serves = child→parent) + 참조 무결 ──
  const parentsOf = new Map(); // id → [parent ids]
  const childrenOf = new Map(); // id → [child ids]
  for (const g of goalsById.keys()) childrenOf.set(g, []);
  for (const g of goals) {
    if (!g?.id) continue;
    const serves = g.serves ?? [];
    if (!Array.isArray(serves)) { err(`${g.id}: serves 는 배열이어야 한다`); continue; }
    parentsOf.set(g.id, serves);
    for (const p of serves) {
      if (!goalsById.has(p)) err(`${g.id}: serves 가 없는 노드 '${p}' 를 가리킨다`);
      else childrenOf.get(p).push(g.id);
    }
  }

  // stages 참조 무결
  for (const g of goals) {
    for (const sid of g?.stages ?? []) {
      if (!stagesById.has(sid)) err(`${g.id}: stages 가 없는 무대 '${sid}' 를 가리킨다`);
    }
  }

  // alternatives 안의 id 참조 무결 (프로즈에 박힌 G-/S- 토큰만 검사)
  for (const g of goals) {
    for (const alt of g?.alternatives ?? []) {
      for (const ref of String(alt).match(ID_REF) ?? []) {
        if (!allIds.has(ref)) err(`${g.id}: alternatives 가 없는 id '${ref}' 를 참조한다`);
      }
    }
  }

  // ── 4. verb 규칙 ──
  //   주의: seed 의 serves 는 분해 에지와 공급 에지(DAG 교차: 관측 정보가 타 노드의
  //   demand 에 봉사)를 겸한다. 따라서 "자식 없는 노드"가 곧 행동 말단이 아니다 —
  //   verb 를 가진 노드도 다른 노드가 serves 로 지목할 수 있다(예: G-0.1.1.3.1 ← G-0.1.1.2.2).
  //   그래서 verb 의 구조적 결합(말단만 verb)은 강제하지 않고, verb 어휘만 검사한다.
  const isLeaf = (id) => (childrenOf.get(id)?.length ?? 0) === 0;
  for (const g of goals) {
    if (!g?.id) continue;
    if (g.verb !== undefined && !VERBS.has(g.verb)) {
      err(`${g.id}: 알 수 없는 동사 '${g.verb}' (17 동사 목록 밖)`);
    }
  }

  // ── 5. serves DAG (사이클 검출) + 뿌리 G-0 도달 ──
  //   serves 는 부모를 가리키므로 위로 올라가면 G-0(serves:[]) 에서 멈춰야 한다.
  const ROOT = 'G-0';
  if (!goalsById.has(ROOT)) err(`뿌리 '${ROOT}' 가 없다`);
  const color = new Map(); // 0 미방문 / 1 방문중 / 2 완료
  const reaches = new Map(); // id → bool (G-0 도달)
  const dfs = (id, stack) => {
    if (color.get(id) === 1) { err(`serves 사이클 검출: ${[...stack, id].join(' → ')}`); return false; }
    if (color.get(id) === 2) return reaches.get(id) ?? false;
    color.set(id, 1);
    let ok = id === ROOT;
    const parents = parentsOf.get(id) ?? [];
    for (const p of parents) {
      if (!goalsById.has(p)) continue; // 이미 참조 무결 오류로 보고됨
      if (dfs(p, [...stack, id])) ok = true;
    }
    color.set(id, 2);
    reaches.set(id, ok);
    return ok;
  };
  for (const id of goalsById.keys()) {
    if (!dfs(id, [])) {
      if (id !== ROOT) err(`${id}: serves 를 따라 뿌리 '${ROOT}' 에 닿지 못한다`);
    }
  }

  // ── 6. 술어 파싱(A4) — done_when + demand.when + demand.property(has 래핑) ──
  const dryCtx = { constants, lexicon, actor: { id: '_dry', inventory: [] }, state: { world: {}, stage: {} } };
  const tryPred = (pred, where) => {
    try { evalPred(pred, dryCtx); }
    catch (e) { err(`${where}: 술어 파싱 실패 — ${e.message}`); }
  };
  for (const g of goals) {
    if (g?.done_when) tryPred(g.done_when, `${g.id}.done_when`);
    for (const [i, d] of (g?.demand ?? []).entries()) {
      if (d?.when) tryPred(d.when, `${g.id}.demand[${i}].when`);
      if (d?.property) tryPred({ has: { kind: d.kind, property: d.property, min_count: 1 } }, `${g.id}.demand[${i}]`);
    }
  }

  // ── 7. 속성명 사전 등재 (supplies; demand 는 has 래핑 파싱이 이미 검사) ──
  const demandProps = new Set();
  for (const g of goals) {
    for (const d of g?.demand ?? []) if (d?.property?.name) demandProps.add(d.property.name);
  }
  for (const s of stages) {
    for (const sup of s?.supplies ?? []) {
      if (!sup?.property) { err(`${s.id}: supplies 항목에 property 가 없다`); continue; }
      if (!lexicon.has(sup.property)) err(`${s.id}: supplies 속성 '${sup.property}' 가 사전에 없다`);
    }
  }

  // ── 8. 죽은 무대 경고 (supplies 속성이 어떤 demand 와도 무관) ──
  for (const s of stages) {
    const props = (s?.supplies ?? []).map((x) => x?.property).filter(Boolean);
    if (props.length && !props.some((p) => demandProps.has(p))) {
      warn(`${s.id}: 죽은 무대 — supplies 속성(${props.join(',')})이 어떤 노드의 demand 와도 무관`);
    }
  }

  if (errors.length) {
    throw new Error(`그래프 정합 오류 ${errors.length}건:\n- ${errors.join('\n- ')}`);
  }

  // ── 통계 (데모/눈 검증용) ──
  const leafNodes = [...goalsById.keys()].filter(isLeaf);
  const actionNodes = goals.filter((g) => g.verb !== undefined).map((g) => g.id);
  const roots = [...goalsById.keys()].filter((id) => (parentsOf.get(id) ?? []).length === 0);
  const epiDist = {};
  for (const g of goals) epiDist[g.epistemic] = (epiDist[g.epistemic] ?? 0) + 1;
  const slice = raw?.meta?.slices?.['slice-1'] ?? null;
  const stats = {
    goals: goalsById.size,
    stages: stagesById.size,
    leafNodes: leafNodes.length,   // serves-DAG 의 싱크(자식 없는 노드)
    actionNodes: actionNodes.length, // verb 를 가진 행동 노드
    roots,
    epistemicDist: epiDist,
    discoveredStages: [...stagesById.values()].filter((s) => s.discovered).length,
    sliceCoverage: slice ? { goals: slice.goals?.length ?? 0, stages: slice.stages?.length ?? 0 } : null,
    warnings: warnings.length,
  };

  return {
    meta: raw.meta, constants, lexicon,
    goals, stages, goalsById, stagesById,
    parentsOf, childrenOf, isLeaf, leafNodes, actionNodes, roots,
    warnings, stats,
  };
}
