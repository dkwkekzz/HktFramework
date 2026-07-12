# CLAUDE.md — HktCharacter

> **리셋 v2 (2026-07)**: SDF flesh 접근(스켈레톤→SDF 살 생성)은 제대로 된 캐릭터 품질에
> 도달하지 못해 폐기. 전체 코드는 `legacy/` 에 보관. 지금은 **미니멀 FBX 뷰어**에서 재출발.
>
> **v3 (2026-07)**: 뷰어를 **캐릭터 선택 + 애니메이션 + 본 비율** 도구로 확장. 기본 화면에
> 남·여 두 캐릭터를 나란히 세우고, 클릭/버튼으로 선택한 캐릭터에만 애니메이션을 리타깃 재생한다.
>
> **v3.1 (2026-07)**: 베이스를 Mixamo **X Bot(남)·Y Bot(여)** 로 교체. raw mixamorig 리그는 뼈
> rest 축이 비-단위라 클립을 로컬 quaternion 으로 직접 얹으면 팔이 T-포즈로 남아 →
> `SkeletonUtils.retargetClip`(월드 공간 리타깃)으로 전환(옵션 `preservePosition:false`). 캐릭터
> 카드의 **📁 교체** 버튼(또는 슬롯 선택 후 FBX 드롭)으로 모델을 쉽게 갈아끼운다.
>
> **v3.2 (2026-07-11)**: 뷰어 붕괴 수리. `SkeletonUtils.retargetClip` **폐기** — bake 중 타깃
> 뼈 상태를 오염시켜(skeleton.pose+decompose 잔여) 본이 흩어지고, Y Bot 처럼 계층 등뼈가
> 트윈(Joints) 쪽인 리그에선 바인드 포즈가 그대로 구워져 T-포즈로 멈췄다. → **순수 월드 공간
> 리타깃 자체 구현**(`bakeClip`: 타깃 뼈를 읽지도 쓰지도 않는 순수 계산) + 구동 뼈를 메시
> 소속이 아니라 **계층 순서(DFS-첫 뼈 = 등뼈)** 로 선정. 보조(Joints) 메시도 이제 제거하지
> 않고 함께 애니메이션된다.
>
> **v4 (2026-07-11)**: 화면에 캐릭터 **한 명**만. 모델 버튼(남자 X Bot/여자 Y Bot/📁 임의
> FBX)으로 그 자리를 갈아끼운다. "재생하면 중심이 틀어지고 떠 있다" 버그 수정 — 원인은
> 접지(groundToPose→replant)가 **crossfade 중인 혼합 포즈**를 측정해 root x/y/z 를 옮긴 것.
> → 접지 y 는 클립별로 재생 전 **사전 측정**(measureClipRootY: 임시 믹서로 N 프레임 샘플링,
> 상태 원상복구), root x/z 는 로드 시 1회만 정렬하고 재생 중 불변.
>
> **v4.2 (2026-07-12)**: "재생하면 중심이 고정 안 되고 불안정(Mixamo 웹 대비 확연)" 수정 —
> 원인은 리타깃이 소스 hips 위치에서 **y 만 옮기고 x/z(체중 이동·런지·스텝)를 바인드에
> 고정**한 것. 골반이 못 움직인 만큼 발이 반대로 미끄러져 전신이 흔들려 보였다(실측: 공격
> 최대 0.56m, 삼바 0.57m, 걷기 0.10m 수평 오차 — 대기만 0.004m 라 멀쩡해 보였음). →
> hips **변위(x/y/z) 전체**를 hScale 로 스케일해 전달하되, 이동형 클립 대비 x/z 의 선형
> 순이동만 제거(detrend)해 제자리 재생을 유지. 수정 후 hips 수평 오차 전 클립 ≤0.005m.

## 목표

오픈월드 mmorpg에서 사용할 창발할 수 있고 ai only 제작 파이프라인으로 애니메이션 가능한 3d 모델을 제작한다.

## v1(SDF flesh)에서 배운 것 / 버린 이유

- 뼈에서 살을 절차 생성(SDF loft + 정점 메시 투영)하는 접근은 실루엣 지표는 통과해도
  음영·이음새 품질이 캐릭터로 쓸 수준에 못 미쳤다 (fit 파이프라인 유지비도 과대).
- v1 뷰어의 두 가지 착시(이번 리셋의 직접 계기):
  - **"메시가 안 보인다"** — FBX 를 로드해도 뼈만 추출하고 스킨 메시를 씬에 추가하지 않았다.
  - **"본 길이가 어색하다/손가락이 길다"** — 본 표시가 실제 스켈레톤이 아니라 SDF 세그먼트
    (가상 뼈·볼륨 헬퍼 포함)를 선으로 그린 것이었다.
- v2 는 이 두 가지를 정면으로 고친다: 메시는 FBX 그대로, 본은 `THREE.SkeletonHelper`.

## 구조 (전부 `src/main.js` 하나)

1. **씬** — three.js + OrbitControls, 헤미/디렉셔널 라이트, 그리드, 선택 표시 링.
2. **슬롯** (`SLOTS.main` 하나, x=0) — 화면에 캐릭터 한 명. `MODELS`(X Bot=남 / Y Bot=여)
   버튼 또는 📁 교체(임의 with-skin FBX)로 `switchModel` 이 그 자리를 갈아끼운다. 슬롯의
   `ch`(root·meshes·bones(구동 뼈)·boneMap·allBones·mixer·clips·actions·helper·baseScale·
   props·bindLocalQ·bindWorldQ·staticParentQ·primeMesh). `bootstrap()` 는 X Bot 을 로드해
   **대기**로 세운다.
3. **로드/정규화** — `makeCh`: Mixamo with-skin FBX 는 스킨 메시 2벌(Surface+Joints)의
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
5. **SDF 살** (`src/mcflesh.js`, 실험) — 뼈마다 캡슐 세그먼트, Wyvill 밀도
   `(1-d²/R²)³` (R=BLEND(2.5)×반지름, 부모→자식 반지름 테이퍼)를 필드에 가산 →
   `THREE.MarchingCubes`(res 64, isolation ≈0.593 = 캡슐 반지름 지점)로 매 프레임
   폴리곤화. 세그먼트 bbox 안 복셀만 채워 실시간(~7ms). 리그 2벌 FBX 는 simpleName
   중복 세그먼트를 스킵. 손가락 생략, `end$` 리프 본은 0.02 로 가늘게(머리 필통 방지).
   반지름 테이블은 `RADII`(simpleName 정규식 매칭).
   **알려진 한계**: 고정 격자 재샘플링이라 움직임에 표면이 미세하게 떨림(시간적
   앨리어싱) — res·BLEND 로 완화만 가능. 애니메이션-only FBX 의 내장 리그는 비율이
   실제 캐릭터와 다름(예: walk 리그 손바닥→중지1 20.9cm, samba 3.4cm) — with-skin
   캐릭터에 리타깃해서 봐야 정상 비율.

## 파일 맵

- `index.html` — HUD/패널(캐릭터·애니메이션·본 비율·표시)/드롭존 + CSS
- `src/main.js` — 뷰어 전부 (슬롯·선택·리타깃·본 비율)
- `src/mcflesh.js` — SDF 살(MarchingCubes) 실험 모듈. `update(bones, simpleName, offsetX)` —
  볼륨은 원점 중심이라 선택 캐릭터의 슬롯 x 를 빼서 정렬.
- `public/assets/anim/*.fbx` — 동봉 Mixamo 애니메이션 샘플(walk/run/idle/jump/attack: 메시
  없는 애니메이션 전용, samba: 메시 포함). 리타깃 소스로만 쓴다(베이스 캐릭터는 아래 character/).
- `public/assets/character/X Bot.fbx`·`Y Bot.fbx` — **남·여 베이스** = Mixamo X Bot·Y Bot
  with-skin. 각 2벌 스킨 메시(Surface+Joints). Mixamo 무료 라이선스.
- `legacy/` — v1 전체 (src/eval/index.html/LOFT-PLAN/VERTEX-PLAN/README). 참고용, import 금지.
  (루트의 `eval/` 잔재는 샌드박스 권한 문제로 못 지운 복사본 — 지워도 된다.)

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
```

기본 화면에 캐릭터 한 명이 뜬다. 모델 버튼(남자/여자)이나 📁 교체(임의 with-skin FBX)로
그 자리를 갈아끼우고, 애니메이션 버튼으로 재생. 본 비율 슬라이더로 뼈 스케일 조절.

## 검증 (2026-07-12 v4.2 hips 변위 전체 리타깃, Node — 실물 main.js 를 DOM/WebGL 스텁으로 구동)

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

## 알려진 한계

- (v3.2 에서 해소) ~~Y Bot 손가락 정점 조각 / T-포즈 멈춤~~ — 교차 트윈 리그 문제는 구동 뼈를
  계층 등뼈(DFS-첫 뼈)로 선정하면서 해결. 새 with-skin FBX 가 또 다른 특이 구조라면 `bakeClip`
  의 비매칭 뼈 전파 로직부터 볼 것.

## 다음 후보 (사용자와 논의 후)

- 본 비율: 현재는 그룹 균등 scale(팔·다리는 부모→자식 복합 → 두께도 함께 커짐). 길이만
  늘리는 축 방향 스케일 / 대칭(좌우 동시) 편집 / 프리셋 저장을 검토.
- 캐릭터 3인 이상 로스터, 클립 블렌딩/전환 개선, UE5 연동 방향 정리.

## 설계 결정

- **메시는 FBX 원본을 그대로** — 절차 생성으로 돌아가려면 근거부터.
- 리타깃은 이름 기반, 트랙은 **회전 + hips 위치(변위 x/y/z, x/z 는 순이동 detrend)** —
  본 비율 편집이 뼈 `scale` 채널을, 접지가 root `position` 을 단독 소유한다. hips y 를
  빼면 앉는 동작에서 발이 뜨고 점프가 안 뜨며, x/z 를 빼면 체중 이동이 사라져 발이
  미끄러지고 중심이 흔들린다. 리타깃 bake 는 타깃 상태를 건드리지 않는 순수 계산이어야
  한다(외부 유틸의 상태 오염이 v3.1 붕괴의 원인). 접지는 재생 전 사전 측정만, 재생 중
  재측정 금지.
- 접지·정규화는 스킨 CPU boundingBox(rest 고정)가 아니라 **뼈 월드 bbox** 기준 — 본 비율을
  바꿔도 발이 바닥에 붙는다.
