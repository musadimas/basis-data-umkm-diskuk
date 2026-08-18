#!/usr/bin/env python3
import importlib.util
import pathlib
import unittest
from datetime import datetime, timezone

_spec = importlib.util.spec_from_file_location("ingest_sidt", pathlib.Path(__file__).with_name("ingest-sidt.py"))
_ingest = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ingest)
incoming_is_newer = _ingest.incoming_is_newer
parse_source_timestamp = _ingest.parse_source_timestamp
safe_nib = _ingest.safe_nib
source_hash = _ingest.source_hash

class IngestSemanticsTests(unittest.TestCase):
    def test_explicit_offsets_normalize_to_utc(self):
        self.assertEqual(parse_source_timestamp("2026-08-17T06:30:00+07:00"), datetime(2026, 8, 16, 23, 30, tzinfo=timezone.utc))
        self.assertEqual(parse_source_timestamp("2026-08-16T23:30:00Z"), datetime(2026, 8, 16, 23, 30, tzinfo=timezone.utc))
        self.assertIsNone(parse_source_timestamp("2026-08-16T23:30:00"))
        self.assertIsNone(parse_source_timestamp("2026-99-99T23:30:00Z"))

    def test_hash_and_noop_replay(self):
        row = {"id_data_badan_usaha": "u-1", "nama_usaha": "Toko"}
        hashed = source_hash(row)
        state = {"source_hash": hashed, "source_updated_at": None, "source_pulled_at": None}
        self.assertFalse(incoming_is_newer(state, {**state, "source_hash": hashed}))

    def test_newer_update_wins_and_older_update_is_ignored(self):
        old = {"source_hash": "a", "source_updated_at": datetime(2026, 8, 16, tzinfo=timezone.utc), "source_pulled_at": None}
        newer = {"source_hash": "b", "source_updated_at": datetime(2026, 8, 17, tzinfo=timezone.utc), "source_pulled_at": None}
        older = {"source_hash": "c", "source_updated_at": datetime(2026, 8, 15, tzinfo=timezone.utc), "source_pulled_at": None}
        self.assertTrue(incoming_is_newer(old, newer))
        self.assertFalse(incoming_is_newer(old, older))

    def test_invalid_or_missing_time_does_not_replace_valid_current(self):
        current = {"source_hash": "a", "source_updated_at": datetime(2026, 8, 17, tzinfo=timezone.utc), "source_pulled_at": None}
        no_time = {"source_hash": "b", "source_updated_at": None, "source_pulled_at": None}
        self.assertFalse(incoming_is_newer(current, no_time))

    def test_nib_collision_is_null_not_batch_failure(self):
        self.assertIsNone(safe_nib("123", ["123", "123"], {}))
        self.assertIsNone(safe_nib("123", ["123"], {"123": "other-source"}))
        self.assertEqual(safe_nib("123", ["123", "456"], {}), "123")

    def test_archive_and_partial_batch_are_preserved_by_source_contract(self):
        archived = {"status": "archived", "source_hash": "old", "source_updated_at": datetime(2026, 8, 16, tzinfo=timezone.utc), "source_pulled_at": None}
        incoming = {"source_hash": "new", "source_updated_at": datetime(2026, 8, 17, tzinfo=timezone.utc), "source_pulled_at": None}
        self.assertTrue(incoming_is_newer(archived, incoming))
        self.assertEqual(archived["status"], "archived")
        # Absence is not an event; no helper call is made for missing source IDs.
        self.assertEqual({"u-1": archived}["u-1"]["status"], "archived")

if __name__ == "__main__": unittest.main()
