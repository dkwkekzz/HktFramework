// =====================================================================
// 규칙 기반 하위 목적 계산 v0 — 플래너 (step E3)
// ---------------------------------------------------------------------
// 상위 목적 + 세계 상태 → 하위 목적 후보를 규칙(분해 템플릿)으로 계산한다 (§5 원칙 2).
// 계산된 후보는 반드시 E2 관문 통과 후에만 편입되고, epistemic:추정 으로 시작한다
// (플래너의 출력도 믿음이다 — 세계가 다르면 분해가 다름을 그대로 수용).
//
// ── LLM 접합면 (미래 E3+ 에서 규칙 대신 LLM) ─────────────────────────
//   입력 : 목적 노드(desired/current/obstacles) + 세계 요약(장애물 유형·가용 요소)
//   출력 : 가지 YAML (GoalNode 골격 — title/verb/done_when/demand)
//   관문 : E2 constraints.checkBranch (a)(b)(c) — 불통과 후보는 편입 거부
//   반려 : constraints.rejectionReport 포맷으로 반려 사유 반환 → 재생성 루프
// 규칙(이 파일)이든 LLM 이든 접합면은 동일하다: 세계 상태 → 후보 → E2 관문.
// (Design-StepPlan §7 E3)
// =====================================================================
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../paths.js';
import { checkBranch, rejectionReport } from './constraints.js';

let _templates = null;
export function loadTemplates(file = dataPath('decompose-templates.yaml')) {
  if (!_templates) _templates = yaml.load(readFileSync(file, 'utf8')).templates ?? [];
  return _templates;
}

// 세계에서 장애물 유형 목록을 읽는다 (world.신.장애물). ctx.obstacles 로 덮어쓸 수 있다.
function worldObstacles(ctx) {
  if (Array.isArray(ctx.obstacles)) return ctx.obstacles;
  return ctx.state?.world?.신?.장애물 ?? [];
}

// 상위 목적 + 세계 → 하위 목적 후보 계산 → E2 관문 → 편입/반려.
// → { admitted:[GoalNode...], rejected:[{node, reasons}] }
export function decompose(parentNode, world, ctx = {}) {
  const templates = ctx.templates ?? loadTemplates();
  const obstacles = worldObstacles(ctx);
  const admitted = [];
  const rejected = [];

  for (const obs of obstacles) {
    const tpl = templates.find((t) => t.obstacle === obs);
    if (!tpl) continue; // 알 수 없는 장애물 유형은 건너뛴다 (템플릿 확장점)
    const candidate = {
      id: `${parentNode.id}.gen.${obs}`,
      title: tpl.subgoal.title,
      desired: tpl.subgoal.title,
      current: '플래너가 세계 상태에서 계산한 후보',
      done_when: tpl.subgoal.done_when,
      demand: tpl.subgoal.demand ?? [],
      verb: tpl.subgoal.verb,
      serves: [parentNode.id],
      epistemic: '추정', // 플래너의 출력도 믿음이다
      generatedBy: 'decompose/v0',
      obstacle: obs,
    };
    const gate = checkBranch(candidate, world, ctx);
    if (gate.ok) admitted.push(candidate);
    else rejected.push(rejectionReport(candidate, gate));
  }

  return { admitted, rejected };
}
