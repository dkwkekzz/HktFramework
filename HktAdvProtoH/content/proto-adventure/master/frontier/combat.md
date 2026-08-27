# Frontier — COMBAT 트랙

전투(R1 · DT · UL) · 스킬(SK) 도메인의 후보와 지금 도는 것을 담는다. 트랙 규칙과 트랙 간
판단은 [README.md](README.md), 읽는 법은 guides/master-frontier.md 소유다.

    기준 Overlay   master/overlay.md — 전투 사다리는 Critical 층까지, 그 위에 고른
                   대상(C017) · 태도(C018) · 행동 안의 시점(C019) · 휘두름의 모양(C025) ·
                   힘의 배분(C-COMBAT-001)이 얹혔다. 스킬(SK) · 전투 상층(UL) 주입 반영.
                   **`C-COMBAT-003`(조건 관문) · `C-COMBAT-004`(표식)는 아직 반영 전이다** —
                   그 둘의 MASTER FEEDBACK 이 미처리다 (`npm run feedback:gate`)

## 한눈에 보기

다섯이다. 사슬 하나만 남았다 — **UL 이 세운 것 중 능동 대응 사슬(넷)은 이 트랙에 없다.**
아래 "지금 열 수 없는 것" 의 첫 줄이 그 사유를 지닌다.

    사슬 B — 능력이 규칙이 된다
    THE-WORLD-DECIDES-WHAT-IS-POSSIBLE
      ↓
    WHAT-YOU-LEAVE-ON-THEM
      ↓
    A-PROMISE-BINDS-BOTH
      ↓
    KNOW-WHAT-THEY-CAN-DO
      ↓
    TAKE-AWAY-WHAT-THEY-CAN-DO

`Depends on` 이 빈 것과 그 앞이 이미 닫힌 것만 지금 고를 수 있다 — **앞의 둘이 닫혔으므로
지금은 셋째 하나다.** 나머지는 자리를 잡아 두는 것이며, 그래야 이 층 전체가 어디로 가는지가
한 화면에서 보인다.

**셋째가 눈에 띄게 크다** — 계약과 묶음을 쪼갤 수 없는 사유는 그 후보의 `Why one Cycle` 이
지닌다. 고르기 전에 그것을 읽는 것을 권한다.

## 후보

### FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE — 세계가 무엇이 가능한지를 정한다

    UL 근거              §17 (Trigger) · §18 (Requirement) · §19 (Condition) ·
                         §33 (관찰 가능한 Combat State) · §35 (설명 가능한 결과) · §42 F5

    이것이 무엇인가      능력이 지금 가능한가가 **세계의 사실**로 갈린다. 상대가 나를 먼저
                         쳤는가, 내 생명이 절반 아래인가 같은 것이 능력의 관문이 되고,
                         못 쓸 때는 그 사유가 함께 보인다

    세계에 생기는 것      ① 능력마다 "지금 가능한가" 가 세계 상태에서 계산된다
                         ② 불가능하면 그 사유가 하나 드러난다 — 무엇이 참이 아니어서인가
                         ③ 사정은 **목록**이다 — 항목을 더해도 관문과 관찰이 바뀌지 않는다
                         ④ 조건이 참인 동안에만 강화된 결과가 나온다

    이 기능이 아닌 것     확률이 아니다 — 가능 여부가 주사위로 갈리면 이 개념이 아니다
                         조건이 겹칠수록 결과가 커지는 것이 아니다 — 그것은 크기의 문제이고
                         (MC-CONDITION-STACKING) 이것은 가능의 문제다
                         조건이 연 것을 기록하는 것이 아니다 — 조건이 사라지면 저절로 닫힌다
                         표식이 아니다 — 대상에 무언가를 남기는 것은 다음 후보다
                         계약이 아니다 — 스스로 거는 제약과 그 대가는 그다음이다

    이미 있는 것          못 쓰는 사유를 세계가 골라 **하나** 내보내는 자리 —
                         `view/skill-presentation.ts` 의 `unavailableReason`, 인벤토리·장비도
                         같은 칸을 쓴다 (`inventory-presentation.ts` · `equipment-presentation.ts`)
                         사정을 목록으로 두고 판정이 그것을 읽기만 하는 선례 —
                         `world/semantic/relation.ts` 의 `HOSTILITY_REASONS` (C018).
                         **저장하지 않고 지금의 사실에서 유도한다**는 성질까지 같다
                         조건에서 매번 다시 계산하는 규칙 (DC-CONDITION-OPENS-WITHOUT-RECORDING · C016)

    Playable Result      Player 가 어떤 기술을 쓰려 할 때 "상대가 아직 나를 치지 않았다" 처럼
                         세계의 사실 때문에 막히고, 그 사실이 참이 되는 순간 쓸 수 있게 된다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-BIND-BY-CONTRACT · MP-KNOW-THE-OPPONENT-RULE
    Missing / Partial    MC-ABILITY-CONDITION (PARTIAL — 사유를 내보내는 자리는 있으나
                         그 원천이 전부 자기 조건이다)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-UNAVAILABLE-HAS-A-REASON ·
                         DC-CONDITION-OPENS-WITHOUT-RECORDING · DC-COMBAT-ABILITY-IS-A-RULE
    Constraint Eval      SATISFIED — 조건이 확률이 아니라 세계 상태이고, 못 쓰는 사유가
                         함께 나오며, 조건이 연 것을 기록하지 않고, 능력이 규칙의 형태를
                         갖기 시작한다 (Q61(a) 가 과거 사건을 보는 조건도 경계 안이라 정했다)
    Observable Result    같은 기술이 같은 자원으로도 세계의 사실에 따라 되고 안 되며,
                         안 될 때 그 사유 코드가 관찰에 실린다
    Why one Cycle        새 상태가 없다 — 조건은 이미 있는 세계 사실에서 계산된다.
                         느는 것은 사정 목록의 항목과 그것을 읽는 관문 하나다
    Depends on           없음 — 다만 첫 조건이 무엇을 볼지는 그 Cycle 의 Stage 1 이 고른다.
                         "상대가 나를 먼저 쳤는가" 는 지금 세계에서 이미 판정 가능하다
    Status               DONE — `C-COMBAT-003` COMPLETE (2026-08-27).
                         **Overlay 반영은 아직이다** — 그 Cycle 의 MASTER FEEDBACK 이
                         미처리이며 병합 뒤 최신 main 위에서 돈다 (feedback:gate)

### FR-WHAT-YOU-LEAVE-ON-THEM — 상대에게 남긴 것이 다음을 바꾼다

    UL 근거              §22 (관계 — Mark) · §18 ("Target 에 Mark 존재") ·
                         §30 · §40 (표식은 세계에서 보인다) · §42 F7

    이것이 무엇인가      대상에게 표식을 남겨, 이후의 판정이 그 표식을 보고 달라지게 한다.
                         표식 자체는 피해를 넣지 않는다 — 다음에 올 것의 자리를 만든다

    세계에 생기는 것      ① 대상에 붙는 표식이 세계의 사실로 존재한다
                         ② 그것이 붙어 있다는 것이 **양쪽 모두에게** 보인다
                         ③ 이후의 판정이 그 표식의 유무로 달라진다
                         ④ 표식은 건 시각에서 계산되어 저절로 닫힌다 (Q61(a))

    이 기능이 아닌 것     지목이 아니다 — 지목(MC-DESIGNATE-TARGET)은 **내가 지금 누구를
                         보는가**이고 언제든 옮겨진다. 표식은 **그 대상에 남은 것**이고
                         내가 다른 곳을 봐도 남아 있다
                         태도가 아니다 — 태도(C018)는 둘 사이의 값이고 표식은 대상에 붙는다
                         지속 피해가 아니다 — 표식 자체는 아무것도 하지 않는다
                         쌓이는 것이 아니다 — 겹칠수록 커지는 것은 다른 개념이다

    이미 있는 것          존재 사이의 값을 지금의 사실에서 유도하고 저장하지 않는 얼개 —
                         `world/semantic/relation.ts` (C018). 다만 그것은 **거는 쪽**의
                         상태이고, 걸린 쪽에 붙는 것은 세계에 아직 없다
                         관찰자별로 무엇이 보이는지를 가르는 얼개 —
                         `world/semantic/acquaintance.ts` (C014 · C016)
                         앞 후보가 세운 조건 관문 — 표식은 그 관문이 읽는 첫 세계 사실이 된다

    Playable Result      Player 가 표식을 남긴 상대에게만 되는 기술이 생기고, 표식이 붙은
                         상대는 자기에게 무엇이 붙었는지 보고 물러날지 밀어붙일지 고른다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-BIND-BY-CONTRACT
    Missing / Partial    MC-MARK (MISSING)
    Active Constraints   DC-COMBAT-ABILITY-IS-A-RULE · DC-COMBAT-UNAVAILABLE-HAS-A-REASON ·
                         DC-CONDITION-OPENS-WITHOUT-RECORDING · DC-COMBAT-ONE-FORMULA
    Constraint Eval      SATISFIED — 피해가 아닌 세계 조작이고, 표식이 없어 못 쓰는 것도
                         사유로 읽히며, 건 시각에서 재계산하고, 피해 공식을 건드리지 않는다
    Observable Result    표식이 붙은 상대와 붙지 않은 상대에게 같은 기술이 다르게 작동하고,
                         그 차이의 원인이 표식으로 경위에 남는다
    Why one Cycle        새 상태가 하나다 — 누가 누구에게 언제 표식을 남겼는가
    Depends on           FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE — 표식을 읽을 관문이 먼저다.
                         관문 없이 표식만 있으면 아무것도 달라지지 않는다.
                         **그 관문이 섰다** (`C-COMBAT-003` COMPLETE) — 의존이 풀렸다
    Status               DONE — `C-COMBAT-004` COMPLETE (2026-08-27).
                         **Overlay 반영은 아직이다** — 그 Cycle 의 MASTER FEEDBACK 이
                         미처리이며 병합 뒤 최신 main 위에서 돈다 (feedback:gate)

### FR-A-PROMISE-BINDS-BOTH — 스스로 건 약속이 둘을 묶는다

    UL 근거              §20 (Contract 는 Capability 를 허락받는 대가다) ·
                         §21 (Restriction → Permission → Violation) ·
                         §23 (Chain Bind — 이 층의 대표 실물) · §24 (Counterplay) · §42 F6 · F7

    이것이 무엇인가      스스로 제약을 걸고, 그 대가로 평소에는 허락되지 않는 조작 —
                         상대를 묶어 움직임의 범위를 줄이는 것 — 을 허락받는다.
                         제약을 어기면 묶음이 즉시 풀린다

    세계에 생기는 것      ① 스스로 거는 제약이 세계의 사실로 존재하고 양쪽에게 보인다
                         ② 그 제약을 지는 동안에만 되는 조작이 있다
                         ③ 두 존재를 잇는 것이 세계에 실체로 있고, 그동안 상대의 행동 범위가
                            실제로 좁아진다
                         ④ 제약을 어기면 즉시 대가를 치른다 — 묶음이 풀린다
                         ⑤ 상대에게 푸는 길이 최소한 하나 있다 (실체 파괴 · 거는 쪽을 움직이게
                            하기 · 계약 위반 유도 — UL §24)
                         ⑥ 걸린 쪽에 "왜 움직일 수 없는가" 가 사유로 보인다

    이 기능이 아닌 것     수치 교환이 아니다 — 생명을 깎아 피해를 사는 형태로 만들지 않는다
                         (DC-COMBAT-CONTRACT-BUYS-CAPABILITY)
                         묶는 동안 상대가 아무것도 못 하는 것이 아니다 — 범위가 줄 뿐이고
                         푸는 길이 있다
                         멈춰 세우는 것이 아니다 — 끊기(MC-INTERRUPT)와 밀기(MC-FORCE-MOVEMENT)는
                         한 번의 사건이고 이것은 지속하는 관계다
                         피해를 넣는 기술이 아니다 — 피해가 0 이어도 성립해야 한다

    이미 있는 것          앞 후보들이 세운 조건 관문과 표식. 그리고 존재 사이의 값을
                         지금의 사실에서 유도하는 얼개 (`world/semantic/relation.ts` · C018)
                         못 쓰는 사유를 내보내는 자리 · 계산 경위를 싣는 자리
                         **묶는 실체와 행동 범위 제한은 세계에 없다** — 이 후보가 세운다

    Playable Result      Player 가 "이 싸움에서 다른 존재를 치지 않는다" 를 걸고 상대를
                         묶어 그 자리에서 벗어나지 못하게 만들 수 있고, 다른 적이 덤벼
                         손을 대는 순간 묶음이 풀린다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-BIND-BY-CONTRACT — **이 후보로 그 갈래가 닫힌다**
    Missing / Partial    MC-VOW (MISSING) · MC-BIND (MISSING)
    Active Constraints   DC-COMBAT-CONTRACT-BUYS-CAPABILITY · DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY ·
                         DC-COMBAT-ABILITY-IS-A-RULE · DC-COMBAT-UNAVAILABLE-HAS-A-REASON ·
                         DC-COMBAT-PLAYER-CAUSALITY
    Constraint Eval      SATISFIED — 제약이 사는 것이 수치가 아니라 조작이고, 푸는 길이
                         셋 있으며, 피해 없이 성립하고, 왜 못 움직이는지가 사유로 드러나며,
                         성립·위반을 세계가 판정한다
    Observable Result    묶인 상대의 움직임이 실제로 좁아지고, 계약을 어긴 순간 묶음이
                         풀리며, 그 인과가 경위에서 되짚어진다
    Why one Cycle        **쪼개지 않았다** — 계약과 묶음은 개념이 둘이지만 어느 쪽도 혼자
                         서지 못한다. 계약만 세우면 허락할 조작이 없어 수치 교환으로 흐르고
                         (DC-COMBAT-CONTRACT-BUYS-CAPABILITY 가 막는 바로 그 형태),
                         묶음만 세우면 대가 없는 강제 조작이 되어
                         DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY 가 요구하는 대응 지점이
                         사라진다. **이 후보가 다른 것보다 크다는 것을 Human 이 알고
                         골라야 한다** (guides/master-frontier.md Do 6 — 쪼갤 수 없으면
                         사유를 적고 Human 판단으로 넘긴다)
    Depends on           FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE · FR-WHAT-YOU-LEAVE-ON-THEM
                         **둘 다 섰다** (`C-COMBAT-003` · `C-COMBAT-004` COMPLETE) —
                         의존이 풀렸다. 조건 관문도 표식도 세계에 있다
    Status               PROPOSED — **지금 의존이 빈 유일한 후보다**

### FR-KNOW-WHAT-THEY-CAN-DO — 상대의 규칙을 알아낸다

    UL 근거              §25 (정보가 전투 자원이 된다) · §26 (기록술사) · §29 (사냥꾼) ·
                         §39 (PvP — 내가 아는 상대의 규칙) · §42 F7

    이것이 무엇인가      상대의 능력을 겪거나 지켜보아 그 규칙을 단계적으로 알아 간다 —
                         이름 · 종류 · 성립 조건 · 걸린 계약 · 대응책 순으로, 인지에
                         몰아 둘수록 더 깊이 읽힌다

    세계에 생기는 것      ① 자율 존재가 규칙 있는 능력을 하나 지닌다 (조건 · 대가 · 대응책)
                         ② 그 규칙이 처음에는 가려져 있다
                         ③ 겪거나 지켜본 만큼 단계적으로 드러난다
                         ④ 인지에 얼마나 몰았는가가 드러나는 깊이를 가른다
                         ⑤ 알아낸 것이 다음 싸움에도 남는다

    이 기능이 아닌 것     살펴봄(MC-OBSERVE)의 확장이 아니다 — 그쪽은 그 존재가 **지금 어떤
                         상태인가**를 읽고, 이쪽은 그 존재가 **가진 규칙**을 읽는다
                         약점 찾기(MC-DISCOVER-WEAKNESS)가 아니다 — 그쪽은 어디가 무른가이고
                         이쪽은 무엇이 그 능력을 성립시키는가다
                         봉인이 아니다 — 알아낸 것으로 무엇을 하는지는 다음 후보다
                         전부를 보여 주는 것이 아니다 — 단계가 있고, 대가를 치러야 깊어진다

    이미 있는 것          **관찰자별로 단계적으로 자리가 열리는 앎의 장부가 이미 있다** —
                         `world/semantic/acquaintance.ts` (C014 · C016). 담는 것이 Id 뿐이고,
                         값을 베끼지 않으며, 관찰자마다 다르고, 통찰이 연 것은 기록하지
                         않는다는 성질까지 이 후보가 필요로 하는 것과 같다
                         인지에 걸리는 값 `insight` (C016) · 배분(앞 후보가 서면 그 축)
                         **자율 존재의 규칙 있는 능력은 없다** — 이 후보가 하나 세운다

    Playable Result      Player 가 적의 능력을 처음에는 이름만 알다가, 겪고 살펴본 뒤
                         그 능력이 언제 성립하는지와 무엇으로 풀리는지까지 알게 되고,
                         그 앎으로 다음 싸움을 다르게 시작한다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-KNOW-THE-OPPONENT-RULE
    Missing / Partial    MC-OBSERVE-ABILITY (MISSING)
    Active Constraints   DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY · DC-COMBAT-UNAVAILABLE-HAS-A-REASON ·
                         DC-COMBAT-ABILITY-IS-A-RULE · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — 이 후보가 "대응책이 발견 가능해야 한다" 의 실물이고,
                         아직 모르는 것이 가려져 있다는 사실 자체가 드러나며,
                         상대의 능력도 같은 규칙 형태를 쓰고, 무엇이 보이는지는 세계가 정한다
    Observable Result    같은 적을 두 사람이 봐도 아는 깊이가 다르고, 알게 된 자리가
                         관찰에 실리며, 모르는 자리는 가려진 것으로 보인다
    Why one Cycle        새 상태가 하나다 — 관찰자별로 어느 능력의 어느 자리까지 알았는가.
                         기존 앎의 장부와 같은 모양이다
    Depends on           FR-A-PROMISE-BINDS-BOTH — 알아낼 대상이 있으려면 규칙 있는 능력의
                         형태(조건 · 대가 · 대응책)가 먼저 세계에 서야 한다
                         FR-WHERE-YOUR-POWER-SITS — 인지 배분이 깊이를 가른다
    Status               PROPOSED

### FR-TAKE-AWAY-WHAT-THEY-CAN-DO — 상대가 가진 것을 못 쓰게 만든다

    UL 근거              §22 (Skill — Seal) · §26 (기록한 것만 봉인할 수 있다) ·
                         §24 (봉인의 대응책 — 멀어지면 풀린다) · §42 F7

    이것이 무엇인가      상대가 가진 능력 하나를 성립하지 않게 만든다. 피해를 넣는 것이
                         아니라 그 능력이 지금부터 작동하지 않게 하는 것이다

    세계에 생기는 것      ① 남이 걸어 둔 것 때문에 못 쓰는 자리가 처음으로 생긴다
                         ② 봉인된 쪽에 그 사유가 보인다 — 자기 조건이 아니라 남 때문이다
                         ③ 푸는 길이 최소한 하나 있다 (UL §24 — 건 쪽에서 멀어지면 풀린다)
                         ④ 아무거나 봉인할 수 없다 — 알아낸 것만 봉인할 수 있다 (UL §26)

    이 기능이 아닌 것     행동을 끊는 것이 아니다 — 끊기(MC-INTERRUPT)는 지금 하려는 한
                         동작을 막고, 이것은 그 능력 자체를 당분간 없는 것으로 만든다
                         묶는 것이 아니다 — 묶음은 움직임의 범위이고 이것은 할 수 있는 일이다
                         피해를 늘리는 것이 아니다
                         영구적이지 않다 — 풀리는 길과 끝이 있다

    이미 있는 것          앞 후보가 세운 능력 관찰과 규칙 있는 능력. 조건 관문과 사유 코드.
                         지금 세계에서 못 쓰는 사유는 전부 **자기 조건**이다 (자원 · 거리 ·
                         장착) — 남이 건 것 때문에 못 쓰는 자리가 이 후보로 처음 생긴다

    Playable Result      Player 가 적의 그 무서운 기술 하나를 봉인해 한동안 쓰지 못하게
                         만들고, 적은 그 사유를 보고 Player 에게서 멀어져 봉인을 푼다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-KNOW-THE-OPPONENT-RULE — **이 후보로 그 갈래가 닫힌다**
    Missing / Partial    MC-DISRUPT-ABILITY (MISSING)
    Active Constraints   DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY · DC-COMBAT-UNAVAILABLE-HAS-A-REASON ·
                         DC-COMBAT-ABILITY-IS-A-RULE · DC-CONDITION-OPENS-WITHOUT-RECORDING
    Constraint Eval      SATISFIED — 푸는 길이 있고, 봉인이 사유로 드러나며, 피해가 아닌
                         세계 조작이고, 봉인을 건 시각에서 재계산한다.
                         대응책의 **형태**는 UL §24 가 예로만 들었으므로 그 Cycle 의 Stage 3 이 고른다
    Observable Result    봉인된 능력이 회색으로 보이되 그 사유가 "누가 언제 걸었는가" 로
                         읽히고, 조건이 사라지면 별도 규칙 없이 다시 쓸 수 있게 된다
    Why one Cycle        새 상태가 하나다 — 누가 누구의 어느 능력을 언제 봉인했는가.
                         표식과 같은 모양이다
    Depends on           FR-KNOW-WHAT-THEY-CAN-DO — 알아낸 것만 봉인할 수 있다 (UL §26)
    Status               PROPOSED

### FR-TAKE-WHAT-MAKES-THEM-STRONG — 상대를 이루는 것을 빼앗는다

    이것이 무엇인가      상대가 유한하게 가진 것이 **이쪽으로 옮겨 온다**. 상대는 그만큼
                         줄고 나는 그만큼 는다 — 격차가 한쪽이 아니라 양쪽에서 좁는다
    세계에 생기는 것      ① 상대가 가진 것이 옮길 수 있는 것으로 존재한다 (지금은 자기 것만
                            자기가 쓴다)
                         ② 빼앗는 행동이 있고, 빼앗은 만큼 두 몸의 값이 반대로 움직인다
                         ③ 빼앗긴 쪽이 실제로 이전만큼 하지 못한다 — 값만 줄고 행동이
                            그대로면 이 후보가 실패한 것이다
                         ④ 관찰: 무엇이 얼마나 옮겨 갔는지가 **양쪽 모두에게** 보인다
    이 기능이 아닌 것     받아낸 것을 저장하는 일이 아니다 (MC-ABSORB — 저쪽은 맞아야 벌고
                         상대에게서 아무것도 덜어내지 않는다) · 피해가 아니다 — 생명을 깎지
                         않고도 성립한다 · 능력을 못 쓰게 만드는 일이 아니다
                         (MC-DISRUPT-ABILITY 는 Target 이 아니다) · 표식을 남기는 일이
                         아니다 (MC-MARK) · 새 피해 공식이 아니다 —
                         기존 식이 읽는 **입력값**을 옮길 뿐이다
    이미 있는 것         **코드 대조.** 몸이 유한한 자원을 지닌다 —
                         `world/semantic/actor.ts` 의 `hp` · `cp` 와 능력치 여덟 ·
                         유효 값이 저장되지 않고 매번 다시 세어진다 —
                         `world/semantic/combat.ts#effectiveStat` (C023 · C-COMBAT-001) ·
                         **무언가가 dt 로 몸에서 값을 빼 가는 규칙이 이미 돈다** —
                         `world/simulation/ground-law-apply.ts` (땅이 거두어 간다 ·
                         C-TERRAIN-001). 빼앗기는 그 형태의 상대 있는 판이다 ·
                         계산 경위가 끝까지 읽힌다 (MC-COMBAT-CAUSE-READING · C010~C015)
    Playable Result      Player 가 상대에게 붙어 열을 빼앗아, 자기 값이 오르는 동시에 상대의
                         공격이 눈에 띄게 무뎌지는 것을 본다 — 한 방도 더 때리지 않고 격차가
                         뒤집힌다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-TAKE-WHAT-MAKES-IT-STRONG
    Missing / Partial    MC-DRAIN (MISSING · `grounded: true`)
    Active Constraints   DC-COMBAT-ONE-FORMULA · DC-COMBAT-ABILITY-IS-A-RULE ·
                         DC-COMBAT-SHARED-BUDGET · DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY ·
                         DC-GROWTH-NO-DOMINATED-ROUTE · DC-COMBAT-PLAYER-CAUSALITY
    Constraint Eval      ONE-FORMULA: SATISFIED — 새 식을 만들지 않는다. 기존 식이 읽는
                         입력값이 두 몸 사이를 옮겨 갈 뿐이다
                         ABILITY-IS-A-RULE: SATISFIED — 피해가 0 이어도 성립하는 조작이다
                         SHARED-BUDGET: UNRESOLVED — 빼앗은 것이 기존 기력 예산으로 들어오는지
                         따로 담기는지는 03 이 정한다. **새 게이지를 만들면 위반이다**
                         STRONG-RULE-HAS-COUNTERPLAY: SATISFIED — 거리를 유지하고 빼앗길 것을
                         주지 않는 것이 대응이며, 빼앗김이 양쪽에 보이므로 발견 가능하다
                         NO-DOMINATED-ROUTE: SATISFIED — 닿거나 곁에 있어야 하므로 원거리
                         갈래를 압도하지 않는다
                         PLAYER-CAUSALITY: SATISFIED — 확률이 개입하지 않는다
    Observable Result    빼앗기 전후로 **두 몸의 값이 반대로** 움직이고, 무엇이 얼마나
                         옮겨 갔는지가 계산 경위에 그대로 남는다
    Why one Cycle        옮길 값도, 그 값을 매번 다시 세는 자리도, 값을 dt 로 빼 가는 규칙도
                         이미 있다. 새로 서는 것은 **뺀 것을 상대가 아니라 나에게 넣는다**
                         하나이며, 나머지는 그 하나의 결과다
    의존                 없음 — 이 후보만으로 성립한다. **조건 관문은 이미 섰으므로**
                         (C-COMBAT-003) "빼앗을 것이 남았는가" 를 조건으로 곧바로 쓸 수 있다
    Status               PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

    1. FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE  ← DONE (C-COMBAT-003) · 사슬 B 의 바닥.
                                           **직전 Cycle 이 남긴 절반을 닫는다** —
                                           배분이 값만 바꾸고 무엇을 할 수 있는가의
                                           목록을 바꾸지 않는 것이 MC-AURA-ALLOCATION 의
                                           남은 결손이고, 그 관문이 여기다
    2. FR-WHAT-YOU-LEAVE-ON-THEM           ← DONE (C-COMBAT-004) · 표식이 섰다
    3. FR-A-PROMISE-BINDS-BOTH             ← 지금 의존이 빈 유일한 후보 ·
                                           MP-BIND-BY-CONTRACT 가 닫힌다 · 가장 크다
    4. FR-KNOW-WHAT-THEY-CAN-DO
    5. FR-TAKE-AWAY-WHAT-THEY-CAN-DO       MP-KNOW-THE-OPPONENT-RULE 이 닫힌다
    6. FR-TAKE-WHAT-MAKES-THEM-STRONG      **Q71(b) 확장으로 새로 열렸다.** 의존이 빈
                                           둘 중 하나이며, 열다섯 갈래 중 유일하게
                                           격차를 양쪽에서 좁힌다. 값이 싸다 — 옮길 값도
                                           다시 세는 자리도 빼 가는 규칙도 이미 있다

**지금 의존이 빈 것은 셋째와 여섯째다.** 앞의 둘이 닫히면서 조건 관문과 표식이 세계에 섰고,
계약(3)은 그 둘 위에 서는 첫 후보다. 그리고 **그것으로 `MP-BIND-BY-CONTRACT` 가 닫힌다** —
요구 넷 중 둘이 이미 섰으므로 남은 `MC-VOW` · `MC-BIND` 를 그 하나가 함께 세운다.
여섯째(빼앗기)는 Q71(b) 확장으로 새로 섰고 아무것도 기다리지 않는다.

**여섯째가 이 트랙에서 가장 싸다.** 셋째(계약)가 갈래 하나를 통째로 닫아 값이 크므로
추천은 3 이지만, 작게 한 바퀴를 돌고 싶다면 6 이 그 자리다 — 새 판정도 새 게이지도
만들지 않고 이미 도는 규칙의 방향만 상대 있는 판으로 바꾼다.

**3 이 눈에 띄게 크다.** 계약과 묶음을 쪼갤 수 없는 사유는 그 후보의 `Why one Cycle` 에
적혀 있다 — 계약만 세우면 허락할 조작이 없어 수치 교환으로 흐르고, 묶음만 세우면 대가 없는
강제 조작이 된다. 고르기 전에 그것을 읽는 것을 권한다.

**그리고 고르기 전에 알아야 할 것이 둘 더 있다** (C-COMBAT-004 의 MASTER FEEDBACK).

    키 자리가 바닥났다        글자 키가 남지 않았다 — `O`(003) · `P`(004) 로 끝.
                            계약은 조작이 둘 이상일 수 있으므로 **키 없는 기술**을
                            세우게 된다. 막힘은 아니다 (띠는 눌러서도 부른다) —
                            `works/BACKLOG.md` 의 `skill-slot-crowds-the-keyboard` 가
                            VIEW/ENGINE 레인에서 그 자리를 기다린다
    자율 존재가 두 번 걸렸다   003 은 배분에 몰지 않아, 004 는 고르지 않아 관문을 못 지났다.
                            규칙의 구멍이 아니라 **판단 구조의 미개방**이며 둘 다 같은
                            문서를 기다린다 (`Design-Creature-Behavior-R0` — HUMAN 대기).
                            남은 셋(계약 · 규칙 관찰 · 봉인)이 전부 "상대가 무엇을 하는가"
                            를 전제하므로, 그 문서가 서지 않으면 **반쪽만 검증되는 층**을
                            쌓게 된다

**UL §42 의 F8(각 캐릭터가 하나의 전투 정체성을 갖는다)은 후보가 아니다** — 새 능력이
아니라 앞의 것들이 다 선 뒤의 **조합**이기 때문이다. 마찬가지로 §43 의 검증용 캐릭터
3종도 후보가 아니라 검증 묶음이다 (문서가 스스로 그렇게 부른다). 그중 수호자는
Q60(c) 로 빠졌으므로 관찰자와 묶는 자 둘로 검증한다.

## SELECTED

```text
없음 — Human 선택 대기
```

    의존이 빈 것은 `FR-A-PROMISE-BINDS-BOTH` 하나다 (위 "추천 순서").
    그 후보는 **다른 것보다 크며**, 그것을 알고 고르는 것이 Human 의 몫이다
    (guides/master-frontier.md Do 6).

    직전 반영 경위: [../feedback/C-COMBAT-001-where-your-power-sits.md](../feedback/C-COMBAT-001-where-your-power-sits.md)
    `C-COMBAT-003` · `C-COMBAT-004` 의 MASTER FEEDBACK 은 **둘 다 미처리다** —
    병합 뒤 최신 main 위에서 FEEDBACK 레인이 받는다 (`npm run feedback:gate`).

    사슬 A 로 열었던 `C-COMBAT-002` 는 Stage 5 앞에서 **철회됐다** (Human · 2026-08-27).
    경위는 master/HISTORY.md "사슬 A 철회" 가 지닌다.

## 지금 열 수 없는 것

이유가 사라지면 후보로 올린다. 사유의 근거는 괄호의 자리가 소유한다.
트랙 밖(세계 기반 · 설계 문서 부재 등)의 결손은 [README.md](README.md) 의 같은 절에 있다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| **능동 대응 사슬** (UL §4 · §5 · §6 · §7 · §8 · §42 F1~F3 — Active Response · Response Window · Perfect Guard · Counter · Evade) | **막는 것이 아니라 자리가 옮겨졌다** (Human · 2026-08-27 · Q63). 플레이어가 특정 시점에 맞춰 눌러 막는 층은 세우지 않는다 — 대응은 **캐릭터가 배운 전투 지식**이 운용한다 (`Design-Combat-Knowledge-Extension-R0.md` §15: "숙련은 Response 버튼 추가가 아니라 Response를 사용하는 지능의 증가다"). **그 층의 형태 자체는 UL 이 그대로 소유한다** — 노드 넷(MC-ACTIVE-RESPONSE · MC-PRECISION-RESPONSE · MC-PERFECT-GUARD · MC-COUNTER)은 한 글자도 고치지 않았다. 다시 들어오는 자리는 [knowledge.md](knowledge.md) 다 |
| **수호 · 대상 이전** (UL §4.2 · §9 · §27 — Intercept · Redirect · Retarget · Protect) | 세계에 아군이 없다. Actor 가 플레이어와 적대 존재 둘뿐이라 요구하는 갈래를 만들 수 없고, 그래서 Capability 자체를 세우지 않았다. **Q60(c) 로 미루기로 정해졌다** — 아군을 세울 때는 사람을 지어내지 말고 세계의 존재(길들인 것 · 구조 대상 · 다른 플레이어)로 받는다 (HISTORY) |
| 자세 유지 (MC-FORTIFY) | `part_of.grounded: false` — UL 은 배분을 **유지하는 비용**을 말하지 않는다. R1 이 이름만 댄 부분이라 후보의 Target 이 되지 않는다 (guides/master-frontier.md MUST NOT). 배분(C-COMBAT-001)이 서면 그 위에서 다시 본다 |
| 조건이 겹칠수록 커진다 (MC-CONDITION-STACKING PARTIAL) | 어느 갈래도 지금 이것의 결손을 필요로 하지 않는다 (7 조건 2). 조건 관문(FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE)이 서면 그 위에서 다시 본다 — 가능의 문제가 먼저이고 크기의 문제가 그다음이다 |
| **스킬 실행 형태** (MS-SKILL-FORM 의 빈 다섯 칸) | **Q35 의 7 조건 2 가 처음으로 충족됐다** — `MP-REACH-THE-UNREACHABLE` 이 `MC-PLACE-FOOTING`(공간 존재 칸)을 요구한다 (Q71(b) 확장). 남은 장벽은 둘이다: 세계에 **몸이 아닌 존재**가 서야 하고, 발판·투사체가 뜻을 가지려면 **위아래**가 있어야 한다 (`WorldPosition` 은 x·z 뿐 — [README.md](README.md) 의 같은 절). Q35(층인가 갈래인가)는 여전히 Human 결정이다. 남은 후보 여섯은 이 자리를 쓰지 않으므로 이것이 COMBAT 을 막지 않는다 |
| 위협도 · 진영 · 도발 | 막는 것은 없다 (`HOSTILITY_REASONS` 에 항목 추가로 시작) — 아직 어느 Possibility 도 요구하지 않는다 (7 조건 2) |
| UL §32 자동 전투 (AUTO 는 기본 대답 · MANUAL 은 정밀 대답) | 세계에 자동 전투가 없다. 규율할 대상이 0 이라 Constraint 도 후보도 세우지 않았다 — 자동 전투가 서는 날 그 작업이 받는다 |
| UL §22 의 나머지 아홉 영역 (생명 · 위치 · 행동 · 대상 · 자원 · 개체 · 영역 · 시간 …) | 그 표는 능력 목록이 아니라 **확장 공간의 지도**다. UL §42 F7 이 처음 열 다섯만 지정했고 그 다섯(표식 · 묶음 · 대상 변경 · 관찰 · 봉인)은 위 후보와 첫 줄에 전부 나가 있다. 나머지는 요구하는 갈래가 생길 때 OPTIONS 가 낳는다 |

**후보로 올리지 않은 결손 하나**: 기력이 스스로 돌아오지 않는다 (MC-CP-ECONOMY PARTIAL).
어느 상위 갈래를 전진시키는지 근거 문서가 말하지 않아 7 조건 2 를 세울 수 없다 —
밸런스로 다룰지 규칙으로 세울지는 Human 판단이다. 기력을 더 쓰게 만들 것으로 보이던
사슬 A 가 빠졌으므로 지금은 급하지 않다.
