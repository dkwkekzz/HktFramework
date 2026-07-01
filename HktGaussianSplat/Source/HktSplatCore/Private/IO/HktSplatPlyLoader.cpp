// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IO/HktSplatPlyLoader.h"
#include "HktSplatCoreLog.h"
#include "Misc/FileHelper.h"

namespace
{
	// ── PLY 프로퍼티 타입 ──────────────────────────────────────────────
	enum class EPlyType : uint8 { Float, Double, Char, UChar, Short, UShort, Int, UInt, Unknown };

	int32 PlyTypeSize(EPlyType T)
	{
		switch (T)
		{
		case EPlyType::Char: case EPlyType::UChar:   return 1;
		case EPlyType::Short: case EPlyType::UShort:  return 2;
		case EPlyType::Int: case EPlyType::UInt: case EPlyType::Float: return 4;
		case EPlyType::Double: return 8;
		default: return 0;
		}
	}

	EPlyType ParsePlyType(const FString& Token)
	{
		if (Token == TEXT("float") || Token == TEXT("float32")) return EPlyType::Float;
		if (Token == TEXT("double") || Token == TEXT("float64")) return EPlyType::Double;
		if (Token == TEXT("char") || Token == TEXT("int8")) return EPlyType::Char;
		if (Token == TEXT("uchar") || Token == TEXT("uint8")) return EPlyType::UChar;
		if (Token == TEXT("short") || Token == TEXT("int16")) return EPlyType::Short;
		if (Token == TEXT("ushort") || Token == TEXT("uint16")) return EPlyType::UShort;
		if (Token == TEXT("int") || Token == TEXT("int32")) return EPlyType::Int;
		if (Token == TEXT("uint") || Token == TEXT("uint32")) return EPlyType::UInt;
		return EPlyType::Unknown;
	}

	struct FPlyProp
	{
		FString  Name;
		EPlyType Type = EPlyType::Unknown;
		int32    Offset = 0;   // 버텍스 레코드 내 바이트 오프셋
	};

	// little-endian 원시 값을 float 로 읽는다 (지원 타입 전부 float 로 승격)
	float ReadAsFloat(const uint8* Base, const FPlyProp& Prop, bool bLittleEndian)
	{
		const uint8* P = Base + Prop.Offset;
		auto Load = [&](int32 N) -> uint64
		{
			uint64 V = 0;
			if (bLittleEndian) { for (int32 i = 0; i < N; ++i) V |= (uint64)P[i] << (8 * i); }
			else               { for (int32 i = 0; i < N; ++i) V = (V << 8) | P[i]; }
			return V;
		};
		switch (Prop.Type)
		{
		case EPlyType::Float:  { uint32 U = (uint32)Load(4); float F; FMemory::Memcpy(&F, &U, 4); return F; }
		case EPlyType::Double: { uint64 U = Load(8); double D; FMemory::Memcpy(&D, &U, 8); return (float)D; }
		case EPlyType::Char:   return (float)(int8)Load(1);
		case EPlyType::UChar:  return (float)(uint8)Load(1);
		case EPlyType::Short:  return (float)(int16)Load(2);
		case EPlyType::UShort: return (float)(uint16)Load(2);
		case EPlyType::Int:    return (float)(int32)Load(4);
		case EPlyType::UInt:   return (float)(uint32)Load(4);
		default: return 0.0f;
		}
	}

	// 정규화 쿼터니언(w,x,y,z) → 3x3 회전행렬 R[row][col]
	void QuatToMatrix(float w, float x, float y, float z, float R[3][3])
	{
		const float N = FMath::Sqrt(w * w + x * x + y * y + z * z);
		if (N > SMALL_NUMBER) { const float Inv = 1.0f / N; w *= Inv; x *= Inv; y *= Inv; z *= Inv; }
		else { w = 1.0f; x = y = z = 0.0f; }

		R[0][0] = 1 - 2 * (y * y + z * z); R[0][1] = 2 * (x * y - w * z);     R[0][2] = 2 * (x * z + w * y);
		R[1][0] = 2 * (x * y + w * z);     R[1][1] = 1 - 2 * (x * x + z * z); R[1][2] = 2 * (y * z - w * x);
		R[2][0] = 2 * (x * z - w * y);     R[2][1] = 2 * (y * z + w * x);     R[2][2] = 1 - 2 * (x * x + y * y);
	}
}

bool FHktSplatPlyLoader::LoadFromFile(
	const FString& FilePath, const FHktSplatImportOptions& Options,
	FHktSplatCloud& OutCloud, FString& OutError)
{
	TArray<uint8> Bytes;
	if (!FFileHelper::LoadFileToArray(Bytes, *FilePath))
	{
		OutError = FString::Printf(TEXT("PLY 파일을 읽지 못함: %s"), *FilePath);
		return false;
	}
	return LoadFromBuffer(Bytes, Options, OutCloud, OutError);
}

bool FHktSplatPlyLoader::LoadFromBuffer(
	const TArray<uint8>& Bytes, const FHktSplatImportOptions& Options,
	FHktSplatCloud& OutCloud, FString& OutError)
{
	OutCloud.Reset();

	// ── 1) 헤더 파싱 ── "end_header\n" 까지는 ASCII 텍스트.
	const int32 Total = Bytes.Num();
	int32 HeaderEnd = INDEX_NONE;
	{
		const char* Needle = "end_header";
		for (int32 i = 0; i + 10 <= Total; ++i)
		{
			if (FMemory::Memcmp(Bytes.GetData() + i, Needle, 10) == 0)
			{
				// 개행까지 스킵
				int32 j = i + 10;
				while (j < Total && Bytes[j] != '\n') ++j;
				HeaderEnd = (j < Total) ? j + 1 : j;
				break;
			}
		}
	}
	if (HeaderEnd == INDEX_NONE)
	{
		OutError = TEXT("PLY 헤더('end_header')를 찾지 못함");
		return false;
	}

	FString Header;
	FFileHelper::BufferToString(Header, Bytes.GetData(), HeaderEnd);

	TArray<FString> Lines;
	Header.ParseIntoArrayLines(Lines);

	bool bBinary = false, bLittleEndian = true, bAscii = false;
	int64 VertexCount = 0;
	TArray<FPlyProp> Props;
	int32 Stride = 0;
	bool bInVertexElement = false;

	for (const FString& Raw : Lines)
	{
		FString Line = Raw.TrimStartAndEnd();
		if (Line.IsEmpty()) continue;

		TArray<FString> Tok;
		Line.ParseIntoArray(Tok, TEXT(" "), true);
		if (Tok.Num() == 0) continue;

		if (Tok[0] == TEXT("format") && Tok.Num() >= 2)
		{
			bAscii = Tok[1].Contains(TEXT("ascii"));
			bBinary = Tok[1].Contains(TEXT("binary"));
			bLittleEndian = !Tok[1].Contains(TEXT("big_endian"));
		}
		else if (Tok[0] == TEXT("element") && Tok.Num() >= 3)
		{
			bInVertexElement = (Tok[1] == TEXT("vertex"));
			if (bInVertexElement) { VertexCount = FCString::Atoi64(*Tok[2]); }
		}
		else if (Tok[0] == TEXT("property") && bInVertexElement && Tok.Num() >= 3)
		{
			// scalar property only (list 미지원 — 3DGS 버텍스는 전부 scalar)
			FPlyProp Prop;
			Prop.Type = ParsePlyType(Tok[1]);
			Prop.Name = Tok.Last();
			Prop.Offset = Stride;
			const int32 Sz = PlyTypeSize(Prop.Type);
			if (Sz == 0)
			{
				OutError = FString::Printf(TEXT("지원하지 않는 PLY 프로퍼티 타입: %s"), *Tok[1]);
				return false;
			}
			Stride += Sz;
			Props.Add(Prop);
		}
	}

	if (VertexCount <= 0)
	{
		OutError = TEXT("PLY 에 vertex element 가 없음");
		return false;
	}

	// ── 2) 필수 필드 오프셋 조회 ──
	TMap<FString, const FPlyProp*> ByName;
	for (const FPlyProp& P : Props) { ByName.Add(P.Name, &P); }

	auto Find = [&](const TCHAR* Name) -> const FPlyProp*
	{
		const FPlyProp** Pp = ByName.Find(Name);
		return Pp ? *Pp : nullptr;
	};

	const FPlyProp* PX = Find(TEXT("x"));
	const FPlyProp* PY = Find(TEXT("y"));
	const FPlyProp* PZ = Find(TEXT("z"));
	if (!PX || !PY || !PZ)
	{
		OutError = TEXT("PLY 에 위치(x,y,z) 프로퍼티가 없음");
		return false;
	}
	const FPlyProp* PScale[3] = { Find(TEXT("scale_0")), Find(TEXT("scale_1")), Find(TEXT("scale_2")) };
	const FPlyProp* PRot[4]   = { Find(TEXT("rot_0")), Find(TEXT("rot_1")), Find(TEXT("rot_2")), Find(TEXT("rot_3")) };
	const FPlyProp* POpacity  = Find(TEXT("opacity"));
	const FPlyProp* PDC[3]    = { Find(TEXT("f_dc_0")), Find(TEXT("f_dc_1")), Find(TEXT("f_dc_2")) };

	const bool bHasScaleRot = PScale[0] && PScale[1] && PScale[2] && PRot[0] && PRot[1] && PRot[2] && PRot[3];
	if (!bHasScaleRot)
	{
		OutError = TEXT("PLY 에 scale_0..2 / rot_0..3 이 없음 — 3DGS 포맷이 아님");
		return false;
	}

	// ── 3) 본문 파싱 ── (binary little-endian 우선. ascii 는 폴백 경로)
	OutCloud.Splats.Reserve((int32)VertexCount);

	// 좌표계 변환 행렬 P (오른손 y-down → UE z-up 왼손 기본 리매핑)
	// p' = (x, -z, y)
	const bool bConv = Options.bConvertCoordinateSystem;
	auto ConvertVec = [&](float x, float y, float z, float& ox, float& oy, float& oz)
	{
		if (bConv) { ox = x; oy = -z; oz = y; }
		else       { ox = x; oy = y;  oz = z; }
	};

	if (bBinary)
	{
		const int64 Need = (int64)HeaderEnd + VertexCount * Stride;
		if (Need > Total)
		{
			OutError = FString::Printf(TEXT("PLY 본문 크기 부족 (필요 %lld, 실제 %d)"), Need, Total);
			return false;
		}

		const uint8* Body = Bytes.GetData() + HeaderEnd;
		for (int64 v = 0; v < VertexCount; ++v)
		{
			const uint8* Rec = Body + v * Stride;

			const float rx = ReadAsFloat(Rec, *PX, bLittleEndian);
			const float ry = ReadAsFloat(Rec, *PY, bLittleEndian);
			const float rz = ReadAsFloat(Rec, *PZ, bLittleEndian);

			const float sLog0 = ReadAsFloat(Rec, *PScale[0], bLittleEndian);
			const float sLog1 = ReadAsFloat(Rec, *PScale[1], bLittleEndian);
			const float sLog2 = ReadAsFloat(Rec, *PScale[2], bLittleEndian);

			const float qw = ReadAsFloat(Rec, *PRot[0], bLittleEndian);
			const float qx = ReadAsFloat(Rec, *PRot[1], bLittleEndian);
			const float qy = ReadAsFloat(Rec, *PRot[2], bLittleEndian);
			const float qz = ReadAsFloat(Rec, *PRot[3], bLittleEndian);

			const float opLogit = POpacity ? ReadAsFloat(Rec, *POpacity, bLittleEndian) : 8.0f; // 없으면 불투명
			const float opacity = HktSplat::Sigmoid(opLogit);
			if (opacity < Options.MinOpacity) continue;

			// 색상: DC SH → [0,1]
			FVector3f Color(0.5f, 0.5f, 0.5f);
			if (PDC[0] && PDC[1] && PDC[2])
			{
				Color.X = 0.5f + HktSplat::SH_C0 * ReadAsFloat(Rec, *PDC[0], bLittleEndian);
				Color.Y = 0.5f + HktSplat::SH_C0 * ReadAsFloat(Rec, *PDC[1], bLittleEndian);
				Color.Z = 0.5f + HktSplat::SH_C0 * ReadAsFloat(Rec, *PDC[2], bLittleEndian);
			}
			Color.X = FMath::Clamp(Color.X, 0.0f, 1.0f);
			Color.Y = FMath::Clamp(Color.Y, 0.0f, 1.0f);
			Color.Z = FMath::Clamp(Color.Z, 0.0f, 1.0f);

			// 스케일(cm) — exp(logScale) * UniformScale
			const float US = Options.UniformScale;
			const float s0 = FMath::Exp(sLog0) * US;
			const float s1 = FMath::Exp(sLog1) * US;
			const float s2 = FMath::Exp(sLog2) * US;

			// M = R * S  (S 는 열 스케일)
			float R[3][3];
			QuatToMatrix(qw, qx, qy, qz, R);
			float M[3][3];
			for (int32 r = 0; r < 3; ++r)
			{
				M[r][0] = R[r][0] * s0;
				M[r][1] = R[r][1] * s1;
				M[r][2] = R[r][2] * s2;
			}

			// 좌표계 변환: M' = P * M, pos' = P * pos  (P: (x,y,z)->(x,-z,y))
			float Mc[3][3];
			if (bConv)
			{
				for (int32 c = 0; c < 3; ++c)
				{
					Mc[0][c] =  M[0][c];   // x' =  x
					Mc[1][c] = -M[2][c];   // y' = -z
					Mc[2][c] =  M[1][c];   // z' =  y
				}
			}
			else
			{
				FMemory::Memcpy(Mc, M, sizeof(M));
			}

			// Cov3D = M' * M'ᵀ (대칭). 상삼각 6원소.
			auto Dot = [&](int32 i, int32 j)
			{
				return Mc[i][0] * Mc[j][0] + Mc[i][1] * Mc[j][1] + Mc[i][2] * Mc[j][2];
			};

			FHktSplatVertexGPU Out;
			float ox, oy, oz;
			ConvertVec(rx, ry, rz, ox, oy, oz);
			Out.Position = FVector3f(ox, oy, oz) * US;
			Out.Opacity = opacity;
			Out.Color = Color;
			Out.Cov3D[0] = Dot(0, 0); // xx
			Out.Cov3D[1] = Dot(0, 1); // xy
			Out.Cov3D[2] = Dot(0, 2); // xz
			Out.Cov3D[3] = Dot(1, 1); // yy
			Out.Cov3D[4] = Dot(1, 2); // yz
			Out.Cov3D[5] = Dot(2, 2); // zz

			OutCloud.Splats.Add(Out);
			OutCloud.LocalBounds += FVector(Out.Position);
		}
	}
	else if (bAscii)
	{
		OutError = TEXT("ASCII PLY 는 아직 미지원 (binary_little_endian 로 내보낼 것)");
		return false;
	}
	else
	{
		OutError = TEXT("알 수 없는 PLY format");
		return false;
	}

	OutCloud.SHDegree = 0;
	UE_LOG(LogHktSplat, Log, TEXT("PLY 로드 완료 — 스플랫 %d개 (원본 vertex %lld), 바운드 %s"),
		OutCloud.Num(), VertexCount, *OutCloud.LocalBounds.ToString());

	if (OutCloud.IsEmpty())
	{
		OutError = TEXT("로드된 스플랫이 0개 (MinOpacity 컬링 과다?)");
		return false;
	}
	return true;
}
