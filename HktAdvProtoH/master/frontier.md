# FRONTIER — 다음 Cycle 후보

> M2 산출물. Master Graph + 현재 `world/` `view/` 를 겹쳐 본 결과다.
> **Agent 는 후보를 만들 뿐 개발 우선순위를 확정하지 않는다** (Policy §25 · §28 Step 10).
> Human 이 하나를 골라 Cycle Goal 로 확정하면 그 순간 Master 단계는 끝나고
> `advprotoh-cycle` 스킬의 Stage 1 이 시작된다.

생성 기준: `npm run master` 의 Capability Overlay.
갱신 시점: Cycle 이 COMPLETE 되어 `capabilities.yaml` 이 바뀔 때마다 M2 를 다시 돈다.

---

## 지금 세계가 할 수 있는 것

```text
● 이동 · 몸 충돌 · 시점        C_MOVE · C_BODY_COLLIDE · C_ORIENT_VIEW
● 채굴 · 소지(일부)            C_MINE_DEPOSIT · C_CARRY_ITEM(◐)
● 휘두름 · 기력 템포           C_MELEE_STRIKE · C_SKILL_TEMPO
● 다중 관찰자 · 디버그 명령    C_OBSERVE_WORLD · C_DEBUG_COMMAND
◐ 스스로 움직이는 존재         C_NPC_ACT — 인지 반사까지
```

## 지금 막혀 있는 것

R001·R002 의 Possibility 는 10개다. `npm run master` 판정은 다음과 같다.

```text
▶ 지금 가능         0 개
◐ 부분만 있다       2 개   P-R001-MINE-DIRECT · P-R002-GUARD-HERD
✕ 없는 것이 있다     8 개
```

기다리는 Capability (기다리는 Possibility 수):

```text
C_KNOW          5   주체가 아는 것이 고를 수 있는 길을 바꾼다
C_CARRY_ITEM ◐  5   지니기만 되고 놓기·건네기가 없어 물건이 오갈 수 없다
C_NPC_ACT ◐     2   반사까지만 — 자기 목적으로 움직이는 존재가 아직 없다
C_TRACK · C_TALK · C_TRADE · C_CRAFT · C_TAME · C_LOOT · C_FORAGE   각 1
```

`P-R001-MINE-DIRECT` 는 실제로 플레이된다 (C001) — `◐` 는 소지가 부분적이라는 표시일 뿐
캐는 것 자체가 막혀 있다는 뜻이 아니다. 도구는 판정에 쓰이지만 놓거나 건넬 수는 없다.

---

## F-001 — 아는 것이 길을 바꾼다 (C_KNOW)

```text
Cycle Goal 후보
    Player 가 어떤 사실을 알기 전에는 걸 수 없던 행동이,
    그 사실을 알고 난 뒤 실제로 걸 수 있게 되고,
    자기가 무엇을 알고 있는지를 화면에서 읽을 수 있다.

Serves        P-R001-DEEP-SEAM · P-R002-KILL-GREYFANG · P-R002-TRACK-PACK ·
              P-R002-FEED-THE-PACK · P-R001-MAKE-OWN-TOOL  (5)
Capability    C_KNOW   MISSING → 이번이 만든다
크기          Actor.Knowledge 상태 + 그것을 Precondition 으로 읽는 Rule 하나 + 관찰.
              기존 Rule 을 바꾸지 않고 새 Rule 하나로 닫을 수 있다.
근거          Design-Concept §4.1 · §14 가 이미 의미를 정의해 두었다.
              world/semantic/actor.ts 에 그 상태가 없다는 것만이 결손이다.
플레이 확인    같은 자리에서 같은 행동이 "모를 때는 안 되고 알고 나면 된다" 를 눈으로 본다.
주의          지식의 획득 경로(대화·조사)까지 한 Cycle 에 넣지 않는다.
              이번엔 "가지고 있으면 달라진다" 까지다 — 얻는 길은 F-002 · F-003 이다.
```

## F-002 — 흔적을 읽는다 (C_TRACK)

```text
Cycle Goal 후보
    Player 가 땅에 남은 흔적을 살펴, 무엇이 어느 쪽으로 지나갔는지를 알아낸다.

Serves        P-R002-TRACK-PACK  (1) — 이 Region 에서 싸우지 않고 원인에 닿는 유일한 길
Capability    C_TRACK  MISSING → 이번이 만든다
              (C_KNOW 선행 필요 — 알아낸 것을 담을 곳이 있어야 한다)
크기          흔적이라는 World Entity + 조사 Rule + 결과를 Knowledge 로 남기는 Transition.
플레이 확인    흔적을 조사하면 방향이 드러나고, 그쪽으로 가면 실제로 무리가 있다.
주의          F-001 이 먼저다. 알아낸 것을 담을 상태가 없으면 조사 결과가 갈 곳이 없다.
```

## F-003 — 말해서 얻는다 (C_TALK)

```text
Cycle Goal 후보
    Player 가 NPC 와 말해, 그 NPC 가 알고 있거나 믿고 있는 것을 전해 받는다.

Serves        P-R001-BUY-FROM-MINER (C_TRADE 도 필요) · R002 의 믿음 전달 경로 전체
Capability    C_TALK  MISSING → 이번이 만든다   (C_KNOW 선행 필요)
크기          대화 Rule 하나 + 전달되는 Knowledge. 상점·퀘스트는 넣지 않는다.
플레이 확인    단과 말하면 "회색엄니가 원인이다" 라는 믿음이 내게 옮겨 오고,
              그 뒤 내게 보이는 길이 달라진다.
주의          이것이 들어오는 순간 R002 의 오해 구조가 실제로 플레이된다.
              Policy §27.3 대로 별도 Narrative Stage 를 만들지 않는다 — Rule 로 닫는다.
```

## F-004 — 물건이 오간다 (C_CARRY_ITEM 확장 · C_LOOT)

```text
Cycle Goal 후보
    Player 가 지닌 것을 땅에 놓거나 남에게 건네고, 놓인 것을 집을 수 있다.

Serves        P-R001-TAKE-BY-FORCE · P-R002-FEED-THE-PACK · P-R001-BUY-FROM-MINER 의 전제
Capability    C_CARRY_ITEM  PARTIAL → 확장 · C_LOOT  MISSING → 이번이 만든다
크기          소지에서 세계로, 세계에서 소지로 가는 Rule 두 개.
플레이 확인    캔 돌을 땅에 놓고, 다른 관찰자가 그것을 집는다 (C004 다중 관찰자 재사용).
주의          한계·무게·정리는 넣지 않는다. 오가는 것 자체가 이번 Delta 다.
```

## F-005 — 스스로 목적을 가진 존재 (C_NPC_ACT 승격)

```text
Cycle Goal 후보
    NPC 가 가장 가까운 상대에 반사하는 대신 자기 목적을 가지고 움직이며,
    Player 는 그 존재가 지금 무엇을 하려는지를 화면에서 읽을 수 있다.

Serves        P-R002-GUARD-HERD · P-R002-FEED-THE-PACK · R002 전체의 전제
Capability    C_NPC_ACT  PARTIAL → IMPLEMENTED
크기          큰 편이다. Design-Concept §12~§13 의 탐색을 세계에 들이는 일이다.
              한 Cycle 로 닫으려면 목적 하나 · 가능성 두 개 규모로 좁혀야 한다.
플레이 확인    회색엄니가 Player 를 보고 달려드는 대신, 굶주림에 따라 목초지로 향한다.
주의          범위가 새기 쉽다. Human 이 이것을 고른다면 Cycle Definition 에서
              EXCLUDED 를 특히 단단히 박아야 한다.
```

## F-006 — 캐지 않고 모은다 (C_FORAGE)

```text
Cycle Goal 후보
    Player 가 도구 없이 수풀에서 먹을 것을 모으고, 자리마다 나는 것이 다르다.

Serves        P-R002-OTHER-FOOD  (1)
Capability    C_FORAGE  MISSING → 이번이 만든다
크기          작다. C_MINE_DEPOSIT 과 같은 골격을 도구 없는 자원에 적용한다.
플레이 확인    수풀에서 먹을 것이 나오고, 다른 자리에서는 다른 것이 나온다.
주의          가장 싸지만 가장 적게 여는 후보다 — Possibility 하나만 열린다.
              Policy §26-5 의 "단순 구현 Task 가 아닌가" 를 특히 따져야 한다.
```

---

## Agent 의견 (참고 — 결정이 아니다)

```text
가장 많이 여는 것            F-001 (5개)
가장 적은 위험으로 닫히는 것  F-006
이야기가 실제로 도는 최소 조합 F-001 → F-003 → F-002
가장 크고 가장 새기 쉬운 것   F-005
```

C_TRADE · C_CRAFT · C_TAME 은 각각 C_TALK · C_CARRY_ITEM 확장 · C_KNOW 를 전제로 하므로
지금 단계의 Frontier 후보로 올리지 않았다 — 먼저 열려야 할 것이 앞에 있다.

## 열린 MASTER GAP

```text
MASTER GAP
Required   Root Goal 이 확정되어야 Region 들이 무엇에 기여하는지 판정할 수 있다
Missing    G-ROOT-STAND 가 provisional 이다 (master/graph/00-root.yaml)
Reason     Root Goal 과 Design Constraint 는 Human 소유다 (Policy §42-1).
           Agent 가 CLAUDE.md 목표와 Design-Concept 전제에서 도출한 잠정안일 뿐이다
Return To  Human
```
