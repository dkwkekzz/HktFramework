"""Intent 시스템 CLI 진입점.

현재 지원 커맨드:
    build-site   단일 HTML 사이트 셸 생성 (실제 데이터는 GitHub API 라이브 페치)
    validate     Intent 파일들 검증 (exit 0=통과, 1=에러, 2=파싱오류)

호출 예:
    python -m intentsys build-site --output Docs/intents/site.html

    python -m intentsys validate --intents-dir Docs/intents

build-site 는 더 이상 .md 데이터를 임베드하지 않는다 — 셸 템플릿이 변경된 경우에만
재생성하면 된다. Intent 추가/수정으로는 site.html 을 다시 만들 필요가 없다.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

from .parser import IntentParseError, load_intents
from .sitegen import generate_site
from .validator import validate


def _get_repo_info() -> str:
    """git remote 의 origin URL 에서 ``owner/repo`` 를 추출한다.

    지원 포맷:
        https://github.com/owner/repo(.git)?
        git@github.com:owner/repo(.git)?
        http(s)?://host[:port]/path/.../owner/repo(.git)?

    실패 시 빈 문자열 반환 (사이트는 여전히 생성되되 ``<meta>`` 가 비어 있어,
    런타임에서 사용자가 ⚙ 설정으로 owner/repo 를 지정하도록 유도한다).
    """
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True, text=True, check=True, timeout=5,
        )
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        return ""

    url = result.stdout.strip()
    if not url:
        return ""

    # SSH 포맷: user@host:owner/repo(.git)?  ('://' 가 없는 형태로 한정)
    if "://" not in url:
        ssh_match = re.match(r"^[^@\s]+@[^:\s]+:([^/]+)/(.+?)(?:\.git)?$", url)
        if ssh_match:
            return f"{ssh_match.group(1)}/{ssh_match.group(2)}"

    # HTTP(S) 포맷: scheme://[user@]host[:port]/[...]/owner/repo(.git)?
    http_match = re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]+/(.+?)(?:\.git)?$", url)
    if http_match:
        path = http_match.group(1).strip("/")
        segments = [s for s in path.split("/") if s]
        if len(segments) >= 2:
            owner = segments[-2]
            repo = segments[-1]
            if repo.endswith(".git"):
                repo = repo[:-4]
            return f"{owner}/{repo}"

    return ""


def cmd_build_site(output: Path) -> int:
    """SPA 셸 HTML 을 생성한다.

    .md 데이터를 임베드하지 않는다. 브라우저가 GitHub API 로 라이브 페치한다.
    """
    github_repo = _get_repo_info()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(generate_site(github_repo=github_repo), encoding="utf-8")
    if github_repo:
        print(f"생성 완료: {output} (repo={github_repo})")
    else:
        print(
            f"생성 완료: {output} (repo 미감지 — 사용자가 ⚙ 설정에서 지정 필요)",
            file=sys.stderr,
        )
    return 0


def cmd_validate(intents_dir: Path) -> int:
    """Intent 파일들을 검증한다.

    반환값:
        0  — 모든 검사 통과
        1  — 검증 오류 1건 이상
        2  — 파일 파싱 실패
    """
    try:
        intents = load_intents(intents_dir)
    except (IntentParseError, FileNotFoundError) as exc:
        print(f"파싱 오류: {exc}", file=sys.stderr)
        return 2

    errors = validate(intents)
    if not errors:
        print(f"✓ {len(intents)}개 Intent 모두 통과")
        return 0

    for err in errors:
        print(f"[{err.id}] {err.field}: {err.message}", file=sys.stderr)
    print(f"\n검증 실패: {len(errors)}개 오류", file=sys.stderr)
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="intentsys")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_site = sub.add_parser(
        "build-site",
        help="단일 HTML SPA 셸 생성 (데이터는 런타임 GitHub API 페치)",
    )
    p_site.add_argument(
        "--output", type=Path, default=Path("Docs/intents/site.html"),
        help="출력 HTML 경로 (기본: Docs/intents/site.html)",
    )

    p_validate = sub.add_parser(
        "validate",
        help="Intent 파일들 검증 (exit 0=통과, 1=에러, 2=파싱오류)",
    )
    p_validate.add_argument(
        "--intents-dir", type=Path, default=Path("Docs/intents"),
        help="Intent 파일 디렉토리 (기본: Docs/intents)",
    )

    args = parser.parse_args(argv)
    if args.cmd == "build-site":
        return cmd_build_site(args.output)
    if args.cmd == "validate":
        return cmd_validate(args.intents_dir)
    raise AssertionError(f"unreachable: argparse should reject unknown cmd {args.cmd!r}")


if __name__ == "__main__":
    sys.exit(main())
