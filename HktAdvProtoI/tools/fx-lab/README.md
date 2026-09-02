# FX Lab — 이펙트 게놈 실험실

HktSplatLife 를 그대로 옮겨 온 **독립 테스트 환경**이다. 게임(`app/`)과 아무것도 공유하지
않는다 — 세계도, 프로토콜도, 관찰 결과도 없다. 여기 있는 것은 스플랫 런타임과 그것을 만지는
슬라이더뿐이다.

이 랩이 존재하는 이유는 하나다. **이펙트는 게놈이고, 게놈은 눈으로 맞춰야 한다.**
게임 안에서 맞추려면 세계를 띄우고 누구를 때려야 하지만, 여기서는 버튼 하나로 같은 이펙트가
같은 런타임에서 태어난다.

## 무엇이 어디에 있는가

```text
engine/view-kernel/fx/splat/   스플랫 런타임 — 랩과 게임이 함께 읽는 단 하나의 사본
                               (math · heightfield · genome · skeleton · anim · presets
                                · wgsl · engine · fx)
tools/fx-lab/index.html        랩 페이지 — 위 런타임을 ../../ 로 읽는다
tools/fx-lab/js/life-app.js    랩 드라이버 (UI · 슬라이더 · 이펙트 버튼) — 랩에만 있다
tools/fx-lab/vendor/           three r147 + FBXLoader + fflate — FBX 파싱/FK 입력 전용
tools/fx-lab/assets/anim/      Mixamo 로코모션 샘플
tools/fx-lab/test/             헤드리스 검증 하니스
```

런타임이 랩 안이 아니라 기반(`engine/`)에 있는 것이 핵심이다. 랩에서 맞춘 게놈이 게임에서
그대로 사는 이유가 **같은 파일을 읽기 때문**이어야 한다 — 복사본이 둘이면 그 순간 갈라진다.

## 띄우기

```bash
tools/fx-lab/run.sh          # 정적 서버 + 브라우저 (기본 8200 포트)
```

WebGPU 가 필요하다 (Chrome/Edge 113+). 열리는 주소는 `/tools/fx-lab/index.html` 이다 —
런타임을 `../../engine/...` 로 읽으므로 **프로젝트 루트**를 서빙해야 한다.

## 검증

```bash
cd tools/fx-lab/test && npm install     # playwright (헤드리스 크로뮴)
node fx-shot.js                         # 이펙트: 켜지는가 · 꺼지는가 · 게놈만으로 갈리는가
node life-shot.js                       # 살: 뼈대를 덮는가
node lab-smoke.js                       # 랩 페이지: 부팅 · 런타임 적재 · 이펙트 배선
node overlay-shot.js                    # 게임 쪽 오버레이: 투명한가 · 그 자리에 그리는가
node game-shot.js                       # 게임 전 경로: 세계 → 관찰 → 결정 → 오버레이
```

프로젝트 루트에서는 `npm run fx:shot` · `npm run fx:lab` · `npm run fx:overlay` ·
`npm run fx:game` 으로도 부른다
(`npm test` 에는 들어 있지 않다 — 브라우저와 GPU 가 필요하다).

브라우저를 직접 지정하려면 `CHROMIUM_PATH=<chrome 실행 파일>` 을 준다.

알아 둘 것 — `fx-shot.js` 의 `굴절 파면은 색이 아니다` 게이트는 임계(폭발의 1/2)에 아주
가깝게 붙어 있어 소프트웨어 래스터라이저(swiftshader)에서는 실행마다 통과·실패가 갈린다.
이것은 옮기면서 생긴 것이 아니다 — HktSplatLife 원본도 같은 환경에서 같은 게이트만 갈린다.
실제 GPU 에서는 갈리지 않는다.

## 새 이펙트를 만드는 법

`engine/view-kernel/fx/splat/fx.js` 의 `FX_PRESETS` 에 **게놈 한 줄**을 더한다. 코드(셰이더·
엔진·UI)는 손대지 않는다. 게놈의 각 유전자가 무엇인지는 그 파일 상단 주석이 원본이다.

게임에서 그 이펙트를 쓰려면 그 다음 한 걸음이 더 있다 — 어떤 사건이 그것을 켜는지를 팩이
정한다: [content/view/effect-presentation.ts](../../content/view/effect-presentation.ts).

## 게임과의 관계

랩은 게임을 모른다. 게임은 랩을 모른다. 둘은 런타임 하나만 공유한다.

```text
FX Lab           →  게놈을 맞춘다 (fx.js FX_PRESETS)
engine .../fx/   →  같은 런타임을 게임 화면 위에 WebGPU 오버레이로 올린다 (effect-layer.ts)
content 팩       →  어떤 사건이 어떤 이펙트를 켜는지 정한다 (effect-presentation.ts)
```
