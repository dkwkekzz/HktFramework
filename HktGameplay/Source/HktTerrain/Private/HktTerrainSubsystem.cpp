// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainSubsystem.h"
#include "HktTerrainGenerator.h"
#include "HktTerrainLog.h"
#include "Engine/AssetManager.h"
#include "Engine/StreamableManager.h"
#include "Engine/World.h"

namespace
{
	/**
	 * 폴백 인자 출처 우선순위 결정 헬퍼.
	 *
	 *  1. Subsystem 의 BakedAsset->GeneratorConfig
	 *  2. UHktRuntimeGlobalSetting::ToTerrainConfig() — HktRuntime 모듈 의존을
	 *     피하기 위해 여기서는 직접 호출하지 않고 호출자가 SetFallbackConfig 로
	 *     주입하도록 한다 (HktTerrain 은 HktRuntime 에 의존하지 않음).
	 *  3. 컴파일 기본값 (FHktTerrainGeneratorConfig 의 in-class initializer).
	 *
	 * 현재 구현은 1, 3 만 사용 — 2는 호출 측(예: AHktVoxelTerrainActor)이
	 * 첫 LoadBakedAsset 호출 전에 기본 Config 를 별도 경로로 SetTerrainConfig
	 * 하여 시뮬레이션 측에 전달하는 기존 흐름을 유지한다.
	 */
	FHktTerrainGeneratorConfig PickEffectiveConfig(const UHktTerrainBakedAsset* BakedAsset)
	{
		if (BakedAsset)
		{
			return BakedAsset->GeneratorConfig.ToConfig();
		}
		return FHktTerrainGeneratorConfig{};
	}
}

UHktTerrainSubsystem::UHktTerrainSubsystem() = default;

bool UHktTerrainSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
	// Game / PIE / Editor 월드에서만 인스턴스화. Preview / Inactive 월드(에셋 썸네일,
	// 애니메이션 캡처 프리뷰 등)에서는 지형 데이터가 불필요하므로 생성을 건너뛴다.
	const UWorld* World = Cast<UWorld>(Outer);
	if (!World) return false;

	const EWorldType::Type Type = World->WorldType;
	return Type == EWorldType::Game
	    || Type == EWorldType::PIE
	    || Type == EWorldType::Editor;
}

UHktTerrainSubsystem* UHktTerrainSubsystem::Get(const UObject* WorldContext)
{
	if (!WorldContext) return nullptr;
	UWorld* World = WorldContext->GetWorld();
	if (!World) return nullptr;
	return World->GetSubsystem<UHktTerrainSubsystem>();
}

void UHktTerrainSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	UE_LOG(LogHktTerrain, Log, TEXT("UHktTerrainSubsystem Initialized for World '%s'"),
		*GetNameSafe(GetWorld()));
}

void UHktTerrainSubsystem::Deinitialize()
{
	if (PendingLoadHandle.IsValid())
	{
		PendingLoadHandle->CancelHandle();
		PendingLoadHandle.Reset();
	}

	ChunkCache.Reset();
	FallbackGenerator.Reset();
	BakedAsset = nullptr;
	bFallbackConfigCached = false;

	UE_LOG(LogHktTerrain, Log,
		TEXT("UHktTerrainSubsystem Deinitialized — BakedHits=%d FallbackHits=%d"),
		BakedHitCount, FallbackHitCount);

	Super::Deinitialize();
}

void UHktTerrainSubsystem::LoadBakedAsset(
	const TSoftObjectPtr<UHktTerrainBakedAsset>& SoftRef,
	TFunction<void(UHktTerrainBakedAsset*)> OnLoaded)
{
	if (SoftRef.IsNull())
	{
		UE_LOG(LogHktTerrain, Warning,
			TEXT("LoadBakedAsset: SoftRef 가 null — 폴백 경로만 동작합니다."));
		if (OnLoaded) OnLoaded(nullptr);
		return;
	}

	// 이미 로드된 자산이면 즉시 콜백 (캐시 무효화 책임은 호출자).
	if (UHktTerrainBakedAsset* Already = SoftRef.Get())
	{
		BakedAsset = Already;
		ChunkCache.Reset();
		FallbackGenerator.Reset();
		bFallbackConfigCached = false;
		UE_LOG(LogHktTerrain, Log,
			TEXT("LoadBakedAsset: '%s' 이미 로드됨 — 즉시 결합. ChunkCount=%d"),
			*GetNameSafe(Already), Already->Chunks.Num());
		if (OnLoaded) OnLoaded(Already);
		return;
	}

	// 비동기 로드
	FStreamableManager& Streamable = UAssetManager::GetStreamableManager();
	TWeakObjectPtr<UHktTerrainSubsystem> WeakThis(this);

	PendingLoadHandle = Streamable.RequestAsyncLoad(
		SoftRef.ToSoftObjectPath(),
		FStreamableDelegate::CreateLambda([WeakThis, SoftRef, OnLoaded]()
		{
			UHktTerrainSubsystem* Self = WeakThis.Get();
			if (!Self) { if (OnLoaded) OnLoaded(nullptr); return; }

			UHktTerrainBakedAsset* Loaded = SoftRef.Get();
			Self->BakedAsset = Loaded;
			Self->ChunkCache.Reset();
			Self->FallbackGenerator.Reset();
			Self->bFallbackConfigCached = false;
			Self->PendingLoadHandle.Reset();

			if (Loaded)
			{
				UE_LOG(LogHktTerrain, Log,
					TEXT("LoadBakedAsset: '%s' 로드 완료 — ChunkCount=%d Region=[%s, %s]"),
					*GetNameSafe(Loaded), Loaded->Chunks.Num(),
					*Loaded->RegionMin.ToString(), *Loaded->RegionMax.ToString());
			}
			else
			{
				UE_LOG(LogHktTerrain, Warning,
					TEXT("LoadBakedAsset: 비동기 로드 실패 — 폴백 경로만 동작합니다."));
			}

			if (OnLoaded) OnLoaded(Loaded);
		}),
		FStreamableManager::AsyncLoadHighPriority);
}

UHktTerrainBakedAsset* UHktTerrainSubsystem::LoadBakedAssetSync(
	const TSoftObjectPtr<UHktTerrainBakedAsset>& SoftRef)
{
	if (SoftRef.IsNull()) return nullptr;

	UHktTerrainBakedAsset* Loaded = SoftRef.LoadSynchronous();
	BakedAsset = Loaded;
	ChunkCache.Reset();
	FallbackGenerator.Reset();
	bFallbackConfigCached = false;

	if (Loaded)
	{
		UE_LOG(LogHktTerrain, Log,
			TEXT("LoadBakedAssetSync: '%s' — ChunkCount=%d"),
			*GetNameSafe(Loaded), Loaded->Chunks.Num());
	}
	return Loaded;
}

FHktTerrainGeneratorConfig UHktTerrainSubsystem::GetEffectiveConfig() const
{
	return PickEffectiveConfig(BakedAsset);
}

const FHktTerrainGenerator& UHktTerrainSubsystem::EnsureFallbackGenerator()
{
	const FHktTerrainGeneratorConfig EffectiveConfig = PickEffectiveConfig(BakedAsset);

	const bool bConfigChanged =
		!bFallbackConfigCached ||
		FMemory::Memcmp(&EffectiveConfig, &FallbackConfigCached, sizeof(FHktTerrainGeneratorConfig)) != 0;

	if (!FallbackGenerator.IsValid() || bConfigChanged)
	{
		FallbackGenerator      = MakeUnique<FHktTerrainGenerator>(EffectiveConfig);
		FallbackConfigCached   = EffectiveConfig;
		bFallbackConfigCached  = true;
	}
	return *FallbackGenerator;
}

void UHktTerrainSubsystem::LogFallbackOriginOnce(const TCHAR* Origin)
{
	if (bFallbackOriginLogged) return;
	bFallbackOriginLogged = true;
	UE_LOG(LogHktTerrain, Log,
		TEXT("Terrain fallback Config 출처: %s — 첫 폴백 호출에서 1회만 출력."), Origin);
}

const FHktTerrainVoxel* UHktTerrainSubsystem::AcquireChunk(const FIntVector& Coord)
{
	// 1. 캐시 적중
	if (TSharedPtr<FCachedChunk>* Existing = ChunkCache.Find(Coord))
	{
		(*Existing)->LastAccessTick = ++NextAccessTick;
		return (*Existing)->Voxels.GetData();
	}

	// 2. Baked 자산 조회
	TSharedPtr<FCachedChunk> Entry = MakeShared<FCachedChunk>();
	Entry->Coord = Coord;
	Entry->Voxels.SetNumUninitialized(FHktTerrainGeneratorConfig::ChunkSize *
	                                  FHktTerrainGeneratorConfig::ChunkSize *
	                                  FHktTerrainGeneratorConfig::ChunkSize);
	Entry->LastAccessTick = ++NextAccessTick;

	if (BakedAsset && BakedAsset->TryDecompressChunk(Coord, Entry->Voxels.GetData()))
	{
		Entry->bFromBaked = true;
		++BakedHitCount;
		ChunkCache.Add(Coord, Entry);
		EvictIfNeeded();
		return Entry->Voxels.GetData();
	}

	// 3. 폴백 — 동일 Generator 로 즉시 생성 + 경고 로그
	UE_LOG(LogHktTerrain, Warning,
		TEXT("Chunk %s 베이크 미존재 — 런타임 생성 폴백"), *Coord.ToString());
	LogFallbackOriginOnce(BakedAsset ? TEXT("BakedAsset->GeneratorConfig")
	                                 : TEXT("CompileDefault (FHktTerrainGeneratorConfig{})"));

	const FHktTerrainGenerator& Gen = EnsureFallbackGenerator();
	Gen.GenerateChunk(Coord.X, Coord.Y, Coord.Z, Entry->Voxels.GetData());
	Entry->bFromBaked = false;
	++FallbackHitCount;
	ChunkCache.Add(Coord, Entry);
	EvictIfNeeded();
	return Entry->Voxels.GetData();
}

void UHktTerrainSubsystem::ReleaseChunk(const FIntVector& Coord)
{
	ChunkCache.Remove(Coord);
}

void UHktTerrainSubsystem::EvictIfNeeded()
{
	if (ChunkCache.Num() <= MaxCachedChunks) return;

	// LRU: LastAccessTick 가장 작은 항목부터 축출
	const int32 ToRemove = ChunkCache.Num() - MaxCachedChunks;

	TArray<TPair<uint64, FIntVector>> Sorted;
	Sorted.Reserve(ChunkCache.Num());
	for (const auto& KV : ChunkCache)
	{
		Sorted.Emplace(KV.Value->LastAccessTick, KV.Key);
	}
	Sorted.Sort([](const TPair<uint64, FIntVector>& A, const TPair<uint64, FIntVector>& B)
	{
		return A.Key < B.Key;
	});

	for (int32 i = 0; i < ToRemove && i < Sorted.Num(); ++i)
	{
		ChunkCache.Remove(Sorted[i].Value);
	}
}

void UHktTerrainSubsystem::SamplePreview(
	int32 MinWorldX, int32 MinWorldY, int32 Width, int32 Height,
	FHktTerrainPreviewRegion& OutRegion)
{
	const FHktTerrainGenerator& Gen = EnsureFallbackGenerator();
	Gen.SamplePreviewRegion(MinWorldX, MinWorldY, Width, Height, OutRegion);
}
