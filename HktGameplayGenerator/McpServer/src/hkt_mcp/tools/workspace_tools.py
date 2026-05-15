"""
Workspace Tools — I-0008 2D 어셋 자동 제작 Workspace 빌드.

호출자는 `{Saved}/Workspace/{Paper2D|HISM}/{Tag}/...` 트리에 재료만 배치하면,
이 도구가 워크스페이스를 스캔해 GameplayTag 자동 등록 + 적절한 빌더 호출까지
모두 수행한다. 실제 빌드는 UE5 의 `UHktWorkspaceFunctionLibrary` 가 담당.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ..bridge.editor_bridge import EditorBridge

logger = logging.getLogger("hkt_mcp.tools.workspace")

OBJECT_PATH = "/Script/HktWorkspaceGenerator.Default__HktWorkspaceFunctionLibrary"


async def list_workspace_tags(
    bridge: EditorBridge,
    workspace_root: str = "",
) -> str:
    """워크스페이스 스캔만 — 빌드는 수행하지 않음."""
    data = await bridge.call_method(
        "ListWorkspaceTags",
        object_path=OBJECT_PATH,
        WorkspaceRoot=workspace_root,
    )
    if data is None:
        return json.dumps({"success": False, "error": "UE5 ListWorkspaceTags 호출 실패"})
    # data 는 이미 JSON 문자열 — 그대로 반환.
    return data if isinstance(data, str) else json.dumps(data)


async def workspace_scan_and_build_all(
    bridge: EditorBridge,
    workspace_root: str = "",
    force: bool = False,
) -> str:
    """워크스페이스 일괄 빌드. force=true 면 manifest 무시."""
    data = await bridge.call_method(
        "ScanAndBuildAll",
        object_path=OBJECT_PATH,
        WorkspaceRoot=workspace_root,
        bForce=bool(force),
    )
    if data is None:
        return json.dumps({"success": False, "error": "UE5 ScanAndBuildAll 호출 실패"})
    return data if isinstance(data, str) else json.dumps(data)


async def workspace_build_tag(
    bridge: EditorBridge,
    category: str,
    tag_folder_name: str,
    force: bool = False,
    workspace_root: str = "",
) -> str:
    """단일 Tag 폴더 빌드. category: "Paper2D" 또는 "HISM"."""
    data = await bridge.call_method(
        "BuildTag",
        object_path=OBJECT_PATH,
        Category=category,
        TagFolderName=tag_folder_name,
        bForce=bool(force),
        WorkspaceRoot=workspace_root,
    )
    if data is None:
        return json.dumps({"success": False, "error": "UE5 BuildTag 호출 실패"})
    return data if isinstance(data, str) else json.dumps(data)
