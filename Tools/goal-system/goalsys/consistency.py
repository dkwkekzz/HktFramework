"""Task 2.3 — Goal ↔ Code 양방향 일관성 검증.

설계 §5.3 의 3가지 검증 항목:

1. Goal 의 ``realizes[].path`` 가 실재하는가?  → :mod:`goalsys.realizes`
2. 코드의 ``@goal: G-XXXX`` 태그가 실재하는 Goal 을 가리키는가?
3. Goal A 의 ``realizes`` 에 파일 X 가 있는데, X 에 A 의 태그가 없으면 → 양방향 비일관 경고
   (그리고 그 역도: X 에 A 태그가 있는데 A.realizes 에 X 가 없으면 경고)

오류 등급:

- :class:`ConsistencyIssue` 의 ``severity`` 가 ``"error"`` 면 빌드 차단 대상
- ``"warning"`` 은 권고 — 경고만으로는 종료 코드를 1로 만들지 않는다 (CLI 에서 ``--strict`` 시 강화).

매칭 규칙(파일 경로 ↔ 태그 경로):

- 정확 일치(정규화 후) 가 1순위.
- 그 외에 Goal 의 ``realizes[].path`` 가 디렉토리(또는 글로브) 인 경우, 태그 파일이 그 하위에 있으면 매치.
- 경로 비교는 OS 무관하게 ``/`` 로 정규화한 상대 경로 기준.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from .parser import Goal
from .realizes import RealizesError, validate_realizes
from .scanner import CodeTag, scan_repo


@dataclass
class ConsistencyIssue:
    """양방향 일관성 검사에서 발견된 문제 한 건."""

    severity: str   # "error" | "warning"
    rule: str       # "RealizesPathMissing" | "UnknownGoalTag" | "MissingTag" | "MissingRealizes"
    goal_id: Optional[str]
    file_path: Optional[str]
    message: str

    def __str__(self) -> str:
        sev = self.severity.upper()
        loc_parts: List[str] = []
        if self.goal_id:
            loc_parts.append(self.goal_id)
        if self.file_path:
            loc_parts.append(self.file_path)
        loc = " / ".join(loc_parts) if loc_parts else "<global>"
        return f"[{sev}/{self.rule}] {loc}: {self.message}"


# ---------------------------------------------------------------------------
# 경로 매칭 유틸 — Goal.realizes path ↔ CodeTag.file_path
# ---------------------------------------------------------------------------


def _norm(path: str) -> str:
    return path.strip().replace("\\", "/").rstrip("/")


def _is_glob(path: str) -> bool:
    return any(ch in path for ch in ("*", "?", "["))


def _path_matches(goal_path: str, tag_rel: str) -> bool:
    """Goal 의 ``realizes`` 경로 ``goal_path`` 가 코드 태그의 상대경로 ``tag_rel`` 을 포함하는가?

    - 글로브: PurePosixPath.match
    - 정확 일치
    - 디렉토리 접두 일치 (goal_path 가 tag_rel 의 조상)
    """

    g = _norm(goal_path)
    t = _norm(tag_rel)
    if not g or not t:
        return False
    if _is_glob(g):
        try:
            return PurePosixPath(t).match(g)
        except (ValueError, TypeError):
            return False
    if g == t:
        return True
    # 디렉토리 접두 — goal_path 가 디렉토리/모듈을 가리키고 tag 가 그 하위 파일.
    return t.startswith(g + "/")


# ---------------------------------------------------------------------------
# 메인 검사 함수
# ---------------------------------------------------------------------------


def check_consistency(
    goals: Sequence[Goal],
    repo_root: Path | str,
    *,
    tags: Optional[Sequence[CodeTag]] = None,
    suffixes: Optional[Iterable[str]] = None,
    excludes: Optional[Iterable[str]] = None,
) -> List[ConsistencyIssue]:
    """Goal ↔ Code 양방향 일관성을 검사한다.

    Args:
        goals: 모든 Goal.
        repo_root: 저장소 루트 (경로 해석/스캔 기준).
        tags: 사전에 스캔한 :class:`CodeTag` 리스트. 없으면 자동 스캔.
        suffixes/excludes: 자동 스캔 시 :func:`scanner.scan_repo` 에 위임.

    Returns:
        :class:`ConsistencyIssue` 리스트 (정렬된 안정적 순서).
    """

    root = Path(repo_root).resolve()
    issues: List[ConsistencyIssue] = []

    # --- (1) realizes 경로 실재성 → error ---
    for err in validate_realizes(goals, root):
        issues.append(ConsistencyIssue(
            severity="error",
            rule="RealizesPathMissing",
            goal_id=err.goal_id,
            file_path=err.path,
            message=err.message,
        ))

    # --- 코드 태그 스캔 ---
    if tags is None:
        tags = scan_repo(root, suffixes=suffixes, excludes=excludes)

    goal_ids: Set[str] = {g.id for g in goals}

    # --- (2) 코드 태그가 실재 Goal 을 가리키는가 → error ---
    for tag in tags:
        if tag.goal_id not in goal_ids:
            issues.append(ConsistencyIssue(
                severity="error",
                rule="UnknownGoalTag",
                goal_id=tag.goal_id,
                file_path=f"{tag.file_path}:{tag.line_no}",
                message=f"코드의 @goal 태그가 실재하지 않는 Goal 을 가리킨다: {tag.goal_id}",
            ))

    # --- (3) 양방향 비일관 경고 ---
    # (3a) Goal.realizes 에 파일 X 가 있는데, X 에 해당 Goal 태그가 없는 경우
    # (3b) 코드 X 에 @goal: A 태그가 있는데, A.realizes 에 X 가 없는 경우
    #
    # 두 방향 모두 "매칭" 정의가 동일 — goal_path 가 tag.file_path 를 포함하면 OK.

    # 빠른 조회: goal_id → list of normalized realizes paths
    realizes_by_goal: Dict[str, List[str]] = {}
    for g in goals:
        paths = [_norm(e.get("path", "")) for e in g.realizes if isinstance(e, dict)]
        realizes_by_goal[g.id] = [p for p in paths if p]

    # tag 인덱스: goal_id → list of normalized tag paths (inline + goals_md)
    tags_by_goal: Dict[str, List[Tuple[str, CodeTag]]] = {}
    for tag in tags:
        if tag.goal_id not in goal_ids:
            continue  # 별도 보고됨
        tags_by_goal.setdefault(tag.goal_id, []).append((_norm(str(tag.file_path)), tag))

    # (3a) Goal → Code: 각 realizes 경로에 매칭되는 태그가 있는지
    for goal_id, paths in realizes_by_goal.items():
        if not paths:
            continue
        tag_paths = [tp for tp, _ in tags_by_goal.get(goal_id, [])]
        for gp in paths:
            # 1. 경로가 실제로 존재하지 않으면 (1) 에서 이미 보고 — 중복 방지.
            full = (root / gp) if not Path(gp).is_absolute() else Path(gp)
            if not _is_glob(gp) and not full.exists():
                continue
            matched = any(_path_matches(gp, tp) for tp in tag_paths)
            if matched:
                continue
            issues.append(ConsistencyIssue(
                severity="warning",
                rule="MissingTag",
                goal_id=goal_id,
                file_path=gp,
                message=(
                    f"{goal_id}.realizes 가 {gp!r} 를 가리키지만, 해당 파일/디렉토리에 "
                    f"`@goal: {goal_id}` 태그(또는 GOALS.md 항목)가 없다"
                ),
            ))

    # (3b) Code → Goal: 각 태그 파일이 해당 Goal.realizes 의 어떤 경로에든 포함되는지
    for goal_id, tagged in tags_by_goal.items():
        gpaths = realizes_by_goal.get(goal_id, [])
        for tp, tag in tagged:
            # GOALS.md 의 경우 모듈 디렉토리 매칭이 의도 — 부모 경로도 시도.
            candidates = [tp]
            if tag.source_kind == "goals_md":
                parent = str(PurePosixPath(tp).parent)
                if parent and parent != ".":
                    candidates.append(parent)
            # constraint 태그는 realizes 가 아니라 constraints 관계여서 양방향 검증 대상 아님.
            if tag.kind == "constraint":
                continue
            matched = any(
                _path_matches(gp, cand)
                for gp in gpaths
                for cand in candidates
            )
            if matched:
                continue
            issues.append(ConsistencyIssue(
                severity="warning",
                rule="MissingRealizes",
                goal_id=goal_id,
                file_path=f"{tag.file_path}:{tag.line_no}",
                message=(
                    f"{tag.file_path} 에 `@goal: {goal_id}` 가 있지만 "
                    f"{goal_id}.realizes 에 이 파일이 등록되어 있지 않다"
                ),
            ))

    issues.sort(key=lambda i: (i.severity != "error", i.rule, i.goal_id or "", i.file_path or ""))
    return issues


# 외부 노출 — CLI 등에서 단발 사용시.
__all__ = [
    "ConsistencyIssue",
    "check_consistency",
    "RealizesError",
    "validate_realizes",
]
