# step-0002 — 3D 시각화: 궤적을 세 시점으로 세운다

## 명제

> 궤적(core)을 타입 있는 Scene 으로 파생하고, 렌더는 그 Scene 만 소비해 3D 로 그린다(불변 원칙 ④).
> 세계는 세 시점 — **field**(존재·성장·궤적), **terrain**(산술 지형), **worm**(시공 궤적) — 으로
> 헤드리스 Chromium 스크린샷으로 상시 재현된다.

## 구현 (`render/`, `tools/`)

- **ViewModel** `render/viewmodel.mjs`(순수): core 를 굴려 `Scene = {meta, bodies, trails, terrain}` 을 파생.
  세계 규칙 재유도 없이 표현용 속성으로만 정규화. `terrain` = 정수 k 의 Ω(k) 높이 + μ(k) 색 게이트.
- **렌더** `render/app.mjs`(three.js, 브라우저): `?view=field|terrain|worm` 로 Scene→3D. core·규칙 접근 없음.
- **서버/캡처** `tools/serve.mjs`(정적 + three 빌드 매핑), `tools/shot.mjs`(Playwright 헤드리스 → PNG 3장).

## 결과 (`tools/shots/`, seed=7 ticks=400 count=8)

- `hktzeta-field.png` — 512 존재를 act 채널 색(이동·섭취·분열·대기)으로, 몸 크기=ω(n), 높이=에너지(성장),
  얇은 선=8 계보의 궤적. 방사형 군집 + 성장 기둥이 보인다.
- `hktzeta-terrain.png` — Ω(n) 이 만든 험준한 산술 지형, μ(n) 으로 색이 갈린다(붉음=제곱인수).
- `hktzeta-worm.png` — 8 계보가 시간축(↑)을 따라 감기며 오르는 시공 궤적(space-time worm).

## 검증

- `npm run shot` = 세 시점 PNG 를 결정론적으로 굳힌다(같은 seed → 같은 Scene → 같은 그림). 클라우드 헤드리스 재현.
- WebGL 2.0 (ANGLE/SwiftShader) 로 헤드리스 렌더 확인. 코어 회귀(`npm test` 14/14)는 렌더와 직교로 그대로 통과.

## 발견 · 한계

- **수리 1**: 서버가 `/render/`(디렉터리)에 404 — 끝이 `/` 인 URL 을 `index.html` 로 해소해 수정.
- **수리 2**: three 0.180 의 `three.module.js` 는 `three.core.js` 를 재수출한다 — `/three*.js` 를 빌드
  디렉터리로 매핑해 수정.
- **한계**: `three` 는 `npm install` 필요(node_modules 는 커밋 안 함). terrain 은 원시 Ω(n) 라 중앙에
  다소 두드러진 열이 보인다(정직한 데이터). 리치화(튜브 꼬리·이펙트·인터랙션)는 P6 후속.
- **주의**: 렌더는 최종 틱의 bodies + 초기 8 계보 trails 만 그린다(계보 index 는 truncation 뒤쪽부터라 안정).
  전체 개체의 궤적/분열 이벤트 시각화는 후속 step.
