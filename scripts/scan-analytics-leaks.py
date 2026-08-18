#!/usr/bin/env python3
"""Fail closed on canary PII, credentials, signed URLs, or PEM material in evidence."""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

PATTERNS = {
    "canary_nik": re.compile(r"3273010101011234|1234567890123456"),
    "canary_phone": re.compile(r"(?:\+62|62|0)81234567890"),
    "credential": re.compile(r"(?i)(?:password|secret|access[_-]?key)\s*[:=]\s*(?:\"(?!\$|change-me|replace-with)[^\"]{8,}\"|'(?!\$|change-me|replace-with)[^']{8,}'|[A-Za-z0-9+/=_-]{16,})"),
    "signed_url": re.compile(r"(?i)(?:signed[_-]?url|X-Amz-Signature|[?&]sig=)"),
    "pem": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}
SKIP_PARTS = {".git", "node_modules", ".nuxt", ".output", "playwright-report", "__pycache__", "storage", "data"}
SKIP_NAMES = {".env", ".env.example"}
SKIP_SUFFIXES = {".key", ".crt", ".pem"}  # never inspect local runtime key material

def files_under(root: Path):
    if not root.exists():
        return
    for path in root.rglob("*"):
        if not path.is_file() or any(part in SKIP_PARTS for part in path.parts):
            continue
        if path.name in SKIP_NAMES or path.suffix.lower() in SKIP_SUFFIXES or "services/caddy" in path.as_posix():
            continue
        if path.stat().st_size <= 5_000_000:
            yield path

def scan(root: Path, patterns=PATTERNS, *, skip_test_canaries=False):
    hits = []
    for path in files_under(root):
        if skip_test_canaries and ("/test/" in path.as_posix() or "/tests/" in path.as_posix() or path.name.endswith(".spec.ts")):
            continue
        try:
            text = path.read_text(errors="ignore")
        except OSError:
            continue
        for name, pattern in patterns.items():
            if pattern.search(text):
                hits.append({"file": str(path), "kind": name})
    return hits

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture-root", default="apps/web/test-results")
    parser.add_argument("--source-root", default=".", help="Optional source scan; only credential/PEM patterns are applied.")
    args = parser.parse_args()
    hits = scan(Path(args.fixture_root))
    if args.source_root:
        source_patterns = {key: PATTERNS[key] for key in ("credential", "pem")}
        hits.extend(scan(Path(args.source_root), source_patterns, skip_test_canaries=True))
    summary = {"scanned": args.fixture_root, "sourceScanned": args.source_root, "hits": hits, "count": len(hits)}
    print(json.dumps(summary))
    return 1 if hits else 0

if __name__ == "__main__":
    raise SystemExit(main())
