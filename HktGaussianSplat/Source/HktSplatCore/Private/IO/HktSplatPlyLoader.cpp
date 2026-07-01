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
		int32    Offset = 0;   // 버텍스 레코드 내 바이트 오프셋 (binary)
		int32    Index = 0;    // 프로퍼티 순번 (ascii 토큰 인덱스)
	};

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

	void QuatToMatrix(float w, float x, float y, float z, float R[3][3])
	{
		const float N = FMath::Sqrt(w * w + x * x + y * y + z * z);
		if (N > SMALL_NUMBER) { const float Inv = 1.0f / N; w *= Inv; x *= Inv; y *= Inv; z *= Inv; }
		else { w = 1.0f; x = y = z = 0.0f; }

		R[0][0] = 1 - 2 * (y * y + z * z); R[0][1] = 2 * (x * y - w * z);     R[0][2] = 2 * (x * z + w * y);
		R[1][0] = 2 * (x * y + w * z);     R[1][1] = 1 - 2 * (x * x + z * z); R[1][2] = 2 * (y * z - w * x);
		R[2][0] = 2 * (x * z - w * y);     R[2][1] = 2 * (y * z + w * x);     R[2][2] = 1 - 2 * (x * x + y * y);
	}

	constexpr float SplatSH_C0 = 0.28209479177387814f;

	/**
	 * 공통: 선형 스케일 + 쿼터니언 + 색/불투명도(0..1) → OutCloud 에 스플랫 1개 추가.
	 * @param LinScale  선형 스케일(exp 적용 완료, 소스 단위). 내부에서 UniformScale 곱함.
	 * @return 컬링되지 않고 추가되면 true
	 */
	bool EmitSplat(
		const FHktSplatImportOptions& Options, FHktSplatCloud& OutCloud,
		float px, float py, float pz,
		float LinS0, float LinS1, float LinS2,
		float qw, float qx, float qy, float qz,
		float Opacity, float CR, float CG, float CB)
	{
		if (Opacity < Options.MinOpacity) return false;

		const float US = Options.UniformScale;
		const float s0 = LinS0 * US, s1 = LinS1 * US, s2 = LinS2 * US;

		float R[3][3];
		QuatToMatrix(qw, qx, qy, qz, R);
		float M[3][3];
		for (int32 r = 0; r < 3; ++r) { M[r][0] = R[r][0] * s0; M[r][1] = R[r][1] * s1; M[r][2] = R[r][2] * s2; }

		// 좌표계 변환: (x,y,z) -> (x,-z,y)
		const bool bConv = Options.bConvertCoordinateSystem;
		float Mc[3][3];
		if (bConv) { for (int32 c = 0; c < 3; ++c) { Mc[0][c] = M[0][c]; Mc[1][c] = -M[2][c]; Mc[2][c] = M[1][c]; } }
		else { FMemory::Memcpy(Mc, M, sizeof(M)); }

		auto Dot = [&](int32 i, int32 j) { return Mc[i][0] * Mc[j][0] + Mc[i][1] * Mc[j][1] + Mc[i][2] * Mc[j][2]; };

		FHktSplatVertexGPU Out;
		if (bConv) { Out.Position = FVector3f(px, -pz, py) * US; }
		else       { Out.Position = FVector3f(px, py, pz) * US; }
		Out.Opacity = Opacity;
		Out.Color = FVector3f(FMath::Clamp(CR, 0.f, 1.f), FMath::Clamp(CG, 0.f, 1.f), FMath::Clamp(CB, 0.f, 1.f));
		Out.Cov3D[0] = Dot(0, 0); Out.Cov3D[1] = Dot(0, 1); Out.Cov3D[2] = Dot(0, 2);
		Out.Cov3D[3] = Dot(1, 1); Out.Cov3D[4] = Dot(1, 2); Out.Cov3D[5] = Dot(2, 2);

		OutCloud.Splats.Add(Out);
		OutCloud.LocalBounds += FVector(Out.Position);
		return true;
	}

	// ── antimatter15 .splat (32 bytes/splat) ──
	bool ParseSplat(const TArray<uint8>& Bytes, const FHktSplatImportOptions& Options, FHktSplatCloud& OutCloud, FString& OutError)
	{
		constexpr int32 REC = 32;
		if (Bytes.Num() % REC != 0)
		{
			OutError = TEXT(".splat 크기가 32의 배수가 아님");
			return false;
		}
		const int32 Count = Bytes.Num() / REC;
		OutCloud.Splats.Reserve(Count);
		const uint8* D = Bytes.GetData();

		auto F32 = [](const uint8* P) { float V; FMemory::Memcpy(&V, P, 4); return V; }; // LE 가정

		for (int32 i = 0; i < Count; ++i)
		{
			const uint8* B = D + i * REC;
			const float x = F32(B + 0), y = F32(B + 4), z = F32(B + 8);
			const float s0 = F32(B + 12), s1 = F32(B + 16), s2 = F32(B + 20); // 선형 스케일
			const float cr = B[24] / 255.f, cg = B[25] / 255.f, cb = B[26] / 255.f, op = B[27] / 255.f;
			const float qw = (B[28] - 128.f) / 128.f, qx = (B[29] - 128.f) / 128.f, qy = (B[30] - 128.f) / 128.f, qz = (B[31] - 128.f) / 128.f;
			EmitSplat(Options, OutCloud, x, y, z, s0, s1, s2, qw, qx, qy, qz, op, cr, cg, cb);
		}

		OutCloud.SHDegree = 0;
		UE_LOG(LogHktSplat, Log, TEXT(".splat 로드 완료 — 스플랫 %d개 (레코드 %d)"), OutCloud.Num(), Count);
		if (OutCloud.IsEmpty()) { OutError = TEXT("로드된 스플랫이 0개"); return false; }
		return true;
	}
}

bool FHktSplatPlyLoader::LoadFromFile(
	const FString& FilePath, const FHktSplatImportOptions& Options,
	FHktSplatCloud& OutCloud, FString& OutError)
{
	TArray<uint8> Bytes;
	if (!FFileHelper::LoadFileToArray(Bytes, *FilePath))
	{
		OutError = FString::Printf(TEXT("파일을 읽지 못함: %s"), *FilePath);
		return false;
	}
	return LoadFromBuffer(Bytes, Options, OutCloud, OutError);
}

bool FHktSplatPlyLoader::LoadFromBuffer(
	const TArray<uint8>& Bytes, const FHktSplatImportOptions& Options,
	FHktSplatCloud& OutCloud, FString& OutError)
{
	OutCloud.Reset();
	const int32 Total = Bytes.Num();

	// ── 포맷 판별: "ply" 매직이 아니면서 32배수면 .splat ──
	const bool bLooksPly = Total >= 3 && Bytes[0] == 'p' && Bytes[1] == 'l' && Bytes[2] == 'y';
	if (!bLooksPly)
	{
		if (Total > 0 && Total % 32 == 0) { return ParseSplat(Bytes, Options, OutCloud, OutError); }
		OutError = TEXT("인식할 수 없는 포맷 (지원: .ply binary/ascii, .splat)");
		return false;
	}

	// ── PLY 헤더 파싱 ──
	int32 HeaderEnd = INDEX_NONE;
	{
		const char* Needle = "end_header";
		for (int32 i = 0; i + 10 <= Total; ++i)
		{
			// 라인 시작에서만 매칭 — 주석/이름에 포함된 "end_header" 부분문자열 오탐 방지
			if ((i == 0 || Bytes[i - 1] == '\n') && FMemory::Memcmp(Bytes.GetData() + i, Needle, 10) == 0)
			{
				int32 j = i + 10;
				while (j < Total && Bytes[j] != '\n') ++j;
				HeaderEnd = (j < Total) ? j + 1 : j;
				break;
			}
		}
	}
	if (HeaderEnd == INDEX_NONE) { OutError = TEXT("PLY 헤더('end_header')를 찾지 못함"); return false; }

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
		const FString Line = Raw.TrimStartAndEnd();
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
			FPlyProp Prop;
			Prop.Type = ParsePlyType(Tok[1]);
			Prop.Name = Tok.Last();
			Prop.Offset = Stride;
			Prop.Index = Props.Num();
			const int32 Sz = PlyTypeSize(Prop.Type);
			if (Sz == 0) { OutError = FString::Printf(TEXT("지원하지 않는 PLY 타입: %s"), *Tok[1]); return false; }
			Stride += Sz;
			Props.Add(Prop);
		}
	}

	if (VertexCount <= 0) { OutError = TEXT("PLY 에 vertex element 가 없음"); return false; }

	TMap<FString, const FPlyProp*> ByName;
	for (const FPlyProp& P : Props) { ByName.Add(P.Name, &P); }
	auto Find = [&](const TCHAR* Name) -> const FPlyProp* { const FPlyProp** Pp = ByName.Find(Name); return Pp ? *Pp : nullptr; };

	const FPlyProp* PX = Find(TEXT("x")); const FPlyProp* PY = Find(TEXT("y")); const FPlyProp* PZ = Find(TEXT("z"));
	const FPlyProp* PScale[3] = { Find(TEXT("scale_0")), Find(TEXT("scale_1")), Find(TEXT("scale_2")) };
	const FPlyProp* PRot[4] = { Find(TEXT("rot_0")), Find(TEXT("rot_1")), Find(TEXT("rot_2")), Find(TEXT("rot_3")) };
	const FPlyProp* POpacity = Find(TEXT("opacity"));
	const FPlyProp* PDC[3] = { Find(TEXT("f_dc_0")), Find(TEXT("f_dc_1")), Find(TEXT("f_dc_2")) };

	if (!PX || !PY || !PZ || !PScale[0] || !PScale[1] || !PScale[2] || !PRot[0] || !PRot[1] || !PRot[2] || !PRot[3])
	{
		OutError = TEXT("3DGS 필수 프로퍼티(x,y,z,scale_0..2,rot_0..3) 누락");
		return false;
	}

	OutCloud.Splats.Reserve((int32)VertexCount);

	if (bBinary)
	{
		const int64 Need = (int64)HeaderEnd + VertexCount * Stride;
		if (Need > Total) { OutError = FString::Printf(TEXT("PLY 본문 크기 부족 (필요 %lld, 실제 %d)"), Need, Total); return false; }

		const uint8* Body = Bytes.GetData() + HeaderEnd;
		for (int64 v = 0; v < VertexCount; ++v)
		{
			const uint8* Rec = Body + v * Stride;
			// opacity 없으면 완전 불투명(1.0). ascii 경로와 동일 규약 — 인코딩별 편차 제거.
			const float opacity = POpacity ? HktSplat::Sigmoid(ReadAsFloat(Rec, *POpacity, bLittleEndian)) : 1.0f;
			float cr = 0.5f, cg = 0.5f, cb = 0.5f;
			if (PDC[0] && PDC[1] && PDC[2])
			{
				cr = 0.5f + SplatSH_C0 * ReadAsFloat(Rec, *PDC[0], bLittleEndian);
				cg = 0.5f + SplatSH_C0 * ReadAsFloat(Rec, *PDC[1], bLittleEndian);
				cb = 0.5f + SplatSH_C0 * ReadAsFloat(Rec, *PDC[2], bLittleEndian);
			}
			EmitSplat(Options, OutCloud,
				ReadAsFloat(Rec, *PX, bLittleEndian), ReadAsFloat(Rec, *PY, bLittleEndian), ReadAsFloat(Rec, *PZ, bLittleEndian),
				FMath::Exp(ReadAsFloat(Rec, *PScale[0], bLittleEndian)), FMath::Exp(ReadAsFloat(Rec, *PScale[1], bLittleEndian)), FMath::Exp(ReadAsFloat(Rec, *PScale[2], bLittleEndian)),
				ReadAsFloat(Rec, *PRot[0], bLittleEndian), ReadAsFloat(Rec, *PRot[1], bLittleEndian), ReadAsFloat(Rec, *PRot[2], bLittleEndian), ReadAsFloat(Rec, *PRot[3], bLittleEndian),
				opacity, cr, cg, cb);
		}
	}
	else if (bAscii)
	{
		// 본문 텍스트 토큰화 — 정점당 Props.Num() 토큰 (라인 경계 무시)
		FString Body;
		FFileHelper::BufferToString(Body, Bytes.GetData() + HeaderEnd, Total - HeaderEnd);
		TArray<FString> Tok;
		Body.ParseIntoArray(Tok, TEXT(" \t\r\n"), true);
		const int32 NP = Props.Num();
		if ((int64)Tok.Num() < VertexCount * NP)
		{
			OutError = FString::Printf(TEXT("ASCII PLY 본문 토큰 부족 (필요 %lld, 실제 %d)"), VertexCount * NP, Tok.Num());
			return false;
		}
		auto AF = [&](const FPlyProp* P, int64 Row) -> float { return FCString::Atof(*Tok[Row * NP + P->Index]); };

		for (int64 v = 0; v < VertexCount; ++v)
		{
			const float opacity = POpacity ? HktSplat::Sigmoid(AF(POpacity, v)) : 1.0f;
			float cr = 0.5f, cg = 0.5f, cb = 0.5f;
			if (PDC[0] && PDC[1] && PDC[2])
			{
				cr = 0.5f + SplatSH_C0 * AF(PDC[0], v); cg = 0.5f + SplatSH_C0 * AF(PDC[1], v); cb = 0.5f + SplatSH_C0 * AF(PDC[2], v);
			}
			EmitSplat(Options, OutCloud,
				AF(PX, v), AF(PY, v), AF(PZ, v),
				FMath::Exp(AF(PScale[0], v)), FMath::Exp(AF(PScale[1], v)), FMath::Exp(AF(PScale[2], v)),
				AF(PRot[0], v), AF(PRot[1], v), AF(PRot[2], v), AF(PRot[3], v),
				opacity, cr, cg, cb);
		}
	}
	else
	{
		OutError = TEXT("알 수 없는 PLY format");
		return false;
	}

	OutCloud.SHDegree = 0;
	UE_LOG(LogHktSplat, Log, TEXT("PLY 로드 완료 — 스플랫 %d개 (원본 %lld), 바운드 %s"),
		OutCloud.Num(), VertexCount, *OutCloud.LocalBounds.ToString());
	if (OutCloud.IsEmpty()) { OutError = TEXT("로드된 스플랫이 0개 (MinOpacity 컬링 과다?)"); return false; }
	return true;
}
