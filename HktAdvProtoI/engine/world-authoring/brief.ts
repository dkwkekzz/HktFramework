// World Authoring — RegionBrief 형 (T2 ADDED · T2 확장 CHANGED — 물음 ⑨~⑫).
//
// 방 하나를 짓기 전에 **사람이 답하는 열 답**의 형이다. 뼈대 생성기(T3)가 읽는 입력이고,
// 등급 판정기(T4)가 재는 대상이며, 초안기(T5)가 자유 문장이 아니라 이 형으로 낸다.
//
// 열 답은 Concept §17 의 일곱 질문(L2-World-Tool.md §3.2 가 옮겨 적었다)에 Life §3.5 가 더한
// 여덟째, Access 원문 §12 가 더한 아홉째~열두째, Foundation §5.4 가 더한 열셋째다.
// 답이 열인데 질문이 열셋인 것은 ⑨~⑫ 넷이 **한 자리(asking)에 모여 살기** 때문이다.
//
//   ① 특별함  이곳은 무엇이 특별한가        distinction
//   ② 원인    왜 이런 환경이 되었는가        cause
//   ③ 거주    무엇이 살아가는가             dwelling
//   ④ 위험    무엇이 위험한가               danger
//   ⑤ 귀함    무엇이 귀해지는가             worth
//   ⑥ 발견    무엇을 발견하는가             discovery
//   ⑦ 열림    어떤 가능성이 열리는가         opening
//   ⑧ 탄생    무엇이 태어나는가             birth   (Life §3.5 — 없으면 도구가 짓는 방 백 개에 생명이 없다)
//   ⑨ 물음    이 방은 무엇을 묻는가          asking  (Access §12 — 없으면 없다고 적는다)
//   ⑫ 흔적    그 요구를 알아낼 흔적은 무엇인가  asking.locks[].traces
//   ⑬ 내밂    무엇을 내밀고 무엇을 기억하는가  offering (Foundation §5.4 — 도구 표의 열셋째 질문)
//
// 나머지 둘은 이 표의 **다른 줄에 얹힌다** — 물어야 할 자리가 거기이기 때문이다.
//   ⑩ 무엇이 그 요구에 답할 성질을 가지는가   worth.sources[].properties (귀함이 낳는 것의 성질이다)
//   ⑪ 중요한 요구에 서로 다른 원천의 답이 있을 여지가 있는가
//      asking.said 의 산문이 사람의 말로 지고, 재는 것은 이 형이 아니라 **세계 전체**를 보는
//      검사 ㊴ ㊵ 다 (brief 하나로는 다른 방에 답이 있는지 알 수 없다 · Access §5.4)
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
         * **무엇이 그것을 낳았는가** — 이 방 밖에서 도는 세계 과정의 이름 (T3 CHANGED).
         *
         * 재료는 저절로 있지 않다. 낳은 것이 무엇인지 적히지 않으면 그 원천은 배치일 뿐이고,
         * 검사 ⑪ 이 "원인 없는 원천" 으로 잡는다.
         *
         * **어휘가 아니라 값이다** — 재료의 이름과 같은 성격이라 새것이어도 된다 (T4 가 대조하지
         * 않는다). 다만 그 방을 실제로 세계에 들일 때는 그 과정이 재료 표에 서 있어야 한다.
         */
        worldCause: z.string().trim().min(1),
        /**
         * **무엇이 그것을 되돌리는가** — 회복의 세계 원인 코드 (T3 CHANGED).
         *
         * 되돌아옴에는 세계 안의 원인이 있어야 한다 (Material S7). 타이머가 아니라 원인이다.
         * 얼마 만에 돌아오는가(초)는 여기서 답하지 않는다 — 시간 규모는 지어낼 값이 아니라
         * 역할별 기본형이 정한다 (content/authoring/templates).
         */
        recoveryCause: z.string().trim().min(1),
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
        /**
         * 이 원천이 내는 것이 **어떤 성질을 가지는가** (T2 확장 ADDED · ⑩) — 요구에 답할 여지가
         * 여기서 난다. `tag` 는 "축:관계", `from` 은 그것이 그 재료의 어느 문장에서 나오는가.
         * 빈 목록이면 이 원천이 내는 것에 아직 성질이 없다 (없음이 결핍이 아니다).
         *
         * **어휘를 형에 박지 않는다** — 어느 축이 · 어느 관계가 · 어느 문장이 성립하는지는 이
         * 세계의 계약 목록이 알고 등급 판정기가 대조한다 (role 이 세운 그 규율 그대로).
         */
        properties: z
          .array(
            z.strictObject({
              tag: z.string().trim().min(1),
              from: z.string().trim().min(1),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});
export type Worth = z.infer<typeof WorthSchema>;

/**
 * ⑧ 탄생 — 무엇이 태어나는가 (Life §3.5).
 *
 * 어떤 재료에서 · 무엇을 소비하며 · 무엇을 남기고 · 무엇을 부르는가에 더해, **그 탄생이
 * 무엇으로 서는가**까지 답한다 (T3 CHANGED). 이름 하나와 재료 하나만으로는 방이 서지 못한다 —
 * 탄생지 하나가 세계에 서려면 어떻게 맺히는가 · 무엇이 그것을 낳았는가 · 어느 규칙이
 * 일으키는가 · 무엇의 값을 올리는가가 함께 있어야 하기 때문이다 (content/regions 의 탄생지 표).
 *
 * **어휘를 형에 박지 않는다** — 탄생 방식도 세계 원인도 자연 형태도 규칙 이름도 전부 글자다.
 * 어느 이름이 성립하는지는 이 세계의 계약 목록이 알고 등급 판정기가 대조한다 (원천의 role 이
 * 세운 그 규율 그대로). 형에 박으면 기반이 게임 명사를 쥐게 된다.
 */
export const BirthSchema = z.strictObject({
  said: AnswerSchema,
  /** 태어나는 것들. 빈 배열이면 "이 방에서 태어나는 것이 없다" 이고, said 가 그 까닭을 진다 */
  born: z
    .array(
      z.strictObject({
        id: z.string().trim().min(1),
        /** 어떻게 태어나는가 — 어휘를 형에 박지 않는다 (원천의 role 과 같은 규율) */
        mode: z.string().trim().min(1),
        /** 이 탄생이 매달린 세계 과정 — 원천의 worldCause 와 같은 갈래 */
        worldCause: z.string().trim().min(1),
        /** 그 자리에 난 자연 형태 코드 */
        form: z.string().trim().min(1),
        /** 이 탄생을 일으키는 Region Rule id */
        regionRule: z.string().trim().min(1),
        /** 어떤 재료에서 — 재료들과, 재료가 아닌 세계 상태들 */
        from: z.strictObject({
          materials: z.array(z.string().trim().min(1)).default([]),
          states: z.array(z.string().trim().min(1)).default([]),
        }),
        /** 무엇을 소비하며 — 원천 id 들 */
        consumes: z.array(z.string().trim().min(1)).default([]),
        /** 무엇을 남기고 — 원천 id 들 */
        leaves: z.array(z.string().trim().min(1)).default([]),
        /** 무엇을 부르는가 — 개체군 id 들 */
        calls: z.array(z.string().trim().min(1)).default([]),
        /** 값을 올리는 개체군 */
        population: z.string().trim().min(1),
        /** 그 탄생이 생태에서 맡은 자리 */
        ecologicalRole: z.string().trim().min(1),
      }),
    )
    .default([]),
  /**
   * 이 방에 사는 개체군들.
   *
   * 태어나는 것과 **따로 답한다** — 나는 것 없이 드는 것만 있는 방이 있기 때문이다
   * (탄생지 없이 개체군만 밝힌 방 · content/regions/ecology.ts). 빈 배열이면 이 방에
   * 사는 떼가 없다.
   */
  populations: z
    .array(
      z.strictObject({
        id: z.string().trim().min(1),
        /** 이 방이 감당하는 수 */
        scale: z.number().int().positive(),
        /** 값이 내리는 세계 안의 원인 코드 */
        declineCause: z.string().trim().min(1),
        /** 떼의 의미 코드 — 밝히지 않으면 자락이 서지 않는다 */
        presence: z.string().trim().min(1).optional(),
      }),
    )
    .default([]),
});
export type Birth = z.infer<typeof BirthSchema>;

/**
 * ⑨~⑫ 물음 — 이 방은 무엇을 묻는가 (T2 확장 ADDED · Access 원문 §12).
 *
 * 빈 목록이면 **묻지 않는 방**이고 `said` 가 그 까닭을 진다 (탄생의 `born` 과 같은 어법 —
 * 없음이 침묵이 아니라 답이 된다). 목적은 원문 §12 가 적은 그것이다: "열쇠 없는 문 백 개" 와
 * "문마다 전용 열쇠 하나" 를 함께 막는 것 — 그러려면 무엇을 묻는지도(⑨) 무엇이 답할 성질을
 * 가지는지도(⑩ · worth) 알아낼 흔적이 무엇인지도(⑫) 방을 짓기 전에 적혀 있어야 한다.
 *
 * **어휘를 형에 박지 않는다** — 걸리는 자리의 갈래도 세기도 전부 글자다. 어느 이름이
 * 성립하는지는 이 세계의 계약 목록이 알고 등급 판정기가 대조한다 (원천의 role 이 세운 규율).
 */
export const AskingSchema = z.strictObject({
  said: AnswerSchema,
  locks: z
    .array(
      z.strictObject({
        id: z.string().trim().min(1),
        /** 어디에 걸리는가 — 갈래도 값이다 (어휘를 형에 박지 않는다) */
        at: z.strictObject({
          kind: z.string().trim().min(1),
          ref: z.string().trim().min(1),
        }),
        /** 무르게 묻는가 세게 묻는가 — 어휘는 계약이 안다 */
        strength: z.string().trim().min(1),
        /** 중요한 물음인가 — ⑪ 이 이것에 걸린다 */
        important: z.boolean().default(false),
        /** 무엇을 묻는가. 하나 이상이 **전부 참이어야** 열린다 */
        requires: z
          .array(
            z.strictObject({
              /** 성질 태그 "축:관계" */
              property: z.string().trim().min(1).optional(),
              /** 그 철에만 */
              seasons: z.array(z.string().trim().min(1)).default([]),
              /** 그 방의 지금 패턴 */
              state: z
                .strictObject({
                  region: z.string().trim().min(1),
                  patterns: z.array(z.string().trim().min(1)).default([]),
                })
                .optional(),
              /** 아는 것 */
              knowledge: z.string().trim().min(1).optional(),
            }),
          )
          .default([]),
        /** ⑫ 알아낼 흔적의 **이름들** — 자리는 생성기가 낸다 (원천·탄생지가 그런 그대로) */
        traces: z.array(z.string().trim().min(1)).default([]),
        /** 지목했을 때 판이 말하는 현상의 코드 — 요구의 이름을 말하지 않는다 (K8) */
        reason: z.string().trim().min(1).optional(),
      }),
    )
    .default([]),
});
export type Asking = z.infer<typeof AskingSchema>;

/**
 * ⑨ 내밂 — 무엇을 내밀고 무엇을 기억하는가 (Foundation §5.4).
 *
 * **없으면 미답으로 센다.** 앞의 여덟과 달리 이 답에는 기본값이 있다 — 그 자리가 서기 전에 적힌
 * brief 들이 그대로 파싱되어야 하기 때문이다. 그렇다고 통과시키지는 않는다: 기본값이 미답의 꼴이라
 * `unansweredKeys` 가 그것을 세고 T4 의 `pending` 에 오른다 (지어내지 않고 비어 있음을 남기는
 * 규율 그대로 — 검사 아홉의 `absent` 와 같다).
 */
export const OfferingSchema = AnswerSchema.default({
  // 까닭은 한 마디로 선다 — 미답에도 "왜 아직 없는가" 가 달려야 한다는 것이 T2 의 규율이다.
  unanswered: '아직 적지 않았다 — 이 방이 무엇을 내밀고 무엇을 기억하는가',
});

/** 열 답 — 원문 번호 차례다 (asking 이 ⑨~⑫, offering 이 ⑬) */
export const RegionAnswersSchema = z.strictObject({
  distinction: AnswerSchema,
  cause: AnswerSchema,
  dwelling: AnswerSchema,
  danger: AnswerSchema,
  worth: WorthSchema,
  discovery: AnswerSchema,
  opening: AnswerSchema,
  birth: BirthSchema,
  asking: AskingSchema.default({
    // ⑨~⑫ 는 ⑬ 내밂과 같은 자리에 선다 — 그 자리가 서기 전에 적힌 brief 가 그대로 파싱되어야
    // 하기 때문이다. 통과시키는 것은 아니다: 기본값이 미답의 꼴이라 `unansweredKeys` 가 그것을
    // 세고 T4 의 `pending` 에 오른다 (OfferingSchema 가 세운 그 규율 그대로).
    said: { unanswered: '아직 적지 않았다 — 이 방이 무엇을 묻고 그것을 무엇으로 알아내는가' },
    locks: [],
  }),
  offering: OfferingSchema,
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
 *
 * 갈래가 는 까닭 — 설계 경계의 일곱 질문(Foundation §14 · §5.4 가 결정 나무로 옮겨 적었다)이
 * "무엇이 없어서 이 방이 못 서는가" 를 그만큼으로 가르기 때문이다.
 * **어느 갈래가 어느 등급인가는 여기서 정하지 않는다** — 그것은 이 세계의 판단이라 계약이
 * 결정 나무로 건넨다 (T4). 값이 느는 것뿐이라 옛 brief 는 그대로 선다.
 */
export const RequirementSchema = z.strictObject({
  /**
   * rule 이 방만의 규칙 하나 · axis 아직 없는 층의 의미 · contract 공통 계약 중 없는 것 ·
   * fact 세계의 사실(Contents · State · Relation 의 값) · process 스스로 일어나는 변화 ·
   * space 새 공간적 의미 · observation 알게 되는 방식 · persistence 남는 것의 종류
   */
  kind: z.enum([
    'rule',
    'axis',
    'contract',
    'fact',
    'process',
    'space',
    'observation',
    'persistence',
  ]),
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

/** 열 답을 형에 적힌 순서로 — T4 와 보고가 같은 순서로 읊게 하는 유일한 자리 */
export const ANSWER_ORDER = [
  'distinction',
  'cause',
  'dwelling',
  'danger',
  'worth',
  'discovery',
  'opening',
  'birth',
  'asking',
  'offering',
] as const;
export type AnswerKey = (typeof ANSWER_ORDER)[number];

/**
 * 그 질문의 답 하나 — 귀함 · 탄생 · 물음은 딸린 목록을 가지므로 답이 `said` 안에 있다.
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
