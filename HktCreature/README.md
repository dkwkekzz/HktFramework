# HktCreature

오픈월드 MMORPG 용 **창발형 3D 크리처**를 AI-only 파이프라인으로 만드는 실험 트랙.

**테제: 스켈레톤은 코드로 짓고, 그 위에 살만 붙이고, Mixamo 애니메이션을 그대로 구동한다.**

- 🦴 **코드-리그** — Mixamo 표준 리그(57본)의 rest 계층을 실측한 템플릿에서 스켈레톤을
  절차 생성한다. 아티스트 FBX 스킨을 로드하지 않는다.
- 🩸 **절차 살** — 뼈 세그먼트마다 캡슐을 세워 skinning 으로 묶은 SkinnedMesh. 실루엣은
  **게놈 숫자 벡터**에서 창발한다("모양을 그리는" 에셋 없음).
- 🎬 **Mixamo 그대로** — 뼈 이름·bind 포즈가 원본과 같아 Mixamo 클립이 리타깃 없이 구동
  (이름 접두사 정규화만). 걷기/뛰기/대기 동봉 + FBX 드롭.

## 실행

```bash
npm install
npm run dev       # http://localhost:5173
npm run verify    # 브라우저 없이 코어 검증 (Node)
```

무대에 크리처 한 명이 뜬다. 애니메이션 버튼으로 Mixamo 클립 재생, 게놈/살 슬라이더로
체형을 바꾸면 리그+살이 즉시 재생성된다. Mixamo 애니메이션 FBX 를 드롭하면 그대로 재생.

설계 원칙은 [CLAUDE.md](CLAUDE.md), 현황은 [STATE.md](STATE.md).

애니메이션 샘플은 [Mixamo](https://www.mixamo.com) 무료 라이선스.
