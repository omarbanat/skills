# OWASP Top 10:2025: what to check

Source: https://top10.owasp.org/2025/ (the 8th edition). Check the categories in this order. Each section says where the problem hides, how to search for it, what confirms it and what fixes it. The search starters find candidates, not findings: every hit still needs a path from untrusted input to the vulnerable code.

## Contents

- A01 Broken Access Control
- A02 Security Misconfiguration
- A03 Software Supply Chain Failures
- A04 Cryptographic Failures
- A05 Injection
- A06 Insecure Design
- A07 Authentication Failures
- A08 Software or Data Integrity Failures
- A09 Security Logging & Alerting Failures
- A10 Mishandling of Exceptional Conditions

## A01 Broken Access Control

This covers IDOR, missing function-level checks, privilege escalation, CORS that trusts any origin, path traversal and forced browsing. SSRF is now part of A01.

- **Where:** every handler that takes an id from the path, query or body. Admin routes. Multi-tenant queries. File download and upload paths. Any server-side fetch of a URL the user supplied.
- **Search:** `findById|findOne|get_object_or_404|WHERE id =`, `req.params|request.args|params[:id]`, `fetch(|axios|requests.get|urlopen|HttpClient` called with user input, `path.join|open(|send_file|res.sendFile`, `Access-Control-Allow-Origin|cors(`.
- **Confirmed when** a route loads or changes a resource by id with no ownership or tenant filter and no role check, either on the path or in middleware. Check where middleware is mounted: a guard on `/api/admin` doesn't cover `/api/v2/admin`.
- **Fix:** scope queries by the current user or tenant (`WHERE id = ? AND owner_id = ?`). Deny by default, with a guard at the router level. Allowlist the hosts for outbound fetches and block internal IP ranges after DNS resolution. Normalize file paths and check them against a fixed base directory.

## A02 Security Misconfiguration

- **Where:** framework config, Dockerfiles, IaC (Terraform, k8s, compose), web server config, `.env.example`, CI files, CORS and security headers, cookie flags, error pages, default credentials, open cloud storage, XML parsers.
- **Search:** `DEBUG\s*=\s*True|NODE_ENV.*development|app.debug`, `helmet|Content-Security-Policy|X-Frame-Options`, `secure:\s*false|httpOnly:\s*false|SameSite=None`, `0.0.0.0/0|public-read|"Principal":\s*"\*"`, `resolve_entities|DocumentBuilderFactory|libxml`, `admin:admin|password123`.
- **Confirmed when** the setting is active in the production path. Look at what production actually loads; a dev-only file doesn't count.
- **Fix:** secure defaults in the production config, security headers through the framework's middleware, `Secure`/`HttpOnly`/`SameSite` cookies, disabled XML external entities, least-privilege IAM.

## A03 Software Supply Chain Failures

This covers vulnerable or unmaintained dependencies, unpinned versions, untrusted registries, compromised build steps and CI that runs untrusted code.

- **Where:** manifests and lockfiles, Dockerfile base images, CI workflows, install scripts.
- **Run:** `scripts/deps-audit.sh <root>`.
- **Search:** `FROM .*:latest`, `curl .* \| (ba)?sh`, `pull_request_target`, `uses: .*@(main|master)`, `"\^|~|\*"` on security-critical packages, `--extra-index-url`, a missing lockfile.
- **Confirmed when** an advisory matches the installed version (read it from the lockfile, not the manifest) and the project uses the affected function, or a CI step runs unpinned or untrusted code with access to secrets. Report advisories for functions the project doesn't use as Low.
- **Fix:** upgrade to the patched version and commit the lockfile. Pin GitHub Actions to a commit SHA. Pin base images by digest. Avoid `pull_request_target` that checks out PR code.

## A04 Cryptographic Failures

- **Where:** password hashing, token generation, encryption at rest, TLS settings, key storage, randomness.
- **Search:** `md5|sha1|SHA1|DES|RC4|ECB`, `Math.random|random.random|rand(` used for tokens, `verify=False|rejectUnauthorized:\s*false|InsecureSkipVerify`, hardcoded keys (`secret\s*=\s*["']`, `BEGIN (RSA )?PRIVATE KEY`), `createCipher(` without an IV, `http://` endpoints that carry credentials.
- **Confirmed when** a weak primitive protects a secret, password or integrity check, or a hardcoded key is used in production.
- **Fix:** argon2id or bcrypt for passwords, AES-GCM with random nonces, `crypto.randomBytes`/`secrets` for tokens, TLS verification on, keys loaded from a secret store.

## A05 Injection

This covers SQL, NoSQL, OS command, LDAP and template injection, and XSS.

- **Where:** raw queries, shell calls, template rendering, `eval`, HTML sinks.
- **Search:** string-built queries (`"SELECT .*" +`, f-strings or template literals around SQL, `.raw(`, `$where`, `$regex` from input), `exec(|execSync|spawn(.*shell:\s*true|os.system|subprocess.*shell=True|Runtime.exec`, `eval(|new Function(|pickle.loads|yaml.load(` without `SafeLoader`, `innerHTML|dangerouslySetInnerHTML|v-html|\|safe|html_safe|render_template_string`.
- **Confirmed when** user input reaches the sink unparameterized and unescaped. ORM query builders and auto-escaping templates are safe unless explicitly bypassed.
- **Fix:** parameterized queries, argument arrays with no shell, a safe loader, contextual output encoding, and a sanitizer such as DOMPurify where HTML is genuinely needed.

## A06 Insecure Design

This covers flaws in the logic rather than the code: no rate limits on costly or sensitive actions, trusting client-side price or role values, workflows whose steps can be skipped or repeated, and race conditions on balances or stock.

- **Where:** checkout, refunds, coupons, invites, password reset, voting, anything with money or limited quantities.
- **Search:** `price|amount|total|discount|role|isAdmin` read from the request body, multi-step flows whose state is kept on the client, read-then-write without a transaction or lock.
- **Confirmed when** you can describe a concrete abuse that runs only through the API the app exposes.
- **Fix:** recompute trusted values on the server, enforce state machines on the server, rate limits, idempotency keys, transactions or row locks.

## A07 Authentication Failures

- **Where:** login, signup, password reset, MFA, session and JWT handling, API keys, "remember me".
- **Search:** `jwt.decode(` without verify, `algorithms` missing or including `none`, `expiresIn` absent, session id not rotated at login, reset tokens without expiry or reused, `==` comparing secrets (use a constant-time compare), no lockout or rate limit on login, login errors that reveal whether the user exists.
- **Confirmed when** a token or session is accepted without full verification, or credentials can be guessed with no throttle.
- **Fix:** verify signature, algorithm, `exp`, `aud` and `iss`. Rotate the session at login. Single-use reset tokens that expire. Constant-time comparison. Rate-limit login and reset endpoints.

## A08 Software or Data Integrity Failures

- **Where:** deserialization of untrusted data, auto-update channels, webhooks, CDN scripts, signed cookies, client-trusted cache entries.
- **Search:** `pickle|Marshal.load|ObjectInputStream|unserialize(|BinaryFormatter`, webhook handlers that skip signature checks, `<script src="https://` without `integrity=`, cookies or `localStorage` values trusted for authorization.
- **Confirmed when** untrusted bytes are deserialized into objects, or a webhook or update is accepted without a signature check.
- **Fix:** JSON with schema validation, HMAC verification of webhooks with a constant-time compare and timestamp tolerance, SRI hashes, server-side session state.

## A09 Security Logging & Alerting Failures

- **Where:** auth events, access denials, admin actions, payment events, and the logger configuration.
- **Search:** failed logins or 403s that are never logged; passwords, tokens or full card numbers in logs (`log.*(password|token|authorization)`); user input logged without neutralizing newlines.
- **Confirmed when** a security-relevant event goes unrecorded, or secrets reach the logs. Missing alerting usually lives outside the repo, so mark it **Needs runtime check** unless the alert config is in the repo.
- **Fix:** structured logs for auth and access-control events, redaction of sensitive fields, and an alert on repeated failures.

## A10 Mishandling of Exceptional Conditions

This is new in 2025. It covers failing open, error responses that leak internals, unchecked return values, and resources left in a bad state.

- **Where:** try/catch around auth or permission checks, global error handlers, parsers, partial writes, timeouts.
- **Search:** `catch\s*\([^)]*\)\s*\{\s*\}|except:\s*pass|except Exception:\s*(pass|return True)`, `return next()` inside a catch in auth middleware, `res.send(err|err.stack|traceback.format_exc()` in responses, unchecked results of permission or signature checks, missing `finally`/rollback on multi-step writes.
- **Confirmed when** an error path grants access, skips a check, returns stack traces or SQL errors to the client, or leaves data half-written.
- **Fix:** fail closed (deny on error), generic error responses with details only in server logs, transactions with rollback, explicit timeouts.
