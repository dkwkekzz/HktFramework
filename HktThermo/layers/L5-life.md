# L5 — 생명·대사 (Life / Metabolism) 구현 명세

> 역할: **자기유지 소산 구조.** 에너지 구배를 수확해 자기를 유지·복제한다(대사·항상성). "죽음"의 주인
> 레이어. 구현 실체는 `HktCreature`·`HktSplatLife`. **모드**: 런타임 문턱 판정 + (비관측) 거시 반응.

## 1. 자료구조

```
Agent      = { body, heat, reserve }                  // 개체 (관측)
Population  = { N, B_tot, P, T, rates, seed }          // 개체군 (비관측 — 6 숫자)
Baked       = { body=200, m(유지비)=2, C(붕괴문턱), reproCost }
```

## 2. 구현 연산

**`metabolize(agent, harvest) → {reserve', ΔSINK}`** — 대사(개체).
- **입력**: 수확 `h`(구배서 수확) + 유지비 `m`. **과정**: `reserve += (h − m)`, 유지비 `m` 은 소산 → SINK(엔트로피 세). **출력**: 갱신 reserve + SINK 증분. **불변**: `h < m` 지속 → reserve 고갈(아사 경로) · 유지비는 반드시 소산(공짜 유지 없음).

**`selfMaintainCheck(agent, C) → death?`** — 자기유지 판정(핵심: 죽음).
- **입력**: `agent.heat` + 붕괴 문턱 `C`(L2 가 구움). **과정**: `heat ≥ C` 면 엔트로피 수출 한계 초과 → **소산 구조 붕괴**. **출력**: death 이벤트 또는 survive. **불변**: author `hp<=0` 아님 — *문턱 창발* · 붕괴 시 풀 `body+heat` 방출(장부 닫힘).

**`reproduce(agent) → Agent?`** — 번식.
- **입력**: `reserve` + `reproCost`. **과정**: `reserve ≥ reproCost` → 분열(reserve 절반+body 새 개체). **출력**: 자식 Agent 또는 없음. **불변**: 자식 몸 에너지 = reserve 지불(생성 아님).

**`macroPopulationStep(pop, Δt) → pop'`** — [비관측] 개체군 거시 반응.
- **입력**: 개체군 6숫자 + Δt. **과정**: 유입·유지비 소산·아사·번식을 *개체군 수*로 계산(사건 수). **출력**: 갱신 개체군 + 사건 수(죽음/출생). **불변**: 개체 틱 없이 총량 닫힘(EXAMPLE-unobserved §3·§4) · O(반응)≈상수.

## 3. 인터페이스

- **상향 `measureUp(pop) → {개체군 수 N, 생물량 B_tot, 생태 지표}`** — L6(행동할 개체)·L7(경제 참여자)·L8(생태)가 읽음.
- **하향 `constrainDown({자원 유입, 온도}) → harvest·heat`** — L3 열·L8 먹이 유입이 대사 입력으로.

## 4. 오프라인/런타임 분할

- **오프라인(유도)**: 유지비 `m=2`·몸 `body=200`·번식비를 대사 시뮬에서 굽는다(L2 `C` 와 같은 방식).
- **런타임**: 관측 개체는 `metabolize`·`selfMaintainCheck` 로 개별, 비관측 지역은 `macroPopulationStep` 로 통계. LEAVE/ENTER 에서 접기↔펴기(EXAMPLE-unobserved §5).

## 5. 검증·불변식

- **닫힌 장부**: 대사 수지 `섭취 − (일 + 폐열) = Δ저장`, 죽음 풀 재분배 총합 불변. **문턱 창발**: 같은 개체라도 heat 이 C 를 넘느냐로 생사 갈림(600 E 생존 vs 700 E 죽음, EXAMPLE-fireball §5). **직관 검증**: 굶주린 개체가 reserve 고갈로 죽고 몸이 SINK+드롭으로 흩어지는 장면.

> 상세: [../../HktCreature/CLAUDE.md](../../HktCreature/CLAUDE.md) · [../EXAMPLE-unobserved-region.md](../EXAMPLE-unobserved-region.md) · [L6-behavior.md](L6-behavior.md).
