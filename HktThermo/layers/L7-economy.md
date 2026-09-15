# L7 — 사회·경제 (Society / Economy) 구현 명세

> 역할: 개체들이 *교환*으로 얽히는 층 — 시장·원장·화폐. **가치 = 담긴 에너지**(라벨 아님), 화폐 =
> 자유에너지 프록시. **서버가 권위로 닫는 이체 장부.** 구현 실체는 `HktLedgerWeb`·`HktFeature`.
> **모드**: 런타임 이체 장부(서버 권위).

## 1. 자료구조

```
Ledger   = { pools: {id → balance(정수)} }             // player·entity·escrow·SINK
Transfer = { from, to, amount, cause }                 // 모든 게임플레이 = 이체 문법
```
- **모든 에너지는 정수.** 부동소수 금지. 보존은 이체 클램프 **단 한 곳**이 자료구조로 강제.

## 2. 구현 연산

**`clamp(transfer, ledger, constraints) → transfer'`** — 인과 제약 강제.
- **입력**: 이체 요청 + 잔고 + 인과 제약(사거리·쿨다운·속도 예산). **과정**: `min(요청, from 잔고)` + 제약 위반분 절삭. **출력**: 감당 가능 이체. **불변**: 잔고 초과 이체 불가(에너지 생성 차단).

**`commit(transfer', ledger) → ledger'`** — 원장 커밋(핵심: 보존).
- **입력**: 유효 이체. **과정**: `pools[from] -= amount; pools[to] += amount`. **출력**: 갱신 원장. **불변**: **Σ pools 불변**(자료구조가 강제 — 검증 코드 아님) · from 잔고 ≥ 0.

**`arbitrate(intents[]) → ordered[]`** — 동시 인텐트 중재.
- **입력**: 한 틱의 여러 인텐트. **과정**: FIFO 결정론 순서. **출력**: 정렬된 처리 순서. **불변**: 같은 입력 → 같은 순서(미러 재현).

**`valueOf(item) → energy`** — 가치 산정.
- **입력**: 아이템. **과정**: 담긴 **에너지 총량** 반환(재료 라벨·배율 무시). **출력**: 정수 가치. **불변**: 동일 에너지 = 동일 위력(공짜 노브 0) · 밸런스 = 보존의 따름정리("너무 세다" 불성립).

## 3. 인터페이스

- **상향 `measureUp(ledger) → {부 분포, 시장 상태, 희소성}`** — L8(생태·경제 순환)이 읽음.
- **하향 `constrainDown(intent) → {clamp 결과, broadcast}`** — L6 의도를 받아 clamp·commit 하고 관측자에 방송(relevancy). L5/L6 에 실행 가능 자원을 되돌림.

## 4. 오프라인/런타임 분할

- **런타임(주·서버 권위)**: `clamp`·`commit`·`arbitrate` 가 매 사건에 돈다. 서버는 *시뮬레이션하지 않고 회계*만 — 이동 적분·연출은 클라. (EXAMPLE-fireball §3 L7 카드: 시전·명중·죽음 이체 확정.)
- **오프라인**: 재료 affinity(어느 흐름 증폭)·분포(희소성)는 worldgen 에서 굽는다.

## 5. 검증·불변식

- **닫힌 장부**: 창세 총량 이후 어떤 시퀀스에서도 Σ pools 불변(EXAMPLE-fireball §5: 1250=1250). **가치=에너지**: 동일 에너지 아이템 위력 동일(div 같은 공짜 파라미터 = 반례). **결정론**: FIFO 중재로 미러 재현. **모든 게임플레이 = 이체**: 이체로 표현 못 하면 설계 반례로 기록.

> 상세: [../../HktLedgerWeb/CLAUDE.md](../../HktLedgerWeb/CLAUDE.md)(이체 클램프·규칙 5) · [../../HktFeature/CLAUDE.md](../../HktFeature/CLAUDE.md) · [L8-world.md](L8-world.md).
