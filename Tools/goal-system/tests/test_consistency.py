"""Task 2.3 — Goal ↔ Code 양방향 일관성 검사 테스트."""

from __future__ import annotations

from pathlib import Path

from goalsys.consistency import check_consistency
from goalsys.parser import Goal


def _goal(
    gid: str,
    realizes_paths: list[str] | None = None,
) -> Goal:
    return Goal(
        id=gid,
        title=f"goal {gid}",
        status="active",
        created_at="2026-05-04",
        updated_at="2026-05-04",
        intent="x",
        success_criteria=[{"description": "x"}],
        realizes=[{"path": p, "role": "x"} for p in (realizes_paths or [])],
    )


def _write(tmp: Path, rel: str, content: str) -> Path:
    p = tmp / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return p


def test_all_consistent(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "Source/Module/File.cpp",
        "// @goal: G-0142\nint main(){}\n",
    )
    g = _goal("G-0142", ["Source/Module/File.cpp"])
    issues = check_consistency([g], tmp_path)
    assert issues == [], issues


def test_realizes_path_missing_is_error(tmp_path: Path) -> None:
    g = _goal("G-0142", ["Source/Missing.cpp"])
    issues = check_consistency([g], tmp_path)
    assert any(
        i.severity == "error" and i.rule == "RealizesPathMissing"
        for i in issues
    )


def test_unknown_goal_tag_is_error(tmp_path: Path) -> None:
    _write(tmp_path, "Source/A.cpp", "// @goal: G-9999\n")
    issues = check_consistency([], tmp_path)
    assert any(
        i.severity == "error" and i.rule == "UnknownGoalTag" and i.goal_id == "G-9999"
        for i in issues
    )


def test_missing_tag_warning(tmp_path: Path) -> None:
    # 파일은 실재하지만 @goal 태그가 없어 → MissingTag 경고.
    _write(tmp_path, "Source/Module/File.cpp", "int main(){}\n")
    g = _goal("G-0142", ["Source/Module/File.cpp"])
    issues = check_consistency([g], tmp_path)
    assert any(
        i.severity == "warning" and i.rule == "MissingTag" and i.goal_id == "G-0142"
        for i in issues
    )


def test_missing_realizes_warning(tmp_path: Path) -> None:
    # 코드에는 태그가 있지만 Goal.realizes 에는 미등록.
    _write(tmp_path, "Source/Module/File.cpp", "// @goal: G-0142\n")
    _write(tmp_path, "Other/Place.cpp", "")  # realizes 가 가리키는 다른 파일
    g = _goal("G-0142", ["Other/Place.cpp"])
    issues = check_consistency([g], tmp_path)
    assert any(
        i.severity == "warning" and i.rule == "MissingRealizes" and i.goal_id == "G-0142"
        for i in issues
    )


def test_directory_scope_match(tmp_path: Path) -> None:
    # Goal.realizes 가 디렉토리 → 그 하위 파일에 태그가 있으면 매치 (양쪽 OK).
    _write(tmp_path, "Source/HktVoxelCore/A.cpp", "// @goal: G-0142\n")
    g = _goal("G-0142", ["Source/HktVoxelCore"])
    issues = check_consistency([g], tmp_path)
    assert [i for i in issues if i.severity == "error"] == []
    # 디렉토리 스코프 매치이므로 양방향 경고도 없어야 한다.
    assert [i for i in issues if i.severity == "warning"] == []


def test_constraint_tag_does_not_trigger_realizes_warning(tmp_path: Path) -> None:
    # `@goal: G-0001 (결정성 보존)  // 제약` 은 제약 표기 — realizes 비교 대상 아님.
    _write(
        tmp_path,
        "Source/A.cpp",
        "// @goal: G-0001 (결정성 보존)  // 제약\n",
    )
    g_constraint = _goal("G-0001", [])  # 제약 Goal — realizes 없음
    issues = check_consistency([g_constraint], tmp_path)
    # constraint 태그는 MissingRealizes 경고에서 제외되어야 한다.
    assert not any(
        i.rule == "MissingRealizes" and i.goal_id == "G-0001"
        for i in issues
    )


def test_goals_md_module_match(tmp_path: Path) -> None:
    # GOALS.md 가 모듈 디렉토리에 있고, realizes 가 모듈 디렉토리를 가리키면 매치.
    _write(
        tmp_path,
        "Source/HktVoxelCore/GOALS.md",
        "## Realizes\n- G-0142: 대량 적 렌더링\n",
    )
    g = _goal("G-0142", ["Source/HktVoxelCore"])
    issues = check_consistency([g], tmp_path)
    assert [i for i in issues if i.severity == "error"] == []
    assert not any(i.rule == "MissingRealizes" for i in issues)


def test_glob_realizes_matches(tmp_path: Path) -> None:
    _write(tmp_path, "Source/Module/A.cpp", "// @goal: G-0142\n")
    _write(tmp_path, "Source/Module/B.cpp", "// @goal: G-0142\n")
    g = _goal("G-0142", ["Source/Module/*.cpp"])
    issues = check_consistency([g], tmp_path)
    assert [i for i in issues if i.severity == "error"] == []
    assert not any(i.rule == "MissingTag" or i.rule == "MissingRealizes" for i in issues)


def test_pre_scanned_tags_are_used(tmp_path: Path) -> None:
    """tags 인자를 명시하면 디스크 스캔을 건너뛴다."""

    _write(tmp_path, "Source/A.cpp", "// @goal: G-0142\n")
    g = _goal("G-0142", ["Source/A.cpp"])
    # 빈 tags 리스트 → 코드에 태그가 없는 것처럼 동작 → MissingTag 경고
    issues = check_consistency([g], tmp_path, tags=[])
    assert any(i.rule == "MissingTag" for i in issues)
