"""Phase 4 — `verify-goal`.

설계 §4.5 (V — 달성 검증) + 도구 §6.3 명세 구현.

자동 측정만 시도하고 status 는 변경하지 않는다 — 결과만 반환. 측정 방법은
``measure`` 필드의 자유 텍스트로, 본 모듈은 핸들러 등록 메커니즘만 제공한다.
프로젝트별 자동화는 :func:`register_measure_handler` 로 후크를 추가한다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Literal, Optional, Sequence

from .parser import Goal


Result = Literal["pass", "fail", "manual_required"]

PASS: Result = "pass"
FAIL: Result = "fail"
MANUAL: Result = "manual_required"

CriterionResult = Dict[str, Any]
MeasureHandler = Callable[[Goal, Dict[str, Any]], CriterionResult]


# ---------------------------------------------------------------------------
# 결과 자료구조
# ---------------------------------------------------------------------------


@dataclass
class VerifyReport:
    """``verify-goal`` 출력 (도구 §6.3 형식)."""

    goal_id: str
    criteria: List[CriterionResult] = field(default_factory=list)

    @property
    def summary(self) -> Dict[str, int]:
        passed = sum(1 for c in self.criteria if c.get("result") == PASS)
        failed = sum(1 for c in self.criteria if c.get("result") == FAIL)
        return {"passed": passed, "failed": failed, "total": len(self.criteria)}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "goal_id": self.goal_id,
            "criteria": self.criteria,
            "summary": self.summary,
        }


# ---------------------------------------------------------------------------
# 측정 핸들러 등록
# ---------------------------------------------------------------------------


_HANDLERS: List[tuple[re.Pattern[str], MeasureHandler]] = []


def register_measure_handler(pattern: str, handler: MeasureHandler) -> None:
    """``measure`` 텍스트에 ``pattern`` (정규식) 이 매칭되면 핸들러를 호출한다.

    핸들러는 ``(goal, criterion_dict)`` 를 받아 결과 dict 를 반환한다:

        {
            "result": "pass" | "fail" | "manual_required",
            "current_value": ...,        # 선택
            "automated": True,
        }
    """

    _HANDLERS.append((re.compile(pattern), handler))


def reset_measure_handlers() -> None:
    """등록된 핸들러를 모두 해제한다 (테스트용)."""

    _HANDLERS.clear()


# ---------------------------------------------------------------------------
# verify-goal
# ---------------------------------------------------------------------------


def verify_goal(goal: Goal) -> VerifyReport:
    """단일 Goal 의 자동 검증.

    - 측정 가능(``measurable: true``) 이면서 등록된 핸들러가 매칭되면 그 결과 사용.
    - 그 외에는 ``manual_required`` 로 표시.

    Returns:
        :class:`VerifyReport`. status 는 자동 변경하지 않는다.
    """

    report = VerifyReport(goal_id=goal.id)
    for sc in goal.success_criteria or []:
        if not isinstance(sc, dict):
            continue
        measurable = bool(sc.get("measurable"))
        measure = sc.get("measure")
        entry: CriterionResult = {
            "description": sc.get("description", ""),
            "measurable": measurable,
            "measure": measure,
            "automated": False,
            "result": MANUAL,
            "current_value": None,
        }
        if measurable and isinstance(measure, str):
            handler = _find_handler(measure)
            if handler is not None:
                # 핸들러 예외는 측정 실패로 취급. status 는 자동 변경하지 않으므로 안전.
                try:
                    out = handler(goal, sc) or {}
                except Exception as exc:  # pragma: no cover — defensive
                    out = {"result": FAIL, "current_value": f"handler error: {exc}"}
                entry["automated"] = True
                entry.update(out)
        report.criteria.append(entry)
    return report


def verify_goals(goals: Sequence[Goal]) -> List[VerifyReport]:
    return [verify_goal(g) for g in goals]


def _find_handler(measure: str) -> Optional[MeasureHandler]:
    for pat, handler in _HANDLERS:
        if pat.search(measure):
            return handler
    return None


# ---------------------------------------------------------------------------
# 보고 형식
# ---------------------------------------------------------------------------


def format_report(report: VerifyReport) -> str:
    """도구 §4.5 의 사람이 읽는 형식."""

    out: List[str] = []
    markers = {PASS: "✅ pass", FAIL: "❌ fail", MANUAL: "⚠ manual_required"}
    out.append(f"{report.goal_id} 검증 결과")
    out.append("")
    for i, crit in enumerate(report.criteria, start=1):
        result = crit.get("result", MANUAL)
        marker = markers.get(result, result)
        out.append(f"Criterion {i}: {crit.get('description', '')}")
        if crit.get("measure"):
            out.append(f"  측정: {crit['measure']}")
        out.append(f"  결과: {marker}")
        if crit.get("current_value") is not None:
            out.append(f"  현재 값: {crit['current_value']}")
        out.append("")
    s = report.summary
    out.append(f"종합: {s['passed']}/{s['total']} 충족 (실패 {s['failed']})")
    return "\n".join(out)
