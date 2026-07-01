// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * HktSplatTypes — 3D Gaussian Splatting 코어 데이터 타입.
 *
 * 좌표계 주의: 3DGS/COLMAP 원본은 미터 단위, y-down/z-forward(오른손) 계열이다.
 * 이 타입들은 *원본 값을 그대로* 담는다. UE(z-up, 왼손, cm) 로의 변환은
 * 로더 옵션(FHktSplatImportOptions) 및 컴포넌트 트랜스폼에서 처리한다.
 */

/** SH 0차(DC) 기저 상수 — color = 0.5 + SH_C0 * f_dc */
namespace HktSplat
{
	static constexpr float SH_C0 = 0.28209479177387814f;

	/** 로짓 → 확률 (opacity 복원) */
	FORCEINLINE float Sigmoid(float X)
	{
		return 1.0f / (1.0f + FMath::Exp(-X));
	}
}

/**
 * FHktSplatVertexGPU — GPU StructuredBuffer 원소 (64바이트, 16-float 정렬).
 *
 * HLSL `FHktSplatData` (HktSplatCommon.ush) 와 *바이트 단위로 일치*해야 한다.
 * 3D 공분산은 CPU 에서 M=R*S, Cov=M*Mᵀ 로 선계산해 상삼각 6원소만 올린다 —
 * 셰이더는 투영(2D 공분산)만 담당.
 */
struct FHktSplatVertexGPU
{
	FVector3f Position;   // 로컬 공간 위치 (컴포넌트 트랜스폼으로 월드 변환)
	float     Opacity;    // sigmoid 적용 완료 [0,1]

	FVector3f Color;      // DC SH → 선형 RGB [0,1]
	float     Pad0 = 0.0f;

	// 월드(로컬) 공간 3D 공분산 상삼각: xx, xy, xz, yy, yz, zz
	float     Cov3D[6] = { 0,0,0,0,0,0 };
	float     Pad1 = 0.0f;
	float     Pad2 = 0.0f;
};
static_assert(sizeof(FHktSplatVertexGPU) == 64, "FHktSplatVertexGPU must be 64 bytes to match HLSL FHktSplatData");

/**
 * FHktSplatCloud — 하나의 스플랫 클라우드 (CPU 측).
 *
 * Splats 배열은 그대로 GPU StructuredBuffer 로 업로드된다(단일 memcpy).
 * 게임 스레드에서 소유하며, 렌더 스레드로는 프록시가 복사본을 들고 간다.
 */
struct HKTSPLATCORE_API FHktSplatCloud
{
	TArray<FHktSplatVertexGPU> Splats;

	/** 로컬 공간 AABB — 컬링/바운드 계산용 */
	FBox LocalBounds = FBox(ForceInit);

	/** SH 차수 (0 = DC only). 현재 마일스톤은 0 고정, 뷰 의존 SH 는 로드맵. */
	int32 SHDegree = 0;

	int32 Num() const { return Splats.Num(); }
	bool IsEmpty() const { return Splats.Num() == 0; }

	void Reset()
	{
		Splats.Reset();
		LocalBounds = FBox(ForceInit);
		SHDegree = 0;
	}

	/** LocalBounds 를 Splats 위치로부터 재계산 */
	void RecomputeBounds()
	{
		LocalBounds = FBox(ForceInit);
		for (const FHktSplatVertexGPU& S : Splats)
		{
			LocalBounds += FVector(S.Position);
		}
	}
};

/** PLY 임포트 옵션 — 좌표계/단위 변환 제어 */
struct FHktSplatImportOptions
{
	/**
	 * 3DGS(오른손, y-down) → UE(왼손, z-up) 축 변환 적용 여부.
	 * true 면 (x, y, z) → (x, -z, y) 형태의 기본 리매핑을 적용한다.
	 */
	bool bConvertCoordinateSystem = true;

	/** 위치/스케일에 곱할 배율 (미터→cm 는 100). */
	float UniformScale = 100.0f;

	/** opacity 가 이 값 미만인 스플랫은 로드 시 제거 (0 = 컬링 안 함) */
	float MinOpacity = 1.0f / 255.0f;
};
