---
name: advprotog-workflow-maintainer
description: HktAdvProtoG 의 Workflow 문서(docs/Design-ModulePlan-CycleWorkflow.md)·AGENTS.md·advprotog-* Skill 자체를 수정할 때만 사용한다 — 변경 제안 분석 → 기존 Cycle 호환성 평가 → 중복 제거 → 문서·영향 Skill 수정 → 버전·이유 기록. 사용자가 "Workflow 변경 / Skill 구조 변경 / 운영 규칙 수정 / AdvProtoG workflow" 를 요청하면 사용.
---

# HktAdvProtoG Workflow·Skill 유지보수

**작업 디렉토리: `HktAdvProtoG/`** (Skill 파일은 `.claude/skills/advprotog-*/`).

이 스킬은 **운영 규칙 자체를 바꿀 때만** 사용한다.
일반 설계·구현·검증 세션에서 Workflow 나 Skill 을 임의로 수정하지 않는다 —
그런 필요를 발견하면 수정하지 말고 제안으로 보고한 뒤,
사용자가 이 스킬로 별도 요청할 때 반영한다.

## 관리 대상

* `HktAdvProtoG/docs/Design-ModulePlan-CycleWorkflow.md` — 최상위 설계·구현 기준 (헌법)
* `HktAdvProtoG/AGENTS.md` — 얇은 부트스트랩 + 공통 불변 규칙
* `.claude/skills/advprotog-cycle-planner/`
* `.claude/skills/advprotog-step-implementer/`
* `.claude/skills/advprotog-scenario-verifier/`
* `.claude/skills/advprotog-cycle-integrator/`
* `.claude/skills/advprotog-workflow-maintainer/` (자기 자신)

## 절차

```text
Workflow 변경 제안 분석
→ 기존 Cycle(문서·증거·리플레이)과의 호환성 평가
→ 중복된 Skill 규칙 제거
→ 새 작업 유형(새 Skill)이 필요한지 평가
→ Workflow 문서 수정
→ 영향받은 Skill 수정
→ 버전과 변경 이유 기록
```

변경 판단 기준과 기록 방법은
[references/workflow-change-policy.md](references/workflow-change-policy.md) 를 따른다.
