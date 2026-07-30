# 17. Phase C — 복합 주체

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행: [16-Phase-R-Progression.md](16-Phase-R-Progression.md) · 후속: [18-Phase-W-World-Compiler.md](18-Phase-W-World-Compiler.md)

인간·마물·조직·신은 모두 강력하지만 **힘을 얻는 원리가 서로 다르다.**
GI-08(조직의 추상 행동 금지)의 강제 지점이다.

---

## 모듈 목록

| ID | 목적 | 대표 검증 | 선행 |
|---|---|---|---|
| C0 | 생물 종이 개체 생성기 이상의 생존 문법을 가지게 한다 | 먹이 부족과 번식 주기가 개체군 변화로 이어짐 | S1, U0, G1 |
| C1 | 거대 마물을 이동하는 생태 규칙 주체로 구현한다 | 경로 차단 시 마을 방향으로 우회하고 경제·생태가 변함 | C0, R2, I3 |
| C2 | 조직이 구성원·자산·통치 구조를 통해 행동하게 한다 | 국가가 명령해도 지휘관 배신·보급 단절 시 실행되지 않음 | U, G, I, S2 |
| C3 | 신을 지역 규칙과 유지 조건을 가진 주체로 표현한다 | 국경석 이동으로 신의 영역과 공간 교란 규칙이 실제로 변함 | S3, U0, G, I3 |

---

## C0 — species-ecology

패키지: `packages/complex-subjects/C0-species-ecology`

| 항목 | 내용 |
|---|---|
| 목적 | 생물 종이 개체 생성기 이상의 생존 문법을 가지게 한다 |
| 포함 | Lifecycle, Feeding, Reproduction, Population, Habitat |
| 대표 검증 | 먹이 부족과 번식 주기가 개체군 변화로 이어짐 |
| 선행 | S1, U0, G1 |

**거대 마물 검증 체크리스트** (C0/C1 공통 품질 게이트):

```text
먹이와 서식지가 있는가?
이동과 번식 주기가 있는가?
공격 외의 상호작용이 가능한가?
행동의 사전 징후가 있는가?
기관과 능력의 생태적 근거가 있는가?
죽었을 때 생태적 결과가 있는가?
```

---

## C1 — giant-beast

패키지: `packages/complex-subjects/C1-giant-beast`

| 항목 | 내용 |
|---|---|
| 목적 | 거대 마물을 체력 높은 몬스터가 아니라 이동하는 생태 규칙 주체로 구현한다 |
| 포함 | 기관, 섭식 적응, 번식지, 이동 경로, 영역, 사체 영향 |
| 대표 검증 | 이동 경로 차단 시 마물이 마을 방향으로 우회하고 경제·생태 상황이 변함 |
| 선행 | C0, R2, I3 |

거대 마물은 능력을 학습한 인간이 아니라 **생태 규칙이 신체화된 주체**다. 먹은 지역의 특징을 기관으로 저장한다.

```text
화산 지대 섭취        → 열을 저장하는 갑각 생성
독성 늪 섭취          → 독성 증기를 정화·방출하는 기관 생성
의념이 강한 인간 섭취 → 인간의 공포 반응을 모방하는 감각 기관 생성
```

사냥은 체력 수치를 깎는 문제가 아니다. 다음 경로가 모두 유효해야 한다.

```text
서식 주기 파악 · 기관 역할 파악 · 이동 경로 변경 · 먹이 공급 차단
다른 생물과의 관계 이용 · 의념 잔향 교란 · 번식기 회피 · 기관 간 상호작용 붕괴
```

하나의 기관이 여러 가능성 그래프를 동시에 연결해야 한다 (치료 재료 / 국가 무기 연구 / 종교 성물 / 다른 마물의 먹이 / 새끼를 부르는 냄새 / 의념 증폭 매개 / 암시장 상품).

---

## C2 — organization-nation

패키지: `packages/complex-subjects/C2-organization-nation`

| 항목 | 내용 |
|---|---|
| 목적 | 조직이 구성원·자산·통치 구조를 통해 행동하게 한다 |
| 포함 | Governance, Faction, Cohesion, Orders, Assets, Territory, Law |
| 대표 검증 | 국가가 명령해도 지휘관이 배신하거나 보급이 끊기면 실행되지 않음 |
| 선행 | U, G, I, S2 |

조직은 추상적 의지만으로 행동할 수 없다 (GI-08).

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

**조직 검증 체크리스트**:

```text
존속에 필요한 자원이 있는가?
공개 이념과 실제 생존 방식이 다른가?
내부 파벌이 있는가?
외부 의존 대상이 있는가?
명령을 실행할 구성원이 있는가?
분열·부패·배신 가능성이 있는가?
```

---

## C3 — rule-bearing-god

패키지: `packages/complex-subjects/C3-rule-bearing-god`

| 항목 | 내용 |
|---|---|
| 목적 | 신을 지역 규칙과 유지 조건을 가진 주체로 표현한다 |
| 포함 | Anchor, Sustenance, Domain Rule, Worship, Taboo, Collapse |
| 대표 검증 | 국경석 이동으로 신의 영역과 공간 교란 규칙이 실제로 변함 |
| 선행 | S3, U0, G, I3 |

신은 강력한 NPC 가 아니라 지역 규칙을 몸으로 가진 `RuleBearingSubject` 다.

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

예: 국경의 신은 국경석 존재 · 양국의 경계 인정 · 주민의 정기 확인 · 경계 의례로 유지된다.
국가가 몰래 국경석을 옮기면 신은 약해지거나 뒤틀린다. 신을 죽이면 담당했던 지역 규칙이 사라지며 새로운 재난이나 기회가 생긴다.

---

## 캐릭터 품질 게이트 (C 페이즈 공통)

주요 캐릭터는 최소한 다음 구조를 가져야 하며, **자기모순이 두 개 미만이면 주요 인물로 채택하지 않는다**.

```text
공개적인 역할 · 개인적인 욕망 · 가장 두려운 상실 · 절대 포기하지 않을 가치
생존을 위해 의존하는 타인 · 해결되지 않은 과거 사건 · 현재 가진 잘못된 믿음
한 명 이상의 관계적 예외 · 능력이 요구하는 실제 대가 · 성장하며 충돌할 자기모순
```

캐릭터 검증 체크리스트:

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

---

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS6](30-Vertical-Slices.md#vs6-거대-마물이-만드는-지역-사건) | C0, C1 |
| [VS7](30-Vertical-Slices.md#vs7-국가와-신의-충돌) | C2, C3 |
