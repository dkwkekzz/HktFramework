#!/usr/bin/env python3
"""
HktAutomationTests CLI Runner

UnrealEditor-Cmd.exe 를 헤드리스로 띄워 UE Automation 테스트를 실행하고,
결과 JSON 리포트를 파싱하여 Agent가 소비하기 좋은 구조로 stdout 에 출력한다.

사용법:
  python run_automation_tests.py [--filter HktCore.Story]
                                 [--engine PATH]
                                 [--uproject PATH]
                                 [--timeout 1800]
                                 [--full]               # 전체 결과(성공 포함) 출력
                                 [--report-dir PATH]    # 임시 리포트 디렉토리

설정 우선순위(높은 → 낮음):
  1. CLI 인자 (--engine, --uproject, --filter)
  2. 환경 변수 (UE_ENGINE_PATH, UE_PROJECT_FILE, HKT_TEST_FILTER)
  3. .hkt-test.env  (이 스크립트와 같은 폴더에 위치)

종료 코드:
  0  — 모든 테스트 통과
  1  — 1개 이상 실패
  2  — 실행/파싱 오류 (UE를 띄우지 못함, 리포트 없음 등)
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
ENV_FILE = SCRIPT_DIR / ".hkt-test.env"

# Hkt 프로젝트의 자동 테스트는 모두 `HktCore.` prefix 또는 별도로 등록된
# `Hkt` prefix 의 IMPLEMENT_SIMPLE_AUTOMATION_TEST 매크로로 노출된다.
DEFAULT_FILTER = "HktCore"


@dataclass
class TestFailure:
    test_name: str
    full_test_path: str
    errors: list[str]
    warnings: list[str]
    duration_ms: float


@dataclass
class TestRunSummary:
    success: bool
    total: int
    passed: int
    failed: int
    skipped: int
    duration_seconds: float
    filter: str
    failures: list[TestFailure]
    raw_report_path: str
    stdout_tail: str
    stderr_tail: str

    def to_json(self, include_passes: bool = False) -> str:
        d = asdict(self)
        if not include_passes:
            d.pop("stdout_tail", None)
        return json.dumps(d, indent=2, ensure_ascii=False)


def _load_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        out[key.strip()] = val.strip().strip('"').strip("'")
    return out


def _resolve_unreal_cmd(engine_path: str) -> Path:
    """엔진 루트에서 UnrealEditor-Cmd 실행 파일 위치를 추론한다."""
    root = Path(engine_path).expanduser().resolve()
    candidates = [
        root / "Engine" / "Binaries" / "Win64" / "UnrealEditor-Cmd.exe",
        root / "Engine" / "Binaries" / "Linux" / "UnrealEditor-Cmd",
        root / "Engine" / "Binaries" / "Mac" / "UnrealEditor-Cmd",
        # 사용자가 이미 실행 파일 자체 경로를 준 경우
        root,
    ]
    for c in candidates:
        if c.is_file():
            return c
    raise FileNotFoundError(
        f"UnrealEditor-Cmd 실행 파일을 찾지 못했습니다. UE_ENGINE_PATH={engine_path}"
    )


def _parse_report(report_dir: Path) -> tuple[int, int, int, list[TestFailure], float]:
    """UE Automation 의 index.json 리포트를 파싱한다."""
    index = report_dir / "index.json"
    if not index.exists():
        # 일부 버전은 한 단계 아래에 둠
        candidates = list(report_dir.rglob("index.json"))
        if not candidates:
            raise FileNotFoundError(f"index.json 을 {report_dir} 에서 찾지 못함")
        index = candidates[0]

    data = json.loads(index.read_text(encoding="utf-8"))

    failures: list[TestFailure] = []
    passed = 0
    failed = 0
    skipped = 0
    total_duration = 0.0

    # UE5 Automation report 구조: { "tests": [ { "testDisplayName", "fullTestPath", "state",
    #   "entries": [ { "event": { "type": "Error|Warning|Info", "message": ... } } ], "duration" } ] }
    for t in data.get("tests", []):
        state = t.get("state", "")
        duration = float(t.get("duration", 0.0))
        total_duration += duration
        entries = t.get("entries", [])

        if state == "Success":
            passed += 1
            continue
        if state == "NotRun" or state == "Skipped":
            skipped += 1
            continue

        # Fail / InProcess / Unknown 등
        errors: list[str] = []
        warnings: list[str] = []
        for e in entries:
            ev = e.get("event", {})
            kind = (ev.get("type") or "").lower()
            msg = ev.get("message", "")
            if kind == "error":
                errors.append(msg)
            elif kind == "warning":
                warnings.append(msg)

        failed += 1
        failures.append(
            TestFailure(
                test_name=t.get("testDisplayName", ""),
                full_test_path=t.get("fullTestPath", ""),
                errors=errors,
                warnings=warnings,
                duration_ms=duration * 1000.0,
            )
        )

    return passed, failed, skipped, failures, total_duration


def _tail(text: str, max_chars: int = 4000) -> str:
    if len(text) <= max_chars:
        return text
    return "...(truncated)...\n" + text[-max_chars:]


def run(
    engine_path: str,
    uproject: str,
    test_filter: str,
    timeout_seconds: float,
    report_dir: Path | None = None,
) -> TestRunSummary:
    cmd_exe = _resolve_unreal_cmd(engine_path)
    project_file = Path(uproject).expanduser().resolve()
    if not project_file.is_file():
        raise FileNotFoundError(f".uproject 파일이 없습니다: {project_file}")

    cleanup_report = False
    if report_dir is None:
        report_dir = Path(tempfile.mkdtemp(prefix="hkt-automation-"))
        cleanup_report = True
    else:
        report_dir = Path(report_dir).expanduser().resolve()
        report_dir.mkdir(parents=True, exist_ok=True)

    args = [
        str(cmd_exe),
        str(project_file),
        f'-ExecCmds=Automation RunTests {test_filter}; Quit',
        "-TestExit=Automation Test Queue Empty",
        f"-ReportExportPath={report_dir}",
        "-unattended",
        "-nopause",
        "-nullrhi",
        "-nosplash",
        "-stdout",
        "-FullStdOutLogOutput",
    ]

    proc = subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )

    stdout = proc.stdout or ""
    stderr = proc.stderr or ""

    try:
        passed, failed, skipped, failures, total_duration = _parse_report(report_dir)
    except FileNotFoundError as e:
        return TestRunSummary(
            success=False,
            total=0,
            passed=0,
            failed=0,
            skipped=0,
            duration_seconds=0.0,
            filter=test_filter,
            failures=[],
            raw_report_path=str(report_dir),
            stdout_tail=_tail(stdout),
            stderr_tail=_tail(stderr) + f"\n[runner] 리포트 파싱 실패: {e}",
        )
    finally:
        # 리포트 디렉토리는 유지 — Agent가 후속 수정에서 참조 가능
        # 단, 에이전트가 명시적으로 임시 폴더로 위임한 경우만 정리
        pass

    summary = TestRunSummary(
        success=(failed == 0 and passed > 0),
        total=passed + failed + skipped,
        passed=passed,
        failed=failed,
        skipped=skipped,
        duration_seconds=total_duration,
        filter=test_filter,
        failures=failures,
        raw_report_path=str(report_dir),
        stdout_tail=_tail(stdout),
        stderr_tail=_tail(stderr),
    )

    # 명시적으로 받은 디렉토리는 보존, 자동 임시 디렉토리는 실패 시에만 보존
    if cleanup_report and summary.success:
        shutil.rmtree(report_dir, ignore_errors=True)

    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="HktAutomationTests CLI runner")
    parser.add_argument("--filter", default=None,
                        help=f"Automation 테스트 필터 prefix (default: {DEFAULT_FILTER})")
    parser.add_argument("--engine", default=None, help="UE 엔진 루트 경로")
    parser.add_argument("--uproject", default=None, help=".uproject 파일 경로")
    parser.add_argument("--timeout", type=float, default=1800.0,
                        help="UE 프로세스 타임아웃(초). default=1800")
    parser.add_argument("--report-dir", default=None,
                        help="리포트 출력 디렉토리. 미지정 시 임시폴더")
    parser.add_argument("--full", action="store_true",
                        help="stdout 꼬리 포함 전체 결과 출력")
    args = parser.parse_args()

    env_file_vals = _load_env_file(ENV_FILE)

    engine_path = (
        args.engine
        or os.environ.get("UE_ENGINE_PATH")
        or env_file_vals.get("UE_ENGINE_PATH")
    )
    uproject = (
        args.uproject
        or os.environ.get("UE_PROJECT_FILE")
        or env_file_vals.get("UE_PROJECT_FILE")
    )
    test_filter = (
        args.filter
        or os.environ.get("HKT_TEST_FILTER")
        or env_file_vals.get("HKT_TEST_FILTER")
        or DEFAULT_FILTER
    )

    if not engine_path or not uproject:
        sys.stderr.write(
            "[run_automation_tests] UE_ENGINE_PATH / UE_PROJECT_FILE 가 필요합니다.\n"
            f"  - {ENV_FILE} 를 만들어 두 값을 적거나,\n"
            "  - 환경변수로 설정하거나, --engine / --uproject 인자를 사용하세요.\n"
        )
        return 2

    try:
        summary = run(
            engine_path=engine_path,
            uproject=uproject,
            test_filter=test_filter,
            timeout_seconds=args.timeout,
            report_dir=Path(args.report_dir) if args.report_dir else None,
        )
    except subprocess.TimeoutExpired:
        sys.stderr.write(f"[run_automation_tests] 타임아웃 ({args.timeout}s) 초과\n")
        return 2
    except FileNotFoundError as e:
        sys.stderr.write(f"[run_automation_tests] {e}\n")
        return 2
    except Exception as e:
        sys.stderr.write(f"[run_automation_tests] 예기치 못한 오류: {e}\n")
        return 2

    print(summary.to_json(include_passes=args.full))

    if summary.failed > 0:
        return 1
    if summary.passed == 0:
        sys.stderr.write("[run_automation_tests] 실행된 테스트가 0개입니다 — 필터를 확인하세요.\n")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
