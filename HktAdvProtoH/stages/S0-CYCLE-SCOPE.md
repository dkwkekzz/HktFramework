# Stage 0 — Cycle Scope

현재 World Baseline 위에 **다음에 추가할 하나의 작은 World Capability** 를 고르고
Cycle Contract 로 범위를 고정한다.

## 입력

```text
context/TARGET-HORIZON.md
context/WORLD-BASELINE.md          (현재 검증된 세계 전체)
context/EVOLUTION-BACKLOG.md
직전 Cycle 의 05 / 06 Artifact      (있으면)
design/Design-Concept.md            (Goal / Possibility 원본 — fallback)
```

## 출력

```text
cycles/<cycle-id>/00-CYCLE-CONTRACT.md
context/CURRENT-CYCLE.md            (새 Cycle 로 교체)
```

템플릿: [../templates/CYCLE-CONTRACT.md](../templates/CYCLE-CONTRACT.md)

## 절차

### 1. 현재 Baseline 확인

무엇이 이미 검증되어 있는가. 재사용할 수 있는 Semantic 이 무엇인가.

### 2. Capability 후보 선정

Capability 는 **하나의 세계 능력**이다. 시스템 이름이 아니다.

```text
좋은 후보                     나쁜 후보
Resource Extraction           Mining System
Item Fabrication              Crafting 전체
Threat Removal                Combat System
```

**Semantic Overlap 원칙**(§18): 새 Cycle 은 가능한 한 기존 Semantic 을 실제로
재사용하고 연결해야 한다. 재사용할 것이 하나도 없는 후보는 Feature Island 가 될 위험이 있다.
(첫 Cycle 은 예외 — 재사용할 Baseline 이 없다.)

### 3. Contract 작성

템플릿의 8개 항목을 모두 채운다. 특히:

- **New Semantics** 는 범위 선언이지 최종 정의가 아니다. 정확한 정의는 Stage 2 의 몫이다.
- **Observable Proof** 는 "인간이 무엇을 보면 이 Cycle 이 끝났다고 인정하는가" 를
  구체적인 화면/출력 형태로 쓴다. 추상적 서술은 Gate 로 쓸 수 없다.
- **Explicitly Deferred** 를 반드시 채운다. 여기 없는 것은 나중에 "빠뜨린 것" 과
  구분되지 않는다.
- **Evolution Questions** 는 Stage 6 가 그대로 답할 수 있는 형태로 쓴다.

### 4. Backlog 반영

이번 Cycle 에서 미루기로 한 것 중 장기적으로 필요한 것은
`context/EVOLUTION-BACKLOG.md` 에 추가한다.

## 금지

```text
Cycle Contract 를 쓰면서 Intent 를 함께 쓰는 것
구현 방식(클래스·자료구조·파일 구조) 결정
Backlog 항목을 위해 placeholder State 를 Contract 에 넣는 것
여러 Capability 를 한 Cycle 에 묶는 것
```

## 종료

Contract 를 `DRAFT` 로 두고 **인간 확정을 기다린다.** 확정 전에는 Stage 1 을 시작하지 않는다.
`context/CURRENT-CYCLE.md` 갱신 후 STOP.
