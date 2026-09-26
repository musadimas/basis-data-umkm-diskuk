import { ACTIVITY_PAGE_DEFAULT, ACTIVITY_PAGE_MAX } from "../../lib/constants.js";
import { rows } from "../../lib/utils/common.js";
import { noStore, sendError } from "../../lib/utils/http.js";

/** The user's login audit (auth_login_audit) merged with their data changes (directus_activity). */
export const list =
  ({ database, logger }) =>
  async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || ACTIVITY_PAGE_DEFAULT, 1), ACTIVITY_PAGE_MAX);
      const page = Math.max(Number.parseInt(req.query?.page, 10) || 1, 1);
      const user = req.accountability.user;
      const result = await database.raw(
        `SELECT kind, action, collection, item, ip, user_agent, reason, "timestamp"
           FROM (
             SELECT 'session' AS kind,
                    CASE WHEN status = 'success' THEN 'login' ELSE 'login_failed' END AS action,
                    NULL::varchar AS collection, NULL::varchar AS item,
                    ip, user_agent, reason, created_at AS "timestamp"
               FROM auth_login_audit WHERE user_id = ?
             UNION ALL
             SELECT 'data' AS kind, action, collection, item, ip, user_agent, NULL AS reason, "timestamp"
               FROM directus_activity WHERE "user" = ? AND action <> 'login'
           ) activity
          ORDER BY "timestamp" DESC
          LIMIT ? OFFSET ?`,
        [user, user, limit + 1, (page - 1) * limit],
      );
      const items = rows(result);
      noStore(res);
      res.json({ data: items.slice(0, limit), meta: { page, limit, hasMore: items.length > limit } });
    } catch (error) {
      sendError(res, logger, error);
    }
  };
