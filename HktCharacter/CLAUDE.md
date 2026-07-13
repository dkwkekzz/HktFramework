# CLAUDE.md — HktCharacter

프로젝트의 **목표·불변 원칙·작업 방식**만 담는다. 아주 간략하고 왠만하면 변하지 않는다.
현재 진행 상태와 다음 작업은 [STATE.md](STATE.md) 를, 상세 설계는 [docs/](docs/) 를 볼 것.

## 목표

오픈월드 MMORPG 에서 사용할, **창발 가능**하고 **AI-only 제작 파이프라인**으로 애니메이션 가능한
3D 캐릭터를 만든다. 현재는 Mixamo 베이스 FBX 를 로드해 리타깃·본 비율 편집하는 **웹 뷰어**로
재출발한 단계. (three.js / Vite, UE 빌드·타 플러그인과 무관)

## 설계 불변 원칙

작업 중 아래를 깨야 할 것 같으면 근거부터 남기고 [STATE.md](STATE.md) 에 기록한다.

- **리타깃 bake 는 순수 계산** — 타깃 뼈 상태를 읽지도 쓰지도 않는다. 외부 유틸의 상태
  오염이 과거 붕괴의 원인이었다(→ `SkeletonUtils.retargetClip` 폐기, 자체 구현).
- **트랙 채널 분리** — 리타깃은 회전 + hips 위치만, 본 비율은 뼈 `scale` 만, 접지는 root
  `position` 만 단독 소유한다. 서로의 채널을 침범하지 않는다.
- **접지는 재생 전 사전 측정만** — 재생 중 포즈 재측정으로 root 를 옮기는 코드는 금지
  (crossfade 혼합 포즈를 측정하면 중심이 틀어진다).
- **접지·정규화 기준은 뼈 월드 bbox** — 스킨 CPU boundingBox(rest 고정) 아님. 본 비율을
  바꿔도 발이 바닥에 붙는다.
- **골격은 로드하는 것이지 만드는 것이 아니다** — 유일한 골격 소스는 Mixamo 베이스
  FBX(X Bot·Y Bot, 또는 임포트 with-skin FBX)를 `makeCh` 가 로드한 뼈들. 자체 골격
  절차 생성·계층 변경·뼈 개명 금지 (상세 규칙 → [docs/FLESH-PLAN.md](docs/FLESH-PLAN.md) §1.1).

## 작업 방식

- 코드 주석·문서는 **한국어**.
- 한 작업이 끝나면 [STATE.md](STATE.md) 를 갱신한다 — 상세는 별도 문서, STATE 에는 핵심만.
- **검증은 캡처해 직관적으로 보고한다** — 수치 나열로 끝내지 말고, 스크린샷·오버레이·비교
  이미지 등 한눈에 판정 가능한 형태로 결과를 남긴다.
- **시각 검증은 우리가 직접 수행한다 (MUST)** — 이 샌드박스는 headless Chromium 이 **막혀
  있지 않다**: SwiftShader(ANGLE/Vulkan)로 WebGL2 가 돈다. 렌더 결과가 걸린 변경은
  Playwright 로 실제 렌더해 캡처·판정한다(`npm run capture` → `tools/flesh-capture.mjs`,
  살은 `docs/flesh-stylized-f.png`). 순수 계산은 Node 검증(`npm run verify`). **육안 확인을
  사용자에게 떠넘기지 않는다** — "`npm run dev` 로 눈으로 확인해 달라"는 요청은 금지.
  (과거 "headless 차단" 기술은 오판이었다. 2026-07-13 확인.)

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
```

기본 화면에 캐릭터 한 명. 패널 상단 **드롭다운**(저장소 모델 + 📁 FBX 임포트)으로 갈아끼우고
(현재 로드된 모델은 상단에 표시), 애니메이션 버튼으로 재생, 본 비율 슬라이더로 뼈 스케일 조절.

## 문서 인덱스

| 문서 | 내용 |
|---|---|
| [STATE.md](STATE.md) | **현재 상태 + 다음 작업** (이 문서만 보면 현황 파악) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 구조·리타깃/접지 원리·파일 맵 (상세) |
| [docs/FLESH-PLAN.md](docs/FLESH-PLAN.md) | SDF 살 스타일링 설계 (v5 트랙, 구현 전) |
| [docs/HISTORY.md](docs/HISTORY.md) | 리셋·버전 히스토리 (v2 → v4.2) |
| `legacy/` | v1 (SDF flesh) 전체 보관. 참고용, import 금지. |
