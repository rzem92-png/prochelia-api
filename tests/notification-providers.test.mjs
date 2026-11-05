import test from "node:test";
import assert from "node:assert/strict";
import { sendResendEmail, sendWhatsAppTemplate } from "../src/notifications/providers.js";

const originalFetch = globalThis.fetch;

test("Resend refuses missing credentials before network access", async () => {
  globalThis.fetch = async () => { throw new Error("network must not be called"); };
  await assert.rejects(
    sendResendEmail({}, { to: "test@example.com", subject: "x", text: "y" }),
    /NOTIFICATION_CONFIG_MISSING:RESEND_API_KEY/
  );
});

test("Resend sends transactional payload and returns accepted provider id", async () => {
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ id: "email_test_123" }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  };

  const result = await sendResendEmail(
    { RESEND_API_KEY: "test-key", EMAIL_FROM: "PROCHÉLIA <noreply@example.test>" },
    { to: "client@example.test", subject: "Activation", text: "Code temporaire", idempotencyKey: "otp:test:1" }
  );

  assert.equal(captured.url, "https://api.resend.com/emails");
  assert.equal(captured.options.headers.authorization, "Bearer test-key");
  assert.ok(captured.options.signal instanceof AbortSignal, "provider request must have a timeout signal");
  assert.equal(captured.options.signal.aborted, false);
  assert.equal(captured.options.headers["Idempotency-Key"], "otp:test:1");
  const body = JSON.parse(captured.options.body);
  assert.deepEqual(body.to, ["client@example.test"]);
  assert.equal(body.subject, "Activation");
  assert.equal(result.ok, true);
  assert.equal(result.messageId, "email_test_123");
  assert.equal(result.status, "accepted");
});

test("Resend provider failure is normalized without exposing response body", async () => {
  globalThis.fetch = async () => new Response("secret provider error", { status: 429 });
  const result = await sendResendEmail(
    { RESEND_API_KEY: "test-key", EMAIL_FROM: "noreply@example.test" },
    { to: "client@example.test", subject: "x", text: "y" }
  );
  assert.deepEqual(result, {
    ok: false, provider: "resend", error: "PROVIDER_RATE_LIMITED", status: 429
  });
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("WhatsApp sends template only with required configuration", async () => {
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  };

  const result = await sendWhatsAppTemplate(
    { WHATSAPP_ACCESS_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_API_VERSION: "vXX.X" },
    { to: "33600000000", templateName: "booking_update", languageCode: "fr", components: [{ type: "body" }] }
  );

  assert.match(captured.url, /graph\.facebook\.com\/vXX\.X\/123\/messages$/);
  assert.equal(captured.options.headers.authorization, "Bearer token");
  assert.ok(captured.options.signal instanceof AbortSignal, "provider request must have a timeout signal");
  assert.equal(captured.options.signal.aborted, false);
  const body = JSON.parse(captured.options.body);
  assert.equal(body.type, "template");
  assert.equal(body.template.name, "booking_update");
  assert.equal(body.to, "33600000000");
  assert.equal(result.ok, true);
  assert.equal(result.messageId, "wamid.test");
});

test("WhatsApp failure returns normalized provider error", async () => {
  globalThis.fetch = async () => new Response("private details", { status: 500 });
  const result = await sendWhatsAppTemplate(
    { WHATSAPP_ACCESS_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_API_VERSION: "vXX.X" },
    { to: "33600000000", templateName: "booking_update" }
  );
  assert.deepEqual(result, {
    ok: false, provider: "whatsapp_meta", error: "PROVIDER_REQUEST_FAILED", status: 500
  });
});

test.after(() => { globalThis.fetch = originalFetch; });
