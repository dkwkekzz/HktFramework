---
name: advprotoh-cycle-implement
description: HktAdvProtoH 의 리뷰 통과된 Implementation Package 를 구현한다 — World Module 구현 → Observable 투영 → View Binding(공개 어휘만) → Playable Assembly. gameview/ 는 절대 수정하지 않고 라이브러리로만 소비한다. 사용자가 "AdvProtoH 구현 / Cycle 구현 / cycle implement" 를 요청하면 사용.
---

# HktAdvProtoH Cycle 구현 (Stage 8~9)

**작업 디렉토리: `HktAdvProtoH/`**. 입력은 인간 리뷰를 통과한 `cycles/<cycle-id>/PACKAGE.md` + `VIEW.md` 다. `state/CYCLES.md` 에서 상태가 `REVIEWED` 인지 확인하고, `PLANNED` 상태면 구현하지 말고 리뷰부터 요청하라.

## 읽기

**필수**: `cycles/<cycle-id>/PACKAGE.md`·`VIEW.md` · `state/REGISTRY.md` · 사용할 기존 Module 의 `MODULE.md` · `gameview/VOCABULARY.md`(소비 API).
**금지**: `gameview/` 내부 소스·GAMEVIEW.md·STATE.md — VOCABULARY §8 의 소비 방법이 인터페이스의 전부다. 기존 Module 의 내부 구현도 Contract(MODULE.md)로 충분하면 읽지 않는다.

## 폴더 소유권

```text
world/core/            공유 World Semantic (State 저장·Rule 실행·Observable 투영 기반)
world/modules/<name>/  이번 Cycle 의 신규 Module
app/<cycle-id>/        Playable Assembly (조립 + View Binding + Player Input)
gameview/              ❌ 수정 금지 — import 만
cycles/<id>/           설계 산출물 (구현 중 발견한 GAP 만 추가)
```

## 절차

### 1. 구현 범위 확정
PACKAGE §9(기존 Module)·§10(신규 경계)대로 새로 만드는 것만 구현한다. 기존 Module 재구현 금지, 내부 수정 금지.

### 2. World 구현 — `world/`
- State/Rule 은 PACKAGE §3·§4 의 의미 그대로. Agent 재량은 클래스·자료구조·파일 구조·캐싱 등 mechanism 만.
- **모든 의미 있는 상태 변화는 Rule 실행을 통해서만** — 코드 어딘가에서 이유 없는 `stoneCount++` 금지. Rule 실행은 `Before/Input/Rule/After` Transition 레코드를 남긴다.
- Rule 코드에 `Implements: INTENT-*` 추적 주석을 남긴다.

### 3. Observable 구현
- PACKAGE §5 Observable Contract 를 그대로 투영 — World 내부 상태와 분리된 `ObservableWorldState` 스냅샷 + Transition 스트림 + Possibility 가용성(reason 포함).
- View·검증·Inspector 는 **이것만** 읽게 된다.

### 4. View Binding — `app/<cycle-id>/`
- `VIEW.md` 명세를 코드로 옮긴다: Observable 값 → gameview 공개 어휘 파라미터 연결, `ON RULE-*` → Animation 어휘 sequence.
- Binding 코드에 조건 판정·거리 계산 등 **Rule 재판단 금지** — 값을 옮기기만 한다.
- VIEW.md 에 없는 binding 을 임의 추가하지 않는다 (필요하면 VIEW.md 를 먼저 갱신하고 사유 기록).

### 5. Playable Assembly
기존 Module + 신규 Module + Minimal World 초기 상태 + Player Input + GameView 를 조립해 **실행 가능한 게임**을 만든다. Screen Space Inspector(현재 Goal/Possibility/Rule/Transition)도 Observable 에서 binding 한다.

### 6. 설계 GAP 처리
구현 중 State/Rule 의미 부족 발견 시 임의 확정하지 말고 `cycles/<cycle-id>/GAPS.md` 에 `WORLD DESIGN GAP`(Intent/Missing Semantic/Reason/Proposed State) 형식으로 제출하고 사용자 판단을 받는다. 시각 어휘 부족은 `GVP-NNN` Proposal 로.

### 7. 닫기 체크리스트
1. **알리바이**: `git status` diff 가 `world/`·`app/`·`cycles/<id>/`·`state/CYCLES.md` 안에만 있는가. **`gameview/` diff 0** (Proposal 파일 제외).
2. Positive Scenario 가 실제 실행으로 재현되는가 (Before→After 수치 확인).
3. Transition 레코드가 Rule ID·Before·After 를 담는가.
4. `state/CYCLES.md` 상태를 `IMPLEMENTED` 로 갱신.
5. 마지막 보고: 실행 방법(명령), 확인할 플레이 장면, 다음 단계 `advprotoh-cycle-verify`.

## 금지

- `gameview/` 수정 (어휘가 부족하면 Proposal — 직접 고치지 않는다)
- 기존 Module 내부 수정 (필요 시 Version 변경 절차를 사용자에게 제안)
- Goal/Possibility/Intent/Rule 의미 변경, Precondition 생략, Observable 생략
- View/Binding 코드에서 World 내부 상태 직접 읽기
- World State 에 asset 경로·구현 상태(cache 등) 넣기
