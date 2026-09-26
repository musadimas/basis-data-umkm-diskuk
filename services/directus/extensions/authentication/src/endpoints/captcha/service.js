import { issueChallenge } from "../../lib/utils/captcha.js";
import { noStore, sendError } from "../../lib/utils/http.js";

/** Issues a signed ALTCHA challenge for the login and forgot-password widgets. */
export const challenge =
  ({ env, logger }) =>
  async (_req, res) => {
    try {
      noStore(res);
      res.json(await issueChallenge(env));
    } catch (error) {
      sendError(res, logger, error);
    }
  };
