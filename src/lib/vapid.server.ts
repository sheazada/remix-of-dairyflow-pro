/**
 * VAPID configuration for web push, sourced from backend secrets.
 */
export interface VapidDetails {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export function getVapidDetails(): VapidDetails | null {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] || "mailto:notifications@dairyflow.app";

  if (!publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export function getVapidPublicKey(): string | null {
  return process.env["VAPID_PUBLIC_KEY"] ?? null;
}
