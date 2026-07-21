# STATE — 현재 상태

> **이 문서만 보고 다음 세션을 시작할 수 있어야 한다.** 규칙·불변 원칙은 [CLAUDE.md](CLAUDE.md),
> 설계 본체는 [Design-ObjectiveHierarchy.md](Design-ObjectiveHierarchy.md),
> 실행 계획은 [Design-StepPlan.md](Design-StepPlan.md). 완료 이력은 git.

## 현재 — 한눈에

- **엔진(StepPlan 6 Phase 19 step) + 콘텐츠 단계 C1~C7 + 플레이어블 P0 완료.** (엔진: A 기질 ·
  B 코어 · C 발견 · D 시각화 · E 플래너 · F 다중 행위자 = M1~M6 / 콘텐츠: C1~C7 / **P0: 사람이
  브라우저로 접속해 실제로 플레이한다** — `/play.html`, 아래 P0 절).
  `bash run.sh` 또는 Windows `run.bat` = 설치 → `npm test`(**164 케이스** 전건 통과) → 데모 서버.
  순수 JS(ESM, Node 20+), 런타임 의존은 `js-yaml` 1개. 자동 회귀와 데모(눈 검증)가 같은 코드 경로.
- 살아있는 세계 관전이 원클릭으로 재현된다: 봇 N기가 각자 독립 믿음으로 목적 그래프를 굴리고,
  같은 무대의 유한 공급을 두고 경쟁하며, 한 봇의 완료 `aftermath` 가 세계를 바꿔 다른 봇의 새 목적을
  낳는다. 그래프는 **액터의 믿음**(발견·가설 반증·역결합), **방사형·별자리 뷰로 보이며**(렌더러는
  Scene 서술자만 소비), **세계는 목적에 재해석으로 응답한다**(스폰 금지 + 규칙 분해 + E2 관문).
- 여섯 불변 원칙이 모두 회귀 테스트로 고정됨: ① done_when 경로 무관 · ② 속성 기반 다중 해법 ·
  ③ 그래프=믿음 · ④ 재해석(스폰 금지) · ⑤ 자동+눈 이중 검증 · ⑥ 렌더러 의존 방향(src import 0).
- **게임 콘텐츠 층이 섰다** — [Design-WorldComposition.md](Design-WorldComposition.md) v0.1:
  세부 목적 구성(일곱 뿌리 전반 전개) + 지역·요소 설계·배치(R0~R6) + 만드는 순서(콘텐츠 단계
  C1~C7). 배치 3원칙(㉠ demand 속성마다 공급 무대 ≥ 2 — 예외는 사유 명시 강제 · ㉡ 무대는
  복수 목적에 봉사 · ㉢ 위험·거리·시간이 가격)이 `test/world-composition.test.js` 5건으로
  기계 고정(전 무대 배치·인접 대칭·속성 대역·공급 행렬·주기 정합).
- 설계·seed 데이터:
  - [Design-ObjectiveHierarchy.md](Design-ObjectiveHierarchy.md) v0.3 · [Design-Visualization.md](Design-Visualization.md) v0.1 ·
    [Design-StepPlan.md](Design-StepPlan.md) v0.1 (6 Phase 19 step).
  - [data/objective-graph.yaml](data/objective-graph.yaml) v0.2 — **61 노드·12 무대·경고 0**.
    0.1.1.1 정체(월식 가설 H1)·0.1.1.2 약점(H1/H2 경합)·0.1.1.3 제작·0.1.1.4 접근·0.1.1.6 규합·
    0.1.2 둥지·0.2 성장(장비·약물)·0.3 자원·0.4 적응까지 말단 전개. B1 로더가 상시 기계 인수.
  - [data/world-composition.yaml](data/world-composition.yaml) — 지역·배치의 정본: 7 지역
    (인접·이동 비용·환경), 재료 아키타입 속성 대역, 주기 5(순행·월식·한파·호송·무리분산),
    supply_exceptions(사유 있는 공급 예외 2).
  - [data/property-lexicon.yaml](data/property-lexicon.yaml) — 속성 사전(속성명의 정본, 내한성·독성 포함).
  - [data/world-slice1.yaml](data/world-slice1.yaml) — Slice-1 세계 픽스처(B4): 조직 조각 개체
    (소멸타이머)·봇 1기·시간 진행.
  - `data/objective-graph.yaml` + `world-composition.yaml` 에 **R0 결전 무대 S-0701**(신육체) 배치(C7).

### 콘텐츠 단계로 참이 된 명제 (`src/content/`)

엔진 위에 게임을 올리는 콘텐츠 층. 새 콘텐츠 기계 3개 + 단계별 시나리오. 엔진(`src/` A~F)은
손대지 않고, 상태 변경은 여전히 법칙 `apply()`(또는 원장 mint/burn=세계 경계) 로만.

- **콘텐츠 기계**: `cycles.js` CycleClock — 틱 루프가 순행·월식·한파·호송·무리분산 창을 구동하고
  상태형 재료(`world.주기.*`·`world.환경.기온`·`stage.*.잔여시간/신선도`)를 되채운다. 순행이 무대를
  재생성하는 첫 사례. `regions.js` RegionMap — 인접·이동 비용(틱) 다익스트라 + R0 월식 접근권.
  `laws.js` — 콘텐츠 동사(일반 채취·결합·비교·협상·전투·조율·정제·포획·탐색) 등재. `engine.js`
  ContentSession — 세계·원장·사건·법칙·시계·지역·봇 믿음을 묶는 공용 하네스.
- **C1** 첫 사냥터: 순행 창 안 표본+관찰+조사+수확 4목적 완주(성공) / 창(20) 놓치면 소멸·풍화로 실패.
- **C2** 가설의 탄생: 심장 1개 채취가 약물(0.2.3.2)·약점(0.1.1.2) 이중 파문 · H1 확인/H2 경합 유지.
- **C3** 재료의 세계: 같은 무기급 demand 를 채굴형/전투형 두 봇이 다른 경로로 충족(§5 행렬 실행) ·
  위협 제거=재료 획득 겹침(둥지→뼈) · 균류 역결합 · 무기 결합은 에너지저장 공급 0 이라 아직 막힘.
- **C4** 앎의 문: 지식 없는 봇 문전 차단 / 지식 봇 조율 개방 · E2 백로그에서 0.1.1.3.3 이탈(공급 0→1).
- **C5** 타인의 세계: 거래/강탈이 같은 표본 done_when 을 충족하되 세계 상태(숭배단 적대)를 다르게
  남긴다(원칙 ①) · 수송 차단→세력 약화(0.1.1.6.2→0.1.4 이중 파문).
- **C6** 기다림의 세계: 내한 장비/적응 확보 · 한파 창에만 유효 저온 판정 · **H2 반증→가지 붕괴,
  그러나 장비·적응은 완료로 잔존**(실패한 가설 ≠ 낭비) · 전 주기 겹침.
- **C7** 결전과 그 후: 무기 파괴형·수송 차단 아사형 두 해법이 같은 G-0.1.1 done_when 을 충족(경로
  무관, 원칙 ① 최종 실증) · 월식 창 밖 R0 차단 · aftermath 대전환→B3 재개방(0.1.2) + E2 신규 목적 편입.
- **엔진 미세 확장(하위 호환)**: `Substance.epistemic`(지식 재료의 확인 상태 — 술어 DSL 이 이미
  기대하던 필드) 보존. `substrate/laws.js`·기존 회귀는 불변.

### Phase A 로 참이 된 명제 (`src/substrate/`)

- **A1** `package.json`·`demo/server.js`(node:http)·`run.sh`·`demo/shot.js`(브라우저 없으면 스킵+경고).
  서버 기동→`GET /`→200 및 `/api/demo` 스냅샷이 테스트로 상시 회귀.
- **A2** `lexicon.js`·`substance.js` — 속성명은 사전이 정본, 미등재 속성 조회는 **예외**.
  `World.scan` 은 아키타입이 달라도 속성만 맞으면 찾는다(다중 해법의 씨앗, 불변 원칙 ②).
- **A3** `ledger.js` — 사유(cause) 필수 이체 + 보존 불변식 `audit()`(mint == Σ잔고 + burn).
  무작위 이체 200회 후에도 성립. `mint/burn` 은 세계 경계 사유 전용.
- **A4** `predicate.js` `evalPred(pred, ctx) → {value, trace}` — `all/any/not/has/state/epistemic/event`
  + 비교 6종 + `const.<이름>` 해석. `epistemic`/`event` 는 belief/events 미주입 시 **스텁**
  (인터페이스만 고정 — C1/A5 에서 실체화). trace 가 "숫자 없는 진행"의 먹이.
- **A5** `events.js`(append-only) · `laws.js` — **상태 변경의 유일한 경로는 `apply`**(법칙 존재→
  에너지 지불→상태전이→사건 기록, 원자적). 법칙 밖 전이 거부. 절편 동사 `채취`·`관찰` 등재
  (나머지 15 동사는 표 비움). `채취` 순도=정밀도 함수, `event` 술어가 사건 로그를 실판정.

### Phase B 로 참이 된 명제 (`src/graph/`, `src/actors/`)

- **B1** `schema.js`(17 동사·발견 4값·필수 필드) · `loader.js` — seed 그래프를 "검증된 데이터"로
  인수. 검사: id 유일성·`serves`/`stages`/`alternatives` 참조 무결·`serves` DAG(사이클)·뿌리 `G-0`
  도달·술어 파싱(A4)·demand/supplies 속성 사전 등재·17 동사·`predicate_dsl` 버전·죽은 무대(경고).
  **주의**: seed 의 `serves` 는 분해 에지와 공급 에지(DAG 교차)를 겸하므로 "말단만 verb" 구조 결합은
  강제하지 않고 verb 어휘만 검사. bad 픽스처 15종으로 각 거부를 증명.
- **B2** `demand.js` `matchDemand` — 보유형은 인벤토리·세계 속성 스캔, 상태형은 상태 창 판정.
  **다중 해법 기계 증명**: 서로 다른 archetype 2종(조직 조각·권속 심장)이 같은 잔향 demand 를 충족
  (불변 원칙 ②). 시간 창 밖이면 미충족 + `nextInfo`.
- **B3** `complete.js` `checkDone`(= done_when 의 현재값, 영구 플래그 아님 → 세계 변화 시 재개방) ·
  `ripple.js` — 완료가 `serves` 계보를 타고 상향 파문(조상마다 조건 trace). DAG 다중 부모면 갈래별
  파문(권속의 심장 → `G-0.2.3.2`·`G-0.1.1.2` 동시). **경로 무관 판정** 회귀 고정(불변 원칙 ①).
- **B4** `data/world-slice1.yaml` · `actors/bot.js` `runSlice` — 봇 v0(계획 없음, 반응만)가 사슬을
  자동 완주(M2). 시간 압박: 소멸타이머 > 이동 → 성공 / 짧으면 무대 소멸 → 실패. 완주 후 `audit()`
  + 사건 로그 감사 성립.

### Phase C 로 참이 된 명제 (`src/epistemic/`)

- **C1** `belief.js` `BeliefView` — 액터별 발견 상태(미발견/추정/확인/반증). 미발견 노드는 봇 시점
  그래프에서 "?" 로만, 미발견 무대는 좌표 대신 탐색 영역 단계로만. 두 액터의 믿음이 독립.
  **A4 `epistemic` 스텁 해제** — `ctx.belief` 주입 시 `BeliefView.query(spec)`(target/tag)로
  실판정(`G-0.1.1.2` 의 done_when 이 이제 실판정). belief 미주입 시 여전히 스텁(하위 호환).
- **C2** `hypothesis.js` — 가설(추정 지식 노드) 판정: 실험 반응 vs 예측 → 확인(재현 ≥ `재현_최소`)
  / 반증. 반증 시 그 가설에만 매달린 하위 가지가 믿음에서 붕괴(모든 부모가 붕괴 집합일 때만 —
  다른 살아있는 부모가 있으면 생존, DAG 의 이점). 경합 가설 H1 확인 / H2 반증·붕괴 → `G-0.1.1.2`
  충족·파문. 법칙 표에 `실험`·`검증` 동사 추가. (M3)
- **C3** `retrobind.js` — 획득 시 발견된 어떤 demand 와도 안 닿는 재료 = 용도 불명. 새 가지 발견 시
  보유 재료를 그 demand 에 대조해 매칭되면 `retro-bind`(가지 발견 전이 + 재료·노드 연결).

### Phase D 로 참이 된 명제 (`src/scene/`, `demo/graph-*.js`)

- **D1** `scene/viewmodel.js` `buildScene` — `세계+BeliefView+이벤트 → Scene 서술자`. `goalGraph.nodes`
  는 BeliefView 파생(미발견은 "?", 전역 제목 비노출). 속성→채널 번역표 `data/channel-map.yaml`
  (GLOW·JITTER). 조건 슬롯 = trace 서술 텍스트(퍼센트 금지). ViewModel 은 순수(스냅샷 회귀).
- **D2** `demo/graph-radial.js` — 방사형 뷰(깊이 환). 발견 상태 4값 문법(확인=선명/추정=흐림·떨림/
  미발견=성운"?"/반증=붕괴 X). 조건 슬롯 텍스트.
- **D3** `demo/graph-constellation.js` — 별자리 + 파문 연출. `effects`(ripple 경로·collapse·retro-bind)
  소비 — 파문 경로는 ViewModel 이 계산(렌더러 재유도 금지). 권속의 심장 2갈래 동시 파문.
- **불변 원칙 ⑥ 기계 강제**: 렌더러(`demo/graph-*.js`)가 `src/` 를 import 하지 않음을 스캔 테스트로
  고정. shot ①②는 브라우저 없으면 스킵+경고(등록만).

### Phase E 로 참이 된 명제 (`src/planner/`)

- **E1** `reinterpret.js` `scan(demand, world) → StageCandidate[]` — 이미 존재하는 세계 요소를 속성
  매칭으로 Stage 후보(§4.5)로 감싼다. supplies ⊆ 요소의 실속성, obstacles 는 실속성에서 파생
  (발명 금지). **스폰 금지**: 없는 것은 후보가 되지 않고, 스캔은 세계를 바꾸지 않음(읽기 전용).
  후보는 미발견(발견은 C1 경로로만). 불변 원칙 ④ 회귀 고정.
- **E2** `constraints.js` `checkBranch` — (a) demand 가 재료 10종으로 환원 (b) done_when 이 DSL 로
  기계 판정 가능 (c) 응답 기회가 세계에 ≥ 1 실존(E1 스캔 재사용). B1 정적 검사의 동적 확장.
  `backlogAgainstWorld` — 절편 세계 대비 (c) 실패 = "아직 무대 없는" 백로그(G-0.1.1.3.2/3.3 등).
- **E3** `decompose.js` — 분해 템플릿 표(`data/decompose-templates.yaml`, 장애물 유형 → 하위 목적
  골격)로 상위 목적+세계 → 하위 목적 계산. 후보는 E2 관문 통과 후에만 편입, `epistemic:추정`.
  **두 세계 분해 차이**: 같은 목적을 육체형 신(→파괴 수단)/신앙형 신(→숭배 교란)에 다르게 분해.
  LLM 접합면(입력·출력·관문·반려)은 `decompose.js` 주석에 고정 — 규칙이든 LLM 이든 접합면 동일.
### Phase F 로 참이 된 명제 (`src/actors/multibot.js`)

- **F1** `multibot.js` `runMultiSim` + `data/world-multi.yaml` — 봇 N기가 각자 독립 `BeliefView` 를
  굴린다. 유한 공급 무대에서 **선착 소진 경쟁**(A 성공 / B 밀림). 완료 `aftermath` 가 세계 상태를
  바꾸고 사건으로 감사되며(원장·사건 정합), 드러난 요소로 **E3 플래너를 깨워** 봇 B 에 신규 목적
  (G-0.1.4) 발견 + 하위 목적 계산. 두 봇의 믿음 독립. N봇 후 `audit()`·사건 감사 성립.
- **F2** 관전 통합 — 서버가 `/api/demo` 로 관전 Scene 서술자를 방송(폴링), 데모가 봇 관전 뷰
  (완료 파문 + aftermath 신규 목적)를 렌더. shot ③ 등록. `bash run.sh` 원클릭 관전(M6).
- 타 트랙 참조 없음 — 이 폴더 안에서 완결.

### 플레이어블 P0 로 참이 된 명제 (`src/play/`, `demo/play.*`)

**사람이 실제로 플레이한다** — [Design-Playable.md](Design-Playable.md). 봇이 아니라 브라우저의
사람이 입력을 넣고, 그 입력이 봇과 완전히 같은 사슬(법칙 `apply` → done_when → 파문)로 세계를
바꾼다. `npm run demo` → `/play.html` 접속(같은 주소를 여러 탭/기기로 열면 같은 세계 — 멀티).

- `src/play/game.js` PlayGame — join(접속)·move(지역 그래프 이동, 액터별 travel — 전역 시계와
  분리)·act(법칙 경유 + 무대 관문: 시간 창·gate 주기·consume 소진)·setActiveGoal(말단 카드 교체)·
  tick(실시간 구동)·state(플레이어 시점 payload — 믿음 밖은 "?"). 도착 = 무대 발견.
- `data/world-play.yaml` — 플레이 페이싱 픽스처: 주기 축소판(순행 90/25 등, 서로 소 유지),
  원천 규약 regen(리듬 재생성)/gate(창에만)/consume(선착 소진), 초기 에너지.
- `demo/server.js` `/api/play/*`(join/act/move/goal/state) — 규칙 거부는 오류가 아니라 피드백
  (`{ok:false,error}`). `demo/play.html`+`play.js` — 지도(클릭 이동)·무대 카드(행동 버튼)·목적
  카드(조건 서술, 퍼센트 금지)·주기 칩·피드·소지품. 클라이언트에 게임 규칙 0 (src import 0 을
  테스트로 강제 — 원칙 ⑥의 플레이 버전).
- `test/play.test.js` 9건 — C1 루프 사람 입력 완주(채취→관찰→수확, 파문)·시간 창 거부·이동
  비용/발견·R0 월식 잠금·심장 소진 경쟁(선착 1명, DAG 이중 파문)·플레이어 독립·HTTP 종단·원칙 ⑥.
- 눈 검증: 헤드리스 캡처로 플레이 화면 재현 확인(주기 칩·비활성 버튼=창 밖·이중 파문 피드·
  동거 존재 표시). `?name=` 자동 입장·`?id=` 재접속으로 스크린샷 재현 가능.

## NEXT — 다음 할 일 (P1 — 플레이가 깊어진다)

**P1** ([Design-Playable.md](Design-Playable.md) §4): 전투(둥지·수송대)와 제작 개입(결합 중 폭주
제어)을 과정으로, 방사형/별자리 뷰를 플레이 화면에 통합(내 믿음 그래프 열람), 가설 수립·실험
UI(H1/H2), 상향 발견 연출, demand 공명 표시. 완료 판정 = "사람이 브라우저로 그 플레이를 실제로
할 수 있고, 같은 플레이가 테스트로 재현된다".

병행 가능한 방향:
- **콘텐츠 확장**(Design-WorldComposition §8): 스텁 가지(0.5 거점·0.7 존재 확장 등) 전개 + §5
  행렬 행 추가(공급 무대 ≥ 2) + 주기/대역 튜닝(이제 실플레이 감각으로 조정 가능).
- **P2 영속·계정 / P3 월드 렌더**(Design-Playable §4, Design-Visualization) · **LLM 플래너**
  (접합면 `decompose.js` 주석) · **단계 통합 장편 시나리오**(C1→C7 한 세계 완주).

재사용 자산: 엔진 `src/`(A~F) + 콘텐츠 `src/content/` + 플레이 `src/play/` + `demo/` +
**164 케이스 회귀**. 새 콘텐츠 = 픽스처 + 시나리오 + 테스트 (엔진은 손대지 않는 게 기본).
