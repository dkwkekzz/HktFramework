// World Authoring — 초안기의 되먹임 고리 (T5 ADDED).
//
// 미지 한 줄 → brief 하나(T2). 낸 것이 형을 어기거나 세계에 서지 못하면 **걸린 자리를 그대로
// 되물어** 다시 낸다 (상한 N). 이 파일이 아는 것은 그 고리뿐이다 — 누가 답하는지도(도구가 부르는
// 모델), 무엇이 걸림인지도(도구가 재는 T4 · T3 · T1) 밖에서 온다.
//
// **비결정을 여기 가둔다.** 모델의 답은 두 번 같지 않다. 그래서 이 고리가 내는 것은 세계가 아니라
// **굳힐 후보 하나**다 — 굳은 파일이 원본이고, 그 파일에서 나오는 방은 결정론이다 (T3의 seed 는
// brief 의 해시다). 세계 실행은 이 고리를 부르지 않는다.
//
// **되먹여도 소용없는 걸림이 있다.** 그 방이 진짜로 규칙 하나나 새 축을 요구하면 (T4 의 B · C)
// 다시 물어도 같은 답이 온다 — 그것은 실패가 아니라 **사람에게 돌아가는 답**이다. 무엇이
// 되먹일 것이고 무엇이 돌아갈 것인지는 재는 쪽(도구)이 `retry` 로 말한다.
//
// **게임 명사가 없다.** 어휘도 방도 재료도 이 파일에 없다.

import { parseRegionBrief, type RegionBrief } from './brief';

/** 모델에게 한 번 묻는 것 — 형만 안다. 누가 답하는지는 도구가 정한다 */
export interface DraftAsk {
  /** 이 세계가 무엇이고 어떻게 적는가 (확정 문서를 그대로 이은 글) */
  system: string;
  /** 이번에 물을 것 — 미지 한 줄, 그리고 앞선 시도에서 걸린 자리들 */
  user: string;
  /** 답이 지켜야 할 형 — T2 schema 를 JSON Schema 로 옮긴 것 */
  schema: unknown;
}

/** 물으면 값 하나가 온다. 형을 지켰는지는 이 고리가 판정한다 (지켰다고 믿지 않는다) */
export type DraftPort = (ask: DraftAsk) => Promise<unknown>;

/** 낸 brief 하나를 세계에 넣어 본 결과 — 도구가 T4 · T3 · T1 로 잰다 */
export interface DraftTrial {
  ok: boolean;
  /** 무엇이 걸렸는가 — 이 줄들이 그대로 다음 물음에 실린다 */
  problems: readonly string[];
  /**
   * 이 걸림을 **초안기가 고칠 수 있는가**.
   * 거짓이면 다시 묻지 않고 멈춘다 — 되물어도 같은 답이 올 걸림이다.
   */
  retry: boolean;
}

export type DraftTrialFn = (brief: RegionBrief) => DraftTrial;

/** 어디서 걸렸는가 — 형이 아니면 세계다 */
export type DraftStage = 'shape' | 'world';

export interface DraftRound {
  round: number;
  /** 무엇을 물었는가 — 되먹임이 실렸는지를 눈으로 볼 수 있어야 한다 */
  asked: string;
  /** 통과했으면 없다 */
  stage?: DraftStage;
  problems: readonly string[];
}

/**
 * 고리가 끝난 까닭.
 *   passed    서는 방 하나가 나왔다
 *   returned  되먹여도 소용없는 걸림 — 사람에게 돌아간다 (T4 의 B · C)
 *   exhausted 상한만큼 물어도 서지 않았다
 */
export type DraftOutcome = 'passed' | 'returned' | 'exhausted';

export interface DraftResult {
  outcome: DraftOutcome;
  /** 마지막으로 형을 통과한 brief — exhausted 이면 없을 수 있다 */
  brief?: RegionBrief;
  rounds: readonly DraftRound[];
}

export interface DraftInput {
  /** 미지 한 줄 */
  unknown: string;
  system: string;
  schema: unknown;
  ask: DraftPort;
  trial: DraftTrialFn;
  /** 되먹임 상한 — 이만큼 물어도 서지 않으면 멈춘다 (기본 셋) */
  attempts?: number;
}

/**
 * 이번에 물을 글. 첫 물음은 미지 한 줄뿐이고, 그 다음부터는 **걸린 자리가 그대로 실린다**.
 *
 * 앞선 시도를 요약하지 않는다 — 무엇이 걸렸는지를 글자 그대로 되돌려 주는 것이 되먹임이다.
 * 요약하면 고칠 자리를 모델이 다시 짐작해야 한다.
 */
export function draftQuestion(unknown: string, rounds: readonly DraftRound[]): string {
  const lines = [`미지 한 줄: ${unknown}`, '', '이 한 줄에서 방 하나를 여덟 답으로 적는다.'];
  const failed = rounds.filter((round) => round.problems.length > 0);
  if (failed.length === 0) return lines.join('\n');
  const last = failed[failed.length - 1]!;
  lines.push(
    '',
    `앞서 ${failed.length} 번 냈고, 마지막에 낸 것이 이렇게 걸렸다 (${last.stage === 'shape' ? '형' : '세계'}):`,
  );
  for (const problem of last.problems) lines.push(`  - ${problem}`);
  lines.push(
    '',
    '걸린 자리만 고쳐 다시 적는다. 걸리지 않은 답은 그대로 두어도 좋다.',
    '고치는 방법이 "지어내기" 밖에 없으면 그 답은 {"unanswered": "왜 못 적는가"} 로 적는다.',
  );
  return lines.join('\n');
}

/**
 * 미지 한 줄 → 서는 방 하나. 물어 → 형을 재고 → 세계에 넣어 보고 → 걸리면 되묻는다.
 *
 * 이 고리는 아무것도 굳히지 않는다 — 굳히는 것은 도구의 일이고, 그래야 "무엇이 세계에
 * 들어가는가" 를 사람이 정하는 자리가 남는다 (Tool-Scale §4).
 */
export async function draftRegion(input: DraftInput): Promise<DraftResult> {
  const limit = Math.max(1, input.attempts ?? 3);
  const rounds: DraftRound[] = [];
  let last: RegionBrief | undefined;

  for (let round = 1; round <= limit; round++) {
    const asked = draftQuestion(input.unknown, rounds);
    const answer = await input.ask({ system: input.system, user: asked, schema: input.schema });

    const parsed = parseRegionBrief(answer);
    if (!parsed.ok) {
      rounds.push({
        round,
        asked,
        stage: 'shape',
        problems: parsed.problems.map((p) => `${p.path === '' ? '(뿌리)' : p.path} — ${p.message}`),
      });
      continue;
    }
    last = parsed.brief;

    const trial = input.trial(parsed.brief);
    if (trial.ok) {
      rounds.push({ round, asked, problems: [] });
      return { outcome: 'passed', brief: parsed.brief, rounds };
    }
    rounds.push({ round, asked, stage: 'world', problems: trial.problems });
    // 되물어도 같은 답이 올 걸림 — 상한을 다 쓰지 않고 사람에게 돌린다
    if (!trial.retry) return { outcome: 'returned', brief: parsed.brief, rounds };
  }

  return { outcome: 'exhausted', brief: last, rounds };
}

// ── 시스템 글 — 확정 문서를 그대로 잇는다 (Tool-Scale §3.1 content/authoring/prompts)

/** 초안기가 무엇을 읽고 무엇을 지키는가. **값은 컨텐츠가 안다** — 이 파일은 형만 안다 */
export interface DraftPromptSpec {
  /** 그대로 이어 붙일 문서들 — 세계의 확정 사실은 전부 여기 있다 */
  documents: readonly string[];
  /** 본보기 — 형이 실제로 어떻게 채워지는지 */
  examples: readonly string[];
  /** 지켜야 할 것 */
  rules: readonly string[];
}

/** 지금 서 있는 세계 — 문서가 아니라 코드에서 읽은 값이다 (그래서 낡지 않는다) */
export interface DraftWorldFacts {
  /** 이 세계가 아는 어휘 — `of` 가 무엇의 목록인지를 말한다 */
  vocabulary: readonly { of: string; names: readonly string[] }[];
  /** 지금 검사(T1)가 무엇이라 말하는가 — 한 줄들 */
  standing: readonly string[];
}

/**
 * 시스템 글 하나를 짓는다. 문서를 **줄이지 않고 그대로** 잇는다 —
 * 요약하는 순간 초안기가 읽는 세계와 사람이 읽는 세계가 갈린다.
 *
 * 파일을 여는 것은 도구다 (`read`). 기반은 fs 를 알지 못한다.
 */
export function renderDraftSystem(
  spec: DraftPromptSpec,
  facts: DraftWorldFacts,
  read: (path: string) => string,
): string {
  const parts: string[] = [];
  parts.push('너는 이 세계의 방 하나를 적는 초안기다. 자유 문장이 아니라 주어진 형으로만 답한다.');

  parts.push('', '── 지켜야 할 것');
  spec.rules.forEach((rule, index) => parts.push(`${index + 1}. ${rule}`));

  parts.push('', '── 이 세계가 아는 어휘 (이 밖의 이름을 쓰면 돌려보내진다)');
  for (const entry of facts.vocabulary) {
    parts.push(`${entry.of}: ${entry.names.length > 0 ? entry.names.join(' · ') : '(아직 없다)'}`);
  }

  if (facts.standing.length > 0) {
    parts.push('', '── 지금 서 있는 세계');
    for (const line of facts.standing) parts.push(line);
  }

  for (const path of spec.examples) {
    parts.push('', `── 본보기 (${path})`, read(path));
  }

  for (const path of spec.documents) {
    parts.push('', `── 확정 문서 (${path})`, read(path));
  }

  return parts.join('\n');
}
