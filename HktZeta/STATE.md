# STATE.md — HktZeta 현재 상태

> 다음 세션은 이 문서 + [SPINE.md](SPINE.md) 만 보고 시작할 수 있어야 한다.
> 완료 로그는 여기 쌓지 않는다 — 상세·이력은 `steps/` 와 git 이 든다.

## 지금 어디까지 — P0 씨앗 닫힘 ✅

하나의 산술 함수(오라클 Ω)가 모든 존재의 다음 결정을 내리고, 그 결정을 시간축으로 결합한 것이
세계의 궤적이 되는 **최소 실물**이 선다. 검증 4기둥(결정론·순수성·불변식·창발)이 자동 회귀로 상시 재현된다.

- `core/arith.mjs` — 소인수분해 기반 수론 원천(μ·ω·Ω·λ·lpf), `analyze` 메모, `mix` pairing.
- `core/oracle.mjs` — `decide(a,t) → {turn,act,mag}` 순수 함수, `stepMotion`.
- `core/world.mjs` — `seedWorld/step/run/hashState`, 성장(에너지·주소 전진)·분열 포함.
- `tools/demo.mjs` — 궤적 ASCII 밀도 지도(방사형 창발 확인) + 결정론 재현 표시.
- `npm test` = 14/14 통과(≈1.3s). `npm run demo` = 눈으로 창발 확인.

## 명제 목록 (현재 참, 검증됨)

| # | 명제 | 검증 |
|---|---|---|
| 결정론 | 같은 seed → 완전히 같은 궤적 지문 | `test/world.test.mjs` |
| 순수성 | `decide(a,t)` 는 (a,t)만의 함수 · `step` 은 입력 불변 | `test/oracle.test.mjs` · `test/world.test.mjs` |
| 불변식 | `turn∈{−1,0,1}` · `act` 채널 범위 · `mag≥1` | `test/oracle.test.mjs` |
| 분리 | 서로 다른 주소는 (대개) 다른 산술 궤도 | `test/oracle.test.mjs` |
| 창발 | 세계는 죽어있지 않다 — 이동·성장·개체수 변화 | `test/world.test.mjs` + `demo` |

## NEXT (다음 할 일)

> **P2 · 항상성(homeostasis) 을 먼저 권장.** 지금 개체수는 하드 상한(`MAX_BEINGS=512`)으로 *잘라낸다* —
> 이는 씨앗 단계의 안전장치일 뿐 진짜 생태가 아니다. 다음 step 은 **성장⇄사멸의 균형**을 산술 결정으로
> 정의해 개체수가 *스스로* 안정되게 만든다:
> - "죽음"을 결정 채널/에너지 고갈로 정의(예: 에너지 음수·수명 초과 → 소멸). 하드 truncation 제거가 목표.
> - 검증: 개체수가 상한에 붙어 잘리지 않고, 넓은 seed·tick 범위에서 유계로 *수렴*함을 측정(회귀 테스트로 굳힌다).
>
> 대안 경로: P1(성능 seam — 큰 주소 BigInt 승격) 을 먼저 열어도 된다. 단 P2 가 게임성(생명의 성장)에 더 가깝다.

## 렌더 (직교 트랙, P6-min 열림)

궤적을 세 시점으로 3D 시각화한다 — 코어와 직교(`npm test` 는 렌더와 무관하게 통과).
- `render/viewmodel.mjs`(순수 Scene 파생) → `render/app.mjs`(three.js, Scene만 소비, 불변 ④).
- `npm run shot` = 헤드리스 Chromium 으로 field/terrain/worm PNG 를 결정론적으로 굳힌다(`tools/shots/`).
- 실행 전 `npm install`(three) 1회 필요. node_modules·scene.json 은 커밋하지 않음(.gitignore).

## 시리즈 인덱스

- [steps/step-0001-seed.md](steps/step-0001-seed.md) — P0 씨앗: Ω·결정·결합·성장·궤적 최소 실물 + 검증 4기둥.
- [steps/step-0002-render3d.md](steps/step-0002-render3d.md) — 3D 시각화 3시점(field/terrain/worm) + 헤드리스 캡처.
