# STAGE-1-INTENT — Intent Stage

## 역할

Cycle Contract의 Goal / Possibility Scope에서 세계가 보장해야 하는 의미 단위(Intent)를 추출한다.

## 입력

- `state/cycles/cycle-XXX/00-cycle-contract.md` (Current Cycle Contract)
- 관련 Goal / Possibility 설계 (Contract에 명시된 범위)
- `state/WORLD-BASELINE.md` 중 관련 Subset

## 출력

- `state/cycles/cycle-XXX/01-intent-package.md` — [../templates/INTENT-PACKAGE.md](../templates/INTENT-PACKAGE.md) 형식

## 작성 원칙

1. **Intent는 구현 구조가 아니다.** 클래스·메서드·서비스 이름이 등장하면 잘못된 Intent다.

   ```text
   잘못: MiningComponent를 만든다 / Mine() 메서드를 추가한다
   올바름: 광맥을 알고 있으며, 적절한 채굴 도구를 가지고 있고,
           광맥에 접근 가능한 Actor는 Mine을 통해
           광맥의 Resource를 감소시키고 자신의 Inventory에 Resource를 획득할 수 있다.
   ```

2. **세계에서 무엇이 참이어야 하는가**만 서술한다. 어떻게 구현할지는 다음 단계의 책임이다.
3. **Trace 필수** — 각 Intent는 Source Goal / Source Possibility ID를 명시한다 (`Goal → Possibility → Intent`).
4. Goal / Possibility 의미를 변경·추가·삭제하지 않는다. 그래프 변경은 설계 변경이며 인간의 몫이다.
5. Contract 범위 밖 Intent를 만들지 않는다.

## STOP 조건

Intent Package 저장 + CURRENT-CYCLE 진행 표 갱신 후 STOP. World Model Stage를 이어서 실행하지 않는다.
