const rows = (result) => result.rows ?? result[0] ?? [];

module.exports = {
  id: "infografis",
  handler: (router, { database, logger }) => {
    router.get("/", async (_req, res, next) => {
      try {
        const result = await database.raw(
          "SELECT payload FROM infografis_snapshot WHERE id = 1"
        );
        const payload = rows(result)[0]?.payload;

        if (!payload) throw new Error("Infographic snapshot has not been refreshed");
        res.json({ data: payload });
      } catch (error) {
        logger.error(error, "Unable to read infographic snapshot");
        next(error);
      }
    });
  },
};
