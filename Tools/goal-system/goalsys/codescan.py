"""Phase 2 — `scan-code-tags`: 코드 → Goal 역참조 스캐너.

설계 §5.3 (Code → Goal 형식) + 도구 §5.1 명세 구현.

두 가지 표기를 모두 인식한다:
- 파일 헤더 태그: 파일 시작 ~ 첫 코드 줄. 정규식 ``@goal:\\s*G-\\d{4}\\b``.
- 디렉토리 GOALS.md: ``## Realizes`` 섹션의 ``- G-XXXX`` 항목.

스캔 대상은 텍스트 코드 파일이며 빌드 산출물·임시 디렉토리는 무시한다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple


# ---------------------------------------------------------------------------
# 정규식·상수
# ---------------------------------------------------------------------------

# 도구 §5.1 의 정규식. 4자리 이상의 숫자도 허용 (스키마는 별도 검증).
_GOAL_TAG_RE = re.compile(r"@goal:\s*(G-\d{4,})\b")
_REALIZES_HEADER_RE = re.compile(r"^##\s+Realizes\s*$", re.IGNORECASE)
_NEXT_HEADER_RE = re.compile(r"^##\s+\S")
_GOAL_BULLET_RE = re.compile(r"^\s*[-*]\s+\*?\*?(G-\d{4,})\*?\*?")

# 코드 파일로 인식할 확장자.
_CODE_EXTENSIONS: frozenset[str] = frozenset({
    ".h", ".hpp", ".hh", ".hxx", ".inl",
    ".c", ".cc", ".cpp", ".cxx",
    ".cs", ".py", ".rs", ".go", ".java", ".kt", ".scala",
    ".js", ".jsx", ".ts", ".tsx",
    ".lua", ".rb", ".swift",
    ".m", ".mm",
    ".usf", ".ush", ".hlsl", ".glsl",
    ".cmake",
})

# 무시할 디렉토리 이름 (어느 깊이에서든 매칭).
_IGNORED_DIRS: frozenset[str] = frozenset({
    ".git", ".hg", ".svn",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "node_modules", ".venv", "venv",
    "Binaries", "Intermediate", "Saved", "DerivedDataCache",
    "build", "Build", "out", "dist", "target",
})

# 무시할 파일 확장자 (컴파일 산출물·바이너리).
_IGNORED_EXTENSIONS: frozenset[str] = frozenset({
    ".o", ".obj", ".exe", ".bin", ".lib", ".a",
    ".so", ".dll", ".dylib", ".pdb",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tga",
    ".uasset", ".umap", ".upk",
    ".zip", ".tar", ".gz", ".7z",
})

# 헤더 영역으로 간주할 최대 라인 수 — `@goal:` 태그를 검색할 윈도우.
HEADER_SCAN_LINES = 50


# ---------------------------------------------------------------------------
# 결과 자료구조
# ---------------------------------------------------------------------------


@dataclass
class CodeTagIndex:
    """`scan-code-tags` 의 출력.

    Attributes:
        file_tags: 파일 경로(프로젝트 루트 기준 상대) → 헤더에서 추출한 Goal ID 목록.
        dir_tags:  디렉토리 경로(프로젝트 루트 기준 상대) → 해당 디렉토리 ``GOALS.md`` 의
            ``## Realizes`` 섹션에서 추출한 Goal ID 목록.
        project_root: 스캔 시 사용한 루트 (이후 경로 정규화에 활용).
    """

    file_tags: Dict[str, List[str]] = field(default_factory=dict)
    dir_tags: Dict[str, List[str]] = field(default_factory=dict)
    project_root: Optional[Path] = None

    def tags_for(self, rel_path: str) -> List[str]:
        """파일 경로에 적용되는 모든 Goal ID 를 반환한다.

        파일 헤더 태그 + 그 디렉토리(및 상위 디렉토리 GOALS.md) 의 태그 합집합.
        중복은 제거하되 입력 순서를 보존한다.
        """

        out: List[str] = []
        seen: Set[str] = set()

        def add(ids: Iterable[str]) -> None:
            for gid in ids:
                if gid in seen:
                    continue
                seen.add(gid)
                out.append(gid)

        add(self.file_tags.get(rel_path, []))

        # 상위 디렉토리들의 GOALS.md 도 적용 — 가까운 디렉토리부터.
        rel = Path(rel_path)
        for d in [rel.parent, *rel.parents]:
            key = _normalize_rel(d)
            if key in self.dir_tags:
                add(self.dir_tags[key])
        return out


# ---------------------------------------------------------------------------
# 파서
# ---------------------------------------------------------------------------


def extract_header_tags(text: str, *, max_lines: int = HEADER_SCAN_LINES) -> List[str]:
    """파일 텍스트에서 헤더 영역의 ``@goal: G-XXXX`` 태그를 추출한다.

    헤더 영역 = 파일 시작부터 첫 ``코드 줄`` 이전까지. 헤더 후보 라인 = 빈 줄,
    일반적 주석 토큰(``//``, ``/*``, ``*``, ``#``, ``--``, ``;;``) 으로 시작,
    markdown frontmatter 구분선(``---``), Python docstring 시작 따옴표,
    셔뱅(``#!``). 그 외의 줄은 첫 코드 줄로 판정해 검색을 중단한다.
    어쨌든 ``max_lines`` 라인 이후로는 더 이상 검색하지 않는다.
    """

    out: List[str] = []
    seen: Set[str] = set()
    for idx, raw in enumerate(text.splitlines()):
        if idx >= max_lines:
            break
        line = raw.strip()
        # 헤더 후보 라인이 아니면(첫 코드 줄) 즉시 중단 — 코드 본문의 ``@goal:`` 은 무시.
        if not _looks_like_header(line):
            break
        for m in _GOAL_TAG_RE.finditer(line):
            gid = m.group(1)
            if gid not in seen:
                seen.add(gid)
                out.append(gid)
    return out


def _looks_like_header(line: str) -> bool:
    """라인이 (잠재적으로) 주석/메타데이터로 보이면 True. 첫 코드 줄을 식별하기 위한 휴리스틱."""

    if not line:
        return True
    # 셔뱅·encoding 선언.
    if line.startswith("#!"):
        return True
    # C/C++ 주석.
    if line.startswith("//") or line.startswith("/*") or line.startswith("*"):
        return True
    # python/shell 주석.
    if line.startswith("#"):
        return True
    # SQL/Lua/Haskell.
    if line.startswith("--") or line.startswith(";;"):
        return True
    # docstring 또는 markdown frontmatter.
    if line.startswith('"""') or line.startswith("'''") or line.startswith("---"):
        return True
    return False


def parse_goals_md(text: str) -> List[str]:
    """``## Realizes`` 섹션의 Goal ID 를 추출한다.

    섹션은 ``## Realizes`` 부터 다음 ``## ...`` 헤더 직전까지로 본다.
    각 줄에서 ``- G-XXXX`` (또는 ``* G-XXXX``) 패턴을 매칭한다.
    """

    lines = text.splitlines()
    in_section = False
    out: List[str] = []
    seen: Set[str] = set()
    for raw in lines:
        if _REALIZES_HEADER_RE.match(raw):
            in_section = True
            continue
        if in_section and _NEXT_HEADER_RE.match(raw):
            break
        if not in_section:
            continue
        m = _GOAL_BULLET_RE.match(raw)
        if m:
            gid = m.group(1)
            if gid not in seen:
                seen.add(gid)
                out.append(gid)
    return out


# ---------------------------------------------------------------------------
# 디렉토리 워커
# ---------------------------------------------------------------------------


def _normalize_rel(path: Path) -> str:
    """경로를 프로젝트 루트 기준 상대 경로 + POSIX 슬래시로 정규화한다.

    빈 경로(`Path('.')`) 는 빈 문자열로 표현해 일관된 키로 쓴다.
    """

    if str(path) in {".", ""}:
        return ""
    return str(path).replace("\\", "/")


def _is_ignored_dir(name: str) -> bool:
    return name in _IGNORED_DIRS


def _is_code_file(name: str) -> bool:
    suffix = Path(name).suffix.lower()
    if not suffix:
        return False
    if suffix in _IGNORED_EXTENSIONS:
        return False
    return suffix in _CODE_EXTENSIONS


def scan_code_tags(root: Path | str) -> CodeTagIndex:
    """프로젝트 루트(또는 임의 디렉토리)에서 ``@goal:`` 태그와 ``GOALS.md`` 를 스캔한다.

    Args:
        root: 스캔 시작점. 파일을 넘기면 단일 파일만 검사한다.

    Returns:
        모든 매칭을 담은 :class:`CodeTagIndex`. 경로는 ``root`` 기준 상대 + POSIX.
    """

    base = Path(root)
    index = CodeTagIndex(project_root=base.resolve())

    if base.is_file():
        _scan_file(base, base.parent, index)
        return index

    if not base.is_dir():
        raise FileNotFoundError(f"스캔 대상이 존재하지 않는다: {base}")

    for path in _walk(base):
        _scan_file(path, base, index)
    return index


def _walk(root: Path) -> Iterable[Path]:
    """``os.walk`` 대체. 무시 디렉토리를 가지치기하며 파일 경로 yield."""

    stack: List[Path] = [root]
    while stack:
        current = stack.pop()
        try:
            entries = sorted(current.iterdir())
        except (PermissionError, FileNotFoundError):
            continue
        for entry in entries:
            if entry.is_dir():
                if _is_ignored_dir(entry.name):
                    continue
                stack.append(entry)
            elif entry.is_file():
                yield entry


def _scan_file(path: Path, root: Path, index: CodeTagIndex) -> None:
    name = path.name
    rel_path = path.relative_to(root) if path.is_relative_to(root) else path

    if name == "GOALS.md":
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return
        goals = parse_goals_md(text)
        if goals:
            index.dir_tags[_normalize_rel(rel_path.parent)] = goals
        return

    if not _is_code_file(name):
        return

    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return
    tags = extract_header_tags(text)
    if tags:
        index.file_tags[_normalize_rel(rel_path)] = tags
