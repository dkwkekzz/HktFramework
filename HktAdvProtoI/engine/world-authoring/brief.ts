// World Authoring — RegionBrief 형 (T2 ADDED).
//
// 방 하나를 짓기 전에 **사람이 답하는 여덟 답**의 형이다. 뼈대 생성기(T3)가 읽는 입력이고,
// 등급 판정기(T4)가 재는 대상이며, 초안기(T5)가 자유 문장이 아니라 이 형으로 낸다.
//
// 여덟 답은 Concept §17 의 일곱 질문(L2-World-Tool.md §3.2 가 옮겨 적었다)에
// Life §3.5 가 더한 여덟째다.
//
//   ① 특별함  이곳은 무엇이 특별한가        distinction
//   ② 원인    왜 이런 환경이 되었는가        cause
//   ③ 거주    무엇이 살아가는가             dwelling
//   ④ 위험    무엇이 위험한가               danger
//   ⑤ 귀함    무엇이 귀해지는가             worth
//   ⑥ 발견    무엇을 발견하는가             discovery
//   ⑦ 열림    어떤 가능성이 열리는가         opening
//   ⑧ 탄생    무엇이 태어나는가             birth   (Life §3.5 — 없으면 도구가 짓는 방 백 개에 생명이 없다)
//
// **게임 명사가 없다.** 필드 이름이 전부 일반명이라 이 형은 기반에 선다 — 어느 방이 무슨 갈래이고
// 어떤 재료가 나는지는 값이지 형이 아니다. 그래서 다른 세계도 같은 형으로 적을 수 있다.
//
// **답하지 않은 답을 지어내지 않는다.** 답은 사람이 적은 문장이거나 `{ unanswered: 왜 못 적는가 }` 다.
// 빈 글자를 통과시키면 형이 거짓말을 한다 — 검사 아홉의 `absent` 와 같은 규율이다 (T1).
// 비어 있다는 것이 형에 남으므로 T4 가 "이 방은 아직 무엇을 모르는가" 를 셀 수 있다.

import { z } from 'zod';

/**
 * 답 하나 — 사람이 적은 문장, 또는 **아직 답하지 않았다는 표시**.
 * 지어내는 대신 비워 두되, 왜 못 적는지는 반드시 적는다.
 */
export const AnswerSchema = z.union([
  z.string().trim().min(1, '답이 비어 있다 — 지어내지 않으려면 unanswered 로 적는다'),
  z.strictObject({ unanswered: z.string().trim().min(1, '왜 아직 답할 수 없는지를 적는다') }),
]);
export type Answer = z.infer<typeof AnswerSchema>;

/** ⑤ 귀함 — 무엇이 귀해지는가. 무엇을 무엇이 붙잡아 두는가까지 적는다 (README 세계 인과 ③) */
export const WorthSchema = z.strictObject({
  said: AnswerSchema,
  /** 이 방이 낳는 것들. 없는 방이 있다 — 없음은 결핍이 아니라 그 방의 조건이다 */
  sources: z
    .array(
      z.strictObject({
        /** 그 자리의 이름 */
        id: z.string().trim().min(1),
        /** 거기서 나오는 것의 이름 */
        material: z.string().trim().min(1),
        /** 무엇이 그것을 붙잡아 두는가 — 땅 · 식물 · 남은 것 … */
        heldBy: z.string().trim().min(1),
        /**
         * 어떤 자연 형태로 있는가 — 같은 것이 여러 모습으로 온다 (T3 ADDED).
         * 붙잡아 두는 것만으로는 갈리지 않는다: 남은 것 하나가 두 형태로 온다
         */
        form: z.string().trim().min(1),
        /**
         * 이 자리의 성격 — 거저 주는가 · 위험을 끼는가 · 조건이 붙는가 · 곁딸리는가 (T3 ADDED).
         * 생성기가 원천의 기본형(얼마나 주는가 · 다시 나는가 · 무너지는가)을 고르는 열쇠다.
         * 깊이로도 붙잡는 것으로도 갈리지 않는다 — 답하는 사람이 아는 것이다.
         *
         * **어휘를 형에 박지 않는다** (T4 CHANGED). 어느 이름이 성립하는지는 이 세계의 계약
         * 목록이 알고 등급 판정기가 대조한다 — 형에 박으면 기반이 게임 명사를 쥐게 되고,
         * 같은 목록이 두 자리에 있게 된다. 붙잡는 것(heldBy)과 같은 규율이다
         */
        role: z.string().trim().min(1),
      }),
    )
    .default([]),
});
export type Worth = z.infer<typeof WorthSchema>;

/**
 * ⑧ 탄생 — 무엇이 태어나는가 (Life §3.5).
 * 어떤 재료에서 · 무엇을 소비하며 · 무엇을 남기고 · 무엇을 부르는가.
 */
export const BirthSchema = z.strictObject({
  said: AnswerSchema,
  /** 태어나는 것들. 빈 배열이면 "이 방에서 태어나는 것이 없다" 이고, said 가 그 까닭을 진다 */
  born: z
    .array(
      z.strictObject({
        id: z.string().trim().min(1),
        /** 어떤 재료에서 */
        from: z.string().trim().min(1),
        /** 무엇을 소비하며 */
        consumes: z.array(z.string().trim().min(1)).default([]),
        /** 무엇을 남기고 */
        leaves: z.array(z.string().trim().min(1)).default([]),
        /** 무엇을 부르는가 */
        calls: z.array(z.string().trim().min(1)).default([]),
      }),
    )
    .default([]),
});
export type Birth = z.infer<typeof BirthSchema>;

/** 여덟 답 */
export const RegionAnswersSchema = z.strictObject({
  distinction: AnswerSchema,
  cause: AnswerSchema,
  dwelling: AnswerSchema,
  danger: AnswerSchema,
  worth: WorthSchema,
  discovery: AnswerSchema,
  opening: AnswerSchema,
  birth: BirthSchema,
});
export type RegionAnswers = z.infer<typeof RegionAnswersSchema>;

/** 이웃 — 어느 방에 어떤 이음으로 잇는가. 아직 짓지 않은 곳을 가리켜도 된다 (경계) */
export const NeighbourSchema = z.strictObject({
  region: z.string().trim().min(1),
  /** 무엇으로 건너는가 — 길 · 문 · 추락 · 물길 … */
  transition: z.string().trim().min(1),
  direction: z.enum(['bidirectional', 'one-way']),
  /** 아직 짓지 않은 곳인가 */
  frontier: z.boolean().default(false),
});
export type Neighbour = z.infer<typeof NeighbourSchema>;

/**
 * 요구 — 이 방이 성립하려면 세계에 무엇이 있어야 하는가.
 * 비어 있으면 **데이터만으로 서는 방**이다 (등급 A). T4 가 이것을 읽어 A · B · C 로 가른다.
 */
export const RequirementSchema = z.strictObject({
  /** rule 이 방만의 규칙 하나 · axis 아직 없는 층의 의미 · contract 공통 계약 중 없는 것 */
  kind: z.enum(['rule', 'axis', 'contract']),
  what: z.string().trim().min(1),
  why: z.string().trim().min(1),
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const RegionBriefSchema = z.strictObject({
  /** 기계가 부르는 이름 */
  id: z.string().trim().min(1),
  /** 사람이 부르는 이름 */
  name: z.string().trim().min(1),
  /** 이 방이 사슬의 어디인가 */
  depth: z.string().trim().min(1),
  /** 갈래 — 이 방을 무엇으로 치는가. 여럿일 수 있고, 없을 수도 있다 */
  kinds: z.array(z.string().trim().min(1)).default([]),
  /** 품은 방인가 — 부모가 있으면 적는다 */
  parent: z.string().trim().min(1).optional(),
  answers: RegionAnswersSchema,
  neighbours: z.array(NeighbourSchema).default([]),
  requires: z.array(RequirementSchema).default([]),
});
export type RegionBrief = z.infer<typeof RegionBriefSchema>;

/** 답 하나가 아직 답이 아닌가 */
export function isUnanswered(answer: Answer): answer is { unanswered: string } {
  return typeof answer !== 'string';
}

/** 여덟 답을 형에 적힌 순서로 — T4 와 보고가 같은 순서로 읊게 하는 유일한 자리 */
export const ANSWER_ORDER = [
  'distinction',
  'cause',
  'dwelling',
  'danger',
  'worth',
  'discovery',
  'opening',
  'birth',
] as const;
export type AnswerKey = (typeof ANSWER_ORDER)[number];

/**
 * 그 질문의 답 하나 — 귀함과 탄생은 딸린 목록을 가지므로 답이 `said` 안에 있다.
 * 그 갈래를 읽는 쪽마다 다시 가르지 않도록 여기 한 번만 적는다.
 */
export function answerOf(brief: RegionBrief, key: AnswerKey): Answer {
  const value = brief.answers[key];
  return typeof value === 'object' && value !== null && 'said' in value ? value.said : value;
}

/** 그 brief 가 아직 답하지 않은 질문들 — ANSWER_ORDER 순서 */
export function unansweredKeys(brief: RegionBrief): AnswerKey[] {
  return ANSWER_ORDER.filter((key) => isUnanswered(answerOf(brief, key)));
}

export interface BriefProblem {
  /** 어디가 걸렸는가 — 점 경로 (`answers.birth.said`) */
  path: string;
  message: string;
}

export type BriefParse =
  | { ok: true; brief: RegionBrief }
  | { ok: false; problems: BriefProblem[] };

/**
 * 값 하나를 형에 맞춰 읽는다 — 던지지 않고 걸린 자리를 돌려준다.
 * 검사 아홉이 걸린 자리를 refs 로 돌려주는 것과 같은 어법이다 (T1).
 */
export function parseRegionBrief(value: unknown): BriefParse {
  const result = RegionBriefSchema.safeParse(value);
  if (result.success) return { ok: true, brief: result.data };
  const problems: BriefProblem[] = [];
  for (const issue of result.error.issues) {
    const at = issue.path.join('.');
    // 형에 없는 필드는 걸린 자리가 그 필드 자신이다 — 묶어서 뭉개면 어느 줄을 지울지 알 수 없다
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        problems.push({ path: at === '' ? key : `${at}.${key}`, message: `형에 없는 필드다: ${key}` });
      }
      continue;
    }
    problems.push({ path: at, message: issue.message });
  }
  return { ok: false, problems };
}
