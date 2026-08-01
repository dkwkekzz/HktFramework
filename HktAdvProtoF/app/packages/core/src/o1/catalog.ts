// O1-e 개념 카탈로그 — 원문(design/Design-MasterPlan.md)이 세계를 서술할 때 쓴 개념들.
//
// O1 의 검증 조항은 하나다: "원래 설계의 모든 개념이 하나 이상의 존재론 타입으로
// 표현되어야 한다." 그 "모든 개념" 을 말로 두면 검사할 수 없으므로 목록으로 고정한다.
// 여기 없는 개념은 검사되지 않는다 — 원문을 다시 읽을 때마다 이 목록이 늘어난다.
//
// 담는 것: 세계를 이루는 개념 (무엇이 있고, 어떻게 굴러가고, 무엇이 청구되는가).
// 담지 않는 것: 제작 도구·아키텍처 (§16 기술 구성, §22 AI 역할, §25 도구 화면) —
//               세계의 원소가 아니라 세계를 만드는 사람의 도구다.

import type { ConceptEntry } from './coverage.ts';

/** 원문 개념 ↔ 존재론 12타입 대응표. */
export const CONCEPT_CATALOG: readonly ConceptEntry[] = [
  // ── 세계관과 규칙 계층 ────────────────────────────────────────────────────
  {
    id: 'worldview-seed',
    concept: '세계관 시드 (WorldviewSeed)',
    source: 'MasterPlan §3.1',
    kinds: ['Rule', 'State'],
    note: '존재 전제·중심 갈등은 규칙으로, 매체·미지 영역은 세계 상태로 놓인다',
  },
  {
    id: 'universal-invariant',
    concept: '1계층 절대 불변 규칙 (변화에는 비용이 필요하다)',
    source: 'MasterPlan §3.2',
    kinds: ['Rule'],
    note: '모든 존재에 적용되는 조건→효과 서술',
  },
  {
    id: 'ecology-rule',
    concept: '2계층 자연·생태 규칙 (포식·번식·독성·기후)',
    source: 'MasterPlan §3.2',
    kinds: ['Rule'],
    note: 'domain = ecological/biological 인 규칙',
  },
  {
    id: 'species-rule',
    concept: '3계층 종 특화 규칙 (감각·집단 행동·초자연 접근)',
    source: 'MasterPlan §3.2',
    kinds: ['Rule', 'Affordance'],
    note: '종에 걸린 규칙과, 그 종에게만 열리는 행동 가능성',
  },
  {
    id: 'institution-rule',
    concept: '4계층 문명·제도 규칙 (화폐·법·국경·자격·계약·금기)',
    source: 'MasterPlan §3.2',
    kinds: ['Rule', 'Commitment'],
    note: '제도는 규칙이고, 제도 아래 개별 계약은 약속이다',
  },
  {
    id: 'region-rule',
    concept: '5계층 지역 규칙 (기억을 잃게 하는 안개, 밤에만 열리는 통로)',
    source: 'MasterPlan §3.2',
    kinds: ['Rule', 'Entity'],
    note: '규칙이 걸리는 범위가 place Entity 다',
  },

  // ── 종과 주체 ────────────────────────────────────────────────────────────
  {
    id: 'species-definition',
    concept: '종 정의 (SpeciesDefinition)',
    source: 'MasterPlan §4.1',
    kinds: ['Subject', 'Dependency', 'Affordance'],
    note: '신체·생애는 주체 원형, innateNeeds 는 의존, capabilityGrammar 는 어포던스',
  },
  {
    id: 'body-model',
    concept: '신체 모델과 기관 (bodyModel)',
    source: 'MasterPlan §4.1',
    kinds: ['Entity', 'State'],
    note: '기관은 organ Entity, 체력·대사는 biological State',
  },
  {
    id: 'perception-channel',
    concept: '감각 채널 (perceptionChannels)',
    source: 'MasterPlan §4.1',
    kinds: ['State', 'Phenomenon'],
    note: '감지 가능한 통로 = 어떤 채널의 현상을 받을 수 있는가',
  },
  {
    id: 'innate-need',
    concept: '선천적 필요 (innateNeeds)',
    source: 'MasterPlan §4.1',
    kinds: ['Dependency'],
    note: '종이 태어날 때부터 지는 의존',
  },
  {
    id: 'innate-fear',
    concept: '선천적 두려움 (innateFears)',
    source: 'MasterPlan §4.1',
    kinds: ['State', 'Claim'],
    note: '기피 성향은 상태, "그것이 위험하다" 는 주장',
  },
  {
    id: 'subject-instance',
    concept: '개별 주체 — 사람·생물·조직·국가·신',
    source: 'MasterPlan §7 · ModulePlan S3',
    kinds: ['Subject'],
    note: '다섯 모두 같은 Subject 인터페이스를 쓴다',
  },
  {
    id: 'value-conflict',
    concept: '상충하는 가치관 (특색 공식 ①)',
    source: 'MasterPlan §7.1',
    kinds: ['State', 'Claim'],
    note: '가치의 세기는 상태, "무엇이 옳다" 는 주장 — 둘이 어긋나면 내부 모순이 된다',
  },
  {
    id: 'past-experience',
    concept: '해결되지 않은 과거 경험 (특색 공식 ②)',
    source: 'MasterPlan §7.1',
    kinds: ['Event', 'Claim'],
    note: '일어난 일은 사건, 그 일에 대한 해석은 주장',
  },
  {
    id: 'hidden-goal',
    concept: '숨기고 있는 목적 (특색 공식 ⑦)',
    source: 'MasterPlan §7.1',
    kinds: ['Possibility', 'Claim'],
    note: '추구하는 길은 가능성, 감추는 행위는 남들이 가진 틀린 주장으로 나타난다',
  },
  {
    id: 'relationship-position',
    concept: '관계망 속 위치 (특색 공식 ⑥)',
    source: 'MasterPlan §7.1',
    kinds: ['State', 'Dependency'],
    note: 'relational State 이자, 특정 주체에 걸린 subject 의존',
  },

  // ── 가능성 그래프 ────────────────────────────────────────────────────────
  {
    id: 'possibility-node',
    concept: '가능성 노드 13유형 (need·goal·strategy·action…)',
    source: 'MasterPlan §5.2',
    kinds: ['Possibility'],
    note: '유형은 direction 과 atoms 로 접힌다',
  },
  {
    id: 'possibility-edge',
    concept: '가능성 간선 11유형 (requires·enables·conflicts·substitutes)',
    source: 'MasterPlan §5.3',
    kinds: ['Possibility', 'Dependency'],
    note: 'requires 는 preconditionIds, substitutes 는 의존의 substitutability 로 나타난다',
  },
  {
    id: 'activation-score',
    concept: '가능성 활성화 점수 (baseDesire·feasibility·risk)',
    source: 'MasterPlan §6.4',
    kinds: ['State', 'Possibility'],
    note: '점수는 주체 상태에서 계산된다 — P4 가 계산식을 가진다',
  },

  // ── 현상·인식 ────────────────────────────────────────────────────────────
  {
    id: 'phenomenon-data',
    concept: '현상 데이터 (Phenomenon — channel·intensity·position)',
    source: 'MasterPlan §6.2',
    kinds: ['Phenomenon'],
    note: '주체는 상태가 아니라 현상에 반응한다',
  },
  {
    id: 'interpretation',
    concept: '해석 데이터 (Interpretation — hypothesis·confidence)',
    source: 'MasterPlan §6.3',
    kinds: ['Claim'],
    note: '같은 현상에서 주체마다 다른 주장이 선다',
  },
  {
    id: 'information-packet',
    concept: '정보·소문 (InformationPacket)',
    source: 'MasterPlan §20',
    kinds: ['Claim', 'Phenomenon'],
    note: '전달은 report 채널 현상, 내용은 주장 — 실제와 어긋나도 된다',
  },
  {
    id: 'rumor-distortion',
    concept: '소문의 정확도·왜곡 (accuracy·distortion)',
    source: 'MasterPlan §20',
    kinds: ['Claim'],
    note: '전달될수록 confidence 와 assertion 이 갈라진다',
  },

  // ── 세계 요구와 사건 ─────────────────────────────────────────────────────
  {
    id: 'world-requirement-claim',
    concept: '세계 요구 청구 (WorldRequirementClaim)',
    source: 'MasterPlan §8.1',
    kinds: ['WorldRequirement'],
    note: '가능성이 세계에 제출하는 청구 — 청구자 없는 요구는 없다',
  },
  {
    id: 'requirement-merge',
    concept: '요구 병합 (여러 주체의 요구 → 하나의 세계 요소)',
    source: 'MasterPlan §8.2',
    kinds: ['WorldRequirement', 'Entity'],
    note: '병합의 산물이 장소·자원 Entity 가 된다',
  },
  {
    id: 'conflict-potential',
    concept: '충돌 가능성 (ConflictPotential — 경합 대상·비양립성)',
    source: 'MasterPlan §8.3',
    kinds: ['Dependency', 'Possibility'],
    note: '같은 대상에 걸린 의존들과 양립 불가한 가능성들의 겹침',
  },
  {
    id: 'world-event',
    concept: '사건 (WorldEvent — 참여 주체·적용 규칙·상태 해시)',
    source: 'MasterPlan §9.1',
    kinds: ['Event'],
    note: '스크립트가 아니라 상태 변화의 기록',
  },
  {
    id: 'applied-rule',
    concept: '사건에 적용된 규칙 (appliedRules)',
    source: 'MasterPlan §9.1',
    kinds: ['Rule', 'Event'],
    note: '사건의 causeIds 가 규칙을 지목한다',
  },
  {
    id: 'consequence',
    concept: '결과 기록 (ConsequenceRecord — 부상·채무·원한·권력 공백)',
    source: 'MasterPlan §9.1 · ModulePlan E4',
    kinds: ['Event', 'State'],
    note: '결과는 다음 사건의 원인이 되는 상태로 남는다',
  },
  {
    id: 'social-proposal',
    concept: '퀘스트를 대체하는 사회적 제안 (SocialProposal — 요청·거래·협박·동맹)',
    source: 'MasterPlan §9.3',
    kinds: ['Commitment'],
    note: '제안·수락·의무·보상·기한·위반이 곧 약속의 필드다',
  },
  {
    id: 'concealed-intention',
    concept: '감춰진 의도 (concealedIntentions)',
    source: 'MasterPlan §9.3',
    kinds: ['Claim', 'Possibility'],
    note: '상대가 가진 주장과 실제 가능성이 어긋난 상태',
  },

  // ── 능력과 성장 ──────────────────────────────────────────────────────────
  {
    id: 'personal-ability',
    concept: '개인 능력 (PersonalAbility — 표현·대상·조건·제한)',
    source: 'MasterPlan §10.1',
    kinds: ['Affordance', 'Rule'],
    note: '능력은 비용 있는 어포던스이며, 그 효과는 규칙으로 적힌다',
  },
  {
    id: 'ability-cost',
    concept: '능력의 대가·제한·실패 결과 (costs·restrictions)',
    source: 'MasterPlan §10.2',
    kinds: ['Affordance', 'Event'],
    note: 'cost 는 어포던스의 필드, 실패 결과는 사건으로 남는다',
  },
  {
    id: 'growth',
    concept: '성장 12종 (숙련·해금·감각 확장·권한 획득·종 변이)',
    source: 'MasterPlan §11.1',
    kinds: ['State', 'Affordance', 'Dependency'],
    note: '숙련은 상태, 해금은 새 어포던스, 탈피는 의존의 교체다',
  },

  // ── 세계 상태와 최소 단위 ────────────────────────────────────────────────
  {
    id: 'world-state-domain',
    concept: '세계 상태 9영역 (물리·생물·제도·경제·정보…)',
    source: 'MasterPlan §12.1',
    kinds: ['State'],
    note: '영역은 State.domain 으로, 필드 트리는 O2 가 확정한다',
  },
  {
    id: 'world-fact',
    concept: '논리적 최소 단위 WorldFact 7타입 (entity·property·relationship·rule·event·knowledge·claim)',
    source: 'MasterPlan §13.1',
    kinds: ['Entity', 'State', 'Rule', 'Event', 'Claim'],
    note: '원문의 7타입이 존재론 5타입으로 그대로 갈라진다 — 실제 사실과 믿는 사실의 분리 포함',
  },
  {
    id: 'world-manifest',
    concept: '공간·표현 최소 단위 WorldManifest',
    source: 'MasterPlan §13.2',
    kinds: ['Entity', 'State'],
    note: '표현은 사물과 그 물리 상태로 환원된다',
  },
  {
    id: 'ecs-entity',
    concept: 'ECS 엔티티와 컴포넌트 (위치·충돌·감지 범위)',
    source: 'MasterPlan §17',
    kinds: ['Entity', 'State'],
    note: '논리적 Subject 와 분리된 실시간 표현 — 원소로는 사물과 상태다',
  },

  // ── 공간과 해상도 ────────────────────────────────────────────────────────
  {
    id: 'semantic-region',
    concept: '의미적 공간 그래프 (SemanticRegion — 붉은 장막 군락)',
    source: 'MasterPlan §14.2',
    kinds: ['Entity', 'Affordance', 'WorldRequirement'],
    note: '지역은 place Entity, 접근 조건은 어포던스, supportedWorldClaims 는 요구다',
  },
  {
    id: 'resolution-ladder',
    concept: '3단계 실체화 (추상 상태 · 축약 시뮬 · 활성 3D)',
    source: 'MasterPlan §15',
    kinds: ['State'],
    note: '해상도는 지역·주체에 붙는 상태값이다 (N2 가 배정 규칙을 가진다)',
  },
];
