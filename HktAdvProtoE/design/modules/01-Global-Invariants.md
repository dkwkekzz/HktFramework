# 01. 전역 불변조건

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「6. 전역 불변조건」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 6. 전역 불변조건

이 조건들은 특정 모듈이 아니라 전체 프로젝트에 항상 적용한다.

## GI-01. 사건 없는 상태 변경 금지

모든 세계 상태 변경에는 원인이 되는 `WorldEvent`가 존재해야 한다.

## GI-02. 주체의 전지적 판단 금지

주체는 서버의 실제 세계 상태가 아니라 자신의 `BeliefState`를 통해서만 판단한다.

## GI-03. 목적 없는 행동 금지

의도적 행동은 활성 목적이나 즉각적 반사 행동 중 하나에 연결되어야 한다.

## GI-04. 세계 실체의 생성 근거 보존

정식화된 지역·자원·생물·제도·규칙에는 하나 이상의 `WorldRequirement`가 연결되어야 한다.

## GI-05. 관찰된 세계의 소급 변경 금지

이미 관찰된 사실은 사건 없이 다시 생성하거나 삭제할 수 없다.

## GI-06. 강력한 능력의 무비용 사용 금지

강력한 효과에는 비용·조건·노출·위험 중 하나 이상이 있어야 한다.

## GI-07. 대응 불가능한 고영향 능력 금지

다른 주체에게 큰 영향을 주는 능력은 관찰 가능한 징후와 대응 경로가 있어야 한다.

## GI-08. 조직의 추상 행동 금지

국가나 조직의 행동은 실제 구성원·자원·명령 전달을 거쳐야 한다.

## GI-09. 플레이어 특권 금지

플레이어도 일반 주체와 동일한 규칙·비용·지각 제한을 받는다.

## GI-10. 플레이어 부재 시 세계 정지 금지

플레이어가 개입하지 않아도 주체의 목적과 사건은 진행되어야 한다.

## GI-11. 고유 자원의 중복 소유 금지

한 실체의 소유권은 동일 시점에 하나의 확정 소유 상태만 가질 수 있다.

## GI-12. 리플레이 불일치 금지

같은 초기 상태·입력·시드라면 같은 사건 순서와 최종 상태가 나와야 한다.

---

## 파생 메모 (원문에 없음 — 작업 편의용)

원문은 불변조건을 특정 모듈에 배정하지 않는다(“특정 모듈이 아니라 전체 프로젝트에 항상 적용”).
아래 표는 각 조건이 **어느 페이즈 문서를 읽을 때 함께 확인되어야 하는지**를 찾기 위한 색인일 뿐이며, 조건의 적용 범위를 그 모듈로 좁히지 않는다.

| 조건 | 관련 페이즈 문서 |
|---|---|
| GI-01 | [11 K](11-Phase-K-Kernel.md) K2 · K3 |
| GI-02 | [13 U](13-Phase-U-Subject.md) U1 · U2 |
| GI-03 | [14 G](14-Phase-G-Possibility.md) G3 · [15 I](15-Phase-I-Interaction.md) I1 |
| GI-04 | [18 W](18-Phase-W-World-Compiler.md) W0 · W3 |
| GI-05 | [18 W](18-Phase-W-World-Compiler.md) W3 |
| GI-06 | [16 R](16-Phase-R-Progression.md) R2 · R3 · [21 A](21-Phase-A-Authoring.md) A2 |
| GI-07 | [16 R](16-Phase-R-Progression.md) R4 · [21 A](21-Phase-A-Authoring.md) A2 |
| GI-08 | [17 C](17-Phase-C-Complex-Subjects.md) C2 |
| GI-09 | [20 N](20-Phase-N-Runtime.md) N0 |
| GI-10 | [15 I](15-Phase-I-Interaction.md) I0 · [20 N](20-Phase-N-Runtime.md) N2 |
| GI-11 | [11 K](11-Phase-K-Kernel.md) K2 · [20 N](20-Phase-N-Runtime.md) N0 |
| GI-12 | [10 V](10-Phase-V-Verification.md) V2 · [11 K](11-Phase-K-Kernel.md) K3 |

원문 「27. 전체 완성 판정」은 `globalInvariantViolations = 0` 을 완료 조건으로 둔다 → [60-Traceability-And-Completion.md](60-Traceability-And-Completion.md)
