#!/usr/bin/env python3
"""CYCLE.yaml -> CYCLE.json 변환. 계약 원본은 YAML — JSON 은 런타임 등록용 파생물이다.
사용: python3 scripts/build-cycle-json.py cycles/C01-border-canyon"""
import json, sys, pathlib
import yaml

cycle_dir = pathlib.Path(sys.argv[1])
spec = yaml.safe_load((cycle_dir / "CYCLE.yaml").read_text(encoding="utf-8"))
out = cycle_dir / "CYCLE.json"
out.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"wrote {out}")
