# CLAUDE.md — HktGaussianSplatWeb

브라우저용 3D Gaussian Splatting 뷰어. UE 플러그인 `HktGaussianSplat` 의 **웹 포팅** — 동일한 스플랫 수학을 WebGL2 로 옮겼다. 빌드 스텝 없음(순수 HTML + classic JS), `microcosm_web` 과 동일한 무-빌드 컨벤션.

## 아키텍처

```
.ply ─► HktSplatPly.parse ─► { texData(16 float/splat), positions, bounds }
             │                        │
             ▼                        ▼
   RGBA32F 데이터 텍스처         정렬 워커(positions)
   (4 texel/splat)                    │  매 프레임 view → 16bit counting sort
             │                        ▼
   HktSplatRenderer  ◄── 정렬된 aIndex ── far→near 인덱스
             │  drawArraysInstanced(TRIANGLE_STRIP, 4, N)
             ▼
   VS: texelFetch → EWA 2D 공분산 투영 → 방향성 타원 쿼드
   PS: 가우시안 falloff, premultiplied over 블렌딩
```

## 렌더 수학 (UE 버전과 정합)

- 3D 공분산은 **로드 시 CPU 선계산**: `Σ = (R·S)(R·S)ᵀ`, 상삼각 6원소 → 데이터 텍스처.
- VS 에서 `T = transpose(mat3(view)) · J`, `cov2D = Tᵀ · Σ · T` (antimatter15 정식). 야코비안 `J` 가 OpenGL view(카메라 -Z, y-flip) 를 처리.
- 색상: `0.5 + SH_C0·f_dc` (DC only, 뷰 의존 SH 는 로드맵).
- 좌표계: UE 버전은 (x,-z,y)+cm 리매핑을 하지만 **웹은 네이티브 좌표 그대로** 두고 오빗 카메라가 방향을 처리 — 단순성 우선.

## 컨벤션

- classic `<script>` (ES 모듈 아님) — `file://` 호환. 전역 네임스페이스 `HktMat`/`HktOrbitCamera`/`HktSplatPly`/`HktSplatRenderer`.
- 정렬 워커는 **인라인 Blob** — 별도 파일 fetch 없이 `file://` 에서도 동작.
- 주석 한국어.

## 검증 포인트

- WebGL2 `RGBA32F` 샘플링 + `texelFetch`(NEAREST) — 확장 없이 코어.
- 블렌딩: back-to-front 정렬 + `(ONE, ONE_MINUS_SRC_ALPHA)` premultiplied over.
- 큰 파일 파싱은 메인 스레드(블로킹) — 필요 시 파서도 워커로 이관(로드맵).

## 로드맵

GPU 정렬 · 뷰 의존 SH · `.splat`/`.spz` · 스트리밍 · WebGPU 백엔드 · 파서 워커화
