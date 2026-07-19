# WORKPLAN.md — 세부 작업 설계

[스켈레톤 기반 절차적 근육·캐릭터 생성 시스템 설계서](스켈레톤%20기반%20절차적%20근육·캐릭터%20생성%20시스템%20설계서.md)(이하 **설계서**, v0.1 = *시스템 설계*)를
이 트랙(**HktCharacter**, three.js/Vite 웹 프로토타입)에서 **실제로 빌드 가능한 작업 단위**로
분해한다. 설계서가 "무엇을·왜"라면 이 문서는 "이 코드베이스에서 어떤 순서로·어느 파일을·무엇으로 검증하며".

> 갱신 규칙: 작업 패키지(WP) 하나를 닫으면 여기 상태표(§5)와 [STATE.md](../STATE.md) 를 함께 갱신한다.
> 상세 파이프라인 근거는 [PIPELINE.md](PIPELINE.md).

---

## 0. 스코프 재조정 — 설계서(UE 전제) vs 이 트랙(web)

설계서는 UE 4.27 플러그인(`ProceduralBody/…`)과 오프라인/런타임 분리, 네트워크 리플리케이션,
LOD 5단계, Chaos Flesh 참조 등을 전제한다. 이 트랙은 그중 **생성 원리(뼈→기능→근육→조직→피부)를
빠르게 증명하는 실험장**이다. 따라서 대응은 다음과 같이 나눈다.

| 설계서 영역 | 이 트랙에서 | 근거 |
|---|---|---|
| §3~§13 생성 파이프라인 (Muscle Graph→Tissue→Skin) | **증명 대상** — 웹에서 경량 재구성 | CLAUDE.md 목표: "사람 만들듯 골격에서 살을 쌓는다" |
| §14 런타임 변형 | **부분** — GPU 스키닝 + 라이브 근육 레이어까지. Corrective Morph 는 후속 | 불변: "피부는 rest 에서 한 번 굽는다" |
| §15 LOD, §16 네트워크, §17 UE 모듈/에셋 | **비대상(UE 이관)** — 웹은 LOD0 단일 캐릭터만 | UE 빌드·타 플러그인과 무관 (CLAUDE.md) |
| §11 시각/기능 근육 분리 | **부분** — 라이브 근육 레이어(시각) 존재. 기능 근육 상태는 §4 WP 에서 도입 | — |
| §12·§13 AI 제안 | **후속(Phase 5)** — 데이터 스키마를 AI 출력 친화적으로 먼저 정렬 | 설계서 원칙 5 |
| §11.1 피부 = Method B(템플릿 메시 변형) 권장 | **의도적 분기** — 이 트랙은 Method A(SDF iso-surface, MarchingCubes) 유지 | 불변: 웹은 토폴로지 고정 요건 없음, 실루엣·볼륨 증명이 목표. Method B 는 UE 이관 시 재검토(§6) |

**한 줄 원칙**: 이 트랙은 설계서의 *데이터 모델과 솔버 알고리즘*을 증명한다. UE 에셋·LOD·네트워크는 재현하지 않는다.

---

## 1. 현재 v5.0 ↔ 설계서 12단계 갭 분석

설계서 §4 의 12단계를 현재 구현에 대조한다. (○ 있음 / ◐ 부분 / ✗ 없음)

| # | 설계서 단계 | 현재 | 실제 위치 / 간극 |
|---|---|:--:|---|
| 1 | Skeleton Normalizer | ○ | `skeleton.js` — 로드·키 1.7m 정규화·replant·bind 캐시. 간극: 좌우 대칭축 명시 탐색 없음, 누락 관절 보완 없음, 뼈 프록시=`BONE_PADDING` 캡슐(◐) |
| 2 | Bone Landmark Detection | ✗ | 근육이 뼈 **표면 랜드마크**가 아니라 관절(뼈 원점) 위치에 붙는다. 랜드마크·부착 패치 개념 없음 |
| 3 | Joint Function Analysis | ✗ | 자유도·회전축·요구 토크 분석 없음. 근육 집합이 정적 아틀라스로 손수 정의됨 |
| 4 | Muscle Set Generation | ◐ | `anatomy.js` 정적 아틀라스 31개(모드 A 하드코딩). 모드 B(기능 합성) 없음 |
| 5 | Attachment Solver | ✗ | 부착 = 뼈 월드위치 + `off{a,l}` 벡터. 패치·후보 탐색·점수화 없음 |
| 6 | Muscle Route Solver | ✗ | 중심 경로 = 뼈 축 직선(`belly()`). wrap·뼈 회피·대표 자세 검증 없음 |
| 7 | Muscle Volume Builder | ◐ | 방추형=구를 타원체로 스케일. `width/depth/twist ProfileCurve`·힘줄 구간 없음(현재 `r/taper/bulge` 3값) |
| 8 | Tissue Packing | ✗ | `skin.js` 는 캡슐 union(Wyvill 합)만. 조직별 argmax·점유 우선순위·경계 처리 없음 |
| 9 | Fiber Field | ✗ | 근섬유 방향장 없음 |
| 10 | Fat & Fascia | ✗ | 지방장·부위별 두께·체형 파라미터 반영 없음 |
| 11 | Skin Builder | ◐ | Method A(SDF iso-surface) 구현. Fat offset·skin transfer·corrective 없음 |
| 12 | Pose Sim / Baker | ◐ | rest 1회 굽기 + 라이브 GPU 스키닝. Corrective Morph·자세 베이크 없음 |

**결론**: 현재는 "정적 아틀라스 → 방추형 벨리 → 캡슐 union 피부"의 **최단 경로 증명**이 끝난 상태.
설계서가 요구하는 **기능적 구조(부착 패치·경로·관절 기능·조직 분할)** 가 통째로 비어 있다.
세부 작업은 이 빈칸을 **팔(Phase 1)에 집중해** 먼저 채운다 — 설계서 §22 로드맵과 동일한 순서.

---

## 2. 데이터 모델 진화 — 현 anatomy item → MuscleSpec-lite

설계서 §7·§23 이 목표 스키마다. §23 의 BicepsBrachii JSON 이 팔 프로토타입의 **구체적 도달 지점**이다.
현재 flat 항목을 다음으로 승격한다(웹 경량판, 필드명은 설계서 준수).

**현재 (`anatomy.js`)**
```js
{ id, kr, side, from, to, off:{a,l}, along, span, r, taper, bulge }
```

**목표 MuscleSpec-lite** — 승격 매핑
```js
{
  id, kr, group, side,
  architecture,                    // NEW §8: 'Fusiform'|'MultiHead'|'Fan'|'Sheet'|'Parallel'|…
  origins:   [AttachmentPatch],    // from → 명시 배열 (다두근은 2+)  §7.1
  insertions:[AttachmentPatch],    // to   → 명시 배열               §7.1
  wraps:     [WrapConstraint],     // NEW §7.5: {type,bone,clearance}
  profiles:  { width:[…], depth:[…], tendon:[…] },  // NEW §7.2·§23: taper/r 를 프로필로
  jointInfluences:[JointInfluence],// NEW §7.4: {joint,torqueDir,isAgonist,isAntagonist}
  runtime:   { maxActivation, strengthScale, visualBulgeScale },  // §23·§10
}
// AttachmentPatch-lite §7.1: { bone, localCenter:Vec3(뼈 로컬), radius, role:'Origin'|'Insertion' }
//   → off{a,l}+along 은 뼈-로컬 부착 중심으로 흡수. 월드 저장 금지(뼈 비율 바뀌면 깨짐, §7.1 설계이유)
```

**불변원칙 정합**
- 부착은 **뼈 로컬**로 저장 → "팔 길이 바꿔도 부착 유지"(설계서 Phase1 완료조건) + 단방향 뼈→근육 흐름 유지.
- 프로필/아키텍처는 `anatomy.js`(데이터)에만 추가, 계산은 `muscles.js` — 모듈 독립 유지.
- 라이브 근육 레이어는 시각 전용, 피부 굽기와 분리(불변) — MuscleSpec-lite 도 이 경계를 지킨다.

---

## 3. 작업 패키지(WP) 시퀀스

각 WP = 이 트랙 skill 워크플로의 **한 step**(읽기→구현→검증→갱신) 크기. 의존성 순.
검증은 항상 `npm run smoke`(수치) + `npm run render`(실루엣 PNG)로 캡처해 직관 보고(불변: "검증은 캡처해 보고").

### WP-01 · AttachmentPatch-lite — 부착을 뼈 로컬 패치로 승격 ✅
- **목적**: 근육 부착을 관절 원점 스냅에서 **뼈 로컬 좌표 + 반지름 + 역할**로 올린다. 설계서 §7.1·§9.5.
- **대상**: `anatomy.js`(스키마), `muscles.js`(`belly()` 가 로컬 패치를 월드로 해석).
- **산출물**: `origins[]`/`insertions[]` 명시. `off{a,l}·along` → 뼈-로컬 부착 중심으로 변환(무손실 리팩터).
- **검증**: smoke 에 "모든 근육이 유효 origin+insertion 보유(§19.1)" + "팔 길이 ×1.3 스케일 후 부착 중심 뼈-로컬 불변" 체크 추가. render 실루엣 회귀 없음.
- **완료조건**: 기존 31개 근육 시각 회귀 0, 팔 길이 변형 테스트 통과.
- **불변 정합**: 월드 좌표 저장 제거 → 비율 변형에 견고.
- **완료 기록 (2026-07-18)**:
  - `anatomy.js` — 각 근육을 `{ origins:[AttachmentPatch], insertions:[AttachmentPatch], architecture, along/span/r/taper/bulge }` 로 재작성. `AttachmentPatch = {bone, off:{a,l}, role}`. 헬퍼 `O`/`I`, `pair()` 가 패치 뼈를 사이드화, `patchRadius(def)=r×taper` 파생 export. `architecture:'Fusiform'` 전 근육 태깅(WP-03 선행).
  - `muscles.js` — 공용 `frame()` 로 벨리 프레임 추출, `belly()` 가 origin/insertion off 를 각각 적용(동일 off → 기존과 수학적 동일). `build()` 가 패치를 뼈로 해석(부차 패치 결측 시 제외). 신규 `getAttachments()` — 부착점을 월드로 해석(§7.1: `|world−pivot|=hypot(a,l)` 뼈 로컬 불변), WP-02·검증이 소비.
  - `eval/smoke.mjs` — 부착점 62개·origin+insertion 보유(§19.1)·origin≠insertion 뼈·**상완 ×1.3 시 insertion 이 앵커 뼈와 1:1 이동(Δ≈0.078m)·반대쪽 origin 불변** 체크 추가.
  - **회귀 0 확인**: 피부 tris(19556/21022)·높이 1.80·스팬(1.56/1.72)·정점(9334/10038)·애니 변형(0.160/0.086) 전부 리팩터 전과 동일. 근육 에코르셰·피부 실루엣 육안 동일.

### WP-02 · 관절 통과 부착 (Joint-Crossing Attachment) — 포즈 반응 근육 ✅
- **동기(측정으로 발견)**: 원래 WP-02 는 wrap/route 였으나, 착수 전 측정에서 **관통은 0/21**
  이고 오히려 근본 결함이 드러났다 — 근육이 **인접 관절 피벗 사이**에 걸려, 인접 피벗 거리 =
  뼈의 강체 길이 = 상수 → `contraction=1` 고정 → **bulge 가 절대 발동 안 함**. 이두근이
  팔꿈치 굴곡에 전혀 반응하지 않았다(설계서 G3·Phase1 완료조건 미달). 이걸 먼저 고친다.
- **목적**: 부착 패치에 **뼈-축(distal) 성분 `t`** 를 더해 정지부를 원위 뼈 아래로 내린다 →
  근육이 관절을 넘어가 굴곡 시 실제로 짧아지고, 부피 보존 bulge 가 발동한다(설계서 §10).
- **대상**: `anatomy.js`(patch `t`), `muscles.js`(`attachBase()` = 앵커→자식 lerp, belly 를 부착점 기준으로).
- **검증**: smoke **§19.3 기능 검증** — 팔꿈치 굴곡 시 이두 단축(≥10%)·굵어짐(≥5%). render 에
  중립↔굴곡 팔 에코르셰 비교(`2-arm-neutral/curl.png`).
- **완료조건**: 팔꿈치 굴곡 시 이두근이 짧고 굵어짐(Phase1 완료조건). rest 피부 회귀 미미.
- **의존**: WP-01.
- **완료 기록 (2026-07-18)**:
  - 트윈 중복 뼈(`__dup`)가 첫 자식으로 잡혀 `t` 를 삼키던 버그 수정 — 자식은 **구동 뼈**만
    (`boneMap.get(simpleName(child))===child`).
  - 측정: 팔꿈치 0→135° 굴곡에서 이두 len 0.197→0.123m(**−37%**)·R 0.048→0.054m(**+13%**).
    smoke 게이트(120° 굴곡): 단축 −32%·굵어짐 +13%, X/Y Bot 양쪽 통과.
  - 삼두근은 **길항(굴곡 시 신장)** 을 위해 정지부가 팔꿈치 회전축 뒤를 지나야 하므로(모멘트암)
    지금은 t=0(중립) 유지 → WP-04(JointInfluence) 로 이월. 틀린 방향(단축)을 담지 않는다.
  - rest 피부 회귀 미미: X Bot tris 19556→19548, 스팬 1.56 유지, 실루엣 육안 동일.

### WP-02b · WrapConstraint + Route Solver-lite — 뼈를 피하는 경로 (이월)
- **동기**: WP-02 로 근육이 관절을 넘어가자 이제 **깊은 굴곡에서 직선 경로가 관절을 관통**할
  수 있고, **삼두 길항 신장**도 팔꿈치를 뒤로 감는 wrap 이 있어야 나온다. 관통이 실제로
  생기는 시점에 착수(측정 선행).
- **목적**: origin↔insertion 사이 **wrap(캡슐/구) 우회 중심 경로**. 설계서 §6·§7.5·§9.6.
- **대상**: 신규 `route.js`(경로 솔버), `muscles.js`(벨리를 경로 위에 태움), `anatomy.js`(`wraps[]`).
- **검증**: smoke **뼈 관통비(§19.2)** < 0.1%(§20). 중립·최소·최대 굴곡 3자세에서 관통 0.
- **의존**: WP-02.

### WP-03 · Muscle Architecture 다양화 — "소시지 탈피" (◐ ① 완료)
- **동기(측정)**: 근육 종횡비(길이/2r) 측정에서 대부분 **0.3~2:1(달걀·원반)** — 대둔근 0.31,
  삼각근 1.08, 이두 2.05. `taper` 필드가 벨리 지오메트리에 **안 쓰여**(순수 스케일 구) 양끝이
  안 가늘어지는 게 근인. 사용자 지적: "근육은 보통 가늘고 길다".
- **목적**: 전부 Fusiform 인 현재 → ① **스웹 프로필 방추형**(가는 힘줄 끝) ② width≠depth 납작화
  ③ **Fan(대흉근)·Sheet(복부)·MultiHead(이두)** 아키텍처. 설계서 §8·§7.2·§21.4.
- **대상**: `muscles.js`(프로필 스웹 lathe·아키텍처별 생성), `anatomy.js`(`profile`, `architecture`).
- **검증**: render 정면 에코르셰에서 방추형/판형/부채꼴 실루엣 육안. smoke 근육별 부피 유효성.
- **의존**: WP-01, WP-02.
- **완료 기록 — ① 방추형 슬렌더화 (2026-07-18)**:
  - `anatomy.js` `DEFAULT_FUSIFORM=[0.12,0.5,0.85,1.0,0.92,0.6,0.16]` — 기시→정지 반지름 배율
    (가는 끝→중앙 벌크→가는 끝). 근육이 `def.profile` 로 개별 지정 가능(설계서 §23 스타일).
  - `muscles.js` — 공유 SphereGeometry 폐기, 근육마다 **프로필 스웹 `LatheGeometry`**(장축 y,
    양끝 팁 닫힘)를 1회 생성. `update()` 는 여전히 매 프레임 매트릭스만(장축 y→벨리 축). 피부
    `getCapsules()` 는 벨리를 `SKIN_CAPS=4` 서브 캡슐로 나눠 각 반지름을 프로필로 → 피부가
    근육 테이퍼를 따라간다. 근육 상태 측정용 공개 API `getBellies()` 추가.
  - `eval/render.mjs` — `item.mesh.geometry`(근육별) 소비. `eval/smoke.mjs` 기능 검증을
    `getBellies()` 기반으로 갱신(다중 캡슐이라 인덱싱 대체).
  - 결과: 에코르셰의 달걀들이 **뾰족하게 테이퍼되는 방추형 스핀들**로. 피부 사람 형태 유지
    (X tris 19548→20762, 높이 1.80·스팬 1.56·두께 0.40, 이두 굴곡 기능 게이트 통과).
- **남은 것 — ② 납작화(width≠depth) · ③ Fan/Sheet/MultiHead 아키텍처**: 넓적한 몸통 근육
  (대흉근·대둔근·광배근·복직근)을 방추형이 아닌 판·부채꼴로. 다음 WP-03 차수.

### WP-04 · Joint Function & 기능 근육 상태 — 길항·토크·크기 초기화
- **목적**: 관절 자유도/회전축을 읽어 **길항쌍·토크 방향**을 태깅하고, 요구 토크로 근육 단면 초기 크기(F≈τ/r)를 준다. 설계서 §7.4·§9.3·§9.4·§11.1.
- **대상**: 신규 `joints.js`(관절 기능 분석 경량판), `anatomy.js`(`jointInfluences[]`), `muscles.js`(크기 스케일).
- **산출물**: 근육별 `{joint,torqueDir,isAgonist/Antagonist}`. 굴근↔신근 쌍 명시. 크기 상대 초기값.
- **검증**: smoke **기능 검증(§19.3)** — 굴곡 포즈에서 굴근 λ<1(짧아짐)·신근 λ>1, 토크 부호 일관.
- **완료조건**: 이두/삼두, 사두/햄스트링 길항쌍이 반대 부호 토크.
- **의존**: WP-01. (WP-05 활성도의 선행)

### WP-05 · 활성도(activation) 상태 분리 — 등척성 수축
- **목적**: 현재 bulge 는 길이 변화 λ 만 반영. **활성도 a∈[0,1]** 채널을 더해 길이 불변에도 팽창(등척성). 설계서 §10.3~§10.6.
- **대상**: `muscles.js`(`FinalBulge = Geometric(λ) + Activation(a,λ)`), `main.js`(UI: 근육군 활성도 슬라이더·공동수축).
- **산출물**: `runtime.maxActivation/visualBulgeScale` 사용. 길항 공동수축(굴근 0.7 / 신근 0.2) 데모.
- **검증**: `npm run dev` 로 활성도만 올렸을 때(포즈 고정) 근육 팽창 눈검증 요청. smoke: a=0/1 에서 반지름 차 확인.
- **완료조건**: 활성도와 길이 변화를 **독립** 조절(설계서 Phase1 완료조건).
- **의존**: WP-04.

### WP-06 · Fat/Fascia 필드 & 체형 파라미터 — 마른↔비만
- **목적**: 피부를 캡슐 union 그대로가 아니라 **지방 오프셋 + fascia 스무딩 + 전달률**로. `CharacterGenerationProfile` 경량판 도입. 설계서 §5.2·§9.10·§9.11·§21.5.
- **대상**: 신규 `profile.js`(BodyProfile-lite: height/muscleMass/fatMass/부위 bias), `skin.js`(필드에 fat 두께·전달률 반영).
- **산출물**: `FatThickness = GlobalFat × Regional(x)`. `SkinTransferParameter`(대형/근육분리/힘줄 전달률).
- **검증**: render 에서 동일 골격 → 마른/평균/비만 3 프리셋 실루엣 대비. skin 자체 교차 0(§19.4).
- **완료조건**: 같은 스켈레톤에서 마른 팔·근육질 팔·비만 몸통을 파라미터만으로 생성(G2, Phase1 완료조건).
- **의존**: WP-03.

### WP-07 · 검증 시스템 확장 — 정량 게이트
- **목적**: 설계서 §19·§20 검증을 smoke/render 에 상시 게이트로. 각 WP 가 이 게이트에 체크를 더한다.
- **대상**: `eval/smoke.mjs`, `eval/render.mjs`.
- **산출물**: 구조(§19.1)·충돌(§19.2 뼈/관절 관통비·skin escape)·기능(§19.3 토크 부호·모멘트암 연속성)·시각(§19.4 대칭 오차·자체교차) 체크. §20 임계값(관통 0.1%, 대칭 1%, 실루엣 오차 2/4%).
- **검증**: 게이트 자체가 검증. 회귀 시 실패로 드러남.
- **완료조건**: WP-01~06 산출물이 모두 이 게이트 통과.
- **성격**: 가로지르는(cross-cutting) WP — 각 WP 착수 시 해당 체크를 이 WP 로 편입.

### WP-08 · 모드 B(기능 합성) 씨앗 — 비인간형 준비
- **목적**: 해부학 아틀라스 없는 관절에서 **기능만으로 길항 근육군 합성**(설계서 §9.4 모드 B·§21.6·Phase 4). 팔에서 원리 검증 후 확장.
- **대상**: `joints.js` 확장, 신규 `synth.js`(후보 부착 탐색·모멘트암 최적화 경량판).
- **산출물**: 관절 1개(팔꿈치)에서 아틀라스 없이 굴근/신근 자동 생성 데모.
- **검증**: 합성 근육이 손수 아틀라스 근육과 유사 토크·경로(정량 비교).
- **완료조건**: "관절 기능 → 근육" 경로가 데이터 없이 성립.
- **의존**: WP-02, WP-04. **로드맵상 Phase 4 선행 실험** — Phase 1~3 안정화 후 착수.

### 의존성 그래프
```
WP-01 ─┬─▶ WP-02 ─┬─▶ WP-03 ─▶ WP-06
       │          └─▶ WP-08
       └─▶ WP-04 ─▶ WP-05     WP-08
WP-07 ── 전 WP 가로지름(게이트) ──
```

---

## 4. 검증 확장 계획 (설계서 §19·§20 → smoke/render)

현재 smoke 24체크(뼈·키·접지·근육수·피부 삼각형·스키닝 합·bbox·애니 변형)에 **점진 추가**:

| 분류 | 추가 체크 | 설계서 목표 | 도입 WP |
|---|---|---|---|
| 구조 §19.1 | 모든 근육 origin+insertion 유효·restLen>0·좌우쌍 존재 | — | WP-01 |
| 충돌 §19.2 | 경로 뼈 관통비 / 관절 관통비 / skin escape 부피 | 관통 ≤0.1% | WP-02 |
| 기능 §19.3 | 굴곡 포즈 굴근 λ<1·신근 λ>1, 토크 부호, 모멘트암 연속성 | 토크 오류 0 | WP-04 |
| 시각 §19.4 | 좌우 대칭 오차(반지름·길이), skin 자체 교차, 실루엣 오차 | 대칭 ≤1%, 실루엣 ≤2/4% | WP-06·WP-07 |
| render | 아키텍처 3종 실루엣, 체형 3프리셋 실루엣, 포즈별 근육 팽창 | 육안 판정 | WP-03·WP-06 |

> 샌드박스 headless Chromium 차단 → 브라우저 인터랙션(활성도 슬라이더·레이어 토글)은 `npm run dev`
> 눈검증을 사용자에게 요청한다(불변). 수치·오프라인 실루엣은 smoke/render 로 자동 캡처.

---

## 5. WP 상태표

| WP | 제목 | 상태 | Phase(설계서 §22) |
|---|---|:--:|---|
| WP-01 | AttachmentPatch-lite | ✅ 완료 (2026-07-18) | Phase 1 |
| WP-02 | 관절 통과 부착 (Joint-Crossing) | ✅ 완료 (2026-07-18) | Phase 1 |
| WP-02b | WrapConstraint + Route Solver | ☐ 이월 | Phase 1 |
| WP-03 | Muscle Architecture 다양화 | ◐ ① 방추형 완료 (2026-07-18) | Phase 1 |
| WP-04 | Joint Function & 기능 근육 | ☐ 대기 | Phase 1 |
| WP-05 | 활성도(activation) 분리 | ☐ 대기 | Phase 1 |
| WP-06 | Fat/Fascia & 체형 파라미터 | ☐ 대기 | Phase 1→3 |
| WP-07 | 검증 시스템 확장 | ☐ 상시 | 전 Phase |
| WP-08 | 모드 B 기능 합성 씨앗 | ☐ 대기 | Phase 4 선행 |

---

## 6. 비대상 / UE 이관 목록 (이 트랙에서 안 함)

- **LOD 0~4**(§15), **네트워크 리플리케이션**(§16), **UE 모듈/에셋 타입**(§17) — 웹은 LOD0 단일 캐릭터.
- **Chaos Flesh / 사면체 FEM 런타임**(§14.4) — 웹은 GPU 스키닝 + 라이브 근육 레이어까지.
- **피부 Method B(템플릿 메시 변형)**(§11.1 권장) — 웹은 Method A 유지. UE 이관 시 토폴로지/UV/Morph 호환 위해 재검토.
- **의료영상 분할·3D 스캔 학습 데이터**(§13) — AI 통합(Phase 5)의 후속. 현재는 스키마를 AI 출력 친화적으로 정렬만.
- **손발·얼굴 정밀 해부학**(§2.2 비목표) — 현재 뼈 패딩 캡슐로 뭉툭 처리 유지.

---

## 7. 다음 즉시 착수 WP

**WP-03 ①(방추형 슬렌더화) 완료** → 다음은 둘 중 하나:
- **WP-03 ②③ (납작화 + Fan/Sheet/MultiHead)** — 넓적한 몸통 근육(대흉근·대둔근·광배근·복직근)이
  아직 방추형 아몬드다. 판·부채꼴로 바꿔 몸통 실루엣을 자연스럽게. rest 정면에서 또렷한 변화.
- **WP-04 (Joint Function & 길항)** — 삼두근이 굴곡 시 길어지도록(모멘트암), 근육 크기를 요구
  토크로 초기화. 팔 데모의 길항쌍을 완성.

권장: **WP-03 ②③** — 사용자의 "가늘고 길게" 지적의 연장선(몸통 근육 형태)이고 가장 가시적.
**WP-02b(wrap)** 는 깊은 굴곡에서 관통이 실제로 측정되는 시점에 착수(측정 선행 원칙).

착수 시 이 트랙의 step 워크플로(읽기→구현→검증→[STATE.md](../STATE.md)·본 상태표 갱신)를 따른다.
