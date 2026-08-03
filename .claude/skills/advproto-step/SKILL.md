---
name: advproto-step
description: HktAdvProtoF 작업 한 바퀴(모듈 1개 또는 하위 작업 1개)를 WORKFLOW 8단계 사이클로 토큰·시간 효율적으로 실행한다 — 게이트 확인 → 작업 카드 → 계약 → 구현 → 검증 3종 → Lab 눈검증 → 증거 → 닫기. 사용자가 "AdvProtoF 작업 진행 / 다음 작업 / P0 진행 / step 진행"을 요청하면 사용.
---

# HktAdvProtoF 작업 한 바퀴 — 실행 절차

**작업 디렉토리: `HktAdvProtoF/`** — 이하 상대 경로는 이 폴더 기준.
**규정 원본은 [modules/WORKFLOW.md](../../HktAdvProtoF/modules/WORKFLOW.md)** 다 — 불변 원칙 4(§0)·
작업 카드 6필드(§2)·분할 규칙(§3)·계약 서식(§4)·8단계 사이클(§5)·상태 원소 규칙(§6)·단계 게이트(§7).
이 스킬은 그 규정을 효율적 순서로 실행하는 방아쇠일 뿐, 규정을 중복 기재하지 않는다.
어긋나면 WORKFLOW 가 이긴다.

## 실행 순서 (토큰 효율)

1. **읽기 · 게이트** — `STATE.md` 만 먼저: 단계 게이트(지금 착수 가능한 계층), **열린 이슈 표의
   "착수 전" 조건**(있으면 그것이 이번 작업이다), TODO 의 다음 작업. 그 다음 `modules/MODULES.md` 는
   **해당 모듈 행만**, 원문(`design/`)은 해당 모듈 절만 부분 읽기. 선행 모듈이 전부 VERIFIED 인지
   계약(`app/packages/contracts/*.yaml`)으로 확인 — 아니면 착수 금지 (WORKFLOW §5-1).
2. **카드** — 작업 카드 6필드(목적·입력·출력·검증 장면·상태 원소·시각화)를 STATE.md TODO 에 쓴다.
   분할 신호(§3)에 걸리면 하위 작업으로 쪼갠 뒤 첫 조각만 이번 바퀴에 든다.
   새 계층의 첫 계약이면 CLAUDE.md **북극성 2개에 어떻게 기여하는지** 한 줄 답을 카드에 남긴다.
3. **계약** — `app/packages/contracts/<모듈ID>.yaml` 작성/갱신 (서식: `modules/MODULE-TEMPLATE.yaml`).
   입출력은 MODULES.md 행과 일치해야 한다 — 다르면 MODULES.md 갱신을 별도 작업으로 먼저.
4. **구현** — `app/packages/core/` 우선. core 순수성(§1): I/O·DOM·`Date.now()`·`Math.random()` 금지,
   난수는 V1 SeededRandom·시간은 V1 TickClock 만. lab/scenarios 는 core 를 소비만 한다.
5. **검증 3종** — 시나리오 정상 1+실패 1+경계 1 (`scenarios/suites/`), 결정성(같은 시드 반복 → 같은 해시),
   Lab 페이지 화면 7요소 (§5.1). 기존 검증도 깨지지 않아야 한다: `npm test` 전체 통과.
6. **증거** — `npm run verify` 실행. **exit 0 이 커밋의 전제 조건이다** — 대시보드에 VERIFIED 아닌
   모듈이 하나라도 있으면 원인을 해소하기 전에 커밋하지 않는다 (V3 강등 사건 #662 의 교훈).
   커밋 직전 `git status` 로 증거·스냅샷 재생성분이 전부 스테이징됐는지 확인.
7. **닫기** — STATE.md 갱신(구현 현황 한 줄 + TODO 정리) → **커밋 1개 = 작업 1개**.
   이 커밋이 단계를 닫으면(단계의 모든 모듈 VERIFIED + 대표 장면 확인) STATE.md 단계 게이트를
   갱신하고 TODO 에 **"단계 N 리뷰 대기"** 한 줄을 남긴다 — 리뷰는 자동으로 쓰지 않는다
   (사용자가 `/advproto-review` 로 요청할 때만).

## 하지 말 것

- 게이트(선행 미검증·"착수 전" 이슈)를 넘겨 착수하지 않는다.
- 증거 없이 status 를 올리지 않는다 — 완료 선언은 증거 파일로만 (V4 원칙).
- `npm run verify` 가 exit 0 이 아닌 채 "완료" 커밋을 만들지 않는다.
- `design/` 원문을 수정하지 않는다 — 파생(modules/·STATE.md)만 갱신한다.
- 한 커밋에 두 작업을 섞지 않는다.
