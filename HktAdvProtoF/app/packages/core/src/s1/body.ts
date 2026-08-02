// S1-a 신체 원형 — 원문 S1 의 첫 낱말, "종의 신체".
//
// 몸을 무엇으로 적을 것인가. 크기·무게·부위 목록을 마음대로 늘리면 그럴듯해 보이지만,
// 세계에 그것을 적을 자리(O2)가 없으면 아무도 그 값으로 무너지지 않는다 — 장식이 된다.
// 그래서 신체는 **세계에 이미 걸려 있는 두 가지**로만 적는다.
//
//   ① 기관 — 무엇을 여는가. 눈이 있어야 빛이 오고, 코가 있어야 냄새가 온다.
//      기관은 S1-b 감각이 곧바로 소비한다. 아무것도 열지 않는 기관(입·사지)도 적는다 —
//      그것들은 뒤의 계층(P 가능성·C 행동)이 소비할 자리다.
//   ② 생물 영역 자리 — 몸이 있다는 것은 O2 `biological.*` 자리를 갖는다는 뜻이다.
//      허기·체력·독은 몸에 적힌다. 몸이 없으면 그 자리도 없다.
//
// 그래서 갈림은 하나다: **몸이 있는가.** 사람과 생물은 몸으로 세계에 걸리고(S0 BOUNDARY_REQUIREMENTS
// 가 이미 같은 말을 한다), 조직·국가·신은 몸이 없다. 몸이 없는 것들은 굶지 않는다 —
// 창고가 비어서 흩어지고 정당성이 말라서 무너질 뿐이다. 그 차이가 여기서 값으로 못박힌다.
//
// 크기는 여기 없다. 세계에 크기를 적을 자리가 O2 에 없기 때문이다. 거대 마물이 필요해지면
// 먼저 O2 에 자리를 여는 작업 카드를 만든다 — 자리 없는 개념은 S1 이 만들지 않는다 (WORKFLOW §6).

import type { PhenomenonChannel } from '../o1/operation.ts';
import type { SubjectKind } from '../o1/being.ts';
import type { SlotRef, SpeciesDefinition } from '../o0/definition.ts';
import { violateSpecies, type SpeciesRef, type SpeciesViolation } from './violation.ts';

/** 기관 6종 — 종이 가질 수 있는 몸의 부분. */
export const ORGAN_KINDS = [
  'core', // 본체 — 나머지가 붙는 곳. 몸이라면 반드시 있다
  'eye', // 눈
  'ear', // 귀
  'nose', // 코
  'mouth', // 입
  'limb', // 사지
] as const;
export type OrganKind = (typeof ORGAN_KINDS)[number];

/** 기관 하나의 성격 — 무엇을 여는가. */
export interface OrganSpec {
  readonly organ: OrganKind;
  readonly label: string;
  /** 이 기관이 여는 현상 통로 (S1-b 감각이 소비한다) */
  readonly opens: readonly PhenomenonChannel[];
  readonly note: string;
}

export const ORGAN_SPECS: readonly OrganSpec[] = [
  {
    organ: 'core',
    label: '본체',
    opens: [],
    note: '몸의 중심 — 체력·독이 적히는 자리. 이것이 없으면 나머지 기관은 붙을 곳이 없다',
  },
  {
    organ: 'eye',
    label: '눈',
    opens: ['light', 'trace'],
    note: '빛을 받고, 남겨진 것(발자국·파손·사체)을 본다',
  },
  { organ: 'ear', label: '귀', opens: ['sound'], note: '소리를 받는다 — 차폐를 돌아오는 통로' },
  {
    organ: 'nose',
    label: '코',
    opens: ['smell', 'trace'],
    note: '냄새를 받고, 남은 냄새로 흔적을 읽는다',
  },
  {
    organ: 'mouth',
    label: '입',
    opens: [],
    note: '먹고 말한다 — 감각은 열지 않는다. 섭식과 발화는 뒤의 계층(P·C)이 소비한다',
  },
  {
    organ: 'limb',
    label: '사지',
    opens: [],
    note: '옮기고 쥔다 — 감각은 열지 않는다. 이동·채집 가능성의 전제다',
  },
];

/** 몸의 기관 하나. */
export interface BodyOrgan {
  readonly organ: OrganKind;
  /** 몇 벌인가 — 눈 둘, 사지 넷. 1 이상의 정수 */
  readonly count: number;
  /** 이 종에서 그 기관이 무엇인가 — 근거 없는 기관은 몸을 설명하지 못한다 */
  readonly note: string;
}

/** 종의 신체 — 기관의 묶음. 몸 없는 종(조직·국가·신)은 이 값 자체를 갖지 않는다(null). */
export interface BodyPlan {
  readonly organs: readonly BodyOrgan[];
}

/** 기관 한 벌의 최대 개수 — 이보다 많으면 개체가 아니라 군집이다 (군집은 개체군으로 센다). */
export const MAX_ORGAN_COUNT = 1000;

/** 몸으로 세계에 걸리는 주체 종류 — S0 BOUNDARY_REQUIREMENTS 의 body 요구와 같은 말이다. */
export const BODIED_KINDS: readonly SubjectKind[] = ['person', 'creature'];

/** 기관 하나의 성격을 찾는다. */
export function organSpec(organ: OrganKind): OrganSpec | null {
  return ORGAN_SPECS.find((spec) => spec.organ === organ) ?? null;
}

/** 그 종류의 주체는 몸으로 세계에 걸리는가. */
export function isBodiedKind(subjectKind: SubjectKind): boolean {
  return BODIED_KINDS.includes(subjectKind);
}

/** 이 몸이 여는 현상 통로 전부 (기관 선언 순서, 중복 없음). */
export function openedChannels(body: BodyPlan | null): readonly PhenomenonChannel[] {
  if (body === null) return [];
  const out: PhenomenonChannel[] = [];
  for (const organ of body.organs) {
    for (const channel of organSpec(organ.organ)?.opens ?? []) {
      if (!out.includes(channel)) out.push(channel);
    }
  }
  return out;
}

/** 그 통로를 여는 기관이 이 몸에 있는가. 있으면 그 기관, 없으면 null. */
export function organOpening(body: BodyPlan | null, channel: PhenomenonChannel): OrganKind | null {
  if (body === null) return null;
  for (const organ of body.organs) {
    if (organSpec(organ.organ)?.opens.includes(channel) === true) return organ.organ;
  }
  return null;
}

/** 이 몸에 그 기관이 있는가. */
export function hasOrgan(body: BodyPlan | null, organ: OrganKind): boolean {
  return body !== null && body.organs.some((entry) => entry.organ === organ);
}

/** 종 정의에서 O1 SpeciesRef 를 뽑는다. */
export function speciesRef(definition: SpeciesDefinition): SpeciesRef {
  return { id: definition.id, name: definition.name, subjectKind: definition.subjectKind };
}

/** 종 정의가 연 생물 영역 자리들. */
export function biologicalSlots(definition: SpeciesDefinition): readonly SlotRef[] {
  return definition.slots.filter((slot) => slot.domain === 'biological');
}

/**
 * 신체가 이 종에게 온전한가.
 * 몸의 유무는 주체 종류가 정한다 — 사람·생물은 몸으로 걸리고, 조직·국가·신은 몸이 없다.
 */
export function checkBody(
  species: SpeciesRef,
  body: BodyPlan | null,
  definition: SpeciesDefinition,
  out: SpeciesViolation[],
): void {
  const bodied = isBodiedKind(species.subjectKind);
  const biological = biologicalSlots(definition);

  if (body === null) {
    if (bodied) {
      // 생물 자리는 잘못이 없다 — 없는 것은 몸이다. 그 하나만 지목한다.
      violateSpecies(
        out,
        species,
        'bodiless-life',
        '$.body',
        `${species.subjectKind} 은 몸으로 세계에 걸린다 — 허기와 부상이 적힐 몸이 없으면 이 종의 개체는 아무것도 잃지 않는다`,
      );
      return;
    }
    // 몸이 없으면 생물 영역 자리도 없다. 조직은 굶지 않는다 — 창고가 비어서 흩어질 뿐이다.
    for (const slot of biological) {
      violateSpecies(
        out,
        species,
        'bodiless-biology',
        '$.slots',
        `몸 없는 ${species.subjectKind} 이 생물 자리 ${slot.path} 를 열었다 — 몸이 없으면 그 값이 적힐 곳이 없다`,
      );
    }
    return;
  }

  if (!bodied) {
    // 몸을 가질 수 없는 종에게 기관·생물 자리를 따져 봐야 사유가 두 겹으로 쌓일 뿐이다.
    violateSpecies(
      out,
      species,
      'bodied-abstraction',
      '$.body',
      `${species.subjectKind} 에게는 몸이 없다 — 구성원·앵커를 통해 세계에 닿을 뿐이다 (S0 경계 요구와 같은 말이다)`,
    );
    return;
  }

  const seen = new Set<OrganKind>();
  for (const [index, organ] of body.organs.entries()) {
    const path = `$.body.organs[${String(index)}]`;
    const spec = organSpec(organ.organ);
    if (spec === null) {
      violateSpecies(
        out,
        species,
        'unknown-organ',
        `${path}.organ`,
        `기관은 [${ORGAN_KINDS.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(organ.organ)}`,
      );
      continue;
    }
    if (seen.has(organ.organ)) {
      violateSpecies(
        out,
        species,
        'duplicate-organ',
        `${path}.organ`,
        `${spec.label} 이 두 번 선언됐다 — 몇 벌인지는 count 로 적는다`,
      );
      continue;
    }
    seen.add(organ.organ);

    if (
      !Number.isInteger(organ.count) ||
      organ.count < 1 ||
      organ.count > MAX_ORGAN_COUNT
    ) {
      violateSpecies(
        out,
        species,
        'bad-organ',
        `${path}.count`,
        `${spec.label} 의 개수는 1~${String(MAX_ORGAN_COUNT)} 의 정수여야 한다 — ${String(organ.count)}`,
      );
    }
    if (organ.note === '') {
      violateSpecies(
        out,
        species,
        'bad-organ',
        `${path}.note`,
        `${spec.label} 이 이 종에서 무엇인지 적지 않았다 — 근거 없는 기관은 몸을 설명하지 못한다`,
      );
    }
  }

  if (!seen.has('core')) {
    violateSpecies(
      out,
      species,
      'coreless-body',
      '$.body.organs',
      '본체 없는 몸은 몸이 아니다 — 체력과 독이 적힐 중심이 있어야 나머지 기관이 붙는다',
    );
  }
  if (biological.length === 0) {
    violateSpecies(
      out,
      species,
      'fleshless-body',
      '$.slots',
      '몸이 있는데 생물 영역 자리를 하나도 열지 않았다 — 깎이지 않는 몸은 몸이 아니다',
    );
  }
}

/** 신체를 한 줄로 접는다 — 종 카드용. */
export function bodySummary(body: BodyPlan | null): string {
  if (body === null) return '몸이 없다';
  return body.organs
    .map(
      (organ) =>
        `${organSpec(organ.organ)?.label ?? organ.organ}${organ.count > 1 ? `×${String(organ.count)}` : ''}`,
    )
    .join(' · ');
}
