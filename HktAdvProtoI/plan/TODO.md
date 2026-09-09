# TODO — 앞으로 할 일

살아 있는 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 끝난 줄은 지운다. 경위는 git history 가 소유한다.

```text
목적    "다음에 무엇을 하는가" 의 큐. 트랙(주체)마다 절 하나, 위가 먼저다. 한 줄이 일 하나 — 내용은 복사하지 않고 상세 문서를 링크한다.
        어디까지 왔는가는 STATE.md, 왜 그 순서인가는 STATE §0 의 그림.
기능    §1 Human · §2 cycle · §3 engine · 도구
쓰는 이  advprotoi-cycle(묶음 승인 · 합친 직후 · 판정 반영 때) · Human(답하고 지운다)
```

## 1. Human — 답할 것 (순서대로)

```text
1  지목  다음 묶음 — 후보 2 편성과 무대(3층) · 3 Rooms GAP 회수 (Foundation 과 병행 가능) → AI 가 묶음 + Cycle 전부의 spec (C038~)   DESIGN.md §5
2  판정  빙결 협곡 실주행 — Frost-1 ~ Frost-6                                                                              CYCLES.md §3.2.1
3  판정  생명 · 붉은 알집 실주행 — Life-1 ~ Life-6                                                                          CYCLES.md §3.2.2
4  판정  요구와 가능성 실주행 — Access-1 ~ Access-5                                                                         CYCLES.md §3.2.3
5  결정  값 · 규칙 — 판정 때 함께 보는 것이 싸다. C034 가 남긴 넷은 Foundation 판정 때 함께 (Q9 제안대로)                                                   CYCLES.md §3.2 각 절의 "결정 대기" · §3.3 · §3.4
6  결정  4층 · 7층 묶음을 앞당기는가                                                                                        DESIGN.md §5 (후보 6 · 9)
7  결정  자리 없는 것(다중 플레이어의 충분조건 · 사회 · 번식 · 절벽 낙하)을 어느 층에 둘 것인가 · 9층을 세우는가                        DESIGN.md §4
8  이름  HundredRooms 의 미지 백 줄 — 직접 주거나 초안기(world:draft --batch) 후보를 고른다                                       DESIGN.md §5 후보 4
9  주입  3층 나머지 절반 — 몸의 값 전반 · 생물의 앎과 선택 (후보 2 판정 뒤)                                                       DESIGN.md §1 · §5 후보 5
10 이름  컨텐츠 행 — 보석 여덟 · 보류 계열 일곱 · Region §5.1 나머지 … 하나씩                                                   DESIGN.md §3 "컨텐츠 행"
```

## 2. cycle — 돌릴 것

```text
1  Cycle      C035 진행 중 → 마감 · 합침, 이어 C036 · C037 (초안을 앞 마감의 「다음 Cycle 로」 로 손봐 동결)                        CYCLES.md §1 · §3.4
2  묶음 제안   §1-1 지목 즉시 — 첫 spec(C038~) 머리에 묶음 블록 + Cycle 전부의 spec · UNRESOLVED 에 묶음 질문 전부 → Human 에게 올린다   Design-DesignAuthoringWorkflow §5~§7
3  예심       묶음의 마지막 Cycle 이 합쳐지면 — 관찰 항목을 질문 대여섯으로 압축해 CYCLES.md §3.2 에 · STATE · TODO §1 에 판정 줄
4  GAP 회수   §1-2 · 3 · 4 에서 "아니오" 가 오면 — 그 묶음에 Cycle 을 더하거나 관찰 가능성 묶음 하나로 자른다
합친 직후  CYCLES 레인 · 묶음 절 · DESIGN §3 덮인 것 · STATE · codemap(API · 구조가 바뀐 것만)
```

## 3. engine · 도구

```text
1  T3 ecology 산출 — 생명이 코드에 있어 붙일 수 있다 (phases · 템플릿도)                     L2-World-Tool-Scale.md §3
2  갈래별 땅 묶음 — templates 손질 (땅 묶음이 있는 갈래는 일곱 중 둘) · 확인은 world:lab      CYCLES.md §5 화면 (T6)
3  묶음 없는 다음 Cycle — T2 확장(요구와 답을 구조로 · access.silence)                       CYCLES.md §4
4  공학 부채 — 그 자리를 만지는 Cycle 이 갚는다                                            CYCLES.md §5
```
