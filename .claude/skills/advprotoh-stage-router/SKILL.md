---
name: advprotoh-stage-router
description: HktAdvProtoH 의 Observable World Progressive Cycle Workflow 에서 요청의 Stage 하나를 식별해 그 Stage 만 수행한다 — Stage 식별 → Stage Guide 선택 → 입력 Artifact 확인 → 허용 Reference 만 로드 → 그 Stage 수행 → Artifact 생성 → STOP. 다음 Stage 를 자동 실행하지 않는다. 사용자가 "AdvProtoH 작업 / Cycle 범위 / Intent 추출 / World Model 정의 / 구현 / 검증 / Evolution 검사 / Baseline 병합" 을 요청하면 사용.
---

# HktAdvProtoH Stage Router

**작업 디렉토리: `HktAdvProtoH/`** — 이하 상대 경로는 이 폴더 기준.

Stage 식별표 · 공통 불변 규칙 12개 · 기본 Context 목록 · Artifact Chain 은
[HktAdvProtoH/CLAUDE.md](../../../HktAdvProtoH/CLAUDE.md) 에 있다 (단일 원본).
이 문서는 **실행 절차와 진입 게이트**만 담는다.

## 절대 규칙

```text
ONE INVOCATION = ONE STAGE
```

이 skill 은 Workflow 를 실행하는 Orchestrator 가 **아니다.** Router 다.
Stage 하나를 수행하고 STOP 한다.

## 절차

### 1. Stage 식별

[context/CURRENT-CYCLE.md](../../../HktAdvProtoH/context/CURRENT-CYCLE.md) 로 현재 위치를 확인하고,
CLAUDE.md 의 Stage 식별표로 요청을 매핑한다.
모호하면 **추측하지 않고 인간에게 묻는다.**

### 2. Stage Guide 로드

식별한 `stages/S<N>-*.md` **하나만** 읽는다. 다른 Stage 의 Guide 는 읽지 않는다.

### 3. 진입 게이트 확인

Guide 의 `입력` 절에 적힌 Artifact 가 `cycles/<cycle-id>/` 에 존재하는지 확인한다.

| 조건 | 조치 |
|---|---|
| 입력 Artifact 가 없거나 미완성 | Stage 를 시작하지 않고 무엇이 없는지 보고 후 STOP |
| `00` 이 DRAFT | Stage 1 을 시작하지 않는다 |
| `03` 이 APPROVED 아님 | Stage 4 를 시작하지 않는다 (RULE 4) |
| `05` / `06` 이 PASS 아님 | Stage 7 을 시작하지 않는다 (RULE 11) |

### 4. 허용 Reference 만 로드

CLAUDE.md 의 "기본 Context" 목록 + 현재 Stage 의 입력 Artifact 만 연다.
`design/` 원본은 fallback 이다 (RULE 12) — 기존 Artifact 와 Baseline 만으로
판단할 수 없을 때만 연다.

### 5. Stage 수행

Guide 의 절차·금지·자기점검을 그대로 따른다.
산출물은 `templates/` 의 해당 서식으로 `cycles/<cycle-id>/` 에 쓴다.

### 6. 종료

```text
1. 출력 Artifact 작성
2. context/CURRENT-CYCLE.md 의 Stage 표에서 자기 줄만 갱신
3. cycles/<cycle-id>/README.md 의 Artifact 현황 갱신
4. STOP
```

사용자에게는 **"다음은 Stage N — 별도 invocation 에서 시작"** 만 알린다.
다음 Stage 의 내용을 미리 설계하거나 요약해 주지 않는다.

## 금지

```text
두 Stage 를 한 invocation 에서 처리
Human Semantic Review 를 스스로 통과 처리
입력 Artifact 없이 Stage 시작
설계 의미가 없을 때 추측 — DESIGN GAP 을 만든다 (RULE 5)
Contract 의 Deferred 기능 구현 (RULE 6)
미래를 예측한 구현 추상화 (RULE 8)
다른 프로젝트(HktAdvProtoF / G) 참고
```

## DESIGN GAP

필요한 세계 의미가 정의되어 있지 않으면
`templates/DESIGN-GAP.md` 서식으로 `cycles/<cycle-id>/GAP-<n>-<slug>.md` 를 쓰고
현재 Stage 를 **중단**한다. 설계 변경을 직접 수행하지 않는다.
