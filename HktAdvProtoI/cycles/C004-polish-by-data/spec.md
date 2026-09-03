# C004 — 폴리싱은 데이터로

```text
CYCLE          C004-polish-by-data
SOURCE         content/roadmap/play/RegionGraphRooms.md (Cycle Breakdown 넷째 항목 · §0 불변 조건 셋 · §6 E4 · 불변 조건 절) ·
               content/roadmap/play/RuleBoundRoom.md 확정 사항 4(고대 문은 C004 가 데이터로 연다) ·
               content/roadmap/L2-World-Tool.md §1(검사 ⑤~⑧) · design/Plan-World-Authoring-Engine.md §4
SELECTED_FROM  Play Cycle Breakdown — "C004 — 폴리싱은 데이터로"
```

범위(Playable Goal ~ Out of Scope)는 design 이 Play 에서 잘라 쓴다. 명세(SPEC ~ UNRESOLVED)는 cycle 이 덧붙여 동결한다.

## Playable Goal

`content/regions/*.ts` · `graph.ts` · `content/view` 의 표만 바꿔 방을 하나 더하고, 어느 방의 색을 바꾸고, 고대 문을 열어
미로 쪽으로 건널 수 있게 한다 — `git diff` 에 그 파일들 외의 변경이 없고(코드 diff 0), 게임에서 셋이 전부 보인다.
`world:observe --graph` 가 방·Connector 표와 검사 ⑤~⑧ 보고를 낸다.

## Experience Intent

```text
Start   방을 더하려면 코드를 고쳐야 할 것 같다.
End     세계를 넓히는 것은 데이터다 — 방 · 연결 · 색 · 문의 상태가 전부 표 안에 있다. 도구가 그 표를 읽어 보고한다.
```

Play 의 Breath 가 아니라 **불변 조건 셋째(폴리싱은 데이터로)** 의 실측이다. 이 Cycle 로 RegionGraphRooms 가 닫힌다.

## World Change

```text
① 방이 하나 는다 — 데이터로만. 어느 방인가는 이 Cycle 의 명세가 Play §5.8 의 자리(예: 붉은 황야 쪽)에서 고른다
② 어느 방의 depth 색이 바뀐다 — content/view 의 표만
③ 고대 문의 초기 state 가 LOCKED → 열림 — Region Spec 의 state 데이터만 (RuleBoundRoom 확정 4). 미로 쪽 방은
   RuleBoundRoom 의 것이므로, 문 너머는 C002 의 region-not-built 거절이 그대로 온다
④ 세계 규칙 · 투영 · 표현 코드에는 변경이 없다
```

## Observable Result

```text
① git diff 가 content/regions/ · content/view/ 의 데이터 파일뿐이다 — 코드 diff 0 (이 Cycle 의 실측)
② 게임에서 새 방으로 건너가 진다 · 바뀐 색이 보인다 · 고대 문 표식이 닫힘에서 열림으로 바뀌고 요청하면 거절 사유가 바뀐다
③ world:observe --graph 출력 — 방 표(id · depth · extent · anchor 수) · Connector 표(from · to · direction · transition · 활성) ·
   검사 ⑤ anchor 존재 · ⑥ 자식마다 Connector · ⑦ 이탈 있음 · ⑧ civil 에서 전부 닿음 의 통과/실패
```

## Reuse

### Existing (그대로 쓴다)

```text
C001~C003 의 전부 · engine/world-authoring 의 검사(⑤⑦) · tools/ 의 tsx 실행 선례(catalog · boundary)
```

### Added (이 Cycle 이 세운다)

```text
Data       방 하나 · 색 하나 · 고대 문 state 하나 (전부 데이터 — 이것이 실측 대상이다)
Engine     world-authoring/check 에 검사 ⑥⑧ (없으면) · tools/world-editor: world:observe --graph (게임 명사 없이 — 표와 보고만)
World/View 없음이 목표 — 생기면 불변 조건 위반이고 그 자체가 이 Cycle 의 발견이다
```

## Out of Scope

```text
높이 · 표면 · scatter · world:compile · world:shot                  RoomBecomesLand (C008~C010)
고대 문이 조건으로 열리는 것 · 미로 방                               RuleBoundRoom (C005~C007)
붉은 황야 · 얼음 협곡의 실제 내용                                    이 Play 밖
```
