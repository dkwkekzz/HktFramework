# Open Questions — Human 결정 대기

Master Layer 작업 중 Agent 가 **임의로 결정하지 않고 남긴 것**들이다.
Constraint 승인 · Constraint 충돌 · 설계 공백 · Trade-off 가 여기 모인다.

```text
Agent 가 쓴다      질문 · 영향 범위 · 선택지 · 각 선택의 결과
Human 이 답한다    DECISION 줄
```

답이 정해지면 해당 Node/Constraint 에 반영하고 **이 파일에서 지운 뒤 결정 내용을
[HISTORY.md](HISTORY.md) 로 옮긴다.**

미해결 **6건** — `design/Design-Targeting-R0.md`(TG) 주입에서 나왔다. 닫힌 질문은 HISTORY.md.

Frontier 는 아직 갱신하지 않았다 — [frontier.md](frontier.md) 의 `SELECTED`
(`FR-INSIGHT-SEES-BEFORE-LOOKING`)가 도는 Cycle 이 닫히지 않았고, TG 후보를 세우는 것은
그 Feedback 이 반영된 뒤 NEXT 의 일이다.

## Q23. TG 주입 DC 1종(DRAFT) 승인 — OPEN

    무엇          `DC-TARGET-IS-INTENT-NOT-AIM` 을 Active Constraint 로 승인할 것인가.
                  "지목은 의도의 표명일 뿐 명중·피해·정보·위협을 만들지 않으며 세계가
                  대신 다가가지 않는다" (TG §0 · §3.4 · §9 · §10 · §14)
    영향          승인 전까지 MC-DESIGNATE-TARGET · MC-WATCH-TARGET 의
                  constraint_evaluation 이 UNRESOLVED 로 남는다. Frontier 후보를 세울 때
                  Constraint Eval 을 적을 수 없으므로 NEXT 전에는 답이 있어야 한다
    선택지        (a) 승인 → 지목이 계산에 손대지 않는다는 것이 세계의 원칙이 된다.
                      이후 자동 추적·자동 접근을 넣으려면 Constraint 개정을 거쳐야 한다
                  (b) 문안 수정 후 승인 → 특히 prefers 에 둔 "시작 순간 한 번 정렬" 을
                      requires 로 올릴지, 문서대로 권장에 둘지가 갈린다 (TG §13-2)
                  (c) 보류 → 지목을 Cycle 로 내리되 원칙은 세우지 않는다.
                      계산 보정이 붙는 것을 막을 근거가 Master 에 없어진다
    DECISION      <PENDING>

## Q24. 적대·중립·우호라는 관계가 세계에 없다 — OPEN

    무엇          TG 는 대상 프레임의 관계 표시(§3.2), Tab 순환 후보("적대 Actor" §3.1),
                  공격 거절 사유(`invalid-hostile-target` §3.4-5 · §7)를 관계 위에 세운다.
                  그러나 문서는 **누가 왜 적대인지의 세계 사정을 공급하지 않는다**
    영향          지금 세계에는 관계 개념이 하나도 없다 (코드 대조 — 자율 존재는 순회하고,
                  타격은 휘두른 자리에 닿은 몸에 무차별로 들어간다). 관계를 세우는 순간
                  그것은 표시가 아니라 **최초의 공격 허가 규칙**이 되고, 사람 사이의
                  공격 가부(PvP)까지 함께 정해진다. 지목 자체(고르고 계속 본다)는
                  관계 없이 성립하므로 이 질문이 지목 전체를 막지는 않는다
    선택지        (a) 관계를 R0 에서 빼고 지목만 세운다 → TG §3.1 의 Tab 은 "고를 수 있는
                      존재 전부" 순환이 되고 `invalid-hostile-target` 은 만들지 않는다.
                      관계는 그것을 요구하는 Possibility 가 생길 때 별도로 온다
                  (b) 관계를 이번에 함께 세운다 → 세계 사정(왜 적대인가)을 Human 이
                      공급해야 한다. BW 에 그 자리가 있는지부터 확인이 필요하다
                      (MA-HOSTILE-COMBATANT 는 "지킬 영역 개념이 없다" 로 PARTIAL 이다)
                  (c) 표시만 한다 → 세계에 없는 것을 화면이 말하게 되므로
                      DC-WORLD-OWNS-THE-SURFACE-LIST 와 어긋난다
    DECISION      <PENDING>

## Q25. TG §5.5 가 자기 원칙과 어긋난다 — 가려진 항목 목록의 중복 — OPEN

    무엇          TG §5.5 는 "대상 자체의 값은 중복 저장하지 않는다" 고 쓰고, 같은 절에서
                  `TargetContextView.concealed` 로 가려진 항목 목록을 대상 문맥에 다시 싣는다.
                  그 목록의 단일 출처는 이미 세계의 한 자리다 (C014 가 세운 것)
    영향          `DC-WORLD-OWNS-THE-SURFACE-LIST` 는 같은 목록이 두 곳에 적히는 것을
                  금지한다. 계약 안에서 두 번 실리면 둘이 어긋날 수 있고, 어느 쪽이
                  진짜인지의 규칙이 새로 필요해진다
    선택지        (a) 대상 문맥에서 그 목록을 빼고 존재 쪽 하나만 둔다 → 문서의 자기
                      원칙과 기존 DC 를 함께 지킨다. 화면은 고른 대상의 Id 로 그 존재를
                      찾아 읽는다
                  (b) 대상 문맥에 둔다 → 어느 쪽이 단일 출처인지를 Cycle 이 명시해야 하고
                      DC 의 prohibits 에 예외가 생긴다
    DECISION      <PENDING>

## Q26. Tab 순환 후보를 누가 정하는가 — 문서 안에서 모순 — OPEN

    무엇          TG §6.2 는 Tab 입력을 View 의 책임으로, §5.9 는 Tab 후보 정렬을
                  Content World 의 것으로 적는다. §9 는 "같은 상황·같은 입력이면 같은
                  대상이 골라진다" 는 결정론을 요구한다
    영향          화면이 후보를 고르면 그 결정론은 세계의 성질이 아니라 화면의 성질이 되어
                  세계 쪽 검증으로 증명할 수 없다. 반대로 세계가 고르면 순환은 요청 하나가
                  되고 정렬·동률 처리는 Rule 이 된다. 어느 쪽이냐에 따라 계약이 달라진다
    선택지        (a) 세계가 고른다 → "다음/이전 대상을 고른다" 가 세계 안의 행동이 된다.
                      결정론이 Rule 로 검증된다
                  (b) 화면이 고른다 → 후보 목록과 정렬 근거를 세계가 관찰에 실어야 한다.
                      그러지 않으면 화면이 세계의 판정을 흉내 내게 된다
    DECISION      <PENDING>

## Q27. 지목을 요구하는 것이 살펴봄 갈래 하나뿐인가 — OPEN

    무엇          주입은 MC-DESIGNATE-TARGET · MC-WATCH-TARGET 을
                  `MP-LEARN-TO-HANDLE-THE-LAYER` 아래에 매달았다. 근거는 TG §3.3
                  ("무엇을 살펴볼지가 이 행동의 전부") 과 §3.2 · §4.2 다.
                  그러나 TG 는 어느 Possibility 도 이름 대지 않는다
    영향          Capability 는 자기를 요구하는 방법이나 장소가 하나도 없으면 노드가 아니다.
                  배선이 좁으면 지목이 탐험 갈래 전용처럼 읽히고, 넓히면 전투 갈래
                  대부분이 지목을 요구하게 된다 — 그런데 지금 전투는 지목 없이도
                  성립한다 (휘두른 자리에 닿으면 맞는다). 배선이 Frontier 의 근거가 되므로
                  NEXT 전에 정리되어야 한다
    선택지        (a) 지금대로 둔다 → 지목은 "겪어서 익히는" 갈래의 조건이다.
                      전투는 지목 없이도 계속 성립한다
                  (b) 전투 갈래에도 매단다 → 어느 갈래인지 Human 이 지목해야 한다.
                      TG §3.4 는 공격을 지목 위에 세우지만 갈래를 이름 대지 않는다
                  (c) 요구가 아니라 다른 관계로 둔다 → 지목은 여러 방법이 공통으로 쓰는
                      바닥이므로 별도 표현이 필요하다는 뜻이며, SCHEMA 변경이 따른다
    DECISION      <PENDING>

## Q28. TG §5 가 요구하는 기반(Engine) 변경은 Cycle 이 할 수 없다 — OPEN

    무엇          TG §5.2 · §5.3 은 화면 입력의 해석 정책 주입과, 선택 강조·대상 패널을
                  위한 범용 표현 지시를 기반(engine/view-kernel)에 더하라고 적는다.
                  그러나 기반은 컨텐츠 작업에서 편집하지 않는 자리이고
                  (CLAUDE.md · Design-System-Content-Separation), 그 문서의 승격 규칙은
                  "승격은 Cycle 이 아니라 기반 트랙 커밋" 과 "두 번째 팩이 실제로 요구할 때"
                  (rule of two) 를 요구한다. 지금 요구하는 팩은 하나뿐이다
    영향          이 답에 따라 지목 Cycle 의 크기가 달라진다. 기반이 먼저 서면 Cycle 은
                  세계의 의미만 닫으면 되고, 서지 않으면 Cycle 은 이미 있는 표현 수단
                  안에서 닫아야 한다. Master 는 이 결정을 소유하지 않는다 — 기반 경계는
                  Graph 의 어휘가 아니다
    선택지        (a) 기반 트랙 커밋을 먼저 낸다 → 지금 기반이 컨텐츠의 결정(무엇을
                      클릭하면 무슨 요청이 되는가)을 확정해 버리고 있으므로, 그 자리를
                      되돌리는 것 자체가 기반의 일이라는 판단
                  (b) 기반을 건드리지 않고 Cycle 을 닫는다 → 이미 있는 표현 수단으로
                      고른 대상을 드러내고, 전용 대상 패널은 부채로 남긴다
                  (c) 두 번째 팩이 요구할 때까지 지목 Cycle 을 미룬다
    DECISION      <PENDING>
