# CLAUDE.md — HktSplatGenesis

캡처 없는 절차적/창발 3DGS 실험장. **스플랫 = 세포** — 시뮬 상태가 유일한 원본이고 렌더 속성은 항상 유도된다. `HktGaussianSplatWeb`(PLY 뷰어)과 별개 프로젝트지만 무-빌드 컨벤션과 EWA 렌더 수학을 공유한다.

## 절대 원칙

1. **렌더 속성 직접 생성 금지** — 공분산·색·불투명도는 반드시 시뮬 상태(pos/vel/age/energy)와 유전자로부터 셰이더에서 유도한다. "모양을 그리는" 코드가 생기는 순간 이 프로젝트의 존재 이유가 사라진다.
2. **개체 정의 = 유전자 벡터** — 새 존재(슬라임/골렘/나무)는 새 코드 경로가 아니라 새 유전자 값 + (필요 시) 새 국소 규칙으로 만든다. 프리셋은 유전자 공간의 점일 뿐.
3. **GPU 상주** — 시뮬→정렬→렌더 사이 CPU 왕복 금지. 상태 readback 은 디버그 한정.

## 아키텍처

```
sim(compute, 자율 규칙) → key(뷰 깊이→단조 uint) → bitonic sort → EWA 인스턴스드 쿼드
```

- `js/wgsl.js` — 셰이더 4종. `Splat` 구조체(48B)는 `engine.js` `SPLAT_STRIDE`(12 float) 와 바이트 일치 필수.
- `js/engine.js` — 버퍼/파이프라인/프레임 인코딩. 정렬 단계 (k,j) 는 256B 슬롯 테이블 + 동적 오프셋 (WebGPU 는 push constant 없음).
- `js/app.js` — 유전자 정의(`GENE_DEFS`)·프리셋(`PRESETS`)·UI. 유니폼 레이아웃 변경 시 wgsl.js/engine.js 양쪽 동기화.
- `js/math.js` — WebGPU 클립 규약(z∈[0,1]) 카메라. `HktGaussianSplatWeb` 의 GL 버전과 혼동 주의.

## 불변 조건 (깨지면 화면이 즉시 무너짐)

- 스플랫 수 N 은 **2의 거듭제곱** (바이토닉 정렬 전제, `setCount` 가 검증).
- 정렬 키: 카메라 앞 = 음수 뷰 z → orderable uint 오름차순 = **far→near** (back-to-front over 블렌딩 전제).
- 블렌딩 premultiplied over: FS 출력 `vec4(rgb*B, B)` + (one, one-minus-src-alpha).
- 렌더 VS 의 퇴화 처리: 컬 시 네 꼭짓점 동일 위치 반환 (discard 아님).

## 컨벤션

- classic `<script>` 전역 네임스페이스(`HktGenesisEngine`/`HktGenesisWGSL`/`HktMat`/`HktOrbitCamera`), 빌드 스텝 없음, 주석 한국어.
- 튜닝 노브는 하드코딩하지 않고 `GENE_DEFS` 슬라이더로 노출 (UE CVar 관례의 웹 대응).

## 로드맵

L2 spatial hash 이웃 규칙(슬라임) → L3 본드/shape matching(골렘) → L4 성장(나무) → L5 원소 상호작용. 진짜 curl noise(발산 무), GPU radix sort 대체, 다중 개체(유전자 per-entity 버퍼)도 대기열.
