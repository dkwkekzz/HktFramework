# CLAUDE.md — HktCharacter

> **리셋 v2 (2026-07)**: SDF flesh 접근(스켈레톤→SDF 살 생성)은 제대로 된 캐릭터 품질에
> 도달하지 못해 폐기. 전체 코드는 `legacy/` 에 보관. 지금은 **미니멀 FBX 뷰어**에서 재출발.
>
> **v3 (2026-07)**: 뷰어를 **캐릭터 선택 + 애니메이션 + 본 비율** 도구로 확장. 기본 화면에
> 남(X-Bot)·여(Eve) 두 캐릭터를 나란히 세우고, 클릭/버튼으로 선택한 캐릭터에만 애니메이션을
> 리타깃 재생한다. 두 리그의 뼈 이름은 `simpleName` 으로 정규화돼 같은 클립이 양쪽에 붙는다.

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
2. **슬롯** (`SLOTS` = male/female) — 화면에 항상 두 캐릭터. 각 슬롯은 `ch`(캐릭터 상태:
   root·meshes·bones·boneMap·mixer·clips·actions·helper·baseScale·props)를 가지고 좌우
   (`x=±0.62`)로 배치된다. `bootstrap()` 가 두 베이스(samba.fbx=남, female.fbx=여)를 로드해
   둘 다 **대기**로 세운다.
3. **로드/정규화** — `makeCh` 가 메시를 씬에 올리고(`frustumCulled=false` — 스킨 메시가
   애니메이션으로 바운드를 벗어나 사라지는 고전 버그 방지), `computeBaseScale`(키 1.7m 기준)
   + `applyProps`(본 스케일 → root 스케일 → 발 접지). 접지·정규화는 **스킨 CPU boundingBox 가
   아니라 뼈 월드 위치 bbox**(`boneBox`)로 — 본 스케일/애니메이션을 반영한다.
4. **리타깃** (`retargetClip(clip, ch)`) — 트랙 노드명을 `simpleName` 으로 정규화해 대상
   캐릭터 뼈에 매핑. **position 은 Hips 만, scale 트랙은 버린다**(회전만 옮겨 뼈 길이가 달라도
   안 늘어나고, scale 채널은 본 비율 편집이 소유). `simpleName`: `"mixamorig:LeftHand"` /
   `"mixamorigLeftHand"`(콜론 벗긴 내보내기) / `"LeftHand"`(무접두어 리그, 예: Eve) → 모두
   `lefthand`. 원본 클립은 파일당 1회 파싱해 `rawClipCache`, 슬롯별로 리타깃/액션.
5. **선택** — 캐릭터 버튼 + 3D 클릭(레이캐스트, 드래그는 제외). 선택된 슬롯에만 애니메이션
   버튼/본 비율 슬라이더가 작동하고 링이 발밑으로 이동.
6. **본 비율** (`PROP_GROUPS`) — 키(root)·머리·몸통·어깨너비·팔·다리·손을 `simpleName` 정규식에
   걸리는 뼈 `scale` 로 조절. 값 변경 시 `applyProps` → `replant`(발 접지 유지). 슬라이더는
   **선택 캐릭터별** 상태(`ch.props`)를 반영.
7. **드롭존** — with-skin FBX 는 **선택된 슬롯**을 교체(여자 슬롯 선택 후 Mixamo 여성 FBX 드롭
   = 그대로 "연결"), 애니메이션-only 는 선택 캐릭터에 리타깃.
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
- `public/assets/anim/*.fbx` — 동봉 Mixamo 애니메이션 샘플. **주의: samba.fbx 는 메시 포함**
  (Mixamo "Alpha"/X-Bot = 남자 베이스, 뼈 119·메시 2), 나머지(walk/run/idle/jump/attack)는
  애니메이션 전용(메시 없음).
- `public/assets/character/female.fbx` — **여자 베이스** = Mixamo "Eve"(J.Gonzales) with-skin
  (메시 1·뼈 65, 무접두어 리그 → `simpleName` 으로 남자 리그와 동일 매칭). Mixamo 무료 라이선스.
- `legacy/` — v1 전체 (src/eval/index.html/LOFT-PLAN/VERTEX-PLAN/README). 참고용, import 금지.
  (루트의 `eval/` 잔재는 샌드박스 권한 문제로 못 지운 복사본 — 지워도 된다.)

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
```

기본 화면에 남/여 두 캐릭터가 뜬다. 캐릭터를 클릭(또는 남자/여자 버튼)해 선택 → 애니메이션
버튼으로 그 캐릭터만 재생. 본 비율 슬라이더로 뼈 스케일 조절. 여성 캐릭터를 교체하려면 여자
슬롯을 선택하고 Mixamo with-skin FBX 를 드롭.

## 검증 (2026-07-11, headless Chromium)

- 두 베이스 로드: 남(samba.fbx, 메시 2·뼈 119·`mixamorig` 접두어) + 여(female.fbx=Eve,
  메시 1·뼈 65·무접두어) 동시 렌더, 콘솔 에러 0.
- 선택+리타깃: 여자 선택 → 삼바(X-Bot 리그 클립)가 Eve 리그에 매핑돼 춤, 남자는 대기 유지
  (독립 재생). 남자 선택 → 걷기.
- 본 비율: 슬라이더(머리 1.6·팔 1.3·다리 1.3) → 뼈 scale 반영 + 발 접지 유지, 초기화 복원.
- 스크린샷 4종 눈 검증 완료.

## 다음 후보 (사용자와 논의 후)

- 본 비율: 현재는 그룹 균등 scale(팔·다리는 부모→자식 복합 → 두께도 함께 커짐). 길이만
  늘리는 축 방향 스케일 / 대칭(좌우 동시) 편집 / 프리셋 저장을 검토.
- 캐릭터 3인 이상 로스터, 클립 블렌딩/전환 개선, UE5 연동 방향 정리.

## 설계 결정

- **메시는 FBX 원본을 그대로** — 절차 생성으로 돌아가려면 근거부터.
- 리타깃은 이름 기반 + 회전 전용(Hips position 예외) 유지. scale 트랙은 버려 본 비율 편집이
  뼈 `scale` 채널을 단독 소유한다.
- 접지·정규화는 스킨 CPU boundingBox(rest 고정)가 아니라 **뼈 월드 bbox** 기준 — 본 비율을
  바꿔도 발이 바닥에 붙는다.
