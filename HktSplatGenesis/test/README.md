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
| `node fbx-shot.js` | Mixamo FBX 드롭 경로 — 파싱→친화→살 성장 (사진, samba.fbx 필요: 파일 상단 주석의 curl) |
| `node app-smoke.js` | 실제 index.html 부트 — 프리셋/탭/클립 전환/FBX 입력, 콘솔·GPU 오류 0 |
| `node stage-shot.js out.png` | S 트랙 무대 합성 — 절차 지형 fixture(PLY 즉석 생성)를 Spark 로 로드, 생명(WebGPU readback)과 페이지 내 합성 사진 + 판정 |
| `node terrain-shot.js out.png [frames] [count] [프리셋/장면]` | S2 충돌 지형 — 같은 fixture 의 collider GLB 로 heightfield 를 굽고, 슬라임 바닥 포락선이 평면이 아닌 지형을 따르는지 판정 + 합성 사진 (`불×나무` 는 사진 위주) |

프레임수·스플랫수 인자는 각 파일 상단 주석 참조. swiftshader(CPU) 라 300프레임 촬영에
수 분 걸린다 — 빠른 확인은 프레임 120 · 스플랫 4096 으로.

## 함정 (하니스 수정 시)

- **present 함정**: 마지막 `engine.frame()` 뒤에 한 번이라도 await 하면 present 로 스왑체인이
  새(빈) 텍스처로 바뀐다 — 마지막 프레임과 `copyTextureToBuffer` 는 같은 태스크에서.
- **rAF 적체**: 앱을 자유 rAF 로 돌리면 swiftshader 가 큐를 못 따라가 `mapAsync` 가 몇 분씩
  밀린다 — app-smoke 처럼 rAF 를 수동 스테핑하고 프레임마다 `onSubmittedWorkDone()` 대기.
- **통계만 믿지 말 것**: "스플랫이 뼈대 표면에 근접" 통계는 방울 뭉침도 통과시킨다 — 사진 필수.
