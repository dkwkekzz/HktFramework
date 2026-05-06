"""Task 시스템 — Goal 미달분 추적용 일감 영속화.

설계: ``Docs/task-system-design.md`` 참조.

핵심 규칙:
- Task 는 1개 이상 Goal 에 봉사 (``goal_ids`` 필수, T-R1)
- ID 는 ``T-XXXXX`` (5자리). 영구 불변. 폐기되어도 재사용 금지.
- 상태: ``todo`` → ``in_progress`` → ``done`` | ``cancelled``
- ``closed_at`` 은 terminal status (done/cancelled) 에서만 채움 (T-R2)
- ``constraint_violation`` 참조 대상은 constraint Goal (T-R3)

자동화 경계 (goal-system-tooling §8 원칙 유지):
- ``verify-goal`` fail → "Task 도출 권장" 메시지만. **자동 발행 X**.
- Task → 코드 변경 강제 X. ``status`` 자동 변경 X.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

import yaml


def _iso_str(value: Any) -> str:
    """yaml 이 datetime 으로 파싱한 timestamp 를 ISO8601 (T 구분자) 로 복원."""

    if isinstance(value, datetime):
        return value.isoformat(timespec="seconds")
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


_TASK_ID_RE = re.compile(r"^T-(\d{5})$")
_TASK_ID_FILE_RE = re.compile(r"T-(\d{5})")
_FRONTMATTER_RE = re.compile(
    r"\A---\s*\r?\n(?P<fm>.*?)\r?\n---\s*\r?\n?(?P<body>.*)\Z",
    re.DOTALL,
)
_H2_RE = re.compile(r"^##\s+(?P<title>.+?)\s*$", re.MULTILINE)

VALID_STATUSES = ("todo", "in_progress", "done", "cancelled")
TERMINAL_STATUSES = ("done", "cancelled")

# 설계 §3.4 — 허용 전이. {source: {target, ...}}.
ALLOWED_TRANSITIONS: Dict[str, frozenset] = {
    "todo": frozenset({"in_progress", "cancelled"}),
    "in_progress": frozenset({"done", "cancelled"}),
    "done": frozenset(),
    "cancelled": frozenset(),
}


class TaskTransitionError(ValueError):
    """status 전이가 ALLOWED_TRANSITIONS 위반."""


class TaskParseError(ValueError):
    """파싱 단계 오류 — 위치 정보 포함."""

    def __init__(self, message: str, source: Optional[Path] = None) -> None:
        prefix = f"[{source}] " if source is not None else ""
        super().__init__(f"{prefix}{message}")
        self.source = source


class TaskIdExhaustedError(RuntimeError):
    """T-00001 ~ T-99999 범위 소진."""


@dataclass
class Task:
    """파싱된 Task. frontmatter 메타데이터 + ``## Description`` 본문."""

    id: str
    title: str
    goal_ids: List[str]
    status: str
    created_at: str
    updated_at: str
    closed_at: Optional[str] = None
    constraint_violation: Optional[str] = None
    related_pr: Optional[int] = None
    related_commits: List[str] = field(default_factory=list)
    description: str = ""

    raw_frontmatter: Dict[str, Any] = field(default_factory=dict)
    raw_body: str = ""
    source_path: Optional[Path] = None


@dataclass
class TaskValidationError:
    task: str
    field: str
    message: str
    source: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "issue": "task_schema_violation",
            "task": self.task,
            "field": self.field,
            "message": self.message,
            "source": self.source,
        }

    def __str__(self) -> str:
        prefix = f"[{self.source}] " if self.source else ""
        return f"{prefix}{self.task}.{self.field}: {self.message}"


# ---------------------------------------------------------------------------
# parser
# ---------------------------------------------------------------------------


def _split_sections(body: str) -> Dict[str, str]:
    sections: Dict[str, str] = {}
    matches = list(_H2_RE.finditer(body))
    for idx, m in enumerate(matches):
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(body)
        title = m.group("title").strip()
        sections[title] = body[start:end].strip("\n")
    return sections


def parse_task_text(text: str, source: Optional[Path] = None) -> Task:
    match = _FRONTMATTER_RE.match(text)
    if not match:
        raise TaskParseError("YAML frontmatter (`---` 블록) 가 없다", source=source)
    try:
        fm = yaml.safe_load(match.group("fm")) or {}
    except yaml.YAMLError as exc:
        raise TaskParseError(f"frontmatter YAML 파싱 실패: {exc}", source=source) from exc
    if not isinstance(fm, dict):
        raise TaskParseError(
            f"frontmatter 는 YAML 매핑이어야 한다. 실제: {type(fm).__name__}",
            source=source,
        )

    body = match.group("body")
    sections = _split_sections(body)
    description = sections.get("Description", "").strip()

    return Task(
        id=str(fm.get("id", "")),
        title=str(fm.get("title", "")),
        goal_ids=[str(x) for x in (fm.get("goal_ids") or [])],
        status=str(fm.get("status", "")),
        created_at=_iso_str(fm.get("created_at", "")),
        updated_at=_iso_str(fm.get("updated_at", "")),
        closed_at=(_iso_str(fm["closed_at"]) if fm.get("closed_at") else None),
        constraint_violation=(
            str(fm["constraint_violation"]) if fm.get("constraint_violation") else None
        ),
        related_pr=(int(fm["related_pr"]) if fm.get("related_pr") is not None else None),
        related_commits=[str(x) for x in (fm.get("related_commits") or [])],
        description=description,
        raw_frontmatter=fm,
        raw_body=body,
        source_path=source,
    )


def parse_task_file(path: Path | str) -> Task:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    return parse_task_text(text, source=p)


def load_tasks(directory: Path | str) -> List[Task]:
    base = Path(directory)
    if not base.is_dir():
        raise FileNotFoundError(f"Tasks 디렉토리 없음: {base}")
    files = sorted({*base.glob("T-*.md"), *base.glob("**/T-*.md")})
    tasks: List[Task] = []
    for f in files:
        if f.name == "INDEX.md":
            continue
        tasks.append(parse_task_file(f))
    return tasks


# ---------------------------------------------------------------------------
# schema validation
# ---------------------------------------------------------------------------


def validate_tasks(tasks: Sequence[Task]) -> List[TaskValidationError]:
    """T-R2 + 형식 검증. T-R1/T-R3 는 ``validate_task_refs`` 에서 별도."""

    errors: List[TaskValidationError] = []
    seen: set[str] = set()
    for t in tasks:
        src = str(t.source_path) if t.source_path else None
        if not _TASK_ID_RE.match(t.id):
            errors.append(TaskValidationError(t.id, "id",
                f"형식 위반 — T-XXXXX 필요. 실제: {t.id!r}", src))
        if t.id in seen:
            errors.append(TaskValidationError(t.id, "id", "중복 ID", src))
        seen.add(t.id)
        if not t.title:
            errors.append(TaskValidationError(t.id, "title", "필수 필드 누락", src))
        elif len(t.title) > 80:
            errors.append(TaskValidationError(t.id, "title",
                f"길이 초과 (≤80, 실제 {len(t.title)})", src))
        if not t.goal_ids:
            errors.append(TaskValidationError(t.id, "goal_ids",
                "최소 1개 Goal 필요 (T-R1)", src))
        if t.status not in VALID_STATUSES:
            errors.append(TaskValidationError(t.id, "status",
                f"invalid value: {t.status!r} (허용: {VALID_STATUSES})", src))
        if t.status in TERMINAL_STATUSES and not t.closed_at:
            errors.append(TaskValidationError(t.id, "closed_at",
                f"status={t.status} 이지만 closed_at 비어있음 (T-R2)", src))
        if t.status not in TERMINAL_STATUSES and t.closed_at:
            errors.append(TaskValidationError(t.id, "closed_at",
                f"status={t.status} 이지만 closed_at 채워짐 — terminal status 만 허용", src))
    return errors


def validate_task_refs(
    tasks: Sequence[Task],
    *,
    goal_ids: set[str],
    constraint_ids: set[str],
) -> List[TaskValidationError]:
    """T-R1: ``goal_ids`` 가 실재 Goal / T-R3: ``constraint_violation`` 이 constraint."""

    errors: List[TaskValidationError] = []
    for t in tasks:
        src = str(t.source_path) if t.source_path else None
        for gid in t.goal_ids:
            if gid not in goal_ids:
                errors.append(TaskValidationError(t.id, "goal_ids",
                    f"실재하지 않는 Goal: {gid} (T-R1)", src))
        if t.constraint_violation and t.constraint_violation not in constraint_ids:
            errors.append(TaskValidationError(t.id, "constraint_violation",
                f"constraint Goal 이 아니거나 실재하지 않음: {t.constraint_violation} (T-R3)",
                src))
    return errors


# ---------------------------------------------------------------------------
# next-id
# ---------------------------------------------------------------------------


def used_task_ids(tasks_dir: Path | str) -> set[int]:
    base = Path(tasks_dir)
    if not base.is_dir():
        return set()
    used: set[int] = set()
    for f in base.glob("**/T-*.md"):
        m = _TASK_ID_FILE_RE.search(f.name)
        if m:
            used.add(int(m.group(1)))
    return used


def next_task_id(tasks_dir: Path | str) -> str:
    used = used_task_ids(tasks_dir)
    for n in range(1, 100000):
        if n not in used:
            return f"T-{n:05d}"
    raise TaskIdExhaustedError("Task ID 범위(1~99999) 가 소진되었다")


# ---------------------------------------------------------------------------
# new-task / close-task — 라이프사이클
# ---------------------------------------------------------------------------


@dataclass
class NewTaskRequest:
    title: str
    goal_ids: List[str]
    description: str = ""
    constraint_violation: Optional[str] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _format_yaml_list(items: Iterable[str]) -> str:
    items = list(items)
    if not items:
        return "[]"
    return "[" + ", ".join(items) + "]"


def _render_frontmatter(task: Task) -> str:
    """Frontmatter 블록만 렌더 — body 와 합치는 것은 호출자 책임."""

    lines: List[str] = []
    lines.append("---")
    lines.append(f"id: {task.id}")
    lines.append(f"title: {task.title}")
    lines.append(f"goal_ids: {_format_yaml_list(task.goal_ids)}")
    lines.append(f"status: {task.status}")
    lines.append(f"created_at: {task.created_at}")
    lines.append(f"updated_at: {task.updated_at}")
    lines.append(f"closed_at: {task.closed_at if task.closed_at else 'null'}")
    if task.constraint_violation:
        lines.append(f"constraint_violation: {task.constraint_violation}")
    lines.append(f"related_commits: {_format_yaml_list(task.related_commits)}")
    lines.append(f"related_pr: {task.related_pr if task.related_pr is not None else 'null'}")
    lines.append("---")
    return "\n".join(lines)


def render_task(task: Task) -> str:
    """Task 객체를 파일 텍스트로 직렬화 (라운드트립).

    raw_body 가 있으면 그대로 보존 — 사용자가 추가한 ``## Notes`` 같은 보조 섹션
    이 close-task 등에서 손실되지 않도록 한다. raw_body 가 비어있으면 표준
    ``## Description`` 골격 + ``description`` 필드로 신규 생성 형식을 따른다.
    """

    fm = _render_frontmatter(task)
    body = task.raw_body or ""
    if body.strip():
        # raw_body 는 파서가 frontmatter 직후부터 보존한 텍스트. 선두 개행이
        # 0~N 개일 수 있으므로 모두 제거 후 항상 빈 줄 1개 (= "\n\n") 보장.
        return fm + "\n\n" + body.lstrip("\n")
    # 신규 Task — 표준 골격
    return (
        fm
        + "\n\n## Description\n\n"
        + (task.description or "TODO")
        + "\n"
    )


def render_new_task(req: NewTaskRequest, *, task_id: str, now: Optional[str] = None) -> str:
    ts = now or _now_iso()
    task = Task(
        id=task_id,
        title=req.title,
        goal_ids=list(req.goal_ids),
        status="todo",
        created_at=ts,
        updated_at=ts,
        constraint_violation=req.constraint_violation,
        description=req.description,
    )
    return render_task(task)


def new_task(
    req: NewTaskRequest,
    tasks_dir: Path | str,
    *,
    overwrite: bool = False,
) -> Path:
    base = Path(tasks_dir)
    base.mkdir(parents=True, exist_ok=True)
    task_id = next_task_id(base)
    target = base / f"{task_id}.md"
    if target.exists() and not overwrite:
        raise FileExistsError(f"이미 존재한다: {target}")
    text = render_new_task(req, task_id=task_id)
    target.write_text(text, encoding="utf-8")
    return target


def _transition(task: Task, new_status: str) -> None:
    """ALLOWED_TRANSITIONS 강제 — 위반 시 TaskTransitionError."""

    allowed = ALLOWED_TRANSITIONS.get(task.status, frozenset())
    if new_status not in allowed:
        raise TaskTransitionError(
            f"{task.id}: {task.status} → {new_status} 전이 불가 "
            f"(허용: {sorted(allowed) or 'terminal'})"
        )
    task.status = new_status


def start_task(task_id: str, tasks_dir: Path | str) -> Path:
    """todo → in_progress 전이."""

    base = Path(tasks_dir)
    target = base / f"{task_id}.md"
    if not target.exists():
        raise FileNotFoundError(f"Task 파일 없음: {target}")
    task = parse_task_file(target)
    _transition(task, "in_progress")
    task.updated_at = _now_iso()
    target.write_text(render_task(task), encoding="utf-8")
    return target


def close_task(
    task_id: str,
    tasks_dir: Path | str,
    *,
    final_status: str = "done",
    commit: Optional[str] = None,
    pr: Optional[int] = None,
) -> Path:
    """terminal status (done/cancelled) 로 전이.

    설계 §3.4 강제: done 은 in_progress 에서만, cancelled 는 todo/in_progress
    에서. 이미 terminal 인 Task 재닫기 차단.
    """

    if final_status not in TERMINAL_STATUSES:
        raise ValueError(
            f"final_status 는 {TERMINAL_STATUSES} 중 하나. 실제: {final_status!r}"
        )
    base = Path(tasks_dir)
    target = base / f"{task_id}.md"
    if not target.exists():
        raise FileNotFoundError(f"Task 파일 없음: {target}")

    task = parse_task_file(target)
    _transition(task, final_status)
    now = _now_iso()
    task.updated_at = now
    task.closed_at = now
    if commit and commit not in task.related_commits:
        task.related_commits.append(commit)
    if pr is not None:
        task.related_pr = pr
    target.write_text(render_task(task), encoding="utf-8")
    return target


# ---------------------------------------------------------------------------
# render-task-index
# ---------------------------------------------------------------------------


_AUTOGEN_HEADER = (
    "> ⚠️ 자동 생성 — 직접 수정 금지. "
    "`python -m goalsys.cli render-task-index` 로 재생성한다."
)


def generate_task_index(
    tasks: Sequence[Task],
    *,
    goal_titles: Optional[Dict[str, str]] = None,
    generated_at: Optional[str] = None,
) -> str:
    """INDEX.md — By Status / By Goal / Open Backlog (생성 순)."""

    timestamp = generated_at or _now_iso()
    titles = goal_titles or {}

    out: List[str] = []
    out.append("# Tasks Index")
    out.append("")
    out.append(_AUTOGEN_HEADER)
    out.append(f"> Last generated: {timestamp}")
    out.append(f"> Total tasks: {len(tasks)}")
    out.append("")

    # By Status
    out.append("## By Status")
    out.append("")
    by_status: Dict[str, List[Task]] = {s: [] for s in VALID_STATUSES}
    for t in tasks:
        if t.status in by_status:
            by_status[t.status].append(t)
    for status in VALID_STATUSES:
        bucket = by_status[status]
        out.append(f"### {status} ({len(bucket)})")
        out.append("")
        if not bucket:
            out.append("_(없음)_")
            out.append("")
            continue
        for t in sorted(bucket, key=lambda x: x.id):
            goals_str = ", ".join(t.goal_ids)
            out.append(f"- {t.id} {t.title} _(→ {goals_str})_")
        out.append("")

    # By Goal
    out.append("## By Goal")
    out.append("")
    by_goal: Dict[str, List[Task]] = {}
    for t in tasks:
        for gid in t.goal_ids:
            by_goal.setdefault(gid, []).append(t)
    if not by_goal:
        out.append("_(Task 없음)_")
        out.append("")
    for gid in sorted(by_goal.keys()):
        bucket = by_goal[gid]
        title = titles.get(gid, "")
        header = f"### {gid}"
        if title:
            header += f" {title}"
        out.append(f"{header} ({len(bucket)})")
        out.append("")
        # open 우선, 그다음 closed
        bucket_sorted = sorted(bucket, key=lambda x: (x.status in TERMINAL_STATUSES, x.id))
        for t in bucket_sorted:
            out.append(f"- {t.id} {t.title} _(status: {t.status})_")
        out.append("")

    # Open Backlog (생성 순) — 가장 오래된 todo/in_progress 우선
    open_tasks = [t for t in tasks if t.status not in TERMINAL_STATUSES]
    out.append(f"## Open Backlog ({len(open_tasks)})")
    out.append("")
    if not open_tasks:
        out.append("_(open task 없음)_")
        out.append("")
    else:
        for t in sorted(open_tasks, key=lambda x: x.created_at):
            goals_str = ", ".join(t.goal_ids)
            out.append(f"- {t.id} _(created {t.created_at})_ — {t.title} → {goals_str}")
        out.append("")

    return "\n".join(out).rstrip() + "\n"
