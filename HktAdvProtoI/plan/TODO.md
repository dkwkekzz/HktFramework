# TODO — 앞으로 할 일

살아 있는 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 끝난 줄은 지운다. 경위는 git history 가 소유한다.

```text
목적    "다음에 무엇을 하는가" 의 큐. 트랙(주체)마다 절 하나, 위가 먼저다. 한 줄이 일 하나 — 내용은 복사하지 않고 상세 문서를 링크한다.
        어디까지 왔는가는 STATE.md, 왜 그 순서인가는 STATE §0 의 그림.
기능    §1 Human · §2 design · §3 cycle · §4 engine · 도구
쓰는 이  advprotoi-design(승인 · 판정 반영 때) · advprotoi-cycle(합친 직후) · Human(답하고 지운다)
```

## 1. Human — 답할 것 (순서대로)

```text
1  승인  OneStandsOnStage — "C037 진행" 한 마디 (또는 제안값 여섯의 답)          play/OneStandsOnStage.md 끝
2  승인  TrailBehindClueAhead — 질문 여섯의 답                                    play/TrailBehindClueAhead.md 끝
3  판정  RoomOfAnotherKind 실주행 — Frost-1 ~ Frost-6                             PLAYS.md §2.1
4  판정  RoomBearsLife 실주행 — Life-1 ~ Life-6                                   PLAYS.md §2.2
5  판정  RoomAsksForPossibilities 실주행 — Access-1 ~ Access-5                    PLAYS.md §2.3
6  결정  값 · 규칙 — 판정 때 함께 보는 것이 싸다                                    PLAYS.md 각 절의 "결정 대기" · §3
7  결정  4층 · 7층 Play 를 앞당기는가                                              DESIGN.md §5 (순서 3 · 6)
8  결정  자리 없는 것(다중 플레이어의 충분조건 · 사회 · 번식 · 절벽 낙하)을 어느 층에 둘 것인가 · 9층을 세우는가   DESIGN.md §4
9  이름  HundredRooms 의 미지 백 줄 — 직접 주거나 초안기(world:draft --batch) 후보를 고른다                      DESIGN.md §5 순서 1
10 주입  3층 나머지 절반 — 몸의 값 전반 · 생물의 앎과 선택 (Stage 판정 뒤)                                     DESIGN.md §1 · §5 순서 2
11 이름  컨텐츠 행 — 보석 여덟 · 보류 계열 일곱 · Region §5.1 나머지 … 하나씩                                  DESIGN.md §3 "컨텐츠 행"
```

## 2. design — 기획

```text
1  승인 반영  Stage 승인 → 제안값을 확정 후보로 · PLAYS §2.6 진행 · STATE 갱신
2  승인 반영  Trail 승인 → PLAYS §2.5 진행 · Rooms 행 닫힘 · DESIGN §3 GAP 절 삭제 · STATE 갱신
3  초안       HundredRooms Play — 전제가 다 섰다(T1~T6 · T3 ecology 는 §4-1). Cycle 은 C041~                DESIGN.md §5 순서 1
4  GAP 회수   판정(§1-3 · 4 · 5)에서 "아니오" 가 오면 — 기존 Play 에 Cycle 을 더하거나 관찰 가능성 Play 로 묶는다
5  다음 Play  3층 둘째 (가칭 BodyKnowsAndWants) — Stage 판정 + §1-10 주입 뒤. DESIGN §3 의 "3층 둘째" 표기 전부를 받는다
6  다음 Play  4층 → 5층 → 6층 → 7층 — 각 층이 열릴 때 (앞 층 판정 + 그 층 주입 + 위임 D1~D5 회수)             DESIGN.md §5
7  컨텐츠 행  Human 이 이름을 줄 때마다 등급 판정(A/B/C) → A 는 Spec · B 는 Cycle 하나 · C 는 기반 층 행
```

## 3. cycle — 돌릴 것

```text
1  C034 → C035 → C036   Foundation — 지금                                   CYCLES.md §1
2  C037 → C038          Stage — §1-1 승인 즉시. C039 는 C038 뒤 · C040 은 C039 뒤
3  C032 → C033          Trail — §1-2 승인 뒤 (명세는 그 전에도)
4  C041~                HundredRooms — §2-3 승인 뒤 (코드 diff 0 · 셋 안팎)
합친 직후  Play 체크박스 · PLAYS 그 절 · CYCLES 레인 · STATE · codemap(API · 구조가 바뀐 것만)
```

## 4. engine · 도구

```text
1  T3 ecology 산출 — Life 가 닫혀 붙일 수 있다 (phases · 템플릿도)                        L2-World-Tool-Scale.md §3
2  갈래별 땅 묶음 — templates 손질 (땅 묶음이 있는 갈래는 일곱 중 둘) · 확인은 world:lab      CYCLES.md §4 화면 (T6)
3  Play 없는 다음 Cycle — T2 확장(요구와 답을 구조로 · access.silence)                       CYCLES.md §3
4  공학 부채 — 그 자리를 만지는 Cycle 이 갚는다                                            CYCLES.md §4
```
