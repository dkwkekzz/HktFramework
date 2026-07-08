# HktSplatLife — 캐릭터(동적) 배양

HktSplatGenesis 에서 갈라져 나온 **생명(캐릭터=동적)** 단독 프로젝트. **WebGPU 전용** — 무대(Spark
환경) 레이어가 전혀 없다. 스플랫 = 세포: 색·모양은 시뮬 상태(pos/vel/energy)와 유전자로부터
셰이더가 유도한다(직접 그리지 않음). 무-빌드(classic `<script>`), 주석 한국어.

## 실행

```bash
./run.sh            # http://localhost:8200 — 브라우저에서 index.html 열기
```

Chrome/Edge 113+ (WebGPU) 필요. 좌드래그 회전 · 우/Shift드래그 이동 · 휠 줌. 프리셋 버튼으로
불의 정령·나무·슬라임·물·골렘·히키토를 배양한다(히키토는 built-in FK 뼈대 위에 살이 자란다).

## 구조

| 파일 | 역할 |
|---|---|
| `js/wgsl.js` · `js/engine.js` | WebGPU 셰이더 + 버퍼/파이프라인/프레임 인코딩 (GPU 상주 3DGS) |
| `js/math.js` | mat4 유틸 + 오빗 카메라 (WebGPU 클립 규약 z∈[0,1]) |
| `js/skeleton.js` · `js/anim.js` | L6 뼈대(built-in FK·살 문법) + 입력→상태→클립 |
| `js/genome.js` · `js/presets.js` | 캐릭터 게놈(형태·채색) + 유전자 스키마·프리셋 |
| `js/heightfield.js` | 시뮬 바닥(외부 지형 입력) — 단독 데모에선 평면 |
| `js/life-app.js` | 부트/루프 드라이버 (무대·조정층 없음) |

FBX 외부 리그(vendor/three r147)는 이 단독 프로젝트에 포함하지 않았다 — built-in 스켈레톤만.
필요 시 원본 HktSplatGenesis 의 `vendor/three.min.js` + `js/life/skeleton.js` ExternalSkeleton 참조.

## 검증

```bash
cd test && npm install          # playwright (최초 1회)
CHROMIUM_PATH=/path/to/chromium node life-shot.js out.png walk
```

`life-shot.js` — 히키토(built-in walk)를 엔진 직접 구동으로 배양·촬영하고 생명 픽셀 임계 + GPU
오류 0 을 판정(살이 뼈대를 덮는가). 헤드리스 WebGPU 는 스왑체인 readback 으로 촬영한다.
