export const up = async (knex) => {
  await knex.raw(`
    UPDATE infografis_snapshot AS snapshot
    SET payload = jsonb_set(
      snapshot.payload,
      '{options}',
      jsonb_build_object(
        'kota', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', id, 'nama', nama) ORDER BY nama, id)
          FROM (
            SELECT DISTINCT (item ->> 'id')::integer AS id, item ->> 'name' AS nama
            FROM jsonb_array_elements(COALESCE(snapshot.payload -> 'regions', '[]'::jsonb)) AS item
            WHERE item ->> 'id' ~ '^[0-9]+$'
          ) AS options
        ), '[]'::jsonb),
        'kecamatan', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('id', id, 'nama', nama, 'kotaId', kota_id)
            ORDER BY nama, id
          )
          FROM (
            SELECT DISTINCT kecamatan_id AS id, kecamatan_nama AS nama, kota_id
            FROM usaha_tabular
            WHERE kecamatan_id IS NOT NULL AND kota_id IS NOT NULL
          ) AS options
        ), '[]'::jsonb),
        'kategori', COALESCE((
          SELECT jsonb_agg(nama ORDER BY nama)
          FROM (
            SELECT DISTINCT item ->> 'name' AS nama
            FROM jsonb_array_elements(COALESCE(snapshot.payload -> 'kbli', '[]'::jsonb)) AS item
            WHERE NULLIF(item ->> 'name', '') IS NOT NULL
          ) AS options
        ), '[]'::jsonb),
        'kbli', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('kode', kode, 'kategori', kategori)
            ORDER BY kode, kategori
          )
          FROM (
            SELECT DISTINCT item ->> 'code' AS kode, item ->> 'name' AS kategori
            FROM jsonb_array_elements(COALESCE(snapshot.payload -> 'kbli', '[]'::jsonb)) AS item
            WHERE NULLIF(item ->> 'code', '') IS NOT NULL
          ) AS options
        ), '[]'::jsonb)
      ),
      true
    )
    WHERE snapshot.id = 1
      AND jsonb_extract_path(snapshot.payload, 'options') IS NULL;
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    UPDATE infografis_snapshot
    SET payload = payload - 'options'
    WHERE id = 1;
  `);
};
