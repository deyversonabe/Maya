import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { isValidWebhookChallenge, verifyMetaSignature } from "../modules/whatsapp/security";

const SECRET = "test-app-secret";
function sign(body: string, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("WhatsApp webhook — challenge GET", () => {
  it("aceita challenge com mode=subscribe e token correto", () => {
    expect(isValidWebhookChallenge({ mode: "subscribe", token: "abc", expectedToken: "abc" })).toBe(true);
  });
  it("rejeita token errado", () => {
    expect(isValidWebhookChallenge({ mode: "subscribe", token: "x", expectedToken: "abc" })).toBe(false);
  });
  it("rejeita sem expectedToken configurado", () => {
    expect(isValidWebhookChallenge({ mode: "subscribe", token: "abc", expectedToken: undefined })).toBe(false);
  });
});

describe("WhatsApp webhook — assinatura x-hub-signature-256", () => {
  const body = JSON.stringify({ entry: [{ id: "1" }] });

  it("aceita assinatura HMAC válida", () => {
    expect(verifyMetaSignature({ rawBody: body, signature: sign(body), appSecret: SECRET })).toBe(true);
  });
  it("rejeita assinatura de outro segredo", () => {
    expect(verifyMetaSignature({ rawBody: body, signature: sign(body, "outro"), appSecret: SECRET })).toBe(false);
  });
  it("rejeita corpo adulterado com assinatura antiga", () => {
    const tampered = JSON.stringify({ entry: [{ id: "2" }] });
    expect(verifyMetaSignature({ rawBody: tampered, signature: sign(body), appSecret: SECRET })).toBe(false);
  });
  it("rejeita quando WHATSAPP_APP_SECRET nao esta configurado", () => {
    expect(verifyMetaSignature({ rawBody: body, signature: sign(body), appSecret: undefined })).toBe(false);
  });

  it("rejeita cabeçalho ausente ou sem prefixo sha256=", () => {
    expect(verifyMetaSignature({ rawBody: body, signature: null, appSecret: SECRET })).toBe(false);
    expect(verifyMetaSignature({ rawBody: body, signature: "deadbeef", appSecret: SECRET })).toBe(false);
  });
});
