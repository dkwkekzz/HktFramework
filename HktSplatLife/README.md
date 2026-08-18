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
**외부 FBX**(Mixamo 등)를 드롭하거나 로코모션 샘플 버튼(걷기·뛰기·대기·점프·공격·삼바)으로
로드하면 히키토 살이 그 클립을 따라 움직인다 — 「내장 스켈레톤」으로 언제든 복귀.
**이펙트 버튼**(또는 숫자키 1~3)으로 타격 · 파이어볼 폭발 · 회복 오라를 발생시킨다.

## 구조

| 파일 | 역할 |
|---|---|
| `js/wgsl.js` · `js/engine.js` | WebGPU 셰이더 + 버퍼/파이프라인/프레임 인코딩 (GPU 상주 3DGS) |
| `js/math.js` | mat4 유틸 + 오빗 카메라 (WebGPU 클립 규약 z∈[0,1]) |
| `js/skeleton.js` · `js/anim.js` | L6 뼈대(built-in FK·살 문법) + 입력→상태→클립 |
| `js/genome.js` · `js/presets.js` | 캐릭터 게놈(형태·채색) + 유전자 스키마·프리셋 |
| `js/fx.js` | F1 이펙트 트랙 — 이펙트 게놈(FX_PRESETS) + 이벤트 슬롯 시스템 |
| `js/heightfield.js` | 시뮬 바닥(외부 지형 입력) — 단독 데모에선 평면 |
| `js/life-app.js` | 부트/루프 드라이버 (무대·조정층 없음) + FBX 드롭/샘플 UI |
| `vendor/` | three r147 UMD + FBXLoader + fflate — **FBX 파싱/FK 입력 전용** |
| `assets/anim/*.fbx` | 동봉 로코모션 샘플 (Mixamo): 걷기·뛰기·대기·점프·공격·삼바 |

## 이펙트 (F1) — 게놈 + 이벤트

이펙트도 세포다. 스프라이트 시트도, 키프레임 커브도, "모양을 그리는" 코드도 없다.

```
이펙트 = 게놈(무엇인가) + 이벤트(언제·어디서)
```

- **게놈** — `js/fx.js` `FX_PRESETS` 의 값 한 줄. F1 유전자 8개(`fxK` 응답 강도 · `burst` 방사 속도 ·
  `cone` 지향성 · `swirl` 와류 · `shell` 구각 집중 · `grow` 팽창 · `curve` 소멸 곡선 · `ember` 잔불 비율)와
  기존 유전자(수명·감쇠·중력·부력·난류·크기·불투명도·발광·색 램프)로 이펙트의 정체성이 결정된다.
- **이벤트** — 런타임에 켜지는 슬롯 하나 (원점·축·세기·시각). `fx.trigger(name, { origin, dir, time })`.
- **규칙** — `wgsl.js` SIM 의 F1 경로 하나. 발생 방향·속도는 스플랫 시드 해시에서 유도하고,
  색·크기·불투명도는 렌더가 수명 위상 `u = age/lifeBase` 에서 다시 유도한다 (절대 원칙 1 유지).

스플랫은 이미 GPU 에 상주한 채 제 이벤트 슬롯(`rest.w`, L6 뼈 친화와 같은 자리)을 알고 있다 —
슬롯이 켜지면 그 세대가 통째로 *깨어난다*. 할당·해제 0, CPU 왕복 0.

**새 이펙트를 만들려면** `FX_PRESETS` 에 게놈을 한 줄 더한다. 셰이더·엔진·UI 는 손대지 않는다
(버튼도 프리셋에서 자동 생성). 예: 타격(짧고 지향성 `cone` 0.7) ↔ 파이어볼 폭발(길고 등방
`cone` 0 + 팽창 `grow` 2.4) 은 코드 분기가 아니라 게놈 좌표가 가른다.

```js
const fx = new HktGenesisFx.FxSystem();     // 이펙트가 스플랫 슬라이스를 나눠 갖는다
engine.setScene(N, fx.compose(baseGenes));  // [기반 개체…, 이펙트 개체…]
fx.trigger('타격', { origin, dir, time: simTime });
engine.frame({ ..., fxEvents: fx.buffer() });
```

**외부 FBX 리그**: `ExternalSkeleton`(rig-agnostic 이름 문법)이 Mixamo FBX 를 파싱해 뼈대를 구동한다.
three(r147)는 FBX 파싱/FK 입력만 담당 — 렌더·시뮬은 여전히 자체 WebGPU(절대 원칙 불변). built-in
스켈레톤이 기본·폴백.

## 검증

```bash
cd test && npm install          # playwright (최초 1회)
CHROMIUM_PATH=/path/to/chromium node life-shot.js out.png walk
```

`life-shot.js` — 히키토(built-in walk)를 엔진 직접 구동으로 배양·촬영하고 생명 픽셀 임계 + GPU
오류 0 을 판정(살이 뼈대를 덮는가). 헤드리스 WebGPU 는 스왑체인 readback 으로 촬영한다.
`fbx-shot.js` — 동봉 삼바 FBX(또는 인자 경로)를 파싱·구동해 살이 외부 클립을 따라가는지 같은 게이트로 판정.

```bash
CHROMIUM_PATH=/path/to/chromium node fx-shot.js fx
```

`fx-shot.js` — 이펙트는 시간축 현상이라 여러 시점을 촬영해 판정한다: 이벤트 전 0 → 발생 직후
픽셀 → 수명 후 다시 0(슬롯 재사용의 전제), 타격은 축으로 치우치고 폭발은 등방으로 더 크게
퍼진다(게놈만으로 갈리는가), 그리고 합성 장면(히키토 + 이펙트 3종)에서 살이 그대로 살아 있는가.
