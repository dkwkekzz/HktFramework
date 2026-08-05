// C01-O-S01 — 국경 협곡 사냥터의 핵심 공리 5종과 평가기.
// 신 유지 조건·능력 흔적 공리는 대상(신·의념 능력) 부재로 후속 Cycle 이월 (CYCLE.md 부록 A).
//
// 상태 관례(얇게 — O-S02 존재론에서 스키마로 고정될 형태의 선취):
//   state.resources = { [자원명]: 수량 }  — 보존 공리의 재고 조회 대상
import { changedPaths } from './axioms.js';

/** 사건 기반 상태 변경 — 정식 세계 상태는 대응 사건 없이 변경될 수 없다 */
export const eventSourcedTransition = {
  spec: {
    id: 'AX-EVENT-SOURCED',
    description: '정식 세계 상태는 대응 사건 없이 변경될 수 없다',
    phases: ['runtime_transition'],
    severity: 'error',
    evaluatorId: 'checkEventSourcedTransition',
    playerFacingSignals: ['세계 변화에는 언제나 흔적·목격·기록이 남는다'],
  },
  evaluator(ctx) {
    const changed = changedPaths(ctx.before, ctx.after);
    const events = ctx.input?.events ?? [];
    if (changed.length > 0 && events.length === 0) {
      return {
        axiomId: 'AX-EVENT-SOURCED', passed: false, violationCode: 'EVENT_REQUIRED',
        message: `사건 없이 상태가 변경됨: ${changed.join(', ')}`, statePaths: changed,
      };
    }
    return { axiomId: 'AX-EVENT-SOURCED', passed: true, message: 'ok', statePaths: changed };
  },
};

/** 자원·비용 보존 — 생산에는 추적 가능한 소비가 필요하고, 소비는 실재 재고를 넘을 수 없다 */
export const resourceConservation = {
  spec: {
    id: 'AX-CONSERVATION',
    description: '자원 생산·소비에는 추적 가능한 비용과 실재 재고가 필요하다',
    phases: ['runtime_transition'],
    severity: 'error',
    evaluatorId: 'checkResourceAndCostConservation',
    playerFacingSignals: ['치료제·장비는 재료 없이 만들어지지 않는다', '남획하면 실제로 마른다'],
  },
  evaluator(ctx) {
    const stock = ctx.before?.resources ?? {};
    for (const ev of ctx.input?.events ?? []) {
      const produces = ev.payload?.produces ?? [];
      const consumes = ev.payload?.consumes ?? [];
      if (produces.length > 0 && consumes.length === 0) {
        return {
          axiomId: 'AX-CONSERVATION', passed: false, violationCode: 'CONSERVATION_NO_COST',
          message: `비용 없는 생산: ${ev.type} → ${produces.map((p) => p.resource).join(',')}`,
          statePaths: produces.map((p) => `resources.${p.resource}`),
        };
      }
      for (const c of consumes) {
        if ((stock[c.resource] ?? 0) < c.qty) {
          return {
            axiomId: 'AX-CONSERVATION', passed: false, violationCode: 'CONSERVATION_INSUFFICIENT_SOURCE',
            message: `재고 부족 소비: ${c.resource} ${c.qty} > ${stock[c.resource] ?? 0}`,
            statePaths: [`resources.${c.resource}`],
          };
        }
      }
    }
    return { axiomId: 'AX-CONSERVATION', passed: true, message: 'ok', statePaths: [] };
  },
};

/** 관찰 세계 고정 — 관찰된 정식 요소는 사건 없이 소급 변경되지 않는다 */
export const observedWorldLock = {
  spec: {
    id: 'AX-OBSERVED-LOCK',
    description: '관찰된 정식 세계 요소는 사건 없이 소급 변경되지 않는다',
    phases: ['world_compile', 'runtime_transition'],
    severity: 'error',
    evaluatorId: 'checkObservedWorldLock',
    playerFacingSignals: ['한 번 본 둥지·지형은 몰래 바뀌지 않는다'],
  },
  evaluator(ctx) {
    const observed = new Set(ctx.input?.observedPaths ?? []);
    if (observed.size === 0) return { axiomId: 'AX-OBSERVED-LOCK', passed: true, message: 'ok', statePaths: [] };
    if (ctx.phase === 'world_compile') {
      const hit = (ctx.input?.proposal?.modifies ?? []).filter((p) => observed.has(p));
      if (hit.length) {
        return {
          axiomId: 'AX-OBSERVED-LOCK', passed: false, violationCode: 'OBSERVED_RETROACTIVE_CHANGE',
          message: `관찰된 요소의 소급 수정 제안: ${hit.join(', ')}`, statePaths: hit,
        };
      }
      return { axiomId: 'AX-OBSERVED-LOCK', passed: true, message: 'ok', statePaths: [] };
    }
    // runtime_transition: 관찰 경로의 변경은 그 경로를 선언한 사건이 있어야 한다
    const covered = new Set((ctx.input?.events ?? []).flatMap((e) => e.statePaths ?? []));
    const uncovered = changedPaths(ctx.before, ctx.after).filter((p) => observed.has(p) && !covered.has(p));
    if (uncovered.length) {
      return {
        axiomId: 'AX-OBSERVED-LOCK', passed: false, violationCode: 'OBSERVED_RETROACTIVE_CHANGE',
        message: `관찰된 경로가 사건 선언 없이 변경됨: ${uncovered.join(', ')}`, statePaths: uncovered,
      };
    }
    return { axiomId: 'AX-OBSERVED-LOCK', passed: true, message: 'ok', statePaths: [] };
  },
};

/** 조직 실체 행동 — 조직은 실제 구성원·자산을 통해서만 행동한다 */
export const organizationEmbodiedAction = {
  spec: {
    id: 'AX-ORG-EMBODIED',
    description: '조직(조합·상단)은 실제 구성원·자산의 실행 경로를 통해서만 행동한다',
    phases: ['runtime_transition'],
    severity: 'error',
    evaluatorId: 'checkOrganizationEmbodiedAction',
    playerFacingSignals: ['조합 공고 뒤에는 실제 담당자와 자산이 있다'],
  },
  evaluator(ctx) {
    for (const ev of ctx.input?.events ?? []) {
      if (ev.actor?.kind === 'organization' && !(ev.actor.via?.members?.length > 0)) {
        return {
          axiomId: 'AX-ORG-EMBODIED', passed: false, violationCode: 'ORG_NO_EMBODIMENT',
          message: `실행 구성원 없는 조직 행동: ${ev.actor.id} → ${ev.type}`,
          statePaths: ev.statePaths ?? [],
        };
      }
    }
    return { axiomId: 'AX-ORG-EMBODIED', passed: true, message: 'ok', statePaths: [] };
  },
};

/** 권위 충돌 확정 — 공유 소유권·전투·계약 결과는 권위 서버에서 한 번만 확정된다 */
export const authoritativeConflictResolution = {
  spec: {
    id: 'AX-AUTHORITY',
    description: '공유 소유권·전투·계약 결과는 권위 서버에서 한 번만 확정된다',
    phases: ['authority_resolution'],
    severity: 'error',
    evaluatorId: 'checkAuthoritativeConflictResolution',
    playerFacingSignals: ['같은 사냥감을 둘이 잡으면 한 명만 얻는다'],
  },
  evaluator(ctx) {
    const { resource, claims = [], accepted = [], resolvedBy } = ctx.input ?? {};
    const path = resource ? [`ownership.${resource}`] : [];
    if (resolvedBy !== 'authority-server') {
      return {
        axiomId: 'AX-AUTHORITY', passed: false, violationCode: 'AUTHORITY_NOT_SERVER',
        message: `권위 서버 외 확정 주체: ${resolvedBy ?? '(없음)'}`, statePaths: path,
      };
    }
    if (accepted.length > 1) {
      return {
        axiomId: 'AX-AUTHORITY', passed: false, violationCode: 'AUTHORITY_DOUBLE_CONFIRM',
        message: `이중 확정: ${accepted.map((a) => a.by).join(',')}`, statePaths: path,
      };
    }
    const claimants = new Set(claims.map((c) => c.by));
    const phantom = accepted.filter((a) => !claimants.has(a.by));
    if (phantom.length) {
      return {
        axiomId: 'AX-AUTHORITY', passed: false, violationCode: 'AUTHORITY_PHANTOM_ACCEPT',
        message: `주장 없는 확정: ${phantom.map((a) => a.by).join(',')}`, statePaths: path,
      };
    }
    return { axiomId: 'AX-AUTHORITY', passed: true, message: 'ok', statePaths: path };
  },
};

export const C01_AXIOMS = [
  eventSourcedTransition,
  resourceConservation,
  observedWorldLock,
  organizationEmbodiedAction,
  authoritativeConflictResolution,
];

export function registerC01Axioms(registry) {
  for (const { spec, evaluator } of C01_AXIOMS) registry.register(spec, evaluator);
  return registry;
}
