// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

class UMaterialInterface;

// ============================================================================
// HktSpriteBillboardMaterial — 런타임 로더 (Editor / Shipping 공통)
//
// HISM 스프라이트 크라우드 렌더러(`UHktSpriteCrowdRenderer`)용 디폴트
// Y-axis 빌보드 머티리얼을 플러그인 콘텐츠에서 로드해 반환한다.
//
//  - 실물 `UMaterial` 에셋 경로: /HktGameplay/Materials/M_HktSpriteYBillboard
//    (디스크: HktGameplay/Content/Materials/M_HktSpriteYBillboard.uasset)
//  - 에셋은 HktSpriteGenerator(Editor 모듈)가 빌드·저장한다. 모듈 스타트업 시
//    자동 체크·생성되며, `HktSprite.BuildBillboardMaterial` 콘솔 명령으로도
//    강제 재생성 가능.
//  - 에셋이 없는 Shipping 빌드에서는 엔진 기본 머티리얼로 폴백(경고 로그).
//
// 머티리얼 특성:
//  - Unlit / Masked / TwoSided / UsedWithInstancedStaticMeshes
//  - CPD 16슬롯(HktSpriteCrowdRenderer.cpp 레이아웃) 소비:
//      0..3   : AtlasIndex, CellW, CellH, reserved
//      4..5   : Pivot Offset (world units)
//      6      : Rotation (radians, 평면 내)
//      7..8   : Scale (half-width, half-height in world units)
//      9..12  : Tint RGBA
//      13     : Palette Index (현재 미사용)
//      14     : Flip X (0 / 1)
//      15     : Z-Bias (cm toward camera)
//  - World Position Offset으로 쿼드를 월드 Z축(Up)과 카메라-수평 Right축에 정렬
//  - Parameter: "Atlas" (Texture2D), "AtlasSize" (Vector4: xy=픽셀 크기)
//
// 쿼드 메쉬 규약:
//  - 로컬 XY 평면에 위치, 피벗 하단 중앙
//  - TexCoord[0].x ∈ [0,1]: 좌우,  TexCoord[0].y ∈ [0,1]: 상단→하단(UV 표준)
//  - 머티리얼이 TexCoord[0]을 quad corner 파라미터로 사용하므로 실제 LocalPosition
//    범위와 무관하게 동작한다.
// ============================================================================

namespace HktSpriteBillboardMaterial
{
	/** 파츠 아틀라스를 바인딩하는 Texture 파라미터 이름. */
	HKTSPRITECORE_API extern const FName AtlasParamName;

	/** 아틀라스 픽셀 크기(Width/Height)를 전달하는 Vector 파라미터 이름. */
	HKTSPRITECORE_API extern const FName AtlasSizeParamName;

	/** 기본 머티리얼 에셋 패키지 경로 (롱 패키지 네임). */
	HKTSPRITECORE_API extern const TCHAR* PackagePath;

	/** 기본 머티리얼 에셋 오브젝트 경로 (LoadObject 인자). */
	HKTSPRITECORE_API extern const TCHAR* AssetObjectPath;

	/** 기본 머티리얼 오브젝트 이름. */
	HKTSPRITECORE_API extern const TCHAR* MaterialName;

	/**
	 * 디폴트 Y-axis 빌보드 머티리얼을 로드해 반환(캐시됨).
	 * 에셋이 없으면 엔진 기본 머티리얼로 폴백.
	 */
	HKTSPRITECORE_API UMaterialInterface* GetDefault();
}
