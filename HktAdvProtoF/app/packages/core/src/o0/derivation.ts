// O0-d 도출 대조 — 같은 공리에서 서로 다른 여러 정의가 나오는가.
//
// 원문 O0 의 검증 조항 ②가 그대로 여기 있다: "같은 공리로부터 여러 종류의 능력과 종이
// 도출되는가?" 이 조항이 있는 이유는 분명하다. 공리 하나가 정의 하나만 낳는다면 그것은
// 공리가 아니라 그 정의를 다른 말로 적은 것이다 — 세계를 넓히지 못한다.
//
// 도출은 정의가 든 근거(`Rule.axiomId` 와 `supportIds`)의 반대 방향이다. 정의는 공리를
// 가리키고, 여기서는 공리가 자기에게서 나온 정의들을 되짚는다.
//
// **막힌 정의는 도출로 세지 않는다.** 공리를 어긴 정의를 "이 공리에서 나왔다" 고 세면
// 어긴 것이 곧 공리의 성과가 되어 버린다. 그래서 여기서도 관문(O0-b)을 먼저 지난다.

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { AXIOM_SET, type Axiom, type AxiomClause, type DefinitionKind } from './axiom.ts';
import { validateDefinition, type Definition } from './definition.ts';

/** 같은 공리에서 서로 다른 정의가 최소 몇 개 나와야 하는가 — "여러 종류" 의 하한. */
export const MIN_DERIVATIONS = 2;

/** 공리 하나가 낳은 정의 하나. */
export interface Derivation {
  readonly clause: AxiomClause;
  readonly axiomId: Id;
  readonly definitionId: Id;
  readonly definitionName: string;
  readonly definitionKind: DefinitionKind;
  /** 대표 근거로 들었는가, 함께 따르는 근거로 들었는가 */
  readonly role: 'primary' | 'support';
}

/** 공리 하나의 도출 현황. */
export interface ClauseDerivation {
  readonly clause: AxiomClause;
  readonly derived: readonly Derivation[];
  readonly abilities: number;
  readonly species: number;
  /** 도출을 요구하는 공리인가 — 정의 층위에 걸리는 공리만 요구한다 */
  readonly required: boolean;
  /** 서로 다른 정의가 하한 이상인가 */
  readonly diverse: boolean;
}

/** 공리 집합이 실제로 세계를 넓히고 있는가. */
export interface DerivationReport {
  readonly derivations: readonly Derivation[];
  readonly byClause: readonly ClauseDerivation[];
  /** 아무 정의도 낳지 못한 공리 (요구 대상 중) */
  readonly barren: readonly AxiomClause[];
  /** 정의 하나만 낳은 공리 — 그 공리는 아직 "여러 종류" 를 보이지 못했다 */
  readonly monotone: readonly AxiomClause[];
  /** 도출된 정의의 종류 (능력·종) */
  readonly kindsCovered: readonly DefinitionKind[];
  /** 공리를 어겨 도출로 세지 못한 정의 */
  readonly rejected: readonly string[];
  /** 도출로 선 정의 수 */
  readonly accepted: number;
  readonly complete: boolean;
}

/** 정의 목록에서 공리별 도출을 되짚는다. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function derivationReport(
  definitions: readonly Definition[],
  axioms: readonly Axiom[] = AXIOM_SET,
  schema: StateSchema = STATE_SCHEMA,
): DerivationReport {
  const derivations: Derivation[] = [];
  const rejected: string[] = [];
  let accepted = 0;

  for (const definition of definitions) {
    if (validateDefinition(definition, axioms, schema).length > 0) {
      rejected.push(definition.name);
      continue;
    }
    accepted += 1;

    const cited: { readonly id: Id; readonly role: Derivation['role'] }[] = [
      ...(definition.axiomId === null
        ? []
        : [{ id: definition.axiomId, role: 'primary' as const }]),
      ...definition.supportIds.map((id) => ({ id, role: 'support' as const })),
    ];
    for (const citation of cited) {
      const axiom = axioms.find((entry) => entry.id === citation.id);
      if (axiom === undefined) continue; // 없는 공리는 O0-b 가 이미 막는다
      derivations.push({
        clause: axiom.clause,
        axiomId: axiom.id,
        definitionId: definition.id,
        definitionName: definition.name,
        definitionKind: definition.definitionKind,
        role: citation.role,
      });
    }
  }

  const byClause: ClauseDerivation[] = axioms.map((axiom) => {
    const derived = derivations.filter((entry) => entry.clause === axiom.clause);
    const distinct = new Set(derived.map((entry) => entry.definitionId));
    return {
      clause: axiom.clause,
      derived,
      abilities: derived.filter((entry) => entry.definitionKind === 'ability').length,
      species: derived.filter((entry) => entry.definitionKind === 'species').length,
      required: axiom.appliesTo.length > 0,
      diverse: distinct.size >= MIN_DERIVATIONS,
    };
  });

  const required = byClause.filter((entry) => entry.required);
  const barren = required.filter((entry) => entry.derived.length === 0).map((entry) => entry.clause);
  const monotone = required
    .filter((entry) => entry.derived.length > 0 && !entry.diverse)
    .map((entry) => entry.clause);
  const kindsCovered = stableSort(
    [...new Set(derivations.map((entry) => entry.definitionKind))],
    compareStrings,
  );

  return {
    derivations,
    byClause,
    barren,
    monotone,
    kindsCovered,
    rejected,
    accepted,
    complete:
      accepted > 0 &&
      required.length > 0 &&
      barren.length === 0 &&
      monotone.length === 0 &&
      rejected.length === 0 &&
      kindsCovered.length === 2,
  };
}

/** 도출 판정을 한 줄로 접는다 — 터미널·배지용. */
export function derivationVerdict(report: DerivationReport): string {
  if (report.complete) {
    const required = report.byClause.filter((entry) => entry.required);
    return `정의 ${String(report.accepted)}개가 공리 ${String(required.length)}개에서 도출됐다 — 어느 공리도 정의 하나로 그치지 않는다`;
  }
  const reasons: string[] = [];
  if (report.accepted === 0) reasons.push('도출된 정의가 없다');
  if (report.byClause.every((entry) => !entry.required)) reasons.push('도출을 요구하는 공리가 없다');
  if (report.barren.length > 0) reasons.push(`아무것도 낳지 못한 공리 ${report.barren.join(', ')}`);
  if (report.monotone.length > 0) {
    reasons.push(
      `정의 하나로 그친 공리 ${report.monotone.join(', ')} — 공리가 아니라 그 정의를 다른 말로 적은 것이다`,
    );
  }
  if (report.rejected.length > 0) {
    reasons.push(`공리를 어겨 도출로 세지 못한 정의 ${report.rejected.join(', ')}`);
  }
  if (report.kindsCovered.length < 2) {
    reasons.push(`도출된 정의의 종류가 ${report.kindsCovered.join(', ') || '없다'} 뿐이다`);
  }
  return reasons.join(' · ');
}

/** 한 공리의 도출 현황을 찾는다 (화면 표용). */
export function derivationOf(
  report: DerivationReport,
  clause: AxiomClause,
): ClauseDerivation | null {
  return report.byClause.find((entry) => entry.clause === clause) ?? null;
}
