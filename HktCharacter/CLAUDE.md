# CLAUDE.md — HktCharacter

> Skeleton → Flesh: **rig-agnostic SDF flesh 렌더러** 프로토타입. (이전 이름 `hikito-flesh`)
> 캐릭터 asset pipeline의 실현 가능성 검증용. AI-only 자산 제작 철학의 일부.

## 한 줄 요약

뼈대를 먼저 정의하고, 살을 **뼈대의 순수 함수(SDF)** 로 자라게 한다.
→ 모델링·리깅·스키닝 3단계가 하나로 붕괴. 뼈대를 움직이면 살은 자동으로 따라온다.

## 아키텍처 (3층)

1. **Skeleton IR** — `joints[{name, parent, offset}]` + 프레임별 회전 → world FK.
   소스(built-in / Mixamo FBX / 임의 리그)를 몰라도 동일 경로로 흐른다. FK는 three Object3D 계층이 담당.
2. **Flesh grammar** — 이름으로 반지름을 매긴다. **이게 "일관된 스타일"의 정의.**
   규칙·수치는 `src/proportions.js` 의 **비율 프로파일**(데이터)로 승격 — 이름 규칙(첫 매치 승리)
   + 스켈레톤 치수 + 볼륨 헬퍼(extras: 가슴·승모근·둔부·뒤꿈치·손바닥) + 그룹 배율(UI 슬라이더)로 구성.
   **원판 로프트(disk-loft) 층 — 주 살 매체 (LOFT-PLAN 구현됨)**: 몸통·목·두상·다리는 캡슐
   대신 프로파일 `loft` 절의 원판 스택이 살을 만든다. 스택 = 뼈(자식 관절 simple name,
   Left/Right 접두어 자동 미러) → `{ group, k?, disks:[{t, rx, zf, zb, xo?}] }`.
   t 는 뼈 축 위치(0=부모, 1=자식, 범위 밖=연장 — 골반은 Spine 의 t<0), rx/zf/zb 는 좌우
   반경·앞/뒤 경계(관절 로컬), xo 는 단면 중심 좌우 오프셋(다리). 이웃 원판 쌍 → round-cone
   세그먼트 1개, 타원 단면은 긴 반경을 캡슐 반지름으로 삼고 짧은 축을 flatten(f<1 유지 —
   방향 스왑으로 f>1 회피). 시트의 곡선 프로파일(허리 S커브·종아리 볼록·두개골 곡률)이
   최적화의 결과가 아니라 **구성상 보장**된다. loft 가 없는 뼈(팔·손가락·임의 리그)는 기존
   캡슐 경로 — rig-agnostic 계약 유지. `disks:[]` = 그 뼈 살 생략(UpLeg — 골반·허벅지 loft 가
   대체). 원판 데이터는 `eval/fit-loft.mjs` 가 시트에서 자동 피팅 — 수치를 손으로 만지지 말 것.
   ⚠ **round-cone 은 원판이 아니라 "구의 볼록 껍질"** — 반지름이 축 간격보다 급히 줄면 큰
   원판의 구가 축 방향으로 반지름만큼 튀어나온다 (두정이 +6cm 솟아 f 정렬 전체가 오염됐던
   교훈). 두정은 "구 돔 꼭대기 == crown" 이 되는 원판에서 스택을 자른다 (fit 이 처리).
   ⚠ 스택 내부 k 기본 0.016 — 이웃 cone 세그먼트의 기울기 불연속(면 각짐)이 준-툰 셰이딩
   에서 가로 밴드로 증폭되는 걸 둥글린다 (0.004 로 줄이면 다리가 골판지가 된다 — 교훈.
   k/4 균일 부풀음은 재피팅의 compose SHRINK 가 데이터에서 도로 빼 수렴). 목만 k 0.05
   (승모근·어깨와의 웹이 시트의 어깨 경사선). 스택 첫/끝 세그먼트는 `k0`/`k1` 로 관절
   경계 blend 를 분리 — 허벅지 k0 0.04 가 골반과의 웰드 주름을 편다.
   ⚠ 정면 시트의 허리~골반 대역은 팔·손 획이 몸 윤곽을 가린다(envelope=팔) — fit-loft 는
   후면 뷰 윤곽 추적(traceContour, 좌/우 min)으로 그 대역의 폭을 얻는다. 이게 없으면 그
   대역은 영원히 self-copy 다 (교훈). 골반 하단은 가랑이 rEmit 클램프(기저귀 살 방지),
   허벅지 상단은 돔 가드(새들백 방지)가 fit 에서 자른다. 축 납작화(팬케이크)는 시도 후
   폐기 — 히트 임계 인플레이션 + 법선 왜곡 (emitLoft 주석).
   **Detail 층**(캡슐 경로용): rules/extras 는 선택적으로 `k`, `flatten`·`flatten2`(2축 납작화,
   f<0 은 one-sided), `op:'cut'` 을 가진다. 셰이더는 평범한 캡슐(저비용)과 detail 세그먼트를
   구간 분리 순회(`uDetailStart`/`uCutStart`) — loft 세그먼트는 전부 detail 경로.
   (두상 subBones 세분화는 loft 로 대체·제거됨 — appendSubBones 엔진 자체는 남아 있다.)
   프리셋: `standard`(기존 값 보존, loft 없음 = 캡슐 경로 회귀 기준) · `reference`(첨부 캐릭터
   시트 기준 6등신 여성 체형, 기본값, loft 사용).
   Mixamo 이름(`mixamorig:LeftForeArm`)은 접두어만 떼고 매칭. 미지의 뼈는 기본값 → 임의 리그도 안 깨진다.
   ⚠ 외부 리그는 자체 뼈 길이를 쓰므로 loft 는 t 비례 근사 — HeadTop 뼈가 긴 리그는 두상이 늘어난다.
   HeadTop_End 관절이 없는 리그는 두개골 스택이 안 붙는다 (Head 캡슐 폴백 — 알려진 한계).
   **정점 메시 층 (VERTEX-PLAN 구현됨 — "찍고→조정" 매체)**: SDF 스택의 음영 한계(콘 이음
   밴드·smin 웰드 lump·구 껍질 돌출)를 우회하는 **실제 정점 메시** 살. 뼈 체인을 따라 단면
   링을 대충 찍고 → 바인드 포즈에서 살 필드(시트 피팅 loft+extras SDF) 표면으로 방사 투영해
   조정 → Taubin 스무딩. 런타임 정점 = (뼈, 관절 로컬 오프셋) → FK 상속, 관절 경계 6cm 링은
   이웃 뼈와 이중 바인딩(무릎 찢어짐 방지). UI `정점 메시` 토글 / `?mesh=1` /
   `HKT_EVAL_MESH=1 npm run eval` / `shot.mjs --mesh 1 [--stage rough]`. SDF 는 빌드 시
   투영 원천으로 강등 — 렌더는 메시 + smooth normal (음영 매끄러움이 구성상 보장).
   ⚠ 투영 4원칙 (교훈 — src/fleshmesh.js): ① 첫 탈출 표면 (마지막 음수까지 가면 몸통이 팔을
   감싼다) + 8mm 틈 관통(둔부 주름 톱니 방지) ② 체인별 필드 필터 — 몸통은 팔·손·**다리**를,
   다리는 자기 살만 본다 (어기면 가슴 선반/힙 "반바지" 플랩) ③ 2.2×rGuess 관통 클램프
   ④ **구 껍질 침수 차단** — 링 평면을 축 방향 ±12mm 밖에서 벗어난 loft 세그먼트 제외
   (턱 디스크 구가 목구멍을 메워 "목이 없던" 원인 — 캡 링은 예외, 돔은 구가 그린다.
   걷어낸 어깨 몫은 승모근 extras 능선 연장이 보전).
   **fit-mesh 정점 잔차 피팅**: `eval/fit-mesh.mjs` 가 시트 잔차를 재서 `src/meshfit.js` 에
   굽고, 빌드가 투영 직후 링에 보간 적용 — torso: 측면 df/db + 머리 폭 dx(f≤0.14) / leg:
   측면 df/db + 정면 로브 dxo/dxi. compose 수렴 · 기울기 5mm/행 제한(어기면 정면 가로
   "선반" 밴드) · **렌더 측 계측은 반드시 픽셀** — 기하 extents 로 재면 스킨 검출의 어두운 면
   편차(~1cm)가 잔차로 둔갑한다 (교훈, VERTEX-PLAN §0). 메시 모드는 built-in 리그 한정
   (외부 FBX 는 SDF 폴백), 슬라이더(통통함 등)는 재토글 때 반영 — 남은 일은 VERTEX-PLAN §4.
3. **Source** — built-in Mixamo 표준 리그 + 절차적 클립(walk/idle/wave), 동봉 로코모션 FBX 샘플
   (`public/assets/anim/*.fbx` — 걷기·뛰기·대기·점프·공격·삼바), 그리고 FBX 드롭(실제 Mixamo 클립).
   다중 클립 FBX 는 이름별 클립 전환(크로스페이드) 지원.

### harness 매핑
- **Planner** = 뼈대 그래프 = genome
- **Generator** = 살 grammar (`radiusForName` + round-cone SDF + `smin`)
- **Evaluator** = `eval/evaluate.mjs` (`npm run eval`) — 레퍼런스 시트 대비 3방향 자동 계측·판정
  + 오버레이 PNG 생성. 지표 4종: ① 폭(행별 실루엣 폭, MAE ≤ 0.025H·최대 ≤ 0.06H)
  ② 중심선(행 centroid − 몸 축, MAE ≤ 0.015H·최대 ≤ 0.045H — 자세/굽은 등 회귀)
  ③ 머리 경계(상단 f ≤ 0.20 행의 좌/우 경계 각각, 최대 ≤ 0.05H — 뒤통수·턱선 회귀)
  ④ 목 폭(f 0.145~0.175 정면/후면, 최대 ≤ 0.04H — 목 행은 dropout 규칙에 걸려 일반
  지표가 못 보는 회귀 구멍. 게이트는 정점 메시 모드 전용, SDF 는 보고만).
  몸 축은 "신뢰 행"(시트 획이 뚜렷한 행) 기준으로 양 이미지에 동일 집합 적용 — 획 끊긴 행이
  축을 오염시키면 전 행에 유령 편향이 생긴다 (교훈). 자기충돌/관절 볼륨 지표는 미구현.

## 파일 맵

- `index.html` — DOM(HUD/패널/드롭존/로코모션 버튼/비율 패널) + CSS
- `public/assets/anim/*.fbx` — 동봉 로코모션 샘플 (Mixamo, HktSplatLife 와 동일 세트)
- `src/proportions.js` — **비율 프로파일 데이터** (`PROFILES.standard/reference`, `GROUPS`, `matchRule`)
  비율 변경은 이 파일의 수치만 만진다 — 이름 규칙 / skeleton 치수(다리 전후 배치 `upLegZ/kneeZ/ankleZ`
  포함) / **loft 원판 스택**(몸통·목·두상·다리 — fit-loft 재피팅으로 갱신, 손 수정 금지) /
  extras / 권장 smin / 휴식 포즈(`armFwd/foreArmFwd` 전방 스윙 포함)
- `eval/` — **Evaluator**: `evaluate.mjs`(실루엣 계측·판정·오버레이 — `HKT_EVAL_VP=WxH` 축소
  뷰포트, `HKT_EVAL_VIEWS=front,side` 뷰 분할 실행 지원) + `lib.mjs`(공용 계측 로직)
  + `fit-loft.mjs`(**시트 → loft 원판 피팅** — `--stage all` 또는 front-torso/side-torso/
  front-legs/side-legs/back-legs(후면 윤곽 추적용)/build-torso/build-legs/apply 하위 단계 분할.
  계측 전부 → 빌드 순서. 결과는 `apply-fit.mjs` 로 proportions.js 의 loft 절에 기계 반영)
  + `apply-fit.mjs`(fit-torso/legs.json → proportions.js loft 절 갱신 — 수작업 붙여넣기 금지)
  + `shot.mjs`(**눈 검증 스크린샷 CLI** — `--az/--el/--dist/--ty` 임의 카메라, `--shots` JSON
  배열로 여러 장. Evaluator 는 실루엣만 보므로 음영 아티팩트는 이걸로 눈 검증)
  + `smoke-run.mjs`(standard 프리셋·손가락·걷기 클립 스모크 — 페이지 오류 감지)
  + `optimize.mjs`(**프로파일 자동 최적화** — dense 라인 손실 좌표 하강. loft 전환 후 파라미터는
  잔여 캡슐(팔·어깨)·extras·골격·포즈만, `node eval/optimize.mjs [--baseline|--sweeps N]`)
  + `fixtures/reference-sheet.jpeg`(기준 캐릭터 시트 — 민머리 소체 3뷰).
  산출물은 `eval/out/`(gitignore). 비율을 만졌으면 `npm run eval` 로 회귀 확인.
  계측 도구는 `?paused=1` + `st.pause` 로 필요한 프레임만 렌더 (소프트웨어 GL 대응).
  ⚠ optimize 실행 중 src/ 를 편집하지 말 것 — vite HMR 리로드로 상주 페이지 상태가 날아간다.
- `src/fleshmesh.js` — **정점 메시 살 층** (VERTEX-PLAN): SDF JS 포트 + 방사 투영 + 체인/캡
  토폴로지 + Taubin 스무딩 + 이중 바인딩 런타임. 빌드는 바인드 포즈 1회, 프레임은 뼈 변환만.
- `src/meshfit.js` — fit-mesh 가 생성하는 시트 잔차 보정 데이터 (손 수정 금지 —
  `node eval/fit-mesh.mjs` 재실행으로 갱신, 초기화는 rows 를 [] 로 되돌린 뒤 2회 실행)
- `src/main.js` — 전체 로직. 섹션 주석으로 (1)IR (2)grammar (3)source 구분
  - `frag` : 레이마칭 프래그먼트 셰이더 (round-cone SDF의 smooth-union)
  - `buildMixamoRig(sk)` : Mixamo 표준 humanoid 계층 (T-pose) — 치수는 프로파일 skeleton 절
  - `radiusForName()` : flesh grammar 조회 (프로파일 규칙 × 그룹 배율)
  - `extractBones()` / `extractExternal()` : 관절 → taper 캡슐 세그먼트
    (+`appendSubBones()` 가상 하위 뼈 사슬, +`appendExtras()` 볼륨 헬퍼 — extras 는 가상 뼈에도 붙는다)
  - `setPreset()` : 프리셋 전환 (built-in 리그 재생성; 외부 FBX 는 두께/헬퍼만 적용)
  - `loadFBXBuffer()` / `loadSample()` / `playExtClip()` : FBX 파싱 + 샘플 fetch + 클립 전환
  - `window.__hkt` : 콘솔 튜닝/자동 검증용 핸들 (st, groupMul, setPreset, PROFILES)

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
```

우측 패널 **로코모션** 버튼으로 동봉 FBX 샘플을 바로 재생하거나, Mixamo FBX 를 드롭존에 놓으면
실제 클립이 재생된다. (스케일 정규화 포함 — Mixamo 100배 스케일 자동 처리, 애니메이션-only FBX 는
뼈 world 위치로 바운드 재계산.)

## 현재 상태 / 다음 작업

**동작함**: built-in Mixamo 리그 위에서 walk/idle/wave, 손가락 토글, 스타일 슬라이더(smin/통통함),
동봉 로코모션 FBX 샘플(걷기·뛰기·대기·점프·공격·삼바) 원클릭 재생, 다중 클립 크로스페이드 전환, 실제 FBX 드롭,
**비율 프로파일**(standard/reference 프리셋 + 머리/가슴/허리/엉덩이/팔/다리 그룹 슬라이더 + 볼륨 헬퍼),
**원판 로프트 살 층**(몸통·목·두상·다리 — 시트 자동 피팅, 두상 블렌드 융기 소멸, eval 3뷰
3지표 PASS), **flatten 2축/one-sided**, **자세 정렬**(요추 아치·다리 전후 배치·팔 전방 스윙),
**음영 품질 1차 정리**(2026-07: 힙 새들백 크리스·골반 "기저귀 살" 랫칫·다리 골판지 밴드·
가슴판 융합·둔부 bolted-on lump·어깨 스파이크·팔꿈치 웰드 lump 해소 — 후면 윤곽 추적 피팅
+ 관절 경계 k0/k1 + 스택 내부 k 0.016 + extras 재정합. eval 폭 MAE front 0.0099→0.0076,
back max 0.028→0.019), **정점 메시 살 층**(2026-07 VERTEX-PLAN 1차: 찍고→투영 조정→스무딩
+ fit-mesh 잔차 피팅(torso df/db/dx + leg df/db/dxo/dxi) + **목 라인**(구 껍질 침수 차단
+ 승모근 능선 연장 + 목 폭 지표), 메시 모드 eval 3뷰 4지표 PASS — 폭 MAE front 0.0077/
side 0.0101/back 0.0076, 전 뷰 SDF 경로 우위 · 목 폭 max 0.021 (SDF 0.084 — 목 부재가
수치로 남는 레거시 한계), 걷기 굽힘 ✓), **큰 흐름(실루엣 저주파) 정리**(2026-07:
① fit-mesh 잔차를 곡률 벌점 스무딩 + 합성 후 재정련으로 저주파 한정 — 이동평균만으로는
중간 파장(10~30cm) 물결이 남고 compose 반복이 기울기 제한을 무력화해 측면 배·둔부가
울렁거렸다(교훈) ② 허벅지 상단 링을 골반·둔부 포함 smin 합집합 표면으로 투영(플래토+
램프 가중 — 절반 가중은 표면이 중간에 떠 단차가 반만 남는다) — 팬티라인/밑둔부 W 플랩
단차가 접선 이음으로 해소 ③ 힙 이음 대역 다리 링 df/db 는 몸통 잔차로 lerp — 한쪽 셸만
보정하면 보정이 절반만 듣고 compose 가 계속 깎는 랫칫(밑둔부 db −1.7cm V자 교훈)).

**다음 (우선순위 순)**:
1. **정점 메시 층 심화** (VERTEX-PLAN §4): 정점 단계 시트 잔차 피팅(fit-mesh — 4반경 비대칭
   단면 공짜), 팔↔몸통/다리↔골반 스티칭(교차 셸 → 단일 토폴로지), 외부 FBX 리그 지원,
   UE5 내보내기(스킨 웨이트가 이미 정점에 있다 — 구조화 토폴로지로 로드맵 "메시화" 도달).
   ⚠ 교훈: Evaluator 는 실루엣만 본다 — 반드시 `eval/shot.mjs` 렌더 눈 검증 병행.
2. **loft 잔차 다듬기**(SDF 경로 — 투영 원천 품질이 정점 층 품질): 팔 loft 전환 여부,
   one-sided 비대칭 단면(4반경) 원판 확장, 측면 가슴 라인 미세 정합. 측면 f 0.40~0.57 은
   시트 팔 포즈 모순으로 불신 밴드(fit-loft handBand) 고정.
3. **Detail 층 심화**(캡슐 경로): 프리미티브 추가(토러스·쐐기), 손가락 마디·발 아치/발가락
   세분화(현 발은 발목→발끝 테이퍼 캡슐 수준), cut 적용처 발굴, 가슴 볼륨 경계 음영 정리.
4. **Evaluator 확장**: 실루엣 회귀는 구현됨(eval/). 남은 것 — 자기충돌 부피, 관절 볼륨 보존,
   loft 미세조정 파라미터(스택별 반경 배율)의 optimize 노출.
5. **부피 보존**: 관절 압축 시 살 부풂(bulge) 근사 (정점 층은 dual-quaternion 검토).
6. **성능**: SDF 경로는 loft 로 세그먼트 ~120개(전부 detail 경로) — 소프트웨어 GL 에선
   프레임이 수 초라 계측 도구는 `?paused=1`/`st.pause` 로 대응함. 정점 메시 모드는
   래스터라이즈라 이 문제가 없다 (eval 가속 겸용).

## 설계 결정 (되돌리지 말 것)

- 살은 **뼈대의 함수**여야 한다. 별도 메시를 손으로 바인딩하지 않는다.
- grammar는 **이름 기반**으로 유지 — 특정 리그에 하드코딩하지 않는다.
- 스타일 = grammar 공유. 개체가 달라도 grammar가 같으면 스타일이 같다.
