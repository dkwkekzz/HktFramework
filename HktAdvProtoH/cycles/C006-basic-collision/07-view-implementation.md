# C006 — View Implementation

## SPEC CONSUMED
    entities.character.body          view/presentation/collision-presentation.ts — 몸 반경 원 + 속도 화살표
    entities.character.swing         view/presentation/collision-presentation.ts — 휘두름 반경 원
                                     (활성=빨강 / 비활성=노랑, struck 몸에 주황 표시)
    debugObserve.toggle              app/main.ts — KeyC 토글, 기본 off (owner: observer —
                                     World 에 아무것도 요청하지 않는다)
    나머지 계약                      C004·C005 구현 그대로 재사용 — 변경 없음

## ASSET MAPPING
    새 sprite 없음 — 충돌체는 그림이 아니라 지면 위 선(원·화살표)으로 그린다.
    표현 결정(색·투명도·화살표 배율)은 collision-presentation.ts 의 단일 항목이다:
        몸 0x36d399 · 활성 휘두름 0xff5252 · 비활성 휘두름 0xf0c33c ·
        맞은 몸 표시 0xff8f3c · 속도 화살표 0x4db8ff (길이 = 속도 × 0.35)

## INPUT → ACTION REQUEST
    변경 없음 — 이동(WASD/클릭) · 채굴(E) · 공격(F) 그대로.
    KeyC 는 Action Request 가 아니다 — View 쪽 표시 선택일 뿐이다.

## FIXTURE TESTS
    collision-debug.fixture.json → collision-debug.spec.ts (7)
        토글 off 기본 → 디버그 지시 없음
        on → 모든 몸의 반경 원 / 휘두름 원(활성·비활성 구분) /
              맞은 몸 자리 표시 / 없는 몸은 표시 생략 /
              밀리는 몸에만 속도 화살표(길이 비례) / swing 없는 관찰도 정상
    전체 185/185 통과 · tsc · vite build 통과

## R1 (Human Play 반환 반영)
    몸 충돌체는 지면 원이 아니라 캡슐 부피(radius + height 와이어프레임)로,
    칼끝 충돌체는 몸통 높이(키의 0.55)에서 떠 있는 구체 와이어프레임으로 그린다.
    scene-state 의 디버그 지시가 SceneDebugCircle → SceneDebugCapsule + SceneDebugSphere 로
    바뀌었고, renderer 는 캡슐/구체를 그리는 capability 를 얻었다 (여전히 의미 무지).
    표현 결정(색·투명도·구체 높이 비율)은 collision-presentation.ts 한 곳이다.

## NOTES
    2-Layer 준수 — scene-state 에 SceneDebugCircle/Vector(표현 지시)를 추가하고,
    renderer 는 "지면 위 원과 화살표를 그리는" capability 만 얻었다 (그것이 몸인지
    휘두름인지 모른다). 의미 → 표현 결정은 collision-presentation.ts 한 곳이다.
    디버그 원은 스무딩 전의 세계 위치를 그대로 쓴다 — 관찰 목적이므로
    화면 보간이 아니라 세계가 판정한 자리를 보인다.
    HUD 조작 안내에 '충돌체 관찰: C' 추가 (View 자체 기능이라 엔진 기본 안내에 둠).
