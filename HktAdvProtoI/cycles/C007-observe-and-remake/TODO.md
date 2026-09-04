# C007 — TODO

살아 있는 문서다. 항목이 닫히면 지운다 — 다 지워지면 이 파일도 지운다.

## Human 판정 대기 — Experience Verification

도구는 이렇게 돌린다 (그림은 `shots/` 에 이미 있다):

```text
npm run world:observe -- WHITE_KING_DOMAIN --height --surface --traversable --semantic --top-view --report --scale 12
npm run world:observe -- FOREST_EDGE --height --traversable --top-view --scale 12
npm run world:compile -- WHITE_KING_DOMAIN
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run world:shot -- FOREST_EDGE --at 0,0
npm run dev                                  # 숲 가장자리로 건너가 분지를 걸어 본다
```

자동 시나리오(`content/world/tests/c007-observe-and-remake.spec.ts` 19 ·
`tools/world-editor/tests/c007-observe.spec.ts` 20 · engine 386)는 전부 PASS —
`npm test` 1069 PASS / 4 todo.

```text
Start   나는 백왕령을 걸어 봤지만 그 땅을 한 번에 본 적이 없다. 숲 가장자리는 여전히 평평하다.
End     한 장으로 내려다본다 — 막힌 자리가 어디인지 보인다. 그리고 같은 방법으로
        다음 방을 채울 수 있다는 것을 직접 해 보아 안다.
```

```text
X-①  걸어 본 땅이 한 장이 된다
     하기   백왕령의 통행 그림을 본다
     보기   강이 방을 남북으로 가르는 짙은 띠로 서고, **다리 자리 한 곳만 뚫려 있다**.
           능선 꼭대기는 갈색 덩어리다. 내가 C006 에서 막혔던 그 자리들인가
     그림   shots/WHITE_KING_DOMAIN.traversable.png
     판정   [ ]

X-②  위에서 본 한 장
     하기   top view 를 본다
     보기   표면(평지 주황 · 젖음 파랑 · 비탈 초록 · 급경사 빨강) 위에 조건 구역의 테두리와
           표식 다섯(출구 셋 · 다리 · 거목)이 얹힌다. 이것이 "조망" 으로 읽히는가 —
           **표를 읽고 그림을 보면 왼쪽 아래가 (minX, minZ) 다** (+z 가 위 = 북쪽이 위)
     그림   shots/WHITE_KING_DOMAIN.top.png · .height.png · .surface.png · .semantic.png
     판정   [ ]

X-③  보고가 읊는 수와 검사
     하기   `--report` 를 읽는다
     보기   격자 · 표면 태그별 칸 수 · 막힘 사유별 칸 수 · area · point · chunk · instance · hash.
           그리고 검사 아홉. **③ 이 실제로 답을 낸다** — 백왕령의 city 곁에 condition 셋.
           ①②④ 는 "위반 0" 이 아니라 **"놓인 것이 없다"** 라고 적는다. 그 어법이 옳은가
     판정   [ ]

X-④  숲 가장자리에 분지가 생겼다
     하기   숲 가장자리의 통행 그림을 보고, 그 다음 `npm run dev` 로 그 방에 건너가 걸어 본다
     보기   급경사가 **닫힌 고리**로 둘러서고 그 안의 바닥은 통행 가능하다.
           걸어가면 고리에서 "너무 가파르다" 로 막힌다 — **C006 의 규칙 그대로이고 새 규칙은 없다**.
           바닥은 보이지만 걸어 들어갈 수 없다: 그것이 이 데이터의 성질이다 (아래 부채 ①)
     그림   shots/FOREST_EDGE.traversable.png · shots/FOREST_EDGE.game.png
     판정   [ ]

X-⑤  Intent — 새 방이 데이터로 채워졌는가
     하기   `content/regions/forest-edge.ts` 의 stamp 한 덩이를 열어 본다. 값을 바꿔 다시 띄운다
     보기   그 한 덩이가 이 분지의 전부인가. **engine · content/world · content/view 가 한 줄도
           바뀌지 않았는가** — 그것을 시나리오 S-009 가 git 으로 직접 잰다.
           "같은 방법으로 다음 방을 채울 수 있겠다" 는 확신이 서는가
     판정   [ ]
```

## 알려진 부채

```text
① 분지 바닥에 걸어 들어갈 수 없다     falloff 2 의 basin 은 급경사가 닫힌 고리로 둘러선다 —
                                  바닥이 보이는데 닿지 못한다. 지금은 그것이 SPEC-010 의 증거이지만,
                                  "내려갈 수 있는 분지" 를 원하면 고리를 끊는 값(깊이를 줄이거나
                                  falloff 를 낮춘다)이 필요하다. 코드가 아니라 데이터 한 줄이다

② 앞선 Cycle 의 테스트가 방의 수를 알고 있었다
                                  "여덟 방은 평평하다" 처럼 **수**를 단언에 박아 둔 자리가 여섯 있었고,
                                  데이터 하나를 더하자 전부 틀렸다. 좁혀서 고쳤고 무엇을 고쳤는지는
                                  S-009 가 단언으로 밝힌다. 앞으로의 테스트는 방의 수를 박지 않는다 —
                                  "코드 diff 0" 이 테스트까지 포함해 참이려면 그래야 한다

③ 컴파일 산출을 굽지 않는다          world:compile 은 hash 를 읊는 데까지다. *.compiled.generated.ts 는
                                  읽을 소비처가 아직 없고 생성물의 낡음 문제를 데려온다 (spec Out of Scope).
                                  세계와 관찰자가 켤 때 각각 컴파일하는 것(두 번)은 C006 에서 이어진 부채다

④ 검사 ①②④ 는 아직 빈 검사다        resource · hazard · phenomenon layer 가 이 세계에 없다.
                                  도구는 그 자리를 읽을 준비만 되어 있고, 채우는 것은 컨텐츠 층 주입이다

⑤ world:shot 은 브라우저를 밖에서 받는다  playwright 번들 크로뮴이 없는 자리에서는 CHROMIUM_PATH 가 필요하다.
                                  없으면 무엇이 없는지 말하고 멈춘다 (그것이 SPEC-008 경계다)
```

## 다음 Cycle 로

```text
이 Play(RoomBecomesLand)는 이 Cycle 로 닫힌다 — C005·C006·C007 셋 다.
남은 것은 **Play Goal 실주행 확인**이다 (백왕령 → 능선에 막힘 → 강 → 다리 → 거목과 조건 → 숲 가장자리의 분지).

RuleBoundRoom (C008~C010) 이 다음이고, 그것이 바꿀 area · traversable 을 이 Play 가 세워 두었다.

시나리오가 피해 간 자리
    없음 — SPEC-001~010 전부에 테스트가 닿고 it.todo 도 없다 (남은 넷은 C006 의 것 그대로다).

spec 이 침묵해 **테스트가 판정 방식을 정한 자리** (Human 감사)
    ① SPEC-009 의 git 판정   spec 은 "engine · content/world · content/view 가 비어 있다" 고 적었지만
                          이 Cycle 은 engine 에 observe.ts 를 새로 세운다. 그래서 "기존 코드가 한 줄도
                          안 바뀐다" 로 읽었다 — M/D 가 없다 · world·view 에 새 코드가 없다 ·
                          engine 의 새 코드는 observe.ts 하나 · regions 의 변경은 forest-edge.ts 하나.
                          테스트는 이 셈에서 뺐고, 무엇을 뺐는지는 같은 테스트가 단언으로 밝힌다 (부채 ②)
    ② 그림의 줄 방향        spec 은 1:1 만 말하고 방향을 말하지 않는다. 방향 자체를 못박지 않고
                          "다섯 장이 같은 방향인가" 를 잰다 (도구는 +z 를 위로 둔다)
    ③ 보고의 hash          spec 은 "hash" 라고만 적는다 — 그 방을 가리키는 값이 실리면 통과로 본다
    ④ 검사 ②              spec 경계는 ①②④ 를 함께 "놓인 것이 없다" 로 묶었으나 depth 는 이 세계에
                          실재한다 (아홉 방 다 갖고 있다). ①④ 에만 그 어법을 요구하고 ② 는 센 수로 잰다
    ⑤ top view            "표면 색 위에" 를 팔레트 동일로 읽지 않았다 — 도구는 다른 색표를 쓴다.
                          "표면 색인이 바탕의 대부분을 설명하고 그 위에 색이 더 있다" 로 잰다
```
