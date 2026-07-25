import { createHmac, timingSafeEqual } from "crypto";

const META_SIGNATURE_PREFIX = "sha256=";

export function isValidWebhookChallenge({
  mode,
  token,
  expectedToken
}: {
  mode: string | null;
  token: string | null;
  expectedToken?: string;
}) {
  return Boolean(expectedToken && mode === "subscribe" && token === expectedToken);
}

export function verifyMetaSignature({
  rawBody,
  signature,
  appSecret
}: {
  rawBody: string;
  signature: string | null;
  appSecret?: string;
}) {
  if (!appSecret) {
    return true;
  }

  if (!signature?.startsWith(META_SIGNATURE_PREFIX)) {
    return false;
  }

  const expected = `${META_SIGNATURE_PREFIX}${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const receivedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
