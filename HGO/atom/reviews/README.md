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
| E 별 | [phase-E-star.md](phase-E-star.md) | 🟡 성숙(0028~30 씨앗 + 0054~64 인프라 + 0063·65·66·68·70 붕괴→점화→사다리 등반·*죽음·분산 미*) |

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

---

## 2. 열린 이슈 원장 (교차-배치 이월 — **유일하게 갱신**)

> **전파 고리**: 이슈는 *과거 step 수정*이 아니라 *이후 게이트 step*으로 반영된다(노브=0 → 회귀 0). 이미 해소면 그 step 을 가리키고(여기서 제거·기록만), 미해소면 열린 채로 두고 ① **목적지**(STATE §2 NEXT=무르익음 / §3 OPEN GAPS=경미·백로그) ② **게이트 형태**(어떤 노브·끄면 회귀 0) ③ **arc 정합**을 명시. step-loop(`hgo-atom-step`)이 이 원장을 읽어 승급·구현한다 — 원장은 review 가 쓰고, STATE 는 step-loop 이 쓴다.
> 한 줄 = `#번호 | 이슈 | 항 | 발견 묶음 | 상태 | 목적지 → 게이트/해소`.

### 열림 🔴 / 부분 🟡 (다음 묶음 리뷰가 재점검 → engine 변경 보면 ✅떨굼)

- **#1 | 전역 *바스* 공간 비국소** | ③ | 0001-0010 | 🟡 부분 — ~~bondE~~ ✅**0015 `bondLocalE` 해소**, **바스 `sim.escaped` 만 전역 단일**(0037 까지) · **damp(0024)·fuse 도 바스-쓰기 가담**(review-0021-0030) | **목적지 STATE §3**(arc Phase E 후 무르익음·render L-T 게이트 연동) → 게이트: 국소 복사장 노브(끄면 전역 바스 = 회귀 0)
- **#E | BH 토러스 min-image COM 토이(주기 경계 정확 합 아님)** | ③/② | 0051-0060 | 🟡 신규(#5 PM 잔여 분기) — bhForces 노드 무게중심까지 변위가 min-image(가장 가까운 像만)·θ>0 상대오차 2~13% 가 경계 효과·일반 BH 보다 큼(`hgo-laws.js:1136`) | **목적지 STATE §3**(이미 "토러스 min-image COM 토이·Ewald/PM" 추적) → 게이트: Ewald/PM 정밀 주기 합(farField 유지·정밀화·끄면 현 min-image = 회귀 0)·arc Phase E 성숙 후
- **#6 | 적분 정밀도 — E 완화(깊은 붕괴+융합)** | ④ | 0021-0030 | 🟡 부분(메커니즘 0069·잔여 큼) — **step-0069 `symplectic`**(velocity-Verlet) 2체 secular 553배 개선·잔여=다체 BH+fuse 근접조우 + 이벤트형 변환 미보정·**0070 별 run 240tick E 상대 ~11%**(헤드라인 ~3%는 120tick·`scenes.js:4641` relEpct)·Q·B·L·px·py 는 늘 머신 | **목적지 STATE §3 적분 정밀도**(이미 추적) → 게이트: **적응 시간단계·근접조우 정규화**(Phase E 별 *일생*에 load-bearing·끄면 현 거동 = 회귀 0)
- **#C | force 상호작용서 relKE 일-에너지 정합** | ②/④ | 0041-0050 | 🟡 열림(load-bearing) — 0047 relCap·0049 relKE 가 *자유 드리프트*만 닫음·법칙별 에너지 회계 여전히 ½mv² 가정 | **목적지 STATE §3**(이미 🟡 상대론적 운동 추적) → 게이트: 법칙별 상대론 에너지 회계(큰 작업)
- **#D | 핵·화학 동시 무대(fuse 압축 ↔ bonds 간선 인덱스 · +symplectic 결합 1-tick 지연)** | ① | 0041-0050 | 🟡 열림(범위 확장·0061-0070) — fuse 가 `sim.atoms` 압축 시 bonds 간선 *원자 인덱스* 어긋남 + symplectic=1 + 활성 bonds 면 bondSpring/bondAngle 가 직전 tick bonds 봄(VV 위상 지연·`hgo-laws.js:1070`·현 scene 0 무해) | **목적지 STATE §3**(이미 추적) → 게이트: 안정 id/간선 재배선 + VV 결합 위상(끄면 단일 트랙 = 회귀 0)
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

---

## 3. 묶음 경계 규칙

- **10 step = 1 리뷰·십진 경계 정렬**(0001–0010 · … · 0031–0040 · 0041–0050 …). 한 묶음은 NNN1~NNN0 십진 단위로 끊는다. (역사: 0031–0037 이 한때 7개로 닫혔으나 십진 경계 31–40 으로 재정렬해 0038–0040 을 review-0031-0040 §4 에 이어 붙였다 — 경계 교정 1회.)
- 리뷰는 **닫힌 step 만** 다룬다(STATE NOW 가 가리키는 미닫힘 step 제외).
- render 트랙 이슈는 여기 적지 않는다(`../../render/STATE.md` 소관) — 단, atom 이 *방출해야 render 가 그릴 수 있는* 신호(이벤트 타임스탬프 등)는 atom 이슈로 기록 가능.
