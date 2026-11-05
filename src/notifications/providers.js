/**
 * PROCHÉLIA notification provider adapters.
 * Provider-only layer: callers must enforce auth, consent, OTP policy,
 * rate limits, idempotency and template validation before invoking.
 * Never log request payloads or credentials.
 */

function providerError(provider, status) {
  return {
    ok: false,
    provider,
    error: status === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_REQUEST_FAILED",
    status
  };
}

const PROVIDER_TIMEOUT_MS = 10_000;

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`NOTIFICATION_CONFIG_MISSING:${name}`);
  }
  return value.trim();
}

/**
 * Send a transactional email through Resend.
 * env.RESEND_API_KEY must be a Cloudflare Worker secret.
 * env.EMAIL_FROM must be a verified sender/domain.
 */
export async function sendResendEmail(env, {
  to,
  subject,
  html,
  text,
  idempotencyKey
}) {
  const apiKey = required(env.RESEND_API_KEY, "RESEND_API_KEY");
  const from = required(env.EMAIL_FROM, "EMAIL_FROM");
  if (!to || !subject || (!html && !text)) {
    throw new Error("EMAIL_PAYLOAD_INVALID");
  }

  const headers = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json"
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {})
    })
  });

  if (!response.ok) return providerError("resend", response.status);
  const result = await response.json();
  return {
    ok: true,
    provider: "resend",
    messageId: result.id || null,
    status: "accepted"
  };
}

/**
 * Send an approved WhatsApp template via Meta Cloud API.
 * The recipient must have opted in. This adapter intentionally only sends
 * template messages; free-form messages are not enabled here.
 */
export async function sendWhatsAppTemplate(env, {
  to,
  templateName,
  languageCode = "fr",
  components = [],
  idempotencyKey
}) {
  const token = required(env.WHATSAPP_ACCESS_TOKEN, "WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = required(env.WHATSAPP_PHONE_NUMBER_ID, "WHATSAPP_PHONE_NUMBER_ID");
  const apiVersion = required(env.WHATSAPP_API_VERSION, "WHATSAPP_API_VERSION");
  if (!to || !templateName) throw new Error("WHATSAPP_PAYLOAD_INVALID");

  // Meta Cloud API does not provide general idempotency for this endpoint.
  // Caller must persist/deduplicate idempotencyKey before calling this adapter.
  void idempotencyKey;

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components.length ? { components } : {})
        }
      })
    }
  );

  if (!response.ok) return providerError("whatsapp_meta", response.status);
  const result = await response.json();
  return {
    ok: true,
    provider: "whatsapp_meta",
    messageId: result.messages?.[0]?.id || null,
    status: "accepted"
  };
}
