# Frontier — COMBAT 트랙

전투(R1 · DT · UL) · 스킬(SK) 도메인의 후보와 지금 도는 것을 담는다. 트랙 규칙과 트랙 간
판단은 [README.md](README.md), 읽는 법은 guides/master-frontier.md 소유다.

    기준 Overlay   master/overlay.md — 사슬 B 의 아래 두 칸이 섰다: 조건 관문
                   (MC-ABILITY-CONDITION · C-COMBAT-003) · 표식 (MC-MARK · C-COMBAT-004).
                   전투 사다리는 Critical 층까지 + 지목 · 태도 · 시점 · 모양 · 배분.
                   능동 대응 사슬(넷)은 이 트랙에 없다 — "지금 열 수 없는 것" 첫 줄.

## 한눈에 보기 — 추천 순서대로

| 순위 | FR | 기능 | 세계에 없는 것 | 크기 | 추천 사유 (한 줄) |
|---|---|---|---|---|---|
| 1 | FR-A-PROMISE-BINDS-BOTH | 스스로 건 약속이 둘을 묶는다 | 계약·묶음 실체 (MC-VOW · MC-BIND) | **큼** | 의존이 빈 둘 중 하나 — MP-BIND-BY-CONTRACT 가 통째로 닫힌다. 크다는 것을 알고 고를 것 |
| 2 | FR-TAKE-WHAT-MAKES-THEM-STRONG | 상대를 이루는 것을 빼앗는다 | 옮기는 행동 (MC-DRAIN) | 작음 | 의존 없음 — 이 트랙에서 가장 싸다. 작게 한 바퀴면 이것 |
| 3 | FR-KNOW-WHAT-THEY-CAN-DO | 상대의 규칙을 알아낸다 | 능력 관찰 (MC-OBSERVE-ABILITY) | 중간 | 계약 뒤 + 습성 문서 승인 대기 (후보의 의존) |
| 4 | FR-TAKE-AWAY-WHAT-THEY-CAN-DO | 상대가 가진 것을 못 쓰게 만든다 | 봉인 (MC-DISRUPT-ABILITY) | 중간 | 관찰 뒤 — MP-KNOW-THE-OPPONENT-RULE 이 닫힌다 |

고르기 전에 알아야 할 것 둘 (C-COMBAT-003 · 004 Feedback):

    키 자리 바닥        글자 키가 남지 않았다 (`O` · `P` 로 끝) — 다음 기술은 키 없이 선다.
                        works/BACKLOG.md `skill-slot-crowds-the-keyboard` (VIEW/ENGINE) 몫
    자율 존재 미개방     두 Cycle 이 같은 자리에서 걸렸다 (배분에 몰지 않아 · 고르지 않아).
                        남은 후보들이 전부 "상대가 무엇을 하는가" 를 전제한다 —
                        Design-Creature-Behavior-R0 승인 전에는 반쪽만 검증되는 층을 쌓는다

## 후보

### FR-A-PROMISE-BINDS-BOTH — 스스로 건 약속이 둘을 묶는다

    무엇               스스로 제약을 걸고, 그 대가로 평소에는 허락되지 않는 조작 —
                       상대를 묶어 움직임의 범위를 줄이는 것 — 을 허락받는다.
                       제약을 어기면 묶음이 즉시 풀린다
    세계에 생기는 것    ① 스스로 거는 제약이 세계의 사실로 존재하고 양쪽에 보인다
                       ② 그 제약을 지는 동안에만 되는 조작이 있다
                       ③ 두 존재를 잇는 실체가 있고 상대의 행동 범위가 실제로 좁아진다
                       ④ 제약을 어기면 즉시 대가 — 묶음이 풀린다
                       ⑤ 상대가 푸는 길 최소 하나 (실체 파괴 · 거는 쪽 움직이게 하기 ·
                          위반 유도 — UL §24)
                       ⑥ 걸린 쪽에 "왜 움직일 수 없는가" 가 사유로 보인다
    아닌 것            수치 교환이 아니다 (생명을 깎아 피해를 사지 않는다) ·
                       완전 봉쇄가 아니다 (범위 축소 + 푸는 길) · 한 번의 사건이 아니다
                       (끊기·밀기와 달리 지속하는 관계다) · 피해 기술이 아니다 (0 피해로 성립)
    이미 있는 것        조건 관문(C-COMBAT-003) · 표식(C-COMBAT-004) · 존재 사이 값을 지금의
                       사실에서 유도하는 얼개 world/semantic/relation.ts (C018) ·
                       사유·경위 자리. 묶는 실체와 행동 범위 제한은 없다 — 이 후보가 세운다
    결과               Playable    "이 싸움에서 다른 존재를 치지 않는다" 를 걸고 상대를
                                   묶어 그 자리에서 벗어나지 못하게 하고, 다른 적에게
                                   손을 대는 순간 묶음이 풀린다
                       Observable  묶인 상대의 움직임이 실제로 좁아지고, 위반 순간 풀리며,
                                   그 인과가 경위에서 되짚어진다
    Trace              MG-OVERCOME-SUPERIOR-OPPONENT / MP-BIND-BY-CONTRACT (이 후보로 닫힘) ·
                       Target MC-VOW · MC-BIND (둘 다 MISSING) ·
                       근거 UL §20 · §21 · §23 · §24 · §42 F6~F7
    Constraints        DC-COMBAT-CONTRACT-BUYS-CAPABILITY — 제약이 사는 것은 수치가 아니라 조작 ·
                       DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY — 푸는 길이 있어야 한다 ·
                       DC-COMBAT-ABILITY-IS-A-RULE · DC-COMBAT-UNAVAILABLE-HAS-A-REASON ·
                       DC-COMBAT-PLAYER-CAUSALITY
    판정               한 Cycle: 쪼개지 않았다 — 계약만 세우면 허락할 조작이 없어 수치
                       교환으로 흐르고, 묶음만 세우면 대응 지점 없는 강제가 된다.
                       다른 후보보다 크다는 것을 Human 이 알고 골라야 한다 (Do 6) ·
                       7조건: 전부 충족 · 의존: 없음 — 관문·표식이 섰다 · Status: PROPOSED

### FR-TAKE-WHAT-MAKES-THEM-STRONG — 상대를 이루는 것을 빼앗는다

    무엇               상대가 유한하게 가진 것이 이쪽으로 옮겨 온다 — 상대는 줄고 나는
                       는다. 격차가 한쪽이 아니라 양쪽에서 좁는다
    세계에 생기는 것    ① 상대가 가진 것이 옮길 수 있는 것으로 존재한다
                       ② 빼앗는 행동 — 빼앗은 만큼 두 몸의 값이 반대로 움직인다
                       ③ 빼앗긴 쪽이 실제로 이전만큼 하지 못한다
                       ④ 무엇이 얼마나 옮겨 갔는지가 양쪽 모두에게 보인다
    아닌 것            받아낸 것의 저장이 아니다 (MC-ABSORB 는 상대에게서 덜지 않는다) ·
                       피해가 아니다 (생명을 깎지 않고 성립) · 봉인이 아니다
                       (MC-DISRUPT-ABILITY) · 표식이 아니다 (MC-MARK) ·
                       새 피해 공식이 아니다 — 기존 식이 읽는 입력값을 옮길 뿐이다
    이미 있는 것        코드 대조 — 몸의 유한 자원(world/semantic/actor.ts 의 hp·cp·능력치) ·
                       유효 값 무저장 재계산(combat.ts#effectiveStat — C023 · C-COMBAT-001) ·
                       dt 로 몸에서 값을 빼 가는 규칙(ground-law-apply.ts — C-TERRAIN-001) ·
                       계산 경위(C010~C015). 없는 것은 "뺀 것을 나에게 넣는다" 하나다
    결과               Playable    상대에게 붙어 열을 빼앗아, 내 값이 오르는 동시에 상대의
                                   공격이 무뎌지는 것을 본다 — 한 방도 더 때리지 않고
                                   격차가 뒤집힌다
                       Observable  전후로 두 몸의 값이 반대로 움직이고 옮겨 간 양이
                                   계산 경위에 남는다
    Trace              MG-OVERCOME-SUPERIOR-OPPONENT / MP-TAKE-WHAT-MAKES-IT-STRONG ·
                       Target MC-DRAIN (MISSING · grounded: true) · 근거 FC (Q71(b) 확장)
    Constraints        DC-COMBAT-SHARED-BUDGET — UNRESOLVED: 빼앗은 것이 기존 기력 예산으로
                       들어오는지 따로 담기는지는 03 이 정한다. 새 게이지를 만들면 위반 ·
                       DC-COMBAT-ONE-FORMULA — 새 식 없음, 입력값 이동 ·
                       DC-GROWTH-NO-DOMINATED-ROUTE — 근접 요구라 원거리를 압도하지 않는다 ·
                       DC-COMBAT-ABILITY-IS-A-RULE · DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY ·
                       DC-COMBAT-PLAYER-CAUSALITY
    판정               한 Cycle: 옮길 값도 다시 세는 자리도 빼 가는 규칙도 이미 있다 —
                       새로 서는 것은 "뺀 것을 나에게 넣는다" 하나 ·
                       7조건: 전부 충족 · 의존: 없음 — 조건 관문(C-COMBAT-003)이 섰으므로
                       "빼앗을 것이 남았는가" 를 곧바로 조건으로 쓸 수 있다 · Status: PROPOSED

### FR-KNOW-WHAT-THEY-CAN-DO — 상대의 규칙을 알아낸다

    무엇               상대의 능력을 겪거나 지켜보아 그 규칙을 단계적으로 알아 간다 —
                       이름 · 종류 · 성립 조건 · 걸린 계약 · 대응책 순으로, 인지에
                       몰아 둘수록 더 깊이 읽힌다
    세계에 생기는 것    ① 자율 존재가 규칙 있는 능력을 하나 지닌다 (조건 · 대가 · 대응책)
                       ② 그 규칙이 처음에는 가려져 있다
                       ③ 겪거나 지켜본 만큼 단계적으로 드러난다
                       ④ 인지 배분이 드러나는 깊이를 가른다
                       ⑤ 알아낸 것이 다음 싸움에도 남는다
    아닌 것            살펴봄(MC-OBSERVE)의 확장이 아니다 — 그쪽은 지금 상태, 이쪽은 가진
                       규칙 · 약점 찾기가 아니다 (MC-DISCOVER-WEAKNESS) · 봉인이 아니다
                       (다음 후보) · 전부 보여 주지 않는다 — 단계와 대가가 있다
    이미 있는 것        관찰자별 단계적 앎의 장부 world/semantic/acquaintance.ts (C014 ·
                       C016 — Id 만 담고 값을 베끼지 않는 성질까지 같다) · 인지 값
                       insight (C016) · 배분 축 (C-COMBAT-001).
                       자율 존재의 규칙 있는 능력은 없다 — 이 후보가 하나 세운다
    결과               Playable    적의 능력을 처음엔 이름만 알다가, 겪고 살펴본 뒤 성립
                                   조건과 푸는 길까지 알게 되어 다음 싸움을 다르게 시작한다
                       Observable  같은 적을 두 사람이 봐도 아는 깊이가 다르고, 모르는
                                   자리는 가려진 것으로 보인다
    Trace              MG-OVERCOME-SUPERIOR-OPPONENT / MP-KNOW-THE-OPPONENT-RULE ·
                       Target MC-OBSERVE-ABILITY (MISSING) · 근거 UL §25 · §26 · §29 · §39 · §42 F7
    Constraints        DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY — 이 후보가 "대응책이 발견
                       가능해야 한다" 의 실물 · DC-COMBAT-UNAVAILABLE-HAS-A-REASON ·
                       DC-COMBAT-ABILITY-IS-A-RULE · DC-WORLD-OWNS-THE-SURFACE-LIST
    판정               한 Cycle: 새 상태 하나 — 관찰자별로 어느 능력의 어느 자리까지
                       알았는가 (기존 앎의 장부와 같은 모양) · 7조건: 전부 충족 ·
                       의존: FR-A-PROMISE-BINDS-BOTH (알아낼 규칙의 형태가 먼저) ·
                       Design-Creature-Behavior-R0 승인 (자율 존재가 능력을 실제로 써야
                       "겪어서 알아내기" 가 성립 — C-COMBAT-003 · 004 가 두 번 확인한 미개방) ·
                       Status: PROPOSED

### FR-TAKE-AWAY-WHAT-THEY-CAN-DO — 상대가 가진 것을 못 쓰게 만든다

    무엇               상대가 가진 능력 하나를 성립하지 않게 만든다 — 피해가 아니라
                       그 능력이 지금부터 작동하지 않게 하는 조작이다
    세계에 생기는 것    ① 남이 걸어 둔 것 때문에 못 쓰는 자리가 처음으로 생긴다
                       ② 봉인된 쪽에 그 사유가 보인다 — 자기 조건이 아니라 남 때문
                       ③ 푸는 길 최소 하나 (UL §24 — 건 쪽에서 멀어지면 풀린다)
                       ④ 알아낸 것만 봉인할 수 있다 (UL §26)
    아닌 것            끊기가 아니다 (MC-INTERRUPT 는 지금 하려는 한 동작) · 묶음이 아니다
                       (움직임의 범위가 아니라 할 수 있는 일) · 피해 증가가 아니다 ·
                       영구가 아니다 — 풀리는 길과 끝이 있다
    이미 있는 것        조건 관문과 사유 코드 (C-COMBAT-003). 지금 못 쓰는 사유는 전부
                       자기 조건이다 — 남이 건 것 때문에 못 쓰는 자리가 처음 생긴다
    결과               Playable    적의 무서운 기술 하나를 봉인해 한동안 못 쓰게 만들고,
                                   적은 그 사유를 보고 멀어져 봉인을 푼다
                       Observable  봉인된 능력이 "누가 언제 걸었는가" 로 읽히고, 조건이
                                   사라지면 별도 규칙 없이 다시 쓸 수 있다
    Trace              MG-OVERCOME-SUPERIOR-OPPONENT / MP-KNOW-THE-OPPONENT-RULE (이 후보로
                       닫힘) · Target MC-DISRUPT-ABILITY (MISSING) ·
                       근거 UL §22 · §24 · §26 · §42 F7
    Constraints        DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY — 대응책의 형태는 UL §24 가
                       예로만 들었으므로 그 Cycle 의 Stage 3 이 고른다 ·
                       DC-COMBAT-UNAVAILABLE-HAS-A-REASON · DC-COMBAT-ABILITY-IS-A-RULE ·
                       DC-CONDITION-OPENS-WITHOUT-RECORDING
    판정               한 Cycle: 새 상태 하나 — 누가 누구의 어느 능력을 언제 봉인했는가
                       (표식과 같은 모양) · 7조건: 전부 충족 ·
                       의존: FR-KNOW-WHAT-THEY-CAN-DO (알아낸 것만 봉인 — UL §26) ·
                       Status: PROPOSED

## SELECTED

```text
없음 — Human 선택 대기
```

    의존이 빈 것은 둘이다 — FR-A-PROMISE-BINDS-BOTH(크다) · FR-TAKE-WHAT-MAKES-THEM-STRONG(싸다).
    직전 반영 경위: [../feedback/C-COMBAT-003-the-world-decides-what-is-possible.md](../feedback/C-COMBAT-003-the-world-decides-what-is-possible.md) ·
    [../feedback/C-COMBAT-004-what-you-leave-on-them.md](../feedback/C-COMBAT-004-what-you-leave-on-them.md)

## 지금 열 수 없는 것

이유가 사라지면 후보로 올린다. 사유의 근거는 괄호의 자리가 소유한다.
트랙 밖(세계 기반 · 설계 문서 부재 등)의 결손은 [README.md](README.md) 의 같은 절에 있다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| **능동 대응 사슬** (UL §4 · §5 · §6 · §7 · §8 · §42 F1~F3 — Active Response · Response Window · Perfect Guard · Counter · Evade) | **막는 것이 아니라 자리가 옮겨졌다** (Human · Q63). 플레이어가 시점에 맞춰 누르는 층은 세우지 않는다 — 대응은 캐릭터가 배운 전투 지식이 운용한다 (CK §15). 그 층의 형태는 UL 이 그대로 소유하고 노드 넷은 고치지 않았다. 다시 들어오는 자리는 [knowledge.md](knowledge.md) 다 |
| **수호 · 대상 이전** (UL §4.2 · §9 · §27) | 세계에 아군이 없다 — Q60(c) 로 미룸. 아군을 세울 때는 사람을 지어내지 말고 세계의 존재(길들인 것 · 구조 대상 · 다른 플레이어)로 받는다 (HISTORY) |
| 자세 유지 (MC-FORTIFY) | `part_of.grounded: false` — UL 은 배분 유지 비용을 말하지 않는다. 후보 Target 금지 (guides/master-frontier.md Must Not) |
| 조건이 겹칠수록 커진다 (MC-CONDITION-STACKING PARTIAL) | 어느 갈래도 지금 결손을 필요로 하지 않는다 (7조건 2). 관문이 섰으므로 크기의 문제를 요구하는 갈래가 생기면 다시 본다 |
| **스킬 실행 형태** (MS-SKILL-FORM 의 빈 다섯 칸) | Q35 의 7조건 2 는 MP-REACH-THE-UNREACHABLE 로 처음 충족 — 남은 장벽은 몸이 아닌 존재와 위아래(WorldPosition 은 x·z 뿐 — [README.md](README.md)). Q35 는 Human 결정. 남은 후보들이 이 자리를 쓰지 않으므로 COMBAT 을 막지 않는다 |
| 위협도 · 진영 · 도발 | 막는 것 없음 (HOSTILITY_REASONS 항목 추가로 시작) — 아직 어느 Possibility 도 요구하지 않는다 (7조건 2) |
| UL §32 자동 전투 | 세계에 자동 전투가 없다 — 규율할 대상 0. 서는 날 그 작업이 받는다 |
| UL §22 의 나머지 아홉 영역 | 능력 목록이 아니라 확장 공간의 지도다. §42 F7 의 다섯(표식·묶음·대상 변경·관찰·봉인)은 전부 후보/닫힘에 나가 있고, 나머지는 요구하는 갈래가 생길 때 OPTIONS 가 낳는다 |
| 기력 자연 회복 (MC-CP-ECONOMY PARTIAL) | 어느 갈래를 전진시키는지 근거 문서가 말하지 않아 7조건 2 를 세울 수 없다 — 밸런스인지 규칙인지는 Human 판단 |
