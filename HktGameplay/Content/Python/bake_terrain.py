"""
bake_terrain.py — HktTerrainBakedAsset 일괄 베이크 스크립트.

언리얼 에디터의 Python 콘솔에서 한 줄로 실행:

    py bake_terrain.py

    # 영역/시드/저장 경로 지정 — 음수 좌표는 '=' 형식 권장 (argparse 안전)
    py bake_terrain.py --min=-2,-2,0 --max=2,2,3 --seed 42 --save /Game/Terrain/Baked/RegionDefault

    # 고급 모드 (다층 바이옴/랜드마크/광석)
    py bake_terrain.py --advanced

전제:
    - Editor Python Scripting 플러그인 활성
    - 본 파일은 HktGameplay/Content/Python/ 아래 위치 (sys.path 자동 등록)
    - HktTerrain 모듈이 빌드되어 있어야 unreal.HktTerrainBakeLibrary 노출됨

호출 절차:
    1) FHktTerrainBakedConfig 구성 (시드/노이즈/월드 단위/스트리밍)
    2) UHktTerrainBakeLibrary.bake_region(cfg, min, max, save_path) 호출
    3) 결과 자산 경로 + 통계 출력

기본 동작:
    cfg.seed=42, 영역=(-2,-2,0)~(2,2,3) [총 100 청크],
    저장=/Game/Terrain/Baked/RegionDefault, advanced=False
"""

from __future__ import annotations

import argparse
import sys
import time

import unreal


# ---------------------------------------------------------------------------
# Q16.16 고정소수점 헬퍼 — FHktFixed32 raw int32 변환
# ---------------------------------------------------------------------------

def fx(value: float) -> int:
    """float → FHktFixed32 raw int32 (Q16.16)."""
    return int(round(value * 65536.0))


# ---------------------------------------------------------------------------
# 인자 파싱
# ---------------------------------------------------------------------------

def parse_int_triple(text: str) -> unreal.IntVector:
    parts = [p.strip() for p in text.replace(" ", ",").split(",") if p.strip()]
    if len(parts) != 3:
        raise ValueError(f"int triple 형식 오류 — 'X,Y,Z' 필요. 입력='{text}'")
    return unreal.IntVector(int(parts[0]), int(parts[1]), int(parts[2]))


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="bake_terrain",
        description="HktTerrainBakedAsset 일괄 베이크",
    )
    p.add_argument("--min", dest="chunk_min", default="-2,-2,0",
                   help="베이크 시작 청크 좌표 (포함). 기본 -2,-2,0")
    p.add_argument("--max", dest="chunk_max", default="2,2,3",
                   help="베이크 끝 청크 좌표 (포함). 기본 2,2,3")
    p.add_argument("--save", dest="save_path",
                   default="/Game/Terrain/Baked/RegionDefault",
                   help="저장 경로. 기본 /Game/Terrain/Baked/RegionDefault")
    p.add_argument("--seed", type=int, default=42, help="지형 시드. 기본 42")
    p.add_argument("--epoch", type=int, default=0, help="재생성 사이클. 기본 0")
    p.add_argument("--advanced", action="store_true",
                   help="고급 다층 생성 (대륙/바이옴/랜드마크/광석)")
    p.add_argument("--no-caves", action="store_true", help="동굴 비활성")
    p.add_argument("--no-ore", action="store_true",
                   help="고급 모드 광석 비활성")
    p.add_argument("--no-scatter", action="store_true",
                   help="고급 모드 표면 데코 비활성")
    p.add_argument("--voxel-cm", type=float, default=15.0,
                   help="복셀 변 길이 cm. 기본 15.0")
    p.add_argument("--height-min-z", type=int, default=0,
                   help="월드 최소 Z 청크. 기본 0")
    p.add_argument("--height-max-z", type=int, default=3,
                   help="월드 최대 Z 청크. 기본 3")
    p.add_argument("--no-spawn-templates", action="store_true",
                   help="VoxelSpawnRules 기본 매핑 (Tree/Slime 다양성 weighted-pick) 적용 안 함")
    return p.parse_args(argv)


# ---------------------------------------------------------------------------
# Voxel Spawn Rules 기본 매핑 (디자이너 입력 → BakedConfig.VoxelSpawnRules)
# ---------------------------------------------------------------------------

# 후보 1개 = (StoryTag 이름 or None=skip 슬롯, weight).
SpawnCandidate = tuple[str | None, int]


def default_voxel_spawn_rules() -> "dict[unreal.HktTerrainType, list[SpawnCandidate]]":
    """BakeRegion 의 VoxelSpawnRules 기본 매핑 (v7 — EHktTerrainType enum 키).

    디자이너 의도: "이 voxel type 위 (top-most non-air voxel) 에는 *다음 후보 중
    하나가* 결정론적으로 발화한다". BakeRegion 이 매 surface column 의 top voxel
    좌표 (`ComputeVoxelSlotHash31`) 로 weighted-pick 을 수행 — 동일 voxel 재방문
    시 동일 결과 (I-0017). 런타임은 결과를 read-only 로 dispatch.

    후보 1개당 (storyTag, weight) — storyTag=None 은 *skip 슬롯* (해당 weight
    만큼 아무것도 spawn 안 함).

    매핑 (HktTerrainBiome.cpp MaterialRules 와 동기):
      - Snow   = Tundra 표면 → Tree 40% / Slime 10% / skip 50%
      - Gravel = Mountain 표면 → Tree 50% / skip 50%  (희소한 산악림)
      - Clay   = Swamp 표면 → Slime 50% / Tree 10% / skip 40%
      - Sand   = Desert 표면 → Slime 30% / skip 70%   (사막 = 희소)

    Grass/Dirt 같은 흔한 surface 는 의도적으로 비워둔다 — voxel attribution 이
    전 영역을 채워 spawn cap 즉시 도달 시 검증 메시지 가독성 저하. 디자이너는
    필요 시 추가.
    """
    TREE  = "Story.Flow.Spawner.Natural.Tree"
    SLIME = "Story.Flow.Spawner.Natural.Slime"
    return {
        unreal.HktTerrainType.SNOW:   [(TREE, 40),  (SLIME, 10), (None, 50)],
        unreal.HktTerrainType.GRAVEL: [(TREE, 50),               (None, 50)],
        unreal.HktTerrainType.CLAY:   [(SLIME, 50), (TREE, 10),  (None, 40)],
        unreal.HktTerrainType.SAND:   [(SLIME, 30),              (None, 70)],
    }


def apply_voxel_spawn_rules(cfg: "unreal.HktTerrainBakedConfig",
                            rules_by_type: "dict[unreal.HktTerrainType, list[SpawnCandidate]]") -> int:
    """`cfg.voxel_spawn_rules` 를 채운다. 추가된 rule 수 반환.

    UE5 Python 바인딩에서 USTRUCT TArray<FHktVoxelSpawnRule> 는 list 형태로
    직렬화. 각 rule 은 `unreal.HktVoxelSpawnRule()` 인스턴스로 voxel_type /
    story_tag / weight 를 세팅 (UE5 reflection 은 snake_case 필드명).

    skip 슬롯 (storyTag=None) 은 invalid GameplayTag (`unreal.GameplayTag()`)
    로 표현 — BakeRegion 이 해당 픽 결과 시 attribution 미부여 (skip 처리).
    """
    if not rules_by_type:
        return 0
    flat: list = []
    for voxel_type, candidates in rules_by_type.items():
        for tag_name, weight in candidates:
            if weight <= 0:
                continue
            rule = unreal.HktVoxelSpawnRule()
            rule.voxel_type = voxel_type
            rule.story_tag = unreal.GameplayTag(tag_name) if tag_name else unreal.GameplayTag()
            rule.weight = int(weight)
            flat.append(rule)
    cfg.voxel_spawn_rules = flat
    return len(flat)


# ---------------------------------------------------------------------------
# Config 빌더
# ---------------------------------------------------------------------------

def build_config(args: argparse.Namespace) -> unreal.HktTerrainBakedConfig:
    """CLI 인자 → FHktTerrainBakedConfig.

    노이즈/혼합 파라미터는 FHktTerrainBakedConfig 의 헤더 기본값과 동일하게
    설정한다 (HktTerrainBakedAsset.h 참고). 결정론 유지를 위해 임의 수정 시
    `CurrentBakeVersion` 정책에 유의.
    """
    cfg = unreal.HktTerrainBakedConfig()

    # ─── 시드 / 모드 ───
    # UE5 Python 바인딩은 C++ bool UPROPERTY 의 'b' 접두사를 제거한다.
    # 예: bAdvancedTerrain → advanced_terrain
    cfg.seed = args.seed
    cfg.epoch = args.epoch
    cfg.advanced_terrain = bool(args.advanced)
    cfg.adv_enable_subsurface_ore = not args.no_ore
    cfg.adv_enable_surface_scatter = not args.no_scatter

    # ─── 지형 형태 (FBM) ───
    cfg.height_scale_raw   = fx(64.0)
    cfg.height_offset_raw  = fx(32.0)
    cfg.terrain_freq_raw   = fx(0.008)
    cfg.terrain_octaves    = 6
    cfg.lacunarity_raw     = fx(2.0)
    cfg.persistence_raw    = fx(0.5)

    # ─── 산악 ───
    cfg.mountain_freq_raw  = fx(0.004)
    cfg.mountain_blend_raw = fx(0.4)

    # ─── 수면 ───
    cfg.water_level_raw    = fx(30.0)

    # ─── 동굴 ───
    cfg.enable_caves       = not args.no_caves
    cfg.cave_freq_raw      = fx(0.03)
    cfg.cave_threshold_raw = fx(0.6)

    # ─── 바이옴 ───
    cfg.biome_noise_scale_raw      = fx(0.002)
    cfg.mountain_biome_threshold_raw = fx(80.0)

    # ─── 월드 단위 ───
    cfg.voxel_size_cm = float(args.voxel_cm)
    cfg.height_min_z  = int(args.height_min_z)
    cfg.height_max_z  = int(args.height_max_z)

    # ─── 시뮬 스트리밍 (베이크 산출물에 함께 캡처) ───
    cfg.sim_load_radius_xy           = 2
    cfg.sim_load_radius_z            = 1
    cfg.sim_max_chunks_loaded        = 256
    cfg.sim_max_chunk_loads_per_frame = 4

    # ─── Voxel Spawn Rules (I-0027 / I-0013) ───
    # `--no-spawn-templates` 미지정 시 기본 후보 목록 적용 → BakeRegion 이 surface
    # column 좌표 시드로 weighted-pick → attribution 자동 산출. 런타임 read-only.
    # 자세한 데이터 모델은 Docs/Design-VoxelSpawner.md 참조.
    if not args.no_spawn_templates:
        applied = apply_voxel_spawn_rules(cfg, default_voxel_spawn_rules())
        unreal.log(f"[bake_terrain] VoxelSpawnRules {applied} 항목 적용")

    return cfg


# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    args = parse_args(argv)

    chunk_min = parse_int_triple(args.chunk_min)
    chunk_max = parse_int_triple(args.chunk_max)

    if (chunk_min.x > chunk_max.x or
            chunk_min.y > chunk_max.y or
            chunk_min.z > chunk_max.z):
        unreal.log_error(
            f"베이크 영역이 잘못됨 — Min={chunk_min} Max={chunk_max}")
        return 2

    total = ((chunk_max.x - chunk_min.x + 1) *
             (chunk_max.y - chunk_min.y + 1) *
             (chunk_max.z - chunk_min.z + 1))

    # HktTerrain 모듈/베이크 라이브러리 노출 확인 — 친절한 에러 메시지.
    if not hasattr(unreal, "HktTerrainBakeLibrary") or not hasattr(unreal, "HktTerrainBakedConfig"):
        unreal.log_error(
            "[bake_terrain] HktTerrainBakeLibrary/HktTerrainBakedConfig 미노출 — "
            "HktGameplay 플러그인 활성화 및 Editor 빌드 여부를 확인하세요.")
        return 3

    cfg = build_config(args)

    unreal.log(
        f"[bake_terrain] 시작 — Min={chunk_min} Max={chunk_max} "
        f"Total={total} 청크 Seed={cfg.seed} "
        f"Advanced={cfg.advanced_terrain} Save='{args.save_path}'")

    t0 = time.perf_counter()
    asset = unreal.HktTerrainBakeLibrary.bake_region(
        cfg, chunk_min, chunk_max, args.save_path)
    elapsed = time.perf_counter() - t0

    if asset is None:
        unreal.log_error(
            f"[bake_terrain] 실패 — 자산 생성 안 됨 (저장 경로/영역 확인). "
            f"Elapsed={elapsed:.2f}s")
        return 1

    unreal.log(
        f"[bake_terrain] 완료 — Asset='{asset.get_path_name()}' "
        f"Elapsed={elapsed:.2f}s")
    unreal.log(
        f"[bake_terrain] 액터 BakedAsset 슬롯에 위 경로를 할당하거나, "
        f"BeginPlay 에서 LoadBakedAsset 으로 비동기 로드하세요.")
    return 0


if __name__ == "__main__":
    # UE Python 콘솔의 `py script.py [args]` 호출 시 sys.argv 에 인자 전달.
    raise SystemExit(main(sys.argv[1:]))
