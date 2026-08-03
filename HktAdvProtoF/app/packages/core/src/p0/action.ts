// P0-c 행동 요청 문법 — O1 이 열어 둔 자리를 닫고, 원자가 허락하지 않은 요청을 막는다.
//
// O1 은 `Affordance.action` 을 문자열로 두고 주석 하나를 남겼다: "행동 원자 16종의 이름
// (P0 이 집합을 확정한다)". P0-a 가 그 집합을 확정했으므로 여기서 자리를 닫는다 — 16종 밖의
// 이름을 쓴 어포던스는 이제 거부된다.
//
// 그리고 한 걸음 더 간다. MasterPlan §19 는 행동이 상태를 직접 고치지 않고 `WorldChangeRequest`
// 를 제출하게 하고, 규칙 엔진이 여덟 가지를 묻게 한다(능력을 가졌는가·대상을 지정할 수 있는가·
// 비용을 치렀는가·조건이 맞는가·충돌하는가·불변 규칙을 어기는가·지역 규칙이 변형하는가·
// 대상이 저항하는가). 그 여덟 중 **원자만으로 답할 수 있는 넷**을 P0 가 미리 막는다:
//
//   대상을 지정할 수 있는가  → 상대가 끼는 원자인데 대상이 없으면 거부 (`targetless-action`)
//   비용을 치렀는가          → 그 원자가 치르는 자리를 안 적었으면 거부 (`unpaid-action`)
//   조건이 맞는가            → 그 원자가 열지 않은 자리를 바꾸려 하면 거부 (`off-atom-change`)
//   불변 규칙을 어기는가     → 보지 못한 대상을 정밀 조작하면 거부 (`unobserved-action`)
//
// 나머지 넷(능력 보유·충돌·지역 규칙·저항)은 세계의 지금을 봐야 답할 수 있으므로 R2 규칙 엔진과
// R3·D5 의 몫이다. P0 는 **세계를 보지 않고도 알 수 있는 거절**만 여기서 끝낸다 — 그래야
// P3 가 가능성을 펼칠 때 애초에 설 수 없는 후보를 만들지 않는다.

import type { Id } from '../v1/id.ts';
import type { Affordance } from '../o1/relation.ts';
import { matchPath } from '../o2/field.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { atomLabel, isActionAtom, type ActionAtom } from './atom.ts';
import {
  atomGrounding,
  slotText,
  type AtomGrounding,
  type SlotRef,
} from './grounding.ts';
import { violateAtom, type ActionAtomViolation } from './violation.ts';

/** 요청이 바꾸려는 실제 자리 하나 — 패턴이 아니라 누구의 어느 자리인지까지 적는다. */
export interface ChangeRef {
  readonly domain: SlotRef['domain'];
  /** 누구의 자리인가 */
  readonly holderId: Id;
  /** 실제 경로 (`stock.ent:ab12…`) */
  readonly path: string;
}

/**
 * 행동 요청 하나 — MasterPlan §19 `WorldChangeRequest` 의 P0 층 뼈대.
 * 상태를 고치지 않는다. "이렇게 바꾸겠다" 는 제안일 뿐이고, 세계에 적히는 것은 R1·R2 의 몫이다.
 */
export interface ActionProposal {
  readonly atom: string;
  readonly actorId: Id;
  /** 누구를·무엇을 겨누는가 */
  readonly targetIds: readonly Id[];
  /** 어느 자리를 바꾸겠다는 것인가 */
  readonly changes: readonly ChangeRef[];
  /** 무엇을 치르겠다는 것인가 */
  readonly payments: readonly ChangeRef[];
  /** 지금 관측하고 있는 것들 (S0 감지 프로필의 결과가 여기로 온다) */
  readonly observedIds: readonly Id[];
}

/** 요청 판정 — 설 수 있는가, 못 서면 왜인가. */
export interface ActionFit {
  readonly fits: boolean;
  /** 어느 원자로 서는가. 16종 밖이면 null */
  readonly atom: ActionAtom | null;
  readonly violations: readonly ActionAtomViolation[];
}

/** 실제 자리가 원자가 연 패턴 중 하나에 드는가. */
function coveredBy(refs: readonly SlotRef[], change: ChangeRef): boolean {
  return refs.some(
    (ref) => ref.domain === change.domain && matchPath(ref.path, change.path) !== null,
  );
}

/** 자리 하나를 문자열로 — 위반 문장과 화면이 같은 문자열을 쓴다. */
export function changeText(change: ChangeRef): string {
  return `${change.domain}.${change.holderId}.${change.path}`;
}

/**
 * 요청 하나가 그 원자로 설 수 있는가.
 * 세계의 지금은 보지 않는다 — 여기서 보는 것은 "이 원자가 이런 요청을 낼 수 있는가" 뿐이다.
 */
export function fitAction(
  proposal: ActionProposal,
  path = '$.proposal',
  schema: StateSchema = STATE_SCHEMA,
): ActionFit {
  const violations: ActionAtomViolation[] = [];

  if (!isActionAtom(proposal.atom)) {
    violateAtom(
      violations,
      proposal.atom,
      'unknown-action',
      `${path}.atom`,
      `16원자 밖의 행동 ${JSON.stringify(proposal.atom)} 이다 — 새 행동처럼 보이는 것은 대개 원자의 조합이다 (P0-a 환원표를 볼 것)`,
    );
    return { fits: false, atom: null, violations };
  }

  const atom = proposal.atom;
  const grounding = atomGrounding(atom);
  if (grounding === null) {
    violateAtom(
      violations,
      atom,
      'ungrounded-atom',
      `${path}.atom`,
      `${atom} 의 걸림이 없어 무엇을 바꿀 수 있는지 알 수 없다`,
    );
    return { fits: false, atom, violations };
  }

  checkChanges(proposal, grounding, path, schema, violations);
  checkPayments(proposal, grounding, path, schema, violations);
  checkTargets(proposal, grounding, path, violations);
  checkObservation(proposal, grounding, path, violations);

  return { fits: violations.length === 0, atom, violations };
}

function checkChanges(
  proposal: ActionProposal,
  grounding: AtomGrounding,
  path: string,
  schema: StateSchema,
  violations: ActionAtomViolation[],
): void {
  if (proposal.changes.length === 0) {
    violateAtom(
      violations,
      grounding.atom,
      'changeless-action',
      `${path}.changes`,
      `아무 자리도 바꾸지 않겠다는 요청이다 — 세계가 그대로면 아무 일도 일어나지 않는다`,
    );
    return;
  }
  for (const [index, change] of proposal.changes.entries()) {
    const at = `${path}.changes[${String(index)}]`;
    if (lookupField(schema, change.domain, change.path) === null) {
      violateAtom(
        violations,
        grounding.atom,
        'phantom-slot',
        at,
        `세계에 없는 자리 ${changeText(change)} 를 바꾸겠다고 한다`,
      );
      continue;
    }
    if (!coveredBy(grounding.writes, change)) {
      violateAtom(
        violations,
        grounding.atom,
        'off-atom-change',
        at,
        `${atomLabel(grounding.atom)} 로는 ${change.domain}.${change.path} 를 바꿀 수 없다 — 이 원자가 여는 자리는 ${grounding.writes.map(slotText).join(', ')} 뿐이다`,
      );
    }
  }
}

function checkPayments(
  proposal: ActionProposal,
  grounding: AtomGrounding,
  path: string,
  schema: StateSchema,
  violations: ActionAtomViolation[],
): void {
  if (proposal.payments.length === 0) {
    violateAtom(
      violations,
      grounding.atom,
      'unpaid-action',
      `${path}.payments`,
      `${atomLabel(grounding.atom)} 를 공짜로 하겠다는 요청이다 — 치를 자리는 ${grounding.pays.map(slotText).join(', ')} 다 (O0 verifiable-cost)`,
    );
    return;
  }
  for (const [index, payment] of proposal.payments.entries()) {
    const at = `${path}.payments[${String(index)}]`;
    if (lookupField(schema, payment.domain, payment.path) === null) {
      violateAtom(
        violations,
        grounding.atom,
        'phantom-slot',
        at,
        `세계에 없는 자리 ${changeText(payment)} 를 치르겠다고 한다 — 확인할 수 없는 대가는 대가가 아니다`,
      );
      continue;
    }
    if (!coveredBy(grounding.pays, payment)) {
      violateAtom(
        violations,
        grounding.atom,
        'off-atom-payment',
        at,
        `${atomLabel(grounding.atom)} 는 ${payment.domain}.${payment.path} 를 치르지 않는다 — 엉뚱한 자리를 내밀어 대가를 치른 척할 수 없다`,
      );
    }
  }
}

function checkTargets(
  proposal: ActionProposal,
  grounding: AtomGrounding,
  path: string,
  violations: ActionAtomViolation[],
): void {
  if (grounding.touches === 'between' && proposal.targetIds.length === 0) {
    violateAtom(
      violations,
      grounding.atom,
      'targetless-action',
      `${path}.targetIds`,
      `${atomLabel(grounding.atom)} 는 상대가 있어야 성립하는데 겨눈 대상이 없다`,
    );
  }
  if (grounding.touches === 'self') {
    const others = proposal.targetIds.filter((id) => id !== proposal.actorId);
    if (others.length > 0) {
      violateAtom(
        violations,
        grounding.atom,
        'self-atom-on-other',
        `${path}.targetIds`,
        `${atomLabel(grounding.atom)} 는 자기를 바꾸는 원자인데 ${String(others[0])} 를 겨눴다 — 남을 대신 적응시킬 수는 없다`,
      );
    }
    const foreign = proposal.changes.filter((change) => change.holderId !== proposal.actorId);
    if (foreign.length > 0) {
      violateAtom(
        violations,
        grounding.atom,
        'self-atom-on-other',
        `${path}.changes`,
        `${atomLabel(grounding.atom)} 가 남의 자리 ${changeText(foreign[0] as ChangeRef)} 를 바꾸려 한다`,
      );
    }
  }
}

function checkObservation(
  proposal: ActionProposal,
  grounding: AtomGrounding,
  path: string,
  violations: ActionAtomViolation[],
): void {
  if (!grounding.requiresObservation) return;
  const observed = new Set([...proposal.observedIds, proposal.actorId]);

  for (const [index, id] of proposal.targetIds.entries()) {
    if (observed.has(id)) continue;
    violateAtom(
      violations,
      grounding.atom,
      'unobserved-action',
      `${path}.targetIds[${String(index)}]`,
      `보지 못한 ${id} 를 겨눈다 — 관측하지 못한 상태는 정밀하게 조작할 수 없다 (O0 observed-manipulation). 먼저 찾아야 한다`,
    );
  }
  for (const [index, change] of proposal.changes.entries()) {
    if (observed.has(change.holderId)) continue;
    violateAtom(
      violations,
      grounding.atom,
      'unobserved-action',
      `${path}.changes[${String(index)}]`,
      `보지 못한 ${change.holderId} 의 자리를 바꾸려 한다 — 먼저 찾아야 한다 (O0 observed-manipulation)`,
    );
  }
}

/**
 * 어포던스의 `action` 이 16원자 안에 있는가 — O1 이 P0 에 넘긴 검사.
 * O1 은 이미 "얻는 것이 있는가·비용이 0 이 아닌가" 를 봤으므로 여기서는 이름만 본다.
 */
export function checkAtomAffordance(
  affordance: Pick<Affordance, 'action' | 'id'>,
  path = '$.affordance',
): readonly ActionAtomViolation[] {
  const violations: ActionAtomViolation[] = [];
  if (!isActionAtom(affordance.action)) {
    violateAtom(
      violations,
      affordance.action,
      'unknown-action',
      `${path}.action`,
      `어포던스가 16원자 밖의 행동 ${JSON.stringify(affordance.action)} 을 연다 — 무엇이 가능한지는 원자로만 적을 수 있다`,
    );
  }
  return violations;
}

/** 어포던스가 여는 원자. 16종 밖이면 null. */
export function affordanceAtom(affordance: Pick<Affordance, 'action'>): ActionAtom | null {
  return isActionAtom(affordance.action) ? affordance.action : null;
}

/** 요청 판정을 한 줄로 접는다 — 터미널·배지용. */
export function actionFitVerdict(fit: ActionFit): string {
  if (fit.fits) return `${atomLabel(fit.atom as ActionAtom)} 로 설 수 있는 요청이다`;
  const first = fit.violations[0];
  return first === undefined ? '설 수 없다' : `${first.rule} — ${first.message}`;
}
