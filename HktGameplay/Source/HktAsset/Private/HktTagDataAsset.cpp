#include "HktTagDataAsset.h"

#if WITH_EDITORONLY_DATA
void UHktTagDataAsset::GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const
{
    Super::GetAssetRegistryTags(OutTags);

    // IdentifierTag가 유효하다면 메타데이터에 추가합니다.
    // 이렇게 하면 에셋을 LoadObject 하지 않고도 레지스트리 검색만으로 태그 확인이 가능합니다.
    if (IdentifierTag.IsValid())
    {
        OutTags.Add(FAssetRegistryTag(
            FName("IdentifierTag"),
            IdentifierTag.ToString(),
            FAssetRegistryTag::TT_Alphabetical
        ));
    }
}
#endif