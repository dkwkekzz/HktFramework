"""
microcosm - 하나의 규칙에서 게임 세계를 창발시키는 프레임워크 골격.

    from microcosm import World, standard_fields
    w = World()
    standard_fields(w)
    hero = w.spawn_form("character")
    w.spawn_form("fireball")
    w.run(60)
"""
from .core import World
from .fields import (
    Field, DragField, GravityField, ThermalField,
    RepulsionField, ElasticBondField, HomeostasisField, standard_fields,
)
from .forms import Form, register, REGISTRY, KIND, Character, Fireball, Lightning, ChainMail

__all__ = [
    "World", "Field", "DragField", "GravityField", "ThermalField",
    "RepulsionField", "ElasticBondField", "HomeostasisField", "standard_fields",
    "Form", "register", "REGISTRY", "KIND",
    "Character", "Fireball", "Lightning", "ChainMail",
]

from .interactions import BondBreakField, combat_fields  # noqa
