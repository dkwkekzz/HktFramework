import { sha256Tagged } from '@hkt/v0-module-contract';
import { canonicalJson } from '@hkt/v1-schema';
import type { AuditReport, ModuleAudit } from './audit.js';

/**
 * V 단계 완료 화면 (원문 「8」의 "V 단계 완료 결과").
 *
 * ```text
 * /lab
 *   모든 모듈 상태
 *   실패한 검증
 *   의존성 그래프
 *   최신 코드 해시
 *   리플레이 해시
 *   자동 검증 결과
 * ```
 *
 * 여섯 구획을 데이터로 만든다. 그리는 일은 `apps/lab` 이 한다 — 화면 코드가 판정을 만들어 내지
 * 않게 하려는 것이다.
 */

export interface StatusRow {
  moduleId: string;
  name: string;
  version: string;
  declaredStatus: string;
  effectiveStatus: string;
  invalidated: boolean;
}

export interface FailedCheck {
  moduleId: string;
  /** 게이트 id 이거나 감사 코드 */
  source: string;
  detail: string;
}

export interface HashRow {
  moduleId: string;
  sourceHash: string | null;
  contractHash: string;
}

export interface ReplayRow {
  moduleId: string;
  runs: number;
  uniqueHashes: number;
  /** 리플레이가 하나로 모였는가 (GI-12) */
  consistent: boolean;
}

/**
 * 전체 완성 판정 (원문 「27」).
 *
 * 아직 담당 모듈이 없는 지표는 **거짓으로 0 을 적지 않고** `null` 로 두고 `pending` 에 이유를 남긴다.
 * 측정하지 않은 것을 통과로 적는 순간 이 판정 전체가 쓸모없어진다.
 */
export interface CompletionReport {
  allModulesVerified: boolean;
  allDesignRequirementsCovered: boolean | null;
  allVerticalSlicesPassed: boolean;
  globalInvariantViolations: number | null;
  unexplainedStateChanges: number | null;
  orphanWorldEntities: number | null;
  unreachableGoals: number | null;
  abilitiesWithoutCounterplay: number | null;
  replayMismatches: number;
  regressionFailures: number | null;
  /** 아직 측정 주체가 없는 지표와 그 담당 (원문 「26」·「27」) */
  pending: string[];
  complete: boolean;
}

export interface Board {
  /** 모든 모듈 상태 */
  statuses: StatusRow[];
  /** 실패한 검증 */
  failedChecks: FailedCheck[];
  /** 의존성 그래프 */
  dependencyGraph: { order: string[]; edges: { from: string; to: string }[] };
  /** 최신 코드 해시 */
  hashes: HashRow[];
  /** 리플레이 해시 */
  replays: ReplayRow[];
  /** 자동 검증 결과 */
  completion: CompletionReport;
  hash: string;
}

export interface BoardInput {
  audit: AuditReport;
  /** 저장소 전체 회귀 실행 결과 — 측정하지 않았으면 생략한다 */
  regressionFailures?: number;
  /** 이 저장소가 통과해야 할 수직 슬라이스 목록 (원문 「20」의 VS0~VS11) */
  requiredSlices?: readonly string[];
}

const WORLD_METRICS: readonly { key: string; owner: string }[] = [
  { key: 'allDesignRequirementsCovered', owner: 'A5 Coverage Dashboard (원문 「19」)' },
  { key: 'globalInvariantViolations', owner: 'K3 Invariant Audit · GI-01~GI-12' },
  { key: 'unexplainedStateChanges', owner: 'K3 event-replay (GI-01)' },
  { key: 'orphanWorldEntities', owner: 'W3 latent-world (GI-04)' },
  { key: 'unreachableGoals', owner: 'A2 Reachability (GI-03)' },
  { key: 'abilitiesWithoutCounterplay', owner: 'R4 · A2 (GI-06 · GI-07)' },
];

export function buildBoard(input: BoardInput): Board {
  const modules = input.audit.modules;

  const statuses: StatusRow[] = modules.map((module) => ({
    moduleId: module.id,
    name: module.name,
    version: module.version,
    declaredStatus: module.declaredStatus,
    effectiveStatus: module.effectiveStatus,
    invalidated: module.invalidated,
  }));

  const failedChecks: FailedCheck[] = [];
  for (const module of modules) {
    for (const gate of module.gates) {
      if (gate.passed) continue;
      failedChecks.push({
        moduleId: module.id,
        source: `${gate.id} ${gate.name}`,
        detail: gate.measured ? gate.detail : `측정 없음 — ${gate.detail}`,
      });
    }
    for (const reason of module.reasons) {
      failedChecks.push({ moduleId: module.id, source: reason.code, detail: reason.message });
    }
  }

  const edges: { from: string; to: string }[] = [];
  for (const module of modules) {
    for (const dependency of module.dependsOn) edges.push({ from: dependency, to: module.id });
  }
  edges.sort((a, b) => (`${a.from}→${a.to}` < `${b.from}→${b.to}` ? -1 : 1));

  const replays: ReplayRow[] = modules.map((module) => ({
    moduleId: module.id,
    runs: module.replay?.runs ?? 0,
    uniqueHashes: module.replay?.uniqueHashes ?? 0,
    consistent: module.replay !== null && module.replay.runs > 0 && module.replay.uniqueHashes === 1,
  }));

  const board: Omit<Board, 'hash'> = {
    statuses,
    failedChecks,
    dependencyGraph: {
      order: modules.map((module) => module.id).sort((a, b) => (a < b ? -1 : 1)),
      edges,
    },
    hashes: modules.map((module) => ({
      moduleId: module.id,
      sourceHash: module.sourceHash,
      contractHash: module.contractHash,
    })),
    replays,
    completion: completionOf(modules, replays, input),
  };

  return { ...board, hash: sha256Tagged(canonicalJson(board)) };
}

function completionOf(
  modules: readonly ModuleAudit[],
  replays: readonly ReplayRow[],
  input: BoardInput,
): CompletionReport {
  const allModulesVerified =
    modules.length > 0 &&
    modules.every(
      (module) => module.effectiveStatus === 'VERIFIED' || module.effectiveStatus === 'FROZEN',
    );

  const sliceVerdicts = new Map<string, string>();
  for (const module of modules) {
    for (const [slice, verdict] of Object.entries(module.integrationSlices)) {
      // 한 슬라이스가 여러 모듈에 걸쳐 있으면 가장 나쁜 판정을 남긴다.
      if (verdict !== 'passed' || !sliceVerdicts.has(slice)) sliceVerdicts.set(slice, verdict);
    }
  }
  const required = input.requiredSlices ?? [...sliceVerdicts.keys()];
  const allVerticalSlicesPassed =
    required.length > 0 && required.every((slice) => sliceVerdicts.get(slice) === 'passed');

  const replayMismatches = replays.filter((row) => !row.consistent).length;

  const pending = WORLD_METRICS.map((metric) => `${metric.key} — 담당 ${metric.owner} 미구현`);
  if (input.regressionFailures === undefined) {
    pending.push('regressionFailures — 저장소 전체 회귀 실행 결과가 넘어오지 않았다');
  }
  const unpassedSlices = required.filter((slice) => sliceVerdicts.get(slice) !== 'passed');
  if (unpassedSlices.length > 0) {
    pending.push(`수직 슬라이스 미통과 — ${unpassedSlices.join(', ')}`);
  }

  return {
    allModulesVerified,
    allDesignRequirementsCovered: null,
    allVerticalSlicesPassed,
    globalInvariantViolations: null,
    unexplainedStateChanges: null,
    orphanWorldEntities: null,
    unreachableGoals: null,
    abilitiesWithoutCounterplay: null,
    replayMismatches,
    regressionFailures: input.regressionFailures ?? null,
    pending,
    complete:
      allModulesVerified &&
      allVerticalSlicesPassed &&
      replayMismatches === 0 &&
      input.regressionFailures === 0 &&
      pending.length === 0,
  };
}
