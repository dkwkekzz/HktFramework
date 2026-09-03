# C004 — TODO

살아 있는 문서다. 항목이 닫히면 지운다 — 다 지워지면 이 파일도 지운다
(`spec.md` 만 남은 디렉터리가 닫힌 Cycle 이다).

## Human 판정 대기 — Experience Verification

이 Cycle 은 체험이 아니라 **검증**이다 (Play §6 "검증 C004 가 이것을 실측한다"). 그래서 판정도
"재미있는가" 가 아니라 **"약속이 지켜졌는가"** 다.

`npm run dev` 로 세계를 띄우고, 표는 `npm run world:observe` 로 본다.
자동 시나리오(`content/world/tests/c004-polish-is-data.spec.ts` 29 ·
`tools/world-editor/tests/observe.spec.ts` 7 · 전체 794)는 전부 PASS 다.

```text
Start   앞의 셋이 "이건 나중에 데이터로 바꿀 수 있다" 고 말했다. 말뿐인지 아닌지는 아직 모른다.
End     문 하나를 여는 데 코드가 한 줄도 필요하지 않았다. "다른 세계를 만든다 = content/ 를 갈아 끼운다" 가
        약속이 아니라 측정값이 됐다.
```

```text
X-①  고대 문이 열렸다 — 같은 자리 같은 각도, 표식만 다르다
     하기   숲 안쪽으로 가서 북서쪽(−13, 13) 표식을 본다
     보기   붉은 빗장이 사라지고 열린 팻말이다. 방도 깊이도 다른 표식도 C002 그대로다
     그림   shots/X-01-ancient-gate-open.png 를
           **cycles/C002-many-exits/shots/X-05-ancient-gate.png 와 나란히** 놓고 본다
           (자리·각도·걸음을 똑같이 두고 찍었다 — 다른 것은 데이터 한 줄뿐이다)
     판정   [ ]

X-②  세계의 대답이 바뀌었다 — 규칙은 그대로인데
     하기   그 표식에 붙어 `Q`
     보기   "잠겨 있다" 가 아니라 **"아직 갈 수 없는 곳이다"** 가 뜬다. 몸은 그 자리 그대로다.
           문은 열렸고 그 너머가 아직 지어지지 않았을 뿐이라는 것이 읽히는가
     그림   shots/X-02-region-not-built.png 를
           **cycles/C002-many-exits/shots/X-06-connector-inactive.png 와 나란히** 놓고 본다
     판정   [ ]

X-③  닫힌 표식이 이 세계에 하나도 없다
     하기   숲 안쪽 한가운데에서 시점을 돌려 출구 다섯을 다 센다
     보기   다섯이 전부 열린 팻말이다. 종류(오솔길 둘 · 들어감 · 문)는 색으로 그대로 갈린다
     그림   shots/X-03-five-open-exits.png
     판정   [ ]

X-④  세계가 자기 그래프를 읊는다
     하기   `npm run world:observe`
     보기   방 9 · Connector 13 · 중첩 2 · 경계 3 · "검사 오류 0" 이 표로 나온다.
           **이 표만 보고 세계의 모양을 알 수 있는가** — 어디가 지어졌고 어디가 아직 경계인지,
           무엇이 일방향이고 무엇이 닫혔는지가 한 화면에서 읽히는가
     판정   [ ]

X-⑤  폴리싱이 정말 데이터인가 (이 Cycle 의 본론)
     하기   아래를 **직접** 해 보고, 그때마다 `npm test` 가 그대로 도는지 본다
              ① content/regions/graph.ts 의 CLOSED_CONNECTORS 에 아무 Connector id 를 하나 넣는다
                 → 그 문이 잠기고 표식이 붉은 빗장으로 돌아온다
              ② content/regions/*.ts 의 어느 방 extent 를 넓힌다
                 → 그 방이 넓어지고 시점도 그만큼 물러난다
              ③ content/view/region-presentation.ts 의 색 한 줄을 바꾼다
                 → 그 색이 바뀐다
              ④ content/regions/graph.ts 의 START_REGION_ID 를 다른 방으로 바꾼다
                 → 세계가 그 방에서 시작한다
     보기   **넷 다 코드(content/world · engine)를 한 줄도 고치지 않고 되는가.**
           되돌릴 때도 그 파일만 되돌리면 되는가
     판정   [ ]

X-⑥  Play Goal — RegionGraphRooms 전체 실주행
     하기   이 Play 의 마지막 Cycle 이다. 백왕령에서 시작해 숲 가장자리 → 숲 안쪽 → POI 셋 →
           거목 → 내부 세계 → 추락 → 심장 호수 → 물길 → 되짚어 백왕령까지 한 번에 간다
     보기   Play §2 의 완료 셋이 서는가
              ① 여섯 개 이상의 방을 지났다
              ② 그 중 깊이가 셋 이상이다 (civil · outer · wild · deep)
              ③ 되돌아온 백왕령에 아직 건너지 않은 출구가 하나 이상 남아 있다
           그리고 §3 의 End 가 서는가 — "지도는 없지만 저 출구 너머에 더 있다는 것을 안다"
     판정   [ ]
```

## 알려진 부채

```text
거절이 뜨는 시간이 고정이다        C002 이월 — NOTICE_MS 2.2초. 촬영에서 X-② 를 찍으려고
                                 찍기 직전에 한 번 더 물어야 했다 (거절은 State 를 바꾸지 않으므로
                                 몇 번을 물어도 같은 대답이다). 읽는 속도와 무관한 것은 그대로다
방 바닥이 지형 굴곡에 묻힌다        C001 이월 → C008
카메라가 방 전체를 담지 않는다      C002·C003 이월 → 그래서 X-③ 은 시점을 돌려 센다
촬영 하네스에서 자판 걸음이 안 걷는다 C003 이월 — 이 Cycle 도 spawn 으로 자리를 잡았다. 원인 미확정
```

## 다음 Cycle 로

```text
고대 문과 확정 3 (Human 감사)
    RegionGraphRooms 확정 3 은 "고대 문은 이 Play 동안 닫혀 있다" 이고 RuleBoundRoom 확정 4 는
    "고대 문은 RegionGraphRooms 의 C004 가 데이터로 연다" 다. 둘 다 Human 승인이라 어긋난다.
    **뒤의 것을 따랐다** — C004 를 이름으로 지목했고 STATE §1 도 그렇게 적혀 있으며, 확정 3 은
    Play 의 체험 구간(C001~C003)을 지키는 말로 읽었다. 아니라면 되돌릴 것은
    content/regions/graph.ts 의 CLOSED_CONNECTORS 한 줄이다.
    C005 가 이 문 뒤에 미로를 짓기 전에 확인해 주기 바란다

닫힌 문 갈래는 쓰이지 않은 채 남는다
    connector-inactive 사유도 locked 표식도 문구도 전부 살아 있지만 이 세계의 데이터에서는
    이제 나오지 않는다. C004 의 변형 시나리오가 그 갈래를 계속 검증한다 —
    RuleBoundRoom 이 activation(W12)으로 다시 쓸 자리다

world:observe 는 읽기만 한다
    편집·JSON 출력·필터는 아무도 요구하지 않아 만들지 않았다 (선행 추상화 금지).
    ENGINE A 의 world:compile 이 올 때 이 도구가 그 옆에 설지, 하나로 합칠지는 그때 정한다
```
