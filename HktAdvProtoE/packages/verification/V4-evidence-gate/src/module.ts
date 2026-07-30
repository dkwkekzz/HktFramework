import { sha256Tagged } from '@hkt/v0-module-contract';
import type { ModuleContext, ModuleDefinition, ModuleContractDocument, VerificationIssue } from '@hkt/v0-module-contract';
import { canonicalJson, enforceSchemas, type JsonSchema } from '@hkt/v1-schema';
import inputSchema from '../schemas/v4-input.schema.json';
import outputSchema from '../schemas/v4-output.schema.json';
import { auditRepository, type AuditReport } from './audit.js';
import { buildBoard, type Board } from './board.js';
import type { EvidenceDocument } from './evidence.js';
import { statusRank } from './status.js';

export interface V4Input {
  contracts: ModuleContractDocument[];
  evidences: EvidenceDocument[];
  /** 저장소 전체 회귀 실행 결과 — 넘어오지 않으면 G7 을 미측정으로 둔다 */
  regressionFailures?: number;
  /** 통과해야 할 수직 슬라이스 목록 (원문 「20」) */
  requiredSlices?: string[];
}

export interface V4Output {
  audit: AuditReport;
  board: Board;
  digest: string;
}

export const V4_VERSION = '0.1.0';

export const V4_PURPOSE =
  '게이트 판정 결과로만 검증 상태를 발급하고, 의존 모듈의 계약이 바뀌면 그것을 쓰는 모듈의 검증을 자동으로 무효화한다.';

export const V4_INPUT_SCHEMA = inputSchema as JsonSchema;
export const V4_OUTPUT_SCHEMA = outputSchema as JsonSchema;

/** 계약과 증거를 받아 감사하고, 원문 「8」의 V 단계 완료 화면을 만든다. */
export function executeV4(input: V4Input): V4Output {
  const audit = auditRepository({ contracts: input.contracts, evidences: input.evidences });
  const board = buildBoard({
    audit,
    ...(input.regressionFailures === undefined ? {} : { regressionFailures: input.regressionFailures }),
    ...(input.requiredSlices === undefined ? {} : { requiredSlices: input.requiredSlices }),
  });
  return { audit, board, digest: sha256Tagged(canonicalJson({ audit: audit.hash, board: board.hash })) };
}

/**
 * 출력만 보고 판정할 수 있는 불변조건.
 *
 * V4 의 출력이 스스로 모순되면 이 모듈이 발급하는 모든 상태를 믿을 수 없게 된다.
 * 그래서 "상태가 게이트보다 높지 않은가" · "무효화가 하위 폐포 전체에 퍼졌는가" 를 여기서 다시 본다.
 */
export function checkOutputConsistency(output: V4Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `V4 출력/${path}`, message });
  };

  const byId = new Map(output.audit.modules.map((module) => [module.id, module]));

  for (const module of output.audit.modules) {
    // 무효화된 모듈은 반드시 BLOCKED 다 (원문 「2.5」)
    if (module.invalidated && module.effectiveStatus !== 'BLOCKED') {
      at(
        `audit/modules/${module.id}`,
        'E_INVARIANT_invalidated_must_be_blocked',
        `무효화되었는데 상태가 ${module.effectiveStatus} 다.`,
      );
    }

    // 무효화는 하위 폐포 전체에 퍼져야 한다
    if (module.invalidated) {
      for (const dependent of module.dependents) {
        if (byId.get(dependent)?.invalidated !== true) {
          at(
            `audit/modules/${dependent}`,
            'E_INVARIANT_invalidation_must_propagate',
            `선행 ${module.id} 이 무효화되었는데 ${dependent} 는 그대로다.`,
          );
        }
      }
    }

    // VERIFIED 는 통합 슬라이스가 모두 통과했을 때만 (원문 「23」)
    if (statusRank(module.effectiveStatus) >= statusRank('VERIFIED')) {
      const slices = Object.entries(module.integrationSlices);
      if (slices.length === 0 || slices.some(([, verdict]) => verdict !== 'passed')) {
        at(
          `audit/modules/${module.id}/effectiveStatus`,
          'E_INVARIANT_verified_requires_slices',
          `${module.effectiveStatus} 인데 통합 슬라이스가 ${slices.length === 0 ? '없다' : '전부 통과하지 않았다'}.`,
        );
      }
    }

    // 상태는 게이트에서만 나온다 — 게이트가 막고 있는데 사다리를 올라갈 수 없다
    const failing = module.gates.filter((gate) => !gate.passed).map((gate) => gate.id);
    if (failing.includes('G4') && statusRank(module.effectiveStatus) > statusRank('UNIT_PASS')) {
      at(
        `audit/modules/${module.id}/effectiveStatus`,
        'E_INVARIANT_status_must_follow_gates',
        `G4 가 막혀 있는데 상태가 ${module.effectiveStatus} 다.`,
      );
    }
  }

  // 화면은 감사 결과를 그대로 옮겨야 한다 — 화면에서 판정이 달라지면 안 된다
  if (output.board.statuses.length !== output.audit.modules.length) {
    at(
      'board/statuses',
      'E_INVARIANT_board_must_mirror_audit',
      `감사 ${output.audit.modules.length}개 · 화면 ${output.board.statuses.length}개`,
    );
  }
  for (const row of output.board.statuses) {
    const module = byId.get(row.moduleId);
    if (module && module.effectiveStatus !== row.effectiveStatus) {
      at(
        `board/statuses/${row.moduleId}`,
        'E_INVARIANT_board_must_mirror_audit',
        `감사 ${module.effectiveStatus} · 화면 ${row.effectiveStatus}`,
      );
    }
  }

  // 측정하지 않은 지표를 통과로 적지 않았는가
  if (output.board.completion.complete && output.board.completion.pending.length > 0) {
    at(
      'board/completion/complete',
      'E_INVARIANT_completion_must_not_ignore_pending',
      `미측정 지표가 ${output.board.completion.pending.length}개 남았는데 완성으로 판정했다.`,
    );
  }

  return issues;
}

export function createV4Module(
  scenarios: ModuleDefinition<V4Input, V4Output>['scenarios'],
): ModuleDefinition<V4Input, V4Output> {
  return enforceSchemas<V4Input, V4Output>(
    {
      id: 'V4',
      version: V4_VERSION,
      purpose: V4_PURPOSE,
      dependencies: ['V0', 'V1', 'V2', 'V3'],
      validateInput: (input: unknown) => input as V4Input,
      execute: (input: V4Input, _context: ModuleContext) => executeV4(input),
      validateOutput: () => [],
      scenarios,
    },
    {
      inputSchema: V4_INPUT_SCHEMA,
      outputSchema: V4_OUTPUT_SCHEMA,
      extraOutputChecks: checkOutputConsistency,
    },
  );
}
