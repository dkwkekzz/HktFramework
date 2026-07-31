# 주체의 가능성으로부터 세계가 생성되는 3D 오픈월드 MMORPG 전체 설계도

## 0. 설계 목표

이 게임은 개발자가 미리 만든 퀘스트를 플레이어가 순서대로 소비하는 MMORPG가 아니다.

세계에는 다음과 같은 주체가 존재한다.

- 플레이어
- 개인 NPC
- 종족
- 생물
- 마물
- 조직
- 도시
- 국가
- 종교
- 인공 지성체
- 초월적 존재
- 신에 가까운 거대 생명체

모든 주체는 자신이 존재하기 위해 필요한 목적과 가능성을 가진다.

주체는 세계를 관찰하고, 관찰한 현상을 자기 경험과 가치관에 따라 해석하고, 자신이 선택할 수 있다고 인식한 가능성 중 일부를 행동으로 옮긴다.

여러 주체의 행동이 같은 대상·공간·자원·관계·정보를 차지하려 할 때 충돌이 발생한다.

이 게임에서 콘텐츠는 다음과 같이 정의된다.

> 콘텐츠란 세계 상태를 변화시키려는 여러 주체의 행동이 세계 규칙에 의해 충돌하거나 결합하면서 발생하는 사건과 그 결과다.

퀘스트는 독립된 콘텐츠 데이터가 아니다.

퀘스트처럼 보이는 요청은 다음 조건의 결과다.

- 어떤 주체가 해결해야 할 문제를 가진다.
- 주체 자신만으로는 그 문제를 해결하기 어렵다.
- 다른 주체가 해결 수단을 가지고 있다고 인식한다.
- 협력·거래·기만·협박·의뢰 중 하나가 현재 목적에 유리하다고 판단한다.
- 두 주체가 상호작용할 수 있는 위치와 관계에 놓인다.

따라서 의뢰, 거래, 동맹, 배신, 추적, 습격, 구조, 보호, 조종은 모두 동일한 사건 생성 시스템에서 발생한다.

---

## 1. 핵심 명제

### 1.1 기존 MMORPG의 생성 방향

일반적인 MMORPG는 다음 순서로 제작된다.

```
세계 설정
→ 지역 제작
→ 몬스터와 NPC 배치
→ 퀘스트 작성
→ 보상 설정
→ 플레이어가 콘텐츠 소비
```

이 구조에서는 주체가 세계에 맞추어 행동한다.

NPC는 퀘스트를 주기 위해 존재하고, 몬스터는 사냥당하기 위해 존재하며, 재료는 제작에 소비되기 위해 존재한다.

### 1.2 이 프로젝트의 생성 방향

본 프로젝트는 다음 순서를 따른다.

```
세계관의 핵심 명제
→ 주체로서의 종 정의
→ 종의 생성 가능한 가능성 그래프 정의
→ 개별 주체의 성향·경험·관계 생성
→ 각 주체의 현재 목적 그래프 생성
→ 목적 달성에 필요한 세계 요구 추출
→ 여러 주체의 요구를 병합·충돌
→ 세계 상태와 세계 규칙 정의
→ 공간·대상·생물·조직으로 실체화
→ 관찰과 행동
→ 사건과 결과
→ 기억·성장·관계 변화
→ 새로운 가능성 그래프 생성
```

이를 한 문장으로 표현하면 다음과 같다.

> 세계가 주체의 행동을 결정하는 것이 아니라, 주체가 존재하기 위해 필요한 가능성이 세계의 일부를 요구한다.

그러나 세계 전체가 한 주체의 욕망대로 만들어져서는 안 된다.

따라서 두 번째 명제가 필요하다.

> 모든 주체는 자기 관점에서 가능한 콘텐츠 그래프를 생성하며, 세계는 여러 주체의 그래프가 충돌하고 결합할 수 있도록 실체화된다.

### 1.3 세계 생성의 실질적 출발점

세계 생성의 첫 번째 구현 대상은 지형이나 몬스터가 아니다.

첫 번째 구현 대상은 다음 그래프다.

```
주체
 ├─ 존재 조건
 ├─ 생존 방식
 ├─ 욕구
 ├─ 가치관
 ├─ 인식 능력
 ├─ 행동 가능성
 ├─ 성장 가능성
 ├─ 관계 가능성
 └─ 세계에 요구하는 조건
```

이를 주체 의존도 그래프 Subject Dependency Graph라고 한다.

주체 의존도 그래프는 다음 질문에 답한다.

- 이 종은 무엇이 있어야 존재할 수 있는가?
- 무엇을 잃으면 멸종하는가?
- 무엇을 얻으면 새로운 행동이 가능한가?
- 어떤 현상을 위협으로 해석하는가?
- 어떤 상대와 협력하거나 적대할 수 있는가?
- 무엇을 배우거나 변형할 수 있는가?
- 어떤 규칙이 있어야 이 종의 능력과 약점이 성립하는가?
- 이 주체의 존재가 다른 주체에게 어떤 가능성을 만드는가?

---

## 2. 전체 시스템 파이프라인

```
[Worldview Seed]
세계관 핵심 명제
        ↓
[Species Definition]
종의 존재 방식과 가능성 문법
        ↓
[Subject Instance]
개별 주체의 성향·기억·상처·가치관
        ↓
[Possibility Graph]
현재 인식 가능한 행동과 성장 가능성
        ↓
[World Requirement Claims]
가능성을 성립시키기 위해 필요한 세계 요구
        ↓
[World Synthesis]
여러 주체의 요구 병합·충돌·제약
        ↓
[World Rules & State]
규칙·상태·자원·관계·제도 정의
        ↓
[Semantic Space Graph]
장소와 이동 가능성 정의
        ↓
[3D Materialization]
지형·건물·생물·오브젝트로 표현
        ↓
[Observation]
주체가 현상을 제한적으로 관찰
        ↓
[Interpretation]
경험과 가치관에 따라 현상 해석
        ↓
[Intent & Action]
목적 선택과 행동 실행
        ↓
[Event Collision]
다른 주체의 행동 및 세계 규칙과 충돌
        ↓
[Consequences]
상태·기억·관계·능력·공간 변화
        ↓
[Graph Evolution]
새로운 가능성 생성 및 기존 가능성 소멸
```

---

## 3. 세계관 계층

세계관은 단순한 배경 설명이 아니다.

세계관은 모든 종과 능력과 사건이 공유하는 최상위 제약이다.

### 3.1 세계관 시드

```ts
interface WorldviewSeed {
  id: string;
  name: string;

  existentialPremise: string;
  centralConflict: string;

  universalInvariants: InvariantDefinition[];
  metaphysicalMediums: MediumDefinition[];
  unknownDomains: UnknownDomainDefinition[];

  civilizationConstraints: ConstraintDefinition[];
  dangerScale: DangerScaleDefinition;
}
```

예시:

```ts
const worldSeed: WorldviewSeed = {
  id: "world_ashen_frontier",
  name: "재해 너머의 세계",

  existentialPremise:
    "모든 생명은 자신의 가능성을 세계에 흔적으로 남기며, 강한 의지와 조건은 현실의 작동 방식에 제한적인 예외를 만든다.",

  centralConflict:
    "문명권은 생존을 위해 미지의 영역을 탐사하지만, 탐사가 확대될수록 잠들어 있던 거대 생명체와 오래된 규칙이 활성화된다.",

  universalInvariants: [
    { id: "cost", description: "지속적인 변화에는 비용이 필요하다." },
    { id: "information", description: "관측하지 못한 상태를 완전히 이용할 수 없다." },
    { id: "resistance", description: "이미 안정된 상태일수록 변화시키기 어렵다." },
    { id: "consequence", description: "큰 변화는 반드시 다른 영역에 흔적을 남긴다." }
  ],

  metaphysicalMediums: [
    {
      id: "will_field",
      name: "의지장",
      description:
        "생명체의 생존 의지, 기억, 자기 인식이 세계에 영향을 줄 수 있게 하는 매개."
    }
  ],

  unknownDomains: [
    {
      id: "outer_continent",
      name: "외부 대륙",
      discoveryRisk: 0.95
    }
  ],

  civilizationConstraints: [],
  dangerScale: {
    localThreat: 10,
    cityThreat: 100,
    nationThreat: 1000,
    civilizationThreat: 10000
  }
};
```

### 3.2 세계 규칙의 계층

세계 규칙은 하나의 평면적인 목록이 아니다.

#### 1계층: 절대 불변 규칙

모든 존재에 적용된다.

- 변화에는 비용이 필요하다.
- 정보가 없는 대상은 정밀하게 조작할 수 없다.
- 동일 공간에 양립 불가능한 상태가 동시에 존재할 수 없다.
- 원인 없는 지속적 결과는 존재할 수 없다.

#### 2계층: 자연·생태 규칙

- 생물의 에너지 획득
- 번식
- 포식
- 환경 적응
- 독성
- 질병
- 기후
- 재료의 물성

#### 3계층: 종 특화 규칙

- 특정 종의 감각
- 특정 종의 번식 조건
- 특정 종의 집단 행동
- 특정 종의 초자연 능력 접근 방식

#### 4계층: 문명·제도 규칙

- 화폐
- 신분
- 법
- 국경
- 길드
- 자격
- 계약
- 금기

#### 5계층: 지역 규칙

- 특정 지역의 중력 이상
- 기억을 잃게 만드는 안개
- 거짓말을 감지하는 생태계
- 밤에만 열리는 통로

#### 6계층: 개인 능력 규칙

개별 주체가 스스로에게 부과한 조건과 대가를 통해 제한적인 예외를 만든다.

---

## 4. 종을 주체로 정의하는 방법

종은 외형이나 스탯의 묶음이 아니다.

종은 다음의 결합이다.

```
존재 조건
+ 생존 전략
+ 감각 체계
+ 인지 편향
+ 사회 형성 방식
+ 가능한 성장 방향
+ 세계와 상호작용하는 방식
```

### 4.1 종 데이터 구조

```ts
interface SpeciesDefinition {
  id: string;
  name: string;

  bodyModel: BodyModelDefinition;
  lifecycle: LifecycleDefinition;
  metabolism: MetabolismDefinition;

  perceptionChannels: PerceptionChannelDefinition[];
  cognitiveBiases: CognitiveBiasDefinition[];

  innateNeeds: NeedDefinition[];
  innateFears: FearDefinition[];

  socialPatterns: SocialPatternDefinition[];
  capabilityGrammar: CapabilityGrammar;

  worldRequirements: WorldRequirementTemplate[];
  mutationRules: MutationRule[];
}
```

### 4.2 인간류 예시

인간류는 기본적으로 신체 능력만으로 거대 마물과 경쟁할 수 없다.

그러므로 인간류의 존속 가능성을 만들려면 다음 세계 요구가 발생한다.

```
인간 생존
→ 집단 협력이 필요하다.
→ 정보를 축적해야 한다.
→ 도구와 문명을 발전시켜야 한다.
→ 압도적인 생물에 대항할 비대칭 수단이 필요하다.
→ 의지장을 다루는 능력이 필요하다.
→ 능력은 개인의 정신 구조와 조건에 따라 특화된다.
```

이 과정에서 세계에 다음이 요구된다.

- 도시
- 언어
- 교육
- 탐사 조직
- 능력 사용자 집단
- 능력 전승 방식
- 금지된 수련법
- 능력 범죄
- 능력에 대응하는 법과 제도
- 인간보다 강한 마물
- 마물의 신체를 이용하는 제작 체계
- 미지의 영역
- 탐사와 정보 거래 시장

즉, 도시와 길드와 마물은 먼저 배치되는 것이 아니다.

인간이 생존하기 위해 요구한 가능성의 결과로 생성된다.

---

## 5. 가능성 그래프

### 5.1 가능성 그래프의 정의

가능성 그래프는 주체가 현재 또는 미래에 선택할 수 있는 모든 행동·관계·성장·변형의 구조다.

단순한 목적 트리와 다른 점은 다음과 같다.

- 하나의 목적이 여러 방법으로 달성될 수 있다.
- 서로 다른 목적이 하나의 행동을 공유할 수 있다.
- 어떤 가능성은 다른 가능성을 차단한다.
- 상대 주체에 따라 사용 가능한 가능성이 달라진다.
- 경험을 통해 새로운 노드가 생성된다.
- 실패를 통해 기존 노드의 가중치가 변한다.
- 잘못된 정보로 실제로 불가능한 가능성을 믿을 수 있다.

따라서 트리보다 그래프가 적합하다.

### 5.2 노드 유형

```ts
type PossibilityNodeType =
  | "existence"
  | "need"
  | "goal"
  | "strategy"
  | "observation"
  | "interpretation"
  | "interaction"
  | "action"
  | "capability"
  | "relationship"
  | "growth"
  | "transformation"
  | "world_requirement";
```

```ts
interface PossibilityNode {
  id: string;
  type: PossibilityNodeType;

  semanticTags: string[];

  baseDesire: number;
  perceivedFeasibility: number;
  perceivedRisk: number;
  novelty: number;

  requiredBeliefs: string[];
  requiredCapabilities: string[];
  requiredPhenomena: PhenomenonPattern[];

  worldClaims: WorldRequirementClaim[];

  outcomes: OutcomeHypothesis[];
}
```

### 5.3 간선 유형

```ts
type PossibilityEdgeType =
  | "requires"
  | "enables"
  | "supports"
  | "conflicts"
  | "substitutes"
  | "reveals"
  | "learns"
  | "transforms_into"
  | "protects"
  | "exploits"
  | "responds_to";
```

```ts
interface PossibilityEdge {
  from: string;
  to: string;
  type: PossibilityEdgeType;
  strength: number;
  condition?: PredicateExpression;
}
```

### 5.4 모든 가능성을 수작업으로 열거하지 않는다

종마다 모든 가능성을 수작업으로 작성하면 경우의 수가 폭발한다.

따라서 종의 가능성 그래프는 완성된 트리가 아니라 생성 문법으로 정의한다.

예를 들어 인간류가 다른 주체를 만났을 때 생성할 수 있는 상호작용은 다음 연산자로 만들어진다.

```
상대 관찰
× 상대의 위협도
× 상대의 이용 가능성
× 현재 자원 부족
× 관계 기억
× 가치관
× 사회 규범
× 현재 목적
```

생성 가능한 상호작용:

- 관찰
- 회피
- 접근
- 교환
- 요청
- 설득
- 위협
- 공격
- 구조
- 보호
- 추적
- 기만
- 복종
- 시험
- 훈련
- 동맹
- 배신
- 포획
- 연구
- 숭배

종은 이 전체 가능성 문법을 가질 수 있지만, 개별 주체는 자신의 성향과 경험에 따라 일부 가능성의 가중치만 높게 가진다.

---

## 6. 상태가 아니라 현상에 반응하는 주체

### 6.1 객관적 상태와 관찰된 현상을 분리한다

주체가 세계의 실제 상태를 직접 읽게 해서는 안 된다.

```
실제 세계 상태
→ 감각 채널을 통한 관찰
→ 현상 추출
→ 주체의 해석
→ 행동 가능성 평가
```

예를 들어 실제 상태가 다음과 같다고 하자.

- 상대 HP: 12%
- 상대 목적: 도주
- 상대 능력: 독 분사
- 상대 감정: 공포

다른 주체는 이를 그대로 알 수 없다.

관찰할 수 있는 것은 다음과 같은 현상이다.

- 호흡이 불규칙하다.
- 뒤로 물러난다.
- 오른손을 숨긴다.
- 피부에서 자주색 증기가 발생한다.
- 주변의 작은 벌레가 죽는다.

각 주체는 이를 다르게 해석한다.

```
노련한 사냥꾼:
"독을 준비하면서 퇴로를 찾고 있다."

경험 없는 여행자:
"약해 보인다. 지금 공격하면 이길 수 있다."

독을 숭배하는 종교인:
"성스러운 징조다."

생태 연구자:
"기록되지 않은 방어 반응이다."
```

이 차이가 특색 있는 행동을 만든다.

### 6.2 현상 데이터

```ts
interface Phenomenon {
  id: string;
  sourceEntityId?: string;

  channel:
    | "visual"
    | "audio"
    | "smell"
    | "touch"
    | "aura"
    | "social"
    | "inference";

  tags: string[];
  intensity: number;
  ambiguity: number;

  position?: Vector3;
  observedAt: number;
}
```

### 6.3 해석 데이터

```ts
interface Interpretation {
  phenomenonId: string;
  subjectId: string;

  hypothesisTags: string[];
  confidence: number;

  emotionalResponse: EmotionalVector;
  activatedPossibilities: string[];
}
```

### 6.4 가능성 활성화 점수

특정 상태가 곧바로 행동을 발동시키지 않는다.

각 가능성 노드는 다음과 같은 점수를 가진다.

```
활성화 점수 =
기본 성향
+ 현재 욕구의 긴급도
+ 가치관 일치도
+ 과거 경험 유사도
+ 상대와의 관계
+ 관찰된 현상과의 연관도
+ 능력 보유 여부
+ 예상 보상
+ 새로움에 대한 선호
- 예상 위험
- 사회적 금기
- 실패 기억
+ 제한된 무작위성
```

```ts
function scorePossibility(
  subject: Subject,
  node: PossibilityNode,
  context: DecisionContext
): number {
  return (
    node.baseDesire *
      context.needUrgency *
      valueAlignment(subject.values, node) *
      phenomenonMatch(context.interpretations, node.requiredPhenomena) *
      relationshipModifier(subject, context.relatedSubjects) *
      memorySimilarity(subject.memories, context) *
      node.perceivedFeasibility *
      capabilityFit(subject, node) +
    context.expectedReward +
    node.novelty * subject.traits.curiosity -
    node.perceivedRisk * subject.traits.riskAversion -
    socialPenalty(subject, node) +
    boundedNoise(subject.id, context.tick)
  );
}
```

상위 점수를 가진 행동 하나를 무조건 선택하지 않는다.

```ts
const candidates = possibilities
  .filter(node => scorePossibility(subject, node, context) > node.threshold);

const selected = weightedSample(
  candidates,
  node => Math.exp(scorePossibility(subject, node, context) / temperature)
);
```

이로 인해 같은 인물도 상황과 경험에 따라 다른 선택을 할 수 있다.

---

## 7. 개별 주체의 정의

```ts
interface Subject {
  id: string;
  speciesId: string;

  traits: TraitVector;
  values: ValueVector;
  emotions: EmotionalVector;

  needs: NeedState[];
  beliefs: BeliefState[];
  capabilities: CapabilityState[];

  memories: MemoryRecord[];
  relationships: RelationshipState[];

  possibilityGraphId: string;
  currentIntentions: Intention[];

  physicalEntityId: string;
}
```

### 7.1 특색 있는 캐릭터의 생성 공식

캐릭터의 특색은 랜덤한 외형이나 대사에서 나오지 않는다.

```
특색 =
상충하는 가치관
+ 해결되지 않은 과거 경험
+ 독특한 세계 해석 방식
+ 특정 상황에서 반복되는 선택 편향
+ 개인 능력의 조건
+ 관계망 속 위치
+ 현재 숨기고 있는 목적
```

좋은 캐릭터는 반드시 내부 모순을 가진다.

예:

- 가치관: 약한 자를 보호해야 한다.
- 두려움: 보호 대상에게 배신당하는 것.
- 능력 조건: 자신이 신뢰한 사람을 지킬 때만 강해진다.
- 과거 경험: 보호했던 동료가 자신을 팔아넘겼다.
- 현재 목적: 사람을 믿지 않으면서도 누군가를 보호해야 한다.

이 주체는 단순한 선량한 NPC가 아니다.

상황에 따라 다음 행동이 모두 가능하다.

- 플레이어를 돕는다.
- 플레이어를 시험한다.
- 플레이어를 감시한다.
- 의도적으로 위험에 빠뜨려 신뢰를 확인한다.
- 플레이어가 다른 사람을 버리면 즉시 적대한다.
- 플레이어를 보호하기 위해 거짓말한다.
- 자신이 배신당했다고 오해해 공격한다.

---

## 8. 여러 주체의 그래프로부터 세계 생성

### 8.1 세계 요구 청구

가능성 그래프의 노드는 자신의 가능성을 성립시키기 위해 세계에 요구 사항을 제출한다.

이를 WorldRequirementClaim이라고 한다.

```ts
interface WorldRequirementClaim {
  id: string;
  issuerId: string;
  possibilityNodeId: string;

  requirementType:
    | "resource"
    | "organism"
    | "hazard"
    | "location"
    | "route"
    | "institution"
    | "knowledge"
    | "relationship"
    | "rule"
    | "ability_medium";

  semanticTags: string[];

  minimumQuantity?: number;
  scarcityPreference?: number;
  spatialConstraints?: SpatialConstraint[];
  temporalConstraints?: TemporalConstraint[];

  importance: number;
  exclusivity: number;
}
```

예:

```
인간 탐사자의 가능성:
"거대 마물의 약점을 조사한다."

세계 요구:
- 조사할 거대 마물
- 마물이 남긴 흔적
- 흔적을 해석할 지식
- 마물이 이동하는 공간
- 위험을 감지할 현상
- 정보를 원하는 조직
- 정보의 가치를 발생시키는 희소성
```

### 8.2 요구 병합

서로 다른 주체가 비슷한 요구를 제출하면 하나의 세계 요소로 병합할 수 있다.

```
약초를 원하는 치료사
+ 독을 원하는 암살자
+ 먹이를 찾는 곤충
+ 영역을 보호하려는 식물형 마물
= 독성과 치료성을 동시에 가진 희귀 식물 군락
```

이 하나의 군락이 여러 주체에게 서로 다른 콘텐츠가 된다.

- 치료사는 채집하려 한다.
- 암살자는 독을 정제하려 한다.
- 곤충은 번식지로 이용한다.
- 식물형 마물은 군락을 보호한다.
- 국가는 군락을 통제하려 한다.
- 플레이어는 어느 쪽에 개입할지 선택한다.

### 8.3 충돌 가능성 계산

```ts
interface ConflictPotential {
  subjectA: string;
  subjectB: string;

  contestedFactId: string;

  incompatibility: number;
  urgency: number;
  awareness: number;
  interactionReachability: number;

  eventPotential: number;
}
```

```
사건 가능성 =
목표 비양립성
× 목표 긴급도
× 서로의 존재를 인지한 정도
× 공간적으로 만날 가능성
× 행동할 능력
× 결과의 가치
```

```ts
function calculateEventPotential(
  a: Intention,
  b: Intention,
  world: WorldState
): number {
  return (
    incompatibility(a.desiredChanges, b.desiredChanges) *
    Math.max(a.urgency, b.urgency) *
    mutualAwareness(a.subjectId, b.subjectId, world) *
    interactionReachability(a, b, world) *
    capabilityReadiness(a, b)
  );
}
```

---

## 9. 사건 생성 시스템

### 9.1 사건의 정의

사건은 미리 작성된 스크립트가 아니다.

```ts
interface WorldEvent {
  id: string;

  participatingSubjects: string[];
  involvedFacts: string[];

  initiatingActions: ActionRecord[];
  appliedRules: string[];

  beforeStateHash: string;
  afterStateHash?: string;

  phase:
    | "forming"
    | "active"
    | "resolved"
    | "propagating"
    | "forgotten";

  consequences: ConsequenceRecord[];
}
```

### 9.2 사건 생성 과정

1. 주체가 현상을 관찰한다.
2. 현상을 자기 관점에서 해석한다.
3. 목적 그래프에서 가능성이 활성화된다.
4. 행동 계획을 세운다.
5. 행동이 세계 변경 요청으로 제출된다.
6. 다른 행동과 충돌하는지 검사한다.
7. 세계 규칙이 결과를 판정한다.
8. 결과가 세계 상태에 반영된다.
9. 참여자와 관찰자에게 기억이 생성된다.
10. 관계와 가능성 그래프가 수정된다.
11. 사건의 흔적이 다른 주체에게 새로운 현상이 된다.

### 9.3 퀘스트처럼 보이는 상호작용

```ts
interface SocialProposal {
  proposerId: string;
  targetId: string;

  form:
    | "request"
    | "trade"
    | "threat"
    | "deception"
    | "alliance"
    | "contract"
    | "challenge";

  desiredWorldChange: DesiredChange[];
  offeredValue: ValueOffer[];
  concealedIntentions: string[];

  expirationCondition?: PredicateExpression;
}
```

NPC가 요청을 생성하는 조건:

```ts
function shouldProposeCooperation(
  npc: Subject,
  target: Subject,
  problem: Intention,
  world: WorldState
): boolean {
  const selfSuccess = estimateSuccess(npc, problem, world);
  const jointSuccess = estimateJointSuccess(npc, target, problem, world);

  const trust = relationship(npc, target).trust;
  const leverage = estimateLeverage(npc, target, world);
  const urgency = problem.urgency;

  return (
    jointSuccess > selfSuccess &&
    urgency > 0.5 &&
    (trust > 0.3 || leverage > 0.6)
  );
}
```

상호작용 형태 선택:

- 신뢰가 높다 → 부탁·동맹
- 상호 이익이 있다 → 거래·계약
- 상대의 약점을 안다 → 협박
- 상대를 소모품으로 본다 → 기만
- 상대가 위험하지만 필요하다 → 시험·조건부 협력
- 상대가 자신의 가치를 위반한다 → 공격·거절

---

## 10. 개인화된 초능력 체계

인간류는 의지장을 다룰 수 있다.

프로토타입 내부에서 헌터×헌터의 넨과 유사한 설계 목적을 연구할 수 있지만, 최종 상용 명칭과 구체 규칙은 독자적으로 구성한다.

### 10.1 능력의 기본 구성

```
개인 능력 =
의지 에너지
+ 표현 방식
+ 대상
+ 작동 조건
+ 제한
+ 대가
+ 실패 결과
+ 사용자의 해석
```

```ts
interface PersonalAbility {
  id: string;
  ownerId: string;

  sourceMedium: "will_field";

  expression:
    | "reinforcement"
    | "projection"
    | "conversion"
    | "control"
    | "construction"
    | "exception";

  targetPattern: TargetPattern;
  effectProgram: EffectProgram;

  activationConditions: PredicateExpression[];
  restrictions: RestrictionDefinition[];
  costs: CostDefinition[];
  failureConsequences: ConsequenceDefinition[];

  mastery: number;
  stability: number;
}
```

### 10.2 능력 강도의 핵심 원리

능력은 단순히 레벨이 높다고 강해지지 않는다.

```
효과 강도 =
사용자의 출력
× 숙련도
× 조건의 구체성
× 대가의 실질성
× 가치관과의 일치
× 현재 감정의 집중도
÷ 효과 범위
÷ 지속 시간
÷ 대상의 저항
```

```ts
function calculateAbilityPower(
  ability: PersonalAbility,
  user: Subject,
  context: AbilityContext
): number {
  const commitment =
    restrictionSpecificity(ability.restrictions) *
    actualCostSeverity(ability.costs, user) *
    valueAlignment(user.values, ability);

  return (
    context.auraOutput *
    ability.mastery *
    commitment *
    context.focus *
    context.emotionalCoherence
  ) /
    Math.max(
      1,
      context.effectArea *
        context.duration *
        context.targetResistance
    );
}
```

### 10.3 능력이 캐릭터성을 표현해야 한다

능력은 전투용 스킬 목록이 아니다.

능력은 사용자의 다음 요소를 반영한다.

- 무엇을 두려워하는가?
- 무엇을 지키려 하는가?
- 무엇을 통제하고 싶은가?
- 어떤 방식으로 세상을 이해하는가?
- 무엇을 대가로 내놓을 수 있는가?
- 자신에게 어떤 금기를 부과하는가?

예시:

**기록 수집가**

```
능력:
직접 목격한 행동을 종이에 기록하면,
상대가 같은 행동을 다시 할 순간을 짧게 예측한다.

조건:
반드시 자신의 손으로 사실만 기록해야 한다.

제한:
추측이나 거짓이 한 줄이라도 포함되면 전체 기록이 무효가 된다.

대가:
기록한 기억을 점차 자신의 기억으로 구분하지 못한다.
```

이 능력은 전투, 조사, 인간관계, 배신 사건 모두에 사용된다.

---

## 11. 성장 시스템

성장은 숫자 상승이 아니라 가능성 그래프의 변화다.

### 11.1 성장의 종류

- 신체 성장
- 능력 숙련
- 새로운 능력 획득
- 지식 획득
- 감각 확장
- 행동 선택지 증가
- 관계망 확장
- 사회적 권한 획득
- 지역 접근 권한 획득
- 세계 해석 방식 변화
- 자기 제한의 강화 또는 해제
- 종 자체의 변이

### 11.2 성장 데이터

```ts
interface GrowthDelta {
  subjectId: string;

  addedPossibilityNodes: PossibilityNode[];
  removedPossibilityNodeIds: string[];

  modifiedTraits: Partial<TraitVector>;
  modifiedValues: Partial<ValueVector>;

  learnedCapabilities: CapabilityState[];
  changedRelationships: RelationshipDelta[];

  newBeliefs: BeliefState[];
  invalidatedBeliefIds: string[];
}
```

### 11.3 경험이 가능성 그래프를 변화시키는 방식

```
성공:
해당 전략의 실현 가능성 증가

실패:
위험도 증가 또는 대체 전략 생성

배신:
신뢰 기반 상호작용 가중치 감소

구조 경험:
보호·희생 관련 가능성 증가

미지의 현상 관찰:
조사·탐험·공포·숭배 가능성 생성

능력의 한계 체험:
새로운 제한 조건 또는 응용 가능성 생성
```

중요한 점은 실패가 단순한 보상 손실이 아니라는 것이다.

실패는 다음 콘텐츠를 생성해야 한다.

- 복수
- 두려움
- 대체 전략
- 새로운 협력자 탐색
- 능력 조건 강화
- 지역 회피
- 적에 대한 연구
- 잘못된 믿음의 형성

---

## 12. 세계 상태 모델

### 12.1 세계 상태 영역

```ts
interface WorldState {
  physical: PhysicalStateStore;
  biological: BiologicalStateStore;
  ability: AbilityStateStore;
  social: SocialStateStore;
  institutional: InstitutionalStateStore;
  economic: EconomicStateStore;
  informational: InformationStateStore;
  spatial: SpatialStateStore;
  historical: HistoricalStateStore;
}
```

**물리 상태**

- 위치
- 속도
- 온도
- 구조적 안정성
- 물질 구성
- 파손
- 차폐

**생물 상태**

- 체력
- 대사
- 허기
- 질병
- 독성
- 번식
- 성장 단계
- 변이

**능력 상태**

- 에너지
- 활성 효과
- 조건 충족 여부
- 능력 흔적
- 영역 간섭

**관계 상태**

- 신뢰
- 공포
- 존경
- 의존
- 원한
- 빚
- 소속

**제도 상태**

- 법
- 자격
- 통행권
- 현상금
- 금지 물품
- 외교 관계

**정보 상태**

- 누가 무엇을 아는가
- 정보의 확실성
- 정보의 출처
- 소문 전파
- 거짓 정보
- 비밀

---

## 13. 세계의 최소 표현 단위

논리적 세계와 3D 표현을 하나의 단위로 만들면 안 된다.

세계에는 두 종류의 최소 단위가 필요하다.

### 13.1 논리적 최소 단위: WorldFact

```ts
interface WorldFact {
  id: string;
  type:
    | "entity"
    | "property"
    | "relationship"
    | "rule"
    | "event"
    | "knowledge"
    | "claim";

  subjectId?: string;
  objectId?: string;

  predicate: string;
  value: unknown;

  validFrom: number;
  validUntil?: number;

  confidence: number;
  provenance: string[];

  spatialScope?: SpatialScope;
}
```

예:

```ts
{
  id: "fact_001",
  type: "property",
  subjectId: "plant_red_veil",
  predicate: "contains",
  value: "paralytic_toxin",
  validFrom: 10200,
  confidence: 1,
  provenance: ["ecology_rule_12"]
}
```

```ts
{
  id: "belief_201",
  type: "knowledge",
  subjectId: "hunter_04",
  objectId: "plant_red_veil",
  predicate: "believes_effect",
  value: "healing",
  validFrom: 10400,
  confidence: 0.61,
  provenance: ["rumor_77"]
}
```

실제 사실과 주체가 믿는 사실을 분리한다.

### 13.2 공간·표현 최소 단위: WorldManifest

```ts
interface WorldManifest {
  id: string;
  sourceFactIds: string[];

  form:
    | "terrain"
    | "structure"
    | "organism"
    | "item"
    | "effect"
    | "sound"
    | "trace";

  spatialEnvelope: SpatialEnvelope;
  collisionRecipe: CollisionRecipe;
  visualRecipe: VisualRecipe;
  interactionAffordances: Affordance[];

  simulationLevel:
    | "abstract"
    | "coarse"
    | "active"
    | "rendered";

  persistence: "temporary" | "regional" | "permanent";
}
```

WorldFact는 세계에 무엇이 존재하는지를 정의한다.

WorldManifest는 그것을 플레이어에게 어떻게 보여주고 상호작용하게 할지를 정의한다.

---

## 14. 3D 공간 생성

### 14.1 지형부터 만들지 않는다

공간 생성 순서는 다음과 같아야 한다.

```
주체의 목적
→ 필요한 대상
→ 대상 사이의 접근 관계
→ 위험과 안전의 분포
→ 의미적 공간 그래프
→ 그래프의 3D 배치
→ 지형 생성
→ 시각적 표현
```

### 14.2 의미적 공간 그래프

```ts
interface SemanticRegion {
  id: string;
  tags: string[];

  supportedWorldClaims: string[];
  residentSubjects: string[];

  resourceProfile: ResourceProfile;
  hazardProfile: HazardProfile;

  accessConditions: PredicateExpression[];
  neighbors: RegionConnection[];

  spatialBudget: SpatialBudget;
}
```

예:

```
붉은 장막 군락
- 독성 식물 존재
- 치료 재료 존재
- 식물형 마물의 영역
- 암살 조직의 비밀 채집지
- 연구자의 관찰 대상
- 비가 온 뒤에만 접근 가능
```

이 의미가 먼저 정의되고, 이후 3D 공간으로 변환된다.

### 14.3 3D 배치 단계

1. 지역 노드 간 거리 요구 계산
2. 이동 경로와 차단 관계 계산
3. 그래프를 2D 또는 3D 좌표에 임베딩
4. 높이장과 지질 구조 생성
5. 수계와 절벽 생성
6. 생태 영역 분포
7. 이동 가능성 검증
8. 랜드마크 배치
9. 오브젝트와 생물 배치
10. 내비게이션 및 가시성 검증

```ts
interface RegionConnection {
  targetRegionId: string;

  traversalType:
    | "walk"
    | "climb"
    | "swim"
    | "fly"
    | "portal"
    | "conditional";

  cost: number;
  danger: number;

  requiredCapabilities: string[];
}
```

### 14.4 공간은 주체에 따라 다르게 인식된다

같은 절벽도 주체마다 다른 의미를 가진다.

```
일반 인간:
이동 불가능한 벽

등반 능력자:
빠른 우회로

비행 생물:
둥지 후보

매복 조직:
감시 지점

광물 생명체:
먹이 공급지
```

따라서 공간은 단순히 이동 가능 또는 불가능으로 표현하지 않는다.

```ts
interface Affordance {
  actionType: string;
  requiredCapabilities: string[];
  estimatedCost: number;
  resultingChanges: DesiredChange[];
}
```

---

## 15. 대규모 세계를 위한 3단계 실체화

모든 지역과 생물을 항상 완전하게 시뮬레이션할 수는 없다.

세계는 세 단계로 존재한다.

### 15.1 추상 상태

멀리 떨어진 지역.

- 지역 인구
- 자원 총량
- 조직 영향력
- 주요 갈등
- 대표 사건
- 위험도

개별 NPC의 위치까지 계산하지 않는다.

### 15.2 축약 시뮬레이션

플레이어 주변으로 접근하는 지역.

- 주요 주체를 개별 엔티티로 승격
- 이동 경로 생성
- 자원 군락 구체화
- 사건 후보 생성
- 시간 단위 축소

### 15.3 활성 3D 시뮬레이션

플레이어가 직접 관찰하는 영역.

- 개별 위치
- 충돌
- 애니메이션
- 감각 현상
- 능력 효과
- 물리 상호작용
- 정밀 전투

```ts
function updateMaterializationLevel(
  region: SemanticRegion,
  observers: Observer[],
  eventImportance: number
): SimulationLevel {
  const nearest = nearestObserverDistance(region, observers);

  if (nearest < 150) return "rendered";
  if (nearest < 1000 || eventImportance > 0.8) return "active";
  if (nearest < 10000) return "coarse";
  return "abstract";
}
```

---

## 16. 웹 기반 프로토타입 아키텍처

### 16.1 권장 기술 구성

**클라이언트**

- TypeScript
- Three.js
- WebGL2 우선, WebGPU 선택적 지원
- React 또는 경량 UI 프레임워크
- Web Worker
- IndexedDB
- WebSocket

**서버**

- Node.js
- TypeScript
- Fastify
- WebSocket
- PostgreSQL
- Redis 선택
- 이벤트 소싱
- 결정론적 시드 기반 생성

**공용 패키지**

```
packages/
 ├─ ontology
 ├─ possibility-graph
 ├─ world-rules
 ├─ world-synthesis
 ├─ event-engine
 ├─ subject-ai
 ├─ spatial-graph
 ├─ protocol
 └─ validation
```

### 16.2 프로젝트 구조

```
apps/
  client/
    src/
      rendering/
      input/
      ui/
      streaming/
      prediction/
      presentation/

  server/
    src/
      gateway/
      simulation/
      persistence/
      region-workers/
      event-store/

packages/
  core-types/
  subject-model/
  possibility-graph/
  phenomenon-system/
  decision-engine/
  world-claims/
  rule-engine/
  event-engine/
  growth-engine/
  semantic-space/
  materialization/
  validation/

content/
  worldviews/
  species/
  rule-sets/
  capability-grammars/
  visual-recipes/

tools/
  world-compiler/
  graph-inspector/
  event-replayer/
  simulation-runner/
  content-validator/
```

---

## 17. ECS 엔티티 구조

렌더링과 시뮬레이션에는 ECS를 사용한다.

```ts
type EntityId = number;

interface PositionComponent {
  x: number;
  y: number;
  z: number;
}

interface SubjectRefComponent {
  subjectId: string;
}

interface PerceptionComponent {
  channels: PerceptionChannelState[];
  range: number;
}

interface IntentionComponent {
  activeIntentions: Intention[];
}

interface AbilityComponent {
  abilityIds: string[];
}

interface InteractionComponent {
  affordances: Affordance[];
}

interface RenderableComponent {
  visualRecipeId: string;
  lod: number;
}
```

논리적 Subject와 실시간 ECS 엔티티를 분리한다.

```
Subject:
장기 기억, 가치관, 목적, 관계, 가능성 그래프

ECS Entity:
현재 위치, 충돌, 애니메이션, 감지 범위, 활성 효과
```

---

## 18. 서버 시뮬레이션 루프

```ts
function simulationTick(world: RuntimeWorld, deltaTime: number): void {
  advanceRegionalStates(world, deltaTime);

  const phenomena = collectPhenomena(world);

  for (const subject of world.activeSubjects) {
    const perceived = perceive(subject, phenomena, world);
    const interpretations = interpret(subject, perceived);
    const possibilities = activatePossibilities(subject, interpretations, world);

    updateIntentions(subject, possibilities, world);
    submitActions(subject, world);
  }

  const collisions = detectActionConflicts(world.pendingActions);
  const events = resolveActions(world.pendingActions, collisions, world.rules);

  applyEventConsequences(events, world);
  updateMemories(events, world);
  updateRelationships(events, world);
  updateGrowth(events, world);

  propagateEventTraces(events, world);
  updateMaterialization(world);

  world.pendingActions.length = 0;
}
```

---

## 19. 행동 판정과 규칙 엔진

행동은 바로 상태를 수정하지 않는다.

행동은 WorldChangeRequest를 제출한다.

```ts
interface WorldChangeRequest {
  actorId: string;
  actionType: string;

  targets: string[];
  desiredChanges: DesiredChange[];

  providedResources: ResourcePayment[];
  invokedCapabilities: string[];

  evidence: string[];
}
```

규칙 엔진이 다음을 검증한다.

- 행동 주체가 능력을 보유했는가?
- 대상이 관찰 또는 지정 가능한가?
- 비용을 지불했는가?
- 조건이 충족되었는가?
- 다른 행동과 충돌하는가?
- 절대 불변 규칙을 위반하는가?
- 지역 규칙이 결과를 변형하는가?
- 대상이 저항할 수 있는가?

```ts
interface RuleEvaluationResult {
  allowed: boolean;
  appliedRuleIds: string[];

  normalizedChanges: DesiredChange[];
  costsConsumed: ResourcePayment[];

  sideEffects: ConsequenceDefinition[];
  rejectionReason?: string;
}
```

---

## 20. 정보와 소문 시스템

깊이 있는 세계를 만들려면 사건 자체보다 사건이 어떻게 알려지는지가 중요하다.

```ts
interface InformationPacket {
  id: string;

  claims: InformationClaim[];
  sourceId: string;

  accuracy: number;
  emotionalTone: number;
  distortion: number;

  transmissionCount: number;
}
```

소문 전달 시 변형:

```ts
function transmitInformation(
  packet: InformationPacket,
  sender: Subject,
  receiver: Subject
): InformationPacket {
  return {
    ...packet,
    id: createId(),
    accuracy:
      packet.accuracy *
      sender.traits.honesty *
      receiver.traits.comprehension,
    distortion:
      packet.distortion +
      sender.traits.exaggeration +
      worldviewBias(receiver, packet),
    transmissionCount: packet.transmissionCount + 1
  };
}
```

하나의 사건이 여러 이야기로 변할 수 있다.

```
실제 사건:
탐사대가 마물의 알을 훔쳤고 마물이 도시를 습격했다.

도시 주민의 소문:
마물이 이유 없이 인간을 공격했다.

탐사 조직의 발표:
희생을 감수한 자원 확보 작전이었다.

마물을 숭배하는 종교:
인간이 신성한 후손을 납치했다.

다른 국가의 정보기관:
도시 방어력이 약화된 상태다.
```

이 정보 차이가 새로운 전쟁, 의뢰, 보복, 종교 갈등을 만든다.

---

## 21. 하나의 세계 요소가 생성되는 전체 예시

### 21.1 세계관 시드

- 문명권 밖에는 도시 하나를 파괴할 수 있는 거대 생명체가 존재한다.
- 인간은 의지장을 이용해 제한적 초능력을 발현할 수 있다.
- 강력한 변화일수록 구체적인 조건과 대가가 필요하다.

### 21.2 종 정의

**인간류**

```
목적:
생존, 지식 축적, 사회적 인정, 영향력 확대

약점:
신체적으로 거대 생물보다 약함

가능성:
도구 제작, 조직 형성, 의지 능력 개발, 거래, 탐사
```

**유리등 생물**

- 몸 내부에 고열 결정체가 존재한다.
- 빛과 열을 먹고 성장한다.
- 위협을 받으면 주변의 열을 빼앗는다.
- 번식기에는 산 전체의 온도를 낮춘다.

### 21.3 주체별 목적

**탐사 조직**

```
목적:
유리등 생물의 결정체를 확보한다.

이유:
결정체가 의지 능력 증폭기의 재료가 될 가능성이 있다.
```

**산악 마을**

```
목적:
겨울을 살아남는다.

문제:
유리등 생물의 번식으로 기온이 급격히 낮아진다.
```

**밀수 조직**

```
목적:
결정체를 독점해 암시장에 판매한다.
```

**유리등 생물의 우두머리**

```
목적:
번식지를 보호한다.
```

**연구자**

```
목적:
생물의 열 흡수 원리를 살아 있는 상태로 관찰한다.
```

### 21.4 세계 요구 추출

- 결정체 자원
- 산악 번식지
- 저온 현상
- 결정체 운반 경로
- 연구 정보
- 암시장
- 마을 난방 자원
- 마물을 보호할 생태적 이유

### 21.5 공간 생성

```
산악 마을
→ 얼어붙은 협곡
→ 유리등 군락 외곽
→ 열이 사라지는 숲
→ 번식 동굴
→ 우두머리의 둥지
```

각 공간은 목적 그래프상의 기능을 가진다.

### 21.6 사건 발생

1. 밀수 조직이 먼저 번식 동굴에 침입한다.
2. 알을 지키던 생물이 밀수꾼을 공격한다.
3. 밀수꾼이 화염 능력을 사용한다.
4. 생물은 위협에 반응해 산 전체의 열을 흡수한다.
5. 산악 마을의 난방 시설이 정지한다.
6. 마을 지도자는 원인을 알지 못한다.
7. 탐사 조직은 마을 주민에게 생물이 원인이라고 설명한다.
8. 연구자는 인간의 침입이 먼저였다는 흔적을 발견한다.
9. 플레이어는 서로 다른 주체에게서 상반된 정보를 얻는다.

### 21.7 발생 가능한 상호작용

```
마을:
생물을 제거해 달라고 요청

탐사 조직:
우두머리의 결정체 확보를 제안

연구자:
살해하지 말고 행동을 관찰해 달라고 요청

밀수 조직:
증거를 없애는 대가로 돈을 제안

생물:
플레이어가 알을 돌려주면 적대를 중단할 가능성

다른 국가:
혼란을 이용해 탐사 기지를 공격
```

어떤 것도 미리 작성된 고정 퀘스트일 필요가 없다.

각 주체의 현재 목적과 정보와 관계가 상호작용을 생성한다.

### 21.8 결과

**플레이어가 생물을 죽인 경우**

- 마을은 단기적으로 살아남는다.
- 결정체 시장이 활성화된다.
- 탐사 조직의 영향력이 증가한다.
- 해당 종의 번식이 실패한다.
- 생태계에서 열을 흡수하던 주체가 사라진다.
- 수년 뒤 산악 지대의 화산 활동이 증가할 수 있다.
- 생물 숭배 집단이 플레이어를 적대한다.

**플레이어가 알을 돌려준 경우**

- 생물은 열을 반환한다.
- 마을 일부는 플레이어를 배신자로 인식한다.
- 연구자는 새로운 생태 지식을 획득한다.
- 생물과 제한적 관계 가능성이 열린다.
- 밀수 조직이 플레이어 제거를 시도한다.

**플레이어가 사건의 진실을 공개한 경우**

- 탐사 조직의 평판이 하락한다.
- 마을 내부에서 정치 갈등이 발생한다.
- 국가가 정보 통제를 시도한다.
- 플레이어는 진실을 밝힌 영웅 또는 혼란을 일으킨 선동가가 된다.

---

## 22. AI 에이전트의 역할

생성형 AI가 런타임에서 세계의 진실을 마음대로 작성해서는 안 된다.

AI는 다음 역할에 사용한다.

### 22.1 오프라인 생성

- 종의 가능성 문법 초안
- 주체 배경과 가치관 생성
- 세계 요구 후보 생성
- 사건 설명문 생성
- 대화 표현 생성
- 시각 레시피 생성
- 검증용 시나리오 생성

### 22.2 런타임 비결정 영역

- 주체의 발화 표현
- 기억 요약
- 사건 서술
- 소문의 문체 변형
- 플레이어 자유 문장 해석

### 22.3 AI가 결정해서는 안 되는 것

- 실제 세계 상태
- 전투 판정
- 아이템 생성 여부
- 능력의 성공 여부
- 보상 지급
- 관계 수치 변경
- 법칙 예외 생성
- 서버 권위 상태

AI의 출력은 반드시 구조화된 제안이어야 한다.

```ts
interface AIProposal<T> {
  proposal: T;
  evidenceFactIds: string[];
  confidence: number;
  validationTags: string[];
}
```

규칙 엔진이 검증한 뒤에만 적용한다.

---

## 23. 검증 가능한 모듈 분할

### M01. 세계관 시드 모듈

**목적:**
최상위 불변 규칙과 세계 갈등을 정의한다.

**검증:**
- 모든 종과 능력이 최소 하나 이상의 불변 규칙에 연결되는가?
- 원인과 비용 없이 지속되는 효과가 존재하지 않는가?

### M02. 종 정의 모듈

**목적:**
종의 존재 조건과 가능성 문법을 생성한다.

**검증:**
- 종이 생존할 자원과 공간을 요구하는가?
- 종이 최소 두 개 이상의 다른 종과 관계를 형성할 수 있는가?
- 종의 강점에 대응하는 약점이 존재하는가?

### M03. 주체 인스턴스 모듈

**목적:**
종의 공통 특성으로부터 서로 다른 개인을 생성한다.

**검증:**
- 같은 현상을 관찰한 두 주체가 다른 해석을 생성하는가?
- 서로 모순되는 가치관 또는 욕구가 최소 하나 존재하는가?

### M04. 가능성 그래프 모듈

**목적:**
관찰·목적·행동·성장 가능성을 그래프로 표현한다.

**검증:**
- 모든 행동 노드가 목적에 연결되는가?
- 모든 목적에 두 개 이상의 달성 경로가 있는가?
- 실패 후 대체 경로가 생성되는가?

### M05. 세계 요구 추출 모듈

**목적:**
가능성으로부터 필요한 자원·공간·규칙을 추출한다.

**검증:**
- 세계 요소가 어떤 가능성 때문에 존재하는지 역추적 가능한가?
- 아무 주체도 사용하지 않는 요소가 생성되지 않는가?

### M06. 세계 합성 모듈

**목적:**
여러 주체의 요구를 병합해 하나의 세계 요소를 생성한다.

**검증:**
- 하나의 세계 요소가 최소 두 주체에게 서로 다른 의미를 제공하는가?
- 양립 불가능한 요구가 사건 가능성으로 변환되는가?

### M07. 규칙 엔진

**목적:**
행동의 가능 여부와 결과를 판정한다.

**검증:**
- 동일 초기 상태와 동일 행동에 동일 결과가 나오는가?
- 모든 상태 변화가 적용된 규칙을 기록하는가?

### M08. 현상·인식 모듈

**목적:**
실제 상태를 감각 가능한 현상으로 변환한다.

**검증:**
- 주체가 직접 관찰하지 못한 정보를 사용하지 않는가?
- 감각 능력에 따라 관찰 결과가 달라지는가?

### M09. 의사결정 모듈

**목적:**
주체의 가치관과 경험에 따라 행동을 선택한다.

**검증:**
- 같은 종의 다른 개인이 다른 행동 분포를 보이는가?
- 기억 추가 후 선택 확률이 변하는가?

### M10. 사건 엔진

**목적:**
행동 충돌을 사건으로 변환한다.

**검증:**
- 사건 이전과 이후의 상태 차이가 기록되는가?
- 사건 결과가 후속 가능성을 생성하는가?

### M11. 의미 공간 모듈

**목적:**
세계 요구를 이동 가능한 공간 그래프로 변환한다.

**검증:**
- 모든 핵심 목적에 도달 가능한 경로가 존재하는가?
- 능력에 따라 새로운 경로가 열리는가?

### M12. 3D 실체화 모듈

**목적:**
의미 공간을 지형과 오브젝트로 표현한다.

**검증:**
- 논리적 공간 연결과 실제 내비게이션이 일치하는가?
- 상호작용 대상이 시각적으로 식별 가능한가?

### M13. 성장 모듈

**목적:**
경험 결과를 가능성 그래프 변화로 반영한다.

**검증:**
- 전투 수치 상승 없이도 새로운 행동이 가능한가?
- 실패가 새로운 가능성이나 관계를 생성하는가?

### M14. 이벤트 리플레이 모듈

**목적:**
모든 사건을 재현하고 디버깅한다.

**검증:**
- 동일 시드와 이벤트 로그로 동일 세계 상태를 재구성할 수 있는가?

---

## 24. 프로토타입 구현 순서

### 단계 1. 그래프 기반 텍스트 시뮬레이션

3D를 만들기 전에 다음을 검증한다.

- 3종
- 10명의 주체
- 30개의 가능성 노드
- 5개의 세계 요소
- 3개의 공간
- 1000틱 시뮬레이션

**목표:**
- 주체가 서로 다른 행동을 하는가?
- 요청·거래·공격·동맹이 자연스럽게 발생하는가?
- 사건 결과가 다음 사건을 만드는가?

### 단계 2. 단일 3D 지역

- 1km × 1km
- 마을 1개
- 야생 지역 2개
- 동굴 1개
- 주체 20명
- 생물 종 3개
- 조직 2개

텍스트 시뮬레이션의 상태를 Three.js로 표현한다.

### 단계 3. 능력과 조건 시스템

- 의지 에너지
- 발동 조건
- 대상 지정
- 비용
- 저항
- 능력 흔적
- 관찰 가능한 현상

### 단계 4. 지역 추상화와 스트리밍

- 활성 지역
- 축약 지역
- 추상 지역
- 지역 간 사건 전파
- 주체 승격 및 축소

### 단계 5. 조직과 정보 시스템

- 조직 목적
- 구성원 역할
- 소문
- 비밀
- 평판
- 계약
- 배신

### 단계 6. 생성 도구

- 종 편집기
- 가능성 그래프 편집기
- 규칙 편집기
- 사건 리플레이어
- 공간 그래프 시각화
- 주체 의사결정 디버거

---

## 25. 필수 개발 도구 화면

### 가능성 그래프 인스펙터

표시 항목:

- 현재 주체
- 현재 욕구
- 관찰한 현상
- 현상 해석
- 활성화된 가능성
- 각 가능성의 점수
- 선택한 행동
- 선택하지 않은 이유

### 세계 요소 역추적기

세계 요소를 클릭하면 표시:

- 이 요소를 요구한 주체
- 연결된 가능성 노드
- 적용된 세계 규칙
- 현재 이해관계자
- 발생 가능한 사건

### 사건 리플레이어

- 사건 발생 전 상태
- 각 주체의 의도
- 제출된 행동
- 충돌한 규칙
- 판정 결과
- 상태 변화
- 생성된 기억
- 새로 열린 가능성

---

## 26. 최종 구조

```
세계관
└─ 세계의 절대 명제와 미지의 범위

종
└─ 존재 방식과 가능성 생성 문법

개별 주체
└─ 성향·가치관·경험·관계·능력

가능성 그래프
└─ 관찰·해석·목적·행동·성장 가능성

세계 요구
└─ 가능성을 성립시키기 위해 필요한 조건

세계 합성
└─ 여러 주체의 요구 병합과 충돌

세계 상태 및 규칙
└─ 실제로 무엇이 가능하고 어떤 결과가 발생하는가

의미 공간
└─ 대상과 주체가 어디에서 어떻게 만날 수 있는가

3D 실체화
└─ 지형·생물·건물·효과·소리·흔적으로 표현

사건
└─ 여러 주체의 행동이 충돌하거나 결합한 결과

성장
└─ 사건이 주체의 가능성 그래프를 변화시키는 과정
```

---

## 27. 핵심 설계 원칙

1. 주체 의존도 그래프가 세계보다 먼저다.
2. 세계 요소는 반드시 하나 이상의 주체 가능성으로부터 존재 이유를 가져야 한다.
3. 하나의 세계 요소는 가능하면 여러 주체에게 서로 다른 의미를 제공해야 한다.
4. 주체는 실제 상태가 아니라 자신이 관찰한 현상에 반응한다.
5. 행동은 고정 조건문이 아니라 성향·경험·관계에 따른 확률 분포로 선택된다.
6. 능력은 스킬 목록이 아니라 개인의 가치관·제약·대가가 실체화된 것이다.
7. 퀘스트는 별도 데이터가 아니라 주체 간 협력 제안의 표현이다.
8. 사건은 행동 충돌의 결과이며, 모든 사건은 후속 가능성을 생성해야 한다.
9. 성장은 수치 상승보다 가능한 행동과 세계 해석 범위의 확장이다.
10. 세계는 추상 상태, 축약 시뮬레이션, 활성 3D 상태로 단계적으로 실체화한다.
11. 생성형 AI는 표현과 초안을 담당하고, 세계의 진실과 판정은 결정론적 시스템이 담당한다.
12. 모든 세계 상태 변화는 원인, 적용 규칙, 비용, 결과를 역추적할 수 있어야 한다.

---

## 결론

이 설계에서 세계는 먼저 완성된 무대가 아니다.

각 주체는 자기 존재를 중심으로 다음을 생성한다.

- 무엇을 원할 수 있는가
- 무엇을 두려워할 수 있는가
- 누구와 관계를 맺을 수 있는가
- 어떤 방식으로 성장할 수 있는가
- 어떤 세계가 있어야 그 가능성이 성립하는가

여러 주체가 제출한 가능성의 요구가 겹치면 자원·공간·조직·생물이 생성된다.

요구가 양립할 수 없으면 갈등이 생성된다.

갈등을 해결하려는 행동들이 세계 규칙 아래에서 충돌하면 사건이 발생한다.

사건은 기억과 관계와 능력과 공간을 변화시키며, 그 결과 새로운 가능성이 열린다.

따라서 이 MMORPG의 실제 콘텐츠 생성 루프는 다음과 같다.

```
주체
→ 가능성
→ 세계 요구
→ 세계 실체화
→ 관찰
→ 해석
→ 행동
→ 충돌
→ 사건
→ 결과
→ 성장
→ 새로운 가능성
```

이 루프가 완성되면 개발자가 수천 개의 퀘스트를 작성하지 않아도, 서로 다른 삶의 주인공인 주체들이 세계의 동일한 대상에 서로 다른 의미와 목적을 부여하면서 지속적으로 새로운 콘텐츠를 생성할 수 있다.
