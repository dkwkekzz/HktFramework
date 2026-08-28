# L6 — 개체·행동 (Organism / Behavior) 구현 명세

> 역할: 개체가 *목표를 추구*하는 층. **행동 = 욕망 구배의 내리막 행위**(자유에너지 최소화·active
> inference). NPC·플레이어의 의도가 여기서 난다. 구현 실체는 `HktCharacter`·goal/intent 시스템.
> **모드**: 런타임 의도.

## 1. 자료구조

```
Agent  = { model(내부 세계 예측), goal(desire 구배), skills[] }
Intent = { verb, target, amount, dir }       // L7 로 보내는 이체 제안
```

## 2. 구현 연산

**`sense(agent, observation) → model'`** — 관측 흡수.
- **입력**: 세계 관측(relevancy 범위). **과정**: 내부 모델과 관측의 예측오차 계산 → 모델 갱신. **출력**: 갱신 model. **불변**: 관측된 것만 반영(비관측은 접힌 채) · 결정론(시드 PRNG).

**`selectAction(agent) → Intent`** — 행위 선택(핵심).
- **입력**: 목표(욕망 구배) + 내부 모델 + skills. **과정**: 예측오차(=자유에너지)를 가장 줄이는 행위 선택 — "욕망 구배의 내리막". **출력**: Intent(예: `{cast, slime, 700, dir}`). **불변**: 행위는 에너지 예산 안(공짜 행동 0) · 목표는 라벨 아닌 구배.

**`learn(agent, outcome) → model'/goal'`** — 학습.
- **입력**: 행위 결과. **과정**: 결과로 모델·목표 갱신(강화/약화). **출력**: 갱신 상태. **불변**: 결정론적 갱신 규칙.

## 3. 인터페이스

- **상향 `measureUp(agents) → {의도 흐름, 목표 분포, 상호작용}`** — L7(교환할 개체)이 읽음.
- **하향 `constrainDown({가용 자원, 인과 제약}) → 실행 가능 행위 집합`** — L7 이 준 잔고·사거리가 행위를 제약(불가능한 의도 배제).

## 4. 오프라인/런타임 분할

- **런타임(주)**: `sense`·`selectAction` 이 관측 개체마다 돈다 — 사건을 *시작하는* 입력의 원천(EXAMPLE-fireball §3 L6 카드: 의도 형성 → 인텐트).
- **접힘**: 비관측 지역 개체는 개별 행동 없음(L5 거시 반응으로만). skills·목표 카탈로그는 오프라인 정의.

## 5. 검증·불변식

- **에너지 예산**: 모든 행위는 L7 이체로 지불(공짜 행동 검출 = 반례). **결정론**: 같은 (모델,관측,시드) → 같은 의도. **직관 검증**: 배고픈 개체가 먹이 쪽으로, 위협 앞에서 회피 쪽으로 — 욕망 구배 내리막이 눈에 보임.

> 상세: [../../HktCharacter/CLAUDE.md](../../HktCharacter/CLAUDE.md) · [../../Docs/goal-system-design.md](../../Docs/goal-system-design.md) · [L7-economy.md](L7-economy.md).
