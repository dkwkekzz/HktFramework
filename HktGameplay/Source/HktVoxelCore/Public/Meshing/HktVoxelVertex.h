// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// FHktVoxelVertex — 복셀 전용 압축 버텍스 (16 bytes per quad vertex)
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
//
// BevelOffset (4 × int16 = 8 bytes):
//   [.x, .y, .z] = 복셀 단위 * 1024 로 고정소수점 인코딩된 per-vertex offset.
//                  셰이더가 voxel 단위로 복원해 LocalPos에 더한다.
//                  일반 청크는 전부 0 (오프셋 없음), 플레이어 소속 청크에서만
//                  greedy-merge된 쿼드의 실루엣 모서리가 0이 아닌 값을 가진다.
//   [.w]        = 패딩 (정렬용, 사용하지 않음)
// ============================================================================

struct FHktVoxelVertex
{
	uint32 PackedPositionAndSize;
	uint32 PackedMaterialAndAO;
	int16  BevelOffsetX;
	int16  BevelOffsetY;
	int16  BevelOffsetZ;
	int16  BevelOffsetPad;

	FHktVoxelVertex()
		: PackedPositionAndSize(0)
		, PackedMaterialAndAO(0)
		, BevelOffsetX(0)
		, BevelOffsetY(0)
		, BevelOffsetZ(0)
		, BevelOffsetPad(0)
	{}

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

		V.BevelOffsetX = 0;
		V.BevelOffsetY = 0;
		V.BevelOffsetZ = 0;
		V.BevelOffsetPad = 0;
		return V;
	}

	/** Bevel offset 설정 — voxel 단위의 float를 int16(1/1024 단위)로 quantize */
	void SetBevelOffset(float OffsetX, float OffsetY, float OffsetZ)
	{
		auto Quantize = [](float V) -> int16
		{
			const float Scaled = V * 1024.0f;
			const float Clamped = FMath::Clamp(Scaled, -32767.0f, 32767.0f);
			return static_cast<int16>(FMath::RoundToFloat(Clamped));
		};
		BevelOffsetX = Quantize(OffsetX);
		BevelOffsetY = Quantize(OffsetY);
		BevelOffsetZ = Quantize(OffsetZ);
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

static_assert(sizeof(FHktVoxelVertex) == 16, "FHktVoxelVertex must be exactly 16 bytes");

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
