# Frontier — 트랙 인덱스

**후보와 그 의존 순서**, 그리고 **지금 도는 것**은 각 트랙 파일이 담는다. Human 이 트랙
파일에서 하나를 골라 다음 Cycle Goal 로 삼는다 (Human Select → 8 Stage Cycle).
Cycle 로 넘어가는 것은 선택된 후보 블록의 MASTER TRACE 칸들이다.
이 인덱스는 **트랙 목록 · 트랙 사이의 판단 · 어느 트랙에도 속하지 않는 결손**만 담는다.
후보를 읽는 법과 작성·트랙 규칙은 guides/master-frontier.md 소유다.

    진행 현황   사다리가 어디까지 섰는지는 graph/GRAPH.md 의 "척추" 절이 그린다
    기준 Overlay master/overlay.md

## 트랙

트랙은 세션이 아니라 **도메인**이다 — 근거 문서 영역과 `graph/systems.yaml` 의 시스템 축이
경계를 긋는다. 후보 하나는 정확히 한 트랙 파일에 산다. 새 트랙 신설과 후보의 트랙 이동은
NEXT 작업(직렬)만 한다.

| 트랙 | 파일 | 근거 문서 영역 | SELECTED |
|---|---|---|---|
| ITEM | [item.md](item.md) | 아이템 IS · 인벤토리 IE | 없음 — Human 선택 대기 |
| COMBAT | [combat.md](combat.md) | 전투 R1 · DT · 스킬 SK | 없음 — 후보 0 · MASTER OPTIONS 대기 |
| TERRAIN | [terrain.md](terrain.md) | 세계 BW · BT (대지형 · 시스템 축 MS-BEIRA-TERRAIN) | 없음 — Human 선택 대기 |

## 병렬 규칙 — 구조가 지키는 것

병렬 작업의 단위는 레인이고, 이 문서는 그중 **WORLD 트랙 레인들 사이**의 규칙만 담는다 —
레인 전체(VIEW · MASTER · ENGINE · PROCESS 포함)의 단일 출처는 `guides/works.md` 다.
규율이 아니라 파일 소유권이 충돌을 막는다.

```text
한 트랙 = 동시에 한 세션      트랙을 병렬로 띄우는 것은 Human 이고, 같은 트랙을 두 세션이
                             동시에 돌지 않는 것도 Human 이 보장한다. 트랙 안은 언제나 직렬이다

Cycle ID = C-<TRACK>-NNN     번호공간이 트랙 소유다. 다음 번호는 cycles/ 에서 자기 트랙
                             접두사의 최대 +1 — 트랙 안이 직렬이므로 충돌할 수 없다.
                             C001~C023 은 트랙 도입 전의 옛 번호공간이다 — 그대로 둔다

Frontier 쓰기 = 자기 트랙     NEXT 와 Feedback 이 후보를 더하고 지우는 곳은 자기 트랙
                             파일뿐이다. 상대 트랙 후보는 FR-ID 로 참조만 한다

Feedback 경위 = 자기 파일     닫힌 Cycle 의 반영 경위는 feedback/<CycleId>.md — Cycle 마다
                             자기 파일이므로 충돌이 원리적으로 없다

공유 파일 = 병합 뒤 main     overlay.md · graph/capabilities.yaml 처럼 트랙이 공유하는
                             파일을 고치는 Feedback 은 그 Cycle 이 main 에 병합된 뒤
                             최신 main 위에서만 돈다
```

코드 쪽 등록부는 도메인 파일로 갈라져 있다 — 트랙은 `gameview-<도메인>.ts` ·
`semantic-id-<도메인>.ts` 자기 파일에만 더한다 (분할 규칙: guides/works.md).
남는 공유 지점(`world/index.ts` 조립 · 인덱스의 재수출 줄)에서는 **추가만 하고,
자기 도메인 영역 끝에 붙인다** — 기존 줄을 옮기거나 재배열하지 않는다.

## 트랙 간 순서

세 트랙 사이에 의존이 없다 — 어느 쪽을 먼저 골라도 된다.
ITEM 안의 순서는 IS §6 이 그은 것(바닥 → 장착 → 제작 → 세계의 아이템)이고, 후보 다섯이
Human 선택을 기다린다. TERRAIN 안의 순서는 셋 중 하나가 바닥이라는 것이며(땅이 먼저
있어야 나머지가 겪힌다) 그 트랙 파일이 소유한다.

**COMBAT 은 지금 새 Cycle 을 열 수 없다.** 하나뿐이던 후보가 C025 로 닫혔고 그 반영이
끝나 **후보가 0** 이다. 다음 COMBAT Cycle 은 MASTER 레인의 OPTIONS 작업(Q35 — 몸이 아닌
존재를 요구하는 Possibility)이 후보를 낳은 뒤에야 열린다. 그러므로 지금 **병렬로 돌 수
있는 WORLD 트랙은 ITEM 과 TERRAIN 둘**이다.

두 트랙이 겹치는 자리가 하나 있다 — TERRAIN 의 세 번째 후보
(FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED)가 지니고 나누는 것을 다루므로 아이템 쪽 파일에
닿는다. 그 후보를 고를 때는 ITEM 트랙이 무엇을 도는 중인지 먼저 본다 (LANES 의 충돌 칸).

## 지금 열 수 없는 것 — 트랙 밖

어느 트랙의 근거 문서도 소유하지 않는 전역 결손이다. 이유가 사라지면 해당 트랙(없으면
새 트랙)의 후보로 올린다. 트랙 소유 결손은 각 트랙 파일의 같은 절에 있다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| 문명권 준비 갈래 · 희귀 기관 갈래 | 세계 기반(문명권 · 거래 주체)이 없다 (overlay.md World 표 ABSENT). 희귀 기관 쪽은 그 위에 **물건이 몸 밖에 놓인다**(FR-THINGS-LIE-IN-THE-WORLD)까지 필요하다 — IS 주입으로 공통 앞칸이 드러났다. **지형은 이 줄에서 빠졌다** — BT 주입과 Q47~Q51 결정으로 TERRAIN 트랙이 서서 후보 셋을 얻었다 |
| 능동 방어 · Aura/Nen · 베이라 사다리의 잠정 조각 전부 | 그 전체의 설계 문서가 없다 (`part_of.grounded: false` — 척추 시각화의 점선). 능동 방어가 요구하는 **행동 안의 시점 판정**은 C019 로 바닥이 섰다 — 남은 것은 문서뿐이다 |
| 다음 수를 읽는다 (MC-PREDICT · MC-OBSERVE 습성) | 위와 같음 — 반쪽을 소유한 시스템(MS-CREATURE-BEHAVIOR)이 DRAFT 다. 초안 [content/proto-adventure/design/Design-Creature-Behavior-R0.md](../../design/Design-Creature-Behavior-R0.md) 승인 → Inject → 재판정 |
| Tab 후보 추리기 · 대상 프레임 관계 표시 | 세계의 결손이 아니라 화면의 편의 — Cycle 이 아니라 **VIEW 레인** 작업이다 (guides/view-work.md · `works/V-*`) |
