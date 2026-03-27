import type { RequestHandler } from "@builder.io/qwik-city";
import { validateApiKey } from "~/services/api-auth";

/**
 * Auth middleware for all /api/v1/* routes.
 * Validates the API key from the Authorization: Bearer header.
 */
export const onRequest: RequestHandler = async (requestEvent) => {
  const authHeader = requestEvent.request.headers.get("Authorization");
  const result = validateApiKey(requestEvent.env, authHeader);

  if (!result.valid) {
    requestEvent.json(401, { error: "Unauthorized", message: result.error });
    return;
  }

  await requestEvent.next();
};
