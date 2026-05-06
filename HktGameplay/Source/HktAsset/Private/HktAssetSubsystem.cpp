#include "HktAssetSubsystem.h"
#include "HktAssetLog.h"
#include "HktTagDataAsset.h"
#include "HktAssetSettings.h"
#include "HktCoreEventLog.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Engine/AssetManager.h"

DEFINE_LOG_CATEGORY(LogHktAsset);

void UHktAssetSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    RebuildTagMap();
}

void UHktAssetSubsystem::Deinitialize()
{
    Super::Deinitialize();
}

UHktAssetSubsystem* UHktAssetSubsystem::Get(UWorld* World)
{
    if (World && World->GetGameInstance())
    {
        return World->GetGameInstance()->GetSubsystem<UHktAssetSubsystem>();
    }
    return nullptr;
}

void UHktAssetSubsystem::RebuildTagMap()
{
    TagToPathMap.Empty();
    TagToRenderCategoryMap.Empty();

    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    IAssetRegistry& AssetRegistry = AssetRegistryModule.Get();

    FARFilter Filter;
    Filter.ClassPaths.Add(UHktTagDataAsset::StaticClass()->GetClassPathName());
    Filter.bRecursiveClasses = true;

    TArray<FAssetData> AssetList;
    AssetRegistry.GetAssets(Filter, AssetList);

    for (const FAssetData& AssetData : AssetList)
    {
        FString TagString;
        if (AssetData.GetTagValue(FName("IdentifierTag"), TagString))
        {
            FGameplayTag FoundTag = FGameplayTag::RequestGameplayTag(FName(*TagString));
            if (FoundTag.IsValid())
            {
                // SoftObjectPath만 저장하여 메모리 절약
                TagToPathMap.Add(FoundTag, AssetData.ToSoftObjectPath());

                // 클래스 CDO 로부터 렌더 카테고리 미리 해석. 에셋 자체는 로드하지 않음.
                if (UClass* AssetClass = AssetData.GetClass())
                {
                    if (const UHktTagDataAsset* CDO = Cast<UHktTagDataAsset>(AssetClass->GetDefaultObject()))
                    {
                        const EHktRenderCategory Cat = CDO->GetRenderCategory();
                        if (Cat != EHktRenderCategory::None)
                        {
                            TagToRenderCategoryMap.Add(FoundTag, Cat);
                        }
                    }
                }
            }
        }
    }

    HKT_EVENT_LOG(HktLogTags::Asset, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("RebuildTagMap: %d tags registered"), TagToPathMap.Num()));
}

EHktRenderCategory UHktAssetSubsystem::ResolveRenderCategoryForPath(const FSoftObjectPath& Path) const
{
    if (!Path.IsValid()) return EHktRenderCategory::None;

    // 클래스 경로에서 UClass 만 가볍게 해석 (에셋 본체는 로드하지 않음).
    // FSoftObjectPath 는 AssetClassPath 를 직접 노출하지 않으므로 AssetRegistry 를 경유.
    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    IAssetRegistry& AssetRegistry = AssetRegistryModule.Get();

    const FAssetData AssetData = AssetRegistry.GetAssetByObjectPath(Path);
    if (!AssetData.IsValid()) return EHktRenderCategory::None;

    UClass* AssetClass = AssetData.GetClass();
    if (!AssetClass) return EHktRenderCategory::None;

    if (const UHktTagDataAsset* CDO = Cast<UHktTagDataAsset>(AssetClass->GetDefaultObject()))
    {
        return CDO->GetRenderCategory();
    }
    return EHktRenderCategory::None;
}

EHktRenderCategory UHktAssetSubsystem::GetTagRenderCategory(const FGameplayTag& Tag) const
{
    if (const EHktRenderCategory* C = TagToRenderCategoryMap.Find(Tag))
    {
        return *C;
    }
    return EHktRenderCategory::None;
}

// ============================================================================
// 경로 해결 (TagMap → OnMiss 순서)
// ============================================================================

FSoftObjectPath UHktAssetSubsystem::ResolvePath(FGameplayTag Tag)
{
    // 1. TagMap (DataAsset 기반)
    if (const FSoftObjectPath* Path = TagToPathMap.Find(Tag))
    {
        if (Path->IsValid())
        {
            return *Path;
        }
    }

    // 2. OnMiss 콜백 (Generator 연동)
    if (OnTagMiss.IsBound())
    {
        FSoftObjectPath GeneratedPath = OnTagMiss.Execute(Tag);
        if (GeneratedPath.IsValid())
        {
            TagToPathMap.Add(Tag, GeneratedPath);
            const EHktRenderCategory Cat = ResolveRenderCategoryForPath(GeneratedPath);
            if (Cat != EHktRenderCategory::None)
            {
                TagToRenderCategoryMap.Add(Tag, Cat);
            }
            HKT_EVENT_LOG(HktLogTags::Asset, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("OnTagMiss resolved: %s → %s"), *Tag.ToString(), *GeneratedPath.ToString()));
            return GeneratedPath;
        }
    }

    return FSoftObjectPath();
}

// ============================================================================
// Convention Path Resolution
// ============================================================================

FSoftObjectPath UHktAssetSubsystem::ResolveConventionPath(const FGameplayTag& Tag)
{
    if (!Tag.IsValid()) return FSoftObjectPath();

    const UHktAssetSettings* Settings = UHktAssetSettings::Get();
    if (!Settings) return FSoftObjectPath();

    FString ResolvedPath = Settings->ResolveConventionPath(Tag.ToString());
    if (ResolvedPath.IsEmpty()) return FSoftObjectPath();

    // AssetName 추출 (마지막 / 이후)
    FString AssetName;
    int32 LastSlash;
    if (ResolvedPath.FindLastChar('/', LastSlash))
    {
        AssetName = ResolvedPath.Mid(LastSlash + 1);
    }
    else
    {
        AssetName = ResolvedPath;
    }

    // FSoftObjectPath 형식: PackagePath.AssetName
    return FSoftObjectPath(FString::Printf(TEXT("%s.%s"), *ResolvedPath, *AssetName));
}

// ============================================================================
// 등록 / 재구축
// ============================================================================

void UHktAssetSubsystem::RegisterTagPath(FGameplayTag Tag, FSoftObjectPath Path)
{
    if (Tag.IsValid() && Path.IsValid())
    {
        TagToPathMap.Add(Tag, Path);

        const EHktRenderCategory Cat = ResolveRenderCategoryForPath(Path);
        if (Cat != EHktRenderCategory::None)
        {
            TagToRenderCategoryMap.Add(Tag, Cat);
        }
        HKT_EVENT_LOG(HktLogTags::Asset, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("RegisterTagPath: %s → %s"), *Tag.ToString(), *Path.ToString()));
    }
}

void UHktAssetSubsystem::ForceRebuildTagMap()
{
    RebuildTagMap();
}

// ============================================================================
// 로드 API (기존 — ResolvePath 활용으로 확장)
// ============================================================================

UHktTagDataAsset* UHktAssetSubsystem::LoadAssetSync(FGameplayTag Tag)
{
    if (!Tag.IsValid()) return nullptr;

    FSoftObjectPath Path = ResolvePath(Tag);
    if (!Path.IsValid())
    {
        HKT_EVENT_LOG(HktLogTags::Asset, EHktLogLevel::Warning, EHktLogSource::Client, FString::Printf(TEXT("LoadAssetSync: Tag not resolved: %s"), *Tag.ToString()));
        return nullptr;
    }

    if (UObject* ResolvedObj = Path.ResolveObject())
    {
        return Cast<UHktTagDataAsset>(ResolvedObj);
    }
    return Cast<UHktTagDataAsset>(Path.TryLoad());
}

void UHktAssetSubsystem::LoadAssetAsync(FGameplayTag Tag, FStreamableDelegate DelegateToCall)
{
    if (!Tag.IsValid())
    {
        DelegateToCall.ExecuteIfBound();
        return;
    }

    FSoftObjectPath Path = ResolvePath(Tag);
    if (Path.IsValid())
    {
        StreamableManager.RequestAsyncLoad(Path, DelegateToCall);
        return;
    }

    HKT_EVENT_LOG(HktLogTags::Asset, EHktLogLevel::Warning, EHktLogSource::Client, FString::Printf(TEXT("LoadAssetAsync: Tag not resolved: %s"), *Tag.ToString()));
}

void UHktAssetSubsystem::LoadAssetAsync(FGameplayTag Tag, TFunction<void(UHktTagDataAsset*)> OnLoaded)
{
    FStreamableDelegate Delegate = FStreamableDelegate::CreateUObject(this, &UHktAssetSubsystem::OnAssetLoadedInternal, Tag, OnLoaded);
    LoadAssetAsync(Tag, Delegate);
}

void UHktAssetSubsystem::OnAssetLoadedInternal(FGameplayTag Tag, TFunction<void(UHktTagDataAsset*)> Callback)
{
    UHktTagDataAsset* LoadedAsset = LoadAssetSync(Tag);

    if (Callback)
    {
        Callback(LoadedAsset);
    }
}

FSoftObjectPath UHktAssetSubsystem::ResolveTagPath(const FGameplayTag& Tag)
{
    return ResolvePath(Tag);
}

void UHktAssetSubsystem::LoadAssetByPathAsync(FSoftObjectPath Path, TFunction<void(UHktTagDataAsset*)> OnLoaded)
{
    if (!Path.IsValid())
    {
        if (OnLoaded) OnLoaded(nullptr);
        return;
    }

    StreamableManager.RequestAsyncLoad(Path, FStreamableDelegate::CreateLambda([Path, OnLoaded]()
    {
        UHktTagDataAsset* Asset = Cast<UHktTagDataAsset>(Path.ResolveObject());
        if (OnLoaded) OnLoaded(Asset);
    }));
}
