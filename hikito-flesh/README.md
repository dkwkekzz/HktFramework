# hikito-flesh

Skeleton → Flesh: rig-agnostic SDF flesh 렌더러 (Mixamo 리그 지원).

뼈대를 먼저 정의하고 살을 뼈대의 순수 함수(SDF)로 자라게 한다 —
모델링·리깅·스키닝을 한 번에. 뼈대를 움직이면 살이 자동으로 따라온다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

## Mixamo 사용

1. [mixamo.com](https://www.mixamo.com) 에서 캐릭터 + 애니메이션 선택
2. **Download → Format: FBX Binary** 로 받기
3. 우측 패널 **Mixamo 불러오기** 드롭존에 파일을 드롭

built-in 리그 + 절차적 클립(walk/idle/wave)은 파일 없이도 즉시 동작.

## 조작

- 드래그: 회전 · 휠: 줌
- 패널: 모션 선택 / 속도 / 뭉툭함(smin) / 통통함 / 손가락 / 뼈대 보기

에이전트 컨텍스트와 다음 작업은 `CLAUDE.md` 참고.
