# STATE.md — HktSplatEnv 작업 상태

논의·구현한 feature 를 **명제**(한 줄로 참/거짓을 물을 수 있는 문장)로만 나열하고, 현재 작업
상태를 관리한다. 설계 원칙은 [CLAUDE.md](CLAUDE.md), 실행·검증은 [README.md](README.md).

- 상태 표기: ✅ 구현·검증됨 · 🚧 진행 중 · 📝 논의만 됨(미착수)

## 명제

| # | 명제 | 상태 | 근거 |
|---|---|---|---|
| E1 | 월드는 순수 결정론 함수 `world(x,z)→{height,biome}` 이고 타일은 그 창이다 | ✅ | `js/terrain-gen.js` |
| E2 | 저주파 온도·습도 2채널이 바이옴(평야·산악·사막·설원 + 수역)을 경계 보간으로 정한다 | ✅ | `js/terrain-gen.js` |
| E3 | domain warp + ridged multifractal 로 격자감 없는 산맥 능선을 만든다 | ✅ | `js/terrain-gen.js` |
| E4 | 지형은 타일 PLY 로 구워 Spark(WebGL2)가 근접 링·외곽 링으로 스트리밍한다 | ✅ | `js/stage.js`, `js/terrain-gen.js` |
| E5 | 나무·바위는 정적 스플랫으로 Bake 하고 지면 명암을 `f_dc` 에 굽는다(개수 제한 없음) | ✅ | `js/vegetation.js` |
| E6 | 식생·개체 스폰은 좌표·시드 해시로만 결정한다(`Math.random` 금지) | ✅ | `js/scatter.js` |
| E7 | 정적↔동적 승격 계약 상수는 `PROMOTE_CFG` 단일 원본이다 | ✅ | `js/scatter.js` |
| E8 | 월드 게놈은 스타일 프로파일 울타리 밖 값을 클램프 아닌 반려로 검증한다 | ✅ | `js/world-profile.js` |
| E9 | 무대는 수면·하늘 돔·sky/fog 톤과 LoD 예산(≈1.5M 스플랫)을 갖는다 | ✅ | `js/stage.js` |
| E10 | 오빗 카메라의 뷰 파라미터만 무대에 미러한다(투영 공유 금지) | ✅ | `js/math.js`, `js/env-app.js` |
| E11 | `test/env-shot.js` 가 실제 index.html 스트리밍을 캡처해 타일·식생·지형 픽셀·콘솔오류 0 을 판정한다 | ✅ | `test/env-shot.js` |
| E12 | 구름 등 하늘 정적 대상을 3DGS 볼류메트릭으로 그린다 | 📝 | 목표(정적 대상 확장) |
| E13 | 상용 MMORPG 급 퀄리티를 위해 식생 종·밀도·LoD 를 심화한다 | 📝 | 목표(퀄리티) |

## 현재 작업 상태

- **분리 완료** — HktSplatGenesis 의 무대 절반을 자립 실행판으로 떼어냈고, 문서(CLAUDE·STATE·
  README·run)를 이 프로젝트에 독립 정리했다. 코드 헤더 주석의 `HktSplatGenesis` 표기는 이력일 뿐
  동작 의존은 없다.
- **다음 후보**: E12(구름/볼류메트릭 하늘) · E13(식생·LoD 퀄리티 심화). 착수 시 이 절과 위 표를
  갱신한다.
