// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Data/HktSplatTypes.h"

/**
 * FHktSplatPlyLoader — 3D Gaussian Splatting 표준 `.ply` 파서.
 *
 * INRIA 3DGS 계열이 내보내는 PLY 를 파싱한다:
 *   x, y, z                     위치
 *   scale_0..2                  로그 스케일 (실제 = exp)
 *   rot_0..3                    쿼터니언 (w, x, y, z 순, 비정규화)
 *   opacity                     로짓 (실제 = sigmoid)
 *   f_dc_0..2                   SH 0차 (DC) — 색상
 *   f_rest_0..N                 SH 고차 (현재 무시, 로드맵)
 *
 * `format binary_little_endian` 및 `ascii` 지원. 프로퍼티 순서는 헤더에서
 * 이름→오프셋 맵을 만들어 대응하므로 순서에 무관하다.
 */
class HKTSPLATCORE_API FHktSplatPlyLoader
{
public:
	/** 파일 경로에서 로드. 실패 시 false + OutError 채움. */
	static bool LoadFromFile(
		const FString& FilePath,
		const FHktSplatImportOptions& Options,
		FHktSplatCloud& OutCloud,
		FString& OutError);

	/** 이미 메모리에 있는 PLY 바이트에서 로드. */
	static bool LoadFromBuffer(
		const TArray<uint8>& Bytes,
		const FHktSplatImportOptions& Options,
		FHktSplatCloud& OutCloud,
		FString& OutError);
};
