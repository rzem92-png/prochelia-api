// NEXUS SUPRA — GitHub App read-only connector (Preview-first).
// No repository writes, PR creation, workflow dispatch, or deployment in this module.
const API = "https://api.github.com";
const ALLOWED_REPOSITORIES = Object.freeze([
  "rzem92-png/prochelia-api",
  "rzem92-png/-prochelia"
]);
let installationTokenCache = null;

function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem) {
  const normalized = String(pem || "").replace(/\\n/g, "\n");
  const body = normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  if (!body || body.length > 12000) throw new Error("INVALID_PRIVATE_KEY");
  const binary = atob(body);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function configured(env) {
  return Boolean(
    env?.SUPRA_GITHUB_APP_ID &&
    env?.SUPRA_GITHUB_APP_PRIVATE_KEY &&
    env?.SUPRA_GITHUB_INSTALLATION_ID
  );
}

async function createAppJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(new TextEncoder().encode(JSON.stringify({
    iat: now - 60,
    exp: now + 8 * 60,
    iss: String(env.SUPRA_GITHUB_APP_ID)
  })));
  const unsigned = header + "." + claims;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(env.SUPRA_GITHUB_APP_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  return unsigned + "." + b64url(new Uint8Array(signature));
}

async function installationToken(env) {
  if (installationTokenCache && installationTokenCache.expiresAt > Date.now() + 60000) {
    return installationTokenCache.value;
  }
  const jwt = await createAppJwt(env);
  const response = await fetch(
    API + "/app/installations/" + encodeURIComponent(String(env.SUPRA_GITHUB_INSTALLATION_ID)) + "/access_tokens",
    {
      method: "POST",
      headers: {
        "authorization": "Bearer " + jwt,
        "accept": "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        repositories: ["prochelia-api", "-prochelia"],
        permissions: {
          metadata: "read",
          contents: "read",
          pull_requests: "read",
          actions: "read",
          checks: "read",
          statuses: "read"
        }
      })
    }
  );
  if (!response.ok) throw new Error("GITHUB_INSTALLATION_TOKEN_FAILED");
  const data = await response.json();
  if (!data?.token || !data?.expires_at) throw new Error("GITHUB_TOKEN_RESPONSE_INVALID");
  const expiry = Date.parse(data.expires_at);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error("GITHUB_TOKEN_EXPIRY_INVALID");
  installationTokenCache = { value: data.token, expiresAt: expiry };
  return data.token;
}

async function installationRepositories(env) {
  const token = await installationToken(env);
  const response = await fetch(API + "/installation/repositories?per_page=100", {
    headers: {
      "authorization": "Bearer " + token,
      "accept": "application/vnd.github+json",
      "x-github-api-version": "2022-11-28"
    }
  });
  if (!response.ok) throw new Error("GITHUB_INSTALLATION_REPOSITORIES_FAILED");
  const data = await response.json();
  const names = Array.isArray(data?.repositories)
    ? data.repositories.map(repo => String(repo.full_name || "")).filter(name => ALLOWED_REPOSITORIES.includes(name))
    : [];
  return {
    names: [...new Set(names)].sort(),
    complete: ALLOWED_REPOSITORIES.every(name => names.includes(name))
  };
}

export async function handleSupraGithubRoute(request, env, path, auth) {
  if (path !== "/api/supra/github/status" && path !== "/api/supra/github/repositories") return null;
  if (request.method !== "GET") {
    return Response.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { "cache-control": "no-store" } });
  }
  if (!auth?.user) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  if (auth.user.role !== "gerante") {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  if (!configured(env)) {
    return Response.json({
      ok: true,
      status: "NOT_CONNECTED",
      mode: "READ_ONLY",
      write_enabled: false,
      repositories: [],
      required_secrets: ["SUPRA_GITHUB_APP_ID", "SUPRA_GITHUB_APP_PRIVATE_KEY", "SUPRA_GITHUB_INSTALLATION_ID"]
    }, { headers: { "cache-control": "no-store" } });
  }
  try {
    const installation = await installationRepositories(env);
    const payload = {
      ok: installation.complete,
      status: installation.complete ? "CONNECTED_READ_ONLY" : "PARTIALLY_CONNECTED",
      mode: "READ_ONLY",
      write_enabled: false,
      allowlist: ALLOWED_REPOSITORIES,
      repositories: installation.names,
      missing_repositories: ALLOWED_REPOSITORIES.filter(name => !installation.names.includes(name))
    };
    return Response.json(payload, {
      status: installation.complete ? 200 : 503,
      headers: { "cache-control": "no-store" }
    });
  } catch {
    return Response.json({
      ok: false,
      status: "CONNECTION_ERROR",
      mode: "READ_ONLY",
      write_enabled: false,
      error: "GITHUB_APP_CONNECTION_FAILED"
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
