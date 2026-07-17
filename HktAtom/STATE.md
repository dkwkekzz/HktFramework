# STATE — HktAtom 현재 위치 (SSOT · step마다 §1~4 덮어쓰기 · §5 만 append)

> 권위 분리: 목표 [CLAUDE.md](CLAUDE.md) · 척추 [KERNEL.md](KERNEL.md) · 이 문서 = "지금 어디까지·다음은 무엇". 크기 예산 ≤ 20KB.

## §1 NOW — 지금 어디까지

> **경로 정정 (step-0022)**: S1-①(step-0021)을 먼저 열었으나 그것이 소비하는 output.json 은 ⑪ MVP v0(물질 충실도 아님)였다 — S0 의 *진짜* 출력 ㉒ MaterialModel 미완인 채 사다리를 오른 것. 되돌아와 ㉒ 를 착수했다(전제 ⑬~⑯ 충족). **S1-②(응집)는 ㉒ 로 output 이 실물화된 뒤 재개.**

- **S0-㉒-a·b MaterialModel ⇧ 측정 EOS + 수송 D (step-0022·0023)**: **`material.js` 신설**(엔진 diff 0·engine/scenes/measure 재사용). 물 수프를 **T×ρ 그리드 NVT 굴림**→ ㉒-a P(비리얼)·U(물질) 표 + ㉒-b **확산 D=MSD 기울기**(아인슈타인) 표 측정(author 0·3×3·R=3). **output.json v0.1→v0.2 가법**(CONTRACT §7·스키마 태그 유지·S1 v0 소비 불변): +stateVariables[T,ρ,조성]·+equationOfState·+transportCoefficients.diffusion·+errorBounds(P·U·C_v·D)·observables+=EOS·D(수송). `node verify.js --only 22`=**9 PASS**: 계약(material+promote 하위호환)·회계(Σc 30→30)·EOS(P(ρ)↑·P(T)↑·**C_v>0** 전 ρ)·수송(**D(ρ)↓** 혼잡·**D(T)↑** 열활성)·author0(발효 표 경향). **압력 정합**: waterSoup(pairForces·virial 힘모델 정확 일치)로 측정 — polForces 분산 virial 은 world.virial 밖→분산 응집 EOS 접힘 ㉒-b2(격차). 뷰어: index.html 하단 히트맵 3종(P·U·D)+C_v.
- **S1-① 분자 단계 무대 (step-0021·요약)**: `stages/S1-molecule/` 신설(자체 완전·S0 import 0·접점 input.json 데이터뿐). 커널 재귀 entity={c,r,p,u}: c=조성 다발·u=접힌 E_bind+T_int(온도의 탄생). ①은 힘 0 자유 비행(S0-① 동형). node verify.js=13 PASS(계약 Σc={O:16,H:32}·장부 ΔE/ΔP 0·탄도 MSD비 4·경계 회계). 발견: 유한 N T 재척도·pairPotential 로드만(②응집이 켬)·분자=점입자. **㉒ 로 input 실물화 대기 중.** 세부 stages/S1-molecule/steps/step-0021.md.
- **S0-⑱⑲⑳ (요약 — 전문 §5·step 문서·3D·엔진 diff 0·힘 유계)**: ⑳ 이온화 기체(ionized.js·두 전이 평형 곡선 author 0·R-ION+R-REC3 속박 전자만 포획·IE=③ 유도·142 PASS·x(V1) 단조↑ S자·IE 서열·사하 밀도·발견 속박 게이트=S자 심장·캐논ical 측정) · ⑲ 금속(metal.js·비국소 전자 풀·금속 결합=이온-이온 유효 우물 Dmetal·비포화 응집 배위 10.67≫B=4·전도·차폐·136) · ⑱ 라디칼·연소(combustion.js·추상 R+X–Y→R–X+Y·라디칼=예산 잔여·분지 예산 창발·점화·발열·전선·130). 발견은 §3.
- **S0-⑭~⑰ (요약 — 전문 §5·step 문서)**: ⑰ 산·염기(acidbase.js·R-PROT 양성자 릴레이·K_w≪1·Grotthuss·123 PASS) · ⑯ 수소 결합(hbond.js·2차 R-HB 방향성 인력·155°·116) · ⑮ 극성(polarity.js·QEq 전기음성도 균등화·χ=(IE+EA)/2 ③·H₂O μ 0.157·109) · ⑭ 형상(geometry.js·VSEPR 공통 각도 반발 하나·CH₄ 109.5·H₂O 101·BeH₂ 175·101). 넷 다 엔진 diff 0·author 0·발견은 §3·step 문서.
- **S0-④~⑬ (요약 — 전문 §5·step 문서)**: ⑬ z 해동(3D·엔진 변경 0·93 PASS) · ⑫ 복사장(photon 입자·88) · ⑪ 승격 MVP(promote.js⇧⇩·output.json v0·Part I 닫힘·81) · ⑩ 수프 관문(실원소·2H:1O→H₂O 우세·쌍별 D·74) · ⑨ 통계 관문(엔트로피↑·van't Hoff·새 물리 0·69) · ⑧ 분극·응집(polarization.js·C6·64) · ⑦ 내부 모드(modes.js·C_v 계단·57) · ⑥ 공유결합(runBonding·H₂·원자가 포화·52) · ⑤ 이온화(R-XFER·NaCl·47) · ④ 전이 엔진(카탈로그·두 시계·볼츠만·40).
- **S0-①②③ 뼈대 (요약 §5)**: ① 무대·장부(engine/scenes/measure/verify+index.html·통 10통·Verlet·16) ② 힘(pairForces 쿨롱+척력·EPS_E=5e-4·비리얼·24) ③ 준위(levels.js 순수 함수·주기율표 창발·32). 이후 전 단계가 이 뼈대·불변식 재사용.
- **계획 국면 (step-0000)**: 네 축 확정(CLAUDE·KERNEL·CONTRACT v0·DESIGN+design/①~㉖). 결정: 3D·z동결·결정론 폐기(앙상블)·통 분리 장부·전이 카탈로그·두 시계·연속 예산·가상 원소·핵 게이트.

## §2 NEXT — 다음 한 조각 (step-0024 = S0-㉒-c 반응망 k(T))

**㉒ 는 다-step 아크다** — a=EOS·b=확산 D 완료. ㉒ 공식 닫는 기준(design/22: **물 V′ 의 방향·밀도 의존이 모델에 담김**)은 아직. 남은 조각:
- **㉒-c 반응망 k(T)** (다음): 활성 카탈로그 행별 k(T) 측정(⑱ 방식)→아레니우스 {A,Ea}. 측정값과 카탈로그 author 값의 차 = 매질 효과(기록). reactionNetwork 가법.
- **㉒-d 방향/밀도 interactionModel (물 앵커·㉒ 닫힘)**: pairPMF 를 각도 빈(⑯ H-결합 정합각)×밀도 빈으로 확장 측정 → 방향 보정 h(θ)·밀도 보정 g(ρ). 등방 대비 유의차가 닫는 기준.
- **㉒-b2 분산 응집 EOS 압력** (격차·optional): 현 EOS 는 waterSoup(척력+반응)라 반데르발스 액-기 loop 없음. 부피 스케일 유한차분 압력(전 채널 virial·코어 diff 0)으로 polForces 응집을 압력에 넣어야 loop 창발. (§3 격차)
- **㉒ 닫힌 뒤 = S1-② 응집 재개**: output.json 이 실물 MaterialModel 되면 S1 이 EOS·D·pairPotential 소비해 액적 창발(step-0021 §발견).
- **미룬 것 = S0-㉑ 성능·동적 병합**: S0 규모 O(N²) 벽 미도래 — payoff(거시) S1+ 몫([design/21-merge.md](stages/S0-atom/design/21-merge.md)·게이트 G-성능).

**승격 계약 발효 진행** ([CONTRACT.md](CONTRACT.md)): output v0.2 = ⑪ MVP + ㉒-a EOS + ㉒-b 확산(가법). 관측량 계약에 EOS(ε=0.3)·D(수송·ε=0.4) 선언. 방향/밀도·반응망은 ㉒-c·d 몫.

## §3 OPEN GAPS — 열린 격차

- **㉒ EOS 는 척력+반응만·분산 응집 미포함** (step-0022): waterSoup(pairForces)로 world.virial 힘모델 정확 일치하나 polForces 분산 virial 은 world.virial 밖→EOS 에 반데르발스 loop 없음. 담으려면 ㉒-b2 부피 스케일 유한차분 압력(전 채널·코어 diff 0). 결합 virial 도 제외(⑪ 관례). 반응성 EOS 라 조성 T 응답(고온 해리→U 급증·반응 C_v)=⑨ 동형·정상.
- **㉒ 다-step 아크 (a·b 완료·c·d 남음)** (step-0022·0023): a=EOS·b=확산 D 발효. ㉒ 공식 닫는 기준(물 V′ 방향·밀도 의존)은 ㉒-d 몫. 반응망 k(T)=㉒-c·η/κ 수송·상전이 미착수 — §2 순서.
- **입출력 JSON 스키마 초안만** (출력 산출 세부 단계가 확정): DESIGN §6.2 초안 있음 — 실측정하며 확정.
- **응집이 액적+증기 공존에 머묾** (step-0008): 미시정준 응축 잠열 자체 가열→완전 응축 아님. 상 분리·라벨은 S1. SCF 상호분극→쌍별 근사.
- **V₀ 상수의 튜닝 여지** (S0-④~⑧): 수식형은 DESIGN §3 로 확정 — 상수(R·차폐·D·k_b·ν·접촉 Eₐ 등)는 노브로 두고 앵커 재현이 조정한다 (수식 변경은 DESIGN 개정 사건).
- **T_국소 비평형 한계·van't Hoff 캐논ical** (step-0009): 평형서 ⟨T_국소⟩≈전역 T(rel 0.005)·비평형 구배는 기록만. van't Hoff 는 항온조로 T 고정해 창발(기울기 1.89≈D·미시정준 스캔 무효). 세부 step-0009.md.
- **규모 정합 "닮음" 지표·강등 ⇩ 규약·앵커 허용 오차 미정** (S1-④): 온도·밀도·구조 히스토그램 거리 등 관문이 assert 로 확정 · u′ 일관 미시 배치 샘플링.
- **족 내림 이온화 경향 미창발** (step-0003): 간이 Slater 는 Li>Na>K 못 냄(3s 침투 과소평가)·위조 안 함. 상위(⑮ χ) 착수 전 재검·그 전엔 주기 경향으로 충분.
- **이핵 시그니처·단일 결합만** (step-0006/0010/0018): 등방 우물→⑩ 쌍별 D(436:463:146·O–H 최강). O=O 이중결합은 ⑱ 에서 order2·D=2.15 장면 보정·일반 π 결합 후속.
- **어닐링 항온조는 측정/준비 도구** (step-0010): 냉각이 뺀 열을 E_escape 로 회계 → 장부 닫힘(④ 복사 냉각 동형).
- **재해동 T 재표본 이동·⑪ MVP 는 배관 증명** (step-0011): coarse→rethaw Σc·E·P·조성 정확 보존·미시 재샘플로 T~1.3배(창[0.6,1.6]). output.json 은 최소 — 실 S1 입력(EOS 등)은 ㉒(EOS 는 step-0022 부분 발효).
- **점전하만은 H-결합 부족→R-HB 명시** (step-0016): 방향 가중 R-HB 노브(D_hb=1.0). 얼음·밀도역전(4°C)은 S1. 세부 step-0016.md.
- **자동이온화 동결→protSolv·연소 열폭발·산염기** (step-0017·0018): 냉수 자발 이온화 불가(ΔE≈+9·차폐 없음)→순 전하당 −protSolv·Q² 용매화(값 2.0). 연소는 O₂=order2 대체·닫힌 단열→열폭발·전환~40%·느린 전선/k(T)/완전연소는 S1. 정량 K_w(T)·pH·완충 S1/㉒. 세부 step-0017/0018.md.
- **S1 무대 힘 0·분자=점입자·㉑ 규모 벽 미도래** (step-0021): pairPotential 로드만(②가 켬)·분자 강체 점(내부 동역학 없음). O(N²) 병목 미도래(N 작음)→㉑ payoff S1+ 몫. 세부 stages/S1-molecule/steps/step-0021.md.
- **이온화 곡선=속박 게이트+캐논ical 측정·금속=유효 우물 author** (step-0020·0019): 국소 속박(½μ|Δv|²+U_coul<0) 게이트라야 고온 재결합 떨어져 S자 창발(author 0). 이온화 흡열→thermostat T 고정 측정. 금속=고전 점전자 응집 불가→이온-이온 우물 Dmetal(TF 차폐 고전 대체·배위 10~12). 집단 플라스마·밴드·자성 범위 밖. 세부 step-0019/0020.md.
- **QEq 하드니스·CO₂ 대체** (step-0015): η=k_c/s+IE 프록시(양수·author 0). CO₂→BeH₂ 대체. 세부 step-0015.md.
- **형상 한계** (step-0014): 소프트 최소라 과감쇠 이완 최소 배치로 측정(BeH₂ 175°·L 잔차~1e-4). 세부 step-0014.md.
- **⑦ 3D C_v 재검 이월** (step-0013): `modes.js` 2D 하드코딩 → 3D C_v 재작성 필요(별도 이월·⑦ 2D 회귀 불변).
- **2준위→단색 스펙트럼·볼츠만 ~10% 편향** (step-0012·0004): ⑫ 2준위라 스펙트럼 단색(다준위·플랑크 꼬리 ㉒). 복사압/산란/편광 밖. ④ LB 점유 (g1/g0)e^{−ΔE/T}의 0.9~1.15×(비율∈[0.8,1.25]+단조로 충분·정밀 KL 은 DSMC 이월). 세부 step-0004/0012.md.

## §4 DURABLE — 여러 step 이 반복 참조할 불변

- 단계 5원칙 (KERNEL §1) · 커널 체크 5항 (KERNEL §6) · 검증 4기둥 (KERNEL §7) — 매 세부 단계 통과 의무.
- 단계 간 접점은 input/output.json 뿐 — 코드 화살표 금지.
- 상위 상호작용 파라미터는 하위 측정 산출물만 (S0 실물리 author 만 예외). 손 튜닝 발견 즉시 격차 등록.
- 시각화 없이 닫지 않는다.

## §5 INDEX — step 인덱스 (literal 1줄/step append)

- step-0023: S0-㉒-b 수송 확산 D(T,ρ). material.js +measureDiffusion(MSD 기울기·아인슈타인 D=slope/2dim·평형 후 disp 리셋). output.json +transportCoefficients.diffusion·+errorBounds.D·observables+=D(수송)(가법). node verify.js --only 22 = 9 PASS(EOS 6 + 확산 3): D(ρ)↓(혼잡)·D(T)↑(열활성)·발효 표 경향. 뷰어 D 히트맵 추가. 반응성 소프 clus 진동은 절편 흡수·성장분만 기울기. 세부 step-0023.md.
- step-0022: S0-㉒-a MaterialModel ⇧ 측정 EOS. material.js 신설(엔진 diff 0·engine/scenes/measure 재사용). 물 수프 T×ρ 그리드 NVT 굴림→P(비리얼)·U(물질) 표 측정(author 0·3×3·R=3). output.json v0.1→v0.2 가법(스키마 태그 유지·S1 v0 소비 불변): +stateVariables[T,ρ,조성]·+equationOfState 표·+errorBounds(P·U·C_v). node verify.js --only 22 = 6 PASS: 계약(material+promote 하위호환)·회계(Σc 30→30)·P(ρ)↑·P(T)↑·C_v=∂U/∂T>0 전 ρ·author0(발효 표 경향). 뷰어 index.html 하단 EOS 히트맵. 발견: 분산 응집 EOS virial 접힘 ㉒-b(waterSoup virial 정합 위해 뺌)·㉒ 다-step 아크·S1-② 는 ㉒ 닫힌 뒤. 경로 정정=S1 먼저 열었다 되돌아옴. 세부 step-0022.md.

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
- step-0011: S0-⑪ 승격 배관 MVP(Part I 관문). promote.js(coarse⇧·rethaw⇩·회귀0)+s11-mvp-box·runScenario(5막 한 장부). node verify.js 81 PASS: 왕복 보존 정확(ΔE·P 1e-15·조성 ε=0)·output.json v0(S1 입력)·반데르발스 꼬리. Part I 닫힘·S1-① 열림.
- step-0016: S0-⑯ 수소 결합. hbond.js 신설(엔진 diff 0·2차 R-HB V_hb=−D_hb·w·(û_DH·û_HA)ⁿ·힘 3체 P·L 보존·U_hb→U_bond)+s16-cluster/mixed. node verify.js 116 PASS: 방향 선택성 155°·Ne 선택성·E_hb/D_OH 0.06·온도 응답·물 네트워크 3.73. 발견: 점전하만은 H-결합 ~1/10 부족→R-HB 명시 보정·고립쌍 검출만. 세부 step-0016.md.
- step-0017: S0-⑰ 산·염기(양성자 릴레이). acidbase.js 신설(엔진 diff 0·R-PROT: H 결합 갈아타기 D–H···A→D⁻···H–A·이온=O 형식전하·장벽 에너지 가드·용매화 protSolv=⑯ D_hb 동형)+s17-autoionize/relay/acid-mix. node verify.js 123 PASS: 중성우세(K_w≪1)·흡열 T응답·릴레이 Grotthuss 233·산→H₃O⁺·Σformal=0. 발견: 자동이온화 동결→protSolv·자발 이온화 불가→주입·사건 보존 1e-7. 세부 step-0017.md.
- step-0018: S0-⑱ 라디칼·연소(불·3D). combustion.js 신설(엔진 diff 0·추상 R+X–Y→R–X+Y·=⑰ 일반화·라디칼=예산 잔여·ΔE=⑩ 쌍별 D·발열→K_tr·분지 1→2 예산 창발·O₂ 이중결합 대체)+s18-ignition/flame-front. node verify.js 130 PASS: 점화대조(18>2×3)·발열(33>12)·분지 원자 O 6·전선 4/4·Σc 보존. 발견: O=O 이중 필수·닫힌 단열→열폭발·전환 40%. 세부 step-0018.md.
- step-0021: S1-① 분자 단계 무대. stages/S1-molecule/ 신설(자체 완전·S0 import 0·접점 input.json=S0 output.json 데이터만). 커널 재귀 entity={c,r,p,u}: c=원자종 조성 다발·u=접힌 E_bind+T_int(온도의 탄생). ①은 힘 0 자유 비행(S0-① 동형). engine/scenes/measure/verify+index.html 자체 재구현(통 4통·Verlet). node verify.js 13 PASS: 계약(스키마·분자 20 로드·Σc=input.macro.atomCount {O:16,H:32})·장부(ΔE 0·ΔP 0·Σc 불변)·무대 탄도적 MSD 비 4·u(U_int=ΣE_bind)·경계 회계. 발견: 유한 N T 재척도·①은 pairPotential 로드만(②)·분자=점입자·㉑ 규모 벽 미도래로 미룸.
- step-0020: S0-⑳ 이온화 기체(플라스마·3D). ionized.js 신설(엔진 ①–⑲ diff 0·힘 유계). 이온화=두 접촉 전이 평형(곡선 author 0): R-ION(충돌 이온화·비용 상대 KE 에서만·느린 충돌 불가=문턱)+R-REC3(3체 재결합·속박 전자만 포획·A.p+=e.p 정확). IE=③ VIRTUAL 유도(V1=1.0·V0=2.0)+s20-saha-scan/recomb-glow. node verify.js 142 PASS: 곡선 x(V1) 단조↑ S자·IE 서열·저온 억제 0·사하 밀도·Σq−n_e=0·장부 P(전자 포함). 발견: 속박 게이트가 S자 심장·캐논ical 측정 필수·집단 플라스마 예약. 세부 step-0020.md.
- step-0019: S0-⑲ 금속(비국소 전자 풀·3D). metal.js 신설(엔진 diff 0·힘 유계·금속 결합=이온-이온 유효 인력 우물 Dmetal=전자 풀 차폐 고전 대체·명시 자유전자 keCouple 0.7)+s19-na-cluster/conduction/screening/covalent-contrast. node verify.js 136 PASS: 비포화 응집(배위 10.67≫B=4)·공유 포화 대조·전도(장on −6.34≫이온)·전자 구속·차폐(16>1.3)·Σc·Σe 보존. 발견: 고전 플라스마 응집 불가→유효 우물·⑱⑲ 3D 정합. 세부 step-0019.md.
- step-0015: S0-⑮ 극성(QEq). polarity.js 신설(엔진 diff 0·전기음성도 균등화 선형계·χ=(IE+EA)/2 ③·η=k_c/s+IE·자기항→U_pol·외부장 F=qE)+s15 4장면. node verify.js 109 PASS: 3단 한 QEq(O₂ 무극성·BeH₂ 상쇄·H₂O μ 0.157)·χ 서열 ③·장 배향 0.70·Σq=Q. 발견: η 온사이트 쿨롱 지배·CO₂→BeH₂ 대체.
- step-0014: S0-⑭ 형상(VSEPR). geometry.js 신설(엔진 diff 0·V_ang=k Σ/(1−cosθ+c0)·힘 −∇V·P·L 보존·고립쌍 준정적 최소화·③ 도메인)+s14 3장면. node verify.js 101 PASS: 3단 앵커 한 상수(CH₄ 109.5·H₂O 101·BeH₂ 175)·형상 서열·고립쌍 압박 근원. 발견: 직선 소프트 최소는 이완 측정·CO₂ 이중결합 대기.
- step-0013: S0-⑬ z 해동(3D) — 엔진 변경 0(engine/catalog diff=0). scenes frozenZ 분기+s13 3장면+3D 투영 뷰어. node verify.js 93 PASS: z 동결 증거·z 해동 등분배(iso 0→~1.0)·3D 장부·겹침 0. 발견: 엔진 변경 0 성립·⑦ 3D C_v 이월.
- step-0012: S0-⑫ 복사장(Part II) — ④ 광자 빈 → photon 입자(runPhotonField 흡수+유도 방출·radiationMode='field'·회귀0)+s12 3장면. node verify.js 88 PASS: 복사 냉각·공동 정상 상태·스펙트럼 단색(2준위)·Σphoton.E==E_photon 정확·유도 방출 3.04×. 발견: 2준위→단색·field/bin 공존.
