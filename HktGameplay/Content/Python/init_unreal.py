"""
init_unreal.py — HktGameplay 플러그인 Python 부트스트랩.

본 파일이 존재하면 UE5 Python 플러그인이 본 디렉토리를 sys.path 에 자동 등록한다.
이를 통해 에디터에서 `py bake_terrain.py` 같은 한 줄 호출이 가능해진다.

별도 초기화 로직은 두지 않는다 (스크립트는 명시적 호출 시점에만 동작).
"""
