# STATE — HktAtom 현재 위치 (SSOT · step마다 §1~4 덮어쓰기 · §5 만 append)

> 권위 분리: 목표 [CLAUDE.md](CLAUDE.md) · 척추 [KERNEL.md](KERNEL.md) · 이 문서 = "지금 어디까지·다음은 무엇". 크기 예산 ≤ 20KB.

## §1 NOW — 지금 어디까지

- **S0-⑮ 극성 (step-0015) — QEq**: 부분 전하는 author 하지 않는다 — **전기음성도 균등화**(QEq)로 전하 재분배·극성=**전하×형상(⑭)** 창발. **`polarity.js` 신설**(self-contained·엔진 ①–⑭ **diff 0**·⑭ computeForces 합성): 분자마다 `E(q)=Σ(χq+½ηq²)+½ΣJqq` s.t. Σq=Q 선형계(가우스). `χ=(IE+EA)/2` **③ 유도·author 0**·`J=k_c/(d+s)`(pairForces 분자내 쿨롱과 동일→중복 0)·자기항→**U_pol**·외부장 F=qE(배향). scenes s15-o2/beh2/h2o/field + 부분 전하 링·쌍극자 화살표. `node verify.js`=**109 PASS**(①–⑭ 101 회귀 + ⑮ 8): **3단 기준 한 QEq** O₂ 무극성(max|q|≈0)·BeH₂ 결합극성 0.041 이나 |μ_mol| 0.002≈0(직선 상쇄)·H₂O |μ_mol| 0.157>0(굽음+χ_O>χ_H)·극성 서열 H₂O>BeH₂≳O₂·**χ 서열 ③** O 5.97>H 1.95>Be 1.32·**장 응답 배향** ⟨cosθ⟩ 0.70 vs 등방 0·장부 닫힘·Σq=Q 정확. 뷰어(눈 확인·콘솔 0): 전하 링·노랑 쌍극자(H₂O 있음·BeH₂ 상쇄). 발견: 교과서 η=(IE−EA)/2 는 ③ EA>IE 로 음수 → **η=k_c/s+IE 프록시**·CO₂ 는 BeH₂ 대체(⑩ 격차).
- **S0-⑭ 형상 (step-0014) — 결합각·VSEPR** — 요약(전문 §5): 분자 형상 author 0 — **공통 각도 반발 하나**로 정사면체·굽음·직선 동시 창발. `geometry.js`(self-contained·엔진 **diff 0**·`V_ang=k Σ w_a w_b/(1−cosθ+c0)`·힘 −∇V·P·L 보존·고립쌍 준정적 최소화·③ 유도 도메인). node verify.js **101 PASS**: 3단 앵커 한 상수(CH₄ 109.5·H₂O 101·BeH₂ 175·분자별 분기 0)·형상 서열·고립쌍 압박 근원(λ_lp=1 대조)·장부·P·L 보존. 발견: 직선 소프트 최소는 이완 측정·CO₂ 이중결합 대기.
- **S0-⑬ z 해동 (step-0013)** — 요약(전문 §5): `frozenZ:false` 하나로 3D·**엔진 변경 0**(①⑦ 자유도 회계). node verify.js **93 PASS**: z 해동 등분배 창발(iso 0→~1.0)·3D 장부·겹침 0·결합 위상. ⑦ 3D C_v 이월.
- **S0-⑫ 복사장 (step-0012) — Part II 시작** — 요약(전문 §5): ④ 광자 빈 → **photon 입자**(runPhotonField·radiationMode='field' additive·회귀 0). node verify.js **88 PASS**: 복사 냉각·공동 정상 상태·스펙트럼 단색(2준위)·Σphoton.E 정확·유도 방출 3.04×(빔). 뷰어: s12-stim 축정렬 82% 빔.
- **S0-⑪ 승격 배관 MVP (step-0011) — Part I 관문 닫힘** — 요약(전문 §5): `promote.js`(coarse⇧·rethaw⇩·회귀 0) = 승격·해동 왕복. node verify.js **81 PASS**: 5막 한 장부·왕복 보존 정확(ΔE·P 1e-15·조성 ε=0)·**output.json v0**(S1 입력)·반데르발스 꼬리(−0.14·author 0). 뷰어: ⇧다운로드·⇩왕복.
- **S0-⑩ 수프 관문 (step-0010)** — 요약(전문 §5): 실원소 합류 — **2H:1O 수프 → H₂O 우세 창발**. **쌍별 결합 우물 D**(등방 ⑥ gap 해결·engine pairD·회귀 0)+실 비율 436:463:146·annealSoup(냉각·E_escape 회계). node verify.js **74 PASS**: 어닐 H2O1:46>H2:26·과결합 0·어닐링 이득. 발견: H–H≈O–H → H₂ 경쟁·O=O 이중결합 부재. 뷰어: CPK·라이브 어닐링.
- **S0-⑨ 통계 관문 (step-0009)** — 요약(전문 §5): 평형 창발 — **새 물리 0**. measure entropy·equilibrium·localTemp. node verify.js **69 PASS**: 엔트로피 앙상블 증가 3.74→4.35·르샤틀리에·van't Hoff 기울기 1.89(≈D)·T_국소 정합. 발견: van't Hoff 는 캐논ical → 항온조 필요. 뷰어: S(t) 밴드·자유 팽창.
- **S0-⑧ 분극·응집 (step-0008)** — 요약(전문 §5): `polarization.js`(self-contained·기반 ②만·회귀0). 두 인력 채널 = 전하–유도쌍극자(쌍별)+분산 C6(α·IE 유도). node verify.js **64 PASS**: 저온 최대성분 0.60>0.5·배위 1.65→2.41·**α=0 → U_pol 정확 0·응집 소멸**(근원=α)·이온유도(분산 off 고립). 발견: SCF→쌍별 근사(C6 이중계상 회피)·미시정준 잠열 공존→배위수 1차 지표. 뷰어: 클러스터 색·μ 화살표·응집 스캔.
- **S0-⑦ 내부 모드·열용량 계단 (step-0007)** — 요약(전문 §5): `modes.js`(self-contained·강체 회전자+양자 모드·LB 교환·회귀 0). node verify.js **57 PASS**: C_v 1.00→1.71→2.80(1·3/2·5/2 순차·저온 동결·**순수 양자 효과**). 중고온 ~10~20% LB 편향 ⑨ 이월. 뷰어: C_v(T) 계단 곡선.
- **S0-⑥ 공유결합 (step-0006)** — 요약(전문 §5): 결합 상태 기계(접근→복합체→안정화→결합)·예산 B 포화·`runBonding`·`measure.molecules`. node verify.js **52 PASS**: **이량체 H₂ 우세**·**원자가 포화**(H₃=0)·안정화 필수·해리. 경계: 이핵 H₂O 는 등방 D 라 미우세 → ⑩ 쌍별 D 로 해결. 뷰어: 결합 실선·복합체 점선.
- **S0-⑤ 이온화·전자 이전 (step-0005)** — 요약(전문 §5): 전자 이전(R-XFER)+쿨롱 격자 = **NaCl 앵커**(author 0). 자유전자 인프라(electron 입자·q=Z−ne)·`transferElectron`(오르막 게이트). node verify.js **47 PASS**: Σc(전자수) 불변·마델룽 E<0·교대 질서>0.1. 자유전자 이온화⇌재결합은 ⑳ 이월. 뷰어: +/− 이온 링.
- **S0-④ 전이 엔진 (step-0004)** — 요약(전문 §5): 전이 카탈로그 실행기·두 시계·에너지 출처 강제·`checkedApply`(전이 E·P≤1e-9). node verify.js **40 PASS**: **볼츠만 창발**(비율∈[0.8,1.25])·냉각·공동·저온 억제. 발견: R-EXC/REL 분리 편향 → **LB 재분배 1행 통합**(잔여 ~10% ⑨ 이월). 뷰어: 들뜸 글로우·광자 빈.
- **S0-③ 준위·예산 (step-0003)** — 요약(전문 §5): 전자 구조 전부 **순수 함수**(`levels.js`)·Aufbau·간이 Slater·훈트·**결합차수 예산 B**·가상 4종·boltzmann. node verify.js **32 PASS**: **주기율표 창발**(원자가 1,2,3,4,3,2,1,0·주기 IE 단조·희유기체 피크·알칼리 골). 발견: 승위 빈 p 확장(Be/Mg 2가)·**족 내림 Li>Na>K 미창발(간이 Slater 한계·OPEN GAP)**. 뷰어: 준위③ 차트.
- **S0-①② 무대·장부 + 힘·충돌 (step-0001·0002)** — 요약(전문 §5): ① `engine/scenes/measure/verify.js`+`index.html` 뼈대(Vec3·통 분리 장부 10통·velocity Verlet·경계 3종·z동결·사건 큐·검증 하네스) 16 PASS. ② `pairForces`(쿨롱+척력·최소 이미지)·`U_elec`·`EPS_E=5e-4`/`DT_STIFF=0.004`/`MIN_DSIGMA=0.7` 고정·비리얼 압력 24 PASS(θ(b) 러더퍼드 단조·겹침 0). 이후 전 단계가 이 뼈대·불변식을 재사용.
- **계획 국면 (step-0000, 코드 0줄)**: 네 축 확정(CLAUDE 목표·KERNEL 커널/5원칙/4기둥·CONTRACT v0·DESIGN+design/①~㉖). 주요 결정: 3D 자료구조·z동결·결정론 폐기(앙상블 통계)·통 분리 장부·전이 카탈로그 한 형식·두 시계·연속 결합차수 예산·가상 원소 우선·핵 확장팩 게이트. 세부는 해당 문서 참조.

## §2 NEXT — 다음 한 조각 (step-0016 = S0-⑯ 수소 결합)

**⑮ 극성 닫힘 — QEq 부분 전하·극성=전하×형상 창발(O₂/BeH₂/H₂O 3단)·장 배향.** 두 갈래:
- **S1-① (열림)**: `output.json` 이 S1 입력으로 준비됨 — S1 분자 단계 착수 가능(design/11 경계: "S1 소비 테스트는 S1-① 몫").
- **다음 구현 = step-0016 = S0-⑯ 수소 결합** (앵커: 물 네트워크 · [design/16-hydrogen-bond.md](stages/S0-atom/design/16-hydrogen-bond.md) · 전제 ⑧⑭⑮): ⑮의 부분 전하(H⁺·O⁻)+⑭ 형상·고립쌍 방향 → O–H···O 수소 결합 네트워크 창발(물의 응집·구조). **로드맵(design README): ⑯(수소결합)→⑰(산·염기)…㉒(실 S1 입력 ⇧).** 세부 선택 자유(⑯ 또는 S1-① 착수) — STATE §2 가 확정.

**승격 계약 v0 존재** ([CONTRACT.md](CONTRACT.md)): 필드 채움은 ⑪(⇧ MVP)·㉒(MaterialModel)·S1 진입 몫.

**승격 계약은 이미 v0 존재** ([CONTRACT.md](CONTRACT.md) — 네 축 중 인터페이스 축): MaterialModel 스키마·관측량 계약(|ΔO|<ε_O)·재해석 조건·유효 범위·오차 한계. 필드 채움은 ⑧/⑪(출력 산출 ⇧)·㉒(MaterialModel)·S1 진입이 한다.

## §3 OPEN GAPS — 열린 격차

- **입출력 JSON 스키마 초안만** (출력 산출 세부 단계가 확정): DESIGN §6.2 초안 있음 — 실측정하며 확정.
- **응집이 액적+증기 공존에 머묾** (step-0008 발견): 미시정준(닫힌계)이라 응축 잠열이 계를 T_c 근방으로 자체 가열 → 완전 응축(단일 액적) 아님·최대성분 50% 교차가 시드에 흔들린다. 정직한 물리(열 배출 sink 없음) — 배위수·U_pol/N 으로 견고히 닫음. 완전 상 분리·상 라벨은 **S1**(열 배출·규모)이 담당. 분극의 SCF 상호분극도 쌍별 근사로 대체(C6 이중 계상 회피, design/08 §정련).
- **V₀ 상수의 튜닝 여지** (S0-④~⑧): 수식형은 DESIGN §3 로 확정 — 상수(R·차폐·D·k_b·ν·접촉 Eₐ 등)는 노브로 두고 앵커 재현이 조정한다 (수식 변경은 DESIGN 개정 사건).
- **T_국소 정의의 비평형 한계** (step-0009 부분 확인): 평형 장면에서 ⟨T_국소⟩≈전역 T 정합 확인(rel 0.005). 비평형(온도 구배 s09-gradient)은 관찰·기록만 — 구배 속 아레니우스 반응률의 공간 프로파일 정량 assert 는 미착수(향후 반응-확산 정련).
- **van't Hoff 는 캐논ical 측정 필요** (step-0009): ⑥ 복사 결합이 방출 냉각으로 평형 T 를 협대역 자체 고정 → 미시정준 T0 스캔 무효. 명시적 항온조로 T 고정해 창발 확인(기울기 1.89≈D). 닫힌 3체 안정화면 미시정준 가능 — formBond 개정 사건이라 보류(복사 안정화로 충분).
- **규모 정합의 "닮음" 지표 미정** (S1-④ 전 결정): 온도·밀도·구조 수 히스토그램 거리 등 — 관문 세부 단계가 assert 로 확정.
- **강등 ⇩ 의 통계 복원 규약 미정** (S1-④): u′ 와 일관된 미시 배치 샘플링 방법.
- **현실 앵커의 허용 오차 미정** (각 관문): "닮음"의 수치 임계 — 각 세부 단계가 assert 로 확정하며 정한다.
- **족 내림 이온화 경향 미창발** (step-0003 발견): 간이 Slater 는 Li>Na>K 를 못 냄(측정 Na>Li>K — 3s 침투 과소평가). 손튜닝 금지 원칙에 따라 위조 안 함. 3s/3p 침투 보정이 필요한 상위 단계(⑮ χ 유도 등) 착수 전 재검 — 그 전엔 주기 경향의 나머지(주기 단조·피크·골)로 충분.
- **이핵 분자 시그니처** (step-0006 발견 → step-0010 부분 해결): 등방 우물(종 무관 D) 때문에 ⑥에선 H₂O 우세 안 함. **⑩이 쌍별 D(436:463:146)로 해결** — O–H 최강이라 어닐링 후 H₂O 우세 창발. 남은 것: 쌍별 D 는 *결합 세기*만 종류화, *굽은 형상*(⑭)·*부분 전하/극성*(⑮)은 여전히 없음(⑩의 물은 조성만 맞는 분자).
- **단일 결합만 (O=O 이중결합 부재)** (step-0010 발견): bond.order 는 1 고정 — O=O(실 498, 이중)를 못 표현해 우리 "O₂"(단일 O–O·D 0.63)가 비현실적으로 약함. 그래서 H₂+O₂ 준안정 장면 대신 크래시 vs 어닐 대조로 활성화 장벽을 실증. 이중/삼중 결합은 결합차수 확장(π 결합) 도입 시 — 후속(⑭ 형상 또는 별도).
- **어닐링 항온조는 측정/준비 도구** (step-0010): 냉각 스케줄이 속도를 재조정(열 제거)하되 뺀 열을 E_escape 로 회계 → 장부는 닫힘(④ 복사 냉각과 동형). 닫힌 미시정준 냉각(복사만으로 열역학 최소 도달)은 더 느린 자연 냉각 필요 — 실용상 어닐링으로 충분.
- **재해동 T 는 재표본이라 이동** (step-0011): coarse→rethaw 는 Σc·E·P·조성 **정확** 보존하나 미시 재샘플이라 U 가 덜 최적 → 같은 E 에서 T ~1.3배(T비 1.28). 관측량 계약의 뜻(보존 정확·분포 통계=엔트로피). 조성 ε=0·T 창[0.6,1.6].
- **⑪ MVP 는 배관 증명·물질 충실도 아님**: output.json v0 는 최소(방향성·밀도 의존·협동 효과 잃음·PMF 단원자 중성쌍 근사). 실 S1 입력(EOS·수송·반응망)은 **㉒ MaterialModel**(⑬~⑯ 이후).
- **QEq 하드니스·CO₂ 대체** (step-0015): 교과서 η=(IE−EA)/2 는 ③ EA>IE(step-0003 gap)로 음수→비볼록 → **η=k_c/s(온사이트 쿨롱)+IE 프록시**(양수·author 0·앵커는 χ 서열이 정함·③ 정확). CO₂ 직선 상쇄는 BeH₂ 로 대체(⑩ 이중결합 격차·⑭ 동일). 분자간 전하 이동·유전율 없음(성분 내 재분배·⑤ 별개). QEq 자기E는 U_pol(⑧과 통 공유·비공존).
- **형상 한계** (step-0014): `1/(1−cosθ)` 는 180° 기울기→0(소프트 최소)이라 형상은 **과감쇠 이완 최소 배치**로 측정(열평균 아님·BeH₂ 175°). CO₂ 직선은 C=O 이중결합(⑩ 격차) 필요 → BeH₂ 로 대체. 고립쌍 준정적 최소화는 P·E 정확 보존하나 L 잔차 ~1e-4(고립쌍 없는 분자는 L 기계 정밀도). design 물 λ_lp=1 대조 "120°"는 오기(물 4도메인 → 109.5° 정정).
- **⑦ 3D C_v 재검 이월** (step-0013): `modes.js` 가 2D 하드코딩이라 3D C_v 는 재작성 필요 — "한 step=현상 1개"로 별도 이월(⑦ 2D C_v 회귀 불변). 완전 CH₄ 우세도 어닐링(⑩ H₂ 경쟁) 몫 — ⑬은 3D 에서 ⑥ 공유 기계 도는지만.
- **2준위 → 단색 스펙트럼 · field/bin 공존** (step-0012): ⑫ 광자 입자는 냉각·공동·유도 방출 재현하나 2준위라 광자 E=dE → 스펙트럼 단색(연속·플랑크 꼬리는 다준위/진동-복사 결합 몫·㉒). 복사압·산란·편광 범위 밖. `E_photon` 통이 bond 복사 sink(⑥⑩⑪)로도 쓰여 `radiationMode='field'` additive(⑩ fallback 동형·field 장면 E_photon==Σphoton.E).
- **볼츠만 점유 ~10% 편향** (step-0004 발견): LB 재분배가 접촉 상관 때문에 (g1/g0)e^{−ΔE/T} 의 ~0.9~1.15× (고립 무작위쌍은 ~0.95×). 위조 안 함 — 정밀 KL<ε 는 **DSMC-정합 충돌 처리**로 이월. step-0009 통계 관문은 엔트로피·K_eq·T_국소를 검증했으나 이 LB 점유 편향은 직접 재측정 안 함(별개 량) — 여전히 열림. 그 전엔 비율 ∈[0.8,1.25]+단조 응답으로 창발 확인 충분.

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
- step-0015: S0-⑮ 극성(QEq). polarity.js 신설(엔진 diff 0·전기음성도 균등화 선형계·χ=(IE+EA)/2 ③·η=k_c/s+IE·자기항→U_pol·외부장 F=qE)+s15 4장면(randOrient)+전하 링·쌍극자 화살표. node verify.js 109 PASS. 3단 한 QEq(O₂ 무극성·BeH₂ 결합극성/분자무극성 상쇄·H₂O μ 0.157)·극성 서열·χ 서열 ③(O>H>Be)·장 배향 ⟨cosθ⟩ 0.70·장부·Σq=Q. 발견: η 온사이트 쿨롱 지배·CO₂ 는 BeH₂ 대체.
- step-0014: S0-⑭ 형상(VSEPR). geometry.js 신설(엔진 diff 0·V_ang=k Σ/(1−cosθ+c0)·힘 −∇V·P·L 보존·고립쌍 준정적 최소화·③ 유도 도메인)+s14 3장면+고립쌍 화살표. node verify.js 101 PASS. 3단 앵커 한 상수(CH₄ 109.5·H₂O 101·BeH₂ 175·분자별 분기 0)·형상 서열·고립쌍 압박 근원·장부·P·L. 발견: 직선 소프트 최소는 이완 측정·CO₂ 이중결합 대기.
- step-0013: S0-⑬ z 해동(3D) — **엔진 변경 0**(engine/catalog diff=0·①⑦ 회계). scenes frozenZ 분기+s13 3장면+momentumVariance+3D 투영 뷰어. node verify.js 93 PASS. z 동결 증거·z 해동 등분배 창발(iso 0→~1.0)·3D 장부·겹침 0·결합 위상. 발견: 엔진 변경 0 성립·⑦ 3D C_v 이월.
- step-0012: S0-⑫ 복사장(Part II) — ④ 광자 빈 → photon 입자(runPhotonField 흡수+유도 방출·radiationMode='field' additive·회귀0)+s12 3장면+measure photonStats. node verify.js 88 PASS. 복사 냉각·공동 정상 상태·스펙트럼 단색(2준위)·Σphoton.E==E_photon통 정확·유도 방출 3.04×(빔). 발견: 2준위→단색·field/bin 공존. 뷰어: s12-stim 축정렬 82% 빔.
