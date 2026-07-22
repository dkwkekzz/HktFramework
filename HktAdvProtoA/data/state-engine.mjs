// 세계 상태 엔진 — world-state.json 의 다섯 층을 읽어 결정론적 틱 루프를 돈다.
// validate-state.mjs 와 simulate-state.mjs, objective-tree.html 이 공유한다. 규칙·데이터는 담지 않는다.
// 순수 모듈(node:fs 비의존) — 파일 로딩은 load-world.mjs 로 분리(브라우저 import 가능).
// 틱 순서(§5.3): ① 시계 → ② 파생 → ③ 전제 일괄 평가(스냅샷) → ④ 효과 일괄 적용
//                → ⑤ 파생 → ⑥ 목적 판정 → ⑦ NPC/입력 행동

export function indexVars(state) {
  const m = new Map();
  for (const v of state.vars || []) m.set(v.id, v);
  return m;
}

// {actor}·{target} 치환 — 쌍축 전제·비용·효과를 주체·대상 무관하게 한 번만 정의(§6.1).
// {target} 은 행동 발화 요청의 대상 파라미터(Design-MMO §3.3 이동 행동) — {actor} 와 같은 메커니즘.
export function subst(name, actor, target) {
  let s = String(name);
  if (actor) s = s.replace("{actor}", actor);
  if (target) s = s.replace("{target}", target);
  return s;
}

// 멀티 캐릭터 조인 (Design-MMO §3.1) — player 스코프 변수의 캐릭터 인스턴스를 스냅샷에 생성.
// 캐릭터 id 는 "E_플레이어#이름" — 그래프 노드는 E_플레이어 하나(불변 5), 인스턴스화는 상태층의 일.
// actor 로 그대로 쓰이므로 {actor} 치환이 캐릭터별 쌍축 키를 만든다. 틱 의미론 무변경.
export function joinChar(snap, state, charId) {
  for (const v of state.vars || []) if (v.scope === "player") {
    const key = v.id.replace("E_플레이어", charId);
    if (!(key in snap)) snap[key] = v.init;
  }
  return charId;
}

// 초기 스냅샷 — vars 의 init 산출물 + once 발화 기록 내장 상태(§5.3)
export function buildInitial(state) {
  const snap = {};
  for (const v of state.vars || []) if (!v.derived) snap[v.id] = v.init;
  for (const r of state.rules || []) if (r.once) snap[r.id + ".발화됨"] = false;
  for (const a of state.actions || []) if (a.once) snap[a.id + ".발화됨"] = false;
  return snap;
}

function cmp(a, op, b) {
  switch (op) {
    case "==": return a === b;
    case "!=": return a !== b;
    case ">=": return a >= b;
    case "<=": return a <= b;
    case ">": return a > b;
    case "<": return a < b;
    default: throw new Error("알 수 없는 op: " + op);
  }
}

// 술어 평가 — all/any/not 조합 + 잎 {var, op, value}. value 에 {var:...} 허용(변수 간 비교)
export function evalPred(pred, snap, actor, target) {
  if (!pred) return true;
  if (pred.all) return pred.all.every((p) => evalPred(p, snap, actor, target));
  if (pred.any) return pred.any.some((p) => evalPred(p, snap, actor, target));
  if (pred.not) return !evalPred(pred.not, snap, actor, target);
  const name = subst(pred.var, actor, target);
  const lhs = snap[name];
  let rhs = pred.value;
  if (rhs && typeof rhs === "object" && rhs.var) rhs = snap[subst(rhs.var, actor, target)];
  else if (typeof rhs === "string") rhs = subst(rhs, actor, target);
  return cmp(lhs, op(pred), rhs);
}
function op(p) { return p.op; }

export function recomputeDerived(snap, varIdx) {
  for (const v of varIdx.values()) if (v.derived) snap[v.id] = evalPred(v.formula, snap);
}

function clampValue(v, value) {
  if (!v) return value;
  if (v.kind === "count") return Math.max(0, value);
  if (v.kind === "level") return Math.max(0, Math.min((v.levels?.length ?? 1) - 1, value));
  return value;
}

// 효과 묶음 일괄 적용 + set 충돌 정적/동적 검사(§5.3). errors 에 충돌을 누적한다.
export function applyDelta(snap, varIdx, effects, errors, ctxLabel = "") {
  const byVar = new Map();
  for (const e of effects) {
    const name = e.var;
    if (!byVar.has(name)) byVar.set(name, []);
    byVar.get(name).push(e);
  }
  for (const [name, list] of byVar) {
    const v = varIdx.get(name);
    const sets = list.filter((e) => e.op === "set");
    const adds = list.filter((e) => e.op === "add");
    if (sets.length) {
      const vals = [...new Set(sets.map((e) => JSON.stringify(e.value)))];
      if (vals.length > 1 || adds.length) {
        errors?.push(`효과 충돌(${ctxLabel}): ${name} 에 set 다중/혼재 — ${vals.join(", ")}${adds.length ? " + add" : ""}`);
        snap[name] = sets[0].value; // 결정론 유지를 위해 첫 값 적용(검증기가 이미 거부)
      } else {
        snap[name] = sets[0].value;
      }
    } else if (adds.length) {
      const sum = adds.reduce((s, e) => s + e.value, 0);
      snap[name] = clampValue(v, (snap[name] ?? 0) + sum);
    }
  }
}

// 한 틱 실행. ctx = { t, varIdx, pending:[], clock:{}, inputs:Map(tick->[{actionId,actor}]), errors:[], log:[] }
export function tick(snap, state, ctx) {
  const t = ++ctx.t;
  const varIdx = ctx.varIdx;
  const fired = { clocks: [], rules: [], objectives: [], actions: [], skipped: [] };

  // ① 시계 법칙
  for (const c of state.clocks || []) {
    const active = t % c.period < c.duty;
    const prev = ctx.clock[c.id] ?? false;
    if (active && !prev) { applyDelta(snap, varIdx, c.then_on || [], ctx.errors, c.id); fired.clocks.push(c.id + ":on"); }
    if (!active && prev) { applyDelta(snap, varIdx, c.then_off || [], ctx.errors, c.id); fired.clocks.push(c.id + ":off"); }
    ctx.clock[c.id] = active;
  }

  // ② 파생 재계산
  recomputeDerived(snap, varIdx);

  // ③ 전제 일괄 평가 — 틱 시작 스냅샷 기준(읽기/쓰기 분리)
  //   발화 유형: once(1회) / every N(N틱 간격 재발화) / 지정 없음(전제 만족 시 매 틱)
  const snap0 = { ...snap };
  const ruleEffects = [];
  for (const r of state.rules || []) {
    if (r.once && snap0[r.id + ".발화됨"]) continue;
    if (!evalPred(r.when, snap0)) continue;
    if (r.every) {
      const last = ctx.everyLast[r.id];
      if (last !== undefined && t - last < r.every) continue;
      ctx.everyLast[r.id] = t;
    }
    for (const e of r.then || []) ruleEffects.push(e);
    if (r.once) snap[r.id + ".발화됨"] = true;
    fired.rules.push(r.id);
  }
  // 만기 지연 효과(duration) 수거
  const due = ctx.pending.filter((p) => p.at === t);
  ctx.pending = ctx.pending.filter((p) => p.at !== t);
  for (const p of due) { for (const e of p.effects) ruleEffects.push(e); fired.actions.push(p.label + "→효과"); }

  // ④ 효과 일괄 적용
  applyDelta(snap, varIdx, ruleEffects, ctx.errors, "tick" + t);

  // ⑤ 파생 재계산
  recomputeDerived(snap, varIdx);

  // ⑥ 목적 판정
  for (const o of state.objectives || []) {
    const g = o.goal;
    const pv = g + ".진행";
    let prog = snap[pv] ?? 0;
    if (prog === 0 && evalPred(o.discover, snap)) { prog = 1; fired.objectives.push(o.id + ":발견"); }
    if (prog === 1 && o.activate === "auto") { prog = 2; fired.objectives.push(o.id + ":진행"); }
    if ((prog === 1 || prog === 2) && o.complete && evalPred(o.complete, snap)) {
      prog = 3; snap[pv] = prog;
      applyDelta(snap, varIdx, o.on_complete || [], ctx.errors, o.id + ".on_complete");
      fired.objectives.push(o.id + ":완료");
    } else if ((prog === 1 || prog === 2) && o.fail && evalPred(o.fail, snap)) {
      prog = 4; snap[pv] = prog;
      applyDelta(snap, varIdx, o.on_fail || [], ctx.errors, o.id + ".on_fail");
      fired.objectives.push(o.id + ":실패");
    }
    snap[pv] = prog;
  }
  recomputeDerived(snap, varIdx);

  // ⑦ 행동 선택 — 입력 주체(외부) + 정책 주체(NPC)
  const inputs = ctx.inputs?.get(t) || [];
  for (const inp of inputs) fireAction(inp.actionId, inp.actor, snap, state, ctx, t, fired, true, inp.target);
  for (const s of state.subjects || []) {
    if (s.driver !== "policy") continue;
    if ((ctx.busy[s.node] ?? 0) > t) continue; // 진행 중인 행동(duration)이 주체를 점유
    const goalId = (s.policy || []).find((g) => (snap[g + ".진행"] ?? 0) === 2);
    if (!goalId) continue;
    const acts = (state.actions || []).filter((a) => a.objective === goalId && (a.actor_type || []).includes(s.node));
    for (const a of acts) {
      if (a.once && snap[a.id + ".발화됨"]) continue;
      if (!evalPred(a.when, snap, s.node)) continue;
      if (!affordable(a, snap, s.node)) continue;
      fireAction(a.id, s.node, snap, state, ctx, t, fired);
      break;
    }
  }
  recomputeDerived(snap, varIdx);

  return fired;
}

function affordable(a, snap, actor, target) {
  for (const c of a.cost || []) {
    if (c.op === "add" && c.value < 0) {
      const name = subst(c.var, actor, target);
      if ((snap[name] ?? 0) + c.value < 0) return false;
    }
  }
  return true;
}

// 효과의 var 와 문자열 value 에 {actor}·{target} 치환 (ref 대입: 위치 = {target})
function substEffect(e, actor, target) {
  return { ...e, var: subst(e.var, actor, target), value: typeof e.value === "string" ? subst(e.value, actor, target) : e.value };
}

function fireAction(actionId, actor, snap, state, ctx, t, fired, explicit = false, target) {
  const a = (state.actions || []).find((x) => x.id === actionId);
  if (!a) { ctx.errors.push(`알 수 없는 행동: ${actionId}`); return; }
  if (a.once && snap[a.id + ".발화됨"]) { if (explicit) fired.skipped.push(`${actionId}@${actor}(이미 발화됨)`); return; }
  // {target} 을 쓰는 행동은 target 없이 발화 불가 — 리터럴 대입 방지
  if (!target && JSON.stringify([a.when, a.cost, a.then]).includes("{target}")) {
    if (explicit) fired.skipped.push(`${actionId}@${actor}(target 파라미터 누락)`);
    return;
  }
  if (!evalPred(a.when, snap, actor, target) || !affordable(a, snap, actor, target)) {
    if (explicit) fired.skipped.push(`${actionId}@${actor}(전제·비용 미충족)`);
    return;
  }
  // 비용은 즉시 소모
  applyDelta(snap, ctx.varIdx, (a.cost || []).map((e) => substEffect(e, actor, target)), ctx.errors, a.id + ".cost");
  // 효과는 duration 뒤 적용 (0 이면 즉시 예약해 다음 틱 ④ 에서 처리)
  const eff = (a.then || []).map((e) => substEffect(e, actor, target));
  const at = t + (a.duration ?? 0);
  if (at === t) applyDelta(snap, ctx.varIdx, eff, ctx.errors, a.id + ".then");
  else ctx.pending.push({ at, effects: eff, label: `${a.id}@${actor}` });
  ctx.busy[actor] = at; // 효과가 착지할 때까지 주체는 다른 행동을 시작하지 않는다(§6.1)
  if (a.once) snap[a.id + ".발화됨"] = true;
  fired.actions.push(`${a.id}@${actor}`);
}

export function newCtx(state) {
  return { t: 0, varIdx: indexVars(state), pending: [], clock: {}, busy: {}, everyLast: {}, inputs: new Map(), errors: [], log: [] };
}

// 말단 G 판정 — 그래프에서 자식이 없는 G 노드
export function terminalGoals(graph) {
  const hasChild = new Set();
  for (const n of graph.nodes) if (n.parent) hasChild.add(n.parent);
  const term = new Set();
  for (const n of graph.nodes) if (n.type === "G" && !hasChild.has(n.id)) term.add(n.id);
  return term;
}
