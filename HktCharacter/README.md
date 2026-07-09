# HktCharacter

Skeleton → Flesh: rig-agnostic SDF flesh 렌더러 (Mixamo 리그 지원).

뼈대를 먼저 정의하고 살을 뼈대의 순수 함수(SDF)로 자라게 한다 —
모델링·리깅·스키닝을 한 번에. 뼈대를 움직이면 살이 자동으로 따라온다.

> 이전 이름: `hikito-flesh`. 프로젝트명을 **HktCharacter** 로 변경.

## 실행

**Windows 원클릭**: `run.bat` 더블클릭 → 최초 1회 자동 `npm install` 후 dev 서버 실행 + 브라우저 자동 오픈.

수동 실행:

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

> 참고: 이 프로토타입은 `three` 를 npm 패키지로 `import` 하는 ES Module 구조라 `file://` 더블클릭으로는 열리지 않는다. dev 서버(Vite)가 ①정상 origin 제공(ES Module CORS) ②bare import(`'three'`) 경로 해석 두 가지를 담당하므로 서버 실행이 필요하다. `run.bat` 은 이 과정을 원클릭으로 감싼 것.

## 로코모션 (동봉 FBX)

우측 패널 **로코모션** 섹션의 버튼(걷기·뛰기·대기·점프·공격·삼바)을 누르면 동봉된 Mixamo
FBX 클립이 즉시 재생된다 — 파일을 직접 받을 필요 없다. 샘플은 `public/assets/anim/*.fbx`
(HktSplatLife 와 동일 세트). 여러 클립이 든 FBX 는 클립 전환 버튼이 추가로 뜬다. **내장
스켈레톤으로 복귀** 버튼으로 절차적 클립(walk/idle/wave)에 언제든 돌아온다.

## Mixamo 직접 불러오기

1. [mixamo.com](https://www.mixamo.com) 에서 캐릭터 + 애니메이션 선택
2. **Download → Format: FBX Binary** 로 받기
3. 우측 패널 **Mixamo 불러오기** 드롭존에 파일을 드롭

built-in 리그 + 절차적 클립(walk/idle/wave)은 파일 없이도 즉시 동작.
애니메이션-only FBX(스킨 메시 없음)도 뼈 world 위치로 바운드를 잡아 정규화하므로 정상 표시된다
(HktSplatLife `ExternalSkeleton` 과 동일 정식).

## 조작

- 드래그: 회전 · 휠: 줌
- 패널: 모션 선택 / 속도 / 뭉툭함(smin) / 통통함 / 손가락 / 뼈대 보기 / 로코모션 샘플

에이전트 컨텍스트와 다음 작업은 `CLAUDE.md` 참고.
