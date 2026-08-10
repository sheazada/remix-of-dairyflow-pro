import { createServerFn } from "@tanstack/react-start";
import { getVapidPublicKey } from "./vapid.server";

/**
 * Expose the VAPID public key to the browser (safe to expose).
 */
export const fetchVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: getVapidPublicKey() };
});
