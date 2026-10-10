# Auth testing notes
- Auth is Bearer-token based (JWT, 7 days). Token stored in localStorage key `cl_token`.
- Email login: demo@algoforge.dev / demo1234
- To simulate a logged-in browser: POST /api/auth/login, then `localStorage.setItem('cl_token', token)` and reload.
- Google flow: /login -> "Continue with Google" -> auth.emergentagent.com -> returns to `/#session_id=...` -> frontend POSTs /api/auth/google -> token.
- GitHub and Mobile OTP buttons intentionally show "coming soon" toast (not implemented yet).
