# Open Questions — Human 결정 대기

Master Layer 작업 중 Agent 가 **임의로 결정하지 않고 남긴 것**들이다.
Constraint 승인 · Constraint 충돌 · 설계 공백 · Trade-off 가 여기 모인다.

```text
Agent 가 쓴다      질문 · 영향 범위 · 선택지 · 각 선택의 결과
Human 이 답한다    DECISION 줄
```

답이 정해지면 해당 Node/Constraint 에 반영하고 **이 파일에서 지운 뒤 결정 내용을
[HISTORY.md](HISTORY.md) 로 옮긴다.**

---

## Q20. 코드 대조로 올라간 Overlay 판정 2건을 확정하는가 — OPEN

    무엇          Graph 를 실제 `world/` 코드와 하나씩 대조한 결과, Cycle 의 MASTER FEEDBACK
                  절차를 거치지 않은 채 사실상 구현되어 있는 Capability 가 둘 나왔다.
                  Feedback Guide 는 "보고 없는 승격은 하지 않는다" 이므로 Agent 가
                  단독으로 확정하지 않는다.

                  MC-PENETRATION          MISSING → IMPLEMENTED
                    C013 의 08-verification 이 실측을 이미 기록했다. 다만 C013 이
                    Human Play 확인 대기라 Cycle 이 형식상 닫히지 않았다.

                  MC-COMBAT-CAUSE-READING PARTIAL → IMPLEMENTED
                    C010 이 계산 내역을 관찰 계약에 실었으나 그 Cycle 의 FEEDBACK 이
                    이 Capability 를 보고하지 않아 PARTIAL 로 남아 있었다.
                    코드에는 고른 능력치 이름·값부터 막기 결과까지 전부 실린다.

    영향          overlay.md 와 graph/capabilities.yaml 의 두 행. Frontier 후보 순위에는
                  영향이 없다(둘 다 이미 다른 후보의 전제가 아니다).
                  현재 두 파일은 **코드 기준으로 IMPLEMENTED 라고 적어 두었다** —
                  거부하시면 되돌린다.

    선택지        (a) 둘 다 확정 → 그대로 둔다. C013 은 Human Play 후 HISTORY 로 이관
                  (b) MC-PENETRATION 만 확정, CAUSE-READING 은 별도 Cycle 보고를 기다린다
                  (c) 둘 다 되돌린다 → 절차를 지키되 문서가 코드보다 낡은 상태를 유지한다
    DECISION      PENDING

---

## Q21. MG-EXPLORE-BEIRA 의 갈래를 "장소" 에서 "방법" 으로 재편하는가 — OPEN · 차단

    무엇          MG-EXPLORE-BEIRA 아래 다섯 갈래(MP-VENTURE-INTO-FRINGE ~ UNKNOWN)는
                  서로 대안이 아니다. FRINGE·WILD·DANGER·DEEP·UNKNOWN 은 **가는 곳**이고
                  순서대로만 열리므로, 정의상 OR 갈래인 Possibility 자리에 사다리가
                  들어가 있다. 그 결과 탐험 축 전체가 "층 이름 + BW §21~§25 의 '필요:'
                  목록" 이라는 게이트 표로 읽힌다.

                  이번에 MP-ADAPT-BY-RESOURCE 를 세워 진짜 방법 축을 하나 만들었다
                  (내 기술로 뚫는 대신 세계가 만든 적응을 빌린다 — BW §17).
                  그러나 하나로는 축이 서지 않는다.

    영향          possibilities.yaml 의 탐험 절 전체 구조. overlay.md 의 탐험 표.
                  frontier.md 의 탐험 후보 산출 방식. Cycle 로는 아직 내려가지 않았으므로
                  지금 바꾸면 비용이 가장 싸다.

    선택지        (a) 그대로 둔다 — 사다리를 Possibility 로 쓰는 것을 허용하고,
                      그 사실을 주석으로 명시한다 (현재 상태)
                      → 읽는 사람이 계속 "왜 이게 대안이지" 라고 묻게 된다
                  (b) 두 층으로 쪼갠다 — 층(MW-ZONE-*)은 세계 상태로 두고,
                      MG-EXPLORE-BEIRA 의 Possibility 는 **범위를 넓히는 방법**으로만 채운다
                      (자원으로 적응한다 · 안내인을 고용한다 · 정보를 산다 · 길을 낸다 …)
                      → 구조가 맞아떨어지지만 BW 가 명명하지 않은 방법을 세워야 한다
                  (c) 층마다 Local Goal 을 세우고 그 아래에 방법을 단다
                      → 가장 정확하지만 노드 수가 크게 는다
    DECISION      PENDING

---

## Q22. 지금 세계의 유일한 자원(돌)에 세계 유래를 부여하는가 — OPEN

    무엇          frontier.md 후보 D(FR-WHAT-YOU-GATHER-CHANGES-YOUR-BODY)를 열려면
                  캔 자원이 몸을 바꿔야 한다. 그런데 지금 세계의 자원은 돌 하나뿐이고,
                  그것은 세계압에서 나온 것이 아니라 그냥 놓여 있는 채집물이다.
                  DC-WORLD-RESOURCE-ADAPTATION-TRACE 는 `resource_placed_without_world_cause`
                  를 금지하므로, 돌로 능력치를 올리면 이 Constraint 에 걸릴 수 있다.

    영향          후보 D 를 고를 수 있는지 여부. 나아가 "기존 프로토타입 자산(돌·광맥)을
                  베이라 세계관 안으로 편입할 것인가, 아니면 별개로 둘 것인가" 라는
                  더 큰 방향.

    선택지        (a) 돌에 세계 유래를 먼저 부여한다 — 어떤 압력의 결과인지 정하고
                      MW-* 에 잇는다 → 후보 D 가 Constraint 를 통과한다
                  (b) 능력치가 아니라 제작으로 좁힌다 (돌 → 도구/무기) — 성장이 아니라
                      물건이 되므로 TRACE 의 적용이 약해진다
                  (c) 후보 D 를 지역 기반이 생긴 뒤로 미룬다 → 성장 공백이 더 오래 간다
    DECISION      PENDING

---

지금 Human 을 기다리는 것은 위 셋과 **Frontier 선택**이다 →
[frontier.md](frontier.md) 의 후보 4종 중 하나를 고르면 다음 Cycle 이 시작된다.
