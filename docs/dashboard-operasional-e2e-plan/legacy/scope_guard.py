#!/usr/bin/env python3
"""Closed-manifest guard for the dashboard operasional E2E plan."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def repo_root() -> Path:
    out = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True)
    return Path(out.strip()).resolve()


def visible_files(root: Path) -> list[str]:
    raw = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=root,
    )
    return sorted(item.decode() for item in raw.split(b"\0") if item)


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def snapshot(root: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for relative in visible_files(root):
        path = root / relative
        if path.is_file() or path.is_symlink():
            result[relative] = digest(path)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    take = sub.add_parser("snapshot")
    take.add_argument("--output", required=True, type=Path)
    check = sub.add_parser("check")
    check.add_argument("--snapshot", required=True, type=Path)
    check.add_argument("--manifest", required=True, type=Path)
    check.add_argument("--phase", required=True)
    args = parser.parse_args()

    root = repo_root()
    if args.command == "snapshot":
        args.output.write_text(json.dumps(snapshot(root), indent=2, sort_keys=True) + "\n")
        print(f"snapshot: {args.output}")
        return 0

    before = json.loads(args.snapshot.read_text())
    after = snapshot(root)
    changed = sorted(
        path for path in set(before) | set(after) if before.get(path) != after.get(path)
    )
    manifest = json.loads(args.manifest.read_text())
    allowed = {
        entry["path"] for entry in manifest["phases"][str(args.phase)]["files"]
    }
    outside = sorted(set(changed) - allowed)
    print(json.dumps({"phase": str(args.phase), "changed": changed, "outside": outside}, indent=2))
    return 1 if outside else 0


if __name__ == "__main__":
    raise SystemExit(main())
