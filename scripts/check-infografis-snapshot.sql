\set ON_ERROR_STOP on

DO $$
DECLARE
  expected_total integer;
  sector_total integer;
  unclassified_total integer;
  sector_count integer;
BEGIN
  SELECT
    (payload -> 'scales' ->> 'total')::integer,
    COALESCE((
      SELECT SUM((item ->> 'total')::integer)
      FROM jsonb_array_elements(COALESCE(payload -> 'sectors', '[]'::jsonb)) AS item
    ), 0)::integer,
    COALESCE((payload -> 'sectorCoverage' ->> 'unclassified')::integer, 0),
    jsonb_array_length(COALESCE(payload -> 'sectors', '[]'::jsonb))
  INTO expected_total, sector_total, unclassified_total, sector_count
  FROM infografis_snapshot
  WHERE id = 1;

  IF expected_total IS NULL OR sector_count <> 21 OR sector_total + unclassified_total <> expected_total THEN
    RAISE EXCEPTION 'sector total (%) plus unclassified (%) does not match infographic total (%)', sector_total, unclassified_total, expected_total;
  END IF;
END $$;
