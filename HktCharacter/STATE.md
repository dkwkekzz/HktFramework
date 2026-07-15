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

- **살 게놈 (v5 착수)** — SDF 살을 [genome-encoding-principles](genome-encoding-principles.md)
  대로 인코딩. `src/fleshdna.js`(순수 게놈·디코더), `mcflesh.js`(RADII→게놈 LUT 소비),
  `tools/flesh-verify.mjs`(4법칙 감사, **전 항목 합격**), 패널 "살 게놈" UI + `__hkt` API.
  위상=로드 스켈레톤(게놈 밖 고정) → 폐쇄성 구조 보장. 설계·검증: [docs/GENOME.md](docs/GENOME.md).

- **UI** 캐릭터 선택을 남/여 버튼 → **드롭다운(저장소 모델 + FBX 임포트)** + 현재 로드 모델
  표시로 교체. 저장소 모델은 `MODELS` 배열 한 줄로 확장.
- **v4.2** hips 변위(x/y/z) 전체 리타깃 — 체중 이동·런지 전달로 중심 흔들림 제거. 제자리
  유지는 x/z 선형 순이동만 detrend. → hips 수평 오차 전 클립 ≤0.005m.
- **v4** 접지를 클립별 사전 측정으로 전환 — 재생 중 중심 틀어짐·부유 버그 수정.
- **v3.2** 교차 트윈 리그(X/Y Bot) T-포즈 멈춤 수정 — 구동 뼈를 DFS-첫 뼈로 선정, 자체 `bakeClip`.

## 검증 현황

- **살 게놈 4법칙** (`node tools/flesh-verify.mjs`, 결정론적): 폐쇄성 1.0 · 지역성 ρ 0.717 ·
  조합성 1.50 · 다양성 6.76 · 형태→기능(체력↑속도↓) · 채널분리 → **전 항목 합격**.
  카드 `tools/flesh-audit.svg`. `npx vite build` 통과.
- hips 수평 최대 오차(v4.2): 공격 0.005 · 삼바 0.002 · 걷기 0.002m (실물 main.js 스텁 구동).
- 접지 min.y·드리프트·hips 흔들림 범위 실측치 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#검증) 참조.
- ⚠️ **브라우저 육안 확인은 사용자 몫** — 샌드박스 headless Chromium 차단 (살 게놈 UI/실루엣).

## 다음 작업 (사용자와 논의 후)

- [~] **살 스타일링 (v5 트랙)** — 설계 완료: [docs/FLESH-PLAN.md](docs/FLESH-PLAN.md).
      **게놈 인코딩 착수분 완료**(위 최근 변경 · [docs/GENOME.md](docs/GENOME.md)) — SDF 경로에
      살 게놈 + 4법칙 감사. 남은 것: flatten/bump 을 형상에 반영, 프리셋·보간 UI, 워프(Phase W).
      1차 경로는 **원본 메시 워프**(SDF 단독으로는 정상 형태가 안 나온다는 판단):
      살 DNA 채널(F1) → 메시 워프 코어(W1) → 워프 어휘 flatten·bump(W2) → 프리셋·보간·
      변이(F4). SDF→MC 직접 생성(F2·F3)은 뼈-only 리그용 폴백으로 강등. 두께는 살 DNA,
      길이는 뼈 scale 로 채널 분리 — 아래 "본 비율 개선"의 두께 문제도 이 트랙이 흡수한다.
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
