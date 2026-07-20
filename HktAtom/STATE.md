# STATE — HktAtom 현재 위치 (SSOT · step마다 §1~4 덮어쓰기 · §5 만 append)

> 권위 분리: 목표 [CLAUDE.md](CLAUDE.md) · 척추 [KERNEL.md](KERNEL.md) · 이 문서 = "지금 어디까지·다음은 무엇". 크기 예산 ≤ 20KB.

## §1 NOW — 지금 어디까지

> **⑳ 플라스마 합류 = 자유전자 개체 (step-0037 · 게이트 9차·개체 추가형 1/3)**: R-ION/R-REC3 행을 playground catalog 상시 합류(문턱=IE 에너지 가드 → 저온 잠김=참값)·specIon ⑤ 공유(탈착·부착도 창발). 전자 개체 지원: tick 강성·항온조 포함·`chargeOK`(Σq=n_e 정확)·m_e 0.5. **전자=순수 연화 쿨롱**(eps_e 0 + 엔진 `soft_e` 세계 속성 — 점전자 catapult 1e32 근절). 앵커: ⟨x⟩ 0.57→0.81 (T0.5→3)·급랭 재결합 0.83→0.25·전하 정확. 격차: 사건-적분 커플링 드리프트 ~1e-2/사건(행 회계 정확 0.000·순수 동역학 무결·dt 무스케일 실측 — 사건 힘 불연속×반킥 추정·허용 ≤6). 통제 2건(Na+물·⑤공존 nu_ion=0 분리). 뷰어 전자 점+☄ 프리셋. verify 37 신설 3 PASS·**전량 204 PASS·0 FAIL**. 세부 step-0037.md.

> **⑰ 산·염기 승격 (step-0036 · 게이트 8차 · 요약)**: `runProton` tick 후단(RPX>rc)·solv 법칙(rank 30·protSolv 기본 0=참값)·⑤⑮⑰ 3층 전하 정합(H⁺ 이동=전자는 공여체에)·1가 게이트(O²⁻ 차단)·protSpot 겹침 회피(+1247 폭탄). **일반형 발견: 불발 되돌림 고립쌍 분지 누수(+5.25/사건) → ⑭ 씨앗 결정론 부채꼴화**(모든 되돌림 정확·수프 +11→−0.10). 앵커 이전 3~12회·Σq 0·H₃O⁺ Q=+1 정확. 전량 201(legacy ⑰ 임계 4e-3 조정). 세부 step-0036.md.
> **⑮ 극성(QEq) 승격 (step-0035 · 게이트 7차 · 요약)**: stage 'pre'(전하 갱신은 기반 앞)·⑤/⑮ 전하 이원 회계(정수 qBase=Z−ne + 연속 dq·단원자 건너뜀=⑤ 보존)·q=x 규약 정정. 앵커 H₂O δ∓(−0.207/+0.104)·O₂ 무극성 0·Na+Cl ±1 공존·QEq=정확 최소화(잔차 4.9e-5). 발견: 극성 ON → H₂O 1→3. 뷰어 전하 링 2단. verify +4·전량 198(34+35). 세부 step-0035.md.
> **⑭ 각도 법칙 승격 (step-0034 · 게이트 6차 · 요약)**: 게이트 `valence`·rank 15. 동적 격차 3종 해소(syncLones 동적 고립쌍·씨앗 즉시 수렴 이완·위상별 기준선 정규화 V̂=V−V_min — 첫 결합 오르막 T 폭주 제거)·이완기 수렴 tol+단조 하강·방출 회계 2회 철회(트레드밀·회전 추적 아티팩트). 앵커 H–O–H 2D 78.2°·3D 101° vs OFF 표류·드리프트 0.1% 상대화. verify +4. 세부 step-0034.md.
> **법칙 스택 (step-0033 · 게이트 5차 · 요약)**: engine `registerLaw`/`stackForces` — **게이트 = 물리 입력(종 파라미터) 존재 · 부재 = 기여 0 이 참값**(g=0 동형 → 기존 장면 회귀 0). ⑧ pol(`alpha`)·⑯ hb(`Dhb`) 이관(동등성 ΔF 0.0)·hbond 종 게이트 `hbDon`/`hbAcc` 개방(`O.Z=8` 핵 제거)·playground 스택 소비자(Dhb·hbAcc 상시·enableHBond 힘 교체 삭제)·KERNEL §3.1 등재. 앵커: 기본 샌드박스서 H-결합 창발·전량 190. 세부 step-0033.md.
> **중력 = 엔진 법칙 (step-0032 · 게이트 4차 · 요약)**: makeWorld `g`/`gDir`(기본 0=참값)·어느 computeForces 든 적용·`U_grav` 통·ΔU 상계 반사. author=F=m·g·ĝ 하나 — 성층 3/3 역순 창발·자유낙하 ≤5.3e-12·g=0 대조. playground=소비자(setGravity 회계). 규모 투명·자기 중력=게이트. 전량 186. 세부 step-0032.md.
> **관찰자 샌드박스 (step-0029~0031 · 게이트 1~3차 · 요약)**: `playground.js/html`(엔진 diff 0). 종 118 ③ 유도·주입 장부 pgIn·2D/3D·항온조·복셀 장·핵분열 인월드 판(ν=2 연쇄)·융합·EA_CAP 2.5·적응 서브스텝·VCAP. 세부 step-0029~0031.md.
> **핵 게이트 완결 (step-0026~0028)**: ㉓ 핵종→㉔ 붕괴→㉕ 분열(k_eff=1 경계). 가상·무차원. ㉖ 융합은 별 S2 연계 후속. **㉒ MaterialModel 완결 (step-0022~0025)**: 4 필드·output v0.3 실물. **S1-② 응집 재개가 다음.**

- **S0-㉓㉔㉕ 핵 트랙 (step-0026~0028·요약)**: `nuclear.js`(엔진 diff 0). ㉓ c=(Z,N,e)·질량 결손=장부 실물·앵커 ω_D/ω_H=0.7746. ㉔ 붕괴(β⁻/α/γ/n·R²=0.9999·Bateman·지연 중성자). ㉕ 분열: 단면 밴드·**k_eff=1 경계 창발**·Δm·c² 회계·NuclideTable⇧. --only 23,24,25=12 PASS. 세부 step-0026~0028.md.

- **S0-㉒ MaterialModel ⇧ 완결 (step-0022~0025·요약)**: **`material.js`**(엔진 diff 0). 물 수프·클러스터 굴려 4 필드 측정(author 0): EOS P·U(T,ρ)·확산 D·반응망 아레니우스·물 앵커(방향 선택성 352≫등방). **output v0.1→v0.3 가법**(S1 소비 불변). `verify --only 22`=15 PASS·㉒ 닫는 기준 충족. 세부 step-0022~0025.md.
- **S1-① 분자 단계 무대 (step-0021·요약)**: `stages/S1-molecule/` 신설(자체 완전·접점 input.json 데이터뿐). 커널 재귀 entity={c,r,p,u}: c=조성 다발·u=E_bind+T_int(온도의 탄생). ①은 힘 0 자유 비행. verify 13 PASS. pairPotential 로드만(②응집이 켬)·분자=점입자. **핵 트랙 뒤 ② 재개.** 세부 stages/S1-molecule/steps/step-0021.md.
- **S0-①~⑳ 뼈대·화학 (요약 — 전문 §5·step 문서·author 0)**: ①무대·장부 ②힘 ③준위(주기율표) ④전이(볼츠만) ⑤이온화(NaCl) ⑥공유결합 ⑦내부 모드(C_v) ⑧분극·응집 ⑨통계 ⑩수프(H₂O) ⑪승격 MVP ⑫복사장 ⑬z 해동 ⑭형상 ⑮극성 ⑯수소결합 ⑰산염기 ⑱연소 ⑲금속 ⑳플라스마. 발견 §3.

## §2 NEXT — 다음 한 조각 (사용자 게이트 연속 진행 중: "playground 에서 모든 현상 관찰" — scene 호환 비목표)

**step-0038 = ⑫ 복사장 합류 (다음·개체 추가형 2/3 — 빛의 방출·흡수가 눈에 보이는 시각 성과)**:
- 엔진은 이미 준비됨: `radiationMode:'field'`·광자 입자(`world.photons`·`makePhoton`)·`runPhotonField`·`c_ph`/`gammaLine`/`photonRc`/`nu_stim`/`photonBC` 전부 **세계 속성** — playground 는 속성만 실으면 된다 (⑳ 패턴 동형).
- **관건 = specLevels 종 데이터**: R-EMI/R-ABS 는 `world.specLevels[sp] = {dE, g0, g1}` (2준위) 필요 — ④⑫ 는 가상종 A 로 돌았다. playground 는 ③ levels 유도로 실원소 첫 들뜸 에너지 프록시를 만들어 싣는 것이 정직한 경로 (dE 유도식은 step 에서 설계·클램프는 EA_CAP 지위로 격차 등록). ④ 볼츠만·⑦ C_v 관찰도 같은 데이터로 열린다.
- 뷰어: 광자 렌더(노란 파선 점?)·프리셋 「💡 복사·발광」 (가열 → 들뜸 → 광자 방출이 날아가는 게 보임 · 급랭 재결합 발광은 ⑳ 과 연계).
- 검증: 방출·흡수 평형(공동)·개방 냉각·P 회계(광자 운동량 — ⑫ 장면은 auditP?) — verify 38 신설 + 전량 회귀.

**그 뒤 백로그 (순서 권장)**: ⑲ 금속(비국소 전자 풀 — 개체 3/3·별도 설계) → ⑨① 관찰 프리셋(물리 diff 0·뷰어만: 자유 팽창·온도 구배) → Efield 노브(⑮ 배향 실험) → ⑳ 사건-적분 드리프트 정련(사건 시점 힘 재동기화). 완료: ⑧⑭⑮⑯⑰(법칙 스택)·⑳(행+개체)·⑤⑥⑩⑬⑱㉕㉖+중력.

**사용자 게이트 종료 후 사다리 복귀**: S1-② 응집(액적) — S1 무대(step-0021)의 `input.pairPotential` 인력 꼬리를 computeForces 로 켠다 (input 은 output.json v0.3 로 갱신 후 소비). 핵 트랙 잔여(㉖ Gamow·지연 중성자 정량·폭발 왕복)·㉑ 성능·㉒-b2 는 CONTRACT §5·STATE §3 참조.

**산출물 2 트랙**: `output.json` v0.3(㉒ 화학 MaterialModel·S1 입력) + `nuclide-table.json`(㉕ 핵 파라미터·서버 중간 해상도 소비). 커널 가설 실증은 S1-④ 규모 정합 관문.

## §3 OPEN GAPS — 열린 격차

- **⑳ 합류 잔여** (step-0037): 사건-적분 커플링 드리프트 ~1e-2/사건(행 회계 정확·순수 동역학 무결·dt 무스케일 — 사건 힘 불연속×leapfrog 반킥 추정·verify ≤6·HUD 0.3·전자수 프록시·정련=사건 시점 힘 재동기화)·전자=유효 모델(m_e 노브·중성과 무상호작용·디바이/진동 밖)·전자 부착 EA 발열=EA_CAP 지위. 세부 step-0037.md.

- **법칙 스택 부분 이관** (step-0033~34): 스택 승격은 ⑧ pol·⑭ angle·⑯ hb — ⑮ QEq·⑰ 용매화·⑲⑳⑫ 미승격 (§2 백로그·⑲⑳⑫ 는 개체 추가라 별도 설계). hb·angle 상시 비용: 힘 평가마다 분자 라벨/수렴 이완(원자 200 상한 안 체감 0·㉑ 캐시 대상). 고정 시드 단일 런 assert 는 법칙 추가마다 궤적 갈라짐에 취약 — KERNEL §7 통계 이행 가치. 세부 step-0033.md.
- **⑰ 승격 잔여** (step-0036): protSolv=정직 노브(자동이온화 크기)·1가 게이트=Q² 다가 조장 보정·H⁺ 화 uIon 라벨 부재(dE 실측이라 보존 정확)·분열 불발 통복원 경로 미검증(결정론 씨앗으로 위험 ≈0)·재결합 통계 약함(2/5·공간 분리). 세부 step-0036.md.
- **⑮ 승격 잔여** (step-0035): 전하 봉합선(대전 분자에서 정수층 uIon=원자 자리 고정 vs 연속층=분자 재분배 — 사건 dE 실측이라 보존 정확·평형 위치만 근사·⑰ 승격 시 정련)·η=kc/soft+IE 프록시(⑮ 동일)·Efield 미노출·QEq O(n³)/분자(㉑ 몫). 세부 step-0035.md.
- **⑭ 동적 승격 잔여** (step-0034): 2D 평형각 78°=4도메인 평면 구속의 정직한 귀결(실각 104.5° 는 3D 101° 만)·준정적 지연 드리프트 0.02~0.05%/9000틱(임계 상대화로 수용 — 근본 해소는 고립쌍 실 DOF 승격이나 design/14 준정적 유지)·relaxAtom 단조 하강 강화는 legacy ⑭⑮⑯⑰ 경로 공용(전량 회귀가 담보). 세부 step-0034.md.
- **중력 잔여 격차** (step-0032): g=노브·P 임펄스 미회계(S2 몫)·반사 상계 후 바운스당 O(dt·g·v) 잔차·성층 verify=고T 기체 영역·기압 공식 정량 앵커·대류=S2-②③·S1/S2 엔진은 g 자체 구현(모듈 독립)·자기 중력=G-중력 게이트. 세부 step-0032.md.
- **샌드박스 고Z 경향만·부분 합성·핵 축약·체감 노브** (step-0029~0031): 간이 Slater 고Z IE/EA 과대→χ/EA 클램프·EA_CAP 2.5=체감 노브(⑤ 이탈·Na+물=전자 이전 추상). 동핵 D=예산 프록시(H·O 실비). ⑯⑰⑲⑳ 미합류. 분열=단일 단면·즉발(밴드·k_eff 는 ㉕)·㉔ 미연결·융합=하드 게이트(㉖)·중성자 τ=처분 회계. 서브스텝 잔차=E 비례 드리프트(~1e-3). 관찰자=표현층·복셀=온도만·원자 200 상한(㉑). 세부 step-0029~0031.md.
- **㉒ 완결·잔여 격차** (step-0022~0025): EOS 는 척력+반응만(waterSoup virial 정확·분산 응집 loop 없음→㉒-b2 부피 유한차분 압력). η/κ 수송·상전이 정련 여지(S1 몫). 반응성 EOS 조성 T 응답=⑨ 동형·정상.
- **핵 트랙 가상·내부 동결** (step-0026~): 핵종=상태표(바닥 특권)·핵 내부 동결. 실세계 정합 주장 없음(무차원·CONTRACT §5). ㉓ 앵커=결합 스프링 진동 측정(design/23 정정).
- **입출력 JSON 스키마 초안만**: DESIGN §6.2 초안 — 실측정하며 확정.
- **응집=액적+증기 공존** (step-0008): 잠열 자체 가열. 상 분리는 S1. SCF→쌍별.
- **V₀ 상수 튜닝 여지** (S0-④~⑧): 수식형 DESIGN §3 확정 — 상수는 노브·앵커 재현이 조정(수식 변경만 DESIGN 개정 사건).
- **T_국소 비평형·van't Hoff 캐논ical** (step-0009): van't Hoff 는 항온조 T 고정 창발(기울기 1.89≈D). 세부 step-0009.md.
- **규모 정합 "닮음"·강등 ⇩ 미정** (S1-④): 관문 assert·u′ 미시 샘플링 확정 몫.
- **족 내림 이온화 경향 미창발** (step-0003): 간이 Slater 한계·위조 안 함. 세부 step-0003.md.
- **이핵 시그니처·단일 결합만** (step-0006/0010/0018): ⑩ 쌍별 D(436:463:146)·O=O 는 ⑱ order2 장면 보정·일반 π 결합 후속.
- **어닐링 항온조=측정 도구** (0010): 열→E_escape 회계.
- **재해동 T 재표본 이동** (0011): 왕복 Σc·E·P 정확·재샘플 T~1.3배. 실 S1 입력은 ㉒.
- **점전하만은 H-결합 부족→R-HB 명시** (0016): 얼음·밀도역전은 S1. 세부 step-0016.md.
- **자동이온화 동결→protSolv·연소 열폭발** (step-0017·0018): 냉수 자발 이온화 불가→protSolv 용매화(2.0). 연소 O₂=order2 대체·정량 K_w/pH/완전연소는 S1/㉒. 세부 step-0017/0018.md.
- **S1 무대 힘 0·분자=점입자·㉑ 미도래** (step-0021): pairPotential 로드만(②가 켬)·O(N²) 병목 미도래. 세부 stages/S1-molecule/steps/step-0021.md.
- **이온화=속박 게이트·금속=유효 우물 author** (step-0020·0019): 속박 게이트라야 S자 창발(author 0)·금속=이온-이온 우물 Dmetal(고전 점전자 응집 불가). 집단 플라스마·밴드·자성 범위 밖. 세부 step-0019/0020.md.
- **QEq 하드니스·형상·⑦ 3D C_v** (step-0013~0015): η 프록시·CO₂→BeH₂·3D C_v 재작성 이월(⑦ 2D 회귀 불변). 세부 step-0013~0015.md.
- **2준위→단색 스펙트럼·볼츠만 ~10% 편향** (step-0012·0004): ⑫ 단색(다준위 ㉒)·복사압/산란 밖. ④ LB 점유 0.9~1.15×(정밀 KL 은 DSMC 이월). 세부 step-0004/0012.md.

## §4 DURABLE — 여러 step 이 반복 참조할 불변

- 단계 5원칙 (KERNEL §1) · 커널 체크 5항 (KERNEL §6) · 검증 4기둥 (KERNEL §7) — 매 세부 단계 통과 의무.
- 단계 간 접점은 input/output.json 뿐 — 코드 화살표 금지.
- 상위 상호작용 파라미터는 하위 측정 산출물만 (S0 실물리 author 만 예외).
- 시각화 없이 닫지 않는다. 손 튜닝은 즉시 격차 등록.

## §5 INDEX — step 인덱스 (literal 1줄/step append)

- step-0037: ⑳ 플라스마 합류 (게이트 9차·개체 1/3). R-ION/R-REC3 행 상시(IE 가드=저온 잠김)·전자 개체(tick·항온조·chargeOK Σq=n_e)·전자=연화 쿨롱(eps_e 0·soft_e — catapult 1e32 근절). 앵커 x 0.57→0.81·재결합 0.83→0.25·전하 정확. 격차: 사건-적분 드리프트 1e-2/사건. 통제 2건 nu_ion=0. verify +3. 세부 step-0037.md.
- step-0036: ⑰ 산·염기 승격 (게이트 8차). runProton tick 후단·solv 법칙(protSolv·기본 0)·⑤⑮⑰ 3층 전하 정합(H⁺ 이동=전자는 공여체에)·1가 게이트·protSpot. 발견: 불발 되돌림 고립쌍 분지 누수(+5.25) → ⑭ 결정론 부채꼴 씨앗(모든 되돌림 정확·수프 +11→−0.10). 앵커 릴레이 3~12회·Σq 0·H₃O⁺ +1 정확. verify +3. 세부 step-0036.md.
- step-0035: ⑮ 극성(QEq) 법칙 승격 (게이트 7차). stage 'pre'·전하 이원 회계(정수 qBase=Z−ne + 연속 dq·단원자 건너뜀=⑤ 보존)·q=x 규약 정정. 앵커 H₂O δ∓(−0.207/+0.104)·O₂ 무극성·Na+Cl ±1 공존·잔차 4.9e-5. 발견: 극성 ON → H₂O 1→3. verify +4. 세부 step-0035.md.
- step-0034: ⑭ 각도 법칙 승격 (게이트 6차). 게이트 valence·rank15·syncLones+씨앗 즉시 이완+위상 기준선 정규화+단조 하강. 방출 회계 2회 철회. 앵커 2D 78.2°·3D 101°·동등성 8.9e-16·잔차 0.1% 상대화. verify +4. 세부 step-0034.md.
- step-0033: 법칙 스택 — 규칙은 세계 속성이 켠다 (게이트 5차·새 물리 0). engine registerLaw/stackForces(기반+rank 순 기여·게이트=물리 입력 존재·부재=기여 0 참값). ⑧⑯ 이관(동등성 ΔF 0.0·게이트 정확 0)·hbond 종 게이트 개방(hbDon/hbAcc·O.Z=8 핵 제거)·playground 스택 소비자(Dhb·hbAcc 상시·enableHBond 힘 교체 삭제)·KERNEL §3.1 등재. 앵커: 기본 샌드박스(카탈로그 ON)서 H-결합 10개 창발·잔차 -2.0e-3. verify +4·전량 190·공유창발 9000틱(8시드 8/8). 잔여: ⑮⑭⑰⑲⑳⑫ 미승격·hb 상시 비용·단일 시드 취약. 세부 step-0033.md.
- step-0032: 중력 = 엔진 법칙 — 외부 장 g·성층 창발 (게이트 4차). engine g/gDir(기본 0)+applyGravity+U_grav 통+reflect1 ΔU 상계·KERNEL §3.1 등재·playground=소비자(setGravity 토글 회계). 5항: 순수 장면 낙하·자유낙하 ≤5.3e-12·성층 3/3 역순 창발(T=1.7)·g=0 대조·3D 침강. 뷰어 🌍(M)+⚖ 키트. 5 PASS·전량 186. 발견: 규모 투명(질량=Σc·차폐 0)·저T 분산 흡착·침강 더미 반사 랜덤워크→상계·자기 중력=게이트. 세부 step-0032.md.
- step-0031: 반응 체감 게이트 — 융합·Na+물·위력·안전판 (사용자 게이트 3차·엔진 diff 0). EA_CAP 2.5(Na+물 T 2배↑ 5/5)·분열 Q150(연쇄 U 6/6 소진)·융합 H+H→He+n Q40(장벽 게이트·중성자 역비 KE v≈8·5/5)·적응 서브스텝(잔차 1e37 발견→상대 ≤6e-4)·도구 VCAP 12(점화 연타 T 1e25 발견→포화)·잔차 판정 상대화. --only 29,30,31 = 12 PASS. 발견: 위력=Q/kT 분리·고KE+r⁻¹² 벽=적분 폭탄 일반형·포화는 도구 쪽에. 세부 step-0031.md.
- step-0030: 샌드박스 확장 — 3D·열역학·핵분열 연쇄·복셀 장 (사용자 게이트 2차·새 물리 0·엔진 diff 0). 2D/3D dim(⑬ 재사용)·항온조(전 열 주입 회계·T/P 스파크라인)·연소 ⑱ R-ABSTRACT 합류·핵분열 인월드 판(중성자 개체·U+n→Ba+Kr+2n·E_nuclear 저장→실측 ΔE 인출·pgConv 전환 장부·행 형식+tick 후단 실행기·ν=2 연쇄)·복셀 장 field(국소 T 열지도). node verify.js = 179 PASS(+4): 항온조 0.804/0.8·복셀 4.96≫0.68·연쇄 4회/1발. 발견: 개체 수 전이=형식 동형·실행 분리·저장 에너지 통 패턴. 세부 step-0030.md.
- step-0029: 관찰자 샌드박스 — 전 원소 소환 프로토타입 (사용자 게이트·새 물리 0). levels 6·7주기 가법 연장(Z≤54 불변)+playground.js/html(엔진 diff 0): 종 118 ③ 유도·이온 역할 유도·이핵 D=폴링 식(⑩ 앵커 보존)·②⑤⑥⑧⑩ 합성·주입 장부 pgIn·빈자리 탐색(겹침 소환=적분 폭탄 발견). 뷰어: 주기율표 팔레트+관찰자 로버+키트+피드+잔차 배지. 175 PASS(+6). 세부 step-0029.md.
- step-0028: S0-㉕ 분열 k_eff=1 경계(핵분열 실현). nuclear.js +중성자 입자+단면 밴드(fast/thermal·1/v)+reactorSim(몬테카를로·엔진 diff 0). R-N-SCAT/CAP/FISSION(F→파편2+ν≈2.5+Q). k_eff 밀도 스캔 [0.52→1.53] 단조↑ **경계 창발**(author 0)·감속(열중성자 0.607)·Δm·c² 회계·지연 중성자·NuclideTable⇧. 169 PASS(+5). 발견: 균질 매질·지연 제어·위력=회계·폭탄=조건(k_eff≥1). 세부 step-0028.md.
- step-0027: S0-㉔ 붕괴 채널. nuclear.js +DECAY 상태표(β⁻/α/γ/n·Q·daughter)+decaySim(지수 대기시간·엔진 diff 0). 지수 감쇠 λ≈ln2/hl(R²=0.9999·author 0)·계열 Bateman·붕괴열·지연 중성자(3%)·Q값 회계. 164 PASS(+4). 낙진=서버 붕괴 큐 창발(CONTRACT §5-6). 세부 step-0027.md.
- step-0026: S0-㉓ 핵종·동위원소 (핵 게이트 개방=CONTRACT §6-②). nuclear.js 신설(엔진 diff 0). c=(Z,N,e)·질량 Σ 회계 m=Z·MP+N·MN−BE·C2(질량 결손=장부 실물)·가상 핵종 4종·앵커 ω_D/ω_H=0.7746≈√(μ_H/μ_D)(author 0). 160 PASS(+3). 발견: ⑦ ħω 고정→앵커=결합 스프링 측정(design/23 정정). 세부 step-0026.md.
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
