# STATE — HktAtom 현재 위치 (SSOT · step마다 §1~4 덮어쓰기 · §5 만 append)

> 권위 분리: 목표 [CLAUDE.md](CLAUDE.md) · 척추 [KERNEL.md](KERNEL.md) · 이 문서 = "지금 어디까지·다음은 무엇". 크기 예산 ≤ 20KB.

## §1 NOW — 지금 어디까지

- **S0-⑪ 승격 배관 MVP 구현 완료 (step-0011) — Part I 관문 닫힘**: 프로젝트 진짜 핵심 산출물(승격·해동 시스템)의 첫 실물. **`promote.js`(신설·self-contained·engine 만·회귀 0)** = KERNEL §3.3·CONTRACT §3 구현: **⇧ `coarse(world)`**(거시 상태 {분자종 개수·V·**물질 E**(E_photon·E_escape 제외)·T·P} · 미시 배치는 버림) · **⇩ `rethaw(coarse,template)`**(별 구조 배치 → `pushApart` 겹침 제거 → 감쇠 완화 → 맥스웰(T) → **E 정확 보정**·P=0 유지) · `pmf`(PMF 쌍 퍼텐셜 — 반데르발스 꼬리) · `buildOutput`/`validateOutput`(output.json v0). **`scenes.js`**: `s11-mvp-box`(polForces 결합+분산 통합) + `runScenario`(5막 열욕 스케줄·E_escape 회계·한 장부). `node verify.js`=**81 PASS**(①–⑩ 74 회귀 + ⑪ 7): **한 장부** 5막(형성→응집→가열→반응→냉각) max|ΔE|/E 1.19e-4≤EPS_E·Σc 불변(H₂O 우세 7) · **왕복 보존 정확** coarse→rethaw ΔE 3.6e-15·P 2.6e-15·Σc 3/3·**조성 계약 ε=0**(3/3, T비 1.28∈[0.6,1.6] — 재표본이라 미시 분포만 이동·보존은 정확=엔트로피) · **output.json v0 유효**(7종·2쌍) · **반데르발스 꼬리**(PMF O–O 우물 −0.14 — α·IE 에서 나옴·author 0). **`output.json` 산출**(S1 입력). 뷰어 "s11-mvp-box": 5막 진행 표시·CPK 물 분자·**⇧ output.json 다운로드·⇩ 재해동 왕복 버튼**(눈 확인 완료·Σc 정확·ΔE~1e-15).
- **S0-⑩ 수프 관문 구현 완료 (step-0010)**: 실원소 합류 — **2H:1O 수프 → H₂O 우세 창발**(라벨 분기 0). 핵심 장치 = **쌍별 결합 우물 D**(등방 우물의 ⑥ gap 해결): `engine.js` 에 `pairD`+`bd.D`(스칼라 `world.Dbond` fallback → ①–⑨ **회귀 0**). `scenes.js` 실원소 종 H·O·He·Ne(B/IE 는 ③ `levels` 유도·author 아님·σ/mass 는 무차원 비율 노브) + **`Dpair` = 실 결합 에너지 비율 H–H:O–H:O–O=436:463:146** author(D_OH 최강·D_OO 최약). 고T 시작 → **냉각 스케줄 `annealSoup`**(항온조가 뺀 열은 **E_escape 로 회계 → 장부 닫힘**)로 열역학 산물 H₂O 로 어닐링. `node verify.js`=**74 PASS**(①–⑨ 69 회귀 + ⑩ 5): 어닐 pooled **최다분자 H2O1:46**>H2:26>OH:17·과결합 0(O 예산 2 포화)·장부 3.8e-4≤EPS_E·**어닐링 이득** H₂O 어닐 46>크래시 33×1.2(활성화 장벽 — H–H≈O–H 근접이라 크래시는 H₂ 갇힘)·실원소 앵커(B H1·O2·He0·Ne0·IE He>H). **발견**: (a) H–H(436)≈O–H(463) 근접 → H₂ 는 실제 경쟁자(실 화학의 준안정성) → H₂O 우세는 어닐링(열역학 최소 도달)이 필요·크래시는 kinetic 갇힘 (b) 단일 결합만이라 O=O 이중결합 부재 → H₂+O₂ 준안정 장면은 대신 **크래시 vs 어닐 대조**로 활성화 장벽 실증. 뷰어 "s10-water-soup" — **CPK 색(H 흰·O 빨강)·물 분자(H–O–H)·라이브 어닐링**·우세 분자 H2O1.
- **S0-⑨ 통계 관문 구현 완료 (step-0009)**: 평형은 창발한다 — **새 물리 0**(measure.js·verify.js·scenes.js 초기 조건만). Part I 물리의 통계역학 계약을 일괄 검증. **measure.js 신설 측정 3종**: `entropy`(위상공간 셀×속도 빈 coarse-grained S=−Σpᵢln pᵢ)·`equilibrium`(연결 성분 크기별 → K_c=[이량체]/[단분자]²·해리분율)·`localTemp`(이웃 k체 국소 온도 분포). **scenes.js 장면 2종**: s09-entropy-corner(구석 자유 팽창)·s09-gradient(온도 구배 이완). `node verify.js`=**69 PASS**(①–⑧ 64 회귀 + ⑨ 5): ① **엔트로피 앙상블 증가** ⟨S⟩ 3.74→4.35(3se ±0.05·개별 비단조 7/12 = 요동 존재·제2법칙 창발)·셀 2배(4·8)에도 경향 유지 ② **르샤틀리에** 해리분율 V 0.11→2V 0.23(부피↑→해리↑·**비율 공식 author 0**·미시상태 샘플링) ③ **van't Hoff** ln K vs 1/T 기울기 **1.89 ∈[1.4,3.0]**(≈D=2.0·병진 엔트로피 보정·평형 도달도에 민감) ④ **T_국소 평형 정합** ⟨T국소⟩ 1.168 vs 전역 1.173(rel 0.005). **핵심 발견**: van't Hoff 는 **캐논ical(고정 T)** 관계인데 ⑥ 복사 결합이 방출 냉각으로 T 를 자체 조절(T0 스캔 무효·평형 T 0.43~0.51 협대역) → **명시적 항온조**(측정 전용·속도 재조정)로 T 고정해야 성립. 뷰어 "보기: 엔트로피⑨" — S(t) 앙상블 밴드(구석→고루)·자유 팽창 애니메이션.
- **S0-⑧ 분극·응집 (step-0008)** — 요약(전문 §5): `polarization.js`(self-contained·기반 ②만·회귀0). 두 인력 채널 = 전하–유도쌍극자(쌍별)+분산 C6(α·IE 유도). node verify.js **64 PASS**: 저온 최대성분 0.60>0.5·배위 1.65→2.41·**α=0 → U_pol 정확 0·응집 소멸**(근원=α)·이온유도(분산 off 고립). 발견: SCF→쌍별 근사(C6 이중계상 회피)·미시정준 잠열 공존→배위수 1차 지표. 뷰어: 클러스터 색·μ 화살표·응집 스캔.
- **S0-⑦ 내부 모드·열용량 계단 (step-0007)** — 요약(전문 §5): `modes.js`(self-contained·강체 회전자+양자 모드·LB 교환·회귀 0). node verify.js **57 PASS**: C_v 1.00→1.71→2.80(1·3/2·5/2 순차·저온 동결·**순수 양자 효과**). 중고온 ~10~20% LB 편향 ⑨ 이월. 뷰어: C_v(T) 계단 곡선.
- **S0-⑥ 공유결합 (step-0006)** — 요약(전문 §5): 결합 상태 기계(접근→복합체→안정화→결합)·예산 B 포화·`runBonding`·`measure.molecules`. node verify.js **52 PASS**: **이량체 H₂ 우세**·**원자가 포화**(H₃=0)·안정화 필수·해리. 경계: 이핵 H₂O 는 등방 D 라 미우세 → ⑩ 쌍별 D 로 해결. 뷰어: 결합 실선·복합체 점선.
- **S0-⑤ 이온화·전자 이전 (step-0005)** — 요약(전문 §5): 전자 이전(R-XFER)+쿨롱 격자 = **NaCl 앵커**(author 0). 자유전자 인프라(electron 입자·q=Z−ne)·`transferElectron`(오르막 게이트). node verify.js **47 PASS**: Σc(전자수) 불변·마델룽 E<0·교대 질서>0.1. 자유전자 이온화⇌재결합은 ⑳ 이월. 뷰어: +/− 이온 링.
- **S0-④ 전이 엔진 (step-0004)** — 요약(전문 §5): 전이 카탈로그 실행기·두 시계·에너지 출처 강제·`checkedApply`(전이 E·P≤1e-9). node verify.js **40 PASS**: **볼츠만 창발**(비율∈[0.8,1.25])·냉각·공동·저온 억제. 발견: R-EXC/REL 분리 편향 → **LB 재분배 1행 통합**(잔여 ~10% ⑨ 이월). 뷰어: 들뜸 글로우·광자 빈.
- **S0-③ 준위·예산 (step-0003)** — 요약(전문 §5): 전자 구조 전부 **순수 함수**(`levels.js`)·Aufbau·간이 Slater·훈트·**결합차수 예산 B**·가상 4종·boltzmann. node verify.js **32 PASS**: **주기율표 창발**(원자가 1,2,3,4,3,2,1,0·주기 IE 단조·희유기체 피크·알칼리 골). 발견: 승위 빈 p 확장(Be/Mg 2가)·**족 내림 Li>Na>K 미창발(간이 Slater 한계·OPEN GAP)**. 뷰어: 준위③ 차트.
- **S0-①② 무대·장부 + 힘·충돌 (step-0001·0002)** — 요약(전문 §5): ① `engine/scenes/measure/verify.js`+`index.html` 뼈대(Vec3·통 분리 장부 10통·velocity Verlet·경계 3종·z동결·사건 큐·검증 하네스) 16 PASS. ② `pairForces`(쿨롱+척력·최소 이미지)·`U_elec`·`EPS_E=5e-4`/`DT_STIFF=0.004`/`MIN_DSIGMA=0.7` 고정·비리얼 압력 24 PASS(θ(b) 러더퍼드 단조·겹침 0). 이후 전 단계가 이 뼈대·불변식을 재사용.
- **계획 국면 (step-0000, 코드 0줄)**: 네 축 확정(CLAUDE 목표·KERNEL 커널/5원칙/4기둥·CONTRACT v0·DESIGN+design/①~㉖). 주요 결정: 3D 자료구조·z동결·결정론 폐기(앙상블 통계)·통 분리 장부·전이 카탈로그 한 형식·두 시계·연속 결합차수 예산·가상 원소 우선·핵 확장팩 게이트. 세부는 해당 문서 참조.

## §2 NEXT — 다음 한 조각 (step-0012 = S0-⑫ 복사 · Part II 시작)

**Part I 관문(⑪) 닫힘 — 승격·해동 배관 왕복 실증 + output.json v0 발효.** 이제 두 갈래:
- **S1-① (열림)**: `output.json` 이 S1 입력으로 준비됨 — S1 분자 단계 착수 가능(design/11 경계: "S1 소비 테스트는 S1-① 몫").
- **다음 구현 = step-0012 = S0-⑫ 복사** (앵커: 냉각 vs 복사 평형 · [design/12-radiation.md](stages/S0-atom/design/12-radiation.md) · 전제 ④): Part II(S0 물리 심화 ⑫~㉖ — MaterialModel 충실도를 ㉒ 본 스키마 전까지 쌓는다) 시작. ④의 광자 빈(E_photon)·복사 냉각을 확장 — 복사 스펙트럼·물질↔복사 평형. **로드맵 순서(design README)는 ⑫→⑬(3D)→⑭(형상)→⑮(극성)…㉒(실 S1 입력 ⇧).** 다음 세부 단계 선택은 자유(⑫ 또는 S1-① 착수) — STATE §2 가 확정.

**승격 계약 v0 존재** ([CONTRACT.md](CONTRACT.md)): 필드 채움은 ⑪(⇧ MVP)·㉒(MaterialModel)·S1 진입 몫.

**승격 계약은 이미 v0 존재** ([CONTRACT.md](CONTRACT.md) — 네 축 중 인터페이스 축): MaterialModel 스키마·관측량 계약(|ΔO|<ε_O)·재해석 조건·유효 범위·오차 한계. 필드 채움은 ⑧/⑪(출력 산출 ⇧)·㉒(MaterialModel)·S1 진입이 한다.

## §3 OPEN GAPS — 열린 격차

- **입출력 JSON 스키마 초안만** (출력 산출 세부 단계가 확정): DESIGN §6.2 초안 있음 — 실측정하며 확정.
- **응집이 액적+증기 공존에 머묾** (step-0008 발견): 미시정준(닫힌계)이라 응축 잠열이 계를 T_c 근방으로 자체 가열 → 완전 응축(단일 액적) 아님·최대성분 50% 교차가 시드에 흔들린다. 정직한 물리(열 배출 sink 없음) — 배위수·U_pol/N 으로 견고히 닫음. 완전 상 분리·상 라벨은 **S1**(열 배출·규모)이 담당. 분극의 SCF 상호분극도 쌍별 근사로 대체(C6 이중 계상 회피, design/08 §정련).
- **V₀ 상수의 튜닝 여지** (S0-④~⑧): 수식형은 DESIGN §3 로 확정 — 상수(R·차폐·D·k_b·ν·접촉 Eₐ 등)는 노브로 두고 앵커 재현이 조정한다 (수식 변경은 DESIGN 개정 사건).
- **T_국소 정의의 비평형 한계** (step-0009 부분 확인): 평형 장면에서 ⟨T_국소⟩≈전역 T 정합 확인(rel 0.005). 비평형(온도 구배 s09-gradient)은 관찰·기록만 — 구배 속 아레니우스 반응률의 공간 프로파일 정량 assert 는 미착수(향후 반응-확산 정련).
- **van't Hoff 는 캐논ical 측정 필요** (step-0009 발견): ⑥ 복사 결합이 방출 냉각으로 평형 T 를 협대역(0.43~0.51)에 자체 고정 → 미시정준 T0 스캔으로는 ln K vs 1/T 기울기를 못 잰다. 명시적 항온조(측정 전용)로 T 를 고정해 창발 확인(기울기 1.89≈D·병진 보정 포함·평형 도달도에 민감). 닫힌 3체 안정화(광자 대신 제3체 KE 로 D 배출)면 미시정준으로도 가능 — engine formBond 개정 사건이라 보류(현재 복사 안정화로 충분).
- **규모 정합의 "닮음" 지표 미정** (S1-④ 전 결정): 온도·밀도·구조 수 히스토그램 거리 등 — 관문 세부 단계가 assert 로 확정.
- **강등 ⇩ 의 통계 복원 규약 미정** (S1-④): u′ 와 일관된 미시 배치 샘플링 방법.
- **현실 앵커의 허용 오차 미정** (각 관문): "닮음"의 수치 임계 — 각 세부 단계가 assert 로 확정하며 정한다.
- **족 내림 이온화 경향 미창발** (step-0003 발견): 간이 Slater 는 Li>Na>K 를 못 냄(측정 Na>Li>K — 3s 침투 과소평가). 손튜닝 금지 원칙에 따라 위조 안 함. 3s/3p 침투 보정이 필요한 상위 단계(⑮ χ 유도 등) 착수 전 재검 — 그 전엔 주기 경향의 나머지(주기 단조·피크·골)로 충분.
- **이핵 분자 시그니처** (step-0006 발견 → step-0010 부분 해결): 등방 우물(종 무관 D) 때문에 ⑥에선 H₂O 우세 안 함. **⑩이 쌍별 D(436:463:146)로 해결** — O–H 최강이라 어닐링 후 H₂O 우세 창발. 남은 것: 쌍별 D 는 *결합 세기*만 종류화, *굽은 형상*(⑭)·*부분 전하/극성*(⑮)은 여전히 없음(⑩의 물은 조성만 맞는 분자).
- **단일 결합만 (O=O 이중결합 부재)** (step-0010 발견): bond.order 는 1 고정 — O=O(실 498, 이중)를 못 표현해 우리 "O₂"(단일 O–O·D 0.63)가 비현실적으로 약함. 그래서 H₂+O₂ 준안정 장면 대신 크래시 vs 어닐 대조로 활성화 장벽을 실증. 이중/삼중 결합은 결합차수 확장(π 결합) 도입 시 — 후속(⑭ 형상 또는 별도).
- **어닐링 항온조는 측정/준비 도구** (step-0010): 냉각 스케줄이 속도를 재조정(열 제거)하되 뺀 열을 E_escape 로 회계 → 장부는 닫힘(④ 복사 냉각과 동형). 닫힌 미시정준 냉각(복사만으로 열역학 최소 도달)은 더 느린 자연 냉각 필요 — 실용상 어닐링으로 충분.
- **재해동 T 는 재표본이라 이동** (step-0011): coarse→rethaw 는 Σc·E·P·조성을 **정확** 보존하지만, 미시 배치를 새로 샘플하므로 U(퍼텐셜)가 원본 액체보다 덜 최적 → 같은 물질 E 에서 T 가 ~1.3배 높다(T비 1.28). 이것이 관측량 계약의 뜻(보존은 정확·분포는 통계=엔트로피). 선언 관측량 조성은 ε=0, T 는 창[0.6,1.6] 로 정직 기록. 더 나은 정합은 rethaw 완화를 길게(비용↑).
- **⑪ MVP 는 배관 증명·물질 충실도 아님** (설계 명시): output.json v0 는 종·쌍 퍼텐셜·observables 최소 — 방향성·밀도 의존·협동 효과(물!)를 잃는다. u_curve·cv_curve 는 스키마 옵션(⑦ 별도 검증·미채움). 실 S1 입력(EOS·수송·반응망)은 **㉒ MaterialModel**(⑬~⑯ 이후). PMF 는 단원자 중성쌍 근사(분자 내부 자유도 미포함).
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
- step-0004: S0-④ 전이 엔진 — catalog.js(행 형식)+실행기(두 시계·checkedApply 사건 회계)+atom.level·U_int·E_photon 빈·collisionalTransfer·장면 3종. node verify.js 40 PASS. 볼츠만 창발(LB 재분배)·냉각·공동·저온 억제. 발견: R-EXC/REL 분리 편향→LB 통합(잔여 ~10% gap). 뷰어: 들뜸 글로우·광자 빈.
- step-0005: S0-⑤ 이온화·전자 이전 — electron 입자(힘·적분·경계·장부 통합)+R-XFER(transferElectron·오르막 게이트)+Kat/An 가상 원소+ionState. node verify.js 47 PASS. 이온 격자 NaCl 창발(마델룽 U_elec<0·교대질서). 범위: 격자 앵커 집중, 자유전자 이온화⇌재결합은 ⑳ 이월. 뷰어: +/− 이온 링(+결합선 시각화).
- step-0006: S0-⑥ 공유결합 — bond 자료(스프링+우물·U_bond)·R-CPLX(복합체)·runBonding(복사/삼체 안정화·아레니우스 해리)·예산 B 포화·measure.molecules. node verify.js 52 PASS. 이량체 H₂ 우세 창발·원자가 포화(H₃=0)·안정화 필수(no-stab→0)·해리. 경계: 이핵 H₂O/CH₄ 는 ⑮ 이월. 뷰어: 결합 실선·복합체 점선.
- step-0007: S0-⑦ 내부 모드·열용량 계단 — modes.js(self-contained·강체 회전자+양자 모드·LB 교환). node verify.js 57 PASS. C_v 1→3/2→5/2 계단 창발(순수 양자 효과). 중고온 LB 편향 ⑨ 이월. ⑥↔⑦ rigidify 통합 후속. 뷰어: C_v(T) 계단 곡선.
- step-0008: S0-⑧ 분극·응집 — polarization.js(self-contained·기반 ②만 재사용). 전하–유도쌍극자(쌍별)+분산 C6(α·IE 유도) 두 인력 채널·U_pol 통·클러스터 측정·3장면. node verify.js 64 PASS. 중성 응집 창발(배위 1.65→2.41·최대성분 0.60)·α=0 → U_pol 정확 0·소멸(근원=α)·이온유도 밀도(분산 off 고립)·장부 8e-5≤EPS_E. 발견: SCF→쌍별 근사(C6 이중계상 회피)·미시정준 잠열 공존(50% 교차 시드 흔들림→배위수 1차 지표). 뷰어: 클러스터 색·μ 화살표·응집 스캔 곡선.
- step-0009: S0-⑨ 통계 관문 — 새 물리 0. measure.js(entropy·equilibrium K_c·localTemp) + scenes.js(s09-entropy-corner·gradient) + verify ⑨ 5종. node verify.js 69 PASS. 엔트로피 앙상블 증가(S 3.74→4.35·요동 7/12·셀 2배 경향 유지)·르샤틀리에(해리 V 0.11→2V 0.23·비율 공식 0)·van't Hoff 기울기 1.89(≈D)·T_국소 평형 정합(rel 0.005). 발견: van't Hoff 는 캐논ical → 명시적 항온조 필요(⑥ 복사 결합이 T 자체 조절). 뷰어: S(t) 앙상블 밴드·자유 팽창.
- step-0010: S0-⑩ 수프 관문 — 실원소 합류·화학량론. engine.js 쌍별 D(pairD·bd.D·fallback→회귀0) + scenes.js 실원소 H·O·He·Ne(③ B/IE)·Dpair(436:463:146)·annealSoup(냉각 스케줄·E_escape 회계) + verify ⑩ 5종. node verify.js 74 PASS. 2H:1O 어닐 → H2O1:46 최다분자 창발(라벨 분기 0)·과결합 0·장부 3.8e-4≤EPS_E·어닐링 이득(H₂O 46>크래시 33). 발견: H–H≈O–H 근접→H₂ 실 경쟁자·어닐링 필요·O=O 이중결합 부재. 뷰어: CPK(H 흰·O 빨강)·물 분자·라이브 어닐링. verify 7m8s.
- step-0011: S0-⑪ 승격 배관 MVP — Part I 관문. promote.js(self-contained·coarse⇧·rethaw⇩·pmf·buildOutput/validate·회귀0) + scenes.js s11-mvp-box(polForces 결합+분산)·runScenario(5막 열욕·한 장부) + verify ⑪ 7종. node verify.js 81 PASS. 5막 한 장부 1.19e-4≤EPS_E·왕복 보존 정확(ΔE·P 1e-15·Σc·조성 ε=0·T비 1.28)·output.json v0 유효(7종)·반데르발스 꼬리(PMF O–O −0.14). output.json 산출(S1 입력). 뷰어: 5막 진행·⇧다운로드·⇩왕복 버튼. Part I 닫힘·S1-① 열림. verify 8m20s.
