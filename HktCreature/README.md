# HktCreature

오픈월드 MMORPG 용 **창발형 3D 크리처**를 AI-only 파이프라인으로 만드는 실험 트랙.

**테제: 기본 스켈레톤을 제대로 로드하고, 그 위에 절차 살만 붙이고, Mixamo 애니메이션으로 구동한다.**

- 🦴 **로드한 베이스 스켈레톤** — Mixamo 베이스(X Bot 남/Y Bot 여)를 로드해 구동 뼈를 선정한다
  (HktCharacter 로더 방식 — 스킨 2벌이 교차된 트윈 리그에서 계층 등뼈를 고른다). 실제 리그·비율을 그대로.
- 🩸 **절차 살** — 로드한 뼈 세그먼트마다 캡슐을 세워 skinning 으로 묶은 SkinnedMesh. 아티스트
  스킨은 숨기고 살을 우리가 기른다 — "모양을 그리는" 에셋 없이 실루엣이 파라미터에서 창발한다.
- 🎬 **Mixamo 리타깃** — 클립을 월드 공간 리타깃(`bakeClip`, 타깃 뼈 불변)해 로드 리그에 굽는다.
  걷기/뛰기/대기 동봉.

## 실행

```bash
npm install
npm run dev       # http://localhost:5173
npm run check     # 검증 게이트: verify(데이터) + build + shot(픽셀/스크린샷)
npm run shot      # 실제 브라우저 렌더 + 자동 판정 → test/out/*.png
```

> 이 트랙의 규칙: **모든 변경은 `npm run check` 로 캡처까지 검증**하고, 결과 보고 시
> `test/out/*.png` 를 첨부한다. "데이터만 통과, 화면은 비었다" 회귀를 픽셀로 막는다.

무대에 크리처 한 명이 뜬다. 애니메이션 버튼으로 Mixamo 클립 재생, 게놈/살 슬라이더로
체형을 바꾸면 리그+살이 즉시 재생성된다. Mixamo 애니메이션 FBX 를 드롭하면 그대로 재생.

설계 원칙은 [CLAUDE.md](CLAUDE.md), 현황은 [STATE.md](STATE.md).

애니메이션 샘플은 [Mixamo](https://www.mixamo.com) 무료 라이선스.
