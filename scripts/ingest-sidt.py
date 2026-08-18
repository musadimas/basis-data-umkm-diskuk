#!/usr/bin/env python3
"""Stream a SIDT CSV to PostgreSQL batches over an SSH target."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import itertools
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator, Mapping


ROOT = Path(__file__).resolve().parent
PREPARE_SQL = ROOT / 'ingest-sidt-prepare.sql'
BATCH_START_SQL = ROOT / 'ingest-sidt-batch-start.sql'
BATCH_END_SQL = ROOT / 'ingest-sidt-batch-end.sql'
REFRESH_DASHBOARD_SQL = ROOT / 'refresh-dashboard-snapshots.sql'
ENQUEUE_REBUILD_SQL = ROOT / 'enqueue-analytics-rebuild.sql'
EXPECTED_COLUMNS = [
    'id_data_badan_usaha', 'nik_pengusaha', 'nama_pengusaha', 'nib', 'jenis_kelamin',
    'is_disabilitas', 'tanggal_lahir', 'pendidikan_formal', 'kontak_hp', 'prov_pengusaha',
    'kab_pengusaha', 'kec_pengusaha', 'kel_pengusaha', 'alamat_pengusaha', 'rt_pengusaha',
    'rw_pengusaha', 'nama_usaha', 'kegiatan_utama', 'produk_utama', 'kategori_kbli', 'kode_kbli',
    'status_badan_usaha', 'skala_usaha', 'modal_pendirian', 'bulan_mulai_operasi',
    'tahun_mulai_operasi', 'omzet_tahunan', 'asset', 'prov_usaha', 'kab_usaha', 'kec_usaha',
    'kel_usaha', 'alamat_usaha', 'rt_usaha', 'rw_usaha', 'foto_usaha', 'alamat_latitude',
    'alamat_longitude', 'tk_dibayar_laki', 'tk_dibayar_perempuan', 'tk_dibayar_disabil_laki',
    'tk_dibayar_disabil_perempuan', 'tk_not_dibayar_laki', 'tk_not_dibayar_perempuan',
    'tk_not_dibayar_disabil_laki', 'tk_not_dibayar_disabil_perempua', 'pulled_at', 'updated_at',
    'source_page',
]
REMOTE_PSQL = '''set -eu
db=$(docker exec diskuk-directus-1 printenv DB_DATABASE)
db_user=$(docker exec diskuk-directus-1 printenv DB_USER)
exec docker exec -i diskuk-postgis-1 psql -X -v ON_ERROR_STOP=1 -U "$db_user" -d "$db"
'''
REMOTE_CHECK = '''set -eu
test "$(docker inspect -f '{{.State.Running}}' diskuk-postgis-1)" = true
test "$(docker inspect -f '{{.State.Running}}' diskuk-directus-1)" = true
available_kb=$(df -Pk / | awk 'NR == 2 { print $4 }')
test "$available_kb" -ge 5242880
'''



_SOURCE_TIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$")


def parse_source_timestamp(value: str | None) -> datetime | None:
    """Return UTC for an explicit RFC3339 timestamp; never use local time."""
    if not value or not _SOURCE_TIME_RE.match(value.strip()):
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def source_hash(row: Mapping[str, str]) -> str:
    canonical = "|".join(f"{key}={row.get(key, '')}" for key in EXPECTED_COLUMNS)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def incoming_is_newer(existing: Mapping[str, object] | None, incoming: Mapping[str, object]) -> bool:
    """Apply source precedence without allowing invalid/NULL time to regress state."""
    if not existing:
        return True
    if existing.get("source_hash") == incoming.get("source_hash"):
        return False
    incoming_updated = incoming.get("source_updated_at")
    incoming_pulled = incoming.get("source_pulled_at")
    existing_updated = existing.get("source_updated_at")
    existing_pulled = existing.get("source_pulled_at")
    if incoming_updated is not None:
        return existing_updated is None or incoming_updated >= existing_updated
    if incoming_pulled is not None:
        return existing_updated is None and (existing_pulled is None or incoming_pulled >= existing_pulled)
    return existing_updated is None and existing_pulled is None


def safe_nib(candidate: str | None, batch_candidates: Iterable[str | None], existing_owners: Mapping[str, str]) -> str | None:
    if not candidate or sum(1 for value in batch_candidates if value == candidate) != 1:
        return None
    return candidate if candidate not in existing_owners else None

def batches(rows: Iterable[list[str]], size: int) -> Iterator[Iterable[list[str]]]:
    iterator = iter(rows)
    while True:
        first = next(iterator, None)
        if first is None:
            return
        yield itertools.chain((first,), itertools.islice(iterator, size - 1))


def ssh(target: str, remote_command: str, **kwargs: object) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(['ssh', '-o', 'BatchMode=yes', target, remote_command], check=True, **kwargs)


def import_batch(target: str, header: list[str], rows: Iterable[list[str]], dry_run: bool) -> int:
    process = subprocess.Popen(
        ['ssh', '-o', 'BatchMode=yes', target, REMOTE_PSQL],
        stdin=subprocess.PIPE,
    )
    assert process.stdin is not None
    stream = io.TextIOWrapper(process.stdin, encoding='utf-8', newline='')
    batch_start = BATCH_START_SQL.read_text().replace(
        "COPY sidt_raw FROM STDIN WITH (FORMAT csv, HEADER true);",
        "SET LOCAL diskuk.analytics_bulk_ingest = 'on';\n\nCOPY sidt_raw FROM STDIN WITH (FORMAT csv, HEADER true);",
    )
    stream.write(batch_start)
    # DB triggers coalesce the batch into one rebuild job and do not emit one job per row.
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(header)
    count = 0
    for row in rows:
        if len(row) != len(header):
            raise ValueError(f'CSV row has {len(row)} columns; expected {len(header)}')
        writer.writerow(row)
        count += 1
    stream.write('\\.\n')
    end_sql = BATCH_END_SQL.read_text()
    if dry_run:
        end_sql = end_sql.replace('COMMIT;', 'ROLLBACK;', 1).replace('SIDT_BATCH_COMMITTED', 'SIDT_BATCH_ROLLED_BACK')
    stream.write(end_sql)
    stream.close()
    if process.wait() != 0:
        raise RuntimeError(f'remote PostgreSQL rejected the batch after {count} CSV records')
    return count


def self_check() -> None:
    assert [list(batch) for batch in batches([['a'], ['b'], ['c']], 2)] == [[['a'], ['b']], [['c']]]
    assert len(EXPECTED_COLUMNS) == 49
    assert 'COMMIT;' in BATCH_END_SQL.read_text()
    assert ENQUEUE_REBUILD_SQL.exists()
    batch_sql = BATCH_END_SQL.read_text()
    assert 'CREATE TEMP TABLE sidt_stage' in batch_sql
    assert 'source_pulled_at' in batch_sql and 'source_updated_at' in batch_sql
    assert 'ON CONFLICT (sumber_id) DO UPDATE' in batch_sql
    assert 'NOT EXISTS (' not in batch_sql.split('CREATE TEMP TABLE sidt_stage', 1)[1].split('ANALYZE', 1)[0]
    refresh_sql = REFRESH_DASHBOARD_SQL.read_text()
    assert 'TRUNCATE usaha_tabular' in refresh_sql
    assert 'FROM usaha_tabular' in refresh_sql
    assert 'INSERT INTO infografis_snapshot' in refresh_sql
    assert 'ROLLBACK' not in refresh_sql
    assert refresh_sql.count('BEGIN;') == refresh_sql.count('COMMIT;') == 1
    assert "RAISE EXCEPTION 'dashboard snapshot" in refresh_sql
    assert parse_source_timestamp('2026-08-16T23:30:00Z') is not None
    assert parse_source_timestamp('2026-08-16T23:30:00') is None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_path', type=Path, nargs='?')
    parser.add_argument('--ssh-target', default='fuad')
    parser.add_argument('--batch-size', type=int, default=250_000)
    parser.add_argument('--from-batch', type=int, default=1)
    parser.add_argument('--max-batches', type=int)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--legacy-refresh', action='store_true', help='explicit compatibility-only snapshot refresh')
    parser.add_argument('--self-check', action='store_true')
    args = parser.parse_args()

    if args.self_check:
        self_check()
        print('self-check passed')
        return 0
    if args.csv_path is None:
        parser.error('csv_path is required unless --self-check is used')
    if args.batch_size < 1 or args.from_batch < 1 or (args.max_batches is not None and args.max_batches < 1):
        parser.error('--batch-size, --from-batch, and --max-batches must be positive')
    if not args.csv_path.is_file():
        parser.error(f'CSV not found: {args.csv_path}')

    ssh(args.ssh_target, REMOTE_CHECK)
    with PREPARE_SQL.open('rb') as prepare:
        ssh(args.ssh_target, REMOTE_PSQL, stdin=prepare)

    completed_rows = 0
    with args.csv_path.open('r', newline='', encoding='utf-8-sig', errors='strict') as source:
        reader = csv.reader(source)
        header = next(reader, None)
        if header != EXPECTED_COLUMNS:
            raise ValueError('CSV header does not match the SIDT 2026-04-15 schema')
        for batch_number, rows in enumerate(batches(reader, args.batch_size), start=1):
            if args.max_batches is not None and batch_number >= args.from_batch + args.max_batches:
                break
            if batch_number < args.from_batch:
                continue
            print(f'SIDT batch {batch_number} started', flush=True)
            ssh(args.ssh_target, REMOTE_CHECK)
            completed_rows += import_batch(args.ssh_target, header, rows, args.dry_run)
            print(f'SIDT batch {batch_number} completed ({completed_rows} rows this run)', flush=True)
    if not args.dry_run:
        if args.legacy_refresh:
            print('Running explicit legacy dashboard refresh', flush=True)
            with REFRESH_DASHBOARD_SQL.open('rb') as refresh:
                ssh(args.ssh_target, REMOTE_PSQL, stdin=refresh)
        else:
            print('Enqueuing analytics current-model rebuild', flush=True)
            with ENQUEUE_REBUILD_SQL.open('rb') as enqueue:
                ssh(args.ssh_target, REMOTE_PSQL, stdin=enqueue)
    print(f'SIDT import complete: {completed_rows} rows')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f'SIDT import failed: {error}', file=sys.stderr)
        raise SystemExit(1)
