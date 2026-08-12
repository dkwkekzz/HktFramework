---
name: advprotoh-gameview-step
description: HktAdvProtoH 의 GameView(렌더) 트랙 step 한 바퀴를 실행한다 — 읽기 → 다음 어휘 선정(v0 로드맵 + APPROVED Proposal) → gameview/ 안에서만 구현 → 합성 데이터 데모 검증 → VOCABULARY ✅ 공개 → STATE 갱신. Cycle(세계) 트랙과 직교 — world/·cycles/ 를 읽지 않고 World Semantic 이름을 만들지 않는다. 사용자가 "GameView step / 렌더 트랙 진행 / gameview 진행" 을 요청하면 사용.
---

# HktAdvProtoH GameView step 루프

**작업 디렉토리: `HktAdvProtoH/gameview/`**. 규칙 권위: [GAMEVIEW.md](../../HktAdvProtoH/gameview/GAMEVIEW.md)(척추·금지선·검증) · [STATE.md](../../HktAdvProtoH/gameview/STATE.md)(NOW/NEXT/INDEX). 설계 원문: [design/Design-GameView.md](../../HktAdvProtoH/design/Design-GameView.md).

> **핵심 불변**: GameView 는 Cycle 트랙과 직교다. 세계가 무엇이든(광산이든 전투든) GameView 는 모른다 — 범용 시각 어휘를 만들고 **VOCABULARY.md 로 공개**할 뿐이다. 한 커밋 = 한 step(어휘 하나 또는 밀접한 소묶음).

## 1. 읽기 — 허용 목록만

**필수**: `gameview/GAMEVIEW.md` · `gameview/STATE.md` · `gameview/VOCABULARY.md` · `gameview/proposals/` 의 APPROVED 항목.
**금지**: `world/` · `app/` · `cycles/`(proposals 원본 참조가 필요한 경우 해당 GVP 파일만) · `design/Design-Workflow.md`·`Design-CycleWorkflow.md`·`Design-Concept.md` — 세계 의미는 이 트랙의 입력이 아니다. `design/Design-GameView.md` 는 허용.

## 2. 계획 — 다음 한 step 고르기

우선순위: **APPROVED Proposal > STATE §2 NEXT 로드맵 순서**.

- Proposal 검토 시: 요구가 World-specific 이름/의미를 담고 있으면 구현하지 말고 범용 인터페이스로 재정의를 제안한다 (예: "시야 범위" → Sector Primitive).
- PROPOSED 상태 Proposal 은 구현하지 않는다 — 인간 승인 대기임을 보고만.
- 한 step 은 어휘 하나(또는 Scene+Camera 처럼 분리 불가능한 소묶음)로 제한. 더 떠올라도 NEXT 로 전가.

## 3. 구현 — `gameview/` 안에서만

- 파라미터는 전부 일반 값 (position, size, color, value, max, catalog key…) — 세계 의미 파라미터 금지.
- Rule 판단 로직 금지 — 입력값을 그리기만 한다. 애니메이션은 명시적 호출(verb)로만 발동.
- Backend(three.js)는 내부에 은닉 — 공개 API 에 three 객체를 노출하지 않는다.
- sprite 는 Visual Asset Catalog key 로만 받는다.

## 4. 검증 — 합성 데이터 데모가 권위

1. **데모 갱신**: `gameview/demo/` 에 새 어휘를 **가짜 데이터**로 시연하는 장면 추가. World 코드 import 0.
2. **알리바이**: 커밋 전 `git status` diff 가 `gameview/`(+ 이 스킬 파일) 안에만 있는가. `world/`·`app/`·`cycles/` diff 0.
3. **눈 검증**: 데모 페이지 실행 방법을 제시하고 브라우저 확인 (자동 스모크/픽셀 검증이 생기면 먼저 돌린다).
4. **공개 게이트**: 데모에서 확인된 어휘만 VOCABULARY ✅ 로 올린다.

## 5. 갱신

- `VOCABULARY.md`: 상태 ⏳→✅, 파라미터 확정 반영, §8 소비 방법(import·초기화) 최신화.
- `STATE.md`: §1 NOW·§2 NEXT 덮어쓰기, §3 Proposal 상태, §4 INDEX 1줄 append.
- 구현한 Proposal 은 RESOLUTION 기입 후 DONE 으로.

## 6. 닫기 체크리스트

1. 알리바이 — diff 가 `gameview/`·스킬에만
2. 데모에서 새 어휘 눈 확인
3. VOCABULARY ✅ 공개 + 소비 방법 갱신
4. STATE 갱신 + INDEX 1줄
5. 커밋 1개 = step 1개

## 금지 사항

- `world/`·`app/`·`cycles/` 를 만지거나 "참고로" 읽지 않는다 — Proposal 이 인터페이스다.
- World-specific 이름(HPBar·MiningRenderer 류)의 컴포넌트·플러그인 생성 금지.
- 승인 없는 Primitive/Renderer 확장 금지 (로드맵 v0 항목은 승인된 것으로 간주).
- 특정 Cycle 하나만을 위한 일회성 표현을 Core 에 넣지 않는다 — 그것은 View Definition(Cycle 트랙)의 일이다.
