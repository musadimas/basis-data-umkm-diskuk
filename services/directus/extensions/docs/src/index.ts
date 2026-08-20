import { defineEndpoint } from "@directus/extensions-sdk";
import { Request, Response, NextFunction } from "express";
import { getConfig, getOas, getPackage, merge, filterPaths, EXCLUDED_TAG_RE } from "./utils";
import { createReadStream, existsSync } from "fs";
import { join, extname } from "path";
// Shared CommonJS helper keeps the anonymous boundary identical to custom endpoints.
// @ts-ignore no declaration file is needed for the bundled runtime helper.
const { routeGuard } = require("../../shared/auth.cjs");

const config = getConfig();

const id = config.docsPath;

export default {
  id,
  handler: defineEndpoint((router, { services, logger, getSchema }) => {
    // Assets dir is one level up from dist/ where this bundle runs
    const assetsDir = join(__dirname, "..", "src", "assets");
    const MIME = { ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp" } satisfies Record<string, string>;

    router.get("/assets/:file", (req: Request, res: Response, next: NextFunction) => {
      if (!routeGuard(req, next)) return;
      const file = req.params.file;
      const filePath = join(assetsDir, file);
      if (!filePath.startsWith(assetsDir) || !existsSync(filePath)) {
        res.status(404).send("Not found");
        return;
      }
      // SAFETY: extname() may return an extension not listed in MIME; the lookup then yields undefined and the fallback below applies.
      res.setHeader("Content-Type", MIME[extname(file) as keyof typeof MIME] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "private, no-store");
      createReadStream(filePath).pipe(res);
    });

    const scalarConfig = {
      theme: "kepler",
      layout: "modern",
      defaultHttpClient: { targetKey: "javascript", clientKey: "fetch" },
      agent: { disabled: true },
      logo: `/${id}/assets/logo-inline-light.png`,
      navigation: {
        sidebar: [
          {
            title: "Admin Panel",
            url: "/admin",
            icon: "phosphor/regular/layout",
          },
          {
            title: "Cartogram",
            url: "/",
            icon: "phosphor/regular/map-trifold",
          },
        ],
      },
    };

    function scalarPage(specUrl: string, title: string): string {
      return `<!doctype html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/png" href="/${id}/assets/logo.png" />
</head>
<body>
  <script
    id="api-reference"
    data-url="${specUrl}"
    data-configuration='${JSON.stringify(scalarConfig)}'
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
    }

    router.get("/", (req: Request, res: Response, next: NextFunction) => {
      if (!routeGuard(req, next)) return;
      res.setHeader("Content-Type", "text/html");
      res.send(scalarPage(`/${id}/oas`, config.info.title || "Cartogram — CMS API"));
    });

    router.get("/oas", async (req: Request, res: Response, next: NextFunction) => {
      if (!routeGuard(req, next)) return;
      try {
        const schema = await getSchema();

        // SAFETY: Directus injects `accountability` onto requests at runtime; Express' Request type does not declare it.
        const accountability = (req as any).accountability;

        const scalar = await getOas(services, schema, accountability);

        const pkg = await getPackage();

        scalar.info.title = config.info.title || pkg?.name || scalar.info.title;
        scalar.info.version = config.info.version || pkg?.version || scalar.info.version;
        scalar.info.description = config.info.description || pkg?.description || scalar.info.description;

        // inject custom-endpoints
        if (accountability.admin || accountability.user) {
          try {
            for (const path in config.paths) {
              scalar.paths[path] = config.paths[path];
            }

            for (const tag of config.tags) {
              scalar.tags.push(tag);
            }

            scalar.components = merge(config.components, scalar.components);
          } catch {
            logger.info("No custom definitions");
          }

          if (config.publishedTags?.length) filterPaths(config, scalar);
        }

        // Inject session cookie security scheme
        const sessionCookieName = process.env.SESSION_COOKIE_NAME || "directus_session_token";
        if (!scalar.components) scalar.components = {};
        if (!scalar.components.securitySchemes) scalar.components.securitySchemes = {};
        scalar.components.securitySchemes["Session"] = {
          type: "apiKey",
          in: "cookie",
          name: sessionCookieName,
        };

        // Exclude paths whose methods only carry auto-generated Items tags
        for (const path in scalar.paths) {
          for (const method in scalar.paths[path]) {
            const tags: string[] = scalar.paths[path][method].tags || [];
            if (tags.length > 0 && tags.every((tag) => EXCLUDED_TAG_RE.test(tag))) {
              delete scalar.paths[path][method];
            }
          }
          if (Object.keys(scalar.paths[path]).length === 0) {
            delete scalar.paths[path];
          }
        }
        // Also strip Items tags from the top-level tags list
        scalar.tags = scalar.tags?.filter((tag: any) => !EXCLUDED_TAG_RE.test(tag.name)) ?? [];

        scalar.info["x-logo"] = { url: `/${id}/assets/logo-inline-light.png`, altText: config.info.title ?? "API" };

        res.json(scalar);
      } catch (error: any) {
        return next(new Error(error.message || error[0].message));
      }
    });
  }),
};
