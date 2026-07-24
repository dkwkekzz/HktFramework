# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다:
> [progress/graph.md](progress/graph.md) 구조 그래프 · [progress/world-state.md](progress/world-state.md) 세계 상태(형식) · [progress/world-laws.md](progress/world-laws.md) 세계 법칙(내용) · [progress/mmo.md](progress/mmo.md) MMORPG 웹 프로토타입 · [progress/motive.md](progress/motive.md) 동기층 · [progress/intuition.md](progress/intuition.md) 직관·욕망 신호 변환층.

## 구현 현황 (핵심)

**주체 세계상태 배선(§18 검증 18)** — 존속 루트 주체 **24/24 전수 배선**(플레이어 + 정책 세력 10 + 생태·질병 7 + 이름 개체 6[아르카론·거인·세리아·오르반·구름고래·기억나방]). 화이트리스트 0 = 검증 18 초록. 요소 다주체 재배선은 구조적 바닥(검증17 단일주체 **3**·저연결 3 — 잔여는 미탄생 존재 등). 상세 [progress/world-state.md](progress/world-state.md)·[progress/graph.md](progress/graph.md).

**목적 그래프** — `data/objective-graph.json` (**228 노드 · 345 관계**, 유일 원본). **§18 복수화: 24개 "존속해야 한다" 루트 트리**(플레이어 G0 + 23주체 — 세계 정본=주체 트리들의 교차). 검증 `node data/validate-graph.mjs`(§16 감사 + §18 복수화 감사 검증16/17, `--audit` 목록). 관찰·편집기 `objective-tree.html`(상태 오버레이·라이브 틱 시뮬). 설계: [Design-ObjectiveGraph.md](design/Design-ObjectiveGraph.md)(정본) · [Design-ObjectiveTree.md](design/Design-ObjectiveTree.md)(방법론).

**세계 상태·법칙** — 설계 [Design-WorldState.md](design/Design-WorldState.md)(형식) · [Design-WorldLaws.md](design/Design-WorldLaws.md)(내용).

**MMORPG 웹 프로토타입** — 로드맵 1~4단계(지도→아바타→개입→멀티) 완료. 클라 `game/world.html`(로컬/원격 겸용) · 서버 `game/server.mjs` · 표현 데이터 `data/world-map.json`·`data/world-visual.json` · 검증 `node data/validate-visual.mjs`(V1~V7). 멀티 실행: `node HktAdvProtoA/game/server.mjs` → `/game/world.html?online&name=이름`. 설계 [Design-MMO.md](design/Design-MMO.md) · 상세 [progress/mmo.md](progress/mmo.md).

### 핵심 파일

- `data/world-state.json` — 상태의 유일 원본. **vars 170 · rules 88 · actions 109 · objectives 37 · clocks 2 · subjects 24**. 다섯 층·축 문법 3종·값 4종·`basis` 필수. 인지 축 16(플레이어 노출 목적).
- `data/material-families.json` — **D2 재료=가능성 카탈로그**(§7·§8). 23 R 재료 → 성질 계열 7종 + 3용도(즉시·조합·사건). 감사 `data/validate-material.mjs`(성질 계열 100%·핵심 3용도·via 배선 교차검증·조합 행동 존재).
- `data/state-engine.mjs` — 공유 결정론 틱 루프 ①~⑦ (`every:N`·duration 지원). `data/load-world.mjs` 로더(fs)로 엔진을 순수 유지 → 브라우저가 canonical 엔진 그대로 import.
- `data/validate-state.mjs` — WorldState §12 검증 1~13 + WorldLaws §7 법칙검증(회복 짝·EV 매핑·detail/노드 커버리지) + **§18 검증 18**(그래프↔세계상태 층 교차, 배선 24/24·화이트리스트 0). `node data/validate-state.mjs`(경고 0) · `--strict-coverage`.
- `data/detail-coverage.json` — detail 분류 원장(§9-7). 전 **597항목 100% 분류**(미분류 0): 번역 102·서사 85·보류 410. 보류=콘텐츠 백로그(사유 태그). `--strict-coverage` 가 신규 노드 미분류 회귀 가드.
- `data/simulate-state.mjs` — 무입력 시뮬레이터(대표 사건 재생). `data/simulate-motive.mjs`·`data/simulate-walk.mjs` — 동기층·§10 완주 실증 봇. `data/validate-motive.mjs` — 동기층 검증(M2~M9·불변8).
- `data/simulate-latejoin.mjs` — **D0 늦은 진입자 프로브**(§20 D0 검증). 세계 T0 틱 주행 후 갓 도착한 눈(결핍·인지 리셋)으로 W틱 관찰 → 압력·필요(위협 기원)·기회 각 ≥1 감사. t=100~800 초록. "살아있는 채로 유지되는 세계".

### 대표 사건 5종 — 전부 무입력 자율 재생 (WorldLaws §3, 상세 [progress/world-laws.md](progress/world-laws.md))

| 사건 | 단계 | 실증 패턴/교차 |
|---|---|---|
| 1 강의 귀환 | 6/6 | 사슬 기본 · NPC 반격(수문회) |
| 2 늑대 멸종 | 6/6 | 생태 균형 · 완료=상태 술어 · `S_강흐름` 교차 |
| 3 심연유리 호황 | 6/6 | P5 경제 · 개체 이동 · 두 세력 전쟁 |
| 4 백야혈청 공개 | 6/6 | 생태 연쇄 · `L_굶주린평원` 교차 |
| 5 아르카론의 죽음 | 9/9 | P1 유지 해제 · 새 존재 등장 · 처리 6방식 보스전(G2.5.3) |

`node data/simulate-state.mjs` 기본 사건 1 재생. 각 사건은 `--force` 시 자율 발화·미트리거 시 휴면. 모든 방아쇠를 주면 5종이 공유 변수 위에서 동시 상호작용(살아있는 세계). 살아있는 충돌 2종: **백야혈청 3세력 tug**(치료단↑↔상인연합↓↔사제단↓ on `R_백야혈청.공개`) · **아르카론 처리 6방식 보스전**(G2.5.3, 완료방식 분기 후속 법칙). 상세 [progress/world-laws.md](progress/world-laws.md).

## TODO

> **작업 기준**: 모든 콘텐츠·표현 작업은 [Design-Intuition.md](design/Design-Intuition.md) 1차 기준 — 신규/개정 목적은 §14 변환 8항 선행, 절차는 §21, 순서는 §20 D 시리즈 (CLAUDE.md '작업 기준' 참조).

### 진행/백로그

- [~] **직관·욕망 신호 변환층 D0~D4** (진행 중 — D0·D1·D2 핵심 완료) — 2026-07 진단 4단절(세계 자가소진·진입 화면 분리·저널 지시 부재·인지 커버리지 구멍) 해소 트랙. **D0 위협 재발화 사이클 + 늦은 진입자 프로브 ✅**(단절1) · **D1 토스트 배선 복구 + 인지 축 4종 구멍 해소 ✅**(단절2·4) · **D2 재료 성질 계열 + 다용도 + 조합 행동 + 다용도 감사 ✅**(아래 완료 항목). 잔여 D0(NPC 속도 차·클럭 확장)·잔여 D1(욕망 대상 가시화 신호층·진입 화면 기본 진입)·잔여 D2(핵심 재료 배선 확대·조합 결과 다양화)는 후속. 다음: D3 실패=사건 → D4 상황 제공(저널 재정위). 설계 [Design-Intuition.md](design/Design-Intuition.md) · 진단·구현 [progress/intuition.md](progress/intuition.md).
- [~] **G3~G9 말단 목적 전개** (콘텐츠 트랙) — 권역 단위 §9 절차 **+ Intuition §14 변환 8항 선행(§21①)**. 사슬 완결 17/56 닫힘(G2.3.1·G2.5.2·G1.3.1·G3.2.1·G1.4·G1.5·G4.2·G5.2 등, 각 브라우저 스모크 실측). 잔여는 §16 저연결 요소부터 앵커. 상세 [progress/world-laws.md](progress/world-laws.md).
- [ ] **요소 재배선·검증10 관계 커버리지** (상시 백로그, 완료 지점 없는 점진 트랙 — §19 '요소는 점진 허용') — ① 검증17 잔여 3(재등쥐여과털 다주체 재배선·미탄생 존재 고대생명체/별빛종족은 등장 조건 설계 후 subjectKind 승격) ② 검증10 미상태화 관계(필요 49/140·제공 11/44·방해 42/64) 권역 단위 상태화.
- [ ] **동기층 표현 폴리시 이월 (→ Intuition D 시리즈로 흡수)** — 앎 인스펙터 K 연동(D4 설명 후행) · 유산 연대기 임계 기여자 명기(D1 신호) · OBJ_G1.1.1 저널 목적화(D4 저널 재정위와 함께) · 형의 사례화 확대 · M8② 관계성 배선 확대(D0 완료 반응). 상세 [progress/motive.md](progress/motive.md).
- [ ] **MMO 후속** — 잔여 once 플레이어 행동(늑대 계약 등) 캐릭터별 재검토 · counter(경합 창 대항 — 수문회 습격 격퇴) · 기여 전환 확대 · world 목적 discover 캐릭터별 평가. 상세 [progress/mmo.md](progress/mmo.md).

### 완료 (상세는 progress/)

- [x] **D2 재료=가능성 — 성질 계열 + 다용도 + 조합 행동 + 감사** ✅ 2026-07 — 재료를 '수집물'에서 '가능성'으로(§7·§8). ① `data/material-families.json`: 23 R 재료 → 성질 계열 7종(불꽃·한기·생체·별빛·기억·치유·양식)·핵심 6은 즉시·조합·사건 3용도. ② 조합 verb 배선: `ACT_조합_생체재생낭`(수분핵+재생섬유→상처−1·온기+1, 예상 밖 휴대 회복) + `ACT_속털_두르기`(즉시 온기) + `LAW_속털냄새`(보유≥4 사건). ③ `data/validate-material.mjs`: 성질 계열 100%·핵심 3용도·via 배선 교차검증(19건)·조합 행동 존재. rules 87→88·actions 107→109. 9종 검증 초록. → [progress/intuition.md](progress/intuition.md).
- [x] **D1 신호층 — 토스트 배선 복구 + 인지 축 4종 구멍 해소** ✅ 2026-07 — 진단 단절2(진입 화면 배선 버그) + 단절4(인지 구멍) 해소. ① `game/world.html`: 「새 목적」 토스트가 world 지도 모드에서 렌더 안 되던 버그(:383↔:661) — `drawToasts()` 추출해 지역·지도 양쪽 호출. ② 인지 축 없던 플레이어 목적 4종(G_늑대복원·G_인공백야초재배·G5.2·G2.5.3)에 인지 축+법칙+저널 배선(불변8 경험 술어·§21). 자율 도달 3종·G_늑대복원은 조건부(D0로 늑대 자율 멸종 안 함). validate-motive에 **M9 조건부 도달 검사**(인지⇒발견가능 정합) 추가. rules 83→87·vars 166→170. 8종 검증 초록. → [progress/intuition.md](progress/intuition.md).
- [x] **D0 세계 재장전 — 위협 재발화 사이클 + 늦은 진입자 프로브** ✅ 2026-07 — 진단 단절1(세계 자가소진·가장 큼) 해소. 늑대 위협을 `압력→발화→해소→재축적` 유계 사이클로: `RULE_숲_회복` 상한(먹이<보통)·`LAW_숲_자생`(강 무관 자생 회복)·`LAW_늑대_방목압`(재압박) 3법칙이 먹이를 1↔2 진동시켜 `X_늑대공격` 재점화(엔진 무변경, rules 81→83). 1000틱 최소늑대37·`EV_늑대멸종` 미발동. 신설 `data/simulate-latejoin.mjs` 프로브(t=100~800 ✅): 갓 도착한 눈으로 압력·필요(위협 기원)·기회 각 ≥1 감사. 덤: 플레이어 목적 `G2.1` 자동완주 해소. 기존 검증 8종 초록 유지. → [progress/intuition.md](progress/intuition.md).
- [x] **직관·욕망 신호 변환층 설계 확정 + 4단절 진단** ✅ 2026-07 — 목적 트리↔플레이어 직관 연결 설계(§1~§18 원문 + 충돌 6건 층 분리 해소 §19 + 로드맵 D0~D4 §20) 정본화. 실측 진단: 목적·동기 기계 실존하나 세계 자가소진(무입력 t60 사건 3종 자체 완결·위협 비재장전)·진입 화면 분리·저널 지시 부재·인지 커버리지 구멍. → [Design-Intuition.md](design/Design-Intuition.md)·[progress/intuition.md](progress/intuition.md).
- [x] **주체 세계상태 표현 전수 (Phase 0~3)** ✅ 2026-07 — 검증 18 구현(Phase 0) + 생태·질병 7(Phase 1, law) + 세력 4 정책화(Phase 2, 3 tug) + 이름 개체 6 승격 → 배선 7/18→**24/24**. Phase 3 요소 재배선 검증17 70→**3**(구조적 바닥). → [progress/world-state.md](progress/world-state.md)·[progress/graph.md](progress/graph.md).
- [x] **트리 복수화 (§18) + 이름 개체 6 승격** ✅ 2026-07 — validate-graph 검증 16·17 감사 + 24개 존속 루트 트리 + subjectKind 승격(아르카론·거인·세리아·오르반·구름고래·기억나방, 상태 축 설계·tug 포함). → [progress/graph.md](progress/graph.md)·[progress/world-state.md](progress/world-state.md).
- [x] **동기층 M1~M6 완결** ✅ 2026-07 — 결핍 삼축(허기·온기·상처) + 인지·묻기·저널 + 탐욕(심연유리 경제) + 인정(관계.F_* 편들기·문 닫힘). 5욕망 갈래 병렬. 6검증·sim 3종·§10 완주. → [progress/motive.md](progress/motive.md).
- [x] **G2.5.3 아르카론 처리 6방식 보스전** ✅ — 행동 7종·완료방식 분기(파괴/추방/의식분리→사건 5)·`LAW_M_지배오염` 후속. → [progress/world-laws.md](progress/world-laws.md).
- [x] **그래프 NPC 목적 노드 보강** ✅ — WorldLaws §5 세력 목적 전주체 확보(정책화는 위 '주체 세계상태 표현 전수'가 완결, 검증 18 추적).
- [x] **§7 법칙검증 7·8 자동화** ✅ — 원장 `detail-coverage.json` + 검증기(전 항목 100% 분류, 미분류 0).
- [x] **objective-tree.html 상태 오버레이** ✅ — 노드 현재값 배지·패널 뷰·라이브 틱 시뮬. `load-world.mjs` 분리로 브라우저가 canonical 엔진 import.
- [x] **§16 검증 자동 점검(validate-graph)** ✅ — 고립·요소 저연결·말단 단일해결 감사(`--audit` 목록).
