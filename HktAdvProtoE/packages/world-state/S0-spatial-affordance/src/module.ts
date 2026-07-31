import { sha256Tagged } from '@hkt/v0-module-contract';
import type { ModuleContext, ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import {
  ComponentRegistry,
  EntityStore,
  applyOperations,
  type ComponentDefinition,
  type EntityId,
  type StoreOperation,
} from '@hkt/k0-entity-state';
import { QueryRejection } from '@hkt/k1-predicate-query';
import { RuleBook, TransactionRejected, runTransaction } from '@hkt/k2-rule-transaction';
import type { Intent, RuleSpec, TransactionOutcome } from '@hkt/k2-rule-transaction';
import { resolveAffordances } from './affordance.js';
import { SpatialRejection } from './errors.js';
import { auditPath, findPath } from './movement.js';
import { SpatialIndex } from './spatialIndex.js';
import { boxOf, positionOf, toCell } from './transform.js';
import type {
  Affordance,
  AffordanceOffer,
  PathReport,
  RangeReport,
  SpatialLayout,
} from './types.js';

export interface S0World {
  components?: ComponentDefinition[];
  operations: StoreOperation[];
}

/**
 * 한 걸음.
 *
 * 접근 가능성은 **시점에 따라 달라지는 값**이다 — 문이 닫혀 있을 때와 열린 뒤가 다르다. 그래서 입력을
 * "질문 목록"이 아니라 **차례로 굴리는 걸음 목록**으로 둔다. 세계를 바꾸는 걸음(`act`)은 반드시 K2 의
 * 규칙을 통과한다 — S0 이 직접 세계를 고치면 GI-01(사건 없는 상태 변경 금지)이 깨진다.
 */
export type S0Step =
  | { kind: 'resolve'; id: string; actor: EntityId; verbs?: string[] }
  | { kind: 'act'; id: string; intent: Intent }
  | { kind: 'path'; id: string; from: EntityId; to: EntityId }
  | { kind: 'range'; id: string; center: EntityId; radius: number };

export interface S0Input {
  world: S0World;
  layout: SpatialLayout;
  affordances: Affordance[];
  /** `act` 걸음이 쓰는 규칙집 (K2). 없으면 빈 규칙집이다. */
  rules?: RuleSpec[];
  steps: S0Step[];
}

export interface S0StepReport {
  id: string;
  kind: S0Step['kind'];
  /** 이 걸음 전후의 세계 해시. `resolve`·`path`·`range` 는 두 값이 반드시 같다. */
  hashBefore: string;
  hashAfter: string;
  offers: AffordanceOffer[] | null;
  path: PathReport | null;
  /** 색인으로 좁힌 답 · 전수 조회의 답. 둘은 반드시 같아야 한다. */
  range: RangeReport | null;
  rangeByFullScan: EntityId[] | null;
  outcome: TransactionOutcome | null;
  rejection: { code: string; path: string; message: string } | null;
}

export interface S0Output {
  steps: S0StepReport[];
  worldHashBefore: string;
  worldHashAfter: string;
  /** 격자에 담기지 못한 실체들 — 배치가 세계보다 좁으면 여기 쌓인다. */
  outsideGrid: EntityId[];
  digest: string;
}

export const S0_VERSION = '0.1.0';

export const S0_PURPOSE =
  '위치·거리·충돌·접근 가능성을 렌더링과 독립적으로 계산해, 주체가 지금 어떤 대상에 어떤 행동을 할 수 있는지와 그 이유를 함께 돌려준다.';

export function buildWorld(world: S0World): EntityStore {
  const registry = ComponentRegistry.of(world.components ?? []);
  return applyOperations(EntityStore.empty(registry), world.operations).store;
}

export function executeS0(input: S0Input): S0Output {
  let store = buildWorld(input.world);
  const rules = RuleBook.of(input.rules ?? []);
  const worldHashBefore = store.hash();

  const steps: S0StepReport[] = [];
  for (const step of input.steps) {
    const hashBefore = store.hash();
    const empty: Omit<S0StepReport, 'id' | 'kind' | 'hashBefore' | 'hashAfter'> = {
      offers: null,
      path: null,
      range: null,
      rangeByFullScan: null,
      outcome: null,
      rejection: null,
    };

    try {
      if (step.kind === 'act') {
        const result = runTransaction(store, rules, step.intent);
        store = result.store;
        steps.push({
          id: step.id,
          kind: step.kind,
          hashBefore,
          hashAfter: store.hash(),
          ...empty,
          outcome: result.outcome,
        });
        continue;
      }

      // 색인은 걸음마다 세계에서 다시 짓는다 — 문이 열린 뒤에도 옛 격자를 보면 안 된다.
      const index = SpatialIndex.build(store, input.layout);

      if (step.kind === 'resolve') {
        const offers = resolveAffordances(store, index, step.actor, input.affordances, {
          ...(step.verbs === undefined ? {} : { verbs: step.verbs }),
        });
        steps.push({ id: step.id, kind: step.kind, hashBefore, hashAfter: store.hash(), ...empty, offers });
        continue;
      }

      if (step.kind === 'path') {
        const from = positionOf(store, step.from);
        const to = positionOf(store, step.to);
        if (!from || !to) {
          throw new SpatialRejection(
            'E_NO_POSITION',
            `step/${step.id}`,
            `${!from ? step.from : step.to} 가 공간에 없다`,
          );
        }
        const report = findPath(index, toCell(input.layout, from), {
          goals: [toCell(input.layout, to)],
          allowBlockedStart: true,
        });
        steps.push({ id: step.id, kind: step.kind, hashBefore, hashAfter: store.hash(), ...empty, path: report });
        continue;
      }

      const center = positionOf(store, step.center);
      if (!center) {
        throw new SpatialRejection('E_NO_POSITION', `step/${step.id}`, `${step.center} 가 공간에 없다`);
      }
      steps.push({
        id: step.id,
        kind: step.kind,
        hashBefore,
        hashAfter: store.hash(),
        ...empty,
        range: index.within(store, center, step.radius),
        rangeByFullScan: SpatialIndex.withinByFullScan(store, center, step.radius),
      });
    } catch (error) {
      if (
        !(error instanceof SpatialRejection) &&
        !(error instanceof QueryRejection) &&
        !(error instanceof TransactionRejected)
      ) {
        throw error;
      }
      const { code, path, message } = error instanceof TransactionRejected ? error.toRejection() : error.toIssue();
      steps.push({
        id: step.id,
        kind: step.kind,
        hashBefore,
        hashAfter: store.hash(),
        ...empty,
        rejection: { code, path, message },
      });
    }
  }

  const outsideGrid = [...SpatialIndex.build(store, input.layout).outsideGrid()];
  const body = { steps, outsideGrid };
  return {
    ...body,
    worldHashBefore,
    worldHashAfter: store.hash(),
    digest: sha256Tagged(JSON.stringify(body)),
  };
}

export function createS0Module(
  scenarios: ModuleDefinition<S0Input, S0Output>['scenarios'],
): ModuleDefinition<S0Input, S0Output> {
  return {
    id: 'S0',
    version: S0_VERSION,
    purpose: S0_PURPOSE,
    dependencies: ['V0', 'K0', 'K1', 'K2'],
    validateInput,
    execute: (input: S0Input, _context: ModuleContext) => executeS0(input),
    validateOutput,
    scenarios,
  };
}

export function validateInput(input: unknown): S0Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('S0 입력은 객체여야 한다.');
  }
  const value = input as Record<string, unknown>;
  const world = value['world'];
  if (world === null || typeof world !== 'object' || Array.isArray(world)) {
    throw new TypeError('`world` 는 객체여야 한다.');
  }
  if (!Array.isArray((world as { operations?: unknown }).operations)) {
    throw new TypeError('`world.operations` 는 배열이어야 한다.');
  }
  const layout = value['layout'];
  if (layout === null || typeof layout !== 'object') {
    throw new TypeError('`layout` 은 객체여야 한다 — 격자 없이는 이동 가능성을 계산할 수 없다.');
  }
  if (!Array.isArray(value['affordances'])) throw new TypeError('`affordances` 는 배열이어야 한다.');
  if (!Array.isArray(value['steps'])) throw new TypeError('`steps` 는 배열이어야 한다.');
  for (const [index, step] of (value['steps'] as unknown[]).entries()) {
    if (step === null || typeof step !== 'object') throw new TypeError(`steps[${index}] 는 객체여야 한다.`);
    const record = step as Record<string, unknown>;
    if (typeof record['id'] !== 'string' || record['id'] === '') {
      throw new TypeError(`steps[${index}].id 는 비어 있지 않은 문자열이어야 한다.`);
    }
    if (!['resolve', 'act', 'path', 'range'].includes(String(record['kind']))) {
      throw new TypeError(`steps[${index}].kind 가 resolve·act·path·range 중 하나가 아니다.`);
    }
  }
  return input as S0Input;
}

/**
 * MODULE.yaml 의 invariants 중 **출력만 보고** 판정할 수 있는 것들.
 *
 * 시나리오의 단정과 겹치는 것이 아니라, 어떤 입력이 와도 늘 성립해야 하는 조건이다.
 * 속성 테스트가 무작위 입력으로 이 함수를 두드린다.
 */
export function validateOutput(output: S0Output, layout?: SpatialLayout): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `S0 출력/${path}`, message });
  };

  for (const step of output.steps) {
    if (step.kind !== 'act' && step.hashBefore !== step.hashAfter) {
      at(
        `steps/${step.id}`,
        'E_INVARIANT_affordance_resolution_must_not_change_world_state',
        `${step.kind} 걸음이 세계를 바꿨다: ${step.hashBefore} → ${step.hashAfter}`,
      );
    }

    if (step.range) {
      if (JSON.stringify(step.range.matched) !== JSON.stringify([...step.range.matched].sort())) {
        at(`steps/${step.id}/range`, 'E_INVARIANT_spatial_index_result_must_equal_full_scan', '오름차순이 아니다');
      }
      if (JSON.stringify(step.range.matched) !== JSON.stringify(step.rangeByFullScan)) {
        at(
          `steps/${step.id}/range`,
          'E_INVARIANT_spatial_index_result_must_equal_full_scan',
          `색인 ${JSON.stringify(step.range.matched)} · 전수 ${JSON.stringify(step.rangeByFullScan)}`,
        );
      }
    }

    for (const report of [step.path, ...(step.offers ?? []).map((offer) => offer.path)]) {
      if (!report) continue;
      issues.push(...pathIssues(`steps/${step.id}`, report, layout));
    }

    for (const offer of step.offers ?? []) {
      const where = `steps/${step.id}/offers/${offer.affordanceId}`;
      if (offer.available && offer.refusals.length > 0) {
        at(where, 'E_INVARIANT_refusal_must_name_what_blocks_it', '가능하다면서 거절 이유가 붙어 있다');
      }
      if (!offer.available && offer.refusals.length === 0) {
        at(where, 'E_INVARIANT_refusal_must_name_what_blocks_it', '불가능한데 이유가 없다');
      }
      if (offer.available && offer.path?.found !== true) {
        at(
          where,
          'E_INVARIANT_unreachable_target_must_not_be_offered',
          '닿을 수 없는 대상에 행동이 제시되었다',
        );
      }
      if (Object.keys(offer.cost).length === 0) {
        at(
          where,
          'E_INVARIANT_offered_affordance_must_carry_a_condition_and_a_cost',
          '비용이 하나도 없는 행동이다 (GI-06)',
        );
      }
      for (const refusalEntry of offer.refusals) {
        if (refusalEntry.code === 'E_UNREACHABLE' && refusalEntry.blockedBy.length === 0) {
          at(
            `${where}/refusals`,
            'E_INVARIANT_refusal_must_name_what_blocks_it',
            '닿을 수 없다면서 무엇이 막았는지 이름이 없다',
          );
        }
        if (refusalEntry.code === 'E_CONDITION_UNMET' && refusalEntry.causes.length === 0) {
          at(
            `${where}/refusals`,
            'E_INVARIANT_refusal_must_name_what_blocks_it',
            '조건이 어긋났다면서 어느 조건인지 없다',
          );
        }
      }
    }
  }

  return issues;
}

/** 경로 하나에 대한 판정. 격자를 모르면 "걸음수 × 칸 크기" 관계만 본다. */
function pathIssues(where: string, report: PathReport, layout?: SpatialLayout): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  if (!report.found) {
    if (report.cells.length > 0 || report.cost !== 0) {
      issues.push({
        code: 'E_INVARIANT_path_cost_must_equal_the_sum_of_its_steps',
        path: `S0 출력/${where}/path`,
        message: '길을 못 찾았는데 칸이나 비용이 남아 있다',
      });
    }
    return issues;
  }
  const cellSize = layout?.cellSize;
  if (cellSize !== undefined && Math.abs(report.cost - (report.cells.length - 1) * cellSize) > 1e-9) {
    issues.push({
      code: 'E_INVARIANT_path_cost_must_equal_the_sum_of_its_steps',
      path: `S0 출력/${where}/path`,
      message: `비용 ${report.cost} 가 걸음수 ${report.cells.length - 1} × ${cellSize} 와 다르다`,
    });
  }
  report.cells.forEach((cell, position) => {
    if (position === 0) return;
    const previous = report.cells[position - 1];
    if (!previous) return;
    const gap =
      Math.abs(previous.ix - cell.ix) + Math.abs(previous.iy - cell.iy) + Math.abs(previous.iz - cell.iz);
    if (gap !== 1) {
      issues.push({
        code: 'E_INVARIANT_path_must_not_enter_a_blocked_cell',
        path: `S0 출력/${where}/path/cells/${position}`,
        message: `${previous.ix},${previous.iy},${previous.iz} → ${cell.ix},${cell.iy},${cell.iz} 은 한 걸음이 아니다`,
      });
    }
  });
  return issues;
}

/** 세계와 격자를 함께 놓고 경로가 막힌 칸을 밟지 않았는지 다시 본다 (`auditPath` 를 출력 전체에 건다). */
export function auditOutput(input: S0Input, output: S0Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [...validateOutput(output, input.layout)];
  let store = buildWorld(input.world);
  const rules = RuleBook.of(input.rules ?? []);

  for (const step of output.steps) {
    const index = SpatialIndex.build(store, input.layout);
    const reports = [step.path, ...(step.offers ?? []).map((offer) => offer.path)].filter(
      (report): report is PathReport => report !== null,
    );
    for (const report of reports) {
      for (const problem of auditPath(index, report)) {
        issues.push({
          code: 'E_INVARIANT_path_must_not_enter_a_blocked_cell',
          path: `S0 출력/steps/${step.id}/path`,
          message: problem,
        });
      }
    }
    if (step.kind === 'act' && step.outcome) {
      const original = input.steps.find((entry) => entry.id === step.id);
      if (original && original.kind === 'act') store = runTransaction(store, rules, original.intent).store;
    }
  }
  return issues;
}

/** 실체가 서 있는 칸 — 화면과 테스트가 같은 함수로 읽게 둔다. */
export function cellOf(store: EntityStore, layout: SpatialLayout, id: EntityId): ReturnType<typeof toCell> | null {
  const point = positionOf(store, id);
  return point ? toCell(layout, point) : null;
}

/** 실체가 차지하는 상자를 사람이 읽는 한 줄로. Lab 화면에 그대로 나간다. */
export function describeBox(store: EntityStore, id: EntityId): string {
  const box = boxOf(store, id);
  if (!box) return '공간에 없음';
  const fixed = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  return `(${fixed(box.min.x)}…${fixed(box.max.x)}, ${fixed(box.min.y)}…${fixed(box.max.y)})`;
}
