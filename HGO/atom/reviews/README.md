# reviews/ — 회고·서사 레이어 (왜·정합성·진척을 step 위로)

> atom 트랙의 닫힌 step 을 *위 고도*에서 본다. step 문서가 *한 조각을 어떻게 구현했나*라면, reviews 는 *왜·정합한가·목표에 얼마나 왔나*를 푼다. 방법·포맷은 `.claude/skills/hgo-atom-review/SKILL.md`.
>
> 판정은 PASS 주장이 아니라 **실물 코드(`../engine/*.js`) + verify 재현**으로. 닫힌 문서는 불변(역사) — 단 §2 열린 이슈 원장만 갱신(해소분 떨굼).
>
> 권위 분리: 현재·다음 = [../STATE.md](../STATE.md) · 척추 = [../../SPINE.md](../../SPINE.md) · arc = SPINE §8. reviews 는 **읽기 회고 + 전방 권고**일 뿐 STATE 를 대체하지 않는다. 찾은 load-bearing 이슈는 §2 원장에 권고로 쌓이고, step-loop(`hgo-atom-step`)이 그걸 *읽어* STATE §2/§3 로 승급·구현한다(전파 고리, §2).

---

## 0. 네 고도 (각자 다른 질문 — 늘어나는 곳을 가른다)

| 문서 | 답하는 질문 | 단위 | 늘어남 |
|---|---|---|---|
| [FOUNDATIONS.md](FOUNDATIONS.md) | 왜 이 세계관? (다발·세 기둥) | 프로젝트 | ❌ 동결 |
| **phase-X.md** | 이 Phase: 이론 배경·게임 표현·목표 진척? | Phase (≤5) | Phase당 1편 |
| **review-NNNN-MMMM.md** | 이 10 step: 척추 지켰나·이슈? | 묶음 | 묶음당 1편 |
| `../steps/step-NNNN.md` | 이 한 조각: 어떻게 구현? | step | step당 1편 |

> 늘어나는 건 *아래 두 고도*(묶음·step)로 흐른다. 위 둘(프로젝트·Phase)은 SPINE 처럼 거의 동결 — FOUNDATIONS 는 step 표를 두지 않고, phase 문서는 Phase 단위(≤5)로만 는다. (SPINE 의 STATE=step 고도 / §8 arc=Phase 고도 분리를 물려받음.)

### Phase 서사 인덱스 (이론·표현·진척)
| Phase | 서사 | 상태 |
|---|---|---|
| A 무대 | [phase-A-stage.md](phase-A-stage.md) | 🟢 닫힘(0001) |
| B 빛 | [phase-B-light.md](phase-B-light.md) | 🟢 닫힘(0002~0008) |
| C 화학 | [phase-C-chemistry.md](phase-C-chemistry.md) | 🟢 닫힘(0009~0027 결합 기하) |
| D 핵 | [phase-D-nuclear.md](phase-D-nuclear.md) | 🟢 닫힘(0031~0053 변환·안정성·발열·시계열·율 두 방향·상대론·**철 봉우리 완성**) |
| E 별 | [phase-E-star.md](phase-E-star.md) | 🟡 성숙(0028~30 씨앗 + 0054~64 인프라 + 0063·65·66·68·70 붕괴→점화→사다리 + **0071~80 죽음·분산→일생 순환→세대 재점화·SPINE §4 순환 종착 서명**·*공간 분리 2세대 별 미*) |

## 1. 묶음 감사 인덱스 (한 줄/묶음)

| 묶음 | 범위 | 호(arc) | 척추 판정 | 열린 이슈 |
|---|---|---|---|---|
| [review-0001-0010](review-0001-0010.md) | 0001~0010 | 무대(A) → 빛(B) → 화학의 문(C) | ①✅ ②✅ ③🟡 ④✅ | #1 바스 비국소 · #3 xMax 리터럴 (+#2·#4 종속) |
| [review-0011-0020](review-0011-0020.md) | 0011~0020 | 빛 Z 정밀화 · 화학 회계·기하 진입 | ①✅ ②✅ ③🟡→개선 ④✅ | #1 bondE 해소(0015)·바스만 잔존 · #5 연속력 O(n²) |
| [review-0021-0030](review-0021-0030.md) | 0021~0030 | 결합 기하 완결(길이·각도) · Phase E 중력 진입 | ①✅ ②✅ ③🟡 ④✅ | #5 중력 장거리 임박 · #6 E 완화 creep |
| [review-0031-0040](review-0031-0040.md) | 0031~0040 | Phase D 핵 — 붕괴·융합·안정 골짜기 + 양방향·정지질량 편입 | ①✅강화 ②✅정점 ③🟡 ④✅ | #7 해소(0040/41) · #1 바스 강화 (전 step 감사 완료) |
| [review-0041-0050](review-0041-0050.md) | 0041~0050 | 핵 율 두 방향(Sargent·Gamow) · 상대론 완비 · 핵합성 사다리 | ①✅강화 ②✅정점 ③🟡 ④✅ | #C force relKE · #D 핵화학 동시 (0046→0050·0047→0049 묶음 내 해소) |
| [review-0051-0060](review-0051-0060.md) | 0051~0060 | 철 봉우리 완성(흡열·μ·사다리) · 공간 분할 단거리 배선 · BH 트리 | ①✅강화 ②✅정점 ③🟡개선 ④✅ | #5 해소(0054~62) · #E BH 주기경계(신규) · #6 부분(0069 VV) |
| [review-0061-0070](review-0061-0070.md) | 0061~0070 | 장거리 BH 배선 · 다체 무대(N=600) · 별 일생(점화→사다리 등반 maxZ→12) | ①✅강화 ②✅정점 ③🟡개선 ④✅ | #6 적분 비용 ~11%(240tick 별) · #E·#1·#D·#C 이월 |
| [review-0071-0080](review-0071-0080.md) | 0071~0080 | 별 죽음·분산 → 일생 순환 → 세대 재점화 · 적분/융합 E 회계 닫힘 · 화학 해리(Morse) | ①✅강화 ②✅정점 ③🟡개선 ④✅ | #6 해소(0077진단+0078회계)·#D 인덱스 해소(0073) · #G 신규(산물→분자)·#D′·#E·#1·#C 이월 |
| [review-0081-0090](review-0081-0090.md) | 0081~0090 | 공간 분리·중력 병합 별 · 핵화학 동시 무대 · 별풍·층상 핵합성 · 결합 종류·차수화 | ①✅강화 ②✅정점 ③🟡개선 ④✅ | #G 해소(0082+0083+0089)·#D 라이브 입증·#H 해소(0086→0091~93) · #I 신규(degField cut)·#1·#E·#C·#D′ 이월 |
| [review-0091-0100](review-0091-0100.md) | 0091~0100 | 성간 수송 닫기(snEject→coreHarvest→cross→점화 격리) · 결합 기하 네 축 종류화 완성+통합 게이트 · 100 step 이정표 | ①✅ ②✅ ③🟡(#1 확대) ④✅ | #1·#I 가담 +2 · #J 축간 상관·#K 수확↔점화·#L 닫힌 순환 신규 · #C·#E·#D′·#3·#4 이월 |

---

## 2. 열린 이슈 원장 (교차-배치 이월 — **유일하게 갱신**)

> **전파 고리**: 이슈는 *과거 step 수정*이 아니라 *이후 게이트 step*으로 반영된다(노브=0 → 회귀 0). 이미 해소면 그 step 을 가리키고(여기서 제거·기록만), 미해소면 열린 채로 두고 ① **목적지**(STATE §2 NEXT=무르익음 / §3 OPEN GAPS=경미·백로그) ② **게이트 형태**(어떤 노브·끄면 회귀 0) ③ **arc 정합**을 명시. step-loop(`hgo-atom-step`)이 이 원장을 읽어 승급·구현한다 — 원장은 review 가 쓰고, STATE 는 step-loop 이 쓴다.
> 한 줄 = `#번호 | 이슈 | 항 | 발견 묶음 | 상태 | 목적지 → 게이트/해소`.

### 열림 🔴 / 부분 🟡 (다음 묶음 리뷰가 재점검 → engine 변경 보면 ✅떨굼)

- **#1 | 전역 *바스* 공간 비국소** | ③ | 0001-0010 | 🟡 부분(확대) — ~~bondE~~ ✅**0015 `bondLocalE` 해소**, **바스 `sim.escaped` 만 전역 단일** · damp(0024)·fuse·coolOuter(0083) + disperse(0071·0085)·bondBreak(0075) + **snEject 인출(0091·`:1273·1302`)·coreHarvest 적재(0092·`:777`) 가담 +2**(0071-0100) | **목적지 STATE §3**(Phase E 수송 입증으로 무르익음·복사 냉각/국소 복사장·render L-T 게이트 연동) → 게이트: 국소 복사장 노브(끄면 전역 바스 = 회귀 0)·`hgo-laws.js:704·730·777·1302`
- **#J | 결합 축간 상관 미(D↔α↔r_eq·Badger 규칙)** | ②/④ | 0091-0100 | 🟡 신규(load-bearing) — 0100 `bondKindPair` 통합은 세 축의 *합집합*(독립 OR `hgo-kernel.js:203·224·237`)일 뿐 *연결* 아님 — 실제 화학 "짧은 결합=강한 결합"(k_force↔r_eq·D↔α) 미반영(step-0100 §37) | **목적지 STATE §2**(이미 0101 권장 후보·arc) → 게이트: 상관 게이트(k_force↔r_eq·끄면 독립 셋 = 회귀 0)
- **#K | coreHarvest 수확↔점화 tradeoff** | ④ | 0091-0100 | 🟡 신규(tension) — 코어 KE 수확이 *융합도* 식힘: heavy harv 26<off 51(0092 §41)·cross 무대 19<25(0093) — hDeg=14 로 최深 코어만 수확해 점화 보존하나 완전 분리 미 | **목적지 STATE §3** → 게이트: harvestDeg 정밀·수확/점화 분리 측정(닫힌 순환 #L 설계 시 동시 최적)
- **#L | 수송+점화 한 무대 닫힌 순환 미** | — | 0091-0100 | 🟡 신규(arc) — 0093 수송(cross)·0097 점화(consumed) 각각 입증·도달≠점화 해소했으나 *중력0 격리* — 좌별→수송→우점화→우별 *한 시뮬* 자기지속 순환 미(우물 병합 회피+우 아임계 유지 동시) | **목적지 STATE §2**(이미 0101 권장 1순위) → 게이트: 새 법칙 0 측정(골든 보존 = 회귀 0)·arc SPINE §4 churn 종착
- **#M | 핵·별 *이벤트 신호* 스냅샷 미노출 → render L-nuc/L-fuse blocked** | ③(방출↓) | 0091-0100 | 🟡 신규(cross-track·load-bearing for render) — render STATE §2 가 *변환 타임스탬프·방출 입자*를 명시 대기(L-nuc·L-T ⛔blocked) — 현재 atom 은 `fuseActive`·`snEjectActive`·`coreHarvestActive`·`decayActive` **전역 불리언(hash 미참여 진단)만** 노출 → render "glow author 금지"로 못 그림. **0091-0100 이 추가한 snEject(방향성 방출 입자)·cross(수송)·점화(0097)·핵합성 Z 이동이 정작 화면서 정지 동일 점**(SPINE §3 시각화 하류 — render 는 *읽기만*·atom 이 실어야 그림) | **목적지 STATE §3**(atom 이 *방출해야 render 가 그릴* 신호·README §3 명문 atom 이슈) → 게이트: 스냅샷에 *이벤트 로그* 노출(`{type,rx,ry,tick,dZ/ΔE…}` 배열·진단 hash 미참여 → 비우면 회귀 0)·render 는 다음 render-step *스냅샷 재감사*서 자동 인지(산문 전달 아님·트랙 직교)

- **#I | degField cut=coolR>spatialCut 시 셀 이웃 누락(라텐트)** | ③ | 0081-0090 | 🟡 라텐트(소비자 +2) — degField cut=radius 로 셀폭≥radius 가정(`hgo-laws.js:1476`)·coolR>spatialCut 무대선 셀폭<coolR → 이웃 셀 밖 쌍 누락 위험 · **0091-0100 서 snEject(`:1279`)·coreHarvest(`:754`) 가 degField 두 소비자 추가**(현 scene coolR≤spatialCut 안전·미해소) | **목적지 STATE §3 백로그** → 게이트: degField 셀 반경 ±2 확장(끄면 현 cut 가정 = 회귀 0)·고밀도/큰 coolR 무대 열 때 선결
- **#E | BH 토러스 min-image COM 토이(주기 경계 정확 합 아님)** | ③/② | 0051-0060 | 🟡 신규(#5 PM 잔여 분기) — bhForces 노드 무게중심까지 변위가 min-image(가장 가까운 像만)·θ>0 상대오차 2~13% 가 경계 효과·일반 BH 보다 큼(`hgo-laws.js:1136`) | **목적지 STATE §3**(이미 "토러스 min-image COM 토이·Ewald/PM" 추적) → 게이트: Ewald/PM 정밀 주기 합(farField 유지·정밀화·끄면 현 min-image = 회귀 0)·arc Phase E 성숙 후
- **#D′ | VV 결합 1-tick 위상 지연 + 안정 id(n 무관 키)** | ①/④ | 0061-0070 | 🟡 백로그(비-load-bearing) — #D 의 *인덱스* 절반은 0073 `fuseRebond` 해소·0082 가 핵+화학 동시 무대 라이브 입증(인덱스 무손상·골든 보존)·*VV 결합 위상*(symplectic=1 + 활성 bonds → bondSpring 가 직전 tick bonds 봄·`hgo-laws.js:1186`)·안정 id 절반 잔존·현 그 조합 scene 0(무해) | **목적지 STATE §3 백로그** → 게이트: VV 결합 위상 + 안정 id(끄면 단일 트랙 = 회귀 0)·핵+화학+symplectic 무대 열 때 선결
- **#C | force 상호작용서 relKE 일-에너지 정합** | ②/④ | 0041-0050 | 🟡 열림(load-bearing) — 0047 relCap·0049 relKE 가 *자유 드리프트*만 닫음·법칙별 에너지 회계 여전히 ½mv² 가정 | **목적지 STATE §3**(이미 🟡 상대론적 운동 추적) → 게이트: 법칙별 상대론 에너지 회계(큰 작업)
- **#3 | `scatter` v1/v2 `xMax=6` 리터럴** | ② | 0001-0010 | 🔴 열림(경미) — `hgo-laws.js:113·152` 노브 아님(0011-0020 미해소 확인) | **목적지 STATE §3**(정리성) → 게이트: `scatterXMax` 노브화(기본 6 = 회귀 0)
- **#4 | `reheat` 운동량 일방 트랩** | ④ | 0001-0010 | 🟡 부분(#1 바스에 종속) — `bath.px·py` 미배출 | **목적지 STATE §3** → #1 국소 복사장이 운동량 회계도 정련
- **#2 | 광자 영속 자료형** | ① | 0001-0010 | 🟢 설계 수용(권고만) — 다발 밖 lifecycle | **목적지 STATE §3 백로그** → 추적 입자화 step 시 함께(load-bearing 아님)

### 해소 ✅ (인덱스에서 제거 — 기록만)

- 과응집(bond 원자가 무한) → step-0012 `bondValence` (review-0001-0010)
- 준위 Z 무관 → step-0013 `levelZ` + 0014 `levelScreen` (review-0001-0010)
- 결합 E 전역 reservoir 비국소(#1 의 bondE 부분) → step-0015 `bondLocalE` (review-0011-0020)
- #7 `a.nuc` 토이 핵 저장고(M=A−B 미편입) → step-0040 `massDefect`(붕괴) + step-0041 `fuseMassFormula`(융합) — rest=(m−B)c² 편입·nuc=0 무대서도 E 닫힘 (review-0031-0040)
- 0046 Gamow E_G Z 무관 단일 상수 → step-0050 `fuseEGcharge`(E_G∝(Z₁Z₂)²) 묶음 내 해소 (review-0041-0050)
- 0047 relCap KE 토이(운동량 상대론·에너지 ½mu²) → step-0049 `relKE`(KE=(γ−1)mc²) 묶음 내 해소 (review-0041-0050)
- #5 연속력 O(n²) 5개 + 중력 장거리 → 단거리 5종 셀 배선(0055~59 collide/pauli/vdw/repulse/bond·컷오프-PE shift) + BH 트리(0060) + 장거리 gravity/coulomb 배선(0061·0062·운동량 복원 평균 차감) — 모든 힘 O(n log n)·N=600 다체 시연(0063·0066) (review-0051-0060·0061-0070)
- #6 적분 정밀도 — 별 ~11% E 완화 → *진단 교정*(step-0077: adaptSub 무효·gravity-only 0.241% ⇒ 적분 아님·융합 이벤트 회계) + step-0078 `fuseConservePE`(소멸 보편 쌍 PE→바스·9.69%→0.224%≈baseline)·0079 일생 적용(11.59%→0.271%)·0080 장시간 0.262% + 별도 0076 `adaptSub`(2체 순간 스윙 1037배) (review-0071-0080)
- #D 핵·화학 동시 무대 *인덱스* 절반(fuse 압축 ↔ bonds 간선 어긋남) → step-0073 `fuseRebond`(간선 재배선·dangling 켜0/끄6·소비 결합 e[2]→바스) — 나머지(VV 결합 위상·안정 id)는 #D′ 로 (review-0071-0080)
- #G 핵합성 산물 → 분자 라이브 무대 → step-0082(자가 점화 별 산물 19/21 공유결합·bondCovalent 끄면 0·골든 보존) + step-0083 `coolOuter`(국소 냉각 이산 분자 6개) + 결합 종류별 D step-0089 `bondMorsePair`(D∝√Z·α·r_eq 는 0094/0095) (review-0081-0090)
- #D 핵·화학 동시 무대 라이브 입증(인덱스 0073 + 무대 0082) → step-0082 가 maxZ 28 핵융합 ∧ 분자 2개를 한 무대서 골든 보존하며 굴려 인덱스 무손상 실증 — VV 결합 위상 잔존분은 #D′ 단일 추적(중복 제거) (review-0081-0090)
- #H 별풍 단독 우물 간극 못 건넘(초신성급 방출 필요) → step-0086 측정 발견(별풍 cross 0·중력 결속) → step-0091 `snEject`(방향성 분출) + step-0092 `coreHarvest`(중력 붕괴 KE→바스·maxR 37 간극 24 돌파) + step-0093(harv cross 6≫off 0 성간 수송) (review-0081-0090)

---

## 3. 묶음 경계 규칙

- **10 step = 1 리뷰·십진 경계 정렬**(0001–0010 · … · 0031–0040 · 0041–0050 …). 한 묶음은 NNN1~NNN0 십진 단위로 끊는다. (역사: 0031–0037 이 한때 7개로 닫혔으나 십진 경계 31–40 으로 재정렬해 0038–0040 을 review-0031-0040 §4 에 이어 붙였다 — 경계 교정 1회.)
- 리뷰는 **닫힌 step 만** 다룬다(STATE NOW 가 가리키는 미닫힘 step 제외).
- render 트랙 이슈는 여기 적지 않는다(`../../render/STATE.md` 소관) — 단, atom 이 *방출해야 render 가 그릴 수 있는* 신호(이벤트 타임스탬프 등)는 atom 이슈로 기록 가능.
