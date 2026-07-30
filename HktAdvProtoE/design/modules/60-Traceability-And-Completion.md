# 60. 설계 추적표 · 완성 판정 · 구현 시작 순서

> 상위: [Design-Modules.md](../Design-Modules.md)

---

## 1. 원래 설계와 모듈 추적표

| 원래 설계 내용 | 담당 모듈 |
|---|---|
| 세계관 공리 | A0, A1, A2, W2 |
| 모든 주체가 자기 삶의 주인공 | U0, G1, C0~C3 |
| 종별 가능성 트리 | G1, G2 |
| 경험·가치·특성에 따른 발동 | U3, G2, G3 |
| 상대에 따른 상호작용 변화 | U3, I1 |
| 요청·거래·협박·동맹·배신 | I1, I2 |
| 콘텐츠가 주체 행동 충돌로 생성 | I0, I3 |
| 세계 규칙 | K2, S1~S3, R3 |
| 세계 상태 | S0~S3 |
| 정보 비대칭 | U1, U2, S3 |
| 기억과 관계 | U3 |
| 성장 | R0, R1 |
| 의념 능력 | R2~R4 |
| 거대 마물 | C0, C1 |
| 조직·국가 | C2 |
| 신과 지역 규칙 | C3 |
| 주체가 세계 요구 생성 | W0 |
| 여러 그래프의 교집합 | W1 |
| 세계 실체화 | W2 |
| 잠재 세계와 관찰된 세계 | W3 |
| 3D 공간 | X0, X1 |
| 웹 플레이 | X2, X3 |
| MMORPG 서버 | N0, N1 |
| 원격 세계 진행 | N2 |
| 영속 세계 | N3 |
| AI 콘텐츠 제작 | A1~A4 |
| 생성 근거와 디버깅 | A5 |

**양방향 판정 규칙**

```text
어떤 설계 항목도 담당 모듈이 없다면 전체 설계 검증이 실패한다.
반대로 어떤 모듈도 상위 설계 항목에 연결되지 않는다면 불필요한 구현으로 판단한다.
```

A5 의 Coverage Dashboard 가 이 표를 자동 감사한다.

---

## 2. 전체 완성 판정

프로젝트가 완성되었다고 판단하려면 단순히 52개 모듈이 각각 통과하는 것만으로는 부족하다.
다음 네 단계가 모두 통과되어야 한다.

```text
1. 모듈 완전성
   모든 모듈이 VERIFIED 상태다.
2. 설계 추적 완전성
   모든 설계 요구가 하나 이상의 모듈과 시나리오에 연결된다.
3. 인과 완전성
   모든 주요 세계 상태 변화의 원인을 사건 로그에서 추적할 수 있다.
4. 플레이 완전성
   플레이어가 없어도 세계가 진행되고,
   플레이어가 개입하면 실제 결과가 달라지며,
   그 결과가 기억·관계·성장·공간에 남는다.
```

최종 자동 판정은 다음과 같이 구성한다.

```ts
interface ProjectCompletionReport {
  allModulesVerified: boolean;
  allDesignRequirementsCovered: boolean;
  allVerticalSlicesPassed: boolean;
  globalInvariantViolations: number;
  unexplainedStateChanges: number;
  orphanWorldEntities: number;
  unreachableGoals: number;
  abilitiesWithoutCounterplay: number;
  replayMismatches: number;
  regressionFailures: number;
}
```

완료 조건은 다음과 같다.

```text
allModulesVerified = true
allDesignRequirementsCovered = true
allVerticalSlicesPassed = true
globalInvariantViolations = 0
unexplainedStateChanges = 0
orphanWorldEntities = 0
unreachableGoals = 0 또는 명시적으로 blocked 처리
abilitiesWithoutCounterplay = 0
replayMismatches = 0
regressionFailures = 0
```

### 지표 ↔ 불변조건 대응

| 지표 | 관련 불변조건 | 집계 모듈 |
|---|---|---|
| `unexplainedStateChanges` | GI-01 | K3 Invariant Audit |
| `orphanWorldEntities` | GI-04 | W3 Provenance |
| `unreachableGoals` | GI-03 | G3, A2 Reachability |
| `abilitiesWithoutCounterplay` | GI-06, GI-07 | R4, A2 |
| `replayMismatches` | GI-12 | V2, K3 |
| `regressionFailures` | 게이트 G7 | V4 |

---

## 3. 실제 구현 시작 순서

첫 구현에서는 3D 지형이나 AI 생성부터 시작하지 않는다. 다음 순서를 고정한다.

| # | 대상 | 문서 |
|---|---|---|
| 1 | V0~V4 검증 기반 | [10](10-Phase-V-Verification.md) |
| 2 | K0~K3 결정적 사건 세계 | [11](11-Phase-K-Kernel.md) |
| 3 | **VS0** 상태 변화와 리플레이 검증 | [30](30-Vertical-Slices.md#vs0-결정적-세계-변화) |
| 4 | S0, S1, U0, U1, G0~G3 단일 주체 생존 | [12](12-Phase-S-World-State.md) · [13](13-Phase-U-Subject.md) · [14](14-Phase-G-Possibility.md) |
| 5 | **VS1, VS2** 서로 다르게 해석하는 캐릭터 | [30](30-Vertical-Slices.md#vs1-한-주체의-생존-행동) |
| 6 | S2, S3, I0~I3 요청·거래·충돌·사건 연쇄 | [12](12-Phase-S-World-State.md) · [15](15-Phase-I-Interaction.md) |
| 7 | **VS3, VS4** 퀘스트 없는 콘텐츠 | [30](30-Vertical-Slices.md#vs3-퀘스트-없는-요청) |
| 8 | R0~R4 경험 기반 성장과 능력 | [16](16-Phase-R-Progression.md) |
| 9 | C0~C3 마물·조직·국가·신 | [17](17-Phase-C-Complex-Subjects.md) |
| 10 | W0~W3 주체로부터 세계 생성 | [18](18-Phase-W-World-Compiler.md) |
| 11 | X0~X3 3D 웹 세계 | [19](19-Phase-X-Spatial-Client.md) |
| 12 | N0~N3 MMORPG 권위 서버와 영속화 | [20](20-Phase-N-Runtime.md) |
| 13 | A0~A5 AI 생성 및 반복 검증 | [21](21-Phase-A-Authoring.md) |

---

## 4. 첫 번째 구현 목표

> **브라우저 Lab에서 주체 하나가 현상을 감지하고, 자기 믿음과 목적에 따라 행동을 선택하며, 그 행동이 세계 규칙에 의해 사건으로 처리되고, 동일한 사건을 완전히 재생할 수 있게 한다.**

이 수직 경로가 검증되기 전에는 거대 마물, 국가, 신, 3D 지형 생성으로 확장하지 않는다.
이후의 모든 복잡한 콘텐츠는 이 검증된 인과 경로를 확장하는 방식으로만 추가한다.

경로에 필요한 최소 모듈 집합:

```text
V0 V1 V2 V3 V4    검증 기반
K0 K1 K2 K3       상태·질의·규칙·사건
S0 S1             공간·자연 상태
U0 U1 U2          주체·지각·믿음
G0 G1 G2 G3       행동 원자·문법·활성화·목적
```

이 15개 모듈이 `VERIFIED` 이고 VS0·VS1 이 통과하면 1차 목표 달성이다.
