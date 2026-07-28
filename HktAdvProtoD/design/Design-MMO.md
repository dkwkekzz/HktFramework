# 세계관 주제로부터 작동하는 MMORPG 세계를 생성하는 웹 프로토타입 설계

## 1. 목표

사용자는 다음처럼 세계관의 일부 주제만 입력한다.

- 인간은 자신의 의지에 제약을 걸어 초월적인 능력을 사용할 수 있다.
- 세계에는 인간이 정복하지 못한 거대한 미지의 영역이 존재한다.
- 모든 생명은 생존하려 하지만, 생존 방식은 종마다 다르다.
- 강한 생명과 희귀한 자원은 위험한 지역에 집중되어 있다.

시스템은 이 입력에서 자동으로 다음을 완성해야 한다.

- 세계의 핵심 명제
- 세계 공간
- 세계 상태
- 세계 규칙
- 생태 구조
- 종족
- 조직
- 개인 캐릭터
- 능력
- 목적 그래프
- 인식과 기억
- 관계
- 경제
- 사건 발생 조건
- 행동 선택 방식
- 성장 가능성
- 플레이어 개입 지점

결과는 단순한 세계관 문서가 아니다. 브라우저에서 시간이 흐르면 생명체와 조직이 스스로 행동하고, 관계와 자원이 변화하며, 사건이 발생하는 **실행 가능한 세계 모델**이어야 한다.

따라서 시스템의 전체 구조는 다음과 같다.

```
짧은 세계관 주제
        ↓
세계 생성 컴파일러
        ↓
실행 가능한 세계 정의
        ↓
월드 시뮬레이터
        ↓
주체들의 관찰·판단·행동
        ↓
상호작용과 사건 발생
        ↓
세계 상태 변화
        ↓
플레이어에게 현상으로 표현
```

## 2. 가장 중요한 구현 원칙

### 2.1 생성 AI가 세계를 직접 진행시키지 않는다

생성 AI에게 매 순간 다음 행동을 질문하는 구조는 사용하지 않는다.

- NPC A는 지금 무엇을 할까?
- 몬스터 B는 어디로 이동할까?
- 다음 사건은 무엇일까?

이 방식은 다음 문제가 있다.

- 행동의 일관성이 유지되지 않는다.
- 같은 상태에서 다른 결과가 발생한다.
- 비용이 크다.
- 대규모 주체를 동시에 처리하기 어렵다.
- 게임 규칙을 검증할 수 없다.
- 플레이어가 시스템을 학습하기 어렵다.

생성 AI의 역할은 세계 정의를 작성하는 것이다. 실제 월드 진행은 작성된 상태와 규칙을 코드가 실행한다.

- **생성 AI**: 세계 명제, 상태 종류, 규칙, 종족, 목적 그래프를 생성한다.
- **시뮬레이션 코드**: 정의된 규칙에 따라 상태를 변경한다.
- **생성 AI 또는 텍스트 생성기**: 발생한 결과를 사람이 읽기 쉬운 사건 설명으로 변환한다.

이를 다음처럼 구분한다.

| 단계 | 설명 |
|---|---|
| World Generation Time | 세계의 구조를 생성하고 검증하는 단계 |
| World Runtime | 생성된 구조에 따라 세계가 실제로 작동하는 단계 |
| Presentation Time | 상태 변화와 사건을 플레이어가 이해할 수 있는 표현으로 변환하는 단계 |

## 3. 전체 시스템 아키텍처

```
┌──────────────────────────────────────────────┐
│ 1. World Seed Editor                         │
│ 사용자가 세계관 주제를 입력한다.            │
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│ 2. World Compiler                            │
│ 주제를 세계 명제와 실행 데이터로 변환한다.  │
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│ 3. World Validator                           │
│ 모순, 누락, 무한 순환, 정체 상태를 검증한다.│
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│ 4. World Bootstrapper                        │
│ 지역, 자원, 종, 조직, 개인을 배치한다.       │
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│ 5. Simulation Runtime                        │
│ 세계 규칙과 주체 행동을 실행한다.            │
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│ 6. Event Interpreter                         │
│ 상태 변화 묶음을 의미 있는 사건으로 해석한다│
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│ 7. Web Viewer                                │
│ 지도, 인물, 관계, 사건, 시간 흐름을 보여준다│
└──────────────────────────────────────────────┘
```

## 4. 사용자가 입력하는 최소 세계관 데이터

사용자에게 복잡한 설정 양식을 요구하면 안 된다. 초기 입력은 자유로운 문장 몇 개로 충분해야 한다.

```typescript
interface WorldSeedInput {
  title?: string;
  themes: string[];
  desiredExperiences?: string[];
  prohibitedElements?: string[];
}
```

예시:

```json
{
  "title": "제약의 대륙",
  "themes": [
    "모든 생명은 생존하려 한다.",
    "인간은 자신의 의지에 제약을 걸어 특수 능력을 사용할 수 있다.",
    "강한 능력은 더 큰 대가를 요구한다.",
    "문명 밖에는 인간이 알지 못하는 거대한 영역이 존재한다."
  ],
  "desiredExperiences": [
    "알 수 없는 생물과 환경을 탐험한다.",
    "상대 능력의 조건을 추론한다.",
    "다양한 조직과 인물의 이해관계에 개입한다.",
    "선택에 따라 새로운 성장 가능성을 발견한다."
  ],
  "prohibitedElements": [
    "NPC 머리 위에 고정 퀘스트 표시",
    "고정 레벨에 따른 지역 순차 진행",
    "아무 이유 없이 배치된 몬스터"
  ]
}
```

입력된 문장은 바로 콘텐츠로 사용하지 않는다. 먼저 의미 단위로 분해한다.

## 5. 세계 생성 컴파일러

세계 생성 컴파일러는 자연어 세계관을 실행 가능한 `WorldDefinition`으로 변환하는 모듈이다.

```typescript
interface WorldDefinition {
  metadata: WorldMetadata;
  axioms: WorldAxiom[];
  stateSchemas: StateSchema[];
  ruleDefinitions: RuleDefinition[];
  spaces: SpaceDefinition[];
  resources: ResourceDefinition[];
  species: SpeciesDefinition[];
  factions: FactionDefinition[];
  agentArchetypes: AgentArchetype[];
  abilitySystem: AbilitySystemDefinition;
  goalTemplates: GoalTemplate[];
  actionDefinitions: ActionDefinition[];
  eventPatterns: EventPattern[];
  bootstrap: BootstrapDefinition;
}
```

컴파일 과정은 다음 순서로 진행한다.

1. 주제 정규화
2. 핵심 명제 추출
3. 생존 압력 추출
4. 상태 스키마 생성
5. 세계 규칙 생성
6. 자원과 공간 생성
7. 종족 생성
8. 조직 생성
9. 능력 체계 생성
10. 목적 그래프 템플릿 생성
11. 행동 정의 생성
12. 사건 패턴 생성
13. 초기 세계 배치
14. 정합성 검증
15. 실행 데이터 저장

## 6. 1단계: 주제 정규화

자유로운 문장에서 다음 요소를 추출한다.

```typescript
interface NormalizedTheme {
  subject: string;
  condition?: string;
  behavior?: string;
  desiredState?: string;
  cost?: string;
  threat?: string;
  scope: "world" | "species" | "society" | "individual";
}
```

입력:

> 인간은 자신의 의지에 제약을 걸어 특수 능력을 사용할 수 있다.

정규화된 결과:

```json
{
  "subject": "human",
  "condition": "self_imposed_restriction",
  "behavior": "use_supernatural_ability",
  "cost": "restriction_and_failure_penalty",
  "scope": "species"
}
```

입력:

> 강한 생명과 희귀한 자원은 위험한 지역에 집중되어 있다.

정규화된 결과:

```json
{
  "subject": "world_resource_distribution",
  "condition": "high_environmental_danger",
  "desiredState": "high_value_resources_and_powerful_life",
  "scope": "world"
}
```

정규화 단계에서는 새로운 설정을 지나치게 추가하지 않는다. 입력된 문장이 의미하는 최소한의 구조만 추출한다.

## 7. 2단계: 세계 핵심 명제 생성

정규화된 주제에서 변하지 않는 세계의 전제를 생성한다.

```typescript
interface WorldAxiom {
  id: string;
  statement: string;
  category:
    | "existence"
    | "survival"
    | "power"
    | "cost"
    | "ecology"
    | "society"
    | "information";
  immutable: boolean;
  derivedFrom: string[];
}
```

예시:

```json
[
  {
    "id": "axiom.life_survival",
    "statement": "모든 생명은 자신이 생존 단위로 인식하는 대상을 지속시키려 한다.",
    "category": "survival",
    "immutable": true,
    "derivedFrom": ["theme_0"]
  },
  {
    "id": "axiom.power_restriction",
    "statement": "인간의 특수 능력은 스스로 받아들인 제약에 의해 증폭된다.",
    "category": "power",
    "immutable": true,
    "derivedFrom": ["theme_1"]
  },
  {
    "id": "axiom.power_cost",
    "statement": "강한 능력은 강한 조건이나 손실 가능성을 요구한다.",
    "category": "cost",
    "immutable": true,
    "derivedFrom": ["theme_2"]
  },
  {
    "id": "axiom.danger_value",
    "statement": "위험이 높은 지역일수록 희귀한 생명과 자원이 존재할 가능성이 높다.",
    "category": "ecology",
    "immutable": true,
    "derivedFrom": ["theme_3"]
  }
]
```

이 명제들은 이후 생성되는 모든 규칙과 콘텐츠의 상위 제약이다. 어떤 종족이나 능력도 이 명제를 이유 없이 위반할 수 없다.

## 8. 3단계: 생존 압력 생성

각 생명체가 왜 움직여야 하는지를 만든다.

```typescript
interface SurvivalPressureDefinition {
  id: string;
  targetState: string;
  failureState: string;
  urgencyGrowth: number;
  applicableSpeciesTags: string[];
  relatedResources: string[];
}
```

기본적인 생존 압력은 다음과 같다.

- 신체 유지
- 에너지 확보
- 안전 확보
- 영역 확보
- 번식
- 집단 유지
- 정체성 유지
- 신념 유지
- 정보 확보
- 미래 위험 대비

모든 종에게 동일하게 부여하지 않는다. 예를 들어 인간은 다음 압력을 가질 수 있다.

```json
{
  "id": "pressure.human_identity",
  "targetState": "자신이 중요하게 여기는 가치와 정체성이 유지된다.",
  "failureState": "자신을 자신이라고 판단할 근거가 붕괴한다.",
  "urgencyGrowth": 0.1,
  "applicableSpeciesTags": ["human"],
  "relatedResources": ["memory", "relationships", "social_role"]
}
```

군체 생물은 개인의 정체성보다 여왕이나 군체의 생존을 우선할 수 있다.

```json
{
  "id": "pressure.hive_continuity",
  "targetState": "군체의 번식 기능이 지속된다.",
  "failureState": "여왕 또는 번식 기관이 소멸한다.",
  "urgencyGrowth": 0.8,
  "applicableSpeciesTags": ["hive_species"],
  "relatedResources": ["queen", "nutrients", "nest_temperature"]
}
```

## 9. 4단계: 세계 상태 스키마 생성

세계 상태는 임의의 문자열로 저장하지 않는다. 상태의 종류, 범위, 소유자, 관찰 가능성을 명확히 정의한다.

```typescript
type StateOwnerType =
  | "world"
  | "region"
  | "location"
  | "species"
  | "faction"
  | "agent"
  | "relationship"
  | "resource";

interface StateSchema {
  id: string;
  ownerType: StateOwnerType;
  dataType: "number" | "boolean" | "string" | "enum" | "set" | "map";
  defaultValue: unknown;
  min?: number;
  max?: number;
  observable: boolean;
  observationChannels?: string[];
  updatePolicy: "continuous" | "event" | "derived";
}
```

### 9.1 실제 세계 상태

```typescript
interface WorldState {
  simulationTime: number;
  entities: Record<string, EntityState>;
  relationships: Record<string, RelationshipState>;
  globalStates: Record<string, unknown>;
}
```

개체 상태 예시:

```typescript
interface EntityState {
  id: string;
  type: "agent" | "resource" | "location" | "faction";
  position?: Position;
  states: Record<string, unknown>;
  tags: string[];
  activeGoals?: ActiveGoalState[];
}
```

인간 개체의 실제 상태는 다음처럼 구성할 수 있다.

```json
{
  "id": "agent.rion",
  "type": "agent",
  "position": {
    "regionId": "region.silent_forest",
    "x": 41,
    "y": 18
  },
  "tags": ["human", "researcher", "ability_user"],
  "states": {
    "health": 72,
    "energy": 46,
    "hunger": 18,
    "fear": 34,
    "curiosity": 87,
    "social_status": 41,
    "ability_stability": 63,
    "known_threat_level": 55
  }
}
```

## 10. 실제 상태와 믿음 상태의 분리

주체는 세계 상태를 직접 읽지 못한다. 각 주체는 자신만의 믿음 상태를 가진다.

```typescript
interface BeliefRecord {
  subjectId: string;
  stateKey: string;
  believedValue: unknown;
  confidence: number;
  sourceIds: string[];
  lastUpdatedAt: number;
}
```

예를 들어 실제 변이 생물의 상태가 다음과 같다고 하자.

```json
{
  "states": {
    "aggression": 12,
    "offspringThreat": 95,
    "hunger": 32
  }
}
```

마을 사람은 다음처럼 믿을 수 있다.

```json
{
  "subjectId": "creature.echo_beast_01",
  "stateKey": "aggression",
  "believedValue": 90,
  "confidence": 0.82,
  "sourceIds": ["rumor.caravan_attack"],
  "lastUpdatedAt": 4200
}
```

연구자는 다르게 추론할 수 있다.

```json
{
  "subjectId": "creature.echo_beast_01",
  "stateKey": "protecting_offspring",
  "believedValue": true,
  "confidence": 0.64,
  "sourceIds": [
    "observation.footprint_pattern",
    "observation.untouched_food"
  ],
  "lastUpdatedAt": 4250
}
```

이 차이 때문에 같은 생물을 두고 토벌, 연구, 보호, 밀렵이 동시에 발생한다.

## 11. 5단계: 세계 규칙 생성

세계 규칙은 다음 형식으로 저장한다.

```typescript
interface RuleDefinition {
  id: string;
  name: string;
  scope: "global" | "region" | "entity" | "relationship";
  priority: number;
  triggers: RuleTrigger[];
  conditions: RuleCondition[];
  effects: RuleEffect[];
  observations: ObservationEffect[];
  cooldown?: number;
  derivedFromAxioms: string[];
}
```

### 11.1 규칙 트리거

```typescript
type RuleTrigger =
  | {
      type: "state_changed";
      stateKey: string;
    }
  | {
      type: "interval";
      interval: number;
    }
  | {
      type: "action_executed";
      actionId: string;
    }
  | {
      type: "entity_entered";
      locationTag: string;
    }
  | {
      type: "relationship_changed";
      relationshipKey: string;
    };
```

### 11.2 규칙 조건

```typescript
interface RuleCondition {
  left: ValueReference;
  operator: ">" | ">=" | "<" | "<=" | "==" | "!=" | "contains";
  right: ValueReference;
}
```

### 11.3 규칙 효과

```typescript
type RuleEffect =
  | {
      type: "modify_state";
      target: TargetSelector;
      stateKey: string;
      operation: "add" | "multiply" | "set";
      value: number | boolean | string;
    }
  | {
      type: "transfer_resource";
      resourceId: string;
      from: TargetSelector;
      to: TargetSelector;
      amount: number;
    }
  | {
      type: "create_entity";
      templateId: string;
      location: TargetSelector;
    }
  | {
      type: "destroy_entity";
      target: TargetSelector;
    }
  | {
      type: "emit_signal";
      signalId: string;
      intensity: number;
    }
  | {
      type: "schedule_rule";
      ruleId: string;
      delay: number;
    };
```

### 11.4 능력 제약 규칙 예시

```json
{
  "id": "rule.ability_restriction_amplification",
  "name": "제약에 의한 능력 증폭",
  "scope": "entity",
  "priority": 80,
  "triggers": [
    {
      "type": "action_executed",
      "actionId": "action.use_ability"
    }
  ],
  "conditions": [
    {
      "left": {
        "type": "actor_state",
        "key": "restriction_valid"
      },
      "operator": "==",
      "right": {
        "type": "constant",
        "value": true
      }
    }
  ],
  "effects": [
    {
      "type": "modify_state",
      "target": {
        "type": "actor"
      },
      "stateKey": "ability_output",
      "operation": "multiply",
      "value": 1.8
    },
    {
      "type": "modify_state",
      "target": {
        "type": "actor"
      },
      "stateKey": "failure_penalty_risk",
      "operation": "add",
      "value": 25
    }
  ],
  "observations": [
    {
      "channel": "energy_sense",
      "signal": "unstable_high_density_energy",
      "strength": 76
    }
  ],
  "derivedFromAxioms": [
    "axiom.power_restriction",
    "axiom.power_cost"
  ]
}
```

## 12. 규칙 DSL

프로토타입에서는 모든 규칙을 TypeScript 코드로 작성하지 않는다. JSON 기반의 규칙 언어를 만든다. 사람과 생성 AI가 모두 작성할 수 있어야 한다.

```json
{
  "when": {
    "event": "region.temperature.changed"
  },
  "if": [
    {
      "path": "region.temperature",
      "operator": "<",
      "value": -10
    },
    {
      "path": "region.durationBelowFreezing",
      "operator": ">",
      "value": 72
    }
  ],
  "then": [
    {
      "effect": "multiply",
      "targetQuery": "entities[tag=plant]",
      "path": "states.health",
      "value": 0.8
    },
    {
      "effect": "emit",
      "signal": "frozen_vegetation"
    }
  ]
}
```

규칙 DSL은 다음 능력을 지원해야 한다.

- 조건 비교
- 상태 변경
- 자원 이동
- 개체 생성과 소멸
- 관계 변경
- 신호 발생
- 예약된 효과
- 확률적 효과
- 주변 개체 검색
- 태그 기반 대상 선택

단, 확률은 인과관계를 대체하는 용도로 사용하지 않는다. 확률은 다음 용도로 제한한다.

- 개체별 성향 차이
- 불완전한 행동 결과
- 돌연변이
- 관찰 실패
- 여러 가능한 행동 중 선택

## 13. 6단계: 세계 공간 생성

초기 프로토타입의 공간은 완전한 3D 월드가 아니다. 그래프와 2D 좌표가 결합된 형태로 구현한다.

```typescript
interface SpaceDefinition {
  regions: RegionDefinition[];
  locations: LocationDefinition[];
  connections: SpaceConnection[];
}
```

지역:

```typescript
interface RegionDefinition {
  id: string;
  name: string;
  bounds: {
    width: number;
    height: number;
  };
  tags: string[];
  baseStates: Record<string, unknown>;
  resourceProfiles: ResourceSpawnProfile[];
  speciesSuitability: Record<string, number>;
}
```

공간 연결:

```typescript
interface SpaceConnection {
  from: string;
  to: string;
  travelCost: number;
  danger: number;
  capacity: number;
  requirements?: ConditionDefinition[];
}
```

세계관에서 다음 명제가 주어졌다고 하자.

> 위험한 지역일수록 희귀한 자원이 많다.

이를 지역 생성 함수로 컴파일한다.

```typescript
function calculateResourceRarity(
  danger: number,
  accessibility: number,
  environmentalStability: number
): number {
  return (
    danger * 0.55 +
    (100 - accessibility) * 0.3 +
    (100 - environmentalStability) * 0.15
  );
}
```

이 함수는 특정 자원을 직접 배치하지 않는다. 지역의 조건으로부터 희귀 자원이 존재할 가능성과 종류를 결정한다.

## 14. 7단계: 자원 생성

자원은 단순한 채집물이 아니다. 주체의 목적을 달성하는 데 필요한 상태 변화 수단이다.

```typescript
interface ResourceDefinition {
  id: string;
  name: string;
  tags: string[];
  properties: Record<string, number | boolean | string>;
  productionRules: string[];
  consumptionRules: string[];
  transformationRules: string[];
  desiredBy: DesireMapping[];
}
```

예시:

```json
{
  "id": "resource.will_crystal",
  "name": "의지 결정",
  "tags": ["rare", "ability_material", "unstable"],
  "properties": {
    "energyDensity": 82,
    "stability": 31,
    "informationRetention": 68
  },
  "productionRules": [
    "rule.accumulated_ability_residue_crystallization"
  ],
  "consumptionRules": [
    "rule.ability_tool_creation",
    "rule.ability_recovery"
  ],
  "transformationRules": [
    "rule.will_crystal_overload"
  ],
  "desiredBy": [
    {
      "agentTag": "ability_researcher",
      "utility": 90
    },
    {
      "agentTag": "smuggler",
      "utility": 74
    },
    {
      "agentTag": "wild_creature",
      "utility": -20
    }
  ]
}
```

자원에는 반드시 다음이 있어야 한다.

- 어떻게 만들어지는가
- 누가 필요로 하는가
- 왜 희소한가
- 어디에서 존재하는가
- 무엇으로 변환되는가
- 과도하게 사용하면 무엇이 발생하는가

## 15. 8단계: 종족 생성

종족 정의는 외형과 전투 능력보다 생존 구조를 우선한다.

```typescript
interface SpeciesDefinition {
  id: string;
  name: string;
  survivalUnit:
    | "individual"
    | "family"
    | "pack"
    | "hive"
    | "lineage"
    | "host"
    | "memory";
  requiredResources: ResourceNeed[];
  senses: SenseDefinition[];
  instincts: GoalTemplateReference[];
  reproduction: ReproductionDefinition;
  socialStructure: SocialStructureDefinition;
  adaptationRules: string[];
  growthRules: string[];
  abilityAccess?: AbilityAccessDefinition;
}
```

종족 생성 과정:

```
세계의 생존 압력
→ 생존 가능한 전략 후보 생성
→ 서로 다른 전략을 종족으로 구체화
→ 전략의 장점과 약점 부여
→ 필요한 감각과 신체 특성 생성
→ 번식과 사회 구조 생성
→ 다른 종과의 경쟁 관계 생성
```

예를 들어 위험한 미지의 숲에서 살아가는 생물은 다음 전략 중 하나를 선택할 수 있다.

- 위협보다 강해진다.
- 위협을 감지해 피한다.
- 무리를 만들어 방어한다.
- 위협과 비슷한 모습을 모방한다.
- 강한 생명체에 기생한다.
- 환경과 동화된다.
- 빠르게 번식해 손실을 상쇄한다.

이 중 현상 모방 전략에서 하나의 종을 생성한다.

```json
{
  "id": "species.echo_beast",
  "name": "반향수",
  "survivalUnit": "family",
  "requiredResources": [
    {
      "resourceTag": "organic_food",
      "amountPerDay": 4
    },
    {
      "resourceTag": "ability_residue",
      "amountPerDay": 1
    }
  ],
  "senses": [
    {
      "channel": "sound",
      "range": 60,
      "accuracy": 0.7
    },
    {
      "channel": "energy_sense",
      "range": 35,
      "accuracy": 0.9
    }
  ],
  "instincts": [
    "goal.survive",
    "goal.protect_offspring",
    "goal.learn_threat_pattern"
  ],
  "adaptationRules": [
    "rule.echo_beast_observe_ability",
    "rule.echo_beast_mimic_observed_effect"
  ],
  "growthRules": [
    "rule.echo_beast_adaptation_growth"
  ]
}
```

## 16. 9단계: 인간 능력 체계 생성

인간의 특수 능력은 고정된 스킬 목록으로 만들지 않는다. 각 능력은 다음 구조로 생성한다.

```typescript
interface AbilityDefinition {
  id: string;
  ownerId: string;
  purpose: string;
  targetTypes: string[];
  operation: AbilityOperation;
  medium: string;
  activationConditions: ConditionDefinition[];
  maintenanceConditions: ConditionDefinition[];
  restrictions: RestrictionDefinition[];
  costs: CostDefinition[];
  failureEffects: RuleEffect[];
  observableSignals: ObservationEffect[];
  knownBy: string[];
  mastery: number;
}
```

능력 생성 함수의 입력:

```typescript
interface AbilityGenerationContext {
  coreDesire: string;
  traumaticExperience?: string;
  preferredMethods: string[];
  unacceptableActions: string[];
  acceptableCosts: string[];
  physicalTraits: string[];
  acquiredKnowledge: string[];
}
```

능력 생성 절차:

1. 핵심 욕망을 추출한다.
2. 욕망이 원하는 세계 상태를 정의한다.
3. 인물이 선호하는 문제 해결 방식을 찾는다.
4. 작용 대상을 정한다.
5. 작용 방식을 정한다.
6. 인물이 받아들일 수 있는 제약을 선택한다.
7. 제약의 강도로 출력 범위를 계산한다.
8. 실패 반동을 만든다.
9. 다른 주체가 관찰할 수 있는 현상을 만든다.
10. 상대가 추론할 수 있는 약점을 만든다.

출력 예시:

```json
{
  "id": "ability.contract_truth",
  "ownerId": "agent.sera",
  "purpose": "거짓 계약으로부터 자신과 동료를 보호한다.",
  "targetTypes": ["agent", "contract"],
  "operation": "detect_contract_violation",
  "medium": "spoken_mutual_declaration",
  "activationConditions": [
    {
      "path": "contract.acceptedByBoth",
      "operator": "==",
      "value": true
    }
  ],
  "maintenanceConditions": [
    {
      "path": "owner.hasNotLiedSinceActivation",
      "operator": "==",
      "value": true
    }
  ],
  "restrictions": [
    {
      "description": "사용자는 계약 기간 동안 고의적인 거짓말을 할 수 없다.",
      "severity": 78
    }
  ],
  "costs": [
    {
      "type": "mental_fatigue",
      "baseAmount": 12
    }
  ],
  "failureEffects": [
    {
      "type": "modify_state",
      "target": {
        "type": "actor"
      },
      "stateKey": "memory_integrity",
      "operation": "add",
      "value": -15
    }
  ],
  "observableSignals": [
    {
      "channel": "vision",
      "signal": "contract_symbols_appear_on_skin",
      "strength": 55
    }
  ],
  "knownBy": ["agent.sera"],
  "mastery": 42
}
```

## 17. 10단계: 조직 생성

조직은 여러 NPC가 소속된 이름표가 아니다. 조직 자체가 목적과 상태를 가진 주체다.

```typescript
interface FactionDefinition {
  id: string;
  name: string;
  publicPurpose: string;
  hiddenPurposes: string[];
  requiredStates: DesiredStateDefinition[];
  controlledResources: string[];
  structures: FactionStructureDefinition[];
  policies: PolicyDefinition[];
  internalGroups: InternalGroupDefinition[];
  relationshipDefaults: Record<string, number>;
  collapseConditions: ConditionDefinition[];
}
```

조직 생성 절차:

1. 희소 자원을 선택한다.
2. 그 자원을 필요로 하는 집단을 만든다.
3. 자원을 통제하는 방식에 따라 제도를 만든다.
4. 제도에 이익을 얻는 내부 집단을 만든다.
5. 제도에 손해를 보는 내부 집단을 만든다.
6. 조직 외부 경쟁자를 만든다.
7. 조직이 공개적으로 말하는 목적과 실제 생존 목적을 분리한다.

예를 들어 의지 결정이 중요한 자원이라면 다음 조직들이 파생될 수 있다.

- 결정 채굴을 독점하는 국가 기관
- 결정이 생태계를 파괴한다고 주장하는 자연주의 집단
- 결정으로 능력 도구를 개발하는 연구 조직
- 결정을 밀수하는 범죄 조직
- 결정을 신성한 유해로 보는 종교 집단
- 결정에 의존해 생존하는 변이 생물

조직은 개발자가 임의로 다양성을 추가해서 생성되는 것이 아니다. 하나의 자원과 세계 규칙을 서로 다르게 이용하는 생존 전략에서 파생된다.

## 18. 11단계: 개인 캐릭터 생성

개인은 종족과 조직을 그대로 복사하지 않는다. 종족 본능, 개인 경험, 관계, 가치관이 충돌하도록 생성한다.

```typescript
interface AgentDefinition {
  id: string;
  name: string;
  speciesId: string;
  factionIds: string[];
  traits: Record<string, number>;
  values: ValueDefinition[];
  fears: FearDefinition[];
  memories: MemoryDefinition[];
  beliefs: BeliefRecord[];
  relationships: RelationshipReference[];
  goalGraphId: string;
  abilityIds: string[];
  inventory: InventoryItem[];
  initialState: Record<string, unknown>;
}
```

개인 생성 절차:

1. 종족의 기본 생존 목적을 복사한다.
2. 출신 환경을 선택한다.
3. 과거 생존 사건을 생성한다.
4. 사건으로 가치관과 두려움을 만든다.
5. 조직의 역할을 부여한다.
6. 조직 목적과 개인 가치관 사이의 갈등을 만든다.
7. 가장 중요한 관계를 만든다.
8. 현재 해결해야 하는 문제를 만든다.
9. 능력을 개인의 경험에서 생성한다.
10. 목적 그래프의 가중치를 개인화한다.

성격은 단어 몇 개가 아니라 판단 변수로 저장한다.

```json
{
  "riskTolerance": 34,
  "curiosity": 82,
  "loyalty": 61,
  "greed": 23,
  "empathy": 74,
  "vengefulness": 48,
  "patience": 57,
  "deceptionPreference": 18,
  "uncertaintyAversion": 41
}
```

## 19. 12단계: 목적 그래프 생성

목적은 중첩된 목록이 아니라 그래프다.

```typescript
interface GoalGraph {
  id: string;
  nodes: GoalNode[];
  edges: GoalEdge[];
}
```

목적 노드:

```typescript
interface GoalNode {
  id: string;
  description: string;
  targetConditions: ConditionDefinition[];
  baseImportance: number;
  urgencyPolicy: UrgencyPolicy;
  utilityFactors: UtilityFactor[];
  abandonmentConditions: ConditionDefinition[];
  completionEffects: GoalCompletionEffect[];
  allowedActionTags: string[];
}
```

목적 간 연결:

```typescript
interface GoalEdge {
  from: string;
  to: string;
  relation:
    | "requires"
    | "supports"
    | "conflicts"
    | "alternative"
    | "reveals"
    | "creates";
  weight: number;
}
```

개인의 목적 그래프 예시:

```
가족을 생존시킨다.
    ├─ 안전한 거주지를 확보한다.
    │     ├─ 지역 통행권을 얻는다.
    │     └─ 위협 생물을 제거하거나 이동시킨다.
    │
    ├─ 식량을 확보한다.
    │     ├─ 사냥한다.
    │     ├─ 구매한다.
    │     └─ 조직과 거래한다.
    │
    └─ 자신을 추적하는 조직을 막는다.
          ├─ 협상한다.
          ├─ 증거를 제거한다.
          ├─ 조직 내부의 적을 회유한다.
          └─ 더 강한 세력의 보호를 받는다.
```

동시에 다음 목적이 충돌할 수 있다.

```
가족을 생존시킨다.
↕ 충돌
자신의 신념을 배신하지 않는다.
```

이 충돌이 캐릭터의 선택을 만든다.

## 20. 목적 활성도 계산

모든 목적을 동시에 실행하지 않는다. 각 목적의 현재 활성도를 계산한다.

```typescript
function calculateGoalActivation(
  agent: AgentRuntimeState,
  goal: GoalNode,
  world: WorldState
): number {
  const needPressure = evaluateNeedPressure(agent, goal, world);
  const urgency = evaluateUrgency(agent, goal, world);
  const valueAlignment = evaluateValueAlignment(agent, goal);
  const relationshipImpact = evaluateRelationshipImpact(agent, goal, world);
  const emotionalBias = evaluateEmotionalBias(agent, goal);
  const feasibility = evaluateFeasibility(agent, goal, world);
  const expectedUtility = evaluateExpectedUtility(agent, goal, world);

  const cost = evaluateExpectedCost(agent, goal, world);
  const risk = evaluateExpectedRisk(agent, goal, world);
  const conflict = evaluateGoalConflicts(agent, goal);

  return (
    goal.baseImportance +
    needPressure +
    urgency +
    valueAlignment +
    relationshipImpact +
    emotionalBias +
    feasibility +
    expectedUtility -
    cost -
    risk -
    conflict
  );
}
```

중요한 것은 계산에 실제 상태가 아니라 주체가 믿는 상태를 사용한다는 점이다.

```typescript
const feasibility = evaluateFeasibility(
  agent,
  goal,
  agent.beliefModel
);
```

따라서 잘못된 믿음을 가진 주체는 잘못된 결정을 내릴 수 있다.

## 21. 13단계: 행동 정의 생성

행동은 애니메이션 이름이 아니다. 세계 상태를 변화시키려는 시도다.

```typescript
interface ActionDefinition {
  id: string;
  name: string;
  tags: string[];
  actorRequirements: ConditionDefinition[];
  targetQuery?: TargetQuery;
  worldRequirements: ConditionDefinition[];
  costs: CostDefinition[];
  duration: number;
  expectedEffects: ExpectedEffect[];
  executionRules: string[];
  visibleSignals: ObservationEffect[];
}
```

행동 예시:

- 이동한다.
- 관찰한다.
- 추적한다.
- 수집한다.
- 공격한다.
- 방어한다.
- 도주한다.
- 협상한다.
- 거래한다.
- 설득한다.
- 거짓말한다.
- 협박한다.
- 고용한다.
- 동맹을 제안한다.
- 계약한다.
- 소문을 퍼뜨린다.
- 증거를 숨긴다.
- 제작한다.
- 연구한다.
- 능력을 사용한다.
- 다른 주체에게 행동을 위임한다.

NPC 전용 행동과 플레이어 전용 행동을 분리하지 않는다. 가능하다면 같은 행동 체계를 사용한다.

## 22. 행동 후보 생성

현재 활성화된 목적에 대해 가능한 행동 후보를 생성한다.

```typescript
interface ActionCandidate {
  actionId: string;
  targetIds: string[];
  expectedGoalProgress: number;
  expectedCost: number;
  expectedRisk: number;
  valueAlignment: number;
  confidence: number;
  score: number;
}
```

```typescript
function generateActionCandidates(
  agent: AgentRuntimeState,
  activeGoal: GoalNode,
  world: WorldState
): ActionCandidate[] {
  return actionRegistry
    .findByTags(activeGoal.allowedActionTags)
    .filter(action => satisfiesActorRequirements(agent, action))
    .flatMap(action => findPossibleTargets(agent, action, world))
    .map(candidate => scoreActionCandidate(agent, activeGoal, candidate));
}
```

행동 점수:

```typescript
function scoreActionCandidate(
  agent: AgentRuntimeState,
  goal: GoalNode,
  candidate: ActionCandidate
): ActionCandidate {
  candidate.score =
    candidate.expectedGoalProgress * 1.4 +
    candidate.valueAlignment +
    candidate.confidence * 0.7 -
    candidate.expectedCost -
    candidate.expectedRisk * getRiskSensitivity(agent);

  return candidate;
}
```

항상 최고 점수만 선택하면 모든 행동이 지나치게 최적화된다. 개인 성향에 따라 상위 후보 중 확률적으로 선택한다.

```typescript
function selectAction(
  agent: AgentRuntimeState,
  candidates: ActionCandidate[]
): ActionCandidate {
  const randomness =
    agent.traits.impulsiveness * 0.01 +
    agent.states.stress * 0.005;

  return weightedSoftmaxSelection(candidates, randomness);
}
```

## 23. 14단계: 인식 시스템

주체는 주변에서 발생한 모든 상태 변경을 알지 못한다. 규칙과 행동은 `ObservationSignal`을 생성한다.

```typescript
interface ObservationSignal {
  id: string;
  sourceId?: string;
  locationId: string;
  channels: ObservationChannel[];
  strength: number;
  tags: string[];
  payload: Record<string, unknown>;
  createdAt: number;
}
```

관찰 채널:

- 시각
- 청각
- 후각
- 촉각
- 진동
- 열
- 의력 감지
- 흔적
- 대화
- 문서
- 소문
- 조직 보고

관찰 여부:

```typescript
function canObserve(
  agent: AgentRuntimeState,
  signal: ObservationSignal,
  world: WorldState
): boolean {
  const channelScore = getBestMatchingSense(agent, signal.channels);
  const distancePenalty = calculateDistancePenalty(agent, signal, world);
  const obstructionPenalty = calculateObstruction(agent, signal, world);
  const attentionModifier = getAttentionModifier(agent, signal);

  return (
    channelScore +
      signal.strength +
      attentionModifier -
      distancePenalty -
      obstructionPenalty >
    50
  );
}
```

관찰에 성공하면 곧바로 사실이 되지 않는다.

```
신호 관찰
→ 기존 기억과 비교
→ 가능한 원인 후보 생성
→ 성격과 편견 적용
→ 믿음 생성 또는 수정
```

## 24. 기억 시스템

모든 사건을 영구 저장하면 데이터가 무한히 증가한다. 기억은 중요도에 따라 요약되고 소멸해야 한다.

```typescript
interface MemoryDefinition {
  id: string;
  type:
    | "observation"
    | "interaction"
    | "success"
    | "failure"
    | "trauma"
    | "promise"
    | "betrayal"
    | "discovery";
  participants: string[];
  tags: string[];
  emotionalIntensity: number;
  relevance: number;
  confidence: number;
  createdAt: number;
  decayRate: number;
  summary: string;
}
```

기억 중요도:

```typescript
function calculateMemoryImportance(
  agent: AgentRuntimeState,
  memory: MemoryDefinition
): number {
  return (
    memory.emotionalIntensity * 0.4 +
    memory.relevance * 0.3 +
    relationshipRelevance(agent, memory) * 0.2 +
    survivalRelevance(agent, memory) * 0.4
  );
}
```

낮은 중요도의 기억은 다음처럼 통합한다.

> **개별 기억**: 상인 A에게 세 번 비싼 가격으로 물건을 구매했다.
>
> **요약 믿음**: 상인 A는 나를 상대로 가격을 높게 부르는 경향이 있다.

## 25. 관계 시스템

관계는 호감도 하나로 표현하지 않는다.

```typescript
interface RelationshipState {
  fromId: string;
  toId: string;
  trust: number;
  fear: number;
  respect: number;
  affection: number;
  resentment: number;
  dependency: number;
  debt: number;
  familiarity: number;
  knownSecrets: string[];
  promises: PromiseState[];
}
```

관계 변화 규칙 예시:

```
도움을 받음
→ 신뢰 증가
→ 빚 증가
→ 의존 가능성 증가

위협을 받음
→ 공포 증가
→ 원한 증가
→ 신뢰 감소

강한 능력을 목격함
→ 존경 또는 공포 증가
→ 해당 능력에 대한 정보 획득

약속을 위반함
→ 신뢰 급감
→ 원한 증가
→ 관련 조직에 소문 확산
```

같은 행동도 기존 관계에 따라 다르게 해석된다.

## 26. 15단계: 시뮬레이션 런타임

월드는 고정 프레임마다 모든 개체를 계산하지 않는다. 이벤트 기반 시뮬레이션을 사용한다.

```typescript
interface ScheduledSimulationEvent {
  id: string;
  executeAt: number;
  type: string;
  targetIds: string[];
  payload: Record<string, unknown>;
  priority: number;
}
```

메인 루프:

```typescript
function simulationStep(runtime: WorldRuntime, deltaTime: number): void {
  runtime.time += deltaTime;

  processScheduledEvents(runtime);
  processChangedStateRules(runtime);
  processObservationSignals(runtime);
  updateUrgentAgents(runtime);
  resolveCompletedActions(runtime);
  detectEmergentEvents(runtime);
  updateEventSummaries(runtime);
}
```

각 주체는 매 틱 판단하지 않는다. 다음 조건에서만 다시 판단한다.

- 현재 행동이 완료되었다.
- 중요한 현상을 관찰했다.
- 목적의 긴급도가 임계치를 넘었다.
- 관계가 크게 변화했다.
- 생존 상태가 악화되었다.
- 새로운 정보가 들어왔다.
- 기존 계획이 불가능해졌다.

```typescript
function shouldReplan(agent: AgentRuntimeState): boolean {
  return (
    agent.currentAction === null ||
    agent.flags.has("important_observation") ||
    agent.flags.has("goal_invalidated") ||
    agent.states.survivalPressure > 70 ||
    agent.states.stress > 85
  );
}
```

## 27. 시뮬레이션 처리 단계

한 주체의 실행 순서는 다음과 같다.

1. 주변 현상을 관찰한다.
2. 기억과 믿음을 갱신한다.
3. 목적 활성도를 계산한다.
4. 현재 목적을 선택한다.
5. 행동 후보를 생성한다.
6. 행동을 선택한다.
7. 행동 비용을 지불한다.
8. 행동을 예약한다.
9. 행동 완료 시 세계 규칙을 실행한다.
10. 상태 변화와 관찰 신호를 생성한다.
11. 주변 주체가 이를 관찰한다.
12. 새로운 목적과 행동이 활성화된다.

구현 코드 형태:

```typescript
function replanAgent(
  agent: AgentRuntimeState,
  runtime: WorldRuntime
): void {
  const activeGoal = selectActiveGoal(agent, runtime.worldState);

  if (!activeGoal) {
    agent.currentAction = createIdleAction(agent);
    return;
  }

  const candidates = generateActionCandidates(
    agent,
    activeGoal,
    runtime.worldState
  );

  if (candidates.length === 0) {
    handleNoAvailableAction(agent, activeGoal, runtime);
    return;
  }

  const selected = selectAction(agent, candidates);
  scheduleAction(agent, selected, runtime);
}
```

## 28. 사건의 자동 탐지

행동 하나를 사건으로 표시하지 않는다. 일정 시간 동안 발생한 관련 상태 변화를 하나의 사건으로 묶는다.

```typescript
interface RawWorldChange {
  time: number;
  sourceId?: string;
  targetIds: string[];
  locationId?: string;
  tags: string[];
  changedStates: StateChange[];
}
```

사건 패턴:

```typescript
interface EventPattern {
  id: string;
  name: string;
  requiredTags: string[];
  optionalTags: string[];
  minimumParticipants: number;
  timeWindow: number;
  locationRadius: number;
  significanceFormula: string;
}
```

예를 들어 다음 변화가 연속적으로 발생했다고 하자.

1. 변이 생물이 상인을 공격한다.
2. 상인이 부상을 입는다.
3. 교역품이 길에 남는다.
4. 마을의 식량 수입이 감소한다.
5. 마을 지도자가 토벌 명령을 내린다.
6. 연구자가 공격 흔적을 조사한다.
7. 밀렵 조직이 희귀종 소문을 듣는다.

사건 탐지기는 이를 다음 사건으로 묶는다.

```json
{
  "type": "ecological_conflict",
  "title": "침묵림 교역로 습격",
  "participants": [
    "species.echo_beast",
    "faction.silent_village",
    "faction.research_society",
    "faction.poachers"
  ],
  "affectedStates": [
    "trade.food_supply",
    "village.fear",
    "creature.territory_pressure",
    "poacher.expected_profit"
  ],
  "status": "ongoing"
}
```

이것이 퀘스트를 대체하는 상황이다.

## 29. 사건 중요도 계산

모든 상태 변화를 플레이어에게 보여줄 필요는 없다.

```typescript
function calculateEventSignificance(
  changes: RawWorldChange[],
  runtime: WorldRuntime
): number {
  return (
    countUniqueParticipants(changes) * 8 +
    countAffectedSystems(changes) * 12 +
    calculateStateChangeMagnitude(changes) * 0.5 +
    calculateRelationshipImpact(changes) * 0.7 +
    calculatePlayerRelevance(changes, runtime.playerId) +
    calculateFuturePotential(changes)
  );
}
```

중요도가 낮은 변화:

- 한 생물이 주변 먹이를 먹었다.
- 상인이 평소 가격으로 물건을 판매했다.
- 경비병이 순찰 경로를 이동했다.

중요도가 높은 변화:

- 포식자의 이동으로 마을 식량 생산이 급감했다.
- 두 조직이 하나의 희귀 생물을 두고 충돌했다.
- 주요 인물이 계약을 위반해 능력 반동을 입었다.
- 플레이어의 행동으로 기존 권력 구조가 붕괴했다.

## 30. 사건과 퀘스트의 관계

플레이어에게는 사건에 대한 개입 가능성을 보여준다. 고정된 퀘스트 목표는 만들지 않는다.

```typescript
interface InterventionOpportunity {
  eventId: string;
  discoveredByPlayer: boolean;
  knownParticipants: string[];
  knownFacts: BeliefRecord[];
  possibleInteractions: string[];
  timeSensitivity: number;
}
```

플레이어가 알 수 있는 내용은 플레이어가 실제로 관찰하거나 전달받은 정보뿐이다.

**플레이어가 아는 것**:

- 교역대가 공격당했다.
- 마을이 토벌 인원을 모집한다.
- 연구자는 공격 원인에 의문을 품는다.

**플레이어가 아직 모르는 것**:

- 마을 지도자가 불법 채굴을 지시했다.
- 변이 생물은 새끼를 보호하고 있다.
- 밀렵 조직이 생물을 노리고 있다.

플레이어는 다음 방식으로 참여할 수 있다.

- 토벌대에 참가한다.
- 습격 현장을 조사한다.
- 생물을 추적한다.
- 연구자를 돕는다.
- 밀렵꾼을 미행한다.
- 상인에게 정보를 판매한다.
- 마을 지도자의 기록을 훔친다.
- 아무것도 하지 않는다.

시스템은 미리 정답을 정하지 않는다.

## 31. 플레이어 구현

플레이어도 다른 주체와 동일한 기본 데이터 구조를 사용한다.

```typescript
interface PlayerRuntimeState extends AgentRuntimeState {
  controlledByUser: true;
  discoveredEntityIds: Set<string>;
  discoveredLocationIds: Set<string>;
  journal: PlayerJournalEntry[];
}
```

차이는 행동 선택을 시스템이 아니라 사용자가 한다는 점이다.

- **NPC**: 목적 활성도 계산 → 행동 후보 평가 → 자동 선택
- **플레이어**: 목적과 상황 정보 표시 → 사용자가 행동 선택

플레이어에게 모든 가능한 행동 버튼을 표시해서는 안 된다. 현재 위치, 능력, 관계, 지식으로 실행 가능한 행동만 표시한다.

## 32. 성장 시스템

성장은 경험치 증가가 아니라 행동 가능성의 확장이다.

```typescript
interface GrowthChange {
  sourceEventId: string;
  type:
    | "physical"
    | "skill"
    | "knowledge"
    | "relationship"
    | "authority"
    | "ability"
    | "identity";
  key: string;
  previousValue: unknown;
  newValue: unknown;
}
```

성장 발생 조건:

- 위험한 행동을 성공했다.
- 새로운 현상을 반복적으로 관찰했다.
- 기존 능력을 다른 방식으로 사용했다.
- 중요한 제약을 선택했다.
- 실패와 반동을 경험했다.
- 새로운 관계나 지위를 얻었다.
- 종이나 환경에 대한 지식을 발견했다.

능력 성장 예시:

> **기존 능력**: 접촉한 물체의 움직임을 3초간 멈춘다.
>
> **반복된 사용 경험**: 빠르게 이동하는 대상을 멈추는 데 실패한다.
>
> **사용자의 선택**: 발동 대상을 자신이 직접 이름 붙인 물체로 제한한다.
>
> **새로운 제약**: 하루에 세 개의 물체에만 이름을 붙일 수 있다.
>
> **성장 결과**: 이름을 붙인 대상에는 거리에 관계없이 능력을 사용할 수 있다.

성장은 수치 증가와 선택 구조를 함께 가진다.

## 33. 생성 AI의 구체적인 역할

생성 AI는 다음 단계에 사용한다.

### 33.1 세계 생성

- 주제 정규화
- 세계 명제 후보 생성
- 상태 스키마 후보 생성
- 규칙 후보 생성
- 종족과 조직 후보 생성
- 캐릭터 배경 생성
- 목적 그래프 생성
- 능력 구조 생성

### 33.2 정합성 검사 보조

- 세계 명제를 위반하는 규칙 탐지
- 이유 없이 존재하는 자원 탐지
- 목적 없는 조직 탐지
- 대가 없는 강력한 능력 탐지
- 다른 요소와 연결되지 않은 설정 탐지

### 33.3 표현 생성

- 사건 제목
- 인물의 대화
- 소문
- 문서
- 관찰 묘사
- 사건 요약

생성 AI에게 월드 상태 전체를 매번 전달하지 않는다. 필요한 구조화된 정보만 제공한다.

```json
{
  "speaker": {
    "name": "리온",
    "values": ["지식", "생명 보호"],
    "fear": "연구 결과가 권력자에게 이용되는 것",
    "currentGoal": "변이 생물을 생포한다",
    "relationshipToPlayer": {
      "trust": 48,
      "respect": 61
    }
  },
  "knownFacts": [
    "생물은 먹이를 가져가지 않았다.",
    "공격은 둥지 근처에서만 발생했다."
  ],
  "unknownFacts": [
    "마을 지도자가 채굴을 지시했다."
  ],
  "conversationPurpose": "플레이어에게 조사 협력을 요청한다."
}
```

생성 결과는 세계 상태를 직접 변경하지 않는다. 대화가 실제 행동이나 계약으로 이어질 경우 시스템이 별도로 규칙을 실행한다.

## 34. 생성 결과 검증

생성 AI의 결과는 그대로 저장하지 않는다. JSON 스키마 검증과 의미 검증을 통과해야 한다.

```typescript
interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  targetId: string;
  message: string;
  suggestedFix?: string;
}
```

필수 검증 규칙:

- 모든 상태는 정의된 스키마를 사용한다.
- 모든 규칙의 대상이 실제로 존재한다.
- 모든 자원에는 생성 경로나 초기 배치가 존재한다.
- 모든 종은 최소 하나의 생존 자원을 필요로 한다.
- 모든 조직에는 유지 목적과 붕괴 조건이 존재한다.
- 모든 개인에게 활성화 가능한 목적이 존재한다.
- 모든 행동에는 비용 또는 위험이 존재한다.
- 강한 능력일수록 제약이나 대가가 증가한다.
- 사건 패턴은 둘 이상의 주체 또는 시스템을 연결한다.
- 순환 목적 그래프가 무한 행동을 만들지 않는다.

## 35. 자동 시뮬레이션 테스트

생성된 세계는 플레이어에게 공개하기 전에 자동으로 실행한다.

```typescript
interface SimulationTestResult {
  duration: number;
  totalActions: number;
  totalEvents: number;
  activeAgents: number;
  deadlockedAgents: string[];
  dominantActionRatios: Record<string, number>;
  resourceCollapse: string[];
  factionCollapse: string[];
  warnings: ValidationIssue[];
}
```

최소 테스트:

- 가상 시간 30일을 실행한다.
- 플레이어는 개입하지 않는다.
- 모든 주체가 최소 한 번 이상 목적에 따라 행동하는지 확인한다.
- 한 행동이 전체 행동의 70% 이상을 차지하는지 확인한다.
- 자원이 무한히 증가하거나 완전히 소멸하는지 확인한다.
- 모든 조직이 즉시 붕괴하지 않는지 확인한다.
- 사건이 한 종류만 반복되는지 확인한다.
- 세계가 변화하지 않는 정체 상태에 빠지는지 확인한다.

다양성 검증:

```typescript
const diversityScore =
  uniqueActionTypes * 0.2 +
  uniqueEventTypes * 0.3 +
  uniqueParticipantCombinations * 0.3 +
  changedStateCategories * 0.2;
```

깊이 검증:

```typescript
const depthScore =
  averageGoalsPerEvent * 0.25 +
  averageAffectedSystemsPerEvent * 0.25 +
  informationAsymmetryRate * 0.2 +
  consequenceDurationScore * 0.3;
```

## 36. 웹 프로토타입 구성

프로토타입은 다음 네 화면으로 구성한다.

### 36.1 세계 생성 화면

- 세계관 주제 입력
- 원하는 경험 입력
- 제외하고 싶은 요소 입력
- 세계 생성 버튼
- 생성 단계 진행 상태
- 생성된 세계 구조 검토

### 36.2 월드 지도 화면

- 2D 지역 지도
- 지역별 기후와 위험도
- 이동 중인 주체
- 자원 분포
- 현재 발생 중인 사건
- 시간 배속 조절

### 36.3 주체 관찰 화면

- 실제 상태
- 주체가 믿고 있는 상태
- 현재 활성 목적
- 목적 그래프
- 현재 행동
- 기억
- 관계
- 능력과 제약

개발자 모드에서는 실제 상태와 믿음 상태를 모두 보여준다. 플레이어 모드에서는 관찰 가능한 현상만 보여준다.

### 36.4 사건 화면

- 사건 참여자
- 각 참여자의 목적
- 알려진 정보
- 실제 원인
- 시간순 상태 변화
- 플레이어 개입 기록
- 발생한 결과
- 후속 사건 가능성

## 37. 웹 클라이언트 구조

```
src/
├─ app/
│  ├─ WorldSeedPage
│  ├─ WorldEditorPage
│  ├─ SimulationPage
│  └─ EventInspectorPage
│
├─ core/
│  ├─ world/
│  │  ├─ WorldDefinition
│  │  ├─ WorldState
│  │  └─ WorldRuntime
│  │
│  ├─ rules/
│  │  ├─ RuleEngine
│  │  ├─ ConditionEvaluator
│  │  └─ EffectExecutor
│  │
│  ├─ agents/
│  │  ├─ PerceptionSystem
│  │  ├─ BeliefSystem
│  │  ├─ GoalSystem
│  │  ├─ ActionPlanner
│  │  └─ MemorySystem
│  │
│  ├─ events/
│  │  ├─ ChangeCollector
│  │  ├─ EventDetector
│  │  └─ EventSummarizer
│  │
│  └─ simulation/
│     ├─ Scheduler
│     ├─ SimulationLoop
│     └─ SimulationWorker
│
├─ generation/
│  ├─ WorldSeedNormalizer
│  ├─ AxiomGenerator
│  ├─ SchemaGenerator
│  ├─ RuleGenerator
│  ├─ SpeciesGenerator
│  ├─ FactionGenerator
│  ├─ AgentGenerator
│  ├─ GoalGraphGenerator
│  └─ WorldValidator
│
├─ rendering/
│  ├─ WorldMapRenderer
│  ├─ EntityRenderer
│  ├─ SignalRenderer
│  └─ EventOverlay
│
└─ persistence/
   ├─ WorldRepository
   ├─ SnapshotRepository
   └─ EventLogRepository
```

## 38. 브라우저 실행 구조

시뮬레이션은 UI 스레드와 분리한다.

**메인 스레드**

- 화면 렌더링
- 사용자 입력
- 상태 조회
- 사건 표시

**Web Worker**

- 규칙 실행
- 주체 판단
- 행동 예약
- 세계 상태 변경
- 사건 탐지

메시지 예시:

```typescript
type WorkerRequest =
  | {
      type: "initialize_world";
      definition: WorldDefinition;
    }
  | {
      type: "advance_time";
      amount: number;
    }
  | {
      type: "execute_player_action";
      action: PlayerActionRequest;
    }
  | {
      type: "request_snapshot";
    };

type WorkerResponse =
  | {
      type: "world_initialized";
    }
  | {
      type: "state_patch";
      patch: WorldStatePatch;
    }
  | {
      type: "events_created";
      events: WorldEvent[];
    }
  | {
      type: "snapshot";
      state: WorldState;
    };
```

전체 월드 상태를 매 프레임 전달하지 않는다. 변경된 데이터만 patch로 전달한다.

## 39. 저장 구조

프로토타입은 다음 세 데이터를 분리한다.

- **WorldDefinition** — 변하지 않는 세계 구조
- **WorldSnapshot** — 특정 시점의 전체 세계 상태
- **EventLog** — 스냅샷 이후 발생한 상태 변경

복원:

```
가장 최근 WorldSnapshot 로드
→ 이후 EventLog를 순서대로 재실행
→ 현재 세계 상태 복원
```

이 구조는 다음 기능을 가능하게 한다.

- 과거 시점 재생
- 사건 원인 추적
- 시뮬레이션 디버깅
- 동일 입력 재현
- 다른 선택 결과 비교

모든 확률 선택에는 시드 기반 난수를 사용한다.

```typescript
interface RandomContext {
  worldSeed: number;
  simulationStep: number;
  entityId?: string;
}
```

같은 세계 시드와 같은 행동이 주어지면 같은 결과를 재현할 수 있어야 한다.

## 40. 초기 프로토타입의 규모

첫 구현부터 MMORPG 전체 규모를 목표로 하지 않는다.

초기 제한:

| 항목 | 규모 |
|---|---|
| 지역 | 3개 |
| 세부 장소 | 12개 |
| 종족 | 4개 |
| 조직 | 5개 |
| 주요 개인 | 20명 |
| 일반 개체 | 80~150개 |
| 자원 | 15종 |
| 행동 | 20종 |
| 세계 규칙 | 40~60개 |
| 사건 패턴 | 10개 |
| 능력 사용자 | 5명 |

이 정도 규모에서 먼저 다음을 검증한다.

- NPC가 고정 퀘스트 없이 행동하는가?
- 서로 다른 목적이 하나의 사건에서 충돌하는가?
- 플레이어가 개입하지 않아도 상황이 변화하는가?
- 인물이 실제 상태가 아니라 믿음에 따라 판단하는가?
- 능력의 조건과 정보가 전투 결과를 변화시키는가?
- 사건 결과가 다른 시스템에 장기적으로 남는가?

## 41. 프로토타입에 포함할 첫 번째 세계

초기 입력:

- 모든 생명은 자신이 중요하게 여기는 존재를 지속시키려 한다.
- 인간은 자신의 욕망에 명확한 제약을 걸어 초월적인 능력을 사용할 수 있다.
- 강한 제약은 강한 능력을 만들지만, 제약을 어기면 심각한 반동을 받는다.
- 문명 밖에는 능력의 흔적을 흡수해 적응하는 생물들이 존재한다.
- 위험한 지역에서만 능력을 성장시킬 희귀 자원을 얻을 수 있다.

자동 생성되어야 하는 결과:

- 3개의 생태적으로 다른 지역
- 능력 흔적을 흡수하는 생물 종
- 희귀 자원을 통제하는 국가 기관
- 생물을 연구하는 조직
- 자원을 밀수하는 조직
- 생태계를 보호하려는 집단
- 서로 다른 욕망과 능력을 가진 인간 20명
- 각 인물의 목적 그래프
- 조직 내부의 파벌과 갈등
- 최소 10개의 발생 가능한 사건 패턴

초기 사건은 수동으로 작성하지 않는다. 초기 상태만 배치한다.

- 마을 식량 비축량이 감소하고 있다.
- 교역로 근처에서 변이 생물의 흔적이 발견된다.
- 연구자는 생물의 행동이 공격이 아니라고 의심한다.
- 밀렵 조직은 생물의 장기를 원한다.
- 마을 지도자는 불법 자원 채굴을 숨기고 있다.
- 생물은 새끼를 안전한 지역으로 이동시키려 한다.

월드 시뮬레이션을 시작하면 각 주체가 자신의 목적에 따라 행동하면서 사건이 형성된다.

## 42. 구현 순서

**1단계: 수동 정의된 작은 세계**

생성 AI를 붙이기 전에 다음을 코드로 직접 작성한다.

- 상태 스키마
- 규칙 20개
- 행동 10개
- 종족 2개
- 조직 2개
- 개인 5명
- 목적 그래프
- 관찰과 믿음

목표는 세계 시뮬레이션이 실제로 작동하는지 검증하는 것이다.

**2단계: 규칙 DSL**

규칙을 JSON으로 작성하고 실행할 수 있게 만든다.

- 조건 평가기
- 대상 선택기
- 효과 실행기
- 관찰 신호 생성기

**3단계: 주체 판단 시스템**

- 생존 압력
- 목적 활성도
- 행동 후보
- 행동 선택
- 기억과 관계

**4단계: 사건 탐지 시스템**

상태 변화 기록을 관련 사건으로 묶는다.

**5단계: 세계 생성 컴파일러**

사용자의 짧은 세계관 주제를 구조화된 JSON으로 변환한다.

**6단계: 자동 검증과 수정**

모순과 누락을 검사하고 생성 결과를 다시 수정한다.

**7단계: 플레이어 개입**

사용자가 하나의 주체를 조작해 월드에 개입한다.

**8단계: 표현 고도화**

지도, 캐릭터 아이콘, 대화, 능력 효과, 사건 연출을 추가한다.

## 43. 첫 구현에서 만들지 않을 것

초기 프로토타입에서는 다음을 제외한다.

- 대규모 멀티플레이
- 완전한 3D 전투
- 복잡한 실시간 물리
- 수천 종의 아이템
- 대화 전체를 생성 AI로 처리하는 구조
- 모든 NPC의 초 단위 시뮬레이션
- 완성된 경제 시장
- 무한한 월드 생성

첫 번째 목표는 시각적 완성도가 아니다. 다음 명제를 실제 코드로 증명하는 것이 목표다.

> 몇 줄의 세계관 주제로부터 세계의 상태와 규칙을 생성하고, 그 규칙에 따라 서로 다른 목적을 가진 주체들이 행동하면, 개발자가 미리 작성하지 않은 사건과 성장 기회가 발생할 수 있다.

## 44. 프로토타입 완료 조건

프로토타입은 다음 조건을 모두 만족해야 한다.

1. 사용자가 3~5개의 세계관 문장을 입력할 수 있다.
2. 시스템이 상태, 규칙, 종족, 조직, 개인, 목적 그래프를 생성한다.
3. 생성 결과가 구조화된 데이터로 저장된다.
4. 브라우저에서 시간을 진행할 수 있다.
5. 플레이어가 없어도 주체들이 이동하고 행동한다.
6. 주체는 실제 상태가 아니라 자신의 믿음을 근거로 판단한다.
7. 최소 세 주체의 목적이 하나의 사건에서 충돌한다.
8. 같은 사건에 전투, 협상, 정보, 거래 등 여러 개입 방식이 존재한다.
9. 사건 결과가 세계의 생태, 경제, 관계 또는 정보 상태를 변화시킨다.
10. 사건이 끝난 뒤 새로운 목적이나 후속 사건이 생성된다.
11. 캐릭터의 능력이 개인의 욕망과 제약에서 파생된다.
12. 동일한 세계 시드와 입력으로 결과를 재현할 수 있다.
13. 개발자가 사건을 직접 작성하지 않아도 의미 있는 상황이 발생한다.

## 45. 최종 구조

전체 시스템은 다음과 같이 정리된다.

```
[사용자 입력]
세계관 주제 몇 문장
        ↓
[세계관 해석]
핵심 명제와 생존 압력 추출
        ↓
[세계 구조 생성]
공간, 상태, 자원, 종족, 조직 생성
        ↓
[행위 구조 생성]
목적 그래프, 능력, 행동, 관계 생성
        ↓
[규칙 컴파일]
자연어 설정을 실행 가능한 규칙 DSL로 변환
        ↓
[자동 검증]
모순, 누락, 정체, 과도한 반복 검사
        ↓
[월드 초기화]
지역과 주체의 초기 상태 배치
        ↓
[시뮬레이션]
인식 → 믿음 → 목적 → 행동 → 결과
        ↓
[사건 해석]
연관된 상태 변화를 하나의 상황으로 묶음
        ↓
[플레이어 개입]
관찰, 전투, 협상, 거래, 제작, 정보 활동
        ↓
[세계 변화]
생태, 경제, 관계, 조직, 능력 상태 변화
        ↓
[새로운 목적과 사건]
변화된 세계를 기반으로 다음 콘텐츠 발생
```

이 구조에서 생성해야 하는 최종 대상은 퀘스트나 스토리 목록이 아니다. 생성 대상은 다음 다섯 가지다.

1. **무엇이 존재하는가**: 상태
2. **무엇이 변할 수 있는가**: 규칙
3. **누가 변화를 원하는가**: 주체와 목적
4. **주체는 무엇을 알고 있는가**: 인식과 믿음
5. **변화가 어떻게 드러나는가**: 현상과 사건

이 다섯 요소가 실행 가능한 데이터와 코드로 연결되면, 짧은 세계관 주제만으로도 스스로 굴러가는 MMORPG 세계의 초기 형태를 만들 수 있다.
