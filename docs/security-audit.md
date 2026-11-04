# SWMS security audit (white-box review)

- **Date:** 2026-11-04
- **Code audited:** `main` at `77df97f` (after the dashboard and reports-list merges)
- **Method:** manual white-box review of every source file, guided by the OWASP Top 10:2025 and the
  OWASP API Security Top 10 (2023), plus harmless live checks against **localhost only**
  (backend `:4000`, ML API `:8000`, web `:3000`) using the seeded accounts and one extra
  `SECURITY-TEST` user. Dependency scans: `npm audit` (backend, web, Mobile) and `pip-audit` (ML).
  Secret scan: the full git history of every branch.
- **Not used:** the Strix scanner itself (it needs Docker and an LLM API key, which aren't set up here).
  This report follows its methodology and its honesty rules instead.

## How to read this report

Each finding has:

- **Severity** with a one-line reason. Severity is ranked by **what was actually shown**, not by the
  theoretical worst case. Every finding says whether it was **proven live** or found by **code review only**.
- **Where:** `file:line`.
- **What's wrong** in plain language, **how it could be abused** (conceptually, no attack recipes),
  **how to fix it** with a small code sketch, and the **lesson** to carry into future projects.

| Severity | Meaning in this report |
|---|---|
| Critical | Exploitable now by anyone, with serious impact. *(None found.)* |
| High | Serious impact, proven, needs only a small and likely step (such as deploying) to be exploitable. |
| Medium | Real weakness with meaningful impact, but needs an account, a specific setup, or wasn't proven live. |
| Low | Defense-in-depth gap or limited impact. Worth fixing, not urgent. |
| Info | Good to know. No direct risk today. |

## Summary

No Critical findings. The core of the backend is solid: every SQL query is parameterized, object-level
access control works (a user can't read another user's report, and a user can't call admin routes),
request bodies are validated with allowlists (no mass assignment), and uploads are checked by their real
content. The main risks are **operational**: a published admin password that works against the real
database, no rate limiting, and an ML endpoint that a big image could exhaust.

| ID | Severity | Title | Area | OWASP 2025 / API 2023 | Evidence |
|---|---|---|---|---|---|
| [SEC-01](#sec-01) | **High** | Published demo admin password works against the real database | Repo / backend | A07, A02 | Proven live |
| [SEC-02](#sec-02) | Medium | No rate limiting on login, registration or report creation | Backend | A07, API4 | Proven live |
| [SEC-03](#sec-03) | Medium | ML API can be made to use gigabytes of memory with one small image | ML | A10, API4 | Code review |
| [SEC-04](#sec-04) | Low | Weak password policy (`12345678` is accepted) | Backend | A07 | Proven live |
| [SEC-05](#sec-05) | Low | Account enumeration through login timing and the register error | Backend | A07 | Proven live |
| [SEC-06](#sec-06) | Low | Uploaded photos are stored and served byte-for-byte (EXIF location kept) | Backend | A02, API3 | Proven live |
| [SEC-07](#sec-07) | Low | Missing HTTP security headers (backend and web) | Backend / web | A02 | Proven live |
| [SEC-08](#sec-08) | Low | Upload limits are checked late; multipart fields are unlimited | Backend / ML | API4 | Partly proven |
| [SEC-09](#sec-09) | Low | ML `/predict` has no authentication; `/docs` is public | ML | A01, API2 | Proven live |
| [SEC-10](#sec-10) | Low | No security event logging; category/note changes leave no history | Backend | A09 | Code review |
| [SEC-11](#sec-11) | Low | 24-hour tokens that can't be revoked; no `iss`/`aud` claims | Backend / web | A07 | Proven live |
| [SEC-12](#sec-12) | Low | Mobile app talks to the backend over plain HTTP | Mobile | A04 | Code review |
| [SEC-13](#sec-13) | Low | Anyone can log an admin out with a link | Web | A01 | Proven live |
| [SEC-14](#sec-14) | Low | Error-handling gaps: big JSON gives 500, a bad image gives 503 | Backend | A10 | Proven live |
| [SEC-15](#sec-15) | Low | Any admin can deactivate every other admin | Backend | A06 | Code review |
| [SEC-16](#sec-16) | Low | `keras 3.13.2` has known advisories (not reachable here) | ML | A03 | `pip-audit` |
| [SEC-17](#sec-17) | Info | `npm audit`: moderate issues in dev tooling only | Web / Mobile | A03 | `npm audit` |
| [SEC-18](#sec-18) | Info | "Deactivated" is detected from the error message text | Web | A10 | Code review |
| [SEC-19](#sec-19) | Info | Small hardening notes (bcrypt cost, secret strength, gitignore, proxy) | Several | A02, A04 | Code review |

Suggested fix order: SEC-01, then SEC-02 together with SEC-04, then SEC-03 and SEC-08 (they share a fix
area), then the Low items as time allows.
