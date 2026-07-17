# STATE — HktAtom 현재 위치 (SSOT · step마다 §1~4 덮어쓰기 · §5 만 append)

> 권위 분리: 목표 [CLAUDE.md](CLAUDE.md) · 척추 [KERNEL.md](KERNEL.md) · 이 문서 = "지금 어디까지·다음은 무엇". 크기 예산 ≤ 20KB.

## §1 NOW — 지금 어디까지

- **S0-⑲ 금속 (step-0019) — 3D**: 비국소 전자 풀 창발. **`metal.js` 신설**(self-contained·엔진 ①–⑱ **diff 0**·전 상호작용 유계): 낮은 IE 외각 전자가 클러스터 규모로 비국소화 → 공유(예산 포화)와 달리 **비포화 응집·전도·차폐**. **금속 결합=유효 우물 Dmetal**(고전 점전자 플라스마는 양자 운동압 부재로 응집 못 함 → 이온-이온 비방향성 인력 우물=전자 풀 차폐의 Thomas-Fermi 대체·author·design 인정). 명시 자유전자(⑤)=이동 캐리어(keCouple=0.7). 힘: 부드러운 쿨롱+이온-이온 발산 (rcII/d)⁶ 코어(붕괴 방지·가벼운 전자 catapult 회피)+전자 유계 소프트코어. scenes s19-na-cluster/conduction/screening/covalent-contrast + 파란 전자 풀. `node verify.js`=**136 PASS**(①–⑱ 130 회귀 + ⑲ 6): **비포화 응집**(3D 배위 10.67≥8≫공유 B=4)·**공유 포화 대조**(V4 결합≤4·과결합 0)·**전도**(장on 전자 −6.34≫이온 0.79·장off≈0)·**전자 구속**(E<0·위반 0)·**차폐**(+전하 근방 밀도 16>1.3)·**Σc·Σe 보존**. 뷰어(눈·콘솔 0·Playwright): 3D 조밀 클러스터·파란 전자 풀 흐름. 발견: 고전 플라스마 응집 불가→유효 우물·유계 힘·R-DELOC 동적 전이 후속·⑱⑲ 3D 정합(⑬ 이후).
- **S0-⑱ 라디칼·연소 (step-0018) — 3D** — 요약(§5): 불·원리 0·행 추가. `combustion.js`(엔진 diff 0·추상 R·+X–Y→R–X+Y·=⑰ 일반화·라디칼=예산 잔여·분지 예산 창발·O₂ 이중결합 대체). 130 PASS: 점화대조 18>2×3·발열 33·분지 원자 O 6·전선 4/4. 발견: O=O 이중 필수·단열→열폭발.
- **S0-⑰ 산·염기 (step-0017)** — 요약(§5): 양성자 릴레이. `acidbase.js`(엔진 diff 0·R-PROT: H 결합 갈아타기·이온=O 형식전하 측정·장벽 에너지 가드·용매화 protSolv). 123 PASS: 재결합·K_w≪1·릴레이 Grotthuss 233·산→H₃O⁺·Σformal=0. 발견: protSolv 명시·주입 실증·사건 보존 ~1e-7.
- **S0-⑯ 수소 결합 (step-0016)** — 요약(§5): 물 네트워크. `hbond.js`(엔진 diff 0·2차 R-HB 방향성 인력·3체 P·L 보존). 116 PASS: 방향선택성 155°·Ne 선택성·E_hb/D_OH 0.060·온도응답. 발견: 점전하 부족→R-HB 명시.
- **S0-⑮ 극성 (step-0015) — QEq** — 요약(§5): 부분 전하 author 0 — **전기음성도 균등화**(QEq)로 극성=**전하×형상** 창발. `polarity.js`(엔진 **diff 0**·`E(q)=Σ(χq+½ηq²)+½ΣJqq` s.t. Σq=Q·χ=(IE+EA)/2 ③·자기항→U_pol·외부장 F=qE). node verify.js **109 PASS**: 3단 한 QEq(O₂ 무극성·BeH₂ 상쇄·H₂O 극성 μ 0.157)·χ 서열 ③(O>H>Be)·장 배향 0.70·Σq=Q. 발견: η 온사이트 쿨롱 지배·CO₂ 는 BeH₂ 대체.
- **S0-⑭ 형상 (step-0014) — VSEPR** — 요약(전문 §5): 분자 형상 author 0 — **공통 각도 반발 하나**로 정사면체·굽음·직선 동시 창발. `geometry.js`(엔진 **diff 0**·`V_ang=k Σ w_a w_b/(1−cosθ+c0)`·힘 −∇V·P·L 보존·고립쌍 준정적 최소화·③ 도메인). node verify.js **101 PASS**: 3단 앵커 한 상수(CH₄ 109.5·H₂O 101·BeH₂ 175·분자별 분기 0)·형상 서열·고립쌍 압박 근원. 발견: 직선 소프트 최소는 이완 측정·CO₂ 이중결합 대기.
- **S0-④~⑬ (요약 — 전문 §5·step 문서)**: ⑬ z 해동(3D·엔진 변경 0·93 PASS) · ⑫ 복사장(photon 입자·88) · ⑪ 승격 MVP(promote.js⇧⇩·output.json v0·Part I 닫힘·81) · ⑩ 수프 관문(실원소·2H:1O→H₂O 우세·쌍별 D·74) · ⑨ 통계 관문(엔트로피↑·van't Hoff·새 물리 0·69) · ⑧ 분극·응집(polarization.js·C6·64) · ⑦ 내부 모드(modes.js·C_v 계단·57) · ⑥ 공유결합(runBonding·H₂·원자가 포화·52) · ⑤ 이온화(R-XFER·NaCl·47) · ④ 전이 엔진(카탈로그·두 시계·볼츠만·40).
- **S0-①②③ 뼈대 (요약 §5)**: ① 무대·장부(engine/scenes/measure/verify+index.html·통 10통·Verlet·16) ② 힘(pairForces 쿨롱+척력·EPS_E=5e-4·비리얼·24) ③ 준위(levels.js 순수 함수·주기율표 창발·32). 이후 전 단계가 이 뼈대·불변식 재사용.
- **계획 국면 (step-0000)**: 네 축 확정(CLAUDE·KERNEL·CONTRACT v0·DESIGN+design/①~㉖). 결정: 3D·z동결·결정론 폐기(앙상블)·통 분리 장부·전이 카탈로그·두 시계·연속 예산·가상 원소·핵 게이트.

## §2 NEXT — 다음 한 조각 (step-0020 = S0-⑳ 이온화 기체)

**⑲ 금속 닫힘 — 비국소 전자 풀 창발(비포화 응집 배위 10.67·전도·차폐)·유효 우물+명시 전자·3D.** 두 갈래:
- **S1-① (열림)**: `output.json` 이 S1 입력으로 준비됨 — S1 분자 단계 착수 가능(design/11 경계: "S1 소비 테스트는 S1-① 몫").
- **다음 구현 = step-0020 = S0-⑳ 이온화 기체** (앵커: 뜨거운 기체·플라스마 · [design/20-ionized-gas.md](stages/S0-atom/design/20-ionized-gas.md) · 전제 ⑤⑫): 고온에서 이온화⇌재결합 평형으로 플라스마 창발(⑤ 자유전자 이온화⇌재결합 ⑳ 이월분 + ⑫ 복사). **로드맵(design README): ⑳(이온화 기체)→㉑(성능)→㉒(실 S1 입력 ⇧).** 세부 선택 자유(⑳ 또는 S1-① 착수) — STATE §2 가 확정.

**승격 계약 v0 존재** ([CONTRACT.md](CONTRACT.md)): 필드 채움은 ⑪(⇧ MVP)·㉒(MaterialModel)·S1 진입 몫.

**승격 계약은 이미 v0 존재** ([CONTRACT.md](CONTRACT.md) — 네 축 중 인터페이스 축): MaterialModel 스키마·관측량 계약(|ΔO|<ε_O)·재해석 조건·유효 범위·오차 한계. 필드 채움은 ⑧/⑪(출력 산출 ⇧)·㉒(MaterialModel)·S1 진입이 한다.

## §3 OPEN GAPS — 열린 격차

- **입출력 JSON 스키마 초안만** (출력 산출 세부 단계가 확정): DESIGN §6.2 초안 있음 — 실측정하며 확정.
- **응집이 액적+증기 공존에 머묾** (step-0008): 미시정준이라 응축 잠열이 계를 T_c 근방으로 자체 가열 → 완전 응축 아님. 완전 상 분리·상 라벨은 S1(열 배출·규모). SCF 상호분극은 쌍별 근사로 대체.
- **V₀ 상수의 튜닝 여지** (S0-④~⑧): 수식형은 DESIGN §3 로 확정 — 상수(R·차폐·D·k_b·ν·접촉 Eₐ 등)는 노브로 두고 앵커 재현이 조정한다 (수식 변경은 DESIGN 개정 사건).
- **T_국소 정의의 비평형 한계** (step-0009 부분 확인): 평형 장면에서 ⟨T_국소⟩≈전역 T 정합 확인(rel 0.005). 비평형(온도 구배 s09-gradient)은 관찰·기록만 — 구배 속 아레니우스 반응률의 공간 프로파일 정량 assert 는 미착수(향후 반응-확산 정련).
- **van't Hoff 는 캐논ical 측정 필요** (step-0009): ⑥ 복사 결합이 방출 냉각으로 평형 T 를 협대역 자체 고정 → 미시정준 T0 스캔 무효. 명시적 항온조로 T 고정해 창발 확인(기울기 1.89≈D). 닫힌 3체 안정화면 미시정준 가능 — formBond 개정 사건이라 보류(복사 안정화로 충분).
- **규모 정합의 "닮음" 지표 미정** (S1-④ 전 결정): 온도·밀도·구조 수 히스토그램 거리 등 — 관문 세부 단계가 assert 로 확정.
- **강등 ⇩ 통계 복원 규약 미정** (S1-④): u′ 일관 미시 배치 샘플링.
- **현실 앵커의 허용 오차 미정** (각 관문): "닮음"의 수치 임계 — 각 세부 단계가 assert 로 확정하며 정한다.
- **족 내림 이온화 경향 미창발** (step-0003): 간이 Slater 는 Li>Na>K 못 냄(3s 침투 과소평가)·위조 안 함. 상위(⑮ χ) 착수 전 재검·그 전엔 주기 경향으로 충분.
- **이핵 분자 시그니처** (step-0006→0010): 등방 우물이라 ⑥ H₂O 우세 안 함 → ⑩ 쌍별 D(436:463:146)로 해결(O–H 최강). 형상(⑭)·극성(⑮)은 별도.
- **단일 결합만 (O=O 이중결합 부재)** (step-0010 → step-0018 우회): bond.order 로 O=O 표현 못 함 → ⑱ 은 O₂ order2·D=이중(2.15)로 장면 보정. 일반 π 결합 후속.
- **어닐링 항온조는 측정/준비 도구** (step-0010): 냉각이 뺀 열을 E_escape 로 회계 → 장부 닫힘(④ 복사 냉각 동형).
- **재해동 T 는 재표본이라 이동** (step-0011): coarse→rethaw 는 Σc·E·P·조성 정확 보존·미시 재샘플로 T ~1.3배. 조성 ε=0·T 창[0.6,1.6].
- **⑪ MVP 는 배관 증명·물질 충실도 아님**: output.json v0 는 최소(PMF 단원자 중성쌍 근사). 실 S1 입력(EOS·수송·반응망)은 ㉒ MaterialModel.
- **점전하만은 H-결합 부족 → R-HB 명시** (step-0016): E_hb/D_OH≈2.5e-3(목표의 ~1/10) → 방향 가중 R-HB 노브(D_hb=1.0·숨김 0). 얼음·밀도역전(4°C)은 S1.
- **자동이온화 동결·사건 보존 ~1e-7 → protSolv 명시** (step-0017): ΔE_autoion≈+9·유전 차폐 없어 냉수 자발 이온화 불가 → 순 전하당 −protSolv·Q² 용매화(⑯ D_hb 동형·값 2.0). 주입→재결합·T응답 실증·정량 K_w(T) S1. R-PROT 접촉 1행·장벽 비대칭 에너지 가드 창발. ⑯ 고립쌍 준정적 최소화로 사건 1e-9 불가·감사 끔·보존은 Σformal=0·H 수·O 배위≤3·표류<2e-3. 강산 약함·pH·완충 S1/㉒.
- **연소는 열폭발·O=O 이중결합 대체** (step-0018): ⑩ 단일결합 gap 으로 O₂=order2·D=이중(2.15)로 보정(준안정·분지 흡열·문턱). 닫힌 단열→전역 빠른 점화(열폭발)·s18-flame-front 는 공간 확산만(3D 4/4). 느린 전선·k(T)·τ_ign·완전 연소(전환 ~40%)는 유한 열배출(S1). 겹침 0(gap≥σ) 필수·사건 감사 끔(⑥)·보존 Σc 정확·표류<5e-2.
- **고전 금속 플라스마 응집 불가 → 유효 우물 author** (step-0019): 고전 점전자 +1/−1 은 양자 운동압 부재로 응집 못 함 → **이온-이온 인력 우물 Dmetal**(전자 풀 차폐의 Thomas-Fermi 고전 대체·design "유효 모델" 인정)로 비포화 조밀 쌓임(3D 배위 10~12≫B=4). 명시 전자(⑤)=이동 캐리어(전도·차폐·keCouple 0.7). 전 상호작용 유계(엔진 (σ/d)¹² 는 전자 catapult → metal.js 자체 힘: 부드러운 쿨롱+이온 발산 (rcII/d)⁶+전자 유계·엔진 diff 0). R-DELOC 동적 전이·Fe 연기 후속·융점/밴드/자성 범위 밖. **⑱⑲ 3D 정합**: 전제(2D) 물려받아 2D 였다가 ⑬ 세계 3D 정합으로 둘 다 3D(⑲ 배위 8~12 는 3D 필수).
- **QEq 하드니스·CO₂ 대체** (step-0015): η=(IE−EA)/2 는 ③ EA>IE 로 음수→비볼록 → η=k_c/s+IE 프록시(양수·author 0). CO₂ 직선은 BeH₂ 로 대체. 분자간 전하 이동·유전율 없음.
- **형상 한계** (step-0014): `1/(1−cosθ)` 소프트 최소라 형상은 과감쇠 이완 최소 배치로 측정(BeH₂ 175°). 고립쌍 준정적 최소화는 P·E 정확·L 잔차 ~1e-4. CO₂ 직선은 BeH₂ 로 대체.
- **⑦ 3D C_v 재검 이월** (step-0013): `modes.js` 2D 하드코딩 → 3D C_v 재작성 필요(별도 이월·⑦ 2D 회귀 불변).
- **2준위 → 단색 스펙트럼 · field/bin 공존** (step-0012): ⑫ 광자 입자는 냉각·공동·유도 방출 재현하나 2준위라 광자 E=dE → 스펙트럼 단색(연속·플랑크 꼬리는 다준위/진동-복사 결합 몫·㉒). 복사압·산란·편광 범위 밖. `E_photon` 통이 bond 복사 sink(⑥⑩⑪)로도 쓰여 `radiationMode='field'` additive(⑩ fallback 동형·field 장면 E_photon==Σphoton.E).
- **볼츠만 점유 ~10% 편향** (step-0004): LB 재분배가 접촉 상관으로 (g1/g0)e^{−ΔE/T} 의 ~0.9~1.15×·위조 안 함. 정밀 KL<ε 는 DSMC-정합 충돌 처리로 이월·그 전엔 비율 ∈[0.8,1.25]+단조로 충분.

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
- step-0004: S0-④ 전이 엔진 — catalog.js(행 형식)+실행기(두 시계·checkedApply)+atom.level·U_int·E_photon 빈·collisionalTransfer. node verify.js 40 PASS. 볼츠만 창발(LB 재분배)·냉각·공동·저온 억제. 발견: LB 통합(잔여 ~10% gap). 뷰어: 들뜸 글로우.
- step-0005: S0-⑤ 이온화·전자 이전 — electron 입자+R-XFER(transferElectron·오르막 게이트)+Kat/An+ionState. node verify.js 47 PASS. 이온 격자 NaCl 창발(마델룽 U_elec<0·교대질서). 자유전자 이온화⇌재결합 ⑳ 이월. 뷰어: +/− 이온 링.
- step-0006: S0-⑥ 공유결합 — bond(스프링+우물)·R-CPLX·runBonding(복사/삼체 안정화·아레니우스 해리)·예산 B 포화. node verify.js 52 PASS. 이량체 H₂ 우세·원자가 포화(H₃=0)·안정화 필수·해리. 경계: 이핵 H₂O 는 ⑩ 이월. 뷰어: 결합 실선.
- step-0007: S0-⑦ 내부 모드·열용량 계단 — modes.js(강체 회전자+양자 모드·LB 교환). node verify.js 57 PASS. C_v 1→3/2→5/2 계단 창발(양자 효과). 중고온 LB 편향 ⑨ 이월. 뷰어: C_v(T) 계단.
- step-0008: S0-⑧ 분극·응집 — polarization.js(self-contained·기반 ②만). 전하–유도쌍극자+분산 C6(α·IE)·U_pol·클러스터·3장면. node verify.js 64 PASS. 중성 응집 창발(배위 1.65→2.41)·α=0→소멸(근원=α)·장부 8e-5. 발견: SCF→쌍별 근사·미시정준 잠열 공존. 뷰어: 클러스터 색·μ 화살표.
- step-0009: S0-⑨ 통계 관문 — 새 물리 0. measure(entropy·equilibrium·localTemp)+s09 2장면. node verify.js 69 PASS. 엔트로피 앙상블 증가(3.74→4.35)·르샤틀리에·van't Hoff 기울기 1.89(≈D)·T_국소 정합. 발견: van't Hoff 는 캐논ical → 항온조 필요. 뷰어: S(t) 밴드·자유 팽창.
- step-0010: S0-⑩ 수프 관문 — 실원소 합류. engine 쌍별 D(pairD·회귀0)+실원소 H·O·He·Ne·Dpair(436:463:146)·annealSoup. node verify.js 74 PASS. 2H:1O 어닐 → H2O1:46 최다 창발·과결합 0·어닐링 이득. 발견: H–H≈O–H→H₂ 경쟁·O=O 이중결합 부재. 뷰어: CPK·라이브 어닐링.
- step-0011: S0-⑪ 승격 배관 MVP(Part I 관문). promote.js(coarse⇧·rethaw⇩·회귀0)+s11-mvp-box·runScenario(5막 한 장부). node verify.js 81 PASS. 왕복 보존 정확(ΔE·P 1e-15·조성 ε=0)·output.json v0(S1 입력)·반데르발스 꼬리(−0.14). Part I 닫힘·S1-① 열림.
- step-0016: S0-⑯ 수소 결합. design 2단(1차 측정: 점전하만은 H-결합 E ~1/10 부족→2차 R-HB 명시 author). hbond.js 신설(엔진 diff 0·V_hb=−D_hb·w·(û_DH·û_HA)ⁿ·힘 3체 P·L 보존·U_hb→U_bond·detect)+s16-cluster/mixed+청록 점선. node verify.js 116 PASS. 방향 선택성 ⟨θ⟩ 155°·Ne 선택성·E_hb/D_OH 0.06·거리 위계 1.49·온도 응답(배위 3.73→2.98)·물 네트워크 3.73·장부. 발견: 점전하 부족→R-HB 정직 보정·고립쌍 검출만.
- step-0017: S0-⑰ 산·염기(양성자 릴레이). acidbase.js 신설(엔진 ①–⑯ diff 0·R-PROT 접촉 행: H 가 결합 갈아타기 D–H···A→D⁻···H–A·이온 정체=O 형식전하 측정·장벽 비대칭 에너지 가드 창발·용매화 노브 protSolv=⑯ D_hb 동형)+s17-autoionize/relay/acid-mix(강산 Xa=Z9)+이온 하이라이트(주황 H₃O⁺/청록 링 OH⁻). node verify.js 123 PASS. 재결합·중성우세(2.75→0.50·K_w≪1)·온도응답 흡열(고T 1.36>저T 0.80)·릴레이 Grotthuss(전하MSD/분자MSD 233≫1)·산→H₃O⁺증가(1.25>0)·배위 예산 O≤3·전하 보존 Σformal=0·H 보존. 발견: 점전하 자동이온화 동결→protSolv 명시·자발 이온화 불가→주입·T응답 실증·사건 보존 ~1e-7(⑯ 이월)·강산 이온화 약함.
- step-0018: S0-⑱ 라디칼·연소(불·3D). combustion.js 신설(엔진 diff 0·카탈로그 [R-ABSTRACT]+COVALENT·추상 R·+X–Y→R–X+Y·=⑰ 갈아타기 일반화·라디칼=예산 잔여 측정·ΔE=⑩ 쌍별 D·발열→K_tr·분지 1→2 예산 창발·O₂ 이중결합 대체 order2)+s18-ignition/flame-front+불꽃 글로우. node verify.js 130 PASS. 점화대조(스파크 18>2×3)·발열(33>12)·분지 원자 O 6·H₂O 3.25·전선 확산 4/4·Σc 보존. 3D(⑬ 정합). 발견: O=O 이중 필수·닫힌 단열→열폭발·전환 40%.
- step-0019: S0-⑲ 금속(비국소 전자 풀·3D). metal.js 신설(엔진 diff 0·전 상호작용 유계·금속 결합=이온-이온 유효 인력 우물 Dmetal=전자 풀 차폐의 고전 대체·명시 자유전자(⑤)=이동 캐리어 keCouple 0.7·힘: 부드러운 쿨롱+이온 발산 (rcII/d)⁶+전자 유계 소프트코어)+s19-na-cluster/conduction/screening/covalent-contrast+파란 전자 풀. node verify.js 136 PASS. 비포화 응집(3D 배위 10.67≥8≫공유 B=4)·공유 포화 대조(V4≤4·과결합 0)·전도(장on 전자 −6.34≫이온·장off≈0)·전자 구속(E<0)·차폐(16>1.3)·Σc·Σe 보존. 발견: 고전 플라스마 응집 불가→유효 우물·유계 힘·R-DELOC 후속·⑱⑲ 3D 정합.
- step-0015: S0-⑮ 극성(QEq). polarity.js 신설(엔진 diff 0·전기음성도 균등화 선형계·χ=(IE+EA)/2 ③·η=k_c/s+IE·자기항→U_pol·외부장 F=qE)+s15 4장면+전하 링·쌍극자. node verify.js 109 PASS. 3단 한 QEq(O₂ 무극성·BeH₂ 상쇄·H₂O μ 0.157)·χ 서열 ③(O>H>Be)·장 배향 0.70·Σq=Q. 발견: η 온사이트 쿨롱 지배·CO₂ 는 BeH₂ 대체.
- step-0014: S0-⑭ 형상(VSEPR). geometry.js 신설(엔진 diff 0·V_ang=k Σ/(1−cosθ+c0)·힘 −∇V·P·L 보존·고립쌍 준정적 최소화·③ 도메인)+s14 3장면. node verify.js 101 PASS. 3단 앵커 한 상수(CH₄ 109.5·H₂O 101·BeH₂ 175·분자별 분기 0)·형상 서열·고립쌍 압박 근원·P·L. 발견: 직선 소프트 최소는 이완 측정·CO₂ 이중결합 대기.
- step-0013: S0-⑬ z 해동(3D) — **엔진 변경 0**(engine/catalog diff=0·①⑦ 회계). scenes frozenZ 분기+s13 3장면+momentumVariance+3D 투영 뷰어. node verify.js 93 PASS. z 동결 증거·z 해동 등분배 창발(iso 0→~1.0)·3D 장부·겹침 0·결합 위상. 발견: 엔진 변경 0 성립·⑦ 3D C_v 이월.
- step-0012: S0-⑫ 복사장(Part II) — ④ 광자 빈 → photon 입자(runPhotonField 흡수+유도 방출·radiationMode='field' additive·회귀0)+s12 3장면+measure photonStats. node verify.js 88 PASS. 복사 냉각·공동 정상 상태·스펙트럼 단색(2준위)·Σphoton.E==E_photon통 정확·유도 방출 3.04×(빔). 발견: 2준위→단색·field/bin 공존. 뷰어: s12-stim 축정렬 82% 빔.
