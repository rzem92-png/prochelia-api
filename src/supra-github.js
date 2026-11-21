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

function derLength(length) {
  if (length < 128) return Uint8Array.of(length);
  const bytes = [];
  for (let value = length; value > 0; value = Math.floor(value / 256)) bytes.unshift(value & 255);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function der(tag, value) {
  const length = derLength(value.length);
  const result = new Uint8Array(1 + length.length + value.length);
  result[0] = tag;
  result.set(length, 1);
  result.set(value, 1 + length.length);
  return result;
}

function concatBytes(...parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function pemToBytes(pem) {
  const normalized = String(pem || "").replace(/\\n/g, "\n").trim();
  const isPkcs1 = normalized.includes("-----BEGIN RSA PRIVATE KEY-----");
  const header = isPkcs1 ? "-----BEGIN RSA PRIVATE KEY-----" : "-----BEGIN PRIVATE KEY-----";
  const footer = isPkcs1 ? "-----END RSA PRIVATE KEY-----" : "-----END PRIVATE KEY-----";
  if (!normalized.includes(header) || !normalized.includes(footer)) throw new Error("INVALID_PRIVATE_KEY_FORMAT");
  const body = normalized.replace(header, "").replace(footer, "").replace(/\s/g, "");
  if (!body || body.length > 12000) throw new Error("INVALID_PRIVATE_KEY");
  const binary = atob(body);
  const raw = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (!isPkcs1) return raw;
  const rsaEncryptionOid = Uint8Array.of(0x30,0x0d,0x06,0x09,0x2a,0x86,0x48,0x86,0xf7,0x0d,0x01,0x01,0x01,0x05,0x00);
  const privateKeyInfo = concatBytes(Uint8Array.of(0x02,0x01,0x00), rsaEncryptionOid, der(0x04, raw));
  return der(0x30, privateKeyInfo);
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
  const cacheKey = String(env.SUPRA_GITHUB_APP_ID) + ":" + String(env.SUPRA_GITHUB_INSTALLATION_ID);
  if (installationTokenCache && installationTokenCache.key === cacheKey && installationTokenCache.expiresAt > Date.now() + 60000) {
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
  installationTokenCache = { key: cacheKey, value: data.token, expiresAt: expiry };
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

function safeRepositoryPath(value) {
  const path = String(value || "").trim();
  if (!path || path.length > 240 || path.startsWith("/") || path.includes("\\\\") ||
      path.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("."))) return false;
  if (!/^(src|tests|docs|\.github\/workflows)\/[A-Za-z0-9._/-]+$/.test(path)) return false;
  if (/(^|\/)(\.env|secrets?|credentials?)(\.|\/|$)/i.test(path)) return false;
  return /\.(mjs|cjs|js|ts|json|md|yml|yaml|sql|html|css)$/.test(path);
}

function redactRepositoryText(value) {
  return String(value)
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/(gh[pousr]_[A-Za-z0-9]{20,})/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/(sk_live_[A-Za-z0-9]{16,})/g, "[REDACTED_SECRET]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~-]{20,}/gi, "$1[REDACTED]");
}

async function repositoryFile(env, repository, path) {
  if (!ALLOWED_REPOSITORIES.includes(repository)) throw new Error("REPOSITORY_NOT_ALLOWED");
  if (!safeRepositoryPath(path)) throw new Error("REPOSITORY_PATH_NOT_ALLOWED");
  const token = await installationToken(env);
  const [owner, name] = repository.split("/");
  const endpoint = API + "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) +
    "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(endpoint, {
    headers: {
      "authorization": "Bearer " + token,
      "accept": "application/vnd.github+json",
      "x-github-api-version": "2022-11-28"
    }
  });
  if (!response.ok) throw new Error("GITHUB_FILE_READ_FAILED");
  const data = await response.json();
  if (data?.type !== "file" || typeof data.content !== "string" || data.encoding !== "base64") {
    throw new Error("GITHUB_FILE_RESPONSE_INVALID");
  }
  const compact = data.content.replace(/\s/g, "");
  if (compact.length > 24000) throw new Error("GITHUB_FILE_TOO_LARGE");
  const binary = atob(compact);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return {
    path,
    sha: String(data.sha || ""),
    size: bytes.byteLength,
    content: redactRepositoryText(decoded).slice(0, 16000)
  };
}

async function repositoryPullRequests(env, repository) {
  if (!ALLOWED_REPOSITORIES.includes(repository)) throw new Error("REPOSITORY_NOT_ALLOWED");
  const token = await installationToken(env);
  const [owner, name] = repository.split("/");
  const endpoint = API + "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) +
    "/pulls?state=open&per_page=20&sort=updated&direction=desc";
  const response = await fetch(endpoint, {
    headers: {
      "authorization": "Bearer " + token,
      "accept": "application/vnd.github+json",
      "x-github-api-version": "2022-11-28"
    }
  });
  if (!response.ok) throw new Error("GITHUB_PULL_REQUESTS_FAILED");
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("GITHUB_PULL_REQUESTS_RESPONSE_INVALID");
  return data.slice(0, 20).map(pr => ({
    number: Number(pr.number),
    title: String(pr.title || "").slice(0, 240),
    state: String(pr.state || ""),
    draft: Boolean(pr.draft),
    created_at: pr.created_at || null,
    updated_at: pr.updated_at || null,
    head_sha: String(pr.head?.sha || ""),
    base_ref: String(pr.base?.ref || ""),
    html_url: String(pr.html_url || "")
  }));
}

export async function handleSupraGithubRoute(request, env, path, auth) {
  const supported = [
    "/api/supra/github/status",
    "/api/supra/github/repositories",
    "/api/supra/github/pull-requests",
    "/api/supra/github/file"
  ];
  if (!supported.includes(path)) return null;
  if (request.method !== "GET") {
    return Response.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { "cache-control": "no-store" } });
  }
  if (!auth?.user) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  if (auth.user.role !== "gerante") {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const requestedRepository = (path === "/api/supra/github/pull-requests" || path === "/api/supra/github/file")
    ? new URL(request.url).searchParams.get("repository") || ""
    : "";
  const requestedPath = path === "/api/supra/github/file"
    ? new URL(request.url).searchParams.get("path") || ""
    : "";
  if ((path === "/api/supra/github/pull-requests" || path === "/api/supra/github/file") && !ALLOWED_REPOSITORIES.includes(requestedRepository)) {
    return Response.json({ ok: false, error: "REPOSITORY_NOT_ALLOWED" }, {
      status: 400, headers: { "cache-control": "no-store" }
    });
  }
  if (path === "/api/supra/github/file" && !safeRepositoryPath(requestedPath)) {
    return Response.json({ ok: false, error: "REPOSITORY_PATH_NOT_ALLOWED" }, {
      status: 400, headers: { "cache-control": "no-store" }
    });
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
    if (path === "/api/supra/github/file") {
      if (!installation.names.includes(requestedRepository)) {
        return Response.json({ ok: false, error: "REPOSITORY_NOT_INSTALLED" }, {
          status: 403, headers: { "cache-control": "no-store" }
        });
      }
      const file = await repositoryFile(env, requestedRepository, requestedPath);
      return Response.json({
        ok: true, mode: "READ_ONLY", write_enabled: false,
        repository: requestedRepository, file
      }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/api/supra/github/pull-requests") {
      const repository = requestedRepository;
      if (!installation.names.includes(repository)) {
        return Response.json({ ok: false, error: "REPOSITORY_NOT_INSTALLED" }, {
          status: 403, headers: { "cache-control": "no-store" }
        });
      }
      const pullRequests = await repositoryPullRequests(env, repository);
      return Response.json({
        ok: true, mode: "READ_ONLY", write_enabled: false,
        repository, count: pullRequests.length, pull_requests: pullRequests
      }, { headers: { "cache-control": "no-store" } });
    }
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
