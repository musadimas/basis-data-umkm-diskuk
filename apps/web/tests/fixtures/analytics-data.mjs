// Analytics dashboard fixtures shared by the browser mock (mock-directus.mjs) and the SSR mock
// server (mock-directus-server.mjs), so a server-rendered dashboard and its client refetch agree.

/** 27 square kota polygons in a 9×3 grid; `withValue` adds the infographic count per region. */
function wilayahPolygons({ withValue }) {
  return Array.from({ length: 27 }, (_, index) => {
    const longitude = 106 + (index % 9) * 0.25;
    const latitude = -7.5 + Math.floor(index / 9) * 0.25;
    const region = {
      id: String(index + 1),
      name: `Wilayah ${index + 1}`,
      code: `32.${String(index + 1).padStart(2, "0")}`,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [longitude, latitude],
            [longitude + 0.2, latitude],
            [longitude + 0.2, latitude + 0.2],
            [longitude, latitude + 0.2],
            [longitude, latitude],
          ],
        ],
      },
    };
    if (withValue) region.value = index + 1;
    return region;
  });
}

/** `GET /v1/analytics/tabular/options`. */
export function tabularOptionsResponse() {
  return {
    data: {
      kota: [{ id: 1, nama: "Kabupaten Bogor" }],
      kecamatan: [{ id: 11, nama: "Cibinong", kotaId: 1 }],
      kategori: ["PERDAGANGAN"],
      kbli: [{ kode: "47112", kategori: "PERDAGANGAN" }],
    },
  };
}

/** `GET /v1/analytics/infographic/`; `filtered` mirrors a request carrying `?skala=`. */
export function infographicResponse({ filtered = false, renderMap = false } = {}) {
  return {
    data: {
      scales: filtered
        ? { total: 2, mikro: 2, kecil: 0, menengah: 0 }
        : { total: 3, mikro: 2, kecil: 1, menengah: 0 },
      regions: renderMap
        ? wilayahPolygons({ withValue: true })
        : [
            { id: "1", name: "Kabupaten Bogor", value: 2 },
            { id: "2", name: "Kota Depok", value: 1 },
          ],
      geometryReady: renderMap,
      sectors: filtered
        ? []
        : [
            {
              code: "G",
              name: "Perdagangan Besar dan Eceran",
              total: 1,
              mikro: 1,
              kecil: 0,
              menengah: 0,
              percentage: 33.3,
            },
            {
              code: "C",
              name: "Industri Pengolahan",
              total: 2,
              mikro: 1,
              kecil: 1,
              menengah: 0,
              percentage: 66.7,
            },
          ],
      topKbli: filtered
        ? []
        : [
            {
              code: "47112",
              name: "Perdagangan eceran",
              description: null,
              total: 2,
              mikro: 2,
              kecil: 0,
              menengah: 0,
            },
            {
              code: "10794",
              name: "Industri makanan",
              description: null,
              total: 1,
              mikro: 0,
              kecil: 1,
              menengah: 0,
            },
          ],
      kbli: [],
      sectorCoverage: filtered
        ? undefined
        : { mapped: 3, unclassified: 0 },
      nib: filtered
        ? undefined
        : {
            total: 3,
            withNib: 2,
            withoutNib: 1,
            withPercentage: 66.7,
            withoutPercentage: 33.3,
          },
      marketingMethods: filtered
        ? undefined
        : [
            {
              key: "non-digital",
              label: "Non-digital",
              value: 2,
              percentage: 66.7,
            },
            {
              key: "digital",
              label: "Digital",
              value: 1,
              percentage: 33.3,
            },
          ],
      workforce: {
        male: 2,
        female: 1,
        total: 3,
        malePercentage: 66.7,
        femalePercentage: 33.3,
      },
      dataAsOf: "2026-08-17T00:30:00Z",
    },
  };
}

/** `GET /v1/analytics/infographic/map`. */
export function infographicMapResponse() {
  return {
    data: {
      regions: wilayahPolygons({ withValue: false }),
      regionLevel: "kota",
      geometryReady: true,
      geometryMissing: 0,
    },
  };
}
