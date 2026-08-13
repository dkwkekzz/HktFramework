# CYCLE C002 — View Implementation

## SPEC CONSUMED
    entities.character (cardinality: many)     view/presentation/resolve.ts
        role → player-character / npc-character   view/presentation/role-presentation.ts
        kind + state → motion                     view/motion/motion-library.ts
        actionProgress → 재생 방식                view/motion/motion-frame.ts
    entities.character.motion.selectedBy        view/motion/motion-library.ts (resolve)
    entities.character.motion.progress          view/motion/motion-frame.ts (loop | progress)
    entities.character.motion.fallback          view/motion/motion-library.ts + view/assets/registry.ts
    entities.deposit                            resolve.ts (C001 REUSED)
    interactions.move / mine / attack           view/presentation/interaction-presentation.ts
    interactions.*.unavailableReason            view/presentation/code-text.ts
    hud.inventory / hud.tool                    view/presentation/hud-presentation.ts (C001 REUSED)
    hud.playerAction                            hud-presentation.ts (label) + view/hud/hud.ts (진행 막대)

    hud.actionHint 는 별도 위젯으로 만들지 않았다 — interactions[].available / unavailableText
    이 같은 의미를 담고 있고, 어느 대상의 힌트를 띄울지는 기존 프롬프트 capability 가
    이미 결정한다 (C001 의 mineHint 와 같은 처리).

## ASSET MAPPING — Motion Data Injection Format v1
    위치        motions/<characterKind>/<action>[.<옵션>…].png
    발견 방식   view/motion/motion-source.ts 의 import.meta.glob('/motions/**/*.{png,webp}')
                등록 코드 없음 — 파일을 놓으면 개발 서버/빌드가 집어 온다.

    폴더 이름 = 캐릭터 종류 (World 의 Actor.CharacterKind 와 같은 문자열)
    파일명 첫 토큰 = 행동 (idle · move · attack · mine · 이후 추가 행동도 동일)

    옵션 토큰 (`.` 구분, 순서 무관)
        3x3 · cols3 · rows3     격자 (기본 1x1)
        9f  · frames9           프레임 수 (기본 cols × rows, 격자 칸 수로 상한)
        8fps · fps8             초당 프레임 (기본 8)

    재생
        소요 시간 없는 행동(대기·이동)   fps 로 반복
        소요 시간 있는 행동(공격·채굴)   진행도 0→1 에 맞춰 1회 — 행동과 동시에 끝난다

    폴백 (04-gameview.spec.yaml 의 motion.fallback 순서 그대로)
        1 <kind>/<action>  2 <kind>/idle  3 아무 kind 의 <action>  4 절차 생성 픽셀아트

    이번 Cycle 에 주입한 데이터
        motions/rabbit-swordsman/idle.3x3.9f.8fps.png   1518×1452, 프레임 506×484, 9프레임
        motions/wanderer/idle.3x3.9f.8fps.png           (같은 내용 — NPC 임시 데이터)
        → player Actor 는 characterKind = 'rabbit-swordsman', NPC 는 'wanderer' 이므로
          지금은 둘 다 같은 그림으로 그려진다. NPC 전용 시트가 생기면
          motions/wanderer/ 안의 파일만 갈아 끼우면 된다 (코드 변경 없음).
        → move/attack/mine 시트는 아직 없으므로 폴백 2단계(같은 종류의 idle)로 관찰된다.
        → 두 파일은 내용이 같아 git 은 blob 하나만, vite 는 에셋 하나만 만든다.

    Role Tint (view/presentation/role-presentation.ts)
        npc-character 에 tint 0x9fb6ff. 같은 모션 시트를 쓰는 동안 누가 내 캐릭터인지
        구분되게 하는 표현 결정이며, NPC 전용 시트가 들어오면 지워도 된다.
        billboard 는 지시받은 색을 곱할 뿐 role 을 모른다.

    절차 생성 Asset (모션이 없을 때) — view/assets/registry.ts
        player-pickaxe:idle / move / moving / attack / mine
        wanderer:idle / move / attack        (npc-character 기본 그림, C002 ADDED)
        stone-deposit:available / depleted   (C001 REUSED)
        미등록 조합은 기존 placeholder 로 그려진다 — 표현 누락이 게임을 멈추지 않는다.

    사용자 안내 문서: motions/README.md

## INPUT → ACTION REQUEST
    WASD / 방향키   → Move(진행 방향의 앞 지점)        app/main.ts (C001 REUSED)
    지형 클릭       → Move(클릭 지점)                  view/input/input.ts (C001 REUSED)
    entity 클릭     → 그 대상의 interaction            view/input/input.ts
                      (광맥 → Mine, NPC → Attack — 지시대로 보낼 뿐 의미를 모른다)
    E               → Mine(deposit)                    interaction-presentation
    F               → Attack(대상 Actor)               interaction-presentation (C002 ADDED)

    같은 키에 대상이 여럿이면(주변 캐릭터 수만큼 attack interaction 이 온다)
    지금 가능한 대상을 고른다 — app/main.ts. 안내 줄은 중복을 지운다 — view/hud/hud.ts.

## CAPABILITY 고도화 (이번 Cycle 이 더한 그리기 능력)
    Sprite Sheet Animation      view/sprites/billboard.ts
        시트 이미지는 url 당 한 번만 읽고, 텍스처는 billboard 마다 만든다
        (프레임 오프셋이 독립이어야 한다). UV 는 motion-frame.ts 가 계산한다.
        프레임 가로세로비를 읽어 스프라이트 폭을 보정한다.
    HUD label 위젯 + 진행 막대  view/hud/hud.ts · index.html

    기존 capability(터레인·트레일·카메라·픽업 토스트)의 렌더 코드는 수정하지 않았다.

## FIXTURE TESTS
    view/tests/motion.spec.ts                                                   15건
        포맷 파싱(폴더=종류 · 첫 토큰=행동 · 옵션 순서 무관 · 대체 표기 · 상한 · 무시)
        라이브러리 폴백 4단계
        재생 방식(loop fps · progress 1회 · 범위 클램프) · UV 좌표 순서
        motions/ 자동 발견 — 등록 코드 없이 색인되는지 실제 폴더로 확인
        종류마다 자기 시트로 해석되는지 · 한쪽만 갈아 끼워도 다른 쪽이 그대로인지
    view/tests/fixtures/character-action.fixture.json                           신규
    view/tests/resolve.spec.ts                                                   7건
        C002 fixture → 모션 선택/폴백/재생 방식, 행동 HUD 문구·진행도,
        대상별 attack interaction 의 키·프롬프트·사유
        모션이 전혀 없을 때 모든 entity 가 절차 그림으로 그려지는지
        (C001 fixture 3종은 그대로 통과 — Regression)

    npm test → 52 passed (world 30 + view 22)
    npm run build → tsc --noEmit 통과, vite build 성공 (시트가 dist 에 번들된다)

## NOTES
    - View 는 여전히 world/ 를 import 하지 않는다. 늘어난 계약은 protocol/gameview.ts 의
      EntityView.kind / progress / targetEntityId, HudItemView.'label' / progress 뿐이다.
    - resolvePresentation 은 Motion Library 를 인자로 받는다(기본값은 자동 발견 결과) —
      테스트가 실제 폴더 없이 결정만 검증할 수 있다.
    - reason-text.ts → code-text.ts 로 이름을 바꿨다. 불가 사유뿐 아니라 행동 코드도
      같은 결정 표(코드 → 문구)를 쓰기 때문이다. 기존 사유 문구는 그대로 유지된다.
    - 모션 시트의 프레임 크기(506×484)는 크지만 표현 문제일 뿐 계약과 무관하다.
      더 작은 시트를 넣어도 같은 규약으로 동작한다.
