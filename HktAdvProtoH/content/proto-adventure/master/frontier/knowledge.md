# Frontier — KNOWLEDGE 트랙

전투 지식(CK) 도메인의 후보와 지금 도는 것을 담는다. 트랙 규칙과 트랙 간 판단은
[README.md](README.md), 읽는 법은 guides/master-frontier.md 소유다.

    기준 Overlay   graph/GRAPH.md 의 Capability Overlay 절 — "Capability — 전투 지식 영역 (CK)" 절.
                   **일곱 줄이 전부 MISSING 이다.** 다른 표들과 비어 있는 방식이 다르다 —
                   전투 영역의 결손은 판정 하나가 없는 것이고 아이템 영역은 상태 하나가
                   없는 것인데, 여기는 **판단이라는 것 자체가 세계에 없다**
    근거 문서       CK = content/proto-adventure/design/Design-Combat-Knowledge-Extension-R0.md
    시스템 축       MS-COMBAT-KNOWLEDGE (획득 · 성장 · 선택 · 운용)

## 한눈에 보기

일곱이다. 하나가 문이고 나머지 여섯이 그 문 뒤에 선다.

    문
    WHAT-YOU-KNOW-FIGHTS-WITH-YOU          ← 이것이 서지 않으면 나머지가 닿을 곳이 없다
      ↓
    ┌─────────────────────┬──────────────────────┐
    ↓                     ↓                      ↓
    YOU-CHOOSE-           THE-WORLD-             (문에 딸린 것 — 아래 넷의 앞칸)
    WHAT-TO-BRING         TEACHES-YOU
      ↓         ↘           ↓
    WHEN-TWO-   TWO-KNOWINGS-  ┌──────────┬─────────────┐
    ANSWERS-    MAKE-A-THIRD   ↓          ↓
    DISAGREE                   THE-SAME-  SOMEONE-
                               KNOWLEDGE- TAUGHT-YOU
                               GOES-DEEPER

`Depends on` 이 빈 것과 그 앞이 이미 닫힌 것만 지금 고를 수 있다 — **지금은 첫째 하나다.**
나머지는 자리를 잡아 두는 것이며, 그래야 이 층 전체가 어디로 가는지가 한 화면에서 보인다.

## 후보

### FR-WHAT-YOU-KNOW-FIGHTS-WITH-YOU — 배운 것이 몸의 판단이 된다

    CK 근거              §2 (완성된 판단법 하나) · §12 · §13 (실행은 몸의 능력이 한다) ·
                         §17 (지식 → 상황 해석 → 전투 의도) · §31 (판단이 읽힌다) ·
                         §37 · §38 (첫 구현 범위와 1차 성공 조건) · §40

    이것이 무엇인가      몸에 전투법 하나가 들어 있고, 그것이 지금의 상황을 읽어
                         이 몸이 무엇을 우선하고 무엇을 억제할지를 정한다.
                         플레이어는 그 판단을 쓰지 않는다 — 이미 완성된 것을 지닐 뿐이다

    세계에 생기는 것      ① 전투법이라는 것이 세계에 있고, 몸이 그것을 하나 지닌다
                         ② 그 전투법에는 적용되는 상황이 있고, 지금이 그 상황인지가 판정된다
                         ③ **지금 무엇을 하려는가**(전투 의도)가 몸의 상태로 있다
                         ④ 그 의도가 실제로 행동을 바꾼다 — 우선하거나 억제한다
                         ⑤ 관찰: 무엇이 켜져 있는가 · 무엇을 보고 · 무엇을 정했는가 · 왜

    이 기능이 아닌 것     **자리가 여럿이 아니다** — 하나다. 고르는 일은 다음 후보다
                         배우는 것이 아니다 — 처음부터 지니고 시작한다. 획득은 넷째다
                         성장도 전수도 조합도 아니다
                         **플레이어의 손을 뺏는 것이 아니다** — 지식이 우선하고 억제할 뿐
                         대신 조작하지 않는다. 이동도 스킬도 여전히 사람이 누른다
                         새 전투 판정이 아니다 — 피해 공식에 한 항도 더하지 않는다 (CK §0)
                         자율 존재의 행동 기반을 대체하는 것이 아니다 (Q62)

    이미 있는 것          지금 무엇을 할 수 있고 왜 못 하는가 —
                         `view/skill-presentation.ts` 의 `unavailableReason` 과
                         세계가 사유를 골라 하나 내보내는 얼개 (C007 이래)
                         자율 존재가 스스로 판단하는 자리 —
                         `world/simulation/npc-decide.ts` 의 RULE-NPC-DECIDE-001
                         (기력이 되면 큰 기술, 아니면 기본 기술)
                         한 몸이 지금 무엇을 하는 중인가 — `CurrentAction` (C002)
                         힘의 배분 — `Actor.Allocation` (C-COMBAT-001, Human Play 대기)
                         경위를 세계가 싣고 화면이 옮기는 형태 — `DamageBreakdown` (C010 이래)
                         관계 · 태도 · 선딜 — 상황을 읽을 재료가 이미 관찰에 실린다 (C018 · C019)

    Playable Result      같은 몸이 전투법을 지녔을 때와 지니지 않았을 때 **눈에 띄게
                         다르게 싸우고**, 방금 그 행동이 어느 전투법의 무엇 때문이었는지를
                         화면에서 되짚을 수 있다 (CK §38 의 1차 성공 조건 그대로)

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT · MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility   MP-PREPARE-THE-RIGHT-KNOWLEDGE · MP-LEARN-HOW-TO-FIGHT-IT
                         (둘 다 전진 — 어느 것도 이 Cycle 로 닫히지 않는다)
    Missing / Partial    MC-CONDUCT-BY-KNOWLEDGE (MISSING) · MC-EXPLAIN-COMBAT-DECISION (MISSING)
                         + CN-COMBAT-INTENT (개념 — 세계에 없다)
    Active Constraints   DC-KNOWLEDGE-IS-NOT-A-SCRIPT · DC-KNOWLEDGE-SHOWS-IN-BEHAVIOR ·
                         DC-KNOWLEDGE-DECISION-IS-TRACEABLE ·
                         DC-KNOWLEDGE-RUNS-CAPABILITY-NEVER-CREATES-IT ·
                         DC-MASTERY-IS-KNOWING-NOT-REFLEX · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — 지식이 완성된 채로 주어지고 플레이어가 조건을 엮지
                         않으며, 차이가 값이 아니라 행동으로 나고, 판단마다 사유가 남고,
                         지시한 운용이 그 몸에 없는 능력이면 성립하지 않는다.
                         **가장 주의할 것은 넷째다** — 지식이 "무엇을 할 수 있는가" 를
                         늘리는 순간 이 층이 스킬의 다른 이름이 된다
    Observable Result    무엇이 켜져 있는가 · 지금 그 상황이 성립하는가 · 지금의 전투 의도 ·
                         그 의도가 무엇을 보고 나왔는가가 전부 관찰에 실린다
    Why one Cycle        **쪼갤 수 없다.** 셋 중 어느 하나만 세우면 죽은 노드가 된다 —
                         전투 의도만 세우면 그것을 정하는 것이 없고, 자리만 세우면 담긴
                         것이 아무것도 하지 않으며, 설명만 세우면 설명할 판단이 없다.
                         셋이 함께 서야 "지식을 끼우니 다르게 싸운다" 가 성립하고,
                         그것이 CK §38 이 스스로 정한 1차 성공 조건이다.
                         새 상태는 셋뿐이다 — 지닌 전투법 하나 · 지금의 전투 의도 ·
                         그 의도가 나온 사유. 나머지는 이미 세계에 있는 것을 읽는다
    Depends on           없음
    Status               PROPOSED

    주의 — C-COMBAT-001 과의 순서
                         첫 전투법으로 무엇을 세우든 **배분(Allocation)을 건드리는 것은
                         피할 수 있다.** CK §37 의 넷 중 「기력 보존」은 기력 운용이라
                         배분과 겹치지 않고, 억제/우선의 대상을 스킬 가부로 잡으면
                         C007 이래의 얼개만 쓴다. 배분을 쓰는 전투법(「전신 강화」류)은
                         C-COMBAT-001 이 COMPLETE 로 닫힌 뒤에 세운다

### FR-YOU-CHOOSE-WHAT-TO-BRING — 무엇을 들고 갈지 고른다

    CK 근거              §10 (제한된 자리) · §11 (Collection → Selection → Build) ·
                         §27 (전투 준비 플레이) · §34 (Class 층이 오르면 자리가 는다)

    이것이 무엇인가      배운 전투법이 자리보다 많아지고, 이번 싸움에 어느 것들을
                         가져갈지 고른다. 고른 것들은 한 전투 동안 **함께** 작동한다

    세계에 생기는 것      ① 배운 전투법의 목록과 지금 작동하는 목록이 따로 있다
                         ② 작동하는 자리가 여럿이고 배운 양보다 적다
                         ③ 자리에 넣고 빼는 일이 세계의 행동으로 있다
                         ④ 관찰: 배운 것 · 지금 든 것 · 자리가 몇이고 몇이 찼는가

    이 기능이 아닌 것     둘이 부딪칠 때의 우선순위가 아니다 — 셋째 후보다
                         자리 수가 자라는 것이 아니다 — 그것은 성장 쪽이 붙일 때 온다
                         (다만 **자란다는 것은 정해졌다** — Q65(b))
                         배우는 길이 아니다 — 넷째 후보다

    이미 있는 것          지닌 것과 걸어 둔 것을 가르는 얼개 전부 — 소지품(C020 · C022) ·
                         적용 자리(C023) · 한 자리 하나(C024) · 바꿔 걸기(C024).
                         **형태가 그대로 재사용된다** — 대상만 물건에서 전투법으로 바뀐다
                         목록·가부·사유를 세계가 싣는 형태 (DC-WORLD-OWNS-THE-SURFACE-LIST)
                         소지품을 여는 표면 (C026) — 고르는 화면의 선례

    Playable Result      같은 몸으로 같은 상대 앞에 서되 **다른 조합을 들고 가서**
                         다르게 싸우고, 무엇을 두고 왔는지가 그 판에서 아프다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT · MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility   MP-PREPARE-THE-RIGHT-KNOWLEDGE (이 Cycle 로 크게 전진한다 —
                         다만 무엇이 올지 미리 아는 길(MK-LOCAL-WORLDSTATE)이 없어 닫히지 않는다)
    Missing / Partial    MC-CARRY-COMBAT-KNOWLEDGE (MISSING)
    Active Constraints   DC-KNOWLEDGE-IS-CARRIED-NOT-HOARDED · DC-WORLD-OWNS-THE-SURFACE-LIST ·
                         DC-ITEM-HOLDING-IS-NOT-APPLYING (같은 형태)
    Constraint Eval      SATISFIED — 보유와 적용이 갈리고, 자리가 여럿이되 보유보다 적어
                         고르는 일이 강제되며, 목록과 자리 수를 세계가 싣는다
    Observable Result    배운 목록 · 든 목록 · 빈 자리 · 넣지 못하는 사유가 관찰에 실린다
    Why one Cycle        새 상태가 둘이다 — 배운 것의 목록과 자리. 넣고 빼는 규칙은
                         C023 · C024 의 형태를 그대로 옮긴다
    Depends on           FR-WHAT-YOU-KNOW-FIGHTS-WITH-YOU — 담을 것이 아무것도 하지
                         않으면 고르는 일이 뜻을 갖지 않는다
    Status               PROPOSED

### FR-WHEN-TWO-ANSWERS-DISAGREE — 둘이 다른 것을 말할 때

    CK 근거              §32 (Knowledge 충돌 — 설계된 중요도와 Situation Specificity ·
                         Specific > General · 필요하면 함께 장착 불가)

    이것이 무엇인가      함께 든 전투법 둘이 서로 다른 판단을 요구할 때, 어느 쪽이
                         서는지가 정해져 있다 — 상황에 더 구체적인 쪽이 이긴다

    세계에 생기는 것      ① 전투법마다 자기 중요도와 적용 상황의 좁음을 지닌다
                         ② 둘이 부딪친 사실 자체가 세계의 사건으로 남는다
                         ③ 이긴 판단과 진 판단이 둘 다 읽힌다
                         ④ (필요하면) 함께 들 수 없는 짝이 장착 단계에서 갈린다

    이 기능이 아닌 것     플레이어가 순위를 매기는 것이 **절대 아니다** (DC 가 금지한다)
                         전역 우선순위 표가 아니다 — 각 지식이 자기 것을 지닌다
                         조합이 아니다 — 맞물려 새것이 되는 것은 여섯째다

    이미 있는 것          앞의 둘이 세운 전투 의도와 그 사유. 그리고 세계가 사유 하나를
                         골라 내보내는 얼개 (C007 이래)

    Playable Result      기력을 아끼라는 지식과 지금 붙으라는 지식을 함께 들었을 때,
                         무엇이 이겼고 왜 이겼는지를 보고 다음 준비를 고칠 수 있다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-PREPARE-THE-RIGHT-KNOWLEDGE (전진 — 조합의 값어치가 여기서 선다)
    Missing / Partial    MC-CONDUCT-BY-KNOWLEDGE (첫째 Cycle 뒤 PARTIAL 로 예상되는 그 결손)
    Active Constraints   DC-KNOWLEDGE-CONFLICT-IS-DESIGNED · DC-KNOWLEDGE-IS-NOT-A-SCRIPT ·
                         DC-KNOWLEDGE-DECISION-IS-TRACEABLE
    Constraint Eval      SATISFIED — 우선순위를 지식이 지니고 플레이어가 매기지 않으며,
                         부딪친 사실과 결과가 읽힌다
    Observable Result    부딪친 두 지식 · 이긴 쪽 · 이긴 사유가 판단 기록에 실린다
    Why one Cycle        새 상태가 하나다 — 각 지식이 지니는 구체성. 판정은 그 값의 비교다
    Depends on           FR-YOU-CHOOSE-WHAT-TO-BRING — **둘 이상 들 수 없으면 부딪칠 수 없다**
    Status               PROPOSED

### FR-THE-WORLD-TEACHES-YOU — 겪은 것이 전투법이 된다

    CK 근거              §8 (획득원 열거) · §9 (발견 → 이해 → 습득) · §19 (성장의 근거는
                         실제 경험) · §29 (실패 역시 지식의 원천) · §41 (최종 플레이 루프)

    이것이 무엇인가      상대를 겪고 지켜본 것이 사실로 쌓이고, 그 사실이 충분해지면
                         그것을 상대하는 법이 하나의 전투법으로 생긴다

    세계에 생기는 것      ① 겪은 것이 그 몸에 사실로 남는다 (무엇을 몇 번 보았는가)
                         ② 사실이 어느 만큼 쌓이면 전투법 하나가 열린다
                         ③ **진 판도 재료다** — 쓰러진 자리에서도 본 것이 남는다
                         ④ 관찰: 지금 무엇을 알아 가는 중이고 얼마나 남았는가

    이 기능이 아닌 것     전수가 아니다 — 일곱째다
                         지식이 깊어지는 것이 아니다 — 다섯째다
                         메뉴에서 사는 것이 아니다 (DC 가 금지한다)
                         상대의 능력 규칙을 읽는 것 자체가 아니다 — 그것은 COMBAT 트랙의
                         `FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE` 이 먼저 세운다 (아래 주)

    이미 있는 것          "모르는 상태" 와 그것이 열리는 길 — 살펴봄(C014) · 통찰(C016) 의
                         가려짐 관문. **알게 되는 과정이라는 형태가 이미 세계에 있다**
                         상대의 배분과 방어 형태를 읽는 것 (C012 · C013 · C-COMBAT-001)
                         자율 존재의 되풀이되는 판단 (RULE-NPC-DECIDE-001) — 읽을 거리의 바닥

    Playable Result      처음에는 이유도 모르고 지던 상대를, 여러 판 겪은 뒤 그 상대를
                         상대하는 법을 얻어 다른 방식으로 상대한다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-LEARN-HOW-TO-FIGHT-IT (이 Cycle 로 크게 전진한다)
    Missing / Partial    MC-LEARN-COMBAT-KNOWLEDGE (MISSING) · MK-OPPONENT-ABILITY-RULE (ABSENT)
    Active Constraints   DC-KNOWLEDGE-HAS-A-WORLD-CAUSE · DC-KNOWLEDGE-HAS-NO-SINGLE-ANSWER ·
                         DC-GROWTH-PRINCIPLE-IS-PLAYED
    Constraint Eval      SATISFIED — 획득이 전부 세계 안의 사건이고, 얻지 못한 채로도
                         기본 능력으로 버틸 여지가 남는다
    Observable Result    알아 가는 중인 것과 남은 만큼이 보이고, 열린 순간이 사건으로 남는다
    Why one Cycle        새 상태가 둘이다 — 겪은 것의 누적과 그것이 여는 문턱
    Depends on           FR-WHAT-YOU-KNOW-FIGHTS-WITH-YOU — 배워서 얻을 것이 아무것도
                         하지 않으면 배우는 일이 뜻을 갖지 않는다
    Status               PROPOSED

    주 — 트랙 밖 의존 하나
                         CK §7.3 의 상대 지식(Enemy Knowledge)이 온전해지려면 상대에게
                         **읽을 규칙**이 있어야 하고, 그것은 COMBAT 트랙의
                         `FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE` 이 세운다.
                         **막지는 않는다** — 지금 세계의 자율 존재도 되풀이되는 판단을
                         지니므로(기력이 차면 큰 기술) 읽을 거리가 0 은 아니다.
                         다만 그 Cycle 뒤에 잡으면 배울 것이 훨씬 두꺼워진다

### FR-THE-SAME-KNOWLEDGE-GOES-DEEPER — 같은 전투법이 더 깊어진다

    CK 근거              §18 (기력 보존 I · II · III) · §19 (성장의 근거) · §20 (변형) ·
                         §21 (희소성은 숫자가 아니다)

    이것이 무엇인가      지닌 전투법을 쓰며 겪은 것이 쌓이면 그 전투법이 깊어진다 —
                         커지는 것은 효과가 아니라 **그것이 헤아릴 수 있는 세계 상태의 폭**이다

    세계에 생기는 것      ① 전투법에 깊이가 있다
                         ② 그것을 쓰며 겪은 것이 그 전투법에 쌓인다
                         ③ 깊어진 전투법이 이전에는 보지 않던 것을 판단에 넣는다
                         ④ 관찰: 지금 어느 깊이이고 무엇을 더 헤아리게 되었는가

    이 기능이 아닌 것     효과가 세지는 것이 아니다 (DC-GROWTH-REWARD-IS-NEW-REACH)
                         새 전투법을 얻는 것이 아니다 — 넷째다
                         갈라지는 성장(§20)은 이 Cycle 이 아니다 — 직선 하나로 닫는다

    이미 있는 것          쓴 것이 쌓여 무엇이 열리는 형태 — GROWTH 트랙의 후보가 같은
                         형태를 세운다 (`FR-WHAT-YOU-DID-MAKES-YOU`). **먼저 서는 쪽의
                         형태를 뒤가 재사용한다** (아래 트랙 간 주)

    Playable Result      같은 전투법을 오래 쓴 몸이, 이전에는 그냥 지나치던 상황에서
                         다른 판단을 낸다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-LEARN-HOW-TO-FIGHT-IT (전진)
    Missing / Partial    MC-DEEPEN-COMBAT-KNOWLEDGE (MISSING)
    Active Constraints   DC-GROWTH-REWARD-IS-NEW-REACH · DC-KNOWLEDGE-HAS-A-WORLD-CAUSE ·
                         DC-GROWTH-MASTERY-FROM-OWN-BEHAVIOR
    Constraint Eval      SATISFIED — 자라는 것이 헤아릴 수 있는 세계 상태이고,
                         그 지식을 쓰며 겪은 것만 센다
    Observable Result    깊이와, 그 깊이가 새로 헤아리는 것이 무엇인지가 읽힌다
    Why one Cycle        새 상태가 하나다 — 전투법마다의 깊이와 그것에 쌓인 경험
    Depends on           FR-THE-WORLD-TEACHES-YOU — 겪은 것이 쌓이는 얼개를 그것이 세운다
    Status               PROPOSED

### FR-TWO-KNOWINGS-MAKE-A-THIRD — 둘이 맞물려 새것이 열린다

    CK 근거              §33 (지식 조합 — 게임이 정의한 의미 있는 조합을 발견한다)

    이것이 무엇인가      함께 든 전투법 둘이 맞물려, 어느 하나만으로는 성립하지 않던
                         운용이 열린다. 맞물림은 세계가 미리 정해 두고 사람은 찾아낸다

    세계에 생기는 것      ① 함께 들었을 때만 성립하는 운용이 있다
                         ② 그 맞물림이 세계에 미리 정해져 있다
                         ③ 맞물린 순간이 사건으로 남고 그 사실이 보인다

    이 기능이 아닌 것     플레이어가 엮는 것이 아니다 (CK §33 마지막 줄 · DC 가 금지한다)
                         충돌의 반대말이 아니다 — 부딪치는 것과 맞물리는 것은 다른 관계다
                         모든 지식에 걸리는 성질이 아니다 — 일부에 설계로 부여된다

    이미 있는 것          앞의 것들이 세운 자리 · 판단 · 사유. 그리고 재료가 다른 것이 되는
                         형태 — 아이템 제작(MS-ITEM-SYSTEM 의 CRAFT 칸)이 같은 모양이다

    Playable Result      따로 쓰던 둘을 함께 들고 나갔더니 없던 수가 하나 열린다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-PREPARE-THE-RIGHT-KNOWLEDGE (전진 — 고르는 일에 깊이가 생긴다)
    Missing / Partial    MC-COMBINE-KNOWLEDGE (MISSING)
    Active Constraints   DC-KNOWLEDGE-IS-NOT-A-SCRIPT · DC-SKILL-COMBINE-BEFORE-NEW-FORM
    Constraint Eval      SATISFIED — 맞물림을 세계가 정하고 사람은 발견한다
    Observable Result    맞물린 짝과 그것이 연 것이 읽힌다
    Why one Cycle        새 상태가 하나다 — 어떤 짝이 무엇을 여는가의 표
    Depends on           FR-YOU-CHOOSE-WHAT-TO-BRING — 둘을 함께 들 수 없으면 맞물릴 수 없다
    Status               PROPOSED

### FR-SOMEONE-TAUGHT-YOU — 남에게서 배운다

    CK 근거              §22 (조직마다 싸우는 사고방식이 다르다) · §23 (전수 — 받은 것은
                         써 보기 전까지 온전하지 않다) · §24 (책으로도 전한다)

    이것이 무엇인가      한 몸이 지닌 전투법이 다른 몸에게 옮겨 간다. 받은 쪽은 배운 채로
                         시작하되 직접 써 보기 전까지는 온전하지 않다

    세계에 생기는 것      ① 전투법이 몸에서 몸으로 옮겨 가는 길이 있다
                         ② 받은 것과 겪어 얻은 것이 처음에는 다른 상태다
                         ③ 쓰면서 그 차이가 좁혀진다

    이 기능이 아닌 것     겪어서 배우는 것이 아니다 — 넷째다
                         조직·유파를 세우는 것이 아니다 — 그것은 세계 기반이다 (아래 주)

    이미 있는 것          관찰자가 둘 이상 들어올 수 있는 세계 (C004 이래 · 다중 관찰자)

    Playable Result      먼저 배운 사람이 다른 사람에게 전투법을 넘겨주고, 받은 쪽이
                         그것을 쓰면서 제 것으로 만든다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-LEARN-HOW-TO-FIGHT-IT (이 Cycle 로 그 갈래가 닫힐 수 있다 —
                         요구 여섯 중 마지막이다)
    Missing / Partial    MC-TEACH-COMBAT-KNOWLEDGE (MISSING)
    Active Constraints   DC-KNOWLEDGE-HAS-A-WORLD-CAUSE
    Constraint Eval      SATISFIED — 전수가 세계 안의 관계로 일어난다
    Observable Result    누가 누구에게 무엇을 전했는지, 받은 것이 아직 설익었는지가 읽힌다
    Why one Cycle        새 상태가 하나다 — 그 전투법이 겪어 얻은 것인가 받은 것인가
    Depends on           FR-THE-WORLD-TEACHES-YOU — 전할 것이 세계에서 생기는 길이 먼저다
    Status               PROPOSED

    주 — 지금은 사람끼리만 성립한다
                         세계에 가르치는 존재(스승 · 교관 · 유파)가 없다. 지금 이것을
                         세우면 **플레이어 사이의 전수**만 성립하며, 그것으로도 갈래는
                         닫힌다. NPC 사회가 서면 같은 얼개에 원천이 하나 더 붙는다

## 추천 순서 (Agent 제안 — 확정은 Human)

    1. FR-WHAT-YOU-KNOW-FIGHTS-WITH-YOU     이 층의 문 — 의존이 없는 유일한 것
    2. FR-YOU-CHOOSE-WHAT-TO-BRING          여기서 Build 가 성립한다
    3. FR-WHEN-TWO-ANSWERS-DISAGREE         둘을 들 수 있게 되면 곧바로 필요해진다
    4. FR-THE-WORLD-TEACHES-YOU             세계가 지식을 낳기 시작한다
    5. FR-THE-SAME-KNOWLEDGE-GOES-DEEPER
    6. FR-TWO-KNOWINGS-MAKE-A-THIRD
    7. FR-SOMEONE-TAUGHT-YOU                MP-LEARN-HOW-TO-FIGHT-IT 이 닫힌다

**첫째가 유일한 시작점인 근거는 하나다** — 나머지 여섯이 전부 "그것이 서면" 을 전제한다.
담을 자리도, 부딪침도, 배움도, 깊이도, 맞물림도, 전수도, **판단이 세계에 없으면 닿을 곳이
없다.** 그래서 이 트랙에는 고민할 순서가 없다: 문을 열거나 열지 않거나다.

**첫째가 CK 가 스스로 정한 검증과 정확히 겹친다.** §37 이 첫 구현 범위를 넷으로 적고
§38 이 검증 시나리오를 준다 — 같은 캐릭터에 아무것도 없을 때 · 「견고한 수호」를 끼웠을 때 ·
「기력 보존」을 끼웠을 때가 서로 명확하게 다르게 싸우면 1차 성공이다. 그 Cycle 의
Stage 8 이 쓸 검증이 이미 문서에 있다.

**둘째가 가장 값싸다.** 지닌 것과 적용된 것을 가르는 얼개가 C020~C026 으로 이미 다 섰고
(자리 · 넣고 빼기 · 한 자리 하나 · 바꿔 걸기 · 여는 표면), 대상만 물건에서 전투법으로
바뀐다. 새로 만드는 것이 가장 적은 후보다.

**넷째가 세계를 가장 크게 바꾼다.** 그때부터 전투와 탐험이 성장으로 직접 이어지고
(CK §41), 진 판이 손실이 아니라 재료가 된다. 다만 COMBAT 트랙의 조건 관문이 먼저 서면
배울 것이 훨씬 두꺼워진다 — 그 후보의 "주" 를 볼 것.

## SELECTED

```text
없음 — Human 선택 대기. 트랙이 방금 섰다.
```

## 지금 열 수 없는 것

이유가 사라지면 후보로 올린다. 트랙 밖(세계 기반 등)의 결손은 [README.md](README.md) 의
같은 절에 있다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| **상대 지식 계열의 온전한 형태** (CK §7.3 — 거대 악마 사냥법 · 용의 비늘 파훼법 류) | 상대에게 **읽을 규칙**이 없다. 적대 존재가 지닌 것은 되풀이되는 판단 하나뿐이고(RULE-NPC-DECIDE-001), 조건으로 여닫히는 능력이 없다. COMBAT 트랙의 `FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE` 이 그것을 세운다. **넷째 후보를 막지는 않는다** — 얇게라도 읽을 거리가 0 은 아니다 |
| 갈라지는 지식 성장 (CK §20 — 중검 대응 · 쌍검 대응 …) | 직선 깊이(다섯째 후보)가 먼저다. 그리고 갈라질 대상이 여럿이려면 무기·상대의 종류가 지금보다 두꺼워야 한다 |
| 조직 · 유파가 지식의 원천이 되는 것 (CK §22) | 세계에 조직도 NPC 사회도 없다 (overlay.md World 표 ABSENT). 그것이 서기 전에는 일곱째 후보가 사람끼리의 전수로만 성립한다 |
| 책 · 비전서로 배우기 (CK §24) | 막는 것은 없다 — 아이템 얼개가 다 섰으므로 종류 하나를 더하는 것으로 시작한다. 다만 **아직 어느 갈래도 이것을 요구하지 않는다** (7 조건 2). 넷째·일곱째가 선 뒤 원천을 늘릴 때 온다 |
| 지식을 잃는 일 (CK §36 — 기억 봉인 · 정신 손상) | 요구하는 Possibility 가 없다 (7 조건 2). 그리고 문서 자신이 "특수 상황" 으로만 둔다 |
| 자율 존재가 자기 전투 지식으로 싸우는 것 (CK §35) | **막는 것은 없으나 이 트랙의 것이 아닐 수 있다** — 자율 행동의 기반은 별도 기획이 소유하기로 정해졌다 (Q62). 첫째 후보의 얼개를 자율 존재에도 걸 수 있으나, 어디까지가 지식이고 어디부터가 습성인지는 그 문서가 정한다 |

**후보로 올리지 않은 결손 하나**: 무엇이 올지 미리 아는 길(MK-LOCAL-WORLDSTATE)이 없다.
둘째 후보(고르기)가 온전한 준비 플레이가 되려면 들어가기 전에 알려진 위협을 알아야 하는데
(CK §27), 그것은 지역이 있어야 성립하므로 TERRAIN 트랙과 세계 기반의 몫이다.
**둘째를 막지는 않는다** — 겪어 본 상대에 대해서는 고르는 일이 이미 성립한다.
