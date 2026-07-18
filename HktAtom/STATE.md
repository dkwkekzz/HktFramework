# STATE — HktAtom 현재 위치 (SSOT · step마다 §1~4 덮어쓰기 · §5 만 append)

> 권위 분리: 목표 [CLAUDE.md](CLAUDE.md) · 척추 [KERNEL.md](KERNEL.md) · 이 문서 = "지금 어디까지·다음은 무엇". 크기 예산 ≤ 20KB.

## §1 NOW — 지금 어디까지

> **핵 게이트 G-핵 개방·핵분열 실현 (step-0026~0028)**: 사용자 "핵분열 가능" 요구 → CONTRACT §6-② 발동. ㉓ 핵종 → ㉔ 붕괴 → **㉕ 분열(k_eff=1 경계) 완결**. 가상 핵종·무차원. ㉑(성능·G-성능) 규모 벽 미도래로 보류·㉖ 융합은 별 S2 연계 후속.
> **㉒ MaterialModel 완결 (step-0022~0025)**: ①~⑳ + ㉒ 4 필드(EOS·확산·반응망·물앵커). output v0.3 실물. 경로 정정: S1-①(0021) 먼저 열었다 되돌아와 ㉒ 완결. **S1-② 응집은 핵 트랙 뒤 재개.**

- **S0-㉓㉔㉕ 핵 트랙 — 핵분열 실현 (step-0026~0028)**: **`nuclear.js` 신설**(엔진 diff 0·자체 완결). ㉓ **c=(Z,e)→(Z,N,e)**(N 화학 미접촉)·질량 Σ 회계(**질량 결손=장부 실물**)·앵커 동위원소 진동 ω_D/ω_H=0.7746≈√(μ_H/μ_D)(author 0). ㉔ 붕괴(β⁻/α/γ/n·lifetime·Q값)·**지수 감쇠**(λ≈ln2/반감기·R²=0.9999)·계열 붕괴(Bateman)·붕괴열·지연 중성자. ㉕ **분열**: 중성자 입자(전자 형식·q=0·핵과만 단면)·단면 밴드·R-N-SCAT/CAP/FISSION·**k_eff=1 경계 창발**(밀도 스캔 [0.52→1.53] 단조↑·미임계→초임계·누설 vs 생산·author 0)·감속 창발(열중성자 0.607 vs 0)·**Δm·c² 회계**(방출 E=질량 결손 정확)·NuclideTable⇧(`nuclide-table.json`·서버 중간 해상도 소비). `verify --only 23,24,25`=**12 PASS**. 발견: ⑦ ħω 고정→결합 스프링 앵커·균질 매질(Σc 구조적 보장)·지연 제어 관찰 기록. 뷰어: 진자+붕괴 곡선+k_eff 경계+연쇄 폭주.

- **S0-㉒ MaterialModel ⇧ 완결 (step-0022~0025)**: **`material.js`**(엔진 diff 0). 물 수프·클러스터 굴려 4 필드 측정(author 0): ㉒-a EOS P·U(T,ρ)·㉒-b 확산 D=MSD 기울기·㉒-c 반응망 k(T)→아레니우스·㉒-d 물 앵커(방향 선택성 352≫등방·밀도 응집 심화). **output v0.1→v0.3 가법**(스키마 태그 유지·S1 소비 불변): +equationOfState·+transportCoefficients·+reactionNetwork·+interactionModel·+errorBounds·observables 5종. `verify --only 22`=15 PASS. **㉒ 닫는 기준(design/22 방향·밀도) 충족**. 압력 정합 waterSoup(분산 응집 EOS 접힘만 ㉒-b2 격차). 뷰어 히트맵 3+아레니우스+방향/밀도. 세부 step-0022~0025.md.
- **S1-① 분자 단계 무대 (step-0021·요약)**: `stages/S1-molecule/` 신설(자체 완전·접점 input.json 데이터뿐). 커널 재귀 entity={c,r,p,u}: c=조성 다발·u=E_bind+T_int(온도의 탄생). ①은 힘 0 자유 비행. verify 13 PASS. pairPotential 로드만(②응집이 켬)·분자=점입자. **핵 트랙 뒤 ② 재개.** 세부 stages/S1-molecule/steps/step-0021.md.
- **S0-①~⑳ 뼈대·화학 (요약 — 전문 §5·step 문서·엔진 diff 0·author 0)**: ①무대·장부 ②힘 ③준위(주기율표) ④전이 엔진(볼츠만) ⑤이온화(NaCl) ⑥공유결합(H₂ 포화) ⑦내부 모드(C_v 계단) ⑧분극·응집(C6) ⑨통계(엔트로피↑) ⑩수프(2H:1O→H₂O) ⑪승격 MVP(Part I) ⑫복사장 ⑬z 해동(3D) ⑭형상(VSEPR) ⑮극성(QEq) ⑯수소결합(방향 R-HB) ⑰산염기(R-PROT) ⑱연소 ⑲금속 ⑳플라스마. 모듈: engine/scenes/measure/levels/modes/polarization/promote/geometry/polarity/hbond/acidbase/combustion/metal/ionized.js. 발견 §3.
- **계획 국면 (step-0000)**: 네 축 확정(CLAUDE·KERNEL·CONTRACT·DESIGN+design/①~㉖). 결정: 3D·z동결·결정론 폐기·통 분리 장부·전이 카탈로그·두 시계·가상 원소·핵 게이트.

## §2 NEXT — 다음 한 조각 (step-0029 = S1-② 응집·액적 재개)

**핵분열 실현(㉕ k_eff=1 경계) 완료 — 사용자 요구 충족. 사다리 전진으로 복귀.** :
- **S1-② 응집 (액적·물방울)** (다음·stages/S1-molecule/): S1 무대(step-0021)가 로드만 하던 `input.pairPotential` 인력 꼬리를 `computeForces` 로 켜서 분자 응집(액적)을 창발. S0 arc ①→② 동형·손 튜닝 0. **S1 은 S0 output.json v0.3(㉒ 실물 MaterialModel)로 input 갱신 후 소비**(EOS·D·k·interactionModel 이용 가능). 배위수↑·클러스터 측정.
- **핵 트랙 잔여 (게이트/후속)**: ㉖ 융합(Gamow·별 S2 연계)·개체 파편 추적(Σc 동적)·지연 중성자 정량 제어·폭발 왕복(서버+중간 해상도 몫·CONTRACT §5). ㉑ 성능(G-성능·규모 벽)·㉒-b2·η/κ·상전이 정련.

**산출물 2 트랙**: `output.json` v0.3(㉒ 화학 MaterialModel·S1 입력) + `nuclide-table.json`(㉕ 핵 파라미터·서버 중간 해상도 소비). 커널 가설 실증은 S1-④ 규모 정합 관문.

## §3 OPEN GAPS — 열린 격차

- **㉒ 완결·잔여 격차** (step-0022~0025): EOS 는 척력+반응만(waterSoup virial 정확·분산 응집 loop 없음→㉒-b2 부피 유한차분 압력). η/κ 수송·상전이 정련 여지(S1 몫). 반응성 EOS 조성 T 응답=⑨ 동형·정상.
- **핵 트랙 가상·내부 동결** (step-0026~): 핵종=상태표(질량·수명·단면·바닥 특권)·핵 내부 동결(껍질/공명 없음). 실세계 정합 주장 없음(무차원·밸런스는 세계 배치·CONTRACT §5). ㉓ 앵커는 결합 스프링 진동서 측정(⑦ ħω 고정→design/23 정정).
- **입출력 JSON 스키마 초안만** (출력 산출 세부 단계가 확정): DESIGN §6.2 초안 있음 — 실측정하며 확정.
- **응집이 액적+증기 공존에 머묾** (step-0008): 미시정준 응축 잠열 자체 가열→완전 응축 아님. 상 분리·라벨은 S1. SCF 상호분극→쌍별 근사.
- **V₀ 상수 튜닝 여지** (S0-④~⑧): 수식형 DESIGN §3 확정 — 상수는 노브·앵커 재현이 조정(수식 변경만 DESIGN 개정 사건).
- **T_국소 비평형·van't Hoff 캐논ical** (step-0009): 평형서 ⟨T_국소⟩≈전역 T·비평형 구배 기록만. van't Hoff 는 항온조 T 고정 창발(기울기 1.89≈D). 세부 step-0009.md.
- **규모 정합 "닮음"·강등 ⇩·앵커 오차 미정** (S1-④): 히스토그램 거리 등 관문이 assert 확정 · u′ 미시 배치 샘플링.
- **족 내림 이온화 경향 미창발** (step-0003): 간이 Slater 는 Li>Na>K 못 냄(3s 침투 과소)·위조 안 함. 주기 경향으로 충분. 세부 step-0003.md.
- **이핵 시그니처·단일 결합만** (step-0006/0010/0018): 등방 우물→⑩ 쌍별 D(436:463:146·O–H 최강). O=O 이중결합은 ⑱ 에서 order2·D=2.15 장면 보정·일반 π 결합 후속.
- **어닐링 항온조=측정 도구** (step-0010): 냉각 뺀 열→E_escape 회계(④ 동형).
- **재해동 T 재표본 이동·⑪ MVP 배관** (step-0011): coarse→rethaw Σc·E·P·조성 정확 보존·미시 재샘플 T~1.3배. output v0 최소 — 실 S1 입력은 ㉒(step-0022~0025 완결).
- **점전하만은 H-결합 부족→R-HB 명시** (step-0016): 방향 가중 R-HB 노브(D_hb=1.0). 얼음·밀도역전(4°C)은 S1. 세부 step-0016.md.
- **자동이온화 동결→protSolv·연소 열폭발·산염기** (step-0017·0018): 냉수 자발 이온화 불가(ΔE≈+9·차폐 없음)→순 전하당 −protSolv·Q² 용매화(값 2.0). 연소는 O₂=order2 대체·닫힌 단열→열폭발·전환~40%·느린 전선/k(T)/완전연소는 S1. 정량 K_w(T)·pH·완충 S1/㉒. 세부 step-0017/0018.md.
- **S1 무대 힘 0·분자=점입자·㉑ 규모 벽 미도래** (step-0021): pairPotential 로드만(②가 켬)·분자 강체 점(내부 동역학 없음). O(N²) 병목 미도래(N 작음)→㉑ payoff S1+ 몫. 세부 stages/S1-molecule/steps/step-0021.md.
- **이온화 곡선=속박 게이트+캐논ical 측정·금속=유효 우물 author** (step-0020·0019): 국소 속박(½μ|Δv|²+U_coul<0) 게이트라야 고온 재결합 떨어져 S자 창발(author 0). 이온화 흡열→thermostat T 고정 측정. 금속=고전 점전자 응집 불가→이온-이온 우물 Dmetal(TF 차폐 고전 대체·배위 10~12). 집단 플라스마·밴드·자성 범위 밖. 세부 step-0019/0020.md.
- **QEq 하드니스·형상·⑦ 3D C_v** (step-0013~0015): η=k_c/s+IE 프록시(양수)·CO₂→BeH₂·형상 소프트 최소 과감쇠 이완 측정(BeH₂ 175°)·modes.js 2D 하드코딩→3D C_v 재작성 이월(⑦ 2D 회귀 불변). 세부 step-0013~0015.md.
- **2준위→단색 스펙트럼·볼츠만 ~10% 편향** (step-0012·0004): ⑫ 2준위라 스펙트럼 단색(다준위·플랑크 꼬리 ㉒). 복사압/산란/편광 밖. ④ LB 점유 (g1/g0)e^{−ΔE/T}의 0.9~1.15×(비율∈[0.8,1.25]+단조로 충분·정밀 KL 은 DSMC 이월). 세부 step-0004/0012.md.

## §4 DURABLE — 여러 step 이 반복 참조할 불변

- 단계 5원칙 (KERNEL §1) · 커널 체크 5항 (KERNEL §6) · 검증 4기둥 (KERNEL §7) — 매 세부 단계 통과 의무.
- 단계 간 접점은 input/output.json 뿐 — 코드 화살표 금지.
- 상위 상호작용 파라미터는 하위 측정 산출물만 (S0 실물리 author 만 예외).
- 시각화 없이 닫지 않는다. 손 튜닝은 즉시 격차 등록.

## §5 INDEX — step 인덱스 (literal 1줄/step append)

- step-0028: S0-㉕ 분열 k_eff=1 경계(핵분열 실현). nuclear.js +중성자 입자(전자 형식·q=0·핵과만 단면)+단면 밴드(fast/thermal·1/v)+reactorSim(균질 매질 평균자유행로 몬테카를로·엔진 diff 0). 행 R-N-SCAT(감속=운동학 창발)/R-N-CAP/R-FISSION(F→파편2+ν≈2.5+Q). k_eff=생산/(흡수+누설) 밀도 스캔 [0.52→1.53] 단조↑ 미임계→초임계 **경계 창발**(누설 vs 생산·author 0)·감속(열중성자 0.607 vs 0)·Δm·c² 회계(방출=질량 결손 정확)·지연 중성자·NuclideTable⇧(nuclide-table.json). node verify.js = 169 PASS(+㉕ 5). 발견: 균질 매질(Σc 구조적)·지연 제어 관찰·가상 무차원·폭주 캡. 위력=회계·폭탄=조건(k_eff≥1). 뷰어 k경계+연쇄 폭주 100→3456. 세부 step-0028.md.
- step-0027: S0-㉔ 붕괴 채널. nuclear.js +DECAY 상태표(halfLife·channels β⁻/α/γ/n·Q·daughter)+decaySim(개체군 지수 대기시간 몬테카를로·엔진 diff 0). 앵커 지수 감쇠 λ=0.227≈ln2/hl(R²=0.9999·수명 재현·author 0)·계열 FPa→FPb→FPc(딸 Bateman 봉우리)·붕괴열 누적·지연 중성자(3% n·k_eff 제어 근원)·Q값 회계(질량 결손→KE+γ+중성미자 E_escape). node verify.js = 164 PASS(+㉔ 4). 낙진 시간 감쇠=서버 붕괴 큐 창발(CONTRACT §5-6). 뷰어 붕괴 곡선 4종. 세부 step-0027.md.
- step-0026: S0-㉓ 핵종·동위원소 (핵 게이트 G-핵 개방·사용자 핵분열 요구=CONTRACT §6-②). nuclear.js 신설(엔진 diff 0). c=(Z,e)→(Z,N,e)·N 화학 미접촉·질량 Σ 회계 m=Z·MP+N·MN−BE·C2(질량 결손=장부 실물). 가상 핵종 H1·D2·O16·N1. 앵커 동위원소 진동 ω_D/ω_H=0.7746≈√(μ_H/μ_D)(결합 스프링 ω=√(k/μ)·author 0). node verify.js = 160 PASS(①~⑳ 142+㉒ 15+㉓ 3). 발견: ⑦ ħω 고정→앵커는 결합 스프링서 측정(design/23 정정)·질량 결손 회계용·화학 질량 테이블 유지. 뷰어 두 진자(H–O·D–O). 세부 step-0026.md.
- step-0025: S0-㉒-d 물 앵커 interactionModel (㉒ 닫힘). material.js +measureInteractionModel(waterCluster ⑯ 부분전하+방향 R-HB 굴림). 방향 h(c): 분자간 H···O 쌍을 정합코사인 c 빈→빈별 유효 H-결합 E(정렬 c→1 깊고 미정렬 ~0·선택성 352≫등방). 밀도 g(ρ): 밀도별 응집/분자(저→고 -0.05→-1.96 협동 심화). output.json v0.2→v0.3 +interactionModel(방향·밀도 표)·observables+=interactionModel(가법). node verify.js --only 22 = 15 PASS. **㉒ 닫는 기준(design/22 방향·밀도 의존) 충족 → ㉒(S0 진짜 출력) 완결·S0 비게이트 작업 완료.** 뷰어 방향/밀도 막대 추가. 세부 step-0025.md.
- step-0024: S0-㉒-c 반응망 k(T). material.js +measureReactionNetwork(결합 집합 스냅샷 비교→해리 사건 카운트·k=사건/노출량·엔진 훅 0). ln k vs 1/T 최소제곱 → 아레니우스 {A,Ea,R²}. output.json +reactionNetwork(아레니우스)·observables+=k(반응)(가법). node verify.js --only 22 = 12 PASS(EOS 6 + 확산 3 + 반응 3): k(T)↑(열활성)·Ea=1.62>0·R²=0.99(직선). 뷰어 아레니우스 플롯 추가. Ea=매질 유효 장벽(카탈로그 결합 D 와 차=매질 효과·author 0). 세부 step-0024.md.
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
- step-0016: S0-⑯ 수소 결합. hbond.js(엔진 diff 0·2차 R-HB 방향성 V_hb=−D_hb·w·(û·û)ⁿ·3체 P·L 보존). 116 PASS: 방향 선택성 155°·온도 응답·물 네트워크. 발견: 점전하만은 ~1/10 부족→R-HB 명시. 세부 step-0016.md.
- step-0017: S0-⑰ 산·염기(양성자 릴레이). acidbase.js(엔진 diff 0·R-PROT H 결합 갈아타기·protSolv 용매화). 123 PASS: 중성우세(K_w≪1)·릴레이 Grotthuss·Σformal=0. 발견: 자동이온화 동결→protSolv·주입. 세부 step-0017.md.
- step-0018: S0-⑱ 라디칼·연소(불). combustion.js(엔진 diff 0·추상 R+X–Y→R–X+Y·라디칼=예산 잔여·분지 예산 창발). 130 PASS: 점화대조·발열·전선·Σc 보존. 발견: O=O 이중 필수·닫힌 단열→열폭발. 세부 step-0018.md.
- step-0021: S1-① 분자 단계 무대. stages/S1-molecule/ 신설(자체 완전·S0 import 0·접점 input.json=S0 output.json 데이터만). 커널 재귀 entity={c,r,p,u}: c=원자종 조성 다발·u=접힌 E_bind+T_int(온도의 탄생). ①은 힘 0 자유 비행(S0-① 동형). engine/scenes/measure/verify+index.html 자체 재구현(통 4통·Verlet). node verify.js 13 PASS: 계약(스키마·분자 20 로드·Σc=input.macro.atomCount {O:16,H:32})·장부(ΔE 0·ΔP 0·Σc 불변)·무대 탄도적 MSD 비 4·u(U_int=ΣE_bind)·경계 회계. 발견: 유한 N T 재척도·①은 pairPotential 로드만(②)·분자=점입자·㉑ 규모 벽 미도래로 미룸.
- step-0020: S0-⑳ 이온화 기체(플라스마). ionized.js(엔진 diff 0). 이온화=두 접촉 전이 평형(author 0·R-ION+R-REC3 속박 전자만 포획). 142 PASS: x(V1) S자·IE 서열·저온 억제·사하·Σq−n_e=0. 발견: 속박 게이트=S자 심장·집단 플라스마 예약. 세부 step-0020.md.
- step-0019: S0-⑲ 금속(비국소 전자 풀). metal.js(엔진 diff 0·금속 결합=이온-이온 우물 Dmetal=전자 풀 차폐 고전 대체). 136 PASS: 비포화 응집(배위 10.67≫B=4)·전도·차폐·Σc·Σe 보존. 발견: 고전 플라스마 응집 불가→유효 우물. 세부 step-0019.md.
- step-0015: S0-⑮ 극성(QEq). polarity.js(엔진 diff 0·전기음성도 균등화·χ=(IE+EA)/2). 109 PASS: 3단 한 QEq(O₂ 무극성·H₂O μ 0.157)·χ 서열·Σq=Q. 발견: CO₂→BeH₂. 세부 step-0015.md.
- step-0014: S0-⑭ 형상(VSEPR). geometry.js(엔진 diff 0·V_ang 각도 반발·고립쌍 준정적 최소화). 101 PASS: 한 상수 3단(CH₄ 109.5·H₂O 101·BeH₂ 175). 세부 step-0014.md.
- step-0013: S0-⑬ z 해동(3D). 엔진 변경 0·scenes frozenZ 분기+3D 뷰어. 93 PASS: z 동결 증거·해동 등분배(iso 0→1.0)·겹침 0. 발견: ⑦ 3D C_v 이월.
- step-0012: S0-⑫ 복사장. ④ 광자 빈→photon 입자(흡수+유도 방출·radiationMode='field'). 88 PASS: 복사 냉각·공동 평형·유도 방출 3.04×·Σphoton.E==E_photon. 발견: 2준위→단색. 세부 step-0012.md.
