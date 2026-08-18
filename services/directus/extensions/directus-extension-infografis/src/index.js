const { routeGuard } = require("../../shared/auth.cjs");

const rows = (result) => result?.rows ?? result?.[0] ?? [];

module.exports = {
  id: "infografis",
  handler: (router, { database, logger }) => {
    router.get("/", async (req, res, next) => {
      if (!routeGuard(req, next)) return;
      try {
        const result = await database.raw("SELECT payload FROM infografis_snapshot WHERE id = 1");
        const payload = rows(result)[0]?.payload;
        if (!payload) throw new Error("Infographic snapshot has not been refreshed");
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ data: payload });
      } catch (error) {
        logger.error(error, "Unable to read infographic snapshot");
        next(error);
      }
    });
  },
};
