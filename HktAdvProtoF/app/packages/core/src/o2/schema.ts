// O2-b 상태 스키마 — 9영역이 실제로 어떤 자리를 갖는지 한 곳에 적는다.
//
// 이 카탈로그가 "세계에 놓일 수 있는 값" 의 전부다. 여기 없는 자리에 값을 놓으면 거부된다.
// 원문 §12.1 은 영역마다 필드를 말로 나열했다(위치·속도·온도…). 그 말 하나하나가
// 어느 경로로 적히는지는 ORIGINAL_FIELDS 가 대조한다 — O1-e 개념 커버리지와 같은 태도다:
// 원문에 있는데 스키마에 없는 것이 남으면 그 사실이 값으로 드러난다.
//
// 새 필드를 더할 때: 카탈로그에 한 줄 + 원문 근거를 note 에. 원문에 없는 필드는
// 어느 계층이 왜 요구하는지 note 에 적는다 (근거 없는 자리는 세계를 넓히지 않는다).

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { State } from '../o1/being.ts';
import {
  DOMAIN_SPECS,
  STATE_DOMAINS,
  isStateDomain,
  type DomainSpec,
  type StateDomain,
} from './domain.ts';
import {
  checkFieldSpec,
  checkHolder,
  checkValue,
  matchPath,
  parameterKind,
  pathSegments,
  type FieldSpec,
  type PathMatch,
  type SchemaViolation,
} from './field.ts';

/** 9영역 필드 트리 — 영역 정의 + 그 안의 자리들. */
export interface StateSchema {
  readonly domains: readonly DomainSpec[];
  readonly fields: readonly FieldSpec[];
}

/** 물리 — 위치·속도·온도·구조 안정성·물질 구성·파손·차폐 + spatial 흡수분(거리). */
const PHYSICAL_FIELDS: readonly FieldSpec[] = [
  {
    domain: 'physical',
    path: 'region',
    label: '소재 지역',
    holder: 'any',
    value: { type: 'ref', idKind: 'entity' },
    note: '어느 장소에 있는가 — 원문 §12.1 위치. 장소 자신은 이 값을 갖지 않는다',
  },
  {
    domain: 'physical',
    path: 'position.x',
    label: '위치 x',
    holder: 'any',
    value: { type: 'number', min: -1000000, max: 1000000, unit: 'm' },
    note: '지역 안의 좌표 — 원문 §12.1 위치',
  },
  {
    domain: 'physical',
    path: 'position.y',
    label: '위치 y',
    holder: 'any',
    value: { type: 'number', min: -1000000, max: 1000000, unit: 'm' },
    note: '지역 안의 좌표 — 원문 §12.1 위치',
  },
  {
    domain: 'physical',
    path: 'speed',
    label: '속도',
    holder: 'any',
    value: { type: 'number', min: 0, max: 1000, unit: 'm/틱' },
    note: '원문 §12.1 속도',
  },
  {
    domain: 'physical',
    path: 'temperature',
    label: '온도',
    holder: 'any',
    value: { type: 'number', min: -273.15, max: 5000, unit: '°C' },
    note: '원문 §12.1 온도. 절대 영도 아래는 없다',
  },
  {
    domain: 'physical',
    path: 'integrity',
    label: '구조 안정성',
    holder: 'any',
    value: { type: 'ratio' },
    note: '원문 §12.1 구조적 안정성. 0 이면 무너진 것이다',
  },
  {
    domain: 'physical',
    path: 'material',
    label: '물질 구성',
    holder: 'any',
    value: { type: 'ref', idKind: 'entity' },
    note: '무엇으로 이루어졌는가 — 원문 §12.1 물질 구성',
  },
  {
    domain: 'physical',
    path: 'broken',
    label: '파손',
    holder: 'any',
    value: { type: 'flag' },
    note: '원문 §12.1 파손',
  },
  {
    domain: 'physical',
    path: 'cover',
    label: '차폐',
    holder: 'any',
    value: { type: 'ratio' },
    note: '원문 §12.1 차폐. 관측·타격이 얼마나 막히는가',
  },
  {
    domain: 'physical',
    path: 'distance.{entity}',
    label: '장소 간 거리',
    holder: 'entity',
    value: { type: 'number', min: 0, max: 1000000, unit: 'm' },
    note: 'spatial 영역 흡수분 (O2-a) — 장소 사이의 거리는 물리 값이다',
  },
];

/** 생물 — 체력·대사·허기·질병·독성·번식·성장 단계·변이. */
const BIOLOGICAL_FIELDS: readonly FieldSpec[] = [
  {
    domain: 'biological',
    path: 'vitality',
    label: '체력',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 체력',
  },
  {
    domain: 'biological',
    path: 'metabolism',
    label: '대사',
    holder: 'subject',
    value: { type: 'number', min: 0, max: 10, unit: '배' },
    note: '원문 §12.1 대사. 1 이 종의 기준 속도다',
  },
  {
    domain: 'biological',
    path: 'hunger',
    label: '허기',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 허기. D 계층 의존 압력의 입력이 된다',
  },
  {
    domain: 'biological',
    path: 'disease.{entity}',
    label: '질병 진행도',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 질병. 병원체를 Entity 로 적고 개체별 진행도를 둔다',
  },
  {
    domain: 'biological',
    path: 'toxin',
    label: '독의 종류',
    holder: 'any',
    value: { type: 'enum', options: ['없음', '마비독', '출혈독', '신경독', '부식독'] },
    note: '원문 §12.1 독성. 약초·사체도 독을 품으므로 주체에 한정하지 않는다',
  },
  {
    domain: 'biological',
    path: 'toxicity',
    label: '독성 세기',
    holder: 'any',
    value: { type: 'ratio' },
    note: '원문 §12.1 독성의 세기 — 종류(toxin)와 세기를 나눠 적는다',
  },
  {
    domain: 'biological',
    path: 'fertility',
    label: '번식력',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 번식',
  },
  {
    domain: 'biological',
    path: 'growthStage',
    label: '성장 단계',
    holder: 'any',
    value: { type: 'enum', options: ['씨', '유체', '성체', '노체'] },
    note: '원문 §12.1 성장 단계',
  },
  {
    domain: 'biological',
    path: 'mutation.{rule}',
    label: '변이 발현도',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 변이. 변이는 그 개체에 붙은 Rule 이고, 여기 적히는 것은 발현 정도다',
  },
];

/** 생태 — 개체군·서식지·먹이사슬·수용력·고갈. */
const ECOLOGICAL_FIELDS: readonly FieldSpec[] = [
  {
    domain: 'ecological',
    path: 'population',
    label: '개체군',
    holder: 'any',
    value: { type: 'number', min: 0, max: 1000000000, integer: true, unit: '개체' },
    note: 'ModulePlan O2 생태 상태. 종(Subject)의 수이자 지역(Entity)의 서식 수',
  },
  {
    domain: 'ecological',
    path: 'habitat',
    label: '서식지',
    holder: 'subject',
    value: { type: 'ref', idKind: 'entity' },
    note: 'ModulePlan O2 생태 상태 — 어디에 사는가 (지금 어디 있는가는 physical.region)',
  },
  {
    domain: 'ecological',
    path: 'preysOn.{subject}',
    label: '포식 압력',
    holder: 'subject',
    value: { type: 'ratio' },
    note: 'ModulePlan O2 생태 상태 — 먹이사슬. MasterPlan §20 생태 연쇄의 입력',
  },
  {
    domain: 'ecological',
    path: 'carryingCapacity',
    label: '수용력',
    holder: 'entity',
    value: { type: 'number', min: 0, max: 1000000000, integer: true, unit: '개체' },
    note: 'ModulePlan O2 생태 상태 — 지역이 먹여 살릴 수 있는 수',
  },
  {
    domain: 'ecological',
    path: 'depletion',
    label: '고갈도',
    holder: 'entity',
    value: { type: 'ratio' },
    note: 'ModulePlan O2 생태 상태 — 자원이 얼마나 바닥났는가',
  },
];

/** 관계 — 신뢰·공포·존경·의존·원한·빚·소속. 전부 "누구에 대한" 값이다. */
const RELATIONAL_FIELDS: readonly FieldSpec[] = [
  {
    domain: 'relational',
    path: 'trust.{subject}',
    label: '신뢰',
    holder: 'subject',
    value: { type: 'signed' },
    note: '원문 §12.1 신뢰. 불신(-)과 신뢰(+)가 한 축에 있다',
  },
  {
    domain: 'relational',
    path: 'fear.{subject}',
    label: '공포',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 공포',
  },
  {
    domain: 'relational',
    path: 'respect.{subject}',
    label: '존경',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 존경',
  },
  {
    domain: 'relational',
    path: 'reliance.{subject}',
    label: '의존',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 의존 — 관계로서의 의존. D 계층 DependencyNode 와는 다른 것이다',
  },
  {
    domain: 'relational',
    path: 'grudge.{subject}',
    label: '원한',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 원한. 지나간 사건이 지금 남긴 값 — historical 을 영역으로 두지 않는 이유다',
  },
  {
    domain: 'relational',
    path: 'debt.{subject}',
    label: '빚',
    holder: 'subject',
    value: { type: 'number', min: 0, max: 1000000000, unit: '단위' },
    note: '원문 §12.1 빚',
  },
  {
    domain: 'relational',
    path: 'belongsTo.{subject}',
    label: '소속',
    holder: 'subject',
    value: { type: 'flag' },
    note: '원문 §12.1 소속 — 조직·국가에 속하는가',
  },
];

/** 제도 — 법·자격·통행권·현상금·금지 물품·외교 관계. */
const INSTITUTIONAL_FIELDS: readonly FieldSpec[] = [
  {
    domain: 'institutional',
    path: 'law.{rule}',
    label: '법 발효',
    holder: 'any',
    value: { type: 'flag' },
    note: '원문 §12.1 법. 법은 Rule 이고, 여기 적히는 것은 그 법이 여기서 서 있는가다',
  },
  {
    domain: 'institutional',
    path: 'license.{rule}',
    label: '자격',
    holder: 'subject',
    value: { type: 'flag' },
    note: '원문 §12.1 자격',
  },
  {
    domain: 'institutional',
    path: 'passage.{entity}',
    label: '통행권',
    holder: 'subject',
    value: { type: 'flag' },
    note: '원문 §12.1 통행권 — 그 장소를 지날 권리',
  },
  {
    domain: 'institutional',
    path: 'bounty',
    label: '현상금',
    holder: 'subject',
    value: { type: 'number', min: 0, max: 1000000000, unit: '단위' },
    note: '원문 §12.1 현상금',
  },
  {
    domain: 'institutional',
    path: 'contraband.{entity}',
    label: '금지 물품',
    holder: 'any',
    value: { type: 'flag' },
    note: '원문 §12.1 금지 물품 — 어느 제도 아래에서 무엇이 금지되는가',
  },
  {
    domain: 'institutional',
    path: 'diplomacy.{subject}',
    label: '외교 관계',
    holder: 'subject',
    value: { type: 'signed' },
    note: '원문 §12.1 외교 관계. 적대(-)와 동맹(+)이 한 축에 있다',
  },
];

/** 경제 — 재고·가격·수요·유통량. */
const ECONOMIC_FIELDS: readonly FieldSpec[] = [
  {
    domain: 'economic',
    path: 'stock.{entity}',
    label: '재고',
    holder: 'any',
    value: { type: 'number', min: 0, max: 1000000000, unit: '개' },
    note: 'ModulePlan O2 경제 상태 — 누가·어디가 무엇을 얼마나 갖고 있는가',
  },
  {
    domain: 'economic',
    path: 'price.{entity}',
    label: '가격',
    holder: 'any',
    value: { type: 'number', min: 0, max: 1000000000, unit: '단위' },
    note: 'ModulePlan O2 경제 상태 — 그 자리에서 매겨진 값',
  },
  {
    domain: 'economic',
    path: 'demand.{entity}',
    label: '수요',
    holder: 'any',
    value: { type: 'ratio' },
    note: 'ModulePlan O2 경제 상태',
  },
  {
    domain: 'economic',
    path: 'flow.{entity}',
    label: '유통량',
    holder: 'entity',
    value: { type: 'number', min: 0, max: 1000000000, unit: '개/틱' },
    note: 'ModulePlan O2 경제 상태 — 경로를 지나는 양',
  },
];

/** 정보 — 누가 무엇을 아는가·확실성·출처·소문 전파·거짓 정보·비밀. 대상은 Claim 이다. */
const INFORMATIONAL_FIELDS: readonly FieldSpec[] = [
  {
    domain: 'informational',
    path: 'knows.{claim}',
    label: '앎',
    holder: 'subject',
    value: { type: 'flag' },
    note: '원문 §12.1 누가 무엇을 아는가. 아는 대상은 O1 Claim — 사실이 아니라 주장이다',
  },
  {
    domain: 'informational',
    path: 'certainty.{claim}',
    label: '확실성',
    holder: 'subject',
    value: { type: 'ratio' },
    note: '원문 §12.1 정보의 확실성 — 확신은 진실성이 아니다',
  },
  {
    domain: 'informational',
    path: 'sourceOf.{claim}',
    label: '정보 출처',
    holder: 'subject',
    value: { type: 'ref', idKind: 'subject' },
    note: '원문 §12.1 정보의 출처 — 누구에게서 들었는가',
  },
  {
    domain: 'informational',
    path: 'rumorSpread.{claim}',
    label: '소문 전파',
    holder: 'any',
    value: { type: 'ratio' },
    note: '원문 §12.1 소문 전파 — 지역에도 퍼진다',
  },
  {
    domain: 'informational',
    path: 'falsehood.{claim}',
    label: '거짓 정보',
    holder: 'any',
    value: { type: 'flag' },
    note: '원문 §12.1 거짓 정보 — 세계가 아는 진위. 주체의 믿음(certainty)과 어긋날 수 있다',
  },
  {
    domain: 'informational',
    path: 'secret.{claim}',
    label: '비밀',
    holder: 'subject',
    value: { type: 'flag' },
    note: '원문 §12.1 비밀 — 알지만 말하지 않는가',
  },
];

/** 의념 — 에너지·활성 효과·조건 충족·능력 흔적·영역 간섭 + 신념 압력 (ability 흡수, O2-a). */
const PSYCHIC_FIELDS: readonly FieldSpec[] = [
  {
    domain: 'psychic',
    path: 'energy',
    label: '의념 에너지',
    holder: 'subject',
    value: { type: 'number', min: 0, max: 1000000, unit: '념' },
    note: '원문 §12.1 능력 상태의 에너지 (ability→psychic 흡수)',
  },
  {
    domain: 'psychic',
    path: 'activeEffect.{rule}',
    label: '활성 효과',
    holder: 'any',
    value: { type: 'flag' },
    note: '원문 §12.1 활성 효과 — 능력은 Rule 이고, 지금 걸려 있는가를 적는다',
  },
  {
    domain: 'psychic',
    path: 'conditionMet.{rule}',
    label: '조건 충족',
    holder: 'subject',
    value: { type: 'flag' },
    note: '원문 §12.1 조건 충족 여부 — 제약이 지금 만족되는가',
  },
  {
    domain: 'psychic',
    path: 'trace.{rule}',
    label: '능력 흔적',
    holder: 'any',
    value: { type: 'ratio' },
    note: 'O0 공리 "모든 능력은 관찰 가능한 흔적을 남긴다" — 흔적 없는 능력은 세계에 설 수 없다',
  },
  {
    domain: 'psychic',
    path: 'interference.{entity}',
    label: '영역 간섭',
    holder: 'any',
    value: { type: 'ratio' },
    note: '원문 §12.1 영역 간섭 — 그 장소에서 능력이 얼마나 뒤틀리는가',
  },
  {
    domain: 'psychic',
    path: 'conviction',
    label: '신념 압력',
    holder: 'subject',
    value: { type: 'ratio' },
    note: 'ModulePlan O2 의념 상태 — O0 공리 "생명은 의념을 발생시킨다" 의 값',
  },
];

/** 초월 — 앵커·신역·정당성·숭배량. */
const TRANSCENDENT_FIELDS: readonly FieldSpec[] = [
  {
    domain: 'transcendent',
    path: 'anchor',
    label: '앵커',
    holder: 'subject',
    value: { type: 'ref', idKind: 'entity' },
    note: 'ModulePlan O2 초월 상태 — 신적 주체가 세계에 붙어 있는 자리 (C 계층이 옮긴다)',
  },
  {
    domain: 'transcendent',
    path: 'divineDomain.{entity}',
    label: '신역 강도',
    holder: 'subject',
    value: { type: 'ratio' },
    note: 'ModulePlan O2 초월 상태 — 그 장소에 미치는 힘',
  },
  {
    domain: 'transcendent',
    path: 'legitimacy',
    label: '정당성',
    holder: 'subject',
    value: { type: 'ratio' },
    note: 'ModulePlan O2 초월 상태 — 세계가 그 존재를 인정하는 정도',
  },
  {
    domain: 'transcendent',
    path: 'worship',
    label: '숭배량',
    holder: 'subject',
    value: { type: 'number', min: 0, max: 1000000000000, unit: '기원' },
    note: 'ModulePlan O2 초월 상태 — 집단의 반복 행동이 쌓인 양 (O0 공리: 신적 주체의 발생)',
  },
];

/** 9영역 필드 트리 — 세계에 놓일 수 있는 값의 전부. */
export const STATE_SCHEMA: StateSchema = {
  domains: DOMAIN_SPECS,
  fields: [
    ...PHYSICAL_FIELDS,
    ...BIOLOGICAL_FIELDS,
    ...ECOLOGICAL_FIELDS,
    ...RELATIONAL_FIELDS,
    ...INSTITUTIONAL_FIELDS,
    ...ECONOMIC_FIELDS,
    ...INFORMATIONAL_FIELDS,
    ...PSYCHIC_FIELDS,
    ...TRANSCENDENT_FIELDS,
  ],
};

/** 원문이 말로 나열한 상태 필드 하나 ↔ 스키마 경로. */
export interface OriginalField {
  /** 원문이 쓴 말 */
  readonly name: string;
  readonly domain: StateDomain;
  /** 원문 위치 */
  readonly source: string;
  /** 이 말이 적히는 스키마 경로 (하나 이상) */
  readonly paths: readonly string[];
}

/**
 * MasterPlan §12.1 본문이 영역별로 나열한 필드 39개.
 * 이 목록이 스키마에 다 실리지 않으면 "원문에 있는데 세계에 없는 값" 이 남는다.
 * (§12.1 은 생태·경제·초월 영역의 세부 목록을 적지 않았다 — 그 영역들은 ModulePlan O2 근거로 선다.)
 */
export const ORIGINAL_FIELDS: readonly OriginalField[] = [
  { name: '위치', domain: 'physical', source: 'MasterPlan §12.1 물리 상태', paths: ['region', 'position.x', 'position.y'] },
  { name: '속도', domain: 'physical', source: 'MasterPlan §12.1 물리 상태', paths: ['speed'] },
  { name: '온도', domain: 'physical', source: 'MasterPlan §12.1 물리 상태', paths: ['temperature'] },
  { name: '구조적 안정성', domain: 'physical', source: 'MasterPlan §12.1 물리 상태', paths: ['integrity'] },
  { name: '물질 구성', domain: 'physical', source: 'MasterPlan §12.1 물리 상태', paths: ['material'] },
  { name: '파손', domain: 'physical', source: 'MasterPlan §12.1 물리 상태', paths: ['broken'] },
  { name: '차폐', domain: 'physical', source: 'MasterPlan §12.1 물리 상태', paths: ['cover'] },

  { name: '체력', domain: 'biological', source: 'MasterPlan §12.1 생물 상태', paths: ['vitality'] },
  { name: '대사', domain: 'biological', source: 'MasterPlan §12.1 생물 상태', paths: ['metabolism'] },
  { name: '허기', domain: 'biological', source: 'MasterPlan §12.1 생물 상태', paths: ['hunger'] },
  { name: '질병', domain: 'biological', source: 'MasterPlan §12.1 생물 상태', paths: ['disease.{entity}'] },
  { name: '독성', domain: 'biological', source: 'MasterPlan §12.1 생물 상태', paths: ['toxin', 'toxicity'] },
  { name: '번식', domain: 'biological', source: 'MasterPlan §12.1 생물 상태', paths: ['fertility'] },
  { name: '성장 단계', domain: 'biological', source: 'MasterPlan §12.1 생물 상태', paths: ['growthStage'] },
  { name: '변이', domain: 'biological', source: 'MasterPlan §12.1 생물 상태', paths: ['mutation.{rule}'] },

  { name: '에너지', domain: 'psychic', source: 'MasterPlan §12.1 능력 상태 (→의념)', paths: ['energy'] },
  { name: '활성 효과', domain: 'psychic', source: 'MasterPlan §12.1 능력 상태 (→의념)', paths: ['activeEffect.{rule}'] },
  { name: '조건 충족 여부', domain: 'psychic', source: 'MasterPlan §12.1 능력 상태 (→의념)', paths: ['conditionMet.{rule}'] },
  { name: '능력 흔적', domain: 'psychic', source: 'MasterPlan §12.1 능력 상태 (→의념)', paths: ['trace.{rule}'] },
  { name: '영역 간섭', domain: 'psychic', source: 'MasterPlan §12.1 능력 상태 (→의념)', paths: ['interference.{entity}'] },

  { name: '신뢰', domain: 'relational', source: 'MasterPlan §12.1 관계 상태', paths: ['trust.{subject}'] },
  { name: '공포', domain: 'relational', source: 'MasterPlan §12.1 관계 상태', paths: ['fear.{subject}'] },
  { name: '존경', domain: 'relational', source: 'MasterPlan §12.1 관계 상태', paths: ['respect.{subject}'] },
  { name: '의존', domain: 'relational', source: 'MasterPlan §12.1 관계 상태', paths: ['reliance.{subject}'] },
  { name: '원한', domain: 'relational', source: 'MasterPlan §12.1 관계 상태', paths: ['grudge.{subject}'] },
  { name: '빚', domain: 'relational', source: 'MasterPlan §12.1 관계 상태', paths: ['debt.{subject}'] },
  { name: '소속', domain: 'relational', source: 'MasterPlan §12.1 관계 상태', paths: ['belongsTo.{subject}'] },

  { name: '법', domain: 'institutional', source: 'MasterPlan §12.1 제도 상태', paths: ['law.{rule}'] },
  { name: '자격', domain: 'institutional', source: 'MasterPlan §12.1 제도 상태', paths: ['license.{rule}'] },
  { name: '통행권', domain: 'institutional', source: 'MasterPlan §12.1 제도 상태', paths: ['passage.{entity}'] },
  { name: '현상금', domain: 'institutional', source: 'MasterPlan §12.1 제도 상태', paths: ['bounty'] },
  { name: '금지 물품', domain: 'institutional', source: 'MasterPlan §12.1 제도 상태', paths: ['contraband.{entity}'] },
  { name: '외교 관계', domain: 'institutional', source: 'MasterPlan §12.1 제도 상태', paths: ['diplomacy.{subject}'] },

  { name: '누가 무엇을 아는가', domain: 'informational', source: 'MasterPlan §12.1 정보 상태', paths: ['knows.{claim}'] },
  { name: '정보의 확실성', domain: 'informational', source: 'MasterPlan §12.1 정보 상태', paths: ['certainty.{claim}'] },
  { name: '정보의 출처', domain: 'informational', source: 'MasterPlan §12.1 정보 상태', paths: ['sourceOf.{claim}'] },
  { name: '소문 전파', domain: 'informational', source: 'MasterPlan §12.1 정보 상태', paths: ['rumorSpread.{claim}'] },
  { name: '거짓 정보', domain: 'informational', source: 'MasterPlan §12.1 정보 상태', paths: ['falsehood.{claim}'] },
  { name: '비밀', domain: 'informational', source: 'MasterPlan §12.1 정보 상태', paths: ['secret.{claim}'] },
];

/** 한 영역의 자리들. */
export function fieldsOf(schema: StateSchema, domain: StateDomain): readonly FieldSpec[] {
  return schema.fields.filter((field) => field.domain === domain);
}

/** 실제 경로가 어느 자리인가. 없으면 null. */
export function lookupField(
  schema: StateSchema,
  domain: StateDomain,
  path: string,
): PathMatch | null {
  for (const spec of schema.fields) {
    if (spec.domain !== domain) continue;
    const params = matchPath(spec.path, path);
    if (params !== null) return { spec, params };
  }
  return null;
}

/**
 * 경로가 자리의 **모양**만 맞는가 (조각 수와 고정 조각이 같다).
 * 매개 자리에 엉뚱한 것이 들어왔을 때 `unknown-path` 대신 그 사실을 말해 주기 위한 것이다.
 */
function shapeMatch(spec: FieldSpec, path: string): { readonly expected: string; readonly actual: string } | null {
  const wanted = pathSegments(spec.path);
  const given = pathSegments(path);
  if (wanted.length !== given.length) return null;

  let mismatch: { expected: string; actual: string } | null = null;
  for (let index = 0; index < wanted.length; index += 1) {
    const segment = wanted[index] as string;
    const actual = given[index] as string;
    const kind = parameterKind(segment);
    if (kind === null) {
      if (segment !== actual) return null;
    } else if (mismatch === null) {
      mismatch = { expected: kind, actual };
    }
  }
  return mismatch;
}

/** 세계 트리 안의 자리 이름 — 위반 메시지와 화면이 같은 문자열을 쓴다. */
export function whereOf(state: Pick<State, 'domain' | 'ofId' | 'path'>): string {
  return `${state.domain}.${state.ofId}.${state.path}`;
}

/**
 * State 하나가 스키마에 맞는가.
 * O1 이 이미 "State 로서 온전한가" 를 봤으므로, 여기서는 "세계에 그런 자리가 있는가" 만 본다.
 */
export function checkAgainstSchema(schema: StateSchema, state: State): readonly SchemaViolation[] {
  const where = whereOf(state);
  const out: SchemaViolation[] = [];

  if (!isStateDomain(state.domain)) {
    out.push({
      rule: 'unknown-domain',
      where,
      stateId: state.id,
      message: `${String(state.domain)} 은 확정 9영역에 없다 — [${STATE_DOMAINS.join(' ')}]`,
    });
    return out;
  }

  const found = lookupField(schema, state.domain, state.path);
  if (found === null) {
    // 모양은 맞는데 매개 자리가 틀린 경우를 먼저 말해 준다.
    for (const spec of fieldsOf(schema, state.domain)) {
      const mismatch = shapeMatch(spec, state.path);
      if (mismatch === null) continue;
      out.push({
        rule: 'bad-parameter',
        where,
        stateId: state.id,
        message: `${spec.path} 의 매개 자리에는 ${mismatch.expected} 종류의 V1 ID 가 와야 한다 — ${JSON.stringify(mismatch.actual)}`,
      });
      return out;
    }
    out.push({
      rule: 'unknown-path',
      where,
      stateId: state.id,
      message: `${state.domain} 영역에 ${JSON.stringify(state.path)} 자리가 없다`,
    });
    return out;
  }

  const holderReason = checkHolder(found.spec.holder, state.ofId);
  if (holderReason !== null) {
    out.push({ rule: 'bad-holder', where, stateId: state.id, message: `${found.spec.label} — ${holderReason}` });
  }

  const valueReason = checkValue(found.spec.value, state.value);
  if (valueReason !== null) {
    out.push({
      rule: valueReason.rule,
      where,
      stateId: state.id,
      message: `${found.spec.label} — ${valueReason.message}`,
    });
  }

  return out;
}

/** 스키마 자신이 온전한가 — 원문을 다 담았고, 빈 영역·중복 자리·결함 스펙이 없는가. */
export interface SchemaReport {
  readonly totalFields: number;
  /** 영역별 자리 수 (STATE_DOMAINS 순서) */
  readonly byDomain: Readonly<Record<StateDomain, number>>;
  /** 자리가 하나도 없는 영역 — 이름만 있는 영역이다 */
  readonly emptyDomains: readonly StateDomain[];
  /** 같은 `영역.경로` 를 두 번 적었다 */
  readonly duplicatePaths: readonly string[];
  /** 스펙 자신이 어긴 것 (`영역.경로 → 사유`) */
  readonly badSpecs: readonly string[];
  /** 스키마 경로가 하나도 없는 원문 필드 */
  readonly unmappedOriginals: readonly string[];
  /** 원문 필드가 가리키는데 스키마에 없는 경로 (`원문 필드→경로`) */
  readonly danglingOriginals: readonly string[];
  /** 어느 원문 필드도 가리키지 않는 자리 — 원문 밖에서 늘어난 자리다 (근거는 note 에) */
  readonly extraPaths: readonly string[];
  readonly complete: boolean;
}

/** 스키마를 원문 필드 목록에 대조한다. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function schemaReport(
  schema: StateSchema = STATE_SCHEMA,
  originals: readonly OriginalField[] = ORIGINAL_FIELDS,
): SchemaReport {
  const byDomain = Object.fromEntries(
    STATE_DOMAINS.map((domain) => [domain, fieldsOf(schema, domain).length]),
  ) as Record<StateDomain, number>;

  const keys = schema.fields.map((field) => `${field.domain}.${field.path}`);
  const duplicatePaths = stableSort(
    keys.filter((key, index) => keys.indexOf(key) !== index),
    compareStrings,
  );

  const badSpecs: string[] = [];
  for (const field of schema.fields) {
    for (const reason of checkFieldSpec(field)) {
      badSpecs.push(`${field.domain}.${field.path} → ${reason}`);
    }
  }

  const unmappedOriginals: string[] = [];
  const danglingOriginals: string[] = [];
  const claimed = new Set<string>();
  for (const original of originals) {
    if (original.paths.length === 0) {
      unmappedOriginals.push(original.name);
      continue;
    }
    for (const path of original.paths) {
      const key = `${original.domain}.${path}`;
      if (keys.includes(key)) claimed.add(key);
      else danglingOriginals.push(`${original.name}→${key}`);
    }
  }

  const extraPaths = stableSort(
    keys.filter((key) => !claimed.has(key)),
    compareStrings,
  );
  const emptyDomains = STATE_DOMAINS.filter((domain) => byDomain[domain] === 0);

  return {
    totalFields: schema.fields.length,
    byDomain,
    emptyDomains,
    duplicatePaths,
    badSpecs,
    unmappedOriginals,
    danglingOriginals,
    extraPaths,
    complete:
      schema.fields.length > 0 &&
      emptyDomains.length === 0 &&
      duplicatePaths.length === 0 &&
      badSpecs.length === 0 &&
      unmappedOriginals.length === 0 &&
      danglingOriginals.length === 0,
  };
}

/** 스키마 판정을 한 줄로 접는다. */
export function schemaVerdict(report: SchemaReport): string {
  if (report.complete) {
    return `9영역 ${String(report.totalFields)}자리 — 원문 필드가 전부 자리를 얻었다 (원문 밖 자리 ${String(report.extraPaths.length)})`;
  }
  const reasons: string[] = [];
  if (report.totalFields === 0) reasons.push('자리가 하나도 없다');
  if (report.emptyDomains.length > 0) reasons.push(`빈 영역 ${report.emptyDomains.join(', ')}`);
  if (report.duplicatePaths.length > 0) reasons.push(`두 번 적힌 자리 ${report.duplicatePaths.join(', ')}`);
  if (report.badSpecs.length > 0) reasons.push(`결함 스펙 ${report.badSpecs.join(' / ')}`);
  if (report.unmappedOriginals.length > 0) {
    reasons.push(`자리 없는 원문 필드 ${report.unmappedOriginals.join(', ')}`);
  }
  if (report.danglingOriginals.length > 0) {
    reasons.push(`빗나간 대조 ${report.danglingOriginals.join(', ')}`);
  }
  return reasons.join(' · ');
}
