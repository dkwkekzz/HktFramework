"""microcosm - 하나의 규칙에서 2D 세계를 창발시키는 프레임워크 (파이썬).

    from microcosm import World, standard_fields
    w = World(); standard_fields(w)
    w.spawn_form('terrain')
    w.spawn_form('tree', baseX=60)
    w.spawn_form('creature', cx=120)
    w.run(300)
"""
from .core import World, KIND
from .fields import (Field, PairField, EnvField, BondField, TerrainField, standard_fields)
from .forms import REGISTRY, register, CreatureCtrl

__all__ = ["World", "KIND", "Field", "PairField", "EnvField", "BondField",
           "TerrainField", "standard_fields", "REGISTRY", "register", "CreatureCtrl"]
