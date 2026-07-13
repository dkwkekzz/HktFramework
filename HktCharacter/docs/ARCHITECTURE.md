# ARCHITECTURE — HktCharacter 구조·원리

뷰어 전부가 `src/main.js` 하나에 있다. 상위 목표·불변 원칙은 [../CLAUDE.md](../CLAUDE.md),
현재 상태는 [../STATE.md](../STATE.md) 참조.

## 구조 (전부 `src/main.js`)

1. **씬** — three.js + OrbitControls, 헤미/디렉셔널 라이트, 그리드, 선택 표시 링.
2. **슬롯** (`SLOTS.main` 하나, x=0) — 화면에 캐릭터 한 명. `MODELS`(X Bot=남 / Y Bot=여)
   버튼 또는 📁 교체(임의 with-skin FBX)로 `switchModel` 이 그 자리를 갈아끼운다. 슬롯의
   `ch`(root·meshes·bones(구동 뼈)·boneMap·allBones·mixer·clips·actions·helper·baseScale·
   props·bindLocalQ·bindWorldQ·staticParentQ·primeMesh). `bootstrap()` 는 X Bot 을 로드해
   **대기**로 세운다.
3. **로드/정규화** (`makeCh`) — Mixamo with-skin FBX 는 스킨 메시 2벌(Surface+Joints)의
   스켈레톤이 같은 이름 트윈으로 **교차(interleaved)** 배치되고, 어느 쪽이 계층 등뼈인지는
   파일마다 다르다(X Bot=Surface 쪽, Y Bot=Joints 쪽). 그래서 구동 뼈는 메시 소속이 아니라
   **DFS 선순회에서 simpleName 별 첫 뼈(= 항상 조상 쪽 등뼈)** 로 고르고, 같은 이름의 나머지
   뼈는 `__dupN` 으로 개명해 믹서 이름 충돌만 없앤다. 트윈 자식은 바인드 로컬을 유지한 채
   부모를 따라가므로 **두 메시 모두 제거 없이** 애니메이션된다. `computeBaseScale`(키 1.7m)
   +`applyProps`(본 스케일→root 스케일→발 접지). 접지·정규화는 스킨 CPU boundingBox 가
   아니라 **뼈 월드 bbox**(`boneBox`)로. 로드 직후 바인드(로컬 q·월드 q)를 캐시한다.
4. **리타깃** (`bakeClip`, 순수 월드 공간 자체 구현 — `SkeletonUtils.retargetClip` 폐기) —
   원리: 타깃 월드 회전 = `srcWorld(t) × corr`, `corr = srcBindWorld⁻¹ × tgtBindWorld`.
   소스만 전용 믹서로 프레임 샘플링하고, 프레임마다 실제 부모의 월드 회전(비매칭 뼈는
   바인드 로컬 유지로 전파) 기준 로컬로 변환해 `뼈.quaternion` 트랙을 만든다 — **타깃 뼈는
   읽지도 쓰지도 않아** 상태 오염(본 흩어짐)이 원천적으로 없다. rest 축이 비-단위인 raw
   mixamorig 리그도 corr 이 흡수. 위치 트랙은 **hips 변위(x/y/z) 전체** — 소스 hips 월드
   변위를 키 비율(`hScale = tgtHipsBindY/srcHipsBindY`)로 스케일해 hips.position 트랙으로.
   회전만 옮기면 앉는 동작에서 발이 뜨고(v4 버그), y 만 옮기면 체중 이동·런지가 사라져 발이
   반대로 미끄러지며 중심이 흔들린다(v4.2 버그). 제자리 재생은 x/z 의 **선형 순이동 성분만
   제거(detrend)** 로 유지 — 동봉 Mixamo 클립은 전부 제자리(순이동=0)라 흔들림이 온전히
   남는다. `simpleName` 은 `"mixamorig:LeftHand"` / `"mixamorigLeftHand"` / `"LeftHand"` →
   모두 `lefthand`. 소스는 파일당 1회 `sourceCache`.
5. **접지** — root **x/z 는 로드 시 1회만** 정렬(바인드 bbox 중심), 재생 중 불변. **y 는
   클립별 사전 측정**(`measureClipRootY`: 임시 믹서로 클립을 12+1 프레임 샘플링해 뼈 bbox
   최저점이 y=0 에 닿는 root.y 를 계산, 측정 후 상태 원상복구 → 화면 불변). `playClip` 이
   시작 시 그 값을 적용하고 `mixer.update(0)` 로 포즈를 즉시 얹는다(1프레임 T-포즈 방지).
   재생 중 포즈를 재측정해 root 를 옮기는 코드는 **금지** — crossfade 혼합 포즈를 측정하면
   클립·모델·타이밍마다 다르게 뜨거나 중심이 틀어진다(v3.2 버그의 원인). 본 비율 변경 시
   `applyProps` 가 클립별 접지 캐시(`__rootY`)를 무효화하고 현재 포즈 기준으로만 y 재접지.
6. **본 비율** (`PROP_GROUPS`) — 키(root)·머리·몸통·어깨너비·팔·다리·손을 `simpleName` 정규식에
   걸리는 뼈 `scale` 로 조절. 값 변경 시 `applyProps` → `replant`(발 접지 유지). 슬라이더는
   **선택 캐릭터별** 상태(`ch.props`)를 반영.
7. **드롭존** — with-skin FBX 는 캐릭터 교체, 애니메이션-only 는 현재 캐릭터에 리타깃 재생.
8. **UI** — 캐릭터/애니메이션/본 비율/속도/표시(메시·본·회색·와이어·SDF 살) + `window.__hkt` 핸들.
9. **SDF 살** (`src/mcflesh.js` + `src/fleshdna.js` + `src/fleshbake.js`, v5 트랙) — 뼈마다 세그먼트
   하나, Wyvill 밀도 `(1-d²/R²)³` (R=BLEND(2.5)×살반지름)를 필드에 가산 →
   `THREE.MarchingCubes`(res 64, isolation ≈0.593 = 살반지름 지점)로 매 프레임 폴리곤화.
   세그먼트 bbox 안 복셀만 채워 실시간(~7ms). 리그 2벌 FBX 는 simpleName 중복 스킵.
   반지름·형태는 하드코딩이 아니라 **살 DNA**(`fleshdna.js`, 직렬화 가능 JSON)가 소유한다:
   세그먼트별 **프로파일 곡선**(제어점 → PCHIP → 33지점 LUT, 부모0→자식1 축의 반지름),
   **flatten**(타원 단면, 바인드 월드 dir 을 현재 포즈로 회전 추적해 축 직교화한 u 방향을 f배),
   **cut**(세그먼트 로컬 프레임 오프셋 구 감산), **blend**(폭 배율), **groups**(UI 두께 배율).
   필드 채우기 `fillField` 는 순수 함수(실시간·bake·Node 검증 공유), `buildSegs` 가 뼈 월드→
   그리드 공간 변환·flatten u·cut 중심을 프레임당 1회 계산. 관절 융기(가산 고유)는 관절 쪽 끝
   제어점 r 하향으로 데이터 상쇄. 채널 분리 불변: 길이는 뼈 scale, 두께·형태는 살 DNA
   (DNA 는 뼈 상태를 읽기만).
   표시 3-상태 `ui.flesh`: **off** / **live**(실시간 MC, 튜닝용) / **baked**(구운 스킨드 메시).
   **bake**(`fleshbake.js`): 레스트 포즈에서 res 160 으로 1회 폴리곤화 → 0.5mm 정점 용접 →
   Taubin 스무딩(λ0.5/μ−0.53×10, 순 Laplacian 수축 금지) → **필드와 동일 수식**(segContribAt)
   으로 캡슐 기여도 상위 4개 스키닝 가중치 → `THREE.SkinnedMesh`. 재생 중 필드 계산 0,
   시간적 앨리어싱 0. 관절 이중 바인딩은 필드 겹침에서 자동으로 나온다. DNA·본 비율 변경은
   400ms 디바운스로 재굽기(live 는 즉시). 애니메이션-only FBX 의 내장 리그는 비율이 실제
   캐릭터와 다름 — with-skin 캐릭터에 리타깃해서 봐야 정상 비율. 설계 전체 → [FLESH-PLAN.md](FLESH-PLAN.md).

## 파일 맵

- `index.html` — HUD/패널(캐릭터·애니메이션·본 비율·표시)/드롭존 + CSS
- `src/main.js` — 뷰어 전부 (슬롯·선택·리타깃·본 비율)
- `src/mcflesh.js` — SDF 살 실시간 폴리곤화. `fillField`(순수)·`buildSegs`·`segContribAt`
  export, `McFlesh.update(ch, simpleName)`. 볼륨은 원점 중심(슬롯 x 오프셋 보정).
- `src/fleshdna.js` — 살 DNA 스키마·PCHIP·`compileDna`(LUT)·lerp/mutate/serialize (three 비의존).
- `src/fleshbake.js` — 레스트 포즈 bake → 용접·Taubin·자동 스키닝 → `THREE.SkinnedMesh`.
- `tools/flesh-verify.mjs` — 살 Node **수치** 검증(§10.1 #1~#9). `npm run flesh:check`.
- `tools/flesh-visualize.mjs` — 살 Node **이미지** 검증(실루엣·프로파일 곡선 SVG/PNG). `npm run flesh:viz`.
  → `npm run verify` 가 둘 다 실행(수치 + 캡처). 캡처는 `docs/flesh-silhouette.*`·`docs/flesh-profiles.svg`.
- `public/assets/anim/*.fbx` — 동봉 Mixamo 애니메이션 샘플(walk/run/idle/jump/attack: 메시
  없는 애니메이션 전용, samba: 메시 포함). 리타깃 소스로만 쓴다(베이스 캐릭터는 아래 character/).
- `public/assets/character/X Bot.fbx`·`Y Bot.fbx` — **남·여 베이스** = Mixamo X Bot·Y Bot
  with-skin. 각 2벌 스킨 메시(Surface+Joints). Mixamo 무료 라이선스.
- `legacy/` — v1 전체 (src/eval/index.html/LOFT-PLAN/VERTEX-PLAN/README). 참고용, import 금지.
  (루트의 `eval/` 잔재는 샌드박스 권한 문제로 못 지운 복사본 — 지워도 된다.)

## 검증

2026-07-12 v4.2 hips 변위 전체 리타깃, Node — 실물 main.js 를 DOM/WebGL 스텁으로 구동.

- 리타깃 충실도: 소스 클립 대비 (hips·양발·머리) 월드 변위 오차 실측. hips 수평(x/z)
  최대 오차가 **공격 0.477→0.005m, 삼바 0.574→0.002m, 걷기 0.097→0.002m** (v4.1→v4.2).
  잔여 발/머리 오차 0.03~0.19m 는 소스 리그와 베이스 캐릭터의 사지 비율 차이에서 오는
  회전 리타깃 고유 한계(전체 키 비율 hScale 하나로만 스케일하므로).
- 부트스트랩: X Bot 한 명 + 대기 즉시 적용(1프레임 T-포즈 없음), 접지 min.y=0, 중심 x≈0.
- 6클립 × 양 모델(+X Bot 재전환), 크로스페이드 정착 후 뼈 bbox 최저점 min.y 의
  [최저, 최고] 실측 (root x/z 드리프트 = 0.0000 전부, 침하 최대 -0.01):
  대기 [0, 0], 공격 [0, 0.03], 걷기 [0, 0.05], 삼바 [-0.01, 0.02], 뛰기 [0, 0.17],
  점프 [0, 1.09]. hips 흔들림 범위(=체중 이동 전달): 삼바 x 0.86m(소스 ±42cm×hScale 와
  일치), 공격 z 0.49m(전진 런지), 대기 ~0.
- (브라우저 육안 확인은 `npm run dev` 후 사용자 확인 필요 — 샌드박스는 headless Chromium
  다운로드가 차단돼 Node 검증으로 대체.)
