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
   + 스켈레톤 치수 + 볼륨 헬퍼(extras: 가슴·둔부·종아리·손바닥) + 그룹 배율(UI 슬라이더)로 구성.
   프리셋: `standard`(기존 값 보존) · `reference`(첨부 캐릭터 시트 기준 6등신 여성 체형, 기본값).
   Mixamo 이름(`mixamorig:LeftForeArm`)은 접두어만 떼고 매칭. 미지의 뼈는 기본값 → 임의 리그도 안 깨진다.
3. **Source** — built-in Mixamo 표준 리그 + 절차적 클립(walk/idle/wave), 동봉 로코모션 FBX 샘플
   (`public/assets/anim/*.fbx` — 걷기·뛰기·대기·점프·공격·삼바), 그리고 FBX 드롭(실제 Mixamo 클립).
   다중 클립 FBX 는 이름별 클립 전환(크로스페이드) 지원.

### harness 매핑
- **Planner** = 뼈대 그래프 = genome
- **Generator** = 살 grammar (`radiusForName` + round-cone SDF + `smin`)
- **Evaluator** = `eval/evaluate.mjs` (`npm run eval`) — 레퍼런스 시트 대비 3방향 실루엣
  폭 프로파일 자동 계측·판정(MAE ≤ 0.025H, 행 최대 ≤ 0.06H) + 오버레이 PNG 생성.
  자기충돌/관절 볼륨 지표는 미구현.

## 파일 맵

- `index.html` — DOM(HUD/패널/드롭존/로코모션 버튼/비율 패널) + CSS
- `public/assets/anim/*.fbx` — 동봉 로코모션 샘플 (Mixamo, HktSplatLife 와 동일 세트)
- `src/proportions.js` — **비율 프로파일 데이터** (`PROFILES.standard/reference`, `GROUPS`, `matchRule`)
  비율 변경은 이 파일의 수치만 만진다 — 이름 규칙 / skeleton 치수 / extras / 권장 smin / 휴식 포즈
- `eval/` — **Evaluator**: `evaluate.mjs`(실루엣 계측·판정·오버레이) + `fixtures/reference-sheet.jpeg`
  (기준 캐릭터 시트). 산출물은 `eval/out/`(gitignore). 비율을 만졌으면 `npm run eval` 로 회귀 확인.
- `src/main.js` — 전체 로직. 섹션 주석으로 (1)IR (2)grammar (3)source 구분
  - `frag` : 레이마칭 프래그먼트 셰이더 (round-cone SDF의 smooth-union)
  - `buildMixamoRig(sk)` : Mixamo 표준 humanoid 계층 (T-pose) — 치수는 프로파일 skeleton 절
  - `radiusForName()` : flesh grammar 조회 (프로파일 규칙 × 그룹 배율)
  - `extractBones()` / `extractExternal()` : 관절 → taper 캡슐 세그먼트 (+`appendExtras()` 볼륨 헬퍼)
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
**비율 프로파일**(standard/reference 프리셋 + 머리/가슴/허리/엉덩이/팔/다리 그룹 슬라이더 + 볼륨 헬퍼).

**다음 (우선순위 순)**:
1. **Detail 층**: 캡슐+smin 매체의 한계(뾰족함·오목함·비원형 단면 불가) 돌파 —
   프로파일 extras 를 프리미티브 어휘 확장으로 승격: 타원 스케일 / smooth-subtraction(주름 깎기) /
   프리미티브별 blend 폭(k). 뼈대 세분화(가상 관절)도 여기. ← "스타일"의 2차 정의가 여기 삼.
   Evaluator(`npm run eval`)가 안전망 — 시트 비율이 깨지면 즉시 FAIL.
2. **UE5 다리 — 메시화**: 바인드 포즈에서 SDF 필드를 marching cubes / dual contouring으로 메시화.
   각 표면 정점의 스킨 웨이트는 "그 정점에 어느 뼈 SDF가 얼마나 기여했나"에서 자동 도출 → 스키닝 공짜.
3. **Evaluator 확장**: 실루엣 회귀는 구현됨(eval/). 남은 것 — 자기충돌 부피, 관절 볼륨 보존,
   프로파일 수치 자동 최적화(실루엣 오차를 목적함수로 파라미터 탐색).
4. **부피 보존**: 관절 압축 시 살 부풂(bulge) 근사.
5. **성능**: 손가락 포함 시 셰이더 비용(캡슐 수 × march step). 필요 시 bounding volume / 해상도 스케일.

## 설계 결정 (되돌리지 말 것)

- 살은 **뼈대의 함수**여야 한다. 별도 메시를 손으로 바인딩하지 않는다.
- grammar는 **이름 기반**으로 유지 — 특정 리그에 하드코딩하지 않는다.
- 스타일 = grammar 공유. 개체가 달라도 grammar가 같으면 스타일이 같다.
