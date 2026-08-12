#!/usr/bin/env node
// Deterministic Verification Runner — Design-AgentExecution.md §20, Bootstrap Step 8·10.
// AI 판단이 필요 없는 검사를 전부 담당한다. 위반 시 exit 1.
//
// 사용법:
//   node scripts/validation/verify.mjs schema <name> <file...>   스키마 검증
//   node scripts/validation/verify.mjs envelope <taskFile...>    Task Envelope 6요소 + 입력 존재
//   node scripts/validation/verify.mjs closure <cycleId>         Semantic Closure trace 완전성
//   node scripts/validation/verify.mjs frozen                    Frozen Contract/Module 해시 보호
//   node scripts/validation/verify.mjs registry                  Registry 3종 정합성
//   node scripts/validation/verify.mjs cycle <cycleId>           Cycle 전체 감사
//   node scripts/validation/verify.mjs all                       registry + frozen + 모든 Cycle

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './lib/yaml.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let failures = 0;
let checks = 0;

function ok(msg) { checks++; console.log(`  PASS  ${msg}`); }
function fail(msg) { checks++; failures++; console.log(`  FAIL  ${msg}`); }

function loadYaml(relPath) {
  const p = join(ROOT, relPath);
  return parseYaml(readFileSync(p, 'utf8'));
}

// ── 스키마 검증 ────────────────────────────────────────────────────────────

function typeOf(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'list';
  if (typeof v === 'object') return 'map';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'number';
  return 'string';
}

function typeMatches(expected, v) {
  const t = typeOf(v);
  if (expected === 'any') return true;
  if (expected === 'number') return t === 'number' || t === 'int';
  return t === expected;
}

// 경로 세그먼트를 문서에 대응시켜 {exists, value} 목록을 만든다. `*` 는 맵의 모든 키.
function collectField(node, segs) {
  if (segs.length === 0) return [];
  const [seg, ...rest] = segs;
  const out = [];
  const isMap = node !== null && typeof node === 'object' && !Array.isArray(node);
  if (!isMap) return [];
  const keys = seg === '*' ? Object.keys(node) : (seg in node ? [seg] : []);
  if (rest.length === 0) {
    if (seg === '*') {
      for (const k of keys) out.push({ exists: true, value: node[k], at: k });
    } else if (keys.length > 0) {
      out.push({ exists: true, value: node[seg], at: seg });
    } else {
      out.push({ exists: false, value: undefined, at: seg });
    }
    return out;
  }
  for (const k of keys) out.push(...collectField(node[k], rest));
  return out;
}

function validateSchema(schemaName, relPath) {
  let schema, doc;
  try { schema = loadYaml(`orchestration/schemas/${schemaName}.schema.yaml`); }
  catch (e) { fail(`schema ${schemaName}: cannot load schema (${e.message})`); return; }
  try { doc = loadYaml(relPath); }
  catch (e) { fail(`${relPath}: yaml parse error (${e.message})`); return; }
  const problems = [];
  for (const [path, spec] of Object.entries(schema.fields || {})) {
    const segs = path.split('.');
    const found = collectField(doc, segs);
    if (found.length === 0 && spec.required && !path.includes('*')) {
      // 부모가 통째로 없음 — 부모 필드의 required 검사가 별도로 잡지만 명시적으로도 보고
      problems.push(`${path}: missing (parent absent)`);
      continue;
    }
    for (const f of found) {
      if (!f.exists) {
        if (spec.required) problems.push(`${path}: missing`);
        continue;
      }
      if (spec.type && !typeMatches(spec.type, f.value)) {
        problems.push(`${path}: expected ${spec.type}, got ${typeOf(f.value)}`);
        continue;
      }
      if (spec.enum && !spec.enum.includes(f.value)) {
        problems.push(`${path}: "${f.value}" not in [${spec.enum.join(', ')}]`);
      }
      if (spec.pattern && !(new RegExp(spec.pattern).test(String(f.value)))) {
        problems.push(`${path}: "${f.value}" does not match ${spec.pattern}`);
      }
      if (spec.item_type && Array.isArray(f.value)) {
        for (const item of f.value) {
          if (!typeMatches(spec.item_type, item)) {
            problems.push(`${path}[]: expected ${spec.item_type}, got ${typeOf(item)}`);
          }
        }
      }
    }
  }
  if (problems.length === 0) ok(`${relPath} (schema: ${schemaName})`);
  else fail(`${relPath} (schema: ${schemaName})\n        - ${problems.join('\n        - ')}`);
}

// ── Task Envelope ─────────────────────────────────────────────────────────

function verifyEnvelope(relPath) {
  validateSchema('task', relPath);
  let doc;
  try { doc = loadYaml(relPath); } catch { return; }
  const task = doc && doc.task;
  if (!task) return;
  for (const input of task.allowed_inputs || []) {
    if (!existsSync(join(ROOT, input))) fail(`${relPath}: allowed_input not found: ${input}`);
    else ok(`${relPath}: input exists: ${input}`);
  }
  const skillPath = `skills/${task.skill}/SKILL.md`;
  if (task.skill && !existsSync(join(ROOT, skillPath))) {
    fail(`${relPath}: skill not found: ${skillPath}`);
  } else if (task.skill) {
    ok(`${relPath}: skill exists: ${task.skill}`);
  }
}

// ── Semantic Closure ──────────────────────────────────────────────────────

function verifyClosure(cycleId) {
  const dir = `cycles/${cycleId}/artifacts/world-design`;
  const tracePath = `${dir}/intent_trace.yaml`;
  if (!existsSync(join(ROOT, tracePath))) { fail(`${tracePath}: not found`); return; }
  let trace;
  try { trace = loadYaml(tracePath); } catch (e) { fail(`${tracePath}: ${e.message}`); return; }
  const entries = (trace && trace.intent_trace) || [];
  if (!Array.isArray(entries) || entries.length === 0) {
    fail(`${tracePath}: intent_trace is empty`);
    return;
  }
  let corpus = '';
  for (const f of ['world_state.yaml', 'world_rules.yaml', 'semantic_delta.yaml', 'semantic_dependencies.yaml']) {
    const p = join(ROOT, dir, f);
    if (existsSync(p)) corpus += readFileSync(p, 'utf8');
  }
  for (const e of entries) {
    const sem = e && e.intent_semantic;
    const resolved = (e && e.resolved_to) || [];
    if (!sem) { fail(`${tracePath}: entry without intent_semantic`); continue; }
    if (!Array.isArray(resolved) || resolved.length === 0) {
      fail(`closure: "${sem}" has no resolved_to (SEMANTIC_GAP)`);
      continue;
    }
    const missing = resolved.filter((token) => {
      const last = String(token).split('.').pop();
      return !corpus.includes(String(token)) && !corpus.includes(last);
    });
    if (missing.length > 0) {
      fail(`closure: "${sem}" -> [${missing.join(', ')}] not found in world_state/world_rules (SEMANTIC_GAP)`);
    } else {
      ok(`closure: "${sem}" -> ${resolved.join(', ')}`);
    }
  }
}

// ── Frozen 보호 ───────────────────────────────────────────────────────────

function hashPath(absPath) {
  const st = statSync(absPath);
  const h = createHash('sha256');
  if (st.isDirectory()) {
    const files = [];
    (function walk(d) {
      for (const name of readdirSync(d).sort()) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else files.push(p);
      }
    })(absPath);
    for (const f of files) {
      h.update(relative(absPath, f));
      h.update('\0');
      h.update(readFileSync(f));
    }
  } else {
    h.update(readFileSync(absPath));
  }
  return h.digest('hex');
}

function verifyFrozen() {
  for (const regFile of ['registry/contracts.yaml', 'registry/modules.yaml']) {
    let reg;
    try { reg = loadYaml(regFile); } catch (e) { fail(`${regFile}: ${e.message}`); continue; }
    const rootKey = regFile.includes('contracts') ? 'contracts' : 'modules';
    const entries = (reg && reg[rootKey]) || {};
    for (const [id, entry] of Object.entries(entries)) {
      if (!entry || typeof entry !== 'object') continue;
      const frozen = entry.status === 'FROZEN';
      if (!frozen && !entry.sha256) continue;
      if (!entry.path) {
        fail(`${regFile}: ${id} is FROZEN but has no path`);
        continue;
      }
      const abs = join(ROOT, entry.path);
      if (!existsSync(abs)) { fail(`${regFile}: ${id} path not found: ${entry.path}`); continue; }
      if (!entry.sha256) { fail(`${regFile}: ${id} is FROZEN but has no sha256`); continue; }
      const actual = hashPath(abs);
      if (actual !== entry.sha256) {
        fail(`frozen violation: ${id} (${entry.path}) hash mismatch\n        recorded: ${entry.sha256}\n        actual:   ${actual}`);
      } else {
        ok(`frozen intact: ${id} (${entry.path})`);
      }
    }
  }
}

// ── Registry 정합성 ───────────────────────────────────────────────────────

function verifyRegistry() {
  let semantics, modules, contracts;
  try {
    semantics = loadYaml('registry/semantics.yaml');
    modules = loadYaml('registry/modules.yaml');
    contracts = loadYaml('registry/contracts.yaml');
  } catch (e) { fail(`registry: parse error (${e.message})`); return; }
  const semNames = new Set(Object.keys((semantics && semantics.semantics) || {}));
  const contractIds = new Set(Object.keys((contracts && contracts.contracts) || {}));
  const semStatuses = ['ACTIVE', 'DEPRECATED', 'DRY_RUN'];
  const modStatuses = ['FROZEN', 'IN_PROGRESS', 'DRY_RUN'];
  const conStatuses = ['FROZEN', 'PROPOSED', 'DEPRECATED', 'DRY_RUN'];

  for (const [name, s] of Object.entries((semantics && semantics.semantics) || {})) {
    if (!s || !semStatuses.includes(s.status)) fail(`semantics.${name}: bad status "${s && s.status}"`);
    else ok(`semantic ${name} (${s.status})`);
  }
  for (const [id, m] of Object.entries((modules && modules.modules) || {})) {
    if (!m || !modStatuses.includes(m.status)) { fail(`modules.${id}: bad status "${m && m.status}"`); continue; }
    for (const req of m.requires || []) {
      if (!semNames.has(req)) fail(`modules.${id}: requires unknown semantic "${req}"`);
    }
    for (const c of m.consumes || []) {
      if (!contractIds.has(c)) fail(`modules.${id}: consumes unknown contract "${c}"`);
    }
    ok(`module ${id} (${m.status})`);
  }
  for (const [id, c] of Object.entries((contracts && contracts.contracts) || {})) {
    if (!c || !conStatuses.includes(c.status)) { fail(`contracts.${id}: bad status "${c && c.status}"`); continue; }
    if (c.path && !existsSync(join(ROOT, c.path))) fail(`contracts.${id}: path not found: ${c.path}`);
    else ok(`contract ${id} (${c.status})`);
  }
}

// ── Cycle 전체 감사 ───────────────────────────────────────────────────────

function walkFiles(absDir) {
  const out = [];
  if (!existsSync(absDir)) return out;
  for (const name of readdirSync(absDir).sort()) {
    const p = join(absDir, name);
    if (statSync(p).isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function verifyCycle(cycleId) {
  const base = `cycles/${cycleId}`;
  console.log(`\n== cycle ${cycleId} ==`);
  if (!existsSync(join(ROOT, base))) { fail(`${base}: not found`); return; }
  validateSchema('cycle_state', `${base}/cycle_state.yaml`);
  let state;
  try { state = loadYaml(`${base}/cycle_state.yaml`); } catch { return; }

  // stage_status 의 task 참조 → Task Envelope 존재 + 검증
  const stageTasks = [];
  for (const [stage, st] of Object.entries((state.cycle && state.cycle.stage_status) || {})) {
    if (st && st.task) stageTasks.push([stage, st.task]);
  }
  for (const [stage, taskId] of stageTasks) {
    const tp = `${base}/tasks/${taskId}.yaml`;
    if (!existsSync(join(ROOT, tp))) { fail(`stage ${stage}: task file missing: ${tp}`); continue; }
    verifyEnvelope(tp);
  }

  // 각 Task 의 required_outputs 가 write_scope 아래 실재하는지
  const taskDir = join(ROOT, base, 'tasks');
  for (const tf of walkFiles(taskDir)) {
    let doc;
    try { doc = parseYaml(readFileSync(tf, 'utf8')); } catch { continue; }
    const task = doc && doc.task;
    if (!task) continue;
    const scopeFiles = [];
    for (const scope of task.write_scope || []) {
      if (String(scope).includes('*')) continue;
      const abs = join(ROOT, scope);
      if (existsSync(abs)) {
        if (statSync(abs).isDirectory()) scopeFiles.push(...walkFiles(abs).map((p) => relative(abs, p)));
        else scopeFiles.push(scope.split('/').pop());
      }
    }
    for (const out of task.required_outputs || []) {
      if (scopeFiles.some((f) => f === out || f.endsWith(`/${out}`))) {
        ok(`${task.id}: output present: ${out}`);
      } else {
        fail(`${task.id}: required output missing in write_scope: ${out}`);
      }
    }
  }

  // Session Index
  const idxPath = `${base}/logs/session-index.yaml`;
  const sessionByTask = new Map();
  if (!existsSync(join(ROOT, idxPath))) {
    fail(`${idxPath}: not found`);
  } else {
    let idx;
    try { idx = loadYaml(idxPath); } catch (e) { fail(`${idxPath}: ${e.message}`); idx = null; }
    for (const s of (idx && idx.sessions) || []) {
      if (!s || !s.id || !s.task || !s.skill || !s.result) {
        fail(`${idxPath}: session entry missing id/task/skill/result`);
        continue;
      }
      sessionByTask.set(s.task, s.id);
      const tp = `${base}/tasks/${s.task}.yaml`;
      if (!existsSync(join(ROOT, tp))) fail(`${idxPath}: session ${s.id} references missing task ${s.task}`);
      else ok(`session ${s.id}: ${s.task} (${s.result})`);
    }
  }

  // Verification Result 파일들 (schema + failure_type routing + Generator≠Verifier)
  let routes = {};
  try { routes = (loadYaml('orchestration/routing/failure_routes.yaml') || {}).failure_routes || {}; }
  catch { /* routing 파일 자체는 registry 검사에서 다룸 */ }
  for (const abs of walkFiles(join(ROOT, base))) {
    if (!abs.endsWith('.yaml')) continue;
    let doc;
    try { doc = parseYaml(readFileSync(abs, 'utf8')); } catch { continue; }
    const rel = relative(ROOT, abs);
    if (doc && doc.verification) {
      validateSchema('verification_result', rel);
      const v = doc.verification;
      if (v.failure_type && !(v.failure_type in routes)) {
        fail(`${rel}: failure_type "${v.failure_type}" not in failure_routes.yaml`);
      }
      const genSession = sessionByTask.get(v.task_id);
      if (genSession && v.verified_by === genSession) {
        fail(`${rel}: verified_by ${v.verified_by} == generator session (Generator≠Verifier violation)`);
      } else if (genSession) {
        ok(`${rel}: independent verifier (${v.verified_by} != ${genSession})`);
      }
    }
    if (doc && doc.handoff) validateSchema('handoff_result', rel);
    if (doc && doc.contract_gap) validateSchema('contract_gap', rel);
    if (doc && doc.migration_request) validateSchema('migration_request', rel);
  }

  // Semantic Closure
  if (existsSync(join(ROOT, base, 'artifacts/world-design/intent_trace.yaml'))) {
    verifyClosure(cycleId);
  }
}

// ── main ──────────────────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'schema': {
    const [name, ...files] = args;
    for (const f of files) validateSchema(name, f);
    break;
  }
  case 'envelope':
    for (const f of args) verifyEnvelope(f);
    break;
  case 'closure':
    verifyClosure(args[0]);
    break;
  case 'frozen':
    verifyFrozen();
    break;
  case 'registry':
    verifyRegistry();
    break;
  case 'cycle':
    verifyCycle(args[0]);
    break;
  case 'all': {
    console.log('== registry ==');
    verifyRegistry();
    console.log('\n== frozen ==');
    verifyFrozen();
    const cyclesDir = join(ROOT, 'cycles');
    if (existsSync(cyclesDir)) {
      for (const name of readdirSync(cyclesDir).sort()) {
        if (/^C[0-9]{3}$/.test(name)) verifyCycle(name);
      }
    }
    break;
  }
  case 'hash': {
    // 유틸: Freeze 시 registry 에 기록할 해시 계산
    for (const f of args) console.log(`${hashPath(join(ROOT, f))}  ${f}`);
    process.exit(0);
    break;
  }
  default:
    console.log('usage: verify.mjs schema|envelope|closure|frozen|registry|cycle|all|hash ...');
    process.exit(2);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures > 0 ? 1 : 0);
