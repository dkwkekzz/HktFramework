# 주체-기원 가능성 세계
## 3D 오픈월드 MMORPG 전체 시스템 설계도

## 1. 설계의 핵심 명제

이 게임에서 세계는 주체가 원하는 결과를 만들어 주지 않는다.

세계가 만들어 주는 것은 **그 결과를 시도할 수 있는 조건과 가능성**이다. 실제 결과는 여러 주체가 같은 자원·공간·정보·관계·규칙을 서로 다르게 이용하려 하면서 결정된다.

따라서 핵심 문장은 다음과 같이 정리해야 한다.

> **모든 주체는 자기 존재를 유지하고 확장하기 위한 가능성 그래프를 가진다.
> 각 가능성은 세계에 필요한 조건을 요구한다.
> 세계는 여러 주체가 요구한 조건을 하나의 공통된 공간·상태·규칙으로 실체화한다.
> 실체화된 세계 안에서 주체들의 행동이 충돌하고, 그 충돌의 결과로 사건과 성장이 발생한다.**

여기에는 서로 반대 방향의 두 인과관계가 존재한다.

### 세계 생성 방향

```text
세계관 공리
    ↓
주체 원형
    ↓
종·문화·조직별 가능성 문법
    ↓
개별 주체의 가능성 그래프
    ↓
세계 요구 집합
    ↓
세계 컴파일러
    ↓
공간·상태·규칙·자원·역사 실체화
```

### 실제 플레이 방향

```text
실체화된 세계
    ↓ 현상 발생
주체의 지각과 해석
    ↓
목적 활성화
    ↓
행동과 상호작용
    ↓
세계 규칙에 의한 충돌 해결
    ↓
사건과 결과
    ↓
기억·관계·능력·세계 상태 변화
    ↓
새로운 가능성 그래프 활성화
```

따라서 사용자가 제시한 구조는 플레이어가 세계를 경험하는 순서로는 맞지만, 시스템 생성 구조로는 순환형으로 바뀌어야 한다.

```text
세계관 → 세계 공간 → 세계 규칙 → 플레이어 → 상호작용 → 성장
   ↑                                                        ↓
   └──── 주체의 새 가능성 요구 ← 기억·관계·능력 변화 ──────┘
```

---

# 2. 이 시스템에서 사용하는 최소 존재론

세계의 모든 콘텐츠는 다음 아홉 개의 개념으로 표현한다.

| 개념                | 의미                                  |
| ----------------- | ----------------------------------- |
| 주체 `Subject`      | 목적을 만들고, 관찰하고, 행동하고, 기억하는 존재        |
| 실체 `Entity`       | 몸, 사물, 건물, 생물, 영토, 기록물처럼 세계에 존재하는 것 |
| 상태 `State`        | 현재 세계가 어떤 모습인지 나타내는 값               |
| 현상 `Phenomenon`   | 주체가 감각하거나 추론할 수 있는 상태 변화의 흔적        |
| 주장 `Claim`        | 어떤 주체가 사실이라고 믿는 명제                  |
| 약속 `Commitment`   | 미래의 특정 상태를 만들기로 한 사회적·능력적 구속        |
| 가능행위 `Affordance` | 실체나 공간이 허용하는 행동                     |
| 규칙 `Rule`         | 행동과 상태를 새로운 상태로 변환하는 인과관계           |
| 사건 `Event`        | 실제로 적용된 행동·규칙·상태 변화의 기록             |

이 중에서 특히 중요한 것은 `Claim`과 `Commitment`다.

`Claim`은 정보, 소문, 오해, 거짓말, 비밀, 수사, 정치 콘텐츠를 통합한다.
`Commitment`는 퀘스트, 계약, 동맹, 협박, 맹세, 능력의 제약, 국가 간 조약, 신과의 서약을 통합한다.

즉, NPC가 플레이어에게 어떤 일을 부탁하면 그것은 미리 작성된 퀘스트가 아니라 다음과 같은 사건이다.

```text
NPC의 목적 달성에 필요한 능력이 부족하다
    ↓
NPC가 플레이어에게 그 능력이 있다고 믿는다
    ↓
NPC가 플레이어를 이용하는 것이 다른 방법보다 유리하다고 판단한다
    ↓
요청·거래·협박·기만 중 하나를 선택한다
    ↓
플레이어가 받아들이면 Commitment가 생성된다
```

퀘스트 UI는 이 `Commitment`를 플레이어가 이해할 수 있게 표시하는 표현 계층일 뿐이다.

---

# 3. 세계의 수학적 구조

세계는 다음과 같이 표현한다.

[
W_t = \langle X_t, R_t, \Omega_t, H_t, L_t \rangle
]

* (X_t): 시점 (t)의 실제 세계 상태
* (R_t): 적용 가능한 세계 규칙 집합
* (\Omega_t): 3D 공간과 지역 위상
* (H_t): 지금까지 발생한 사건 기록
* (L_t): 아직 완전히 실체화되지 않은 잠재 세계 조건

각 주체 (S_i)는 다음과 같다.

[
S_i = \langle B_i, D_i, V_i, T_i, M_i, Rel_i, Cap_i, G_i \rangle
]

* (B_i): 세계에 대한 주체의 믿음
* (D_i): 생존·보호·탐구·지배 등 욕구
* (V_i): 가치관
* (T_i): 성격과 행동 경향
* (M_i): 기억
* (Rel_i): 다른 주체들과의 관계
* (Cap_i): 현재 수행할 수 있는 능력
* (G_i): 가능성 그래프

주체는 실제 세계 상태 (X_t)를 직접 읽지 않는다.

```text
실제 사건
    ↓
빛·소리·냄새·흔적·소문·보고서·능력 잔향
    ↓
주체의 감각과 지식으로 필터링
    ↓
주체가 믿는 사건
    ↓
목적과 행동 결정
```

따라서 동일한 거대 마물의 발자국을 보더라도 다음과 같이 다른 반응이 나온다.

* 사냥꾼은 희귀 개체의 추적 기회로 해석한다.
* 상인은 무역로 단절 가능성으로 해석한다.
* 국가 관료는 통치력 약화의 증거로 해석한다.
* 종교인은 신의 징조로 해석한다.
* 마물의 새끼는 부모의 흔적으로 해석한다.
* 범죄 조직은 경비가 비워질 기회로 해석한다.

주체의 다양성은 행동 목록의 차이가 아니라 **동일한 현상을 다른 의미로 해석하는 차이**에서 시작한다.

---

# 4. 세계관은 콘텐츠 목록이 아니라 공리다

세계관은 지역, NPC, 몬스터의 목록을 미리 정하는 것이 아니다. 세계가 생성할 수 있는 가능성의 범위를 제한하는 헌법이다.

세계관 공리는 세 단계로 구성한다.

## 4.1 메타 공리

절대 바뀌지 않는 세계의 기본 원리다.

예시는 다음과 같다.

```text
1. 모든 강력한 변화에는 비용이나 위험이 존재한다.
2. 주체는 자신이 감지하거나 믿는 정보에 따라 행동한다.
3. 의지는 물질과 생명에 인과적 흔적을 남길 수 있다.
4. 반복된 집단적 행동은 독립된 사회적·초월적 주체가 될 수 있다.
5. 생명은 환경을 변화시키고, 변화된 환경은 생명의 가능성을 다시 바꾼다.
6. 어떤 능력도 완전히 흔적 없이 작동할 수 없다.
7. 알려진 세계 밖에는 기존 공리의 다른 조합이 존재할 수 있다.
```

## 4.2 규칙 계열

메타 공리로부터 생성 가능한 규칙의 종류다.

```text
생명 에너지 규칙
의도 각인 규칙
서약과 위반 규칙
물질 변환 규칙
생태 적응 규칙
영역 지배 규칙
정보 은폐 규칙
집단 신앙 규칙
국가와 제도의 집행 규칙
```

## 4.3 규칙 인스턴스

개별 인물, 능력, 마물, 신, 지역에 붙는 구체적인 규칙이다.

예를 들어 “의지는 인과에 흔적을 남길 수 있다”는 메타 공리로부터 다음이 나온다.

```text
메타 공리
  의지는 인과에 흔적을 남긴다
      ↓
규칙 계열
  약속을 조건으로 힘을 증폭할 수 있다
      ↓
개별 규칙
  특정 인물이 자신의 이름을 걸고 약속한 동안만
  왼손으로 받은 피해를 오른손의 공격력으로 전환한다
```

새로운 능력이 생길 때마다 세계의 근본 물리법칙을 새로 만드는 것이 아니다. 기존 공리가 허용하는 규칙 계열로부터 제한된 규칙 인스턴스를 만드는 것이다.

---

# 5. 예시 세계관: 무경계권

이 설계를 검증하기 위한 독자적 예시 세계관을 다음과 같이 둔다.

## 5.1 세계관 공리

```yaml
id: boundless-verge
themes:
  - 미지의 세계
  - 생존 방식의 충돌
  - 개인적 힘의 대가
  - 정보 비대칭
  - 인간과 초월적 생명체의 공존
meta_axioms:
  - 생명은 의지장을 발생시킨다
  - 충분히 일관된 의지는 자신과 주변의 인과를 제한할 수 있다
  - 강한 인과 제한은 반드시 검증 가능한 비용을 요구한다
  - 반복된 집단 행동은 독립적인 초월 주체를 만들 수 있다
  - 거대 생물은 지역 생태와 규칙을 몸에 내장한다
  - 모든 초월 현상은 관찰 가능한 흔적을 남긴다
scale:
  minimum: 개인
  maximum: 대륙·신적 존재
```

문명권 바깥에는 인간의 통제에 들어오지 않은 광대한 미지의 영역이 존재한다. 그곳에는 도시보다 큰 생물, 이동하는 생태계, 특정 현상 자체가 자아를 얻은 신적 존재가 존재한다.

인간류는 생명과 의지를 다루는 능력 계층을 가진다. 여기서는 작업명을 **의념맥**이라고 한다. 사용자가 말한 인간류의 넨에 해당하는 시스템 계층이다.

마물은 인간처럼 의념맥을 학습하기보다, 생태와 기관을 통해 세계 규칙을 직접 구현한다.

신적 존재는 반복된 맹세, 공포, 숭배, 금기, 생태 순환 등이 독립된 주체로 굳어진 존재다.

이렇게 하면 인간, 마물, 신은 모두 강력하지만 힘을 얻는 원리가 서로 다르다.

---

# 6. 모든 주체는 자기 삶의 주인공이다

주체로 인정되기 위한 조건은 다음과 같다.

```text
자기 경계가 있다.
현재 상태를 유지하거나 바꾸려는 방향성이 있다.
세계를 감지하는 방식이 있다.
상태를 바꿀 행동 수단이 있다.
과거 사건의 영향을 보존한다.
```

그러므로 다음은 모두 같은 `Subject` 인터페이스를 구현할 수 있다.

* 플레이어
* NPC
* 일반 생물
* 거대 마물
* 인간 종족
* 부족
* 상단
* 범죄 조직
* 종교
* 국가
* 신
* 도시
* 자율적으로 유지되는 생태계

다만 조직이나 국가는 추상적인 의지만으로 행동할 수 없다.

국가가 전쟁을 원하면 실제로는 다음 과정이 필요하다.

```text
국가 주체가 전쟁 목적을 활성화
    ↓
통치 구조가 명령을 생성
    ↓
지휘관과 관료가 명령을 전달
    ↓
군인과 보급 조직이 행동
    ↓
실제 자원과 인력이 이동
```

국가 내부의 구성원이 명령을 거부하거나 배신하면 국가의 목적은 실패할 수 있다.

따라서 조직은 다음 상태를 가진 복합 주체다.

```ts
interface CollectiveSubjectState {
  memberIds: string[];
  assets: string[];
  territories: string[];
  treasury: number;
  legitimacy: number;
  cohesion: number;
  secrecy: number;
  governance:
    | { type: "hierarchy"; leaderId: string }
    | { type: "council"; factionWeights: Record<string, number> }
    | { type: "consensus" }
    | { type: "ritual"; oracleSubjectId: string };
  factions: FactionState[];
}
```

조직의 가능성 그래프는 구성원의 그래프를 덮어쓰지 않는다. 둘은 동시에 존재하며 충돌할 수 있다.

---

# 7. 목적 트리를 가능성 그래프로 바꾼다

## 7.1 목적과 가능성은 다르다

목적은 지금 주체가 선택한 변화 방향이다.

가능성은 특정한 현상을 마주했을 때 선택될 수 있는 잠재적인 해석·목적·전략·행동이다.

따라서 목적 트리보다는 다음과 같은 유형 그래프가 적절하다.

```text
현상 패턴
    ↓
해석 가능성
    ↓
관심·욕구 활성화
    ↓
목적 후보
    ↓
전략 후보
    ↓
행동 후보
    ↓
예상 결과
    ↓
성장·기억 변화
```

## 7.2 가능성 그래프의 노드

| 노드 유형 | 역할                   |
| ----- | -------------------- |
| 현상 패턴 | 주체가 반응할 수 있는 관찰 특징   |
| 해석    | 현상이 무엇을 의미한다고 믿는지    |
| 관심    | 어떤 욕구나 가치가 자극되었는지    |
| 목적    | 어떤 상태를 만들고 싶은지       |
| 전략    | 목적 달성을 위해 어떤 접근을 할지  |
| 행동    | 실제 세계에 제출할 행위        |
| 결과 예상 | 성공·실패·부작용에 대한 예측     |
| 성장    | 경험이 가능성 그래프를 어떻게 바꿀지 |

## 7.3 간선의 종류

```text
분해한다
대체한다
필요로 한다
허용한다
강화한다
억제한다
충돌한다
숨긴다
실패 시 전환한다
특정 관계에서만 허용한다
특정 경험 후 활성화한다
```

목적 그래프가 트리가 아니라 그래프여야 하는 이유는 하나의 행동이 여러 목적에 동시에 사용될 수 있기 때문이다.

예를 들어 “거대 마물의 심장을 확보한다”는 행동은 다음 목적들에 동시에 연결될 수 있다.

* 가족의 병을 치료한다.
* 조직에 가입하기 위한 자격을 얻는다.
* 무기를 제작한다.
* 국가의 군사 연구를 방해한다.
* 마물 숭배 종교의 의식을 완성한다.
* 죽은 마물의 새끼를 유인한다.
* 자신의 의념 능력을 각성한다.

---

# 8. 모든 가능성을 열거하지 않고 문법으로 생성한다

“종마다 가능한 모든 행동을 트리에 넣는다”는 개념은 설계상 맞지만, 구현에서 모든 노드를 미리 열거하면 조합 폭발이 발생한다.

따라서 종은 완성된 거대한 트리가 아니라 **가능성 생성 문법**을 가진다.

## 8.1 행동 원자

```text
획득한다
보호한다
제거한다
이동시킨다
변형한다
교환한다
결합한다
분리한다
은폐한다
드러낸다
설득한다
속인다
강제한다
복종한다
연합한다
배신한다
관찰한다
탐험한다
모방한다
계승한다
초월한다
```

가능성 문법은 행동 원자와 다음 요소를 조합한다.

```text
행동 × 대상 × 수단 × 관계 × 비용 × 위험 × 시간 × 장소 × 사회적 태도
```

예를 들어 다음 노드는 필요할 때 생성된다.

```text
행동: 획득한다
대상: 거대 마물의 심장
수단: 직접 사냥
관계: 경쟁 조직보다 먼저
비용: 동료의 부상 가능성
위험: 국가의 금지법 위반
시간: 폭풍이 시작되기 전
장소: 국경 협곡
```

## 8.2 개별 주체의 그래프 생성

```text
종 가능성 문법
    +
문화 가능성 문법
    +
직업·조직 가능성 문법
    +
신체와 능력
    +
개인 가치관
    +
과거 경험
    +
현재 관계
    =
개별 가능성 그래프
```

그래프로 표현하면 다음과 같다.

[
G_i =
G_{\text{species}}
\oplus G_{\text{culture}}
\oplus G_{\text{role}}
\oplus G_{\text{personal}}
\oplus G_{\text{history}}
]

실행 중에는 전체 그래프를 펼치지 않는다.

각 주체는 다음만 유지한다.

```text
활성 관심 노드: 4~8개
활성 목적 노드: 2~4개
목적별 전략 후보: 3~6개
행동 탐색 깊이: 2~4단계
장기 잠재 노드: 문법 형태로 보관
```

---

# 9. 주체는 상태가 아니라 현상에 확률적으로 반응한다

특정 상태가 되면 무조건 특정 행동을 실행하는 방식은 캐릭터를 기계적으로 만든다.

대신 각 가능성 노드는 “어떤 현상을 얼마나 중요하게 해석하는가”를 가진다.

노드 활성도는 다음 요소로 계산한다.

[
A(v) =
N(v) + V(v) + T(v) + M(v) + R(v) + F(v)
* C(v) - Risk(v) - Taboo(v)
  ]

* (N): 현재 욕구의 긴급도
* (V): 가치관과의 일치
* (T): 성격과의 일치
* (M): 관련 기억
* (R): 대상과의 관계
* (F): 행동 가능성
* (C): 비용
* (Risk): 위험
* (Taboo): 금기 위반

선택 확률은 다음과 같이 만들 수 있다.

[
P(v) =
\text{Softmax}\left(
\frac{A(v)+\epsilon}{Temperature}
\right)
]

* 충동적인 주체는 `Temperature`가 높다.
* 엄격하고 일관적인 주체는 낮다.
* 공포나 혼란은 일시적으로 높일 수 있다.
* 맹세와 책임은 특정 노드에 지속적인 가중치를 준다.

다만 매 순간 무작위 선택을 하면 캐릭터의 일관성이 사라진다. 다음 항목을 추가해야 한다.

```text
현재 목적에 대한 집착도
이미 투자한 비용
타인에게 한 약속
자기 정체성과의 일치
목표를 포기했을 때의 수치심
성공 직전인지 여부
```

이를 `Commitment Inertia`로 관리한다.

---

# 10. 핵심 TypeScript 데이터 구조

```ts
export type Id = string;
export type Tag = string;

export interface SubjectState {
  id: Id;
  kind:
    | "player"
    | "person"
    | "creature"
    | "giant_beast"
    | "organization"
    | "nation"
    | "god";
  speciesId?: Id;
  bodyEntityIds: Id[];
  needs: Record<string, number>;
  values: Record<string, number>;
  traits: Record<string, number>;
  emotions: Record<string, number>;
  capabilities: Id[];
  resources: Record<Id, number>;
  beliefGraphId: Id;
  memoryStoreId: Id;
  possibilityGraphId: Id;
  relations: Record<Id, RelationState>;
  commitments: Commitment[];
  activeIntentIds: Id[];
  decisionCounter: number;
}

export interface RelationState {
  trust: number;
  fear: number;
  respect: number;
  affection: number;
  resentment: number;
  debt: number;
  ideologicalAffinity: number;
  leverage: number;
}

export interface Phenomenon {
  id: Id;
  sourceEntityId?: Id;
  sourceSubjectId?: Id;
  tags: Tag[];
  channels: Array<
    "visual" | "audio" | "smell" | "touch" |
    "aura" | "report" | "rumor" | "memory"
  >;
  measurements: Record<string, number>;
  location?: [number, number, number];
  occurredAtTick: number;
  evidenceIds: Id[];
}

export type PossibilityNodeType =
  | "interpretation"
  | "concern"
  | "goal"
  | "strategy"
  | "action"
  | "expected_outcome"
  | "growth";

export interface PossibilityNode {
  id: Id;
  type: PossibilityNodeType;
  tags: Tag[];
  phenomenonPatterns: PredicateSpec[];
  activationWeights: Record<string, number>;
  desiredState?: PredicateSpec;
  actionTemplates?: ActionTemplate[];
  worldRequirements: WorldRequirement[];
  growthEffects?: GrowthEffect[];
  cooldownTicks?: number;
  commitmentStrength?: number;
}

export interface PossibilityEdge {
  from: Id;
  to: Id;
  type:
    | "requires"
    | "enables"
    | "alternative"
    | "conflicts"
    | "decomposes"
    | "failure_transition"
    | "relationship_condition"
    | "learns_into";
  condition?: PredicateSpec;
  weight: number;
}

export interface Commitment {
  id: Id;
  promisorId: Id;
  promiseeId?: Id;
  promisedState: PredicateSpec;
  deadlineTick?: number;
  consideration?: ResourceTransfer[];
  breachEffects: EffectSpec[];
  public: boolean;
  acceptedAtTick: number;
}

export interface Claim {
  id: Id;
  proposition: PredicateSpec;
  sourceSubjectId?: Id;
  holderSubjectId: Id;
  confidence: number;
  observedDirectly: boolean;
  evidenceIds: Id[];
  createdAtTick: number;
}
```

---

# 11. 가능성 노드는 세계에 결과가 아니라 요구를 제출한다

가능성 노드가 “희귀 치료제가 존재해야 한다”고 요구했다고 해서 치료제가 NPC 앞에 생성되어서는 안 된다.

노드는 다음과 같은 요구를 제출해야 한다.

```text
특정 병을 완화할 물질이 존재할 수 있어야 한다.
그 물질을 가진 생물이나 환경이 존재해야 한다.
물질을 얻는 데 위험이나 비용이 있어야 한다.
효능을 판별할 정보나 실험 방법이 있어야 한다.
다른 주체도 그 물질을 원할 수 있어야 한다.
물질을 대체할 다른 경로가 있을 수 있어야 한다.
```

즉, 세계는 성공을 제공하는 것이 아니라 **도전 가능한 구조**를 제공한다.

## 11.1 세계 요구 유형

```ts
export type WorldRequirementKind =
  | "affordance"
  | "state_schema"
  | "rule_family"
  | "space"
  | "resource"
  | "counterpart"
  | "information"
  | "time_window"
  | "history";

export interface WorldRequirement {
  id: Id;
  kind: WorldRequirementKind;
  predicate: PredicateSpec;
  tags: Tag[];
  scope: "self" | "local" | "regional" | "global";
  importance: number;
  rarity: number;
  sponsorSubjectIds: Id[];
  compatibleWith: Tag[];
  conflictsWith: Tag[];
  visibility:
    | "private"
    | "latent"
    | "foreshadowed"
    | "public";
  canReuseExistingRealization: boolean;
}
```

## 11.2 규모에 따른 실체화 조건

| 요구 규모 | 실체화 조건                            |
| ----- | --------------------------------- |
| 개인    | 한 주체의 신체·능력 내부에서 해결 가능            |
| 지역    | 세계관 공리와 호환되고 실제 공간적 근거가 필요        |
| 광역    | 여러 종류의 주체가 같은 요소를 이용할 가능성이 있어야 함  |
| 세계    | 세계관 공리 또는 다수 문명·종·역사적 요구가 뒷받침해야 함 |

개인이 “나를 위해 새로운 대륙이 필요하다”고 바란다고 해서 대륙이 생기지 않는다.

그러나 개인의 능력 내부에 제한적인 사적 규칙을 만드는 것은 한 주체의 요구만으로도 가능하다.

---

# 12. 세계 컴파일러

세계 컴파일러는 여러 주체가 제출한 요구를 하나의 공통 세계로 결합한다.

## 12.1 컴파일 절차

```text
1. 요구 수집
2. 요구 정규화
3. 같은 실체로 충족 가능한 요구 군집화
4. 기존 세계에서 재사용 가능한 실체 탐색
5. 새로운 실체화 후보 생성
6. 세계관 공리와 규칙 충돌 검사
7. 다른 주체의 반대 요구와 결합
8. 3D 공간에 배치
9. 지역의 압축된 과거 시뮬레이션
10. 세계 패치 확정
11. 요구와 실체 사이의 근거 기록
```

세계 실체화 후보의 점수는 다음과 같이 계산할 수 있다.

[
Score(r)=
Coverage \times Diversity \times Interaction
\times Reuse \times ThemeFit \times Reachability
* Cost - Contradiction - Redundancy
  ]

* `Coverage`: 몇 개의 요구를 충족하는가
* `Diversity`: 서로 다른 종류의 주체가 이용하는가
* `Interaction`: 충돌이나 협력 가능성이 높은가
* `Reuse`: 기존 규칙과 실체를 재사용하는가
* `ThemeFit`: 세계관 공리와 어울리는가
* `Reachability`: 실제로 접근하고 시도할 수 있는가
* `Cost`: 구현·서버·렌더링 비용
* `Contradiction`: 기존 세계와 모순되는 정도
* `Redundancy`: 이미 같은 역할을 하는 요소가 존재하는가

가장 좋은 월드 오브젝트는 하나의 요구만 충족하는 오브젝트가 아니다.

예를 들어 거대 마물의 기관 하나가 다음 역할을 동시에 수행해야 한다.

```text
인간의 치료 재료
국가의 무기 연구 자원
종교의 성물
다른 마물의 먹이
마물 새끼를 부르는 냄새 근원
의념 능력의 증폭 매개체
암시장 경제의 핵심 상품
```

이렇게 해야 하나의 사물이 여러 가능성 그래프를 연결한다.

## 12.2 구현 의사 코드

```ts
export function compileWorld(
  requirements: readonly WorldRequirement[],
  world: ReadonlyWorldState,
  seed: bigint
): WorldPatch {
  const normalized = normalizeRequirements(requirements);
  const clusters = clusterBySharedRealization(normalized);
  const patch = createEmptyWorldPatch();

  for (const cluster of clusters) {
    const existing = findExistingRealizations(cluster, world);
    const candidates = [
      ...existing,
      ...generateRealizationCandidates(cluster, world, seed)
    ];

    const ranked = candidates
      .map(candidate => ({
        candidate,
        score: scoreRealization(candidate, cluster, world)
      }))
      .sort((a, b) => b.score - a.score);

    const selected = ranked.find(result =>
      validateWorldCandidate(result.candidate, world, patch)
    );

    if (!selected) {
      patch.latentRequirements.push(...cluster);
      continue;
    }

    applyCandidateToPatch(selected.candidate, patch);
    recordRequirementProvenance(cluster, selected.candidate, patch);
  }

  validateWorldPatch(patch, world);
  return patch;
}
```

---

# 13. 잠재 세계와 이미 관찰된 세계를 구분한다

미지의 세계를 계속 확장하려면 아직 방문하지 않은 지역을 전부 미리 만들 필요는 없다.

대신 세계는 다음 네 단계를 가진다.

| 단계                | 상태                         |
| ----------------- | -------------------------- |
| 잠재 `Latent`       | 요구와 대략적인 제약만 존재            |
| 암시 `Foreshadowed` | 소문·지도·흔적으로 일부 조건이 공개됨      |
| 정식화 `Canonical`   | 공간·규칙·역사가 생성되어 서버 상태가 됨    |
| 관찰 `Observed`     | 플레이어나 주체가 직접 확인하여 임의 수정 불가 |

예를 들어 먼 지역에 “불을 먹는 생물이 있다”는 소문이 퍼졌다면 아직 정확한 생김새와 서식지는 정하지 않아도 된다.

그러나 다음 조건은 고정된다.

```text
불과 관련된 대사 작용을 가진다.
소문의 출처가 존재한다.
불을 먹었다고 판단할 만한 흔적을 남긴다.
해당 지역의 생태와 양립해야 한다.
```

플레이어가 접근할 때 이 조건을 만족하는 구체적인 종과 지역을 생성한다.

이미 관찰된 사실을 뒤집어 새 세계를 끼워 넣어서는 안 된다.

---

# 14. 세계 상태 구조

세계 상태는 다음 계층으로 나눈다.

| 계층 | 주요 상태                     |
| -- | ------------------------- |
| 물리 | 위치, 속도, 질량, 충돌, 온도, 구조 손상 |
| 생물 | 체력, 조직, 질병, 허기, 번식, 변이    |
| 생태 | 개체군, 먹이 관계, 서식지, 이동 경로    |
| 의념 | 생명장, 집중, 각인, 서약, 잔향       |
| 사회 | 신뢰, 공포, 존경, 원한, 채무, 평판    |
| 제도 | 법, 지위, 시민권, 소유권, 명령 체계    |
| 경제 | 재고, 희소성, 생산, 운송, 가격 기대    |
| 정보 | 주장, 증거, 소문, 비밀, 보고서       |
| 초월 | 신의 영역, 지역 규칙, 금기, 숭배 상태   |

중요한 것은 실제 상태와 주체가 믿는 상태를 분리하는 것이다.

```text
CanonicalState
  서버가 보유한 실제 상태
BeliefState
  개별 주체가 믿는 상태
PublicRecordState
  제도나 사회가 공식적으로 인정하는 상태
RumorState
  사회망을 통해 전파되는 불확실한 주장
```

국가가 공식적으로 범인이라고 발표한 인물과 실제 범인이 다를 수 있다.

NPC는 실제 범인이 아니라 자신이 범인이라고 믿는 주체를 추적한다.

이 차이가 정치, 수사, 배신, 음모 콘텐츠의 근원이 된다.

---

# 15. 세계 규칙 구조

## 15.1 규칙 우선순위

```text
L0. 메타 공리
L1. 물리·생명 기본 규칙
L2. 종과 신체 규칙
L3. 의념·마물 기관·신적 능력 규칙
L4. 지역 특수 규칙
L5. 사회·제도 규칙
L6. 개인의 계약·맹세·능력 제약
```

낮은 단계의 규칙은 높은 단계의 규칙이 허용하는 범위 안에서만 예외를 만들 수 있다.

예를 들어 순간이동 능력은 “아무 비용 없이 어느 곳으로든 이동한다”가 아니라 다음과 같이 표현해야 한다.

```text
공간 이동이라는 규칙 계열이 세계관에서 허용된다.
사용자가 대상 장소를 인지하고 있어야 한다.
지정된 매개체가 양쪽에 존재해야 한다.
거리에 따라 생명 에너지를 소비한다.
이동 흔적이 남는다.
영역 봉쇄 규칙에 막힐 수 있다.
```

## 15.2 하드 규칙과 소프트 규칙

하드 규칙은 행동 자체를 물리적으로 제한한다.

```text
벽을 통과할 수 없다.
에너지가 없으면 능력을 사용할 수 없다.
죽은 신체는 일반 행동을 수행할 수 없다.
```

소프트 규칙은 행동을 허용하지만 결과를 만든다.

```text
절도는 가능하다.
다만 목격자와 증거가 생길 수 있다.
국가가 인지하면 추적 명령이 생성될 수 있다.
조직 평판과 관계가 변할 수 있다.
```

사회적 법률이 플레이어의 버튼을 막아서는 안 된다. 법률은 집행 주체가 존재할 때만 실제 힘을 가진다.

## 15.3 규칙 DSL

규칙은 임의 JavaScript 실행 코드가 아니라 데이터 AST로 저장한다.

```ts
export interface RuleSpec {
  id: Id;
  scope: RuleScope;
  priority: number;
  when: PredicateSpec;
  requires?: PredicateSpec;
  costs: EffectSpec[];
  effects: EffectSpec[];
  emits: PhenomenonSpec[];
  failureEffects?: EffectSpec[];
  tags: Tag[];
}

export type EffectSpec =
  | { op: "add"; path: string; value: number }
  | { op: "multiply"; path: string; value: number }
  | { op: "set"; path: string; value: unknown }
  | { op: "transfer"; from: string; to: string; amount: number }
  | { op: "attach_tag"; target: string; tag: Tag }
  | { op: "remove_tag"; target: string; tag: Tag }
  | { op: "create_commitment"; templateId: Id }
  | { op: "breach_commitment"; commitmentIdPath: string }
  | { op: "schedule_event"; eventTemplateId: Id; delayTicks: number };
```

AI나 콘텐츠 생성기는 규칙 AST를 제안할 수 있지만 임의 코드를 서버에 삽입할 수 없다.

---

# 16. 인간류의 의념 능력 시스템

헌터헌터 수준의 특색 있는 캐릭터를 만들려면 능력이 단순한 스킬 목록이어서는 안 된다.

능력은 캐릭터의 다음 요소로부터 생성되어야 한다.

```text
가장 강한 욕망
가장 두려운 상실
절대로 포기하지 않을 가치
익숙하게 사용하는 수단
감수할 수 있는 대가
자기 자신에게 내릴 수 있는 제한
타인에게 숨기고 싶은 약점
```

## 16.1 의념의 기본 조작

인간류가 공통적으로 학습할 수 있는 원자 조작을 둔다.

| 조작 | 기능                  |
| -- | ------------------- |
| 감응 | 생명장·의도·잔향을 감지       |
| 피복 | 신체나 물체를 의념으로 보호·강화  |
| 응축 | 제한된 지점에 의념을 모음      |
| 방사 | 의념을 몸 밖으로 전달        |
| 전환 | 한 종류의 상태를 다른 상태로 변환 |
| 각인 | 대상·장소·약속에 규칙을 부여    |
| 연결 | 둘 이상의 대상 상태를 연동     |
| 구현 | 의념으로 일시적 구조나 존재를 형성 |

개별 능력은 이 원자 조작들을 조합한다.

```text
조작
  ×
대상 영역
  ×
전달 매개
  ×
발동 조건
  ×
지불 비용
  ×
실패 결과
  ×
관찰 가능한 징후
```

## 16.2 능력 구성 데이터

```ts
export interface AbilityDefinition {
  id: Id;
  ownerSubjectId: Id;
  operations: Array<
    "sense" | "coat" | "condense" | "project" |
    "convert" | "imprint" | "link" | "manifest"
  >;
  domains: Array<
    "body" | "object" | "space" |
    "life" | "mind" | "information" | "relationship"
  >;
  carriers: Array<
    "touch" | "gaze" | "voice" | "name" |
    "mark" | "object" | "promise" | "territory"
  >;
  activationCondition: PredicateSpec;
  effect: EffectSpec[];
  costs: EffectSpec[];
  breachEffects: EffectSpec[];
  observableTells: PhenomenonSpec[];
  counterplayPredicates: PredicateSpec[];
  mastery: number;
  identityCoherence: number;
}
```

## 16.3 능력의 강도

[
Power =
Mastery
\times IdentityCoherence
\times CostCredibility
\times ConstraintSpecificity
\times Preparation
\times ExposureRisk
]

강력한 능력은 다음 중 하나 이상을 요구한다.

* 범위가 좁다.
* 조건이 복잡하지만 검증 가능하다.
* 실패 비용이 실제 상태에 적용된다.
* 준비 시간이 길다.
* 정체를 노출한다.
* 타인이 대응할 단서가 존재한다.
* 사용자의 신념과 강하게 일치한다.

“마음속으로 각오했다”처럼 서버가 검증할 수 없는 비용은 실제 비용으로 인정하지 않는다.

## 16.4 예시 능력

### 인물

```text
이름: 세렌
직업: 계약 감식관
욕망: 배신을 증명하고 싶다.
두려움: 무고한 사람을 잘못 심판하는 것.
가치: 정확하게 표현된 약속.
행동 방식: 기록, 계약, 증거 수집.
```

### 능력: 파열 장부

```text
조건:
세렌이 두 당사자가 같은 문장으로 약속하는 장면을 직접 듣고,
두 사람의 이름을 장부에 기록해야 한다.

효과:
당사자가 약속을 고의로 위반하면
위반으로 얻은 이익에 비례하여 의념이 소실되고
그림자에 균열 흔적이 생긴다.

대가:
세렌이 약속 내용을 잘못 기록했거나
고의성을 잘못 판단하면 같은 균열이 자신에게 생긴다.

대응:
명시적인 약속을 피한다.
대리인을 이용한다.
문장의 의미를 다르게 해석한다.
약속을 지키면서 다른 방식으로 목적을 달성한다.
세렌의 장부를 손상하거나 감각을 속인다.
```

이 능력은 단순한 공격 스킬이 아니다. 정치, 수사, 협상, 동맹, 배신, 전투에 모두 사용할 수 있다.

---

# 17. 마물과 신의 능력은 인간과 다르게 만든다

## 17.1 거대 마물

거대 마물은 능력을 학습한 인간이 아니라 **생태 규칙이 신체화된 주체**다.

예를 들어 어떤 마물은 자신이 먹은 지역의 특징을 기관으로 저장한다.

```text
화산 지대 섭취
  → 열을 저장하는 갑각 생성
독성 늪 섭취
  → 독성 증기를 정화하거나 방출하는 기관 생성
의념이 강한 인간 섭취
  → 인간의 공포 반응을 모방하는 감각 기관 생성
```

마물을 사냥하는 것은 체력 수치를 깎는 문제가 아니다.

```text
서식 주기 파악
기관의 역할 파악
이동 경로 변경
먹이 공급 차단
다른 생물과의 관계 이용
의념 잔향 교란
번식기 회피
기관 간 상호작용 붕괴
```

## 17.2 신적 존재

신은 강력한 NPC가 아니라 지역 규칙을 몸으로 가진 `RuleBearingSubject`다.

```ts
interface RuleBearingSubject {
  subjectId: Id;
  anchorEntityIds: Id[];
  sustainedBy: PredicateSpec[];
  attachedRuleIds: Id[];
  weakeningConditions: PredicateSpec[];
  collapseEffects: EffectSpec[];
}
```

예를 들어 국경의 신은 다음 조건으로 유지될 수 있다.

```text
국경석이 존재한다.
양쪽 국가가 경계를 인정한다.
사람들이 정기적으로 경계를 확인한다.
경계를 넘을 때 의례를 수행한다.
```

국가가 몰래 국경석을 옮기면 신은 약해지거나 뒤틀릴 수 있다.

신을 죽이는 것은 단순한 보스 처치가 아니다. 신이 담당하던 지역 규칙이 사라지면서 새로운 재난이나 기회가 생긴다.

---

# 18. 주체의 요구로부터 3D 공간을 생성한다

공간은 먼저 만들고 콘텐츠를 집어넣는 빈 무대가 아니다.

공간은 행동 가능성을 지원하기 위해 생성된다.

## 18.1 공간 요구의 예

거대 마물의 가능성 그래프는 다음 공간을 요구할 수 있다.

```text
몸체가 통과할 수 있는 폭
계절별 이동 경로
먹이 지역과 번식지의 연결
소리나 진동이 전파되는 지형
상처를 회복할 광물 지대
인간에게 흔적이 보이는 관찰 지점
```

밀수 조직의 가능성 그래프는 다음을 요구한다.

```text
공식 경로를 우회하는 통로
시야가 차단되는 지형
경비 교대 시간과 연결된 이동 거리
물건을 숨길 공간
두 국가의 관할권이 겹치는 지대
```

비행 종은 수직 이동 공간과 상승 기류를 요구한다.

국가는 경계, 요새, 도로, 보급 거리를 요구한다.

신은 영역의 중심점, 의례 장소, 영향 경계를 요구한다.

## 18.2 공간 요구 데이터

```ts
export interface SpaceRequirement {
  id: Id;
  sourceRequirementIds: Id[];
  scale: "micro" | "local" | "regional" | "global";
  semanticTags: Tag[];
  geometry: {
    minArea?: number;
    minClearance?: number;
    maxSlope?: number;
    verticality?: number;
    coverDensity?: number;
    visibilityDistance?: number;
  };
  topology: {
    mustConnectTo?: Id[];
    mustAvoid?: Id[];
    requiresBoundary?: boolean;
    requiresLoop?: boolean;
    requiresHiddenRoute?: boolean;
    requiresChokePoint?: boolean;
  };
  accessibility?: {
    requiredCapabilities: Id[];
    forbiddenCapabilities?: Id[];
  };
}
```

## 18.3 공간 생성 계층

```text
1. 의미적 지역 그래프
2. 지역 간 연결과 이동 비용
3. 2D·3D 좌표 임베딩
4. 광역 지형 생성
5. 도로·강·협곡·경계 생성
6. 정착지·둥지·의례 장소 배치
7. 전투·은신·관찰용 미시 공간 생성
8. 이동 가능성 검증
9. 렌더링 메시와 충돌 구조 생성
```

## 18.4 웹 프로토타입 지형 표현

초기 구현에서는 복셀을 사용할 필요가 없다.

```text
광역 지표:
  높이 필드 기반 지형 메시
동굴·절벽·건물:
  별도 메시 또는 절차적 모듈 조합
나무·바위·식생:
  인스턴싱
영역·소유권·생태:
  렌더링 메시와 분리된 논리 필드
숨은 길·이동 경로:
  의미적 그래프와 3D 앵커
거대 생물 경로:
  일반 NPC 내비게이션과 분리된 광역 경로
```

3D 공간의 시각적 형태와 게임 규칙을 같은 데이터로 취급해서는 안 된다.

```text
논리 공간
  이동 가능성
  시야
  관할권
  생태
  위험도
  의념장
  상호작용 앵커
표현 공간
  지형 메시
  재질
  식생
  이펙트
  조명
```

---

# 19. 상황과 사건 생성 구조

콘텐츠를 만들려면 먼저 “사건”이 아니라 `Pressure`, 즉 해결되지 않은 압력을 만들어야 한다.

## 19.1 압력

```ts
export interface Pressure {
  id: Id;
  ownerSubjectId: Id;
  desiredState: PredicateSpec;
  currentBelief: PredicateSpec;
  urgency: number;
  deadlineTick?: number;
  stakes: number;
  relatedEntityIds: Id[];
  relatedRegionIds: Id[];
  relatedSubjectIds: Id[];
}
```

예시는 다음과 같다.

```text
마물:
번식지에 도달하지 못하고 있다.
국가:
국경 무역로가 폐쇄될 위험이 있다.
상인:
운송 중인 물건이 썩기 전에 통과해야 한다.
종교:
국경석이 훼손되어 신이 약해지고 있다.
마을:
마물의 이동 경로에 놓여 있다.
```

## 19.2 상황

서로 같은 자원, 장소, 시간, 인물, 정보에 관련된 압력들을 묶으면 `Situation`이 된다.

```ts
export interface Situation {
  id: Id;
  pressureIds: Id[];
  participantSubjectIds: Id[];
  sharedResourceIds: Id[];
  sharedRegionIds: Id[];
  conflictKeys: string[];
  cooperationKeys: string[];
  visibility: number;
  escalationLevel: number;
  unresolved: boolean;
}
```

## 19.3 행동 의도

```ts
export interface Intent {
  id: Id;
  actorSubjectId: Id;
  verb:
    | "observe"
    | "move"
    | "take"
    | "protect"
    | "attack"
    | "flee"
    | "request"
    | "offer"
    | "threaten"
    | "deceive"
    | "recruit"
    | "betray"
    | "bind"
    | "use_ability";
  targetEntityIds: Id[];
  targetSubjectIds: Id[];
  desiredState: PredicateSpec;
  methodTags: Tag[];
  offeredResources?: ResourceTransfer[];
  threatenedEffects?: EffectSpec[];
  secrecy: number;
  commitment: number;
  priority: number;
}
```

## 19.4 사건 해결

```text
주체들이 같은 시간대에 Intent 제출
    ↓
읽고 쓰려는 상태 집합 분석
    ↓
서로 충돌하는 Intent를 하나의 해결 그룹으로 묶음
    ↓
적용 가능한 세계 규칙 수집
    ↓
비용·조건·우선순위 검사
    ↓
상태 변화 계산
    ↓
사건 생성
    ↓
흔적·소리·소문·부상·채무 등 현상 방출
```

```ts
export interface WorldEvent {
  id: Id;
  tick: number;
  causeEventIds: Id[];
  situationId?: Id;
  intentIds: Id[];
  appliedRuleIds: Id[];
  participantSubjectIds: Id[];
  affectedEntityIds: Id[];
  stateDelta: StateDelta[];
  emittedPhenomena: Phenomenon[];
  createdCommitmentIds: Id[];
  breachedCommitmentIds: Id[];
  unresolvedHookIds: Id[];
}
```

---

# 20. NPC가 플레이어에게 요청하는 정확한 조건

NPC가 요청을 생성하려면 다음 조건을 모두 통과해야 한다.

```text
1. NPC에게 해결되지 않은 목적이 있다.
2. NPC 혼자서는 필요한 행동을 수행하기 어렵다.
3. NPC는 플레이어가 필요한 능력이나 자원을 가진다고 믿는다.
4. 플레이어를 이용하는 기대 이익이 다른 대안보다 높다.
5. 플레이어와 접촉할 수 있다.
6. NPC의 가치관과 관계가 협력을 허용한다.
```

그다음 관계와 성격에 따라 전략이 선택된다.

```text
신뢰 높음 + 힘의 차이 작음
  → 정직한 요청
신뢰 낮음 + 플레이어가 강함
  → 거래 또는 부분적 기만
신뢰 낮음 + NPC가 강함
  → 협박 또는 강제
관계가 적대적이지만 공통 위협 존재
  → 임시 동맹
NPC가 결과만 필요하고 플레이어를 제거할 계획
  → 이용 후 배신
NPC가 플레이어에게 빚을 지고 있음
  → 보상 조건이 좋은 요청
```

구현은 다음처럼 처리한다.

```ts
function selectSocialStrategy(
  npc: SubjectState,
  target: SubjectState,
  goal: PossibilityNode,
  alternatives: readonly Intent[],
  rng: DeterministicRng
): Intent | null {
  const valid = alternatives.filter(intent =>
    canPerformIntent(npc, intent) &&
    isGoalRelevant(intent, goal)
  );

  if (valid.length === 0) {
    return null;
  }

  const relation = npc.relations[target.id];

  const scored = valid.map(intent => ({
    intent,
    score:
      expectedGoalUtility(npc, intent) +
      relationUtility(intent, relation) +
      personalityUtility(npc, intent) -
      expectedRisk(npc, intent) -
      moralCost(npc, intent)
  }));

  return weightedSoftmaxChoice(scored, npc, rng);
}
```

플레이어가 요청을 거부하면 NPC는 기다리는 것이 아니라 다른 대상을 찾거나, 협박하거나, 스스로 시도하거나, 목적을 포기하거나, 플레이어를 적으로 간주할 수 있다.

---

# 21. 사건은 다음 사건의 재료를 남긴다

모든 사건은 단순한 종료가 아니라 다음 가능성을 만드는 흔적을 남겨야 한다.

```text
부상
채무
약속
배신 기록
증거
소문
빈 권력 자리
새로운 적
새로운 동맹
희귀 자원 부족
생태 변화
영토 변화
능력의 약점 노출
신의 규칙 변화
```

이 흔적을 `Event Hook`으로 저장한다.

```ts
export interface EventHook {
  id: Id;
  sourceEventId: Id;
  tags: Tag[];
  relevantSubjectIds: Id[];
  relevantRegionIds: Id[];
  activationPredicate: PredicateSpec;
  expiresAtTick?: number;
  generatedRequirementIds: Id[];
}
```

사건 연쇄는 미리 작성된 스토리라인이 아니라 같은 압력이 형태를 바꾸면서 이어지는 구조다.

```text
마물 이동
  ↓
상단 운송 중단
  ↓
약 가격 상승
  ↓
환자 가족의 절도
  ↓
경비대의 추적
  ↓
범죄 조직의 포섭
  ↓
국가의 치안 강화
  ↓
밀수로 폐쇄
  ↓
다른 지역의 식량 부족
```

---

# 22. 성장은 가능성 그래프의 변화다

성장은 레벨 숫자가 올라가는 것이 아니라 다음 중 하나 이상이 변하는 것이다.

| 성장 축  | 변화                     |
| ----- | ---------------------- |
| 신체    | 더 빠르거나 강해지고 새로운 환경에 적응 |
| 기술    | 행동 비용과 실패 확률 감소        |
| 지각    | 보이지 않던 현상과 흔적을 감지      |
| 지식    | 잘못된 믿음을 교정하고 새로운 전략 획득 |
| 관계    | 협력자, 적, 채무, 지위 생성      |
| 제도    | 자격, 시민권, 직책, 지휘 권한 획득  |
| 의념    | 새로운 조작·조건·각인 획득        |
| 정체성   | 가치관과 맹세 변화             |
| 영향 범위 | 개인에서 조직·도시·국가 규모로 확장   |

## 22.1 그래프 변경 연산

```ts
export type GrowthEffect =
  | { op: "unlock_node"; nodeId: Id }
  | { op: "add_edge"; edge: PossibilityEdge }
  | { op: "reweight_node"; nodeId: Id; delta: number }
  | { op: "specialize_action"; actionTemplateId: Id; delta: number }
  | { op: "bind_cost"; nodeId: Id; cost: EffectSpec }
  | { op: "prune_node"; nodeId: Id }
  | { op: "merge_nodes"; sourceIds: Id[]; resultId: Id }
  | { op: "unlock_scale"; scale: "group" | "city" | "nation" | "god" }
  | { op: "change_value"; valueId: Id; delta: number }
  | { op: "change_trait"; traitId: Id; delta: number };
```

같은 실패를 경험해도 주체마다 다른 성장이 발생한다.

```text
용감한 인물:
실패를 통해 더 위험한 시도를 배운다.
신중한 인물:
사전 조사와 도구 준비 노드가 강화된다.
복수심이 강한 인물:
상대 제거 목적이 강화된다.
책임감이 강한 인물:
동료 보호 능력이 각성된다.
공포에 압도된 인물:
특정 대상 회피 노드가 강해지거나
공포를 힘으로 전환하는 능력이 생긴다.
```

---

# 23. 깊이 있는 캐릭터 생성 규칙

무작위 특성 몇 개를 조합한다고 특색 있는 캐릭터가 만들어지지는 않는다.

모든 주요 캐릭터는 최소한 다음 구조를 가져야 한다.

```text
공개적인 역할
개인적인 욕망
가장 두려운 상실
절대로 포기하지 않을 가치
생존을 위해 의존하는 타인
해결되지 않은 과거 사건
현재 가진 잘못된 믿음
한 명 이상의 관계적 예외
능력이 요구하는 실제 대가
성장하면서 충돌하게 될 자기모순
```

예를 들면 다음과 같다.

```text
공개 역할:
국가의 국경 조사관
개인 욕망:
실종된 동생을 찾고 싶다.
핵심 가치:
거짓 보고로 사람을 희생해서는 안 된다.
의존:
국가의 조사 장비와 정보망이 필요하다.
잘못된 믿음:
동생을 납치한 것은 국경 마물이라고 믿는다.
숨겨진 진실:
국가의 비밀 실험 때문에 동생이 사라졌다.
관계적 예외:
자신을 속인 상관에게 여전히 부모 같은 애정을 느낀다.
능력:
거짓말의 의념 잔향을 추적할 수 있지만,
자신이 진실이라고 믿는 내용을 말해야만 발동한다.
자기모순:
진실을 밝히려면 자신이 의존하는 국가를 무너뜨려야 한다.
```

캐릭터 생성기는 최소 두 개 이상의 자기모순이 없는 캐릭터를 주요 인물로 채택하지 않는다.

---

# 24. 전체 생성 예시

## 24.1 주체 생성

다음 주체들이 존재한다고 가정한다.

### 거대 마물 `우식각`

```text
목적:
계절이 바뀌기 전에 염분 광맥이 있는 번식지에 도달한다.
지각:
땅의 저주파 진동과 염분 농도를 감지한다.
행동:
이동, 지형 파괴, 섭식, 새끼 보호.
가치:
인간의 가치관은 없지만 번식 경로를 강하게 보존한다.
```

### 국가 조직 `황동경계국`

```text
목적:
국경 무역로를 유지하고 희귀 광물을 독점한다.
두려움:
국경을 통제하지 못한다는 사실이 공개되는 것.
행동:
조사, 허가, 봉쇄, 병력 파견, 정보 은폐.
```

### 신 `경계의 잔향`

```text
목적:
국경이 명확하게 인식되고 조약이 지켜지는 상태를 유지한다.
생존 조건:
국경석, 조약 기록, 양측 주민의 인정.
행동:
경계를 넘는 존재에게 표식을 남기고,
모호한 경계에서 공간 감각을 교란한다.
```

### 인간 치료사

```text
목적:
마을에서 퍼지는 의념성 질환을 치료한다.
필요:
우식각의 염분 기관에서 생성되는 결정.
가치:
생명을 살리지만 마물의 새끼는 죽이지 않으려 한다.
```

## 24.2 각 주체의 세계 요구

우식각은 다음을 요구한다.

```text
이동 가능한 협곡
염분 광맥
번식지
저주파 진동 전달 지형
```

황동경계국은 다음을 요구한다.

```text
국경
광물 자원
감시 초소
운송로
국경 법률
```

경계의 잔향은 다음을 요구한다.

```text
국경석
조약 기록
의례
영역 규칙
```

치료사는 다음을 요구한다.

```text
질환 상태
치료 가능한 물질
마물 기관
효능을 확인할 지식
```

## 24.3 세계 컴파일러의 결합

컴파일러는 이 요구들을 별개의 콘텐츠로 만들지 않는다.

하나의 협곡이 다음을 동시에 담당하도록 만든다.

```text
우식각의 이동 경로
희귀 염분 광맥
두 국가의 국경
경계 신의 국경석
황동경계국의 채굴 기지
마을 질환 치료제의 원천
밀수 조직의 비밀 통로
```

## 24.4 사건의 시작

황동경계국은 광물을 채굴하기 위해 국경석을 몰래 이동시킨다.

```text
국경석 이동
    ↓
경계 신의 영역 약화
    ↓
우식각이 원래 이동 경로를 잃음
    ↓
마을 방향으로 이동
    ↓
국가는 마물이 먼저 공격했다고 발표
    ↓
치료사는 우식각의 기관이 필요해짐
```

아직 플레이어에게 퀘스트는 없다.

## 24.5 플레이어 개입 조건

플레이어가 다음 상태라고 가정한다.

```text
의념 잔향 감지 능력 보유
치료사와 신뢰 관계
국경경비대와는 적대 관계
우식각을 직접 죽일 전투력은 부족
```

치료사는 플레이어가 국경석의 잔향을 볼 수 있다고 믿기 때문에 접근한다.

황동경계국은 플레이어가 진실을 알아낼 가능성이 있다고 판단하여 감시하거나 회유한다.

경계 신은 플레이어가 국경석을 만지면 직접 현상을 보낸다.

우식각은 플레이어가 이동 경로를 복구하면 마을을 공격하지 않는다.

## 24.6 가능한 플레이

```text
우식각을 사냥한다.
국경석을 복구한다.
황동경계국과 거래한다.
국가의 조작을 폭로한다.
치료사에게 기관 일부만 제공한다.
마물의 이동을 다른 국가 방향으로 돌린다.
경계 신과 새로운 조약을 맺는다.
광물을 훔쳐 암시장에 판다.
마을 주민을 이주시킨다.
아무것도 하지 않는다.
```

아무것도 하지 않아도 세계는 진행된다.

우식각은 마을을 통과하고, 국가가 병력을 보내며, 치료사는 다른 사냥꾼을 찾는다. 플레이어는 나중에 폐허와 살아남은 사람들의 원한을 마주할 수 있다.

이것이 퀘스트 목록이 아니라 주체 그래프의 충돌로 만들어지는 콘텐츠다.

---

# 25. 플레이어의 가능성 그래프

NPC의 그래프는 행동을 선택하지만, 플레이어의 그래프가 플레이어 행동을 자동 결정해서는 안 된다.

플레이어 그래프는 다음 역할을 한다.

```text
현재 사용할 수 있는 행동 원자 결정
능력과 지식에 따라 인식할 수 있는 현상 결정
특정 행동의 조건과 비용 계산
현재 세계에서 도달 가능한 가능성 표시
성장으로 새 행동 조합 해금
플레이어가 만든 맹세와 정체성 기록
```

플레이어에게 보이는 콘텐츠 그래프는 실제 세계 전체가 아니다.

[
C_p =
Project(
SituationGraph,
Belief_p,
Capabilities_p,
Relations_p
)
]

즉, 플레이어가 알지 못하는 사건은 콘텐츠 UI에도 나타나지 않는다.

UI에는 다음을 보여준다.

```text
알고 있는 사건
확실한 사실
불확실한 주장
정보의 출처
관련된 주체
현재 맺은 약속
가능한 행동
예상되지만 확정되지 않은 결과
```

“동쪽 숲에서 늑대 10마리를 처치하라”가 아니라 다음과 같이 표현한다.

```text
마을의 약초 운송이 3일째 중단되었다.
운송인은 거대 짐승의 흔적을 보았다고 주장한다.
경비대는 도적의 소행이라고 발표했다.
치료사는 이틀 안에 약초가 필요하다.
당신은 운송인에게 빚이 있다.
```

---

# 26. 정보 전파 시스템

사건은 모든 주체에게 자동 공유되지 않는다.

```text
실제 사건
    ↓
직접 목격
    ↓
증거 생성
    ↓
증언
    ↓
소문
    ↓
공식 발표
    ↓
역사 기록
```

각 단계에서 정보가 변형될 수 있다.

```ts
export interface InformationTransmission {
  claimId: Id;
  senderId: Id;
  receiverId: Id;
  channel:
    | "conversation"
    | "document"
    | "rumor"
    | "official_report"
    | "ability"
    | "ritual";
  distortion: number;
  concealment: number;
  persuasion: number;
}
```

거짓말은 텍스트 생성기가 임의로 만들어서는 안 된다.

거짓말은 다음 조건을 충족해야 한다.

```text
화자가 진실 또는 다른 믿음을 가지고 있다.
화자가 정보를 숨길 목적을 가지고 있다.
거짓 주장이 목적 달성에 도움이 된다고 판단한다.
거짓말이 들킬 위험을 계산한다.
```

---

# 27. 3D 웹 프로토타입 기술 구조

프로토타입은 TypeScript 기반 모노레포로 구성한다. 렌더링은 Three.js의 `WebGPURenderer`를 우선 사용하고 WebGPU가 지원되지 않을 때 WebGL 2 백엔드로 내려가는 구조를 사용할 수 있다. 물리와 충돌은 JavaScript 바인딩과 WebAssembly 로딩을 제공하는 Rapier를 사용하고, 권위 서버와 상태 동기화·매치메이킹은 Colyseus를 이용할 수 있다. Vite는 TypeScript, Worker, WebAssembly를 포함한 웹 개발 구성을 제공하므로 프로토타입 빌드 도구로 적절하다. ([Three.js][1])

```text
/apps
  /client
  /server
  /world-editor
  /simulation-viewer
/packages
  /domain-schema
  /world-kernel
  /event-log
  /rule-engine
  /subject-runtime
  /perception-engine
  /belief-engine
  /possibility-engine
  /planner
  /situation-engine
  /world-compiler
  /spatial-compiler
  /ability-engine
  /simulation-lod
  /network-protocol
  /persistence
  /content-validation
/content
  /worldviews
  /species
  /cultures
  /organizations
  /rule-families
  /possibility-grammars
  /ability-primitives
  /region-generators
```

---

# 28. 서버 구조

```text
WorldCoordinator
  세계 시간
  전역 사건
  국가·조직
  지역 간 이동
  세계 컴파일 요구
RegionShard
  지역 물리
  지역 NPC
  지역 사건
  생태 상태
  플레이어 동기화
SubjectRuntime
  지각
  믿음
  가능성 활성화
  의도 선택
  기억과 성장
RuleEngine
  행동 검증
  비용 계산
  상태 변화
  현상 방출
SituationEngine
  압력 군집화
  갈등 탐지
  사건 중요도 계산
WorldCompiler
  미충족 요구 수집
  지역·자원·규칙 실체화
```

초기 프로토타입에서는 모두 하나의 Node 프로세스에서 실행하되 인터페이스를 분리한다.

---

# 29. 서버 시뮬레이션 루프

```ts
export function simulationStep(
  world: MutableWorldState,
  tick: number
): void {
  promoteRelevantRegions(world, tick);
  processScheduledEvents(world, tick);

  const perceptions = collectPerceptions(world, tick);
  updateBeliefs(world, perceptions, tick);

  const deliberatingSubjects = getSubjectsReadyToDecide(world, tick);
  const intents = deliberatingSubjects.flatMap(subject =>
    deliberateSubject(subject, world, tick)
  );

  const interactionGroups = buildIntentConflictGroups(intents, world);

  const events = interactionGroups.flatMap(group =>
    resolveIntentGroup(group, world, tick)
  );

  for (const event of events) {
    appendEvent(world, event);
    applyEventDelta(world, event);
    propagatePhenomena(world, event);
    createEventHooks(world, event);
  }

  updateMemoriesAndGrowth(world, events, tick);
  updateSituations(world, tick);
  collectUnsatisfiedWorldRequirements(world, tick);

  if (shouldCompileWorld(world, tick)) {
    const patch = compilePendingWorldRequirements(world, tick);
    applyWorldPatch(world, patch);
  }

  demoteInactiveRegions(world, tick);
  persistTick(world, tick);
}
```

모든 무작위성은 다음처럼 결정적 시드로 생성한다.

```text
worldSeed
+ currentTick
+ subjectId
+ decisionCounter
+ situationId
```

`Math.random()`을 직접 사용하지 않는다.

같은 초기 상태와 입력으로 서버를 재생하면 같은 사건 로그가 나와야 한다.

---

# 30. 시뮬레이션 해상도

모든 NPC를 매 프레임 완전히 시뮬레이션하면 MMORPG 서버가 감당할 수 없다.

따라서 해상도를 단계화한다.

| 단계          | 표현                   |
| ----------- | -------------------- |
| L0 잠재       | 주체 원형과 가능성 문법만 존재    |
| L1 집단       | 개체군·자원·조직을 통계 상태로 표현 |
| L2 원격 실명 주체 | 위치·목적·다음 예정 사건만 관리   |
| L3 지역 주체    | 지각·믿음·관계·행동을 저주기로 계산 |
| L4 활성 상호작용  | 전투·대화·물리·능력을 정밀 계산   |

프로토타입 초기 주기는 다음 정도로 나눌 수 있다.

```text
클라이언트 렌더링: 60Hz 목표
이동 권위 판정: 20Hz
전투·능력 규칙: 10Hz
NPC 숙고: 1~2Hz
조직·경제: 사건 기반 또는 0.1Hz
원격 지역: 다음 중요 사건 시간만 예약
```

플레이어가 다가오면 집단 상태를 개별 주체로 승격한다.

플레이어가 떠나면 개별 물리 상태를 압축된 장기 상태로 축약한다.

이때 이름이 있는 주요 주체, 부상, 약속, 관계, 소유물, 비밀은 보존한다.

---

# 31. 네트워크 동기화

서버는 다음 항목에 대해 권위를 가진다.

```text
위치의 최종 확정
전투 결과
능력 조건과 비용
아이템 소유권
관계·약속·평판
세계 사건
지역 생성
```

클라이언트는 이동과 애니메이션만 예측한다.

관심 영역은 거리만으로 결정하지 않는다.

```text
공간 관심:
  플레이어 근처 실체
관계 관심:
  플레이어와 강한 관계를 가진 주체
약속 관심:
  플레이어가 맺은 Commitment 관련 사건
정보 관심:
  플레이어가 추적 중인 주장과 증거
조직 관심:
  플레이어가 소속된 조직의 전역 사건
```

멀리 떨어진 NPC가 플레이어와 한 약속을 위반하면 해당 사건은 거리와 상관없이 플레이어에게 전달될 수 있다. 다만 플레이어가 이를 즉시 아는지는 정보 전달 규칙에 따라 결정한다.

---

# 32. 이벤트 소싱과 저장 구조

모든 세계 변화는 사건 로그를 통해서만 발생시킨다.

```text
event_log
  world_id
  sequence
  tick
  event_type
  payload
  cause_event_ids
  deterministic_seed
world_snapshots
  world_id
  sequence
  compressed_state
subject_snapshots
  subject_id
  sequence
  mind_state
  belief_state
  memory_state
  possibility_frontier
world_requirements
  requirement_id
  source_node_id
  realization_id
  status
world_definitions
  definition_id
  schema_version
  content_json
```

이 구조를 사용하면 다음이 가능하다.

```text
버그 발생 시 사건 재생
특정 NPC가 왜 배신했는지 추적
세계 생성 근거 확인
잘못된 규칙 패치 전후 비교
플레이어 행동이 세계에 미친 영향 분석
```

---

# 33. AI 에이전트의 역할

AI는 세계 상태를 직접 바꾸는 권위자가 되어서는 안 된다.

AI가 담당할 수 있는 것은 다음과 같다.

```text
세계관 공리 후보 생성
종 가능성 문법 후보 생성
캐릭터의 자기모순 후보 생성
능력 규칙 AST 후보 생성
미충족 요구를 만족할 지역 후보 생성
사건 이후의 대사 문장 생성
역사 요약과 소문 표현
```

AI가 담당해서는 안 되는 것은 다음과 같다.

```text
실제 행동 성공 여부
규칙 비용 계산
아이템 생성
관계 수치 직접 변경
전투 피해 직접 결정
이미 관찰된 세계 사실 변경
```

AI 생성 파이프라인은 다음과 같다.

```text
세계 요구
    ↓
AI 후보 생성
    ↓
JSON 스키마 검증
    ↓
세계관 공리 검사
    ↓
규칙 의존성 검사
    ↓
비용·대응 가능성 검사
    ↓
그래프 도달 가능성 검사
    ↓
자동 시뮬레이션
    ↓
통과한 후보만 콘텐츠 정의로 등록
```

대사 생성도 자유 텍스트부터 시작하지 않는다.

```text
NPC의 실제 목적
NPC의 믿음
상대와의 관계
숨길 정보
공개할 정보
선택한 사회적 행동
    ↓
SpeechAct 생성
    ↓
문장 표현
```

---

# 34. 모듈별 구현과 검증 기준

| 모듈                 | 구현 내용          | 직관적 검증                       |
| ------------------ | -------------- | ---------------------------- |
| Domain Schema      | 주체·상태·규칙·사건 타입 | 잘못된 콘텐츠 JSON이 로드되지 않음        |
| Event Kernel       | 사건 적용과 재생      | 동일 시드 재생 결과가 동일              |
| Rule Engine        | 조건·비용·효과·흔적    | 규칙 밖에서 상태가 바뀌지 않음            |
| Perception Engine  | 시야·소리·잔향·보고    | 보지 못한 사건을 NPC가 알지 못함         |
| Belief Engine      | 주장·증거·소문       | 서로 다른 NPC가 같은 사건을 다르게 믿음     |
| Possibility Engine | 문법 확장·노드 활성화   | 같은 현상에서 다른 성격이 다른 목적 선택      |
| Planner            | 전략 후보와 행동 선택   | 목적과 무관한 행동이 선택되지 않음          |
| Situation Engine   | 압력 군집과 충돌 탐지   | 퀘스트 없이 주체 충돌이 사건 후보가 됨       |
| World Compiler     | 요구를 공간·규칙으로 변환 | 모든 생성 요소의 생성 근거를 조회 가능       |
| Spatial Compiler   | 지역 그래프와 3D 배치  | 요구된 이동·시야·공간 조건이 실제로 가능      |
| Ability Engine     | 제약·비용·대응       | 무비용·무제한 능력이 검증을 통과하지 못함      |
| Growth Engine      | 그래프 변화         | 경험 후 실제 행동 후보가 달라짐           |
| Network Layer      | 권위 서버와 관심 관리   | 두 플레이어가 같은 고유 자원을 중복 획득하지 않음 |
| Debug Viewer       | 인과관계 시각화       | NPC가 왜 요청·배신했는지 그래프로 확인 가능   |

---

# 35. 디버그 도구는 필수다

이 시스템은 결과만 보면 원인을 찾기 어렵다. 다음 디버그 화면을 반드시 만든다.

## 주체 사고 뷰어

```text
현재 지각한 현상
관련 기억
활성 욕구
후보 목적
후보 전략 점수
선택한 행동
포기한 행동과 이유
```

## 사건 인과 뷰어

```text
원인 사건
참여 주체
제출된 Intent
적용 규칙
변경 상태
발생한 흔적
새로 생성된 Hook
```

## 세계 생성 근거 뷰어

```text
이 협곡은 왜 존재하는가?
  우식각의 이동 요구
  국가의 국경 요구
  경계 신의 영역 요구
  밀수 조직의 은폐 경로 요구
이 광물은 왜 존재하는가?
  마물의 번식 기관
  치료제
  국가 연구
  암시장 상품
```

## 믿음 비교 뷰어

```text
실제 상태
플레이어가 믿는 상태
NPC A가 믿는 상태
국가 공식 기록
소문으로 유통되는 상태
```

---

# 36. 콘텐츠 품질 검증

이 구조만 만들었다고 모든 캐릭터와 사건이 자동으로 깊어지는 것은 아니다. 생성된 후보를 거부할 품질 검증이 필요하다.

## 캐릭터 검증

```text
개인 욕망이 있는가?
생존이나 가치와 연결되는가?
다른 주체에 대한 의존이 있는가?
잘못된 믿음이나 정보 제한이 있는가?
관계별 행동 차이가 있는가?
능력과 성격이 연결되는가?
능력에 실제 대가가 있는가?
성장하면 현재 가치와 충돌할 가능성이 있는가?
```

## 거대 마물 검증

```text
먹이와 서식지가 있는가?
이동과 번식 주기가 있는가?
공격 외의 상호작용이 가능한가?
행동의 사전 징후가 있는가?
기관과 능력의 생태적 근거가 있는가?
죽었을 때 생태적 결과가 있는가?
```

## 조직 검증

```text
존속에 필요한 자원이 있는가?
공개 이념과 실제 생존 방식이 다른가?
내부 파벌이 있는가?
외부 의존 대상이 있는가?
명령을 실행할 구성원이 있는가?
분열·부패·배신 가능성이 있는가?
```

## 지역 검증

```text
서로 다른 세 종류 이상의 주체 요구가 겹치는가?
자원·이동·정보 중 두 개 이상의 갈등이 있는가?
공개된 현상과 숨겨진 원인이 존재하는가?
전투가 아닌 해결 경로가 있는가?
사건 이후 지역 상태가 실제로 변하는가?
```

---

# 37. 프로토타입 구현 범위

첫 프로토타입에서 무한 세계 전체를 만들면 안 된다. 핵심 인과 루프를 검증하는 하나의 지역을 만든다.

## 초기 지역

```text
2km × 2km 규모의 3D 국경 협곡
정착지 1개
국경 초소 2개
신의 영역 1개
거대 마물 1개체
일반 생물 2종
주요 NPC 12명
조직 2개
국가 주체 1개
지역 신 1개
```

## 초기 시스템

```text
물리 상태
생물 상태
관계 상태
정보·주장
약속
의념 상태
지역 규칙
```

## 초기 행동 원자

```text
이동
관찰
획득
공격
보호
거래
요청
협박
기만
추적
각인
능력 사용
```

## 초기 능력 원자

```text
감응
피복
응축
방사
각인
연결
```

## 성공 조건

```text
플레이어가 접속하지 않아도 사건이 진행된다.
NPC는 플레이어가 유용하다고 믿을 때만 요청한다.
같은 NPC가 관계 변화 후 다른 전략을 선택한다.
플레이어가 요청을 거부해도 사건이 멈추지 않는다.
거대 마물을 죽이지 않고도 상황을 해결할 수 있다.
마물을 죽이면 지역 생태와 정치가 바뀐다.
능력 비용과 위반 결과가 서버에서 강제된다.
동일 사건 로그를 재생하면 동일한 결과가 나온다.
```

---

# 38. 구현 순서

## 1단계: 그래픽 없는 세계 커널

```text
주체
상태
규칙
사건 로그
결정적 시드
압력과 상황
```

콘솔 시뮬레이션만으로 NPC들이 서로 요청·거래·공격·배신하는지 검증한다.

## 2단계: 지각과 믿음

```text
현상
감각 범위
주장
증거
소문
거짓말
```

NPC가 실제 세계가 아니라 자기 믿음으로 행동하는지 검증한다.

## 3단계: 가능성 문법과 성장

```text
종 문법
개인 그래프
확률적 활성화
목표 지속성
기억
그래프 변화
```

같은 사건을 겪은 인물들이 서로 다르게 성장하는지 확인한다.

## 4단계: 세계 요구와 컴파일러

```text
Affordance 요구
상태 요구
규칙 요구
공간 요구
요구 군집화
실체화 근거
```

하나의 지역 요소가 여러 주체 요구를 동시에 만족하는지 확인한다.

## 5단계: 3D 클라이언트

```text
Three.js 렌더링
지형 메시
캐릭터 이동
상호작용 앵커
현상 시각화
상황 UI
```

## 6단계: 의념과 마물

```text
능력 원자
제약
비용
맹세
흔적
대응
거대 생물 기관
```

## 7단계: 권위 서버와 멀티플레이

```text
동시 행동 해결
상태 동기화
관심 영역
플레이어 간 계약
조직 가입
지역 영속화
```

## 8단계: 미지의 지역 확장

```text
잠재 지역
소문과 암시
요구 기반 지역 생성
압축 과거 시뮬레이션
관찰 이후 정식화
```

---

# 39. 최종 전체 구조

```text
[세계관 공리]
  세계에서 가능한 힘·생명·비용·미지의 범위를 정의
        ↓
[주체 원형]
  인간·마물·조직·국가·신의 존재 방식 정의
        ↓
[가능성 문법]
  주체가 현상을 해석하고 목적·전략을 만드는 방법 정의
        ↓
[개별 가능성 그래프]
  경험·성격·가치·관계로 개인화
        ↓
[세계 요구]
  행동에 필요한 규칙·상태·공간·자원·상대·정보 요구
        ↓
[세계 컴파일러]
  여러 주체의 요구를 공통 실체로 결합
        ↓
[3D 세계]
  지역·지형·생태·국가·신·자원·역사 실체화
        ↓
[현상]
  빛·소리·흔적·잔향·소문·보고서
        ↓
[주체의 지각과 믿음]
  같은 사건을 서로 다르게 해석
        ↓
[목적과 행동]
  요청·거래·협박·기만·동맹·배신·전투·도주
        ↓
[세계 규칙에 의한 충돌]
  비용·조건·물리·제도·능력·관계 적용
        ↓
[사건]
  실제 세계 상태 변화
        ↓
[기억·관계·약속·평판·생태 변화]
        ↓
[성장]
  가능성 그래프의 노드·간선·가중치 변화
        ↓
[새로운 세계 요구]
        └───────────────────────────────↺
```

최종적으로 이 게임에서 콘텐츠의 최소 단위는 퀘스트가 아니다.

```text
주체가 믿는 문제
+
그 문제를 해결하려는 목적
+
세계에 존재하는 공통 자원과 공간
+
다른 주체의 상충하는 목적
+
그들을 제한하는 규칙
=
사건
```

그리고 세계관의 깊이는 설정 문서의 분량이 아니라 다음에서 발생한다.

> **같은 실체를 서로 다른 주체가 서로 다른 의미로 바라보고, 각자의 존재 방식에 따라 이용하려 하며, 그 결과가 역사와 관계와 능력에 영구적으로 남는 것.**

이 구조가 완성되면 세계는 플레이어를 위해 준비된 퀘스트 무대가 아니라, 플레이어가 개입하기 전부터 수많은 주인공이 자기 삶을 살아가고 있는 세계가 된다.

[1]: https://threejs.org/docs/pages/WebGPURenderer.html "https://threejs.org/docs/pages/WebGPURenderer.html"
