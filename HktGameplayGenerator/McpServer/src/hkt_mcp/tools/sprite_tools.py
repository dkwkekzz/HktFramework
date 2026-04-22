"""
Sprite Generator Tools — Tag/Slot + 입력 텍스처들 → Atlas 패킹 → UE5 DataAsset 자동 생성.

호출자는 입력 이미지들이 있는 디렉터리 경로(또는 textures JSON)를 직접 지정한다.
경로는 하드코딩된 컨벤션을 쓰지 않고 인자로 받는다.

디렉터리 스캔 시 허용 파일명:
  - 플랫:     {action}[_{direction}][_{frame_idx}].{png|tga|jpg|bmp|webp}
              예) idle.png / idle_S.png / walk_NE_3.png
  - 서브폴더: {action}/{direction}/{idx}.{ext}  또는  {action}/{direction}.{ext}
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..bridge.editor_bridge import EditorBridge

logger = logging.getLogger("hkt_mcp.tools.sprite")

OBJECT_PATH = "/Script/HktSpriteGenerator.Default__HktSpriteGeneratorFunctionLibrary"

# 8방향 고정 순서 — FHktSpriteAction::FramesByDirection 인덱스와 일치해야 함.
DIRECTIONS: List[str] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
DIRECTION_SET = set(DIRECTIONS)
IMAGE_EXTS = {".png", ".tga", ".jpg", ".jpeg", ".bmp", ".webp"}


def _require_pillow():
    try:
        from PIL import Image  # noqa: F401
    except ImportError as e:
        raise RuntimeError(
            "Pillow가 설치되지 않았습니다. `pip install Pillow` 로 설치하세요."
        ) from e


def _project_root(project_dir_hint: Optional[str]) -> Path:
    base = project_dir_hint or os.environ.get("UE_PROJECT_PATH") or os.getcwd()
    return Path(base)


def _resolve_output_dir(project_dir_hint: Optional[str]) -> Path:
    """Atlas PNG를 쓸 디스크 경로 — {ProjectDir}/Saved/SpriteGenerator/."""
    out = _project_root(project_dir_hint) / "Saved" / "SpriteGenerator"
    out.mkdir(parents=True, exist_ok=True)
    return out


def _sanitize_tag(tag: str) -> str:
    return tag.replace(".", "_").replace("/", "_")


def _is_image(p: Path) -> bool:
    return p.suffix.lower() in IMAGE_EXTS


# 파일명 파싱: {action}[_{direction}][_{frame_idx}].{ext}
# 예: "idle.png"          → ("idle", None, None)
#     "idle_S.png"        → ("idle", "S",  None)
#     "walk_NE_3.png"     → ("walk", "NE", 3)
_STEM_RE = re.compile(r"^(?P<action>[A-Za-z][A-Za-z0-9]*)(?:_(?P<dir>N|NE|E|SE|S|SW|W|NW))?(?:_(?P<idx>\d+))?$")


def _scan_convention_dir(dir_path: Path) -> Dict[str, Any]:
    """
    컨벤션 폴더를 스캔해 textures dict 반환.

    지원 레이아웃:
      a) 플랫: {action}[_{direction}][_{idx}].{ext}
      b) 서브폴더: {action}/{direction}/{idx}.{ext}  또는  {action}/{direction}.{ext}  또는  {action}/{any}.{ext}

    반환 포맷은 _normalize_frames가 받는 dict와 동일.
    """
    if not dir_path.exists():
        raise FileNotFoundError(f"입력 폴더 없음: {dir_path}")

    # 두 단계로 수집: 명시 방향 vs 방향 미지정(폴백).
    # action → direction → [(idx_hint, path)]
    explicit: Dict[str, Dict[str, List[tuple[int, str]]]] = {}
    # action → [(idx_hint, path)]  (방향 미지정 → 나중에 빈 방향에만 채움)
    fallback: Dict[str, List[tuple[int, str]]] = {}

    # (a) 플랫 스캔
    for f in sorted(dir_path.iterdir()):
        if f.is_file() and _is_image(f):
            m = _STEM_RE.match(f.stem)
            if not m:
                continue
            action = m.group("action").lower()
            d = m.group("dir")
            idx_s = m.group("idx")
            idx = int(idx_s) if idx_s else 0
            if d is None:
                fallback.setdefault(action, []).append((idx, str(f)))
            else:
                explicit.setdefault(action, {}).setdefault(d, []).append((idx, str(f)))

    # (b) 서브폴더 스캔 — 존재하면 해당 액션의 플랫 결과를 전부 덮어씀
    for action_dir in sorted(dir_path.iterdir()):
        if not action_dir.is_dir():
            continue
        action = action_dir.name.lower()
        dir_subdirs = [d for d in action_dir.iterdir() if d.is_dir() and d.name in DIRECTION_SET]
        if dir_subdirs:
            # action/{direction}/{idx}.{ext}
            explicit.pop(action, None)
            fallback.pop(action, None)
            for direction_dir in dir_subdirs:
                files = sorted(f for f in direction_dir.iterdir() if f.is_file() and _is_image(f))
                for i, f in enumerate(files):
                    try:
                        idx = int(f.stem)
                    except ValueError:
                        idx = i
                    explicit.setdefault(action, {}).setdefault(direction_dir.name, []).append((idx, str(f)))
        else:
            files = sorted(f for f in action_dir.iterdir() if f.is_file() and _is_image(f))
            if not files:
                continue
            explicit.pop(action, None)
            fallback.pop(action, None)
            direction_files = [f for f in files if f.stem in DIRECTION_SET]
            nondir_files = [f for f in files if f.stem not in DIRECTION_SET]
            for f in direction_files:
                explicit.setdefault(action, {}).setdefault(f.stem, []).append((0, str(f)))
            for i, f in enumerate(nondir_files):
                fallback.setdefault(action, []).append((i, str(f)))

    if not explicit and not fallback:
        raise FileNotFoundError(
            f"스프라이트 파일을 찾지 못했습니다: {dir_path}\n"
            f"허용 파일명: {{action}}[_{{N|NE|E|SE|S|SW|W|NW}}][_{{frame_idx}}].png "
            f"또는 서브폴더 {{action}}/{{direction}}/{{idx}}.png"
        )

    # 병합: 명시 방향은 그대로, 빠진 방향만 fallback으로 채움
    buckets: Dict[str, Dict[str, List[tuple[int, str]]]] = {}
    all_actions = set(explicit.keys()) | set(fallback.keys())
    for action in all_actions:
        per_dir = dict(explicit.get(action, {}))
        fb = fallback.get(action, [])
        if fb:
            for d in DIRECTIONS:
                if d not in per_dir:
                    per_dir[d] = list(fb)
        buckets[action] = per_dir

    # 정렬해서 최종 dict로
    out: Dict[str, Dict[str, List[str]]] = {}
    for action, dirs in buckets.items():
        action_map: Dict[str, List[str]] = {}
        for d, entries in dirs.items():
            entries.sort(key=lambda t: t[0])
            action_map[d] = [p for _, p in entries]
        out[action] = action_map
    return out


def _normalize_frames(textures: Dict[str, Any]) -> Dict[str, Dict[str, List[str]]]:
    """
    입력 허용 형태:
      {"idle": "path.png"}                             # 단일 프레임, 모든 방향 동일
      {"idle": {"S": "path.png"}}                      # 방향별 1 프레임
      {"idle": {"S": ["p1.png","p2.png"]}}             # 방향별 N 프레임
      {"idle": {"framesByDirection": [[...], [...]]}}  # 8방향 × N 프레임 (고급)

    반환: {action: {direction: [paths...]}}   (누락 방향 없음; 모든 방향 채움)
    """
    out: Dict[str, Dict[str, List[str]]] = {}
    for action_id, spec in textures.items():
        if isinstance(spec, str):
            # 단일 경로 → 8방향 모두 동일 프레임 1장
            out[action_id] = {d: [spec] for d in DIRECTIONS}
            continue

        if not isinstance(spec, dict):
            raise ValueError(f"action '{action_id}' spec 형식 오류")

        action_map: Dict[str, List[str]] = {}

        if "framesByDirection" in spec:
            fbd = spec["framesByDirection"]
            if not isinstance(fbd, list) or len(fbd) != 8:
                raise ValueError(
                    f"action '{action_id}' framesByDirection는 길이 8 배열이어야 함"
                )
            for i, d in enumerate(DIRECTIONS):
                arr = fbd[i]
                if isinstance(arr, str):
                    action_map[d] = [arr]
                else:
                    action_map[d] = list(arr or [])
        else:
            for d, val in spec.items():
                if d not in DIRECTION_SET:
                    continue
                if isinstance(val, str):
                    action_map[d] = [val]
                else:
                    action_map[d] = list(val or [])

            # 방향 채우기 — 비어있는 방향은 채워진 방향 중 아무거나로 폴백
            if not any(action_map.values()):
                raise ValueError(f"action '{action_id}' 에 유효한 프레임이 없음")
            fallback = next(v for v in action_map.values() if v)
            for d in DIRECTIONS:
                action_map.setdefault(d, fallback)
                if not action_map[d]:
                    action_map[d] = fallback

        out[action_id] = action_map
    return out


def _pack_atlas(
    normalized: Dict[str, Dict[str, List[str]]],
    out_path: Path,
) -> Dict[str, Any]:
    """
    고유 파일 경로마다 한 번만 디코드 + 한 셀만 차지하도록 패킹.
    동일 경로가 여러 방향에 매핑돼 있으면(단일 파일 폴백 케이스) 모두 같은 atlasIndex를 공유.
    셀 크기는 모든 입력 이미지의 max(W, H).
    """
    from PIL import Image

    unique_paths: List[str] = []
    path_to_cell: Dict[str, int] = {}
    decoded: Dict[str, "Image.Image"] = {}
    max_w, max_h = 0, 0

    for action_id in sorted(normalized.keys()):
        for d in DIRECTIONS:
            for p in normalized[action_id][d]:
                if p in path_to_cell:
                    continue
                im = Image.open(p).convert("RGBA")
                decoded[p] = im
                if im.width > max_w:
                    max_w = im.width
                if im.height > max_h:
                    max_h = im.height
                path_to_cell[p] = len(unique_paths)
                unique_paths.append(p)

    if not unique_paths or max_w == 0 or max_h == 0:
        raise ValueError("유효한 입력 이미지가 없습니다")

    cell_w, cell_h = max_w, max_h
    columns = max(1, min(len(DIRECTIONS), len(unique_paths)))
    rows = math.ceil(len(unique_paths) / columns)
    atlas_w = columns * cell_w
    atlas_h = rows * cell_h

    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    for i, p in enumerate(unique_paths):
        col, row = i % columns, i // columns
        atlas.paste(decoded[p], (col * cell_w, row * cell_h), decoded[p])
    atlas.save(out_path, "PNG")

    actions_out: List[Dict[str, Any]] = []
    for action_id in sorted(normalized.keys()):
        fbd: List[List[Dict[str, Any]]] = []
        for d in DIRECTIONS:
            fbd.append([
                {
                    "atlasIndex": path_to_cell[p],
                    "pivotX": cell_w / 2.0,
                    "pivotY": float(cell_h),
                }
                for p in normalized[action_id][d]
            ])
        actions_out.append({"id": action_id, "framesByDirection": fbd})

    return {
        "columns": columns,
        "rows": rows,
        "cellW": cell_w,
        "cellH": cell_h,
        "atlasWidth": atlas_w,
        "atlasHeight": atlas_h,
        "actions": actions_out,
    }


async def build_sprite_part(
    bridge: EditorBridge,
    tag: str,
    slot: str,
    input_dir: str = "",   # 입력 이미지가 들어있는 폴더 (또는 textures JSON으로 대체)
    textures: str = "",    # JSON string — 경로를 직접 명시할 때
    output_dir: str = "",
    pixel_to_world: float = 2.0,
    frame_duration_ms: float = 100.0,
    looping: bool = True,
    mirror_west_from_east: bool = True,
    project_saved_dir: str = "",
) -> str:
    """
    Tag/Slot + 입력 텍스처들로 Atlas 패킹 + UE5 DataAsset 자동 생성.

    입력은 둘 중 하나를 주면 된다:
      - input_dir:  이미지 파일이 들어있는 폴더 경로
                    파일명 규칙: {action}[_{direction}][_{frame_idx}].{ext}
                    또는 서브폴더: {action}/{direction}/{idx}.{ext}
      - textures:   JSON 으로 경로를 직접 명시
                    {"idle": "p.png"} / {"idle": {"S":["p1.png","p2.png"]}} /
                    {"walk": {"framesByDirection": [[...], ..., [...]]}}  # 8방향
    """
    _require_pillow()

    if not tag or not slot:
        return json.dumps({"success": False, "error": "tag/slot required"})
    if not (input_dir or (textures and textures.strip())):
        return json.dumps({
            "success": False,
            "error": "input_dir 또는 textures JSON 중 하나를 반드시 지정해야 합니다"
        })

    # --- 입력 파싱: textures JSON 우선, 아니면 input_dir 스캔 ---
    scanned_dir: Optional[str] = None
    try:
        if textures and textures.strip():
            tex_dict = json.loads(textures) if isinstance(textures, str) else textures
        else:
            conv_dir = Path(input_dir)
            tex_dict = _scan_convention_dir(conv_dir)
            scanned_dir = str(conv_dir)
    except json.JSONDecodeError as e:
        return json.dumps({"success": False, "error": f"textures JSON parse: {e}"})
    except FileNotFoundError as e:
        return json.dumps({"success": False, "error": str(e)})

    try:
        normalized = _normalize_frames(tex_dict)
        out_dir = _resolve_output_dir(project_saved_dir or None)
        atlas_png = out_dir / f"{_sanitize_tag(tag)}.png"
        pack = _pack_atlas(normalized, atlas_png)
    except Exception as e:
        logger.exception("Atlas 패킹 실패")
        return json.dumps({"success": False, "error": f"pack: {e}"})

    cell_w, cell_h = pack["cellW"], pack["cellH"]

    # --- UE5 빌드 호출 스펙 구성 ---
    actions_spec = []
    for a in pack["actions"]:
        actions_spec.append({
            "id": a["id"],
            "frameDurationMs": frame_duration_ms,
            "looping": looping,
            "mirrorWestFromEast": mirror_west_from_east,
            "framesByDirection": a["framesByDirection"],
        })

    spec = {
        "tag": tag,
        "slot": slot,
        "atlasPngPath": str(atlas_png),
        "cellW": cell_w,
        "cellH": cell_h,
        "pixelToWorld": pixel_to_world,
        "actions": actions_spec,
    }
    if output_dir:
        spec["outputDir"] = output_dir

    data = await bridge.call_method(
        "McpBuildSpritePart",
        object_path=OBJECT_PATH,
        JsonSpec=json.dumps(spec),
    )
    if data is None:
        return json.dumps({
            "success": False,
            "error": "UE5 McpBuildSpritePart 호출 실패",
            "atlas_png": str(atlas_png),
            "atlas_size": [pack["atlasWidth"], pack["atlasHeight"]],
            "cell_size": [cell_w, cell_h],
        })

    return json.dumps({
        "success": True,
        "data": data,
        "atlas_png": str(atlas_png),
        "atlas_size": [pack["atlasWidth"], pack["atlasHeight"]],
        "cell_size": [cell_w, cell_h],
        "columns": pack["columns"],
        "rows": pack["rows"],
        "scanned_dir": scanned_dir,
    }, indent=2)


