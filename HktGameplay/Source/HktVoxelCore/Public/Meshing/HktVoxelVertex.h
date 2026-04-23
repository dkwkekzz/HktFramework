// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// FHktVoxelVertex — 복셀 전용 압축 버텍스 (8 bytes per quad vertex)
//
// PackedPositionAndSize (32bit):
//   [5:0]   x             (0~63)
//   [11:6]  y             (0~63)
//   [17:12] z             (0~63)
//   [23:18] width         (greedy mesh 확장 크기, 0~63)
//   [29:24] height        (0~63)
//   [31:30] face_direction_low (2bit)
//
// PackedMaterialAndAO (32bit):
//   [15:0]  voxel_type    (0~65535)
//   [18:16] palette_index (0~7)
//   [20:19] ao_value      (0~3, Baked AO)
//   [23:21] flags         (발광, 투명, 애니메이션)
//   [24]    face_direction_high (1bit — face_direction 3bit 중 MSB)
//   [31:25] bone_index    (0~127, GPU 스키닝용. 0=루트/스키닝 없음)
// ============================================================================

struct FHktVoxelVertex
{
	uint32 PackedPositionAndSize;
	uint32 PackedMaterialAndAO;

	FHktVoxelVertex() : PackedPositionAndSize(0), PackedMaterialAndAO(0) {}

	static FHktVoxelVertex Pack(
		uint8 X, uint8 Y, uint8 Z,
		uint8 Width, uint8 Height,
		uint8 FaceDirection,
		uint16 VoxelType,
		uint8 PaletteIndex,
		uint8 AOValue,
		uint8 Flags,
		uint8 BoneIndex = 0)
	{
		FHktVoxelVertex V;
		V.PackedPositionAndSize =
			(static_cast<uint32>(X) & 0x3F) |
			((static_cast<uint32>(Y) & 0x3F) << 6) |
			((static_cast<uint32>(Z) & 0x3F) << 12) |
			((static_cast<uint32>(Width) & 0x3F) << 18) |
			((static_cast<uint32>(Height) & 0x3F) << 24) |
			((static_cast<uint32>(FaceDirection) & 0x3) << 30);

		V.PackedMaterialAndAO =
			(static_cast<uint32>(VoxelType) & 0xFFFF) |
			((static_cast<uint32>(PaletteIndex) & 0x7) << 16) |
			((static_cast<uint32>(AOValue) & 0x3) << 19) |
			((static_cast<uint32>(Flags) & 0x7) << 21) |
			((static_cast<uint32>((FaceDirection >> 2) & 0x1)) << 24) |
			((static_cast<uint32>(BoneIndex) & 0x7F) << 25);

		return V;
	}

	// 언팩 유틸리티 (CPU 디버그용)
	uint8 GetX() const { return PackedPositionAndSize & 0x3F; }
	uint8 GetY() const { return (PackedPositionAndSize >> 6) & 0x3F; }
	uint8 GetZ() const { return (PackedPositionAndSize >> 12) & 0x3F; }
	uint8 GetWidth() const { return (PackedPositionAndSize >> 18) & 0x3F; }
	uint8 GetHeight() const { return (PackedPositionAndSize >> 24) & 0x3F; }
	uint8 GetFaceDirection() const
	{
		uint8 Low = (PackedPositionAndSize >> 30) & 0x3;
		uint8 High = (PackedMaterialAndAO >> 24) & 0x1;
		return Low | (High << 2);
	}
	uint16 GetVoxelType() const { return PackedMaterialAndAO & 0xFFFF; }
	uint8 GetPaletteIndex() const { return (PackedMaterialAndAO >> 16) & 0x7; }
	uint8 GetAOValue() const { return (PackedMaterialAndAO >> 19) & 0x3; }
	uint8 GetFlags() const { return (PackedMaterialAndAO >> 21) & 0x7; }
	uint8 GetBoneIndex() const { return (PackedMaterialAndAO >> 25) & 0x7F; }
};

static_assert(sizeof(FHktVoxelVertex) == 8, "FHktVoxelVertex must be exactly 8 bytes");

// ============================================================================
// FHktVoxelBevelVertex — LOD0 볼록 모서리 베벨 전용 버텍스 (20 bytes)
//
// 플랫 greedy mesh와 별도의 VB/IB로 렌더링된다. 메인 복셀 VertexFactory가
// 6-bit 정수 위치에 쿼드 단위로 고정되어 있어 sub-voxel 비스듬한 베벨 위치를
// 담을 수 없기 때문.
//
// LocalPos        : voxel 단위 좌표. 셰이더가 HktVoxelSize 곱해 월드 유닛으로 변환.
// PackedNormal    : 법선 선언은 12가지 가능한 45° 방향 중 하나.
//                   [3:0]   axis         (0~2: 베벨 에지가 놓인 축)
//                   [4]     s1 sign      (0=음, 1=양)
//                   [5]     s2 sign      (0=음, 1=양)
//                   나머지 예약 — PS에서 lookup table로 normalize된 (1,1,0)/√2
//                   형태의 3D 벡터 계산.
// PackedMaterial : FHktVoxelVertex::PackedMaterialAndAO와 동일 레이아웃 — 팔레트
//                   룩업 / bone 인덱스 / flags 공유 코드 경로 재사용.
// ============================================================================
struct FHktVoxelBevelVertex
{
	float  PosX = 0.f;
	float  PosY = 0.f;
	float  PosZ = 0.f;
	uint32 PackedNormal = 0;
	uint32 PackedMaterial = 0;

	static FHktVoxelBevelVertex Make(
		float InX, float InY, float InZ,
		uint8 Axis, bool bS1Pos, bool bS2Pos,
		uint16 VoxelType, uint8 PaletteIndex,
		uint8 AOValue, uint8 Flags, uint8 BoneIndex)
	{
		FHktVoxelBevelVertex V;
		V.PosX = InX;
		V.PosY = InY;
		V.PosZ = InZ;

		V.PackedNormal =
			(static_cast<uint32>(Axis) & 0xF) |
			((bS1Pos ? 1u : 0u) << 4) |
			((bS2Pos ? 1u : 0u) << 5);

		// FHktVoxelVertex::PackedMaterialAndAO와 동일 레이아웃
		V.PackedMaterial =
			(static_cast<uint32>(VoxelType) & 0xFFFF) |
			((static_cast<uint32>(PaletteIndex) & 0x7) << 16) |
			((static_cast<uint32>(AOValue) & 0x3) << 19) |
			((static_cast<uint32>(Flags) & 0x7) << 21) |
			((static_cast<uint32>(BoneIndex) & 0x7F) << 25);

		return V;
	}
};

static_assert(sizeof(FHktVoxelBevelVertex) == 20, "FHktVoxelBevelVertex must be 20 bytes");

// 면 방향 상수 (6면)
namespace EHktVoxelFace
{
	enum : uint8
	{
		PosX = 0,  // +X (오른쪽)
		NegX = 1,  // -X (왼쪽)
		PosY = 2,  // +Y (앞)
		NegY = 3,  // -Y (뒤)
		PosZ = 4,  // +Z (위)
		NegZ = 5,  // -Z (아래)
		Count = 6,
	};

	inline FIntVector GetNormal(uint8 Face)
	{
		static const FIntVector Normals[6] = {
			{1, 0, 0}, {-1, 0, 0},
			{0, 1, 0}, {0, -1, 0},
			{0, 0, 1}, {0, 0, -1},
		};
		return Normals[Face];
	}

	// 면의 축 인덱스 (0=X, 1=Y, 2=Z)
	inline int32 GetAxis(uint8 Face) { return Face / 2; }

	// 면이 양의 방향인지
	inline bool IsPositive(uint8 Face) { return (Face % 2) == 0; }
}
