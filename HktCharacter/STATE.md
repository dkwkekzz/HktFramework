# STATE.md — HktCharacter 현재 상태

> 이 문서만 보면 현재 상태와 다음 할 일이 명확해야 한다. 상세는 [docs/](docs/) 링크로.

**현재 버전: v5 (2026-07-13)** — v4.2 뷰어 + **살 스타일링(원본 메시 워프)**. 캐릭터 한 명 +
리타깃 애니메이션 + 본 비율 편집 + 살 DNA 로 실루엣 조각(두께=살, 길이=뼈 채널 분리).
상세 경위 → [docs/HISTORY.md](docs/HISTORY.md), 구조 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
살 설계 → [docs/FLESH-PLAN.md](docs/FLESH-PLAN.md).

## 지금 되는 것

- 캐릭터 선택은 **드롭다운**(저장소 모델 X Bot·Y Bot + 📁 FBX 임포트) — 현재 로드 모델 상단 표시.
  임의 with-skin FBX 는 임포트/드롭으로 교체.
- 6개 Mixamo 클립(대기·공격·걷기·삼바·뛰기·점프) 자체 구현 월드 공간 리타깃 재생.
- 본 비율 슬라이더(키·머리·몸통·어깨·팔·다리·손), 발 접지 유지.
- 애니메이션-only FBX 드롭 → 현재 캐릭터에 리타깃.
- **살(flesh)** — 패널 "살" 섹션의 `살 · off/warp/live` 버튼. **warp**(1차): 원본 스킨
  메시를 DNA 대로 실루엣 변형(바인드 1회 귀속 → 이후 GPU 스키닝, 프레임 비용 0).
  그룹 두께 6슬라이더 + 살 강도 α + 프리셋(humanlike·slim·bulk·stylized-f·robot) +
  모프 슬라이더 + 변이 버튼 + DNA JSON 내보내기/가져오기(.dna.json 드롭). **live**: SDF
  MarchingCubes 실시간(뼈-only 리그 폴백/프리뷰).

## 최근 변경 (핵심만)

- **v5 살 스타일링** — FLESH-PLAN 1차 경로(F1·W1·W2·F4) 구현. `src/fleshdna.js`(DNA 스키마·
  PCHIP·compile/lerp/mutate/serialize, three 비의존), `src/fleshwarp.js`(정점 귀속·이방성
  베이스라인·비율 워프·bump/cut 변위장), `src/mcflesh.js`(RADII→DNA, `fillField` 순수 함수
  추출, 부모 키 매칭). 두께=살 DNA·길이=뼈 scale 채널 분리 — STATE "본 비율 개선" 두께 문제 흡수.

- **UI** 캐릭터 선택을 남/여 버튼 → **드롭다운(저장소 모델 + FBX 임포트)** + 현재 로드 모델
  표시로 교체. 저장소 모델은 `MODELS` 배열 한 줄로 확장.
- **v4.2** hips 변위(x/y/z) 전체 리타깃 — 체중 이동·런지 전달로 중심 흔들림 제거. 제자리
  유지는 x/z 선형 순이동만 detrend. → hips 수평 오차 전 클립 ≤0.005m.
- **v4** 접지를 클립별 사전 측정으로 전환 — 재생 중 중심 틀어짐·부유 버그 수정.
- **v3.2** 교차 트윈 리그(X/Y Bot) T-포즈 멈춤 수정 — 구동 뼈를 DFS-첫 뼈로 선정, 자체 `bakeClip`.

## 검증 현황

- **살 (v5, Node)**: `npm run verify` — **24/24 PASS**. PCHIP 오버슈트 0, 그룹 배율 정확,
  fillField iso 폭/flatten/bump, 워프 항등(기본 DNA·α=1 편차 0)·배율(leg×1.3 정확)·연속성
  (무릎 경계 점프 0.1~0.3cm)·UV/index 불변 — X Bot·Y Bot 양쪽. 실루엣 캡처 `npm run shot`
  → `tools/flesh-shot.png`(원본 회색↔워프 시안 오버레이, front/side × 프리셋 4열).
- 리타깃(v4.2): hips 수평 최대 오차 공격 0.005·삼바 0.002·걷기 0.002m (실물 main.js DOM/WebGL 스텁).
- 접지 min.y·드리프트·hips 흔들림 범위 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#검증) 참조.
- ⚠️ **브라우저 육안 확인은 사용자 몫** — 샌드박스 headless Chromium 차단(살 6클립 관절 파탄
  여부·삼바 회전 시 flatten 방향 추적은 `npm run dev` 확인 필요).

## 다음 작업 (사용자와 논의 후)

- [x] **살 스타일링 (v5 트랙) 1차 경로** — F1·W1·W2·F4 구현 완료(2026-07-13). 원본 메시
      워프 + DNA 프리셋/보간/변이/입출력. 검증 24/24. 설계 → [docs/FLESH-PLAN.md](docs/FLESH-PLAN.md).
- [ ] **살 육안 튜닝** — `npm run dev` 로 6클립 재생·삼바 회전에서 관절 파탄·flatten 추적
      확인 후 §5.4 기본 DNA 수치를 최종값으로 다듬기. bump 강도(가슴·둔부) 미세 조정.
- [ ] **살 SDF 폴백(F2·F3·F5)** — 뼈-only 리그(크리처, 애니메이션-only FBX)에서 살 메시가
      필요해질 때. bake & 자동 스키닝. DNA 는 두 경로 공유라 그대로 재사용.
- [ ] **본 비율 개선** — 축 방향(길이만) 스케일 / 좌우 대칭 편집 / 프리셋 저장. (두께 분리는
      살 DNA 가 이미 담당 — 그룹 균등 scale 의 두께 문제는 살 채널로 흡수됨)
- [ ] **로스터 확장** — 캐릭터 3인 이상, 클립 블렌딩/전환 개선.
- [ ] **UE5 연동 방향** 정리.
- [ ] 리타깃 잔여 발/머리 오차(0.03~0.19m) — 소스↔베이스 사지 비율 차이에서 오는 회전 리타깃
      고유 한계. 개선하려면 부위별 스케일 도입 검토.

## 알려진 한계

- 리타깃 발/머리 오차는 전체 키 비율(hScale) 하나로만 스케일해서 남음(위 다음 작업 참조).
- SDF 살(`src/mcflesh.js`)은 실험 모듈 — 고정 격자 재샘플링 시간적 앨리어싱, 애니메이션-only
  리그는 비율 상이. 상세 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- 루트 `eval/` 잔재는 샌드박스 권한 문제로 못 지운 복사본 — 지워도 된다.
