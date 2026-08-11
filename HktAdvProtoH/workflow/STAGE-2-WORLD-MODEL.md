# STAGE-2-WORLD-MODEL — World Model Stage

## 역할

Intent의 모든 의미를 `Required World State + Required World Rule + Required Observable`로 폐쇄한다.

## 입력

- `state/cycles/cycle-XXX/01-intent-package.md`
- `state/cycles/cycle-XXX/00-cycle-contract.md`
- `state/WORLD-BASELINE.md` (기존 Semantic 재사용 우선)

## 출력

- `state/cycles/cycle-XXX/02-world-definition.md` — [../templates/WORLD-DEFINITION-PACKAGE.md](../templates/WORLD-DEFINITION-PACKAGE.md) 형식

## 작성 원칙

1. **Semantic Closure** — Intent의 모든 문장이 State / Rule로 연결되어야 한다. 연결되지 않은 문장이 하나라도 있으면 실패다.

   ```text
   "Actor가 광맥을 알고 있다"   → Actor.Knowledge, Deposit.Identity
   "채굴 도구를 가지고 있다"     → Actor.Inventory, Item.ToolCapability
   "광맥에 접근 가능하다"        → Actor.Position, Deposit.Position, InteractionRange
   ```

2. **World State에는 세계 의미만** — `vector.capacity`, `cacheEntry` 같은 Implementation State 금지. "이것은 세계의 사실인가, 프로그램 구현의 사실인가?"를 항상 묻는다.
3. **Decision Semantic State** — Rule 판단에 영향을 주는 상태(Knowledge, Preference, Skill, CurrentGoal 등)는 World Semantic State이며 Observable 대상이다.
4. **Rule 형식** — `Preconditions / Input / Transition / Result` + `Implements: INTENT-XXX` trace.
5. **Observable을 동시에 정의** — 구현 뒤에 Debug UI를 붙이는 것이 아니라, State/Rule 정의와 함께 Observable Contract(Semantic Lossless Projection)를 정의한다. Transition도 `Before / Input / Rule / After`로 관찰 가능해야 한다.
5-1. **Visual Requirement도 동시에 정의** — "인간이 이 Intent의 Runtime 동작을 게임 공간에서 이해하려면 무엇을 볼 수 있어야 하는가"를 의미 수준으로 기재한다. Visual Component/Primitive 이름(ValueBar, Billboard 등)은 지정하지 않는다 — 표현 수단 선택은 Implementation Stage의 몫이다.
6. **Entity 단위 의미** — 단일 Player 가정(`World.playerX`) 금지. Baseline과 충돌하는 재정의 금지 — 기존 Semantic을 재사용한다.
7. 필요한 의미가 Intent/Contract에 없으면 추측하지 말고 DESIGN GAP 생성 후 STOP (RULE 5).

## STOP 조건

World Definition Package 저장 + 진행 표 갱신 후 STOP.
**Implementation으로 자동 진행하지 않는다 — 반드시 Human Semantic Review Gate를 기다린다 (RULE 4).**
