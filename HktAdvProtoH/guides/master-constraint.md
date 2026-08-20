# Master Constraint Guide

## Role

게임의 설계 공간을 제한하는 **Design Constraint** 를 정리·기록한다.
Constraint 는 Human 이 소유한다.

Constraint 는 기본 절차(WHY → OPTIONS → NEED → NEXT)의 단계가 아니라
각 선택 지점에 적용되는 **Filter** 다 (정책 §2.3 · §10). 이 Guide 는 Filter 자체를
정비하는 작업 — 신설·재작성·승격·충돌 노출 — 을 다루며,
**Human 이 명시적으로 요청할 때만** 수행한다.

기반 기획 문서에서 원칙을 추출하는 작업은 주입(`master-inject.md`)의 1단계로 일어난다 —
그때도 이 Guide 의 규칙(특히 "원본보다 세게 쓰지 않는다")을 그대로 따른다.

## Input

- `master/root.md` — Root Game Goal · World Premise
- `master/constraints/` — 이미 승인된 DC-*
- `master/candidates/` — 승인 대기 중인 CC-*
- (있으면) Human 이 이번에 지시한 원칙

## Do

1. `root.md` 의 World Premise 중 **반복적인 설계 제한을 만드는 것**을 식별한다.
   세계의 현재 상태(MW-*)와 성질(Premise/Constraint)을 구분한다.
2. 후보마다 `statement` · `rationale` · `scope` 를 쓴다.
   `statement` 는 압축하고, `rationale` 은 **읽히게 쓴다** —
   `master/SCHEMA.md` 의 "읽히게 쓴다" 규칙 5항(나쁜 방식 대비 · 실물 코드 인용 ·
   무엇이 달라지나 · 안 읽히는 조각 지목 · 경계)을 따른다.
3. `requires` / `prohibits` / `prefers` 를 구분해 채운다 — 셋의 의미가 겹치면 안 된다.
4. 기존 DC-* 와의 관계를 검사한다 — `supports` / `conflicts_with`.
5. 충돌이 있으면 **해결하지 말고** Conflict · Affected Nodes · Trade-off · Expected
   Consequences 를 Human 에게 제시한다.
6. `candidates/CC-*.md` 를 승격하는 경우 Human 승인 여부를 확인하고,
   승인된 것만 `constraints/DC-*.yaml` 로 옮긴다 (`provenance: CANDIDATE:CC-*`).

## Output

`master/constraints/DC-*.yaml` (파일 하나 = Constraint 하나)

형식은 `master/SCHEMA.md` 가 단일 출처다.

## Must

- Constraint 는 **Goal/Possibility/Capability 의 형태**를 제한한다. 시스템을 만들지 않는다.
- `rationale` 을 설명할 수 있어야 한다 — 설명 못 하면 취향이지 Constraint 가 아니다.
- 원칙 문장만 남기고 예시를 생략하지 않는다. 읽히지 않는 원칙은 지켜지지 않는다
  (SCHEMA "읽히게 쓴다"). 길이는 비용으로 치지 않는다 — Constraint 는 오래 산다.
- Scope 로 "어떤 Node 에 적용되는가"를 판정할 수 있어야 한다.
- 승인 상태를 `status` 로 명시한다. Human 승인 전에는 `DRAFT` 다.
- 근거 문서가 그 의미를 더 이상 공급하지 않으면 **보류하지 말고 삭제한다** (Human 결정).
  삭제 사유와 이력은 `master/HISTORY.md` 에 적는다 — `constraints/README.md` 에는
  지금 살아 있는 Constraint 만 남긴다.

## Must Not

- 수치·상수·판정 공식을 넣지 않는다 (`0.20 sec` 는 Cycle 소유).
- Constraint 에서 Capability 목록을 직접 도출하지 않는다 — 필요성은 Possibility 에서 온다.
- Human 승인 없이 핵심 Constraint 를 추가·삭제·완화하지 않는다.
- Constraint 간 충돌을 임의로 해결하지 않는다.
- 모든 Node 에 `CONSTRAINS` 를 무차별로 연결하지 않는다.

## Done When

- 정책 §10 Constraint 정책과 정합한다 —
  statement/rationale 설명 가능 / requires·prohibits·prefers 구분 /
  수치 없음 / 시스템 목록 없음 / status 명시.
- 각 Constraint 를 읽고 "무엇이 금지되고 무엇이 요구되는가"에 답할 수 있다.
- 충돌이 있다면 숨겨지지 않고 노출되어 있다.
