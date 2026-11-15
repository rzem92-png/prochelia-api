const base = new URL(
  process.env.PROCHELIA_PAGES_PREVIEW_URL ||
  "https://feature-dsa-notice-client-20.prochelia.pages.dev"
).origin;

async function request(path, options = {}) {
  return fetch(new URL(path, base), {
    redirect: "manual",
    ...options,
    headers: {
      accept: "application/json",
      origin: base,
      ...(options.headers || {})
    }
  });
}

const csrfResponse = await request("/api/auth/csrf");
if (csrfResponse.status !== 200) {
  throw new Error(`CSRF bootstrap expected 200, received ${csrfResponse.status}`);
}
const csrfBody = await csrfResponse.json();
const csrfToken = csrfBody?.csrf_token;
if (typeof csrfToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(csrfToken)) {
  throw new Error("CSRF bootstrap did not return a valid token");
}
const setCookie = csrfResponse.headers.get("set-cookie") || "";
const csrfCookie = setCookie.split(";")[0];
if (!csrfCookie.startsWith("prochelia_csrf=")) {
  throw new Error("CSRF bootstrap did not set the expected HttpOnly cookie");
}

const checks = [
  { path: "/api/v7/status", method: "GET", expected: 200 },
  { path: "/api/compliance/notices", method: "GET", expected: 401 },
  {
    path: "/api/compliance/notices",
    method: "POST",
    expected: 401,
    body: {
      subject_type: "LISTING",
      subject_id: "preview-smoke-listing",
      notice_type: "ILLEGAL_CONTENT",
      explanation: "Unauthenticated preview smoke test; no record should be created."
    }
  },
  {
    path: "/api/compliance/appeals",
    method: "POST",
    expected: 401,
    body: {
      decision_id: "preview-smoke-decision",
      grounds: "Unauthenticated preview smoke test; no record should be created."
    }
  }
];

for (const check of checks) {
  const response = await request(check.path, {
    method: check.method,
    headers: check.method === "POST" ? {
      "content-type": "application/json",
      cookie: csrfCookie,
      "x-csrf-token": csrfToken
    } : {},
    ...(check.body ? { body: JSON.stringify(check.body) } : {})
  });
  if (response.status !== check.expected) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(`${check.method} ${check.path}: expected ${check.expected}, received ${response.status}: ${body}`);
  }
  console.log(`PASS ${check.method} ${check.path} -> ${response.status}`);
}
console.log("PASS Pages Preview -> service binding -> DSA Worker routing and CSRF smoke checks");
