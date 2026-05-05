# Goals

이 디렉토리는 **Goal 파일 평탄 저장소** 다. 설계 §7 참고.

## 규칙 요약

- 파일명 = ID. `G-0142.md`. 제목을 파일명에 넣지 않는다.
- 모든 Goal 은 동일 디렉토리. 의미적 분류는 frontmatter 에서 도구가 도출한다.
- 파일은 거의 이동·삭제하지 않는다. ID 는 영구 불변.
- `INDEX.md` / `TREE.md` / `graph.mmd` 는 **자동 생성** 파일 — 직접 수정 금지.

## 도구

`Tools/goal-system/` — 파서·검증기·뷰 생성기.

```bash
# 검증
python -m goalsys.cli validate Docs/goals

# 인덱스 재생성
python -m goalsys.cli build-views Docs/goals
```

상세는 [`Tools/goal-system/README.md`](../../Tools/goal-system/README.md) 와
[`Docs/goal-system-design.md`](../goal-system-design.md) 참고.

## 작성 시작 지점

설계 §9.3 (Phase 3) — 최상위 Pillar Goal 4개와 횡단 제약 Goal 3개를 먼저 작성한다.
현재(Phase 1) 단계에서는 도구만 준비되었고 실제 Goal 파일은 아직 비어있다.

## 운영 절차 (사용자 명시 호출형)

Goal 라이프사이클 작업(조회·작성·분해·봉사·검증)은
[`Docs/agent-goal-binding.md`](../agent-goal-binding.md) 운영 절차를 따른다.
Claude Code 에서는 `/goal` 슬래시 커맨드로 호출 — 일반 작업에 자동 적용되지 않는다.

```
/goal show <ID>      /goal find <조건>     /goal new           /goal edit <ID>
/goal plan <ID>      /goal serve <ID>      /goal verify <ID>   /goal sync
/goal classify "..." /goal validate
```

- 사용자 가이드: [`Docs/goal-skill-usage.md`](../goal-skill-usage.md)
- 스킬 정의: [`.claude/skills/goal/skill.md`](../../.claude/skills/goal/skill.md)
