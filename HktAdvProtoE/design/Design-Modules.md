# 주체-기원 MMORPG 구현을 위한 완전 검증형 모듈 분할 설계

> 이 문서는 **총론 + 문서 라우터**다. 세부는 [modules/](modules/) 하위 문서를 참조한다.
> 세계 설계 원본은 [Design-MMO.md](Design-MMO.md).

---

## 1. 모듈화의 목표

이 프로젝트의 모듈 분할은 단순히 코드를 여러 폴더로 나누는 작업이 아니다.

각 모듈은 다음 질문에 독립적으로 답할 수 있어야 한다.

> **이 모듈은 세계에 어떤 기능을 추가하며, 그 기능이 정확히 작동한다는 사실을 사람이 즉시 확인할 수 있는가?**

따라서 모든 모듈은 다음 구조를 가져야 한다.

```text
명확한 하나의 목적
    ↓
명시적인 입력
    ↓
결정적인 처리
    ↓
관찰 가능한 출력
    ↓
자동 검증
    ↓
브라우저에서 확인 가능한 데모
    ↓
다른 모듈과 결합한 통합 검증
```

테스트 코드만 통과했다고 모듈이 완성된 것이 아니다.

반드시 다음 두 종류의 검증을 모두 통과해야 한다.

```text
1. 모듈 검증
   해당 기능 자체가 정확한가?
2. 수직 통합 검증
   다른 모듈과 결합했을 때 실제 MMORPG 콘텐츠를 만드는가?
```

---

## 2. 모듈 분할 원칙

### 2.1 하나의 모듈은 하나의 인과적 책임만 가진다

좋은 모듈:

```text
NPC가 어떤 현상을 감지할 수 있는지 계산한다.
주체의 목적 후보를 평가한다.
행동 의도를 세계 규칙으로 해결한다.
여러 세계 요구를 하나의 공간 요소로 결합한다.
```

잘못된 모듈:

```text
NPC AI를 처리한다.
게임 세계를 생성한다.
콘텐츠를 만든다.
전투와 성장을 처리한다.
```

목적을 한 문장으로 설명할 수 없으면 더 분할한다.

---

### 2.2 모듈이 직접 변경할 수 있는 상태는 하나의 소유 영역으로 제한한다

예를 들어 `BeliefModule`은 주체가 믿는 상태만 변경할 수 있다.
실제 세계 상태를 직접 바꿔서는 안 된다.

```text
PerceptionModule
  현상을 감지한다.
BeliefModule
  감지된 현상으로 믿음을 변경한다.
DecisionModule
  믿음을 바탕으로 행동 의도를 만든다.
RuleModule
  행동 의도를 실제 세계 변화로 변환한다.
```

이 경계를 넘는 직접 접근은 금지한다.

---

### 2.3 모든 변경은 사건을 통해 이루어진다

다음과 같은 코드는 허용하지 않는다.

```ts
npc.health -= 10;
npc.relation[playerId].trust -= 20;
item.ownerId = playerId;
```

반드시 다음 구조를 거쳐야 한다.

```text
Intent
  공격한다
Rule
  공격 가능 조건과 비용을 검사한다
StateDelta
  체력 -10
WorldEvent
  공격 사건 기록
Phenomenon
  타격음, 상처, 목격 정보 생성
Memory / Relation
  사건을 감지한 주체들의 기억과 관계 변화
```

---

### 2.4 모든 모듈은 대표 검증 장면을 하나 이상 가진다

예를 들어 지각 모듈은 다음 장면을 제공한다.

```text
NPC A와 NPC B가 벽 양쪽에 있다.
종이 울린다.
기대 결과:
A는 소리를 듣는다.
B는 시각적으로 종을 보지 못한다.
시각 주장과 청각 주장이 구분된다.
```

브라우저의 `/lab/U1-perception` 페이지에서 한 번에 확인할 수 있어야 한다.

---

### 2.5 이미 검증된 모듈의 계약을 변경하면 하위 모듈의 검증을 무효화한다

```text
K2 Rule Engine 변경
    ↓
K3 Event Replay 검증 무효
    ↓
I3 Conflict Resolver 검증 무효
    ↓
R3 Ability Runtime 검증 무효
    ↓
N0 Authoritative Server 검증 무효
```

단순히 테스트를 다시 실행하는 것이 아니라, 의존 모듈의 `VERIFIED` 상태를 자동으로 해제한다.

---

## 3. 전체 의존 구조

```text
[V 검증 기반]
      ↓
[K 세계 커널]
      ↓
[S 공간·상태]
      ↓
[U 주체 인지]
      ↓
[G 가능성·목적]
      ↓
[I 상호작용·사건]
      ↓
[R 성장·능력]
      ↓
[C 종·마물·조직·신]
      ↓
[W 세계 컴파일러]
      ↓
[X 3D 공간·클라이언트]
      ↓
[N 서버·동기화·영속화]
      ↓
[A AI 생성·감사 도구]
```

실제로는 일부 병렬화할 수 있지만, 검증 완료 순서는 이 흐름을 따른다.

---

## 4. 문서 인덱스

### 4.1 공통 규약 (모든 페이즈에 적용)

| 문서 | 역할 |
|---|---|
| [00-Module-Contract.md](modules/00-Module-Contract.md) | 모듈 표준 계약, 검증 상태 머신, 완료 게이트 G0~G8, 증거 형식, Lab 공통 화면 |
| [01-Global-Invariants.md](modules/01-Global-Invariants.md) | 전역 불변조건 GI-01 ~ GI-12 |

### 4.2 페이즈별 모듈 (구현 단위)

| 문서 | 페이즈 | 모듈 | 한 줄 목적 |
|---|---|---|---|
| [10-Phase-V-Verification.md](modules/10-Phase-V-Verification.md) | V 검증 기반 | V0~V4 | 완료 여부를 사람이 판정할 수 있는 검증 인프라 |
| [11-Phase-K-Kernel.md](modules/11-Phase-K-Kernel.md) | K 세계 커널 | K0~K3 | 결정적 사건 세계 (상태·질의·규칙·재생) |
| [12-Phase-S-World-State.md](modules/12-Phase-S-World-State.md) | S 공간·상태 | S0~S3 | 공간·자연·사회·정보 상태 계층 |
| [13-Phase-U-Subject.md](modules/13-Phase-U-Subject.md) | U 주체 인지 | U0~U3 | 지각·믿음·기억으로 세계를 다르게 보는 주체 |
| [14-Phase-G-Possibility.md](modules/14-Phase-G-Possibility.md) | G 가능성·목적 | G0~G3 | 행동 원자 → 가능성 문법 → 목적·계획 |
| [15-Phase-I-Interaction.md](modules/15-Phase-I-Interaction.md) | I 상호작용·사건 | I0~I3 | 압력·사회 전략·약속·충돌 연쇄 (퀘스트 없는 콘텐츠) |
| [16-Phase-R-Progression.md](modules/16-Phase-R-Progression.md) | R 성장·능력 | R0~R4 | 가능성 그래프 변화로서의 성장, 의념 능력 |
| [17-Phase-C-Complex-Subjects.md](modules/17-Phase-C-Complex-Subjects.md) | C 복합 주체 | C0~C3 | 종·거대 마물·조직/국가·신 |
| [18-Phase-W-World-Compiler.md](modules/18-Phase-W-World-Compiler.md) | W 세계 컴파일러 | W0~W3 | 주체 요구 → 결합 → 실체화 → 정식화 |
| [19-Phase-X-Spatial-Client.md](modules/19-Phase-X-Spatial-Client.md) | X 3D·클라이언트 | X0~X3 | 지역 위상 → 3D 지형 → 웹 클라이언트 → 세계 UI |
| [20-Phase-N-Runtime.md](modules/20-Phase-N-Runtime.md) | N 서버·영속화 | N0~N3 | 권위 서버, 관심 영역, LOD, 저장·복구 |
| [21-Phase-A-Authoring.md](modules/21-Phase-A-Authoring.md) | A 제작·감사 | A0~A5 | 콘텐츠 편집, AI 후보 생성·검증·수정, 인과 감사 |

### 4.3 통합·운영

| 문서 | 역할 |
|---|---|
| [30-Vertical-Slices.md](modules/30-Vertical-Slices.md) | 수직 통합 검증 시나리오 VS0 ~ VS11 |
| [40-Agent-Protocol.md](modules/40-Agent-Protocol.md) | AI 에이전트 반복 작업 프로토콜과 작업 제한 |
| [50-Project-Layout.md](modules/50-Project-Layout.md) | 전체 디렉터리 구조와 모듈 ID ↔ 패키지 매핑 |
| [60-Traceability-And-Completion.md](modules/60-Traceability-And-Completion.md) | 원설계 추적표, 전체 완성 판정, 실제 구현 시작 순서 |

---

## 5. 실제 구현 시작 순서 (요약)

첫 구현에서는 3D 지형이나 AI 생성부터 시작하지 않는다. 상세는 [60-Traceability-And-Completion.md](modules/60-Traceability-And-Completion.md) 8절.

```text
1. V0~V4                  검증 기반
2. K0~K3                  결정적 사건 세계
3. VS0                    상태 변화와 리플레이 검증
4. S0, S1, U0, U1, G0~G3  단일 주체 생존
5. VS1, VS2               서로 다르게 해석하는 캐릭터
6. S2, S3, I0~I3          요청·거래·충돌·사건 연쇄
7. VS3, VS4               퀘스트 없는 콘텐츠
8. R0~R4                  경험 기반 성장과 능력
9. C0~C3                  마물·조직·국가·신
10. W0~W3                 주체로부터 세계 생성
11. X0~X3                 3D 웹 세계
12. N0~N3                 MMORPG 권위 서버와 영속화
13. A0~A5                 AI 생성 및 반복 검증
```

첫 번째 구현 목표는 다음 하나다.

> **브라우저 Lab에서 주체 하나가 현상을 감지하고, 자기 믿음과 목적에 따라 행동을 선택하며, 그 행동이 세계 규칙에 의해 사건으로 처리되고, 동일한 사건을 완전히 재생할 수 있게 한다.**

이 수직 경로가 검증되기 전에는 거대 마물, 국가, 신, 3D 지형 생성으로 확장하지 않는다. 이후의 모든 복잡한 콘텐츠는 이 검증된 인과 경로를 확장하는 방식으로만 추가한다.
