// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// 복셀 스킨 레이어 정의
//
// 캐릭터 복셀 메시는 7개 레이어로 구성된다.
// 각 레이어는 독립적으로 교체 가능하여 모듈러 외형을 지원한다.
// ============================================================================

namespace EHktVoxelSkinLayer
{
	enum Type : uint8
	{
		Body    = 0,   // 기본 몸체
		Head    = 1,   // 머리
		Armor   = 2,   // 갑옷/상의
		Boots   = 3,   // 부츠/하의
		Gloves  = 4,   // 장갑
		Cape    = 5,   // 망토/날개
		Weapon  = 6,   // 무기

		Count   = 7,
	};

	inline const TCHAR* ToString(Type Layer)
	{
		static const TCHAR* Names[] = {
			TEXT("Body"), TEXT("Head"), TEXT("Armor"), TEXT("Boots"),
			TEXT("Gloves"), TEXT("Cape"), TEXT("Weapon"),
		};
		return (Layer < Count) ? Names[Layer] : TEXT("Unknown");
	}
}

// ============================================================================
// FHktVoxelSkinID — 스킨 식별자
// ============================================================================

struct FHktVoxelSkinID
{
	uint16 SkinSetID = 0;       // 스킨 세트 (기본, 화염, 얼음 등)
	uint8  PaletteRow = 0;      // 팔레트 텍스처 행 번호 (0~255)
	uint8  Grade = 0;           // 스킨 등급 (파편 수에 영향)

	bool operator==(const FHktVoxelSkinID& Other) const
	{
		return SkinSetID == Other.SkinSetID && PaletteRow == Other.PaletteRow;
	}
};

// ============================================================================
// FHktVoxelSkinLayerData — 개별 레이어의 복셀 데이터 참조
// ============================================================================

class UHktVoxelSkinLayerAsset;

struct FHktVoxelSkinLayerData
{
	EHktVoxelSkinLayer::Type Layer = EHktVoxelSkinLayer::Body;
	FHktVoxelSkinID SkinID;
	FIntVector Offset = FIntVector::ZeroValue;  // 레이어 오프셋 (장착 위치)
	bool bVisible = true;

	/** 복셀 에셋 참조 — nullptr이면 GenerateDefaultShape() 폴백 */
	TWeakObjectPtr<UHktVoxelSkinLayerAsset> VoxelLayerAsset;
};

// ============================================================================
// FHktVoxelSparse — 단일 희소 복셀 엔트리
// ============================================================================

struct FHktVoxelSparse
{
	uint8 X = 0;         // 32^3 청크 내 로컬 위치
	uint8 Y = 0;
	uint8 Z = 0;
	uint16 TypeID = 0;
	uint8 PaletteIndex = 0;
	uint8 Flags = 0;
};

// ============================================================================
// FHktVoxelBoneGroup — 하나의 본에 귀속된 복셀 그룹
// ============================================================================

struct FHktVoxelBoneGroup
{
	FName BoneName;                                       // 스켈레톤 본 이름
	FIntVector LocalOrigin = FIntVector::ZeroValue;       // 본 그룹 AABB 최소점 (원본 32^3 공간)
	FVector RefPoseBonePos = FVector::ZeroVector;         // 레퍼런스 포즈에서 본 월드 위치
	TArray<FHktVoxelSparse> Voxels;                       // 본에 귀속된 복셀들
};
