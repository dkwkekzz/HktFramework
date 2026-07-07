# test — 검증 하니스

GUI 없는 환경(원격 세션·CI)에서 눈 검증을 재현한다. 헤드리스 컴포지터가 WebGPU 표면을
화면에 못 올리므로(스크린샷이 검게 나옴) **스왑체인 텍스처 readback** 으로 PNG 를 찍는다.

## 준비

```bash
cd HktSplatGenesis/test
npm install                # playwright (브라우저 포함)
# 이미 크로뮴이 있으면: export CHROMIUM_PATH=/path/to/chromium (다운로드 생략)
```

## 스크립트

| 명령 | 검증 대상 |
|---|---|
| `node render-shot.js walk.png walk` | 히키토 built-in 클립(walk/idle/wave) — 살이 뼈대를 덮는가 (사진) |
| `node genome-shot.js [ident.png] [head.png] [frames] [count]` | C1 형태 게놈 — ① pose(없음)≡pose(항등) 세그먼트 bit-exact(회귀 0, CPU 결정론) + ② 머리 1.6× 게놈이 walk 무수정 재생 중 머리밴드 확산 RMS 1.5×↑(실루엣 차이) 사진 |
| `node genome-body-shot.js [stocky.png] [slim.png] [frames] [count]` | C2 수동 게놈 — ① 덩치/호리호리가 walk·idle·wave 에서 발 최저 y 지면 근방(힙 보정, CPU) + ② 같은 walk 에 덩치<호리호리 키/상단 y 대비 사진 (애니메이션 보존 증명) |
| `node genome-color-shot.js [palette.png] [plain.png] [frames] [count]` | C3 부위 채색 — ① palette 게놈(머리 빨강·몸통 초록·다리 파랑)에서 밴드 색상(hue) 크게 구분 + ② 무팔레트 밴드 색상 동일(속도 유도만, 회귀) 사진 |
| `node fbx-shot.js` | Mixamo FBX 드롭 경로 — 파싱→친화→살 성장 (사진, samba.fbx 필요: 파일 상단 주석의 curl) |
| `node app-smoke.js` | 실제 index.html 부트 — 프리셋/탭/클립 전환/FBX 입력, 콘솔·GPU 오류 0 |
| `node stage-shot.js out.png` | S 트랙 무대 합성 — 절차 지형 fixture(PLY 즉석 생성)를 Spark 로 로드, 생명(WebGPU readback)과 페이지 내 합성 사진 + 판정 |
| `node terrain-shot.js out.png [frames] [count] [프리셋/장면]` | S2 충돌 지형 — 같은 fixture 의 collider GLB 로 heightfield 를 굽고, 슬라임 바닥 포락선이 평면이 아닌 지형을 따르는지 판정 + 합성 사진 (`불×나무` 는 사진 위주) |
| `node occlusion-shot.js on.png off.png` | S3 오클루전 — 능선이 시선을 막는 카메라를 height() 로 찾아 이동, 오클루전 on/off 생명 픽셀 비교(<50%) + 전후 사진 |
| `node range-server.js` | S4 — tools/serve.py 의 HTTP Range 계약(206/Content-Range/suffix/416) 검증 |
| `node bubble-shot.js a.png b.png` | S5 시뮬 버블 — 격자 밖 슬라임이 gridCenter 추종 시 L2 휴지 간격을 유지하는지 (엔진 직접 구동) |
| `node ash-shot.js out.png` | S5 낙재 — 불×나무 연소에서 재가 분리→낙하→바닥 정착하는지 스플랫 readback 판정 + 사진 |
| `node editor-shot.js out.png` | E1 에디터 — editor.html 부트, 지형 생성(시드 fBm)+개체 5 배치(void 패딩 슬라이스 8)+히키토 walk 를 API 로 구동, 합성 사진 + 판정 |
| `node biome-shot.js [out.png] [seed=7]` | T1 월드 함수 — ① 원점 다른 두 창의 겹침 height/biome/color diff 0 (순수 Node) + ② 넓은 파노라마 PLY 를 Spark 로 로드해 조감 촬영, 렌더 색족 ≥4(바이옴 구분) 판정 사진 |
| `node world-pan-shot.js [out.png] [seed=7] [genome.json]` | T2 청크 스트리밍 — index.html 에서 타일 월드를 켜고 카메라 +x 직진, 타일 교체(합집합>25)+메시·스플랫 상한 유지(O(시야반경))+중앙밴드 지형 100%(이음새 틈 없음) 판정 사진. `genome.json` 인자를 주면 추출된 월드 게놈으로 걷는 월드 스트리밍(W4 산출물 → T2, 색·지형 게놈 유도) |
| `node terrain-bubble-shot.js [follow.png] [fixed.png]` | T3 버블 y 추종 — ① 버킷 인덱스 O(창) 베이크가 나이브 bake 와 diff 0(순수 Node) + ② 원점 ≈70u 3m 분지에서 침투 0%·계곡 바닥 정착·L2 생존(확산 vs 버블 고정 대조군) 판정 사진 |
| `node world-genome.js [seed=7]` | W1 월드 게놈의 데이터화(순수 Node) — ① temperate 프리셋 경유가 현행 플랫 기본과 height/color/biome diff 0(회귀) + ② ashen 프리셋이 평균색거리>0.08·육상 바이옴 완전 분리(다채로움) |
| `node preset-shot.js <preset\|genome.json> [out.png] [seed]` | W1/W4 시각 — 내장 프리셋 또는 게놈 JSON(추출물)을 즉석 파노라마로 Spark 렌더(예: `ashen`, `tools/world-extract/genomes/breeze-meadow.json`). JSON 게놈은 렌더 전 W2 프로파일 검증. biome-shot 렌더 절반의 일반화, W3 concept-shot 원형 |
| `node world-profile.js` | W2 스타일 프로파일(순수 Node) — ① temperate·ashen·최소 게놈·W4 v0 게놈이 울타리 통과 + ② 극단 게놈(과진폭·바이옴 초과·과채도·퇴화 중복·수위 이탈·과ampMul) 반려(위반 필드 확인) |

프레임수·스플랫수 인자는 각 파일 상단 주석 참조. swiftshader(CPU) 라 300프레임 촬영에
수 분 걸린다 — 빠른 확인은 프레임 120 · 스플랫 4096 으로.

## 함정 (하니스 수정 시)

- **present 함정**: 마지막 `engine.frame()` 뒤에 한 번이라도 await 하면 present 로 스왑체인이
  새(빈) 텍스처로 바뀐다 — 마지막 프레임과 `copyTextureToBuffer` 는 같은 태스크에서.
- **rAF 적체**: 앱을 자유 rAF 로 돌리면 swiftshader 가 큐를 못 따라가 `mapAsync` 가 몇 분씩
  밀린다 — app-smoke 처럼 rAF 를 수동 스테핑하고 프레임마다 `onSubmittedWorkDone()` 대기.
- **통계만 믿지 말 것**: "스플랫이 뼈대 표면에 근접" 통계는 방울 뭉침도 통과시킨다 — 사진 필수.
