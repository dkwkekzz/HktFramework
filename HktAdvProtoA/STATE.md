# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다:
> [progress/graph.md](progress/graph.md) 구조 그래프 · [progress/world-state.md](progress/world-state.md) 세계 상태(형식) · [progress/world-laws.md](progress/world-laws.md) 세계 법칙(내용).

## 구현 현황 (핵심)

**목적 그래프** — `data/objective-graph.json` (**184 노드 · 180 관계**, 유일 원본). 검증 `node data/validate-graph.mjs`. 관찰·편집기 `objective-tree.html`. 설계: [Design-ObjectiveGraph.md](Design-ObjectiveGraph.md)(정본) · [Design-ObjectiveTree.md](Design-ObjectiveTree.md)(방법론).

**세계 상태·법칙** — 설계 [Design-WorldState.md](Design-WorldState.md)(형식) · [Design-WorldLaws.md](Design-WorldLaws.md)(내용).

**MMORPG 웹 프로토타입** — 설계 [Design-MMO.md](Design-MMO.md) · 진행 상세 [progress/mmo.md](progress/mmo.md). **1단계 '살아있는 지도' 완료**: `game/world.html`(단일 파일 클라, 엔진을 브라우저 실시간 틱 구동) + `data/world-map.json`(지역 16·RIVER) + `data/world-visual.json`(변수 73 전수 표현 사전·연대기 84·fx 34) + `data/validate-visual.mjs`(V1~V4·V6 통과). 대표 사건 5종이 지도 위에서 눈에 보이게 재생(디버그 방아쇠=`--force` 대응). 실행: 저장소 루트 `python3 -m http.server` → `/HktAdvProtoA/game/world.html`.

- `data/world-state.json` — 상태의 유일 원본. **vars 73 · rules 60 · actions 15 · objectives 7 · clocks 2**. 다섯 층·축 문법 3종·값 4종·`basis` 필수.
- `data/state-engine.mjs` — 공유 결정론 틱 루프 ①~⑦ (`every:N`·duration 지원).
- `data/validate-state.mjs` — WorldState §12 검증 1~13 + WorldLaws §7 법칙검증. `node data/validate-state.mjs` (경고 0).
- `data/simulate-state.mjs` — 무입력 시뮬레이터.

### 대표 사건 5종 — 전부 무입력 자율 재생 (WorldLaws §3 전수 완성)

| 사건 | 단계 | 실증 패턴/교차 |
|---|---|---|
| 1 강의 귀환 | 6/6 | 사슬 기본 · NPC 반격(수문회) |
| 2 늑대 멸종 | 6/6 | 생태 균형 · 완료=상태 술어(사냥 없이 회복) · `S_강흐름` 교차 |
| 3 심연유리 호황 | 6/6 | P5 경제 · 개체 이동(위치 ref) · 두 세력 전쟁 |
| 4 백야혈청 공개 | 6/6 | 생태 연쇄 · `L_굶주린평원`(해충) 교차 |
| 5 아르카론의 죽음 | 9/9 | P1 유지 해제 · 새 존재 등장(#18) |

`node data/simulate-state.mjs` 기본 사건 1 재생. 각 사건은 방아쇠(`--force`) 시 자율 발화·미트리거 시 휴면. 모든 방아쇠를 주면 5종이 공유 변수 위에서 동시 상호작용(살아있는 세계, 트리 §16 검증 13·14).

## TODO

- [ ] MMO 2단계 '지역 씬+아바타' — 탑다운 씬·절차 배치(고정 시드)·군집 밀도 표현·`ACT_이동`(`E_플레이어.위치` 축 추가) ([Design-MMO.md](Design-MMO.md) §9).
- [ ] MMO 3단계 '개입' — 행동 발화 UI·전제 미충족 안내·개인 HUD/저널·NPC 정책 행동 무대 연출 ('강의 귀환' 게임플레이화).
- [ ] G2.5.3 아르카론 처리 6방식(§6.2) 보스전 목적·행동 — 무광의 쐐기·일식 전제 활용(사건 5 방아쇠와 연결).
- [ ] 그래프 NPC 목적 노드 보강 — WorldLaws §5 세력 목적 잔여(사제단·수도원·교단 등).
- [ ] §7 법칙검증 7·8(detail 서술 252항목·노드 전수 커버리지) 자동화.
- [ ] objective-tree.html 상태 오버레이 — 노드 현재값 배지·법칙/행동 뷰·틱 진행 관찰.
- [ ] §16 검증 규칙(요소는 최소 2개 목적에 연결 등) 자동 점검 — 고립 노드·단일 해결 방법 경고.
- [ ] G3~G9 하위 목적의 말단(행동 가능 단위)까지 추가 전개.
