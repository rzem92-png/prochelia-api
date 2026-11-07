# CSRF/session implementation checkpoint — 2026-11-07

This checkpoint records the implementation changes on isolated preproduction branches. It is **not** a production security certification.

## Backend change
- `GET /api/auth/csrf` requires an active session and returns a token derived from the HttpOnly session cookie:
  `SHA-256("prochelia-csrf-v1:" + sessionCookie)`.
- Cookie-authenticated mutating requests (`POST/PUT/PATCH/DELETE`) require an allowed Origin and the matching `X-CSRF-Token`.
- Explicit exceptions: login, bootstrap, Stripe webhook. Login/bootstrap remain subject to the origin allowlist when browser Origin is supplied; webhook relies on PSP signature verification.
- Missing Origin or invalid/missing CSRF token on cookie-auth mutation is rejected before business handling.
- No token or session cookie is written to logs.

Backend commit: `a9ed2abae53d0580bd92e5a92d9fc2593880fede`

## Frontend change
- API client fetches `/api/auth/csrf` with credentials before authenticated mutations and attaches `X-CSRF-Token`.
- Login/bootstrap/webhook calls are excluded from token-fetch logic.
- 401 from CSRF endpoint is treated as no authenticated session; the target API request still determines authorization.

Frontend commit: `575ea2a8c2b6f5425dcdec4d66e9ac1282c68e08`

## Added tests
- Reject cookie-authenticated mutation with no CSRF token.
- Valid derived token proceeds past CSRF middleware and fails closed at unavailable D1 (test sentinel).
- Existing CORS/session tests retained.

Test commit: `a79c5ca4502568c73fe678e76c20c699d9f7ad9d`

## Required before considering this control verified
1. Run the full test suite on the exact backend branch commit.
2. Browser test with actual preproduction frontend/API origins, cookies and credentials.
3. Verify session expiry/revocation, logout, token rejection after session rotation.
4. Confirm all browser mutations use this client and no alternate fetch bypass exists.
5. Verify Stripe webhook signature/replay protections independently.
6. Run security review; no production deployment until human approval.

**Current status:** code committed to preproduction; CI/browser/security evidence pending.
