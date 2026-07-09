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

## 비율 프로파일

우측 패널 **비율 프로파일** 섹션에서 체형을 고르고 세부 조절한다.

- **프리셋**: `레퍼런스`(기본 — 캐릭터 시트 기준 6등신 여성 체형) / `표준`(기존 범용 체형).
  전환 시 built-in 리그가 프로파일 치수로 재생성된다. 외부 FBX 는 자체 뼈 길이를 쓰므로
  두께 규칙·볼륨 헬퍼만 새 프로파일을 따른다.
- **그룹 슬라이더**: 머리·가슴·허리·엉덩이·팔·다리 두께를 그룹 단위로 실시간 배율 조절.
- 수치 자체를 바꾸려면 `src/proportions.js` 프로파일 데이터를 수정하면 된다
  (이름 규칙 / 스켈레톤 치수 / 볼륨 헬퍼 / 권장 smin / 휴식 포즈). 콘솔의 `window.__hkt`
  핸들로도 실시간 튜닝이 가능하다.

## 비율 검증 (Evaluator)

```bash
npm run eval
```

기준 캐릭터 시트(`eval/fixtures/reference-sheet.jpeg`)의 정면/측면/후면 실루엣과 현재
`reference` 프리셋 렌더를 자동 대조한다 — 신장 정규화 폭 프로파일로 행별 오차를 재고
(평균 ≤ 0.025H · 행 최대 ≤ 0.06H), 시트 위에 렌더를 겹친 오버레이 PNG 를 `eval/out/` 에
남긴다. 비율 프로파일을 수정했다면 이걸 돌려 시트와 어긋나지 않았는지 확인할 것.
헤드리스 Chromium 이 필요하다 (Playwright 설치본을 자동 탐색, 없으면 `HKT_EVAL_BROWSER`
환경변수로 실행 파일 지정).

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
