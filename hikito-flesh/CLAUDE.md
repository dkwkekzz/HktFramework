# CLAUDE.md — hikito-flesh

> Skeleton → Flesh: **rig-agnostic SDF flesh 렌더러** 프로토타입.
> 히키토의 대모험 asset pipeline의 실현 가능성 검증용. AI-only 자산 제작 철학의 일부.

## 한 줄 요약

뼈대를 먼저 정의하고, 살을 **뼈대의 순수 함수(SDF)** 로 자라게 한다.
→ 모델링·리깅·스키닝 3단계가 하나로 붕괴. 뼈대를 움직이면 살은 자동으로 따라온다.

## 아키텍처 (3층)

1. **Skeleton IR** — `joints[{name, parent, offset}]` + 프레임별 회전 → world FK.
   소스(built-in / Mixamo FBX / 임의 리그)를 몰라도 동일 경로로 흐른다. FK는 three Object3D 계층이 담당.
2. **Flesh grammar** — `radiusForName(name)`. 이름으로 반지름을 매긴다. **이게 "일관된 스타일"의 정의.**
   Mixamo 이름(`mixamorig:LeftForeArm`)은 접두어만 떼고 매칭. 미지의 뼈는 기본값 → 임의 리그도 안 깨진다.
3. **Source** — built-in Mixamo 표준 리그 + 절차적 클립(walk/idle/wave), 그리고 FBX 드롭(실제 Mixamo 클립).

### harness 매핑
- **Planner** = 뼈대 그래프 = genome
- **Generator** = 살 grammar (`radiusForName` + round-cone SDF + `smin`)
- **Evaluator** = (미구현) 실루엣 판독성 / 스타일 편차 / 자기충돌 / 관절 볼륨 정량 로깅

## 파일 맵

- `index.html` — DOM(HUD/패널/드롭존) + CSS
- `src/main.js` — 전체 로직. 섹션 주석으로 (1)IR (2)grammar (3)source 구분
  - `frag` : 레이마칭 프래그먼트 셰이더 (round-cone SDF의 smooth-union)
  - `buildMixamoRig()` : Mixamo 표준 humanoid 계층 (T-pose)
  - `radiusForName()` : flesh grammar
  - `extractBones()` / `extractExternal()` : 관절 → taper 캡슐 세그먼트

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
```

Mixamo에서 캐릭터/애니메이션을 **FBX**로 받아 우측 패널 드롭존에 놓으면 실제 클립이 재생된다.
(스케일 정규화 포함 — Mixamo 100배 스케일 자동 처리)

## 현재 상태 / 다음 작업

**동작함**: built-in Mixamo 리그 위에서 walk/idle/wave, 손가락 토글, 스타일 슬라이더(smin/통통함), 실제 FBX 드롭.

**다음 (우선순위 순)**:
1. **UE5 다리 — 메시화**: 바인드 포즈에서 SDF 필드를 marching cubes / dual contouring으로 메시화.
   각 표면 정점의 스킨 웨이트는 "그 정점에 어느 뼈 SDF가 얼마나 기여했나"에서 자동 도출 → 스키닝 공짜.
2. **Detail 층**: SDF blob은 매끄러워서 날카로운 특징(손가락 마디, 얼굴, 뿔) 부족.
   뼈대 세분화 or displacement/detail SDF 층으로 스타일 디테일 부여. ← "스타일"의 2차 정의가 여기 삼.
3. **Evaluator 로깅**: 정성 눈검증 말고 정량 지표(실루엣 대비, 자기충돌 부피, 관절 볼륨 보존) 자동 로깅.
4. **부피 보존**: 관절 압축 시 살 부풂(bulge) 근사.
5. **성능**: 손가락 포함 시 셰이더 비용(캡슐 수 × march step). 필요 시 bounding volume / 해상도 스케일.

## 설계 결정 (되돌리지 말 것)

- 살은 **뼈대의 함수**여야 한다. 별도 메시를 손으로 바인딩하지 않는다.
- grammar는 **이름 기반**으로 유지 — 특정 리그에 하드코딩하지 않는다.
- 스타일 = grammar 공유. 개체가 달라도 grammar가 같으면 스타일이 같다.
