"""Task 2.1 — `realizes` 경로 실재성 검증.

설계 §5.1 / §5.3:
Goal 파일의 ``realizes[].path`` 가 가리키는 코드 자산이 저장소에 실재하는지 검증.

경로 해석 규칙:

- 절대 경로 형식이거나 ``repo_root`` 기준 상대 경로로 해석한다.
- 경로 구분자는 OS 무관하게 ``/`` 또는 ``\\`` 모두 허용 — 내부에서 정규화한다.
- 와일드카드(``*``, ``?``)가 포함되면 글로브로 매칭하여 1개 이상 매치되면 OK.
- 디렉토리도 허용한다 — 모듈 단위 매핑(예: ``Source/HktVoxelCore``).

검증 결과는 :class:`RealizesError` 리스트로 모은다 — DAG/스키마와 동일한 패턴.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

from .parser import Goal


@dataclass
class RealizesError:
    """`realizes` 경로 검증 위반."""

    goal_id: str
    path: str
    message: str
    source: Optional[str] = None

    def __str__(self) -> str:
        loc = f"{self.goal_id} realizes={self.path!r}"
        if self.source:
            return f"[{self.source}] {loc}: {self.message}"
        return f"{loc}: {self.message}"


def _normalize(path: str) -> str:
    """경로 구분자를 OS 기본으로 통일하고 양끝 공백을 제거한다."""

    return path.strip().replace("\\", "/")


def _has_glob(path: str) -> bool:
    return any(ch in path for ch in ("*", "?", "["))


def _resolve(repo_root: Path, path: str) -> Path:
    p = Path(_normalize(path))
    if p.is_absolute():
        return p
    return repo_root / p


def _path_exists(repo_root: Path, raw_path: str) -> bool:
    """단일 경로 또는 글로브 패턴의 실재성 검사."""

    norm = _normalize(raw_path)
    if not norm:
        return False
    if _has_glob(norm):
        # 글로브는 항상 repo_root 기준 — 절대 글로브는 지원하지 않는다.
        if Path(norm).is_absolute():
            return False
        try:
            return any(repo_root.glob(norm))
        except (OSError, ValueError):
            return False
    target = _resolve(repo_root, norm)
    return target.exists()


def validate_realizes(
    goals: Iterable[Goal],
    repo_root: Path | str,
) -> List[RealizesError]:
    """모든 Goal 의 `realizes[].path` 가 ``repo_root`` 기준으로 실재하는지 검사."""

    root = Path(repo_root).resolve()
    errors: List[RealizesError] = []
    for g in goals:
        for entry in g.realizes:
            raw_path = entry.get("path", "") if isinstance(entry, dict) else ""
            if not raw_path:
                # schema 단계에서 별도 보고 — 여기서는 건너뛴다.
                continue
            if _path_exists(root, raw_path):
                continue
            errors.append(RealizesError(
                goal_id=g.id,
                path=raw_path,
                message="realizes 경로가 저장소에 존재하지 않는다",
                source=str(g.source_path) if g.source_path else None,
            ))
    return errors


def collect_realizes_paths(goals: Iterable[Goal]) -> dict[str, list[str]]:
    """Goal ID → 정규화된 path 리스트. 양방향 일관성 검증에서 활용한다."""

    out: dict[str, list[str]] = {}
    for g in goals:
        paths: list[str] = []
        for entry in g.realizes:
            if not isinstance(entry, dict):
                continue
            raw = entry.get("path", "")
            if isinstance(raw, str) and raw:
                paths.append(_normalize(raw))
        if paths:
            out[g.id] = paths
    return out
