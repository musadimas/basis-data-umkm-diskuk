\set ON_ERROR_STOP on

DO $$
DECLARE
  snapshot_total integer;
  tabular_total  integer;
BEGIN
  SELECT (payload -> 'scales' ->> 'total')::integer
  INTO snapshot_total
  FROM infografis_snapshot
  WHERE id = 1;

  SELECT COUNT(*)::integer
  INTO tabular_total
  FROM usaha_tabular;

  IF snapshot_total IS NULL THEN
    RAISE EXCEPTION 'infographic snapshot has not been refreshed';
  END IF;

  IF tabular_total <> snapshot_total THEN
    RAISE EXCEPTION 'usaha_tabular total (%) does not match infographic total (%)', tabular_total, snapshot_total;
  END IF;
END $$;
