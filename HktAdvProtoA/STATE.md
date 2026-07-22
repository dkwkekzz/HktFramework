# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다:
> [progress/graph.md](progress/graph.md) 구조 그래프 · [progress/world-state.md](progress/world-state.md) 세계 상태(형식) · [progress/world-laws.md](progress/world-laws.md) 세계 법칙(내용).

## 구현 현황 (핵심)

**목적 그래프** — `data/objective-graph.json` (**188 노드 · 190 관계**, 유일 원본). 검증 `node data/validate-graph.mjs` (§16 감사: 고립·요소 저연결·단일해결 카운트, `--audit` 목록). 관찰·편집기 `objective-tree.html`(상태 오버레이·라이브 틱 시뮬). 설계: [Design-ObjectiveGraph.md](Design-ObjectiveGraph.md)(정본) · [Design-ObjectiveTree.md](Design-ObjectiveTree.md)(방법론).

**세계 상태·법칙** — 설계 [Design-WorldState.md](Design-WorldState.md)(형식) · [Design-WorldLaws.md](Design-WorldLaws.md)(내용).

**MMORPG 웹 프로토타입** — 설계 [Design-MMO.md](Design-MMO.md) · 진행 상세 [progress/mmo.md](progress/mmo.md). **1~3단계 완료** (살아있는 지도 → 지역 씬·아바타 → 개입): `game/world.html`(단일 파일 클라 — 대륙 지도·지역 씬·아바타 이동·**행동 발화 UI(전제 미충족 안내=퀘스트 안내)·NPC 정책 행동 무대 연출**·연대기·인스펙터·개인 HUD·디버그 방아쇠·정책 토글) + `data/world-map.json` + `data/world-visual.json`(변수·행동 무대 전수 사전) + `data/validate-visual.mjs`(V1~V4·V6·**V7** 통과). 상태층: `E_플레이어.위치`·`ACT_이동`({target})·`ACT_관개기록_해독`·`ACT_카르마_수확`. **'강의 귀환'을 플레이어 손으로 완주**(해독→수확→복구→수문회 반격 목격) 실증. 실행: 저장소 루트 `python3 -m http.server` → `/HktAdvProtoA/game/world.html`.

- `data/world-state.json` — 상태의 유일 원본. **vars 87 · rules 62 · actions 33 · objectives 12 · clocks 2 · subjects 8**. 다섯 층·축 문법 3종·값 4종·`basis` 필수.
- `data/state-engine.mjs` — 공유 결정론 틱 루프 ①~⑦ (`every:N`·duration 지원).
- `data/validate-state.mjs` — WorldState §12 검증 1~13 + WorldLaws §7 법칙검증(회복 짝·EV 매핑·**detail 커버리지 7·노드 커버리지 8**). `node data/validate-state.mjs` (경고 0) · `--strict-coverage` 로 미분류를 오류화.
- `data/detail-coverage.json` — detail 항목 분류 원장(§9-7). 전 노드 detail **363항목 100% 분류(미분류 0)**: 번역 89·서사 83·보류 191. 보류가 곧 콘텐츠 백로그(사유 태그). `--strict-coverage` 는 신규 노드 미분류 회귀 가드.
- `data/load-world.mjs` — 파일 로더(fs). 엔진을 순수하게 유지해 브라우저(objective-tree.html)가 canonical 엔진을 그대로 import.
- `data/simulate-state.mjs` — 무입력 시뮬레이터.

### 대표 사건 5종 — 전부 무입력 자율 재생 (WorldLaws §3 전수 완성)

| 사건 | 단계 | 실증 패턴/교차 |
|---|---|---|
| 1 강의 귀환 | 6/6 | 사슬 기본 · NPC 반격(수문회) |
| 2 늑대 멸종 | 6/6 | 생태 균형 · 완료=상태 술어(사냥 없이 회복) · `S_강흐름` 교차 |
| 3 심연유리 호황 | 6/6 | P5 경제 · 개체 이동(위치 ref) · 두 세력 전쟁 |
| 4 백야혈청 공개 | 6/6 | 생태 연쇄 · `L_굶주린평원`(해충) 교차 |
| 5 아르카론의 죽음 | 9/9 | P1 유지 해제 · 새 존재 등장(#18) · **처리 6방식 보스전(G2.5.3)의 파괴/추방/의식분리 경로** |

`node data/simulate-state.mjs` 기본 사건 1 재생. 각 사건은 방아쇠(`--force`) 시 자율 발화·미트리거 시 휴면. 모든 방아쇠를 주면 5종이 공유 변수 위에서 동시 상호작용(살아있는 세계, 트리 §16 검증 13·14).

### 백야혈청 3세력 충돌 (NPC 정책 — §5·§2.3 충돌의 실행)

`R_백야혈청.공개`(level 소실/독점/제한/공개) 하나를 세 세력이 반대로 당긴다: **치료단**(공개↑) ↔ **상인연합**(독점↓) ↔ **일식사제단**(소실↓). 그래프 3노드(충돌 링크 3) + 정책 3 + 목적 3 + 행동 6. 완료=자기 승리 방향 공개도 술어. 무입력 시뮬에서 t=3 공개도 상승으로 상인·사제 반응 발화 → 3방 tug → 치료단 지속으로 공개 도달 시 **사건 4 방아쇠**(교차). 살아있는 충돌(트리 §16 검증 14). 실증: `node data/simulate-state.mjs`(정책 on).

### 아르카론 처리 6방식 보스전 (G2.5.3, §6.2)

말단 목적 하나에 **7개 행동**(파괴·별빛차단휴면·인공태양복구·차원추방·대체에너지공급·의식분리·지배) — 각 전제가 다르고 `G2.5.3.완료방식`(ref)에 자기 id 를 기록. 완료 판정=완료방식 기록(상태 술어). 방식별 세계 변화: 파괴/추방/의식분리 → 심장핵 파괴 → **사건 5 사슬**(해빙·새 존재); 휴면/복구/계약/지배 → `E_아르카론.잠식`=false 로 P1 유지 법칙(U01~03) 해제(생존 유지·위협 잠복). `LAW_M_지배오염`이 완료방식==지배 전제로 검은태양병 강도를 올려 **완료방식 분기 후속 법칙**을 실증. 일식 약점=`E_아르카론.재생`(CLOCK_일식 구동, 파괴 전제). 실증: `--force R_무광의쐐기.존재=true --at t:ACT_아르카론_파괴@E_플레이어`.

## TODO

- [ ] MMO 4단계 '멀티플레이' — 엔진 서버 이동(WebSocket 스냅샷 diff 구독)·스코프(world/player)·once 행동의 기여 전환·counter(경합 창 대항)·타 아바타 표현 ([Design-MMO.md](Design-MMO.md) §8).
- [x] G2.5.3 아르카론 처리 6방식(§6.2) 보스전 목적·행동 7종 — 무광의쐐기·일식(재생) 전제, 완료방식 분기(파괴/추방/의식분리→사건 5), `LAW_M_지배오염` 후속 법칙. (커버리지 91→99)
- [~] 그래프 NPC 목적 노드 보강 — WorldLaws §5 세력 목적. **완료(7주체): 수문회·잠수단·상인연합(채굴금지·혈청독점)·치료단·사제단·수도원(전승통제)**. 잔여(콘텐츠 트랙, 도구가 추적): 교단·대장간·유목민·보존회(종자보존)·수문회(수원유지)·카르마·늑대.
- [x] §7 법칙검증 7·8(detail·노드 전수 커버리지) 자동화 — 원장 `detail-coverage.json` + 검증기. **전 363항목 100% 분류 완주**(미분류 0). 보류 191 = 사유 태그 백로그.
- [x] objective-tree.html 상태 오버레이 — 노드 현재값 배지·패널 법칙/행동/목적 뷰·**라이브 틱 시뮬**(▶틱/+5/↺). `load-world.mjs` 분리로 브라우저가 canonical 엔진 import(단일 소스).
- [x] §16 검증 자동 점검(validate-graph) — 고립 노드·요소 저연결(<2목적)·말단 단일해결 감사. 현재 고립 4·저연결 67·단일해결 27(`--audit` 목록).
- [ ] G3~G9 말단 목적 전개(콘텐츠 트랙) — 말단 46목적 objective·행동 미구현(§16 감사·커버리지 보류가 추적). 권역 단위로 §9 절차 적용.
