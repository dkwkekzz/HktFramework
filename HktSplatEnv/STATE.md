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
| E12 | 구름 등 하늘 정적 대상을 3DGS 볼류메트릭으로 그린다 | ✅ | `js/clouds.js`, `js/stage.js` updateClouds |
| E13 | 상용 MMORPG 급 퀄리티를 위해 식생 종·밀도·LoD 를 심화한다 | 📝 | 목표(퀄리티) |
| E14 | 지형 스플랫은 표면 노멀 정렬 이방성 surfel 이고 근접 링 밀도는 128 격자다(LoD 예산 활용) | ✅ | `js/terrain-gen.js` tilePly, `js/stage.js` |
| E15 | 지형색은 경사 기반 절벽 암반(층리 밴딩)과 고주파 패치·럼프 알베도 디테일을 굽는다 | ✅ | `js/terrain-gen.js` colorAt·detailAt·cliffTOf |
| E16 | 조명 bake 는 태양(웜)·하늘(쿨) 2색 + cast shadow(레이마치) + AO 이고 평지 완전 수광 = 알베도로 정규화된다 | ✅ | `js/terrain-gen.js` shadeRGBFromNormal·shadowAt·aoAt |
| E17 | 원경 스플랫은 링 중심 거리 기준 fog 톤으로 프리블렌드되어 지평선에서 배경과 이음새 없이 만난다 | ✅ | `js/terrain-gen.js` tilePly/waterTilePly opts, `js/stage.js` bakeOpts |
| E18 | 나무는 종(활엽/침엽)·단풍 변주와 태양면/그늘면 형태 음영을 갖는 다중 클러스터다 | ✅ | `js/vegetation.js` treeSplats·coniferSplats |
| E19 | 수면은 터쿼이즈 심도 팔레트 + 물가 포말 링 + 하늘 반사 틴트 + 스파클을 bake 한다 | ✅ | `js/terrain-gen.js` waterTilePly |
| E20 | 근접 링은 지면 클러터(풀 포기·꽃 악센트·자갈)를 바이옴 규칙으로 bake 한다 | ✅ | `js/vegetation.js` clutterSplats |
| E21 | 타일 bake 는 워커에서 돌고(동기 폴백 동일 바이트) 중심 타일은 256격자 디테일 링이다 | ✅ | `js/bake-worker.js`, `js/stage.js` bakeTileData·3링 |
| E22 | 지형은 바이옴별 고주파 감쇠(매끈한 구릉)와 계단 플래토 셰이핑(트레드+라이저)을 갖는다 | ✅ | `js/terrain-gen.js` fbm detail·reliefCore terrace |
| E23 | 나무는 로브 클럼프 + 2톤 하드 셰이딩의 스타일라이즈드 실루엣이다(가시 줄기·침엽 스파이어) | ✅ | `js/vegetation.js` treeSplats·coniferSplats·toonShade |

## 현재 작업 상태

- **분리 완료** — HktSplatGenesis 의 무대 절반을 자립 실행판으로 떼어냈고, 문서(CLAUDE·STATE·
  README·run)를 이 프로젝트에 독립 정리했다. 코드 헤더 주석의 `HktSplatGenesis` 표기는 이력일 뿐
  동작 의존은 없다.
- **퀄리티 트랙 1차 완료(E14~E18)** — 목표 레퍼런스는 스타일라이즈드 오픈월드(원신급 vista).
  진단 결론: 품질 병목은 렌더러가 아니라 굽는 데이터(스플랫 크기·정렬·색 디테일·조명 bake).
  ① 표면 정렬 surfel+밀도 ② 경사 재질·알베도 디테일 ③ 종 변주·형태 음영 나무 ④ 2색 조명·
  그림자·AO ⑤ 원경 fog 프리블렌드까지 완료. 기본 진입(env-app)이 temperate mood(하늘 돔·
  구름·fog)를 배선(E9 활용).
- **알려진 한계 / 다음 후보**:
  - 지상 눈높이 근접: 중심 타일 셀 0.075m(256격자) + 근접 링 0.10m(192격자), 전부 워커 bake.
    총 ~400k 스플랫(예산 1.5M 내). 더 올리려면 farR 축소 또는 예산 상향과 트레이드.
  - 카메라 초근접 수관 블롭의 가우시안 꼬리가 큰 반투명 돔으로 보이는 3DGS floater 현상 —
    수관 σ 상한 또는 근접 페이드가 후보.
  - 수면 정적 근사(E19)를 넘어서는 실시간 반사 — three 평면 메시 + 프레넬 셰이더 교체(하늘 돔 선례).
  - E12(볼류메트릭 구름) · E13 잔여(식생 밀도/LoD·풀 레이어).
- **검증**: `test/env-shot.js` OK (타일 25 · 스플랫 184k · 콘솔 오류 0). bake 예산: 근접 타일
  210ms(풀 조명)·외곽 19ms.
