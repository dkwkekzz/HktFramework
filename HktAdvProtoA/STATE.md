# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다:
> [progress/graph.md](progress/graph.md) 구조 그래프 · [progress/world-state.md](progress/world-state.md) 세계 상태(형식) · [progress/world-laws.md](progress/world-laws.md) 세계 법칙(내용).

## 구현 현황 (핵심)

**목적 그래프** — `data/objective-graph.json` (**187 노드 · 188 관계**, 유일 원본). 검증 `node data/validate-graph.mjs`. 관찰·편집기 `objective-tree.html`. 설계: [Design-ObjectiveGraph.md](Design-ObjectiveGraph.md)(정본) · [Design-ObjectiveTree.md](Design-ObjectiveTree.md)(방법론).

**세계 상태·법칙** — 설계 [Design-WorldState.md](Design-WorldState.md)(형식) · [Design-WorldLaws.md](Design-WorldLaws.md)(내용).

- `data/world-state.json` — 상태의 유일 원본. **vars 84 · rules 61 · actions 28 · objectives 11 · clocks 2 · subjects 7**. 다섯 층·축 문법 3종·값 4종·`basis` 필수.
- `data/state-engine.mjs` — 공유 결정론 틱 루프 ①~⑦ (`every:N`·duration 지원).
- `data/validate-state.mjs` — WorldState §12 검증 1~13 + WorldLaws §7 법칙검증(회복 짝·EV 매핑·**detail 커버리지 7·노드 커버리지 8**). `node data/validate-state.mjs` (경고 0) · `--strict-coverage` 로 미분류를 오류화.
- `data/detail-coverage.json` — detail 항목 분류 원장(§9-7). 전 노드 detail **356항목 중 153 분류(43.0%)** — 사건 5종 + 아르카론 보스전 + NPC 목적 8개(백야혈청 3세력 충돌 포함) 시드. 미분류 203은 `data/coverage-backlog.json`(생성물)에 백로그로 출력.
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

- [x] G2.5.3 아르카론 처리 6방식(§6.2) 보스전 목적·행동 7종 — 무광의쐐기·일식(재생) 전제, 완료방식 분기(파괴/추방/의식분리→사건 5), `LAW_M_지배오염` 후속 법칙. (커버리지 91→99)
- [ ] 그래프 NPC 목적 노드 보강 — WorldLaws §5 세력 목적 잔여. **완료: 수문회·잠수단·상인연합(채굴금지·혈청독점)·치료단·사제단**(백야혈청 3세력 충돌). 잔여: 수도원·교단·대장간·유목민·보존회(종자보존)·수문회(수원유지)·카르마·늑대.
- [x] §7 법칙검증 7·8(detail 항목·노드 전수 커버리지) 자동화 — 원장 `detail-coverage.json` + 검증기. 이후 A/B 확장 시 원장을 §9-7 로 채워 커버리지를 올린다(현재 27.2%, 백로그 244).
- [ ] objective-tree.html 상태 오버레이 — 노드 현재값 배지·법칙/행동 뷰·틱 진행 관찰.
- [ ] §16 검증 규칙(요소는 최소 2개 목적에 연결 등) 자동 점검 — 고립 노드·단일 해결 방법 경고.
- [ ] G3~G9 하위 목적의 말단(행동 가능 단위)까지 추가 전개.
