import type { ModuleContext, ModuleDefinition, VerificationIssue } from './contract.js';
import { buildRegistry, canonicalize, topologicalOrder } from './registry.js';
import { sha256Tagged } from './sha256.js';
import type { ModuleContractDocument, RegistrationReport } from './types.js';

export interface V0Input {
  documents: ModuleContractDocument[];
}

export type V0Output = RegistrationReport;

export const V0_VERSION = '0.1.0';

export const V0_PURPOSE =
  '모든 모듈의 계약 문서를 읽어 모듈 레지스트리에 등록하고, 목적·선행 모듈 선언이 없거나 어긋난 계약은 등록을 거부한다.';

/** 원문 「3.2」의 ModuleDefinition 구현. scenarios 는 순환 참조를 피하려고 별도로 주입한다. */
export function createV0Module(
  scenarios: ModuleDefinition<V0Input, V0Output>['scenarios'],
): ModuleDefinition<V0Input, V0Output> {
  return {
    id: 'V0',
    version: V0_VERSION,
    purpose: V0_PURPOSE,
    dependencies: [],
    validateInput,
    execute: (input: V0Input, _context: ModuleContext) => buildRegistry(input.documents),
    validateOutput,
    scenarios,
  };
}

export function validateInput(input: unknown): V0Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('V0 입력은 { documents } 객체여야 한다.');
  }
  const documents = (input as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) {
    throw new TypeError('V0 입력의 `documents` 는 배열이어야 한다.');
  }
  for (const [index, doc] of documents.entries()) {
    if (doc === null || typeof doc !== 'object') {
      throw new TypeError(`documents[${index}] 는 객체여야 한다.`);
    }
    const { path, text } = doc as { path?: unknown; text?: unknown };
    if (typeof path !== 'string' || path.trim() === '') {
      throw new TypeError(`documents[${index}].path 는 비어 있지 않은 문자열이어야 한다.`);
    }
    if (typeof text !== 'string') {
      throw new TypeError(`documents[${index}].text 는 문자열이어야 한다.`);
    }
  }
  return { documents: documents as ModuleContractDocument[] };
}

/**
 * 출력이 V0 의 불변조건을 지키는지 확인한다. MODULE.yaml 의 invariants 목록과 1:1 대응한다.
 * (registration_must_be_order_independent 는 단일 출력만으로 판정할 수 없어 시나리오·속성 테스트가 담당한다.)
 */
export function validateOutput(output: V0Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const { registry } = output;
  const ids = new Set(registry.modules.map((m) => m.id));

  for (const module of registry.modules) {
    if (module.purpose.trim() === '') {
      issues.push({
        code: 'E_INVARIANT_module_purpose_must_exist',
        path: `${module.sourcePath}#/purpose`,
        message: `등록된 모듈 \`${module.id}\` 의 목적이 비어 있다.`,
      });
    }
    for (const dep of module.dependsOn) {
      if (!ids.has(dep)) {
        issues.push({
          code: 'E_INVARIANT_dependency_must_reference_registered_module',
          path: `${module.sourcePath}#/depends_on`,
          message: `등록된 모듈 \`${module.id}\` 가 미등록 선행 \`${dep}\` 을 참조한다.`,
        });
      }
    }
  }

  if (ids.size !== registry.modules.length) {
    issues.push({
      code: 'E_INVARIANT_module_id_must_be_unique',
      path: 'registry#/modules',
      message: '레지스트리에 중복 id 가 있다.',
    });
  }

  const { order, leftover } = topologicalOrder(new Map(registry.modules.map((m) => [m.id, m])));
  if (leftover.length > 0) {
    issues.push({
      code: 'E_INVARIANT_dependency_graph_must_be_acyclic',
      path: 'registry#/order',
      message: `순환이 남아 있다: ${leftover.join(', ')}`,
    });
  }
  if (order.join(',') !== registry.order.join(',')) {
    issues.push({
      code: 'E_INVARIANT_dependency_graph_must_be_acyclic',
      path: 'registry#/order',
      message: '저장된 위상 순서가 재계산 결과와 다르다.',
    });
  }

  const recomputed = sha256Tagged(canonicalize(registry.modules));
  if (recomputed !== registry.hash) {
    issues.push({
      code: 'E_INVARIANT_identical_documents_must_produce_identical_registry_hash',
      path: 'registry#/hash',
      message: `해시가 내용과 일치하지 않는다. 저장: ${registry.hash} / 재계산: ${recomputed}`,
    });
  }

  return issues;
}
