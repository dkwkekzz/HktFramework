// World Candidates — 아직 세계에 들이지 않은 방들이 머무는 자리 (T6 ADDED).
//
// 초안기(T5)가 낸 방은 곧바로 세계가 되지 않는다. **승인만 `content/regions/` 에 들어간다**
// (Tool-Scale §4 · T6). 그 사이에 머무는 자리가 여기다 — `tools/world-editor/out/candidates/`.
// 그 폴더는 git 이 무시한다: 후보는 세계가 아니고, 언제든 다시 낼 수 있는 것이다.
//
// 후보 하나가 지니는 것은 셋이다. 판정에 필요한 것이 그 셋뿐이기 때문이다:
//   brief.json      무엇을 답했는가 (여덟 답 · T2)
//   judgement.json  서는가 · 등급은 무엇이고 무엇이 빠졌는가 · **세계의 수를 어디로 미는가**
//   top.png         위에서 본 그 방 (T3 의 뼈대를 컴파일한 결과 그대로)
//
// 판정은 여기서 하지 않는다 — T4 가 등급을, T1 이 검사를, 기반이 편중 이동을 낸다.
// 이 파일이 하는 일은 그 셋을 한 자리에 모아 두고 다시 읽는 것뿐이다.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_CONTRACTS } from '../../content/authoring';
import type { RegionSpec } from '../../content/regions/spec';
import type { RegionBrief } from '../../engine/world-authoring/brief';
import { checkShifts, type CheckShift } from '../../engine/world-authoring/candidate';
import type { DraftOutcome, DraftResult } from '../../engine/world-authoring/draft';
import { gradeRegion, type Gap, type Grade } from '../../engine/world-authoring/grade';
import { authorBrief, checkAuthored, checkBaseline } from './author';
import { observeRegion } from './observe';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 후보들이 머무는 자리 — git 이 무시하는 폴더다 (.gitignore 의 tools/world-editor/out/) */
export const CANDIDATES_DIR = 'tools/world-editor/out/candidates';

/** 후보 하나에 내린 판정 — 사람이 승인/반려를 정할 때 보는 것 전부 */
export interface Judgement {
  /** 이 방을 부른 미지 한 줄 */
  unknown: string;
  outcome: DraftOutcome;
  grade?: Grade;
  because?: string;
  /** 등급을 가른 것 (T4) */
  blocking: Gap[];
  /** 등급을 가르지는 않으나 채워야 할 것 — 아직 답하지 않은 질문 */
  pending: Gap[];
  /**
   * 이 방을 넣으면 세계의 수가 어디로 움직이는가 (편중 요약).
   * 서지 못한 후보는 잴 것이 없으므로 비어 있다.
   */
  shifts: CheckShift[];
  /** 몇 번 물었고 무엇이 걸렸는가 */
  rounds: { round: number; stage?: string; problems: readonly string[] }[];
}

export interface Candidate {
  /** 폴더 이름 = 방 이름. 형도 못 갖춘 답은 줄 번호로 부른다 */
  key: string;
  brief?: RegionBrief;
  judgement: Judgement;
  /** 위에서 본 그림 — 서지 못한 후보에는 없다 */
  topPng?: Buffer;
}

/** 방 하나를 넣기 전과 넣은 뒤를 견준다 — 편중 요약의 재료 (T6) */
export function judgeShifts(brief: RegionBrief): CheckShift[] {
  return checkShifts(checkBaseline(), checkAuthored(authorBrief(brief)));
}

/** 고리의 결과 하나 → 판정 하나. 서지 못한 것도 판정이다 (왜 못 섰는지가 남는다) */
export function judge(unknown: string, result: DraftResult): Judgement {
  const grade = result.brief ? gradeRegion(result.brief, WORLD_CONTRACTS) : undefined;
  return {
    unknown,
    outcome: result.outcome,
    ...(grade ? { grade: grade.grade, because: grade.because } : {}),
    blocking: grade?.blocking ?? [],
    pending: grade?.pending ?? [],
    // 선 방만 편중을 잰다 — 서지 못한 방은 세계에 넣어 볼 수가 없다
    shifts: result.outcome === 'passed' && result.brief ? judgeShifts(result.brief) : [],
    rounds: result.rounds.map((round) => ({
      round: round.round,
      ...(round.stage ? { stage: round.stage } : {}),
      problems: round.problems,
    })),
  };
}

/** 위에서 본 그 방 — T3 의 뼈대를 컴파일한 결과 그대로다 (도구가 덧그리지 않는다) */
export function topViewOf(brief: RegionBrief, scale = 3): Buffer {
  const authored = authorBrief(brief);
  // 그림은 **컴파일된 땅**에서만 나온다 — 원천도 흔적도 이미 space 의 op 다.
  // 그래서 재료 계통(T3 의 나머지 · C022)을 옮겨 담지 않는다. 그리기에 쓰이지 않는다
  const spec: RegionSpec = {
    id: authored.spec.id,
    depth: authored.spec.depth,
    space: authored.spec.space,
  };
  const { pictures } = observeRegion(spec, {
    pictures: ['top'],
    semanticLayer: '',
    report: false,
    outDir: '',
    scale,
  });
  return pictures[0]!.png;
}

/** 후보 하나를 굳힌다 — 세계가 아니라 **머무는 자리**에 */
export function writeCandidate(dir: string, candidate: Candidate): string {
  const at = resolve(ROOT, dir, candidate.key);
  mkdirSync(at, { recursive: true });
  writeFileSync(
    join(at, 'judgement.json'),
    `${JSON.stringify(candidate.judgement, null, 2)}\n`,
    'utf8',
  );
  if (candidate.brief) {
    writeFileSync(join(at, 'brief.json'), `${JSON.stringify(candidate.brief, null, 2)}\n`, 'utf8');
  }
  if (candidate.topPng) writeFileSync(join(at, 'top.png'), candidate.topPng);
  return `${dir}/${candidate.key}`;
}

/** 머무는 자리의 후보들 — 이름 차례다 (두 번 읽어도 같은 차례여야 한다) */
export function readCandidates(dir: string): Candidate[] {
  const at = resolve(ROOT, dir);
  if (!existsSync(at)) return [];
  const keys = readdirSync(at, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const out: Candidate[] = [];
  for (const key of keys) {
    const judgementFile = join(at, key, 'judgement.json');
    if (!existsSync(judgementFile)) continue; // 판정이 없으면 후보가 아니다
    const briefFile = join(at, key, 'brief.json');
    const topFile = join(at, key, 'top.png');
    out.push({
      key,
      judgement: JSON.parse(readFileSync(judgementFile, 'utf8')) as Judgement,
      ...(existsSync(briefFile)
        ? { brief: JSON.parse(readFileSync(briefFile, 'utf8')) as RegionBrief }
        : {}),
      ...(existsSync(topFile) ? { topPng: readFileSync(topFile) } : {}),
    });
  }
  return out;
}

/** 후보 하나를 머무는 자리에서 지운다 — 반려다 (세계는 애초에 만진 적이 없다) */
export function removeCandidate(dir: string, key: string): boolean {
  const at = resolve(ROOT, dir, key);
  if (!existsSync(at)) return false;
  rmSync(at, { recursive: true, force: true });
  return true;
}
