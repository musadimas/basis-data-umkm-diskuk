#!/usr/bin/env python3
"""Validate Brief Fitur priority coverage against the executable phase index."""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path


PLAN = Path(__file__).resolve().parent
ROOT = PLAN.parents[1]
REQUIREMENTS = ROOT / "requirements.md"
MAPPING = PLAN / "priority_coverage.json"
MANIFEST = PLAN / "scope_manifest.json"
PHASE_FILES = {
    "Y01": "stage_1/phase_Y01_identity.md",
    "Y02": "stage_1/phase_Y02_talent.md",
    "Y03": "stage_1/phase_Y03_kpi.md",
    "Y04": "stage_1/phase_Y04_product_passport.md",
    "Y05": "stage_1/phase_Y05_exports_map.md",
    "Y06": "stage_1/phase_Y06_public_catalog.md",
    "Y07": "stage_1/phase_Y07_events.md",
    "Y08": "stage_1/phase_Y08_clinic_backend.md",
    "Y09": "stage_1/phase_Y09_clinic_ui.md",
    "Y10": "stage_1/phase_Y10_acceptance.md",
    "R01": "stage_2/phase_R01_demo_regulation.md",
    "R02": "stage_2/phase_R02_executive_investor.md",
    "R03": "stage_2/phase_R03_events_aid.md",
    "R04": "stage_2/phase_R04_clinic_extensions.md",
    "R05": "stage_2/phase_R05_acceptance.md",
}
ID_PATTERN = re.compile(r"(?m)^- \*\*((?:M|N)\d+-\d+)\s+—")


def main() -> int:
    errors: list[str] = []
    source_ids = ID_PATTERN.findall(REQUIREMENTS.read_text())
    source_counts = Counter(source_ids)
    for item, count in source_counts.items():
        if count != 1:
            errors.append(f"requirements.md repeats {item} {count} times")
    raw = json.loads(MAPPING.read_text())
    entries = raw["entries"]
    mapped_ids = [entry["id"] for entry in entries]
    mapped_counts = Counter(mapped_ids)
    for item, count in mapped_counts.items():
        if count != 1:
            errors.append(f"priority_coverage.json repeats {item} {count} times")
    for item in sorted(set(source_ids) - set(mapped_ids)):
        errors.append(f"unmapped requirement: {item}")
    for item in sorted(set(mapped_ids) - set(source_ids)):
        errors.append(f"unknown mapped requirement: {item}")
    for entry in entries:
        item, stage, phase = entry["id"], entry["stage"], entry["phase"]
        expected_stage = "must_have" if item.startswith("M") else "next_dev"
        expected_prefix = "Y" if item.startswith("M") else "R"
        if stage != expected_stage or not phase.startswith(expected_prefix):
            errors.append(f"{item}: wrong priority or phase: {stage}/{phase}")
        if phase not in PHASE_FILES or phase in {"Y10", "R05"}:
            errors.append(f"{item}: invalid owner phase {phase}")
        else:
            body = (PLAN / PHASE_FILES[phase]).read_text()
            if not re.search(rf"(?m)^\| {re.escape(item)} \|", body):
                errors.append(f"{item}: missing individual acceptance row in {phase}")
    if len(source_ids) != 49 or sum(i.startswith("M") for i in source_ids) != 35:
        errors.append(
            f"unexpected Brief Fitur count: {len(source_ids)} total, "
            f"{sum(i.startswith('M') for i in source_ids)} must-have"
        )
    for phase, relative in PHASE_FILES.items():
        if not (PLAN / relative).is_file():
            errors.append(f"missing phase file: {relative}")
    manifest = json.loads(MANIFEST.read_text())
    for phase in PHASE_FILES:
        if phase not in manifest["phases"]:
            errors.append(f"missing scope manifest phase: {phase}")
    if "pencarian Tabular" not in (PLAN / PHASE_FILES["Y05"]).read_text():
        errors.append("green Tabular repair absent from Y05")
    if "basemap satelit" not in (PLAN / PHASE_FILES["Y05"]).read_text():
        errors.append("green satellite repair absent from Y05")
    for error in errors:
        print("ERROR:", error, file=sys.stderr)
    if errors:
        return 1
    print("OK: 35 must-have IDs in Y phases; 14 next-dev IDs in R phases; "
          "15 phase files and manifests present; two green repairs in Y05.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
