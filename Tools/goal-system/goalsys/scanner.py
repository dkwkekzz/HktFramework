"""Task 2.2 — 코드 내 `@goal: G-XXXX` 태그 / `GOALS.md` 모듈 문서 스캐너.

설계 §5.2 의 두 가지 역방향(Code → Goal) 표기 모두를 지원한다.

1) **인라인 태그** — 임의의 소스 파일 내 코멘트 라인:

       // @goal: G-0142 (대량 적 렌더링 60fps)
       // @goal: G-0001 (결정성 보존)  // 제약

   - ``@goal:`` 또는 ``@goal`` 직후 공백, 그리고 ``G-NNNN`` ID.
   - ID 위치 **이전** 에 코멘트 시작 마커(``//``, ``/*``, ``#``, ``--``,
     ``;``, ``<!--``, 또는 라인 선두의 ``*``) 가 있어야만 인식한다 — 코드
     문자열 안의 거짓양성 차단용.
   - ID **뒤** 의 텍스트 중 *괄호 밖* 영역에 ``제약`` 또는 ``constraint``
     가 등장하면 :attr:`CodeTag.kind` 가 ``"constraint"`` 가 된다 (그 외는
     ``"realizes"``). Goal 제목이 괄호 안에 들어 있어도 오분류되지 않는다.

2) **모듈 문서** — 모듈 디렉토리의 ``GOALS.md`` 파일:

       ## Realizes
       - G-0142: ...

       ## Respects (Constraints)
       - G-0003: ...

   - ``Realizes`` H2 섹션의 ID 들은 ``kind="realizes"``,
     ``Respects`` 가 들어간 H2 섹션의 ID 들은 ``kind="constraint"``.

스캐너는 :class:`CodeTag` 의 평탄한 리스트를 반환하며, 양방향 일관성
(:mod:`goalsys.consistency`) 단계에서 Goal 파일과 대조된다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Sequence


# 인라인 태그용 정규식 — `@goal` 다음에 선택적 콜론, 공백, 그리고 ID.
_INLINE_TAG_RE = re.compile(r"@goal\s*:?\s*(?P<id>G-\d{4,})")
# 코멘트 시작 마커 — ID 가 코드 문자열이 아닌 코멘트 안에 있어야 한다는
# 약한 보장(완전한 토크나이저는 아니지만 대부분의 거짓양성을 차단).
# 인식 대상: //, /*, *(블록 코멘트 라인), #, --, ;, <!--
_COMMENT_PREFIX_RE = re.compile(r"(//|/\*|^\s*\*|#|--|;|<!--)")
# 같은 라인 내 제약 마커 — 괄호 밖 텍스트에서 검색해야 거짓양성이 줄어든다.
_CONSTRAINT_MARK_RE = re.compile(r"제약|constraint", re.IGNORECASE)
_PAREN_RE = re.compile(r"\([^)]*\)")
# GOALS.md 의 H2 헤더.
_H2_RE = re.compile(r"^##\s+(?P<title>.+?)\s*$", re.MULTILINE)
# GOALS.md 본문 라인의 ID 추출 — `- G-0142: ...`, `- G-0142 ...`, `* G-0142`.
_GOALSMD_ID_RE = re.compile(r"^[\s\-*+]+(?P<id>G-\d{4,})\b")


# 코드로 간주할 기본 확장자 (대소문자 무시 매치).
DEFAULT_CODE_SUFFIXES: frozenset[str] = frozenset({
    ".cpp", ".cc", ".cxx", ".c",
    ".h", ".hh", ".hpp", ".hxx", ".inl", ".ipp",
    ".cs", ".py", ".ts", ".tsx", ".js", ".jsx",
    ".rs", ".go", ".java", ".kt", ".swift",
    ".lua", ".sh", ".ps1", ".bat",
    ".usf", ".ush",  # UE shader
})

# 스캔에서 제외할 디렉토리(이름 기준 부분 일치).
DEFAULT_EXCLUDE_DIRS: frozenset[str] = frozenset({
    ".git", ".vs", ".vscode", ".idea",
    "node_modules", "__pycache__", ".pytest_cache",
    "Saved", "Intermediate", "Binaries", "DerivedDataCache",
    "Build", "build", "dist", "out",
})


@dataclass
class CodeTag:
    """코드/문서 측에 표기된 ``Goal ↔ Code`` 매핑 한 건."""

    goal_id: str
    file_path: Path           # repo_root 기준 상대 경로 (스캐너가 정규화)
    line_no: int              # 1-based. GOALS.md 항목은 해당 리스트 항목 라인.
    kind: str                 # "realizes" 또는 "constraint"
    source_kind: str          # "inline" (코드 코멘트) 또는 "goals_md"
    raw: str                  # 매치된 원문 라인 (디버깅용)

    def __str__(self) -> str:
        return f"{self.file_path}:{self.line_no} @goal {self.goal_id} [{self.kind}/{self.source_kind}]"


def _is_excluded_dir(rel: Path, excludes: Iterable[str]) -> bool:
    parts = set(rel.parts)
    return any(ex in parts for ex in excludes)


def _has_comment_prefix(line: str, id_start: int) -> bool:
    """ID 시작 위치 이전 텍스트에 코멘트 시작 마커가 있는가.

    완전한 토크나이저는 아니다. 멀티라인 docstring/문자열 안의 예시는
    여전히 매치될 수 있다 — 그러나 코드 변수에 우연히 들어간 ``"@goal: G-0142"``
    같은 거짓양성은 차단된다.
    """

    return bool(_COMMENT_PREFIX_RE.search(line[:id_start]))


def _is_constraint_marker(line_after_id: str) -> bool:
    """ID 뒤 텍스트에서 괄호 밖에 ``제약``/``constraint`` 가 등장하는가.

    설계 §5.2:

        // @goal: G-0001 (결정성 보존)  // 제약   ← 괄호는 Goal 제목, 마커는 그 밖.

    괄호 안 텍스트에 우연히 "제약 관리" 같은 단어가 들어가도 오분류되지 않게 한다.
    """

    stripped = _PAREN_RE.sub("", line_after_id)
    return bool(_CONSTRAINT_MARK_RE.search(stripped))


def _extract_inline_tags(
    line: str,
    *,
    line_no: int,
    rel: Path,
) -> List["CodeTag"]:
    """단일 라인의 모든 인라인 태그를 추출한다 (코멘트 prefix 보장).

    한 라인에 여러 ID 가 있을 수 있으므로, 각 ID 의 트레일링 텍스트는
    *다음 ID 직전* 까지만 검사하여 마커가 옆 태그로 누설되지 않게 한다.
    """

    out: List[CodeTag] = []
    matches = list(_INLINE_TAG_RE.finditer(line))
    for i, match in enumerate(matches):
        if not _has_comment_prefix(line, match.start()):
            continue
        next_start = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        trailing = line[match.end():next_start]
        kind = "constraint" if _is_constraint_marker(trailing) else "realizes"
        out.append(CodeTag(
            goal_id=match.group("id"),
            file_path=rel,
            line_no=line_no,
            kind=kind,
            source_kind="inline",
            raw=line.strip(),
        ))
    return out


def _iter_files(
    repo_root: Path,
    *,
    suffixes: Iterable[str],
    excludes: Iterable[str],
    extra_names: Iterable[str] = (),
) -> Iterable[Path]:
    """repo_root 하위에서 대상 파일들을 yield 한다 (rglob 순회)."""

    suffixes_lower = {s.lower() for s in suffixes}
    extra_set = set(extra_names)
    for path in repo_root.rglob("*"):
        if not path.is_file():
            continue
        try:
            rel = path.relative_to(repo_root)
        except ValueError:
            continue
        if _is_excluded_dir(rel.parent, excludes):
            continue
        if path.name in extra_set or path.suffix.lower() in suffixes_lower:
            yield path


def _scan_inline_file(path: Path, rel: Path) -> List[CodeTag]:
    """단일 코드 파일의 모든 라인에서 ``@goal:`` 태그를 추출한다."""

    out: List[CodeTag] = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return out
    for line_no, line in enumerate(text.splitlines(), start=1):
        out.extend(_extract_inline_tags(line, line_no=line_no, rel=rel))
    return out


def _scan_goals_md(path: Path, rel: Path) -> List[CodeTag]:
    """``GOALS.md`` 의 ``Realizes`` / ``Respects`` 섹션에서 ID 들을 추출한다.

    GOALS.md 자체는 보통 모듈 디렉토리에 위치한다. 우리는 ``GOALS.md`` 파일의
    위치(보통 모듈 루트)를 ``file_path`` 로 보고한다 — 양방향 일관성 검사 시
    Goal 의 ``realizes[].path`` 가 모듈 디렉토리를 가리키는 경우와 매칭하기
    쉽다.
    """

    out: List[CodeTag] = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return out

    lines = text.splitlines()
    # H2 헤더 위치 → (제목, 본문 시작 라인 인덱스, 끝 라인 인덱스)
    headers = list(_H2_RE.finditer(text))
    if not headers:
        return out

    # 라인 번호 기준 헤더 위치를 다시 계산 (offset → line index).
    def _offset_to_line(offset: int) -> int:
        # 1-based line number.
        return text.count("\n", 0, offset) + 1

    section_ranges: List[tuple[str, int, int]] = []
    for i, h in enumerate(headers):
        title = h.group("title").strip()
        start_line = _offset_to_line(h.end())
        end_line = (
            _offset_to_line(headers[i + 1].start()) - 1 if i + 1 < len(headers)
            else len(lines)
        )
        section_ranges.append((title, start_line, end_line))

    for title, start_line, end_line in section_ranges:
        title_lower = title.lower()
        if "realize" in title_lower:
            kind = "realizes"
        elif "respect" in title_lower or "constraint" in title_lower:
            kind = "constraint"
        else:
            continue
        for ln in range(start_line, end_line + 1):
            if ln <= 0 or ln > len(lines):
                continue
            line = lines[ln - 1]
            m = _GOALSMD_ID_RE.match(line)
            if not m:
                continue
            out.append(CodeTag(
                goal_id=m.group("id"),
                file_path=rel,
                line_no=ln,
                kind=kind,
                source_kind="goals_md",
                raw=line.strip(),
            ))
    return out


def scan_repo(
    repo_root: Path | str,
    *,
    suffixes: Optional[Iterable[str]] = None,
    excludes: Optional[Iterable[str]] = None,
    include_goals_md: bool = True,
    extra_files: Optional[Sequence[Path]] = None,
) -> List[CodeTag]:
    """저장소 전체를 스캔하여 :class:`CodeTag` 리스트를 반환한다.

    Args:
        repo_root: 스캔 루트.
        suffixes: 인라인 태그 스캔 대상 확장자. 기본 :data:`DEFAULT_CODE_SUFFIXES`.
        excludes: 제외할 디렉토리 이름들. 기본 :data:`DEFAULT_EXCLUDE_DIRS`.
        include_goals_md: ``GOALS.md`` 파일도 스캔할지.
        extra_files: 명시적으로 추가 스캔할 파일들 (테스트용).
    """

    root = Path(repo_root).resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"스캔 루트가 디렉토리가 아니다: {root}")

    suffix_set = frozenset(suffixes) if suffixes is not None else DEFAULT_CODE_SUFFIXES
    exclude_set = frozenset(excludes) if excludes is not None else DEFAULT_EXCLUDE_DIRS
    extra_names = {"GOALS.md"} if include_goals_md else set()

    tags: List[CodeTag] = []
    for path in _iter_files(
        root, suffixes=suffix_set, excludes=exclude_set, extra_names=extra_names
    ):
        rel = path.relative_to(root)
        if path.name == "GOALS.md":
            tags.extend(_scan_goals_md(path, rel))
        else:
            tags.extend(_scan_inline_file(path, rel))

    if extra_files:
        for extra in extra_files:
            extra_path = Path(extra)
            try:
                rel = extra_path.relative_to(root)
            except ValueError:
                rel = extra_path
            if extra_path.name == "GOALS.md":
                tags.extend(_scan_goals_md(extra_path, rel))
            else:
                tags.extend(_scan_inline_file(extra_path, rel))

    return tags


def scan_text(text: str, file_path: Path | str = Path("<memory>")) -> List[CodeTag]:
    """문자열로부터 인라인 태그만 스캔한다 (테스트/단발 검사용)."""

    rel = Path(file_path)
    out: List[CodeTag] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        out.extend(_extract_inline_tags(line, line_no=line_no, rel=rel))
    return out
