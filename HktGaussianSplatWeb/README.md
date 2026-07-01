# HktGaussianSplat — Web Viewer

브라우저에서 도는 3D Gaussian Splatting 뷰어. 빌드 툴 없이 **WebGL2 + 순수 JS** 로 구현했다. UE 플러그인 `HktGaussianSplat` 과 동일한 렌더 수학(3D 공분산 → EWA 2D 투영 → 가우시안 falloff)을 웹에 옮긴 것.

## 실행

로컬 정적 서버로 여는 것을 권장한다 (Web Worker/텍스처 로드가 가장 안정적):

```bash
cd HktGaussianSplatWeb
python -m http.server 8080
# 브라우저에서 http://localhost:8080
```

`index.html` 을 파일로 직접 열어도 동작하도록 정렬 워커는 인라인 Blob 으로 구성했다(일부 브라우저는 `file://` 에서 제약이 있을 수 있음).

## 사용법

1. 3DGS `.ply` 파일을 창에 드래그하거나 "파일 선택" 버튼으로 연다.
2. 마우스 드래그=회전, 휠=줌, 우클릭(또는 Shift)드래그=이동.
3. 우측 패널에서 불투명도·포인트 크기·배경 조절.

지원 포맷: INRIA 3DGS 계열 `binary_little_endian` PLY
(`x,y,z / scale_0..2 / rot_0..3 / opacity / f_dc_0..2`).

## 구조

| 파일 | 역할 |
|---|---|
| `index.html` | 캔버스 + HUD + 파일 드롭 UI |
| `js/camera.js` | mat4 유틸 + 오빗 카메라 |
| `js/ply-loader.js` | 바이너리 PLY 파서 → 데이터 텍스처(16 float/splat) + 위치 배열 |
| `js/renderer.js` | WebGL2 인스턴스드 쿼드 렌더러 (EWA 투영 셰이더) |
| `js/app.js` | 로드·렌더 루프·UI + 인라인 정렬 워커(16-bit counting sort) |

## 요구 사항

- WebGL2 지원 브라우저 (`RGBA32F` 텍스처, `texelFetch`)
- 큰 씬(수백만 스플랫)은 GPU/메모리에 비례해 무거움

## 로드맵

- GPU 정렬(현재 워커 CPU counting sort)
- 뷰 의존 SH(f_rest) — 현재 DC 색상만
- `.splat`/`.spz` 압축 포맷, 스트리밍 로드
- WebGPU 백엔드
