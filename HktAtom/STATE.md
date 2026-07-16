# STATE — HktAtom 현재 위치 (SSOT · step마다 §1~4 덮어쓰기 · §5 만 append)

> 권위 분리: 목표 [CLAUDE.md](CLAUDE.md) · 척추 [KERNEL.md](KERNEL.md) · 이 문서 = "지금 어디까지·다음은 무엇". 크기 예산 ≤ 20KB.

## §1 NOW — 지금 어디까지

- **S0-④ 전이 엔진 구현 완료 (step-0004)**: 이산층 켜짐 — **전이 카탈로그 실행기 + 두 시계 + 에너지 출처 강제 + 사건 단위 정확 회계**. `catalog.js`(신설·행 형식) + engine 실행기(접촉 시계 `p=1−e^{−k·dt}` · 수명 시계 큐 예약+ver 무효화 · 흡수 빈 밀도 · `checkedApply` 전이 전후 E·P≤1e-9 상시 강제). `atom.level`(2준위)·`U_int`·`E_photon`(nPhotons 빈 근사)·`collisionalTransfer`(COM 불변 P 보존). 장면 3종(thermal-bath·radiative-cooling·cavity). `node verify.js`=**40 PASS**(①②③ 32 회귀 + ④ 8): **볼츠만 창발**(n1/n0 vs (g1/g0)e^{−ΔE/T} 비율 ∈[0.8,1.25]·단조)·전이 회계 정확·충돌+힘 P 1e-14·냉각 T↓+E_escape·공동 광자 정상상태·저온 지수 억제. **핵심 발견**: 초안 R-EXC/R-REL 분리는 볼츠만 0.6~2.3× 편향 → **Larsen–Borgnakke 재분배 1행 통합**으로 ~1.0(±10%) 수렴(잔여 편향은 ⑨ 통계 관문 이월·위조 안 함). 뷰어: 들뜸 노란 글로우·광자 빈·점유 vs 볼츠만 패널.
- **S0-③ 준위·예산 구현 완료 (step-0003)**: 전자 구조 전부를 **순수 함수**로 (`levels.js` — ①②와 독립, 시뮬 없이 단위 테스트). `fillZ`(Aufbau+파울리)→`zeff`(간이 Slater)→`eps`→`ionizationE`·`affinity`→`unpaired`(훈트)→**`budget` 연속 결합차수 예산 B**(바닥 홀전자+s→p 승위). `fromZ`(실원소)·`VIRTUAL`(가상 4종 V1/V0/V2/V4)·`boltzmann`(④ 기준 곡선). **주기율표 창발**(표 author 0): `node verify.js`=**32 PASS**(①② 24 회귀 + ③ 8). 예산 앵커 `1,2,3,4,3,2,1,0`(H·Be·B·C·N·O·F·Ne — 교과서 원자가 일렬) + Na=1·Mg=2·Cl=1·Ar=0 · 주기2/3 IE 단조↑ · 희유기체 피크 · 알칼리 골 · 볼츠만 점유 · 가상 4종 확정. **발견 2**: (a) 승위를 빈 p 까지 확장→Be/Mg 2가 창발 (b) **족 내림 Li>Na>K 는 창발 안 함(측정 Na>Li>K) — 위조 안 하고 OPEN GAP 등록**. 뷰어 "보기: 시뮬⇄준위③" — 주기 지그재그 차트(희유기체 주황 피크·알칼리 파랑 골) + 가상 원소 준위 카드. 커널 체크 5항(창발=측정 핵심).
- **S0-② 힘·충돌 구현 완료 (step-0002)**: 연속층의 실제 내용 — **쿨롱 + 단거리 척력**(`pairForces`, 전 쌍 O(N²)+최소 이미지·컷오프 없음·Lorentz–Berthelot·softening 0.1) — 을 채우고 `U_elec` 통 활성. 충돌·산란 중에도 장부 닫힘. **Verlet 표류 허용치 수치 고정**: `EPS_E=5e-4`(상대)·`DT_STIFF=0.004`·`MIN_DSIGMA=0.7` (engine.js export — 이후 전 단계 재사용). 확장: `atom.q`·world `sigma/eps/kc/soft`·`measure.pressure`(비리얼)·`minDsigma`. 장면 3종(gas-collide·scatter-2·charge-pair). `node verify.js` = **24 PASS**(① 16 회귀 + ② 8): max|ΔE|/E=1.9e-4≤EPS_E·|ΔP|=4e-14·min d/σ=0.84>0.7·**θ(b) 단조 101°→6°(러더퍼드 닮음)**·쿨롱쌍 닫힘·dt반감 θ 상대차 1.4e-7. 뷰어: 궤적 트레일·전하 배지(±)·P·min d/σ 패널·상대잔차 판정. **설계 이탈 1건**(scatter-2 ±→동전하 +1/+1, design 갱신). 커널 체크 5항 통과.
- **S0-① 무대·장부 구현 완료 (step-0001) — 첫 코드**: `stages/S0-atom/{engine,scenes,measure,verify}.js` + `index.html`. S0 단계의 **뼈대**(자료형·통 분리 장부 10통·tick 파이프라인·검증 하네스)를 세웠다 — 이후 ②~㉖ 은 이 위에서 *바뀌지 않고 채워지기만* 한다. `Vec3`(3성분 고정)·`atom{id,sp,r,p,F,disp,occ,mu}`·`world{...,escaped,queue,ledger,computeForces}`. **velocity Verlet**(①은 F=0)·**경계 3종**(periodic·reflect·open 탈출 회계)·**z 동결**(장면 속성, 매 tick assert)·**사건 큐**(이진 힙+ver lazy 무효화 자료구조만). **검증 하네스**(`runScene`·`stat`·`assertExact/Window`·불변식 스위트)는 이후 전 단계 재사용. `node verify.js` = **16 PASS·0 FAIL**: 장부합 정확 보존(≤1e-12)·P 보존·Σc 불변·dt 반감 통계 불변·경계 3종·R=12 ⟨T⟩ 목표 창(0.996 vs 0.984=(1−1/N)T₀, COM 제거 편향 정직 반영). 뷰어: 64원자 운동 + 장부 10통 표(K_tr만 값·잔차 0.00e+0 초록) 눈 확인. 커널 체크 5항 통과.
- **계획 국면 (step-0000, 코드 0줄) — 권위는 이제 각 문서로 이관**: 네 축 확정 = CLAUDE(목표·세계와 엔진의 관계·관계론) · KERNEL(커널 형태·단계 5원칙·검증 4기둥·공간 존재론 §2.1) · CONTRACT v0(승격 계약·MaterialModel 스키마·핵분열 스트레스 케이스) · DESIGN+design/①~㉖(공통 시뮬 원리·로드맵·세부 설계도). 주요 결정: 3D 자료구조 고정(z 동결 장면·2D 경로 금지) · 결정론 폐기(앙상블 통계) · 통 분리 장부 · 전이 카탈로그 한 형식 · 두 시계 · 연속 결합차수 예산 · 가상 원소 우선 · 핵 확장팩 게이트 · 외부 검토 3회 반영. **세부는 해당 문서 참조 — STATE 는 중복 안 함.**

## §2 NEXT — 다음 한 조각 (step-0005 = S0-⑤ 이온화·재결합·이전)

**다음 구현 = step-0005 = S0-⑤ 이온화·재결합·이전** (앵커: 이온 격자 · [design/05-ionization.md](stages/S0-atom/design/05-ionization.md)): 카탈로그에 **행 3종 추가**(충돌 이온화·재결합·전자 이전) + `electron` 자유전자 입자(빈 배열 실사용). ④의 실행기·checkedApply·에너지 출처 강제를 그대로 재사용 — 새 현상 = 코드가 아니라 행. 닫는 기준: 오르막 전이 + 미시 가역성 · 다입자 격자 안정화(Na⁺Cl⁻ 창발) · 이온화⇌재결합 평형. ③의 이온화 E(−ε 최외각)를 소비. 전하 q 가 ②의 쿨롱을 실전 활성(격자 인력).

**승격 계약 v0 존재** ([CONTRACT.md](CONTRACT.md)): 필드 채움은 ⑧/⑪(⇧)·㉒(MaterialModel)·S1 진입 몫.

**승격 계약은 이미 v0 존재** ([CONTRACT.md](CONTRACT.md) — 네 축 중 인터페이스 축): MaterialModel 스키마·관측량 계약(|ΔO|<ε_O)·재해석 조건·유효 범위·오차 한계. 필드 채움은 ⑧/⑪(출력 산출 ⇧)·㉒(MaterialModel)·S1 진입이 한다.

## §3 OPEN GAPS — 열린 격차

- **입출력 JSON 스키마 초안만** (S0-⑧이 확정): DESIGN §6.2 초안 있음 — 실측정하며 확정.
- **V₀ 상수의 튜닝 여지** (S0-④~⑧): 수식형은 DESIGN §3 로 확정 — 상수(R·차폐·D·k_b·ν·접촉 Eₐ 등)는 노브로 두고 앵커 재현이 조정한다 (수식 변경은 DESIGN 개정 사건).
- **T_국소 정의의 비평형 한계** (S0-⑦이 검증): 아레니우스의 T 는 이웃 운동 온도 근사 — 평형 근방에서 충분한지 ⑦ 통계 관문이 확인, 부족하면 정련.
- **규모 정합의 "닮음" 지표 미정** (S1-④ 전 결정): 온도·밀도·구조 수 히스토그램 거리 등 — 관문 세부 단계가 assert 로 확정.
- **강등 ⇩ 의 통계 복원 규약 미정** (S1-④): u′ 와 일관된 미시 배치 샘플링 방법.
- **현실 앵커의 허용 오차 미정** (각 관문): "닮음"의 수치 임계 — 각 세부 단계가 assert 로 확정하며 정한다.
- **족 내림 이온화 경향 미창발** (step-0003 발견): 간이 Slater 는 Li>Na>K 를 못 냄(측정 Na>Li>K — 3s 침투 과소평가). 손튜닝 금지 원칙에 따라 위조 안 함. 3s/3p 침투 보정이 필요한 상위 단계(⑮ χ 유도 등) 착수 전 재검 — 그 전엔 주기 경향의 나머지(주기 단조·피크·골)로 충분.
- **볼츠만 점유 ~10% 편향** (step-0004 발견): LB 재분배가 접촉 상관 때문에 (g1/g0)e^{−ΔE/T} 의 ~0.9~1.15× (고립 무작위쌍은 ~0.95×). 위조 안 함 — 정밀 KL<ε 는 **⑨ 통계 관문(DSMC-정합 충돌 처리)**으로 이월. 그 전엔 비율 ∈[0.8,1.25]+단조 응답으로 창발 확인 충분.

## §4 DURABLE — 여러 step 이 반복 참조할 불변

- 단계 5원칙 (KERNEL §1) · 커널 체크 5항 (KERNEL §6) · 검증 4기둥 (KERNEL §7) — 매 세부 단계 통과 의무.
- 단계 간 접점은 input/output.json 뿐 — 코드 화살표 금지.
- 상위 상호작용 파라미터는 하위 측정 산출물만 (S0 실물리 author 만 예외). 손 튜닝 발견 즉시 격차 등록.
- 시각화 없이 닫지 않는다.

## §5 INDEX — step 인덱스 (literal 1줄/step append)

- step-0000: 프로젝트 탄생 — 커널 척추·단계 지도(S0~S3)·검증 확정 (정련 2회: 현실 앵커 → 단계 모듈화·결정론 폐기) + S0 상세 설계도(DESIGN.md). 코드 0줄.
- step-0001: S0-① 무대·장부 — 첫 코드. engine/scenes/measure/verify.js + index.html. Vec3·통 분리 장부 10통·velocity Verlet(F=0)·경계 3종·z동결·사건 큐 뼈대·검증 하네스. node verify.js 16 PASS. 뷰어 눈 확인(운동+잔차 0).
- step-0002: S0-② 힘·충돌 — 쿨롱+척력 pairForces(전 쌍+최소 이미지)·U_elec 활성·EPS_E/DT_STIFF/MIN_DSIGMA 고정·비리얼 압력·전하 q·장면 3종. node verify.js 24 PASS(θ(b) 러더퍼드 단조·min d/σ>0.7). 설계 이탈 1(scatter-2 동전하). 뷰어: 트레일·전하 배지.
- step-0003: S0-③ 준위·예산 — levels.js 순수 함수(Aufbau·간이 Slater·훈트·결합차수 예산 B·가상 원소 4종·boltzmann). node verify.js 32 PASS. 주기율표 창발(원자가 1,2,3,4,3,2,1,0·주기 지그재그). 발견 2(승위 빈 p 확장·족 내림 미창발 gap). 뷰어: 준위③ 차트.
- step-0004: S0-④ 전이 엔진 — catalog.js(행 형식)+실행기(두 시계·checkedApply 사건 회계)+atom.level·U_int·E_photon 빈·collisionalTransfer·장면 3종. node verify.js 40 PASS. 볼츠만 창발(LB 재분배)·냉각·공동·저온 억제. 발견: R-EXC/REL 분리 편향→LB 통합(잔여 ~10% gap). 뷰어: 들뜸 글로우·광자 빈.
