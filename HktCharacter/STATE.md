# STATE.md — HktCharacter 현재 상태

> 이 문서만 보면 현재 상태와 다음 할 일이 명확해야 한다. 상세는 [docs/](docs/) 링크로.

**현재 버전: v4.2 (2026-07-12)** — 미니멀 FBX 뷰어. 캐릭터 한 명 + 리타깃 애니메이션 + 본 비율 편집.
동작 안정 단계. 상세 경위 → [docs/HISTORY.md](docs/HISTORY.md), 구조 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 지금 되는 것

- 캐릭터 선택은 **드롭다운**(저장소 모델 X Bot·Y Bot + 📁 FBX 임포트) — 현재 로드 모델 상단 표시.
  임의 with-skin FBX 는 임포트/드롭으로 교체.
- 6개 Mixamo 클립(대기·공격·걷기·삼바·뛰기·점프) 자체 구현 월드 공간 리타깃 재생.
- 본 비율 슬라이더(키·머리·몸통·어깨·팔·다리·손), 발 접지 유지.
- 애니메이션-only FBX 드롭 → 현재 캐릭터에 리타깃.

## 최근 변경 (핵심만)

- **UI** 캐릭터 선택을 남/여 버튼 → **드롭다운(저장소 모델 + FBX 임포트)** + 현재 로드 모델
  표시로 교체. 저장소 모델은 `MODELS` 배열 한 줄로 확장.
- **v4.2** hips 변위(x/y/z) 전체 리타깃 — 체중 이동·런지 전달로 중심 흔들림 제거. 제자리
  유지는 x/z 선형 순이동만 detrend. → hips 수평 오차 전 클립 ≤0.005m.
- **v4** 접지를 클립별 사전 측정으로 전환 — 재생 중 중심 틀어짐·부유 버그 수정.
- **v3.2** 교차 트윈 리그(X/Y Bot) T-포즈 멈춤 수정 — 구동 뼈를 DFS-첫 뼈로 선정, 자체 `bakeClip`.

## 검증 현황 (v4.2, Node)

- hips 수평 최대 오차: 공격 0.005 · 삼바 0.002 · 걷기 0.002m (실물 main.js 를 DOM/WebGL 스텁 구동).
- 접지 min.y·드리프트·hips 흔들림 범위 실측치 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#검증) 참조.
- ⚠️ **브라우저 육안 확인은 사용자 몫** — 샌드박스 headless Chromium 차단.

## 다음 작업 (사용자와 논의 후)

- [ ] **SDF 살 스타일링 (v5 트랙)** — 설계 완료: [docs/FLESH-PLAN.md](docs/FLESH-PLAN.md).
      - [x] **F1** 살 DNA 채널 + 두께 슬라이더 — `src/fleshdna.js` 신규(스키마·PCHIP·compile),
        `mcflesh.js` 를 `fillField`(순수)·`buildSegs` 로 재구성, `update(ch, simpleName)` 로 변경,
        살 UI 섹션·`__hkt` 확장. `tools/flesh-verify.mjs` #1·#2 PASS(등반지름 폭차 0cm,
        인접쌍 ≤복셀, arm=1.3 정확). **육안 확인 필요**(`npm run dev`).
      - [x] **F2** 프로파일 곡선(PCHIP)·flatten(타원 단면)·cut(구 감산) + 기본 인간형 DNA
        (§5.4 표). 필드 수학은 F1 에 선반영, F2 는 `defaultDna` 를 곡선 인간형으로 교체.
        verify #3~6 PASS(제어점 통과·오버슈트 0, leg t=0.35 폭 6.10cm≈6.20, flatten u/v비 0.598≈0.6,
        cut 중심 감소·원거리 불변). **육안 확인 필요**.
      - [ ] **F3** bake & 자동 스키닝. [ ] **F4** 프리셋·보간·변이.
      두께는 살 DNA, 길이는 뼈 scale 로 채널 분리 — 아래 "본 비율 개선"의 두께 문제도 흡수.
- [ ] **본 비율 개선** — 현재 그룹 균등 scale 은 팔·다리 두께도 같이 커짐. 축 방향(길이만)
      스케일 / 좌우 대칭 편집 / 프리셋 저장 검토. (두께 분리는 FLESH-PLAN F1 이 담당)
- [ ] **로스터 확장** — 캐릭터 3인 이상, 클립 블렌딩/전환 개선.
- [ ] **UE5 연동 방향** 정리.
- [ ] 리타깃 잔여 발/머리 오차(0.03~0.19m) — 소스↔베이스 사지 비율 차이에서 오는 회전 리타깃
      고유 한계. 개선하려면 부위별 스케일 도입 검토.

## 알려진 한계

- 리타깃 발/머리 오차는 전체 키 비율(hScale) 하나로만 스케일해서 남음(위 다음 작업 참조).
- SDF 살(`src/mcflesh.js`)은 실험 모듈 — 고정 격자 재샘플링 시간적 앨리어싱, 애니메이션-only
  리그는 비율 상이. 상세 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- 루트 `eval/` 잔재는 샌드박스 권한 문제로 못 지운 복사본 — 지워도 된다.
