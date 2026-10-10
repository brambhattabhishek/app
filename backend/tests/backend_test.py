"""
Backend tests for AlgoForge (CodeLab) - iteration 3.
Covers: problems+companies, problem detail (hints/understand/edges),
auth (register/login/greeting), OTP demo, OAuth provider 503,
recommendations/for-you, profile update, admin overview, tracking,
notifications.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://code-arena-42.preview.emergentagent.com").rstrip("/")
TIMEOUT = 30


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(http):
    r = http.post(f"{BASE_URL}/api/auth/login",
                  json={"email": "demo@algoforge.dev", "password": "demo1234"},
                  timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def resend_token(http):
    r = http.post(f"{BASE_URL}/api/auth/login",
                  json={"email": "delivered@resend.dev", "password": "test1234"},
                  timeout=TIMEOUT)
    # If not seeded, try to register
    if r.status_code != 200:
        http.post(f"{BASE_URL}/api/auth/register",
                  json={"name": "Resend User", "email": "delivered@resend.dev", "password": "test1234"},
                  timeout=TIMEOUT)
        r = http.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "delivered@resend.dev", "password": "test1234"},
                      timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- Problems & companies ----------
class TestProblems:
    def test_list_has_40_with_companies(self, http):
        r = http.get(f"{BASE_URL}/api/problems", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 40, f"expected 40 problems, got {len(data)}"
        # at least some problems must have companies
        with_companies = [p for p in data if p.get("companies")]
        assert len(with_companies) >= 20
        # Each item must have expected keys
        p = data[0]
        for k in ("id", "slug", "title", "difficulty", "tags", "companies"):
            assert k in p

    def test_problem_detail_hints_understand_edges(self, http):
        r = http.get(f"{BASE_URL}/api/problems/two-sum", timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert d.get("hints") and len(d["hints"]) >= 1
        # explanation / understand section
        assert d.get("explanation") or d.get("understand")
        assert d.get("edgeCases") and len(d["edgeCases"]) >= 1
        assert isinstance(d.get("companies"), list)


# ---------- Auth ----------
class TestAuth:
    def test_providers_flags(self, http):
        r = http.get(f"{BASE_URL}/api/auth/providers", timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] is True
        assert d["google"] is True
        assert d["github"] is False
        assert d["linkedin"] is False
        assert d["otp"] in ("demo", True, "live")

    def test_register_returns_welcome_and_login_no_greeting(self, http):
        email = f"ptest_{uuid.uuid4().hex[:8]}@algoforge.dev"
        r = http.post(f"{BASE_URL}/api/auth/register",
                      json={"name": "Pytest User", "email": email, "password": "testing123"},
                      timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "greeting" in d, "register response must include greeting field"
        assert (d["greeting"] or "").lower() == "welcome"
        # immediate login - should NOT greet
        r2 = http.post(f"{BASE_URL}/api/auth/login",
                       json={"email": email, "password": "testing123"},
                       timeout=TIMEOUT)
        assert r2.status_code == 200
        d2 = r2.json()
        assert "greeting" in d2
        assert d2["greeting"] in (None, "", "null")

    def test_login_invalid(self, http):
        r = http.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "demo@algoforge.dev", "password": "wrong_pw_xyz"},
                      timeout=TIMEOUT)
        assert r.status_code in (400, 401)

    def test_github_oauth_start_503_when_not_configured(self, http):
        r = http.get(f"{BASE_URL}/api/auth/oauth/github/start",
                     params={"redirect_uri": "http://x"}, timeout=TIMEOUT)
        assert r.status_code == 503

    def test_linkedin_oauth_start_503_when_not_configured(self, http):
        r = http.get(f"{BASE_URL}/api/auth/oauth/linkedin/start",
                     params={"redirect_uri": "http://x"}, timeout=TIMEOUT)
        assert r.status_code == 503


# ---------- OTP ----------
class TestOtp:
    def test_otp_demo_send_and_verify(self, http):
        phone = f"+1500555{str(int(time.time()))[-4:]}"
        r = http.post(f"{BASE_URL}/api/auth/otp/send",
                      json={"phone": phone}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("demo") is True
        code = d.get("demo_code")
        assert code and len(code) >= 4
        # Verify
        r2 = http.post(f"{BASE_URL}/api/auth/otp/verify",
                       json={"phone": phone, "code": code}, timeout=TIMEOUT)
        assert r2.status_code == 200, r2.text
        assert "token" in r2.json()

    def test_otp_wrong_code(self, http):
        phone = f"+1500555{(int(time.time())+1) % 10000:04d}"
        r = http.post(f"{BASE_URL}/api/auth/otp/send",
                      json={"phone": phone}, timeout=TIMEOUT)
        assert r.status_code == 200
        r2 = http.post(f"{BASE_URL}/api/auth/otp/verify",
                       json={"phone": phone, "code": "000000"}, timeout=TIMEOUT)
        assert r2.status_code in (400, 401)


# ---------- Recommendations / profile / tracking ----------
class TestUserFeatures:
    def test_recommendations_requires_auth(self, http):
        r = http.get(f"{BASE_URL}/api/recommendations", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_recommendations_logged_in(self, http, resend_token):
        r = http.get(f"{BASE_URL}/api/recommendations",
                     headers={"Authorization": f"Bearer {resend_token}"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        # expect keys for pending & recommended
        keys = set(d.keys())
        assert keys & {"pending", "recommended", "pending_problems", "recommended_problems", "continue", "foryou"}

    def test_profile_update(self, http, resend_token):
        headers = {"Authorization": f"Bearer {resend_token}"}
        payload = {
            "name": "Resend Tester",
            "location": "Remote",
            "phone": "+14155552671",
            "bio": "Pytest bio",
            "interests": ["Graph", "Stack"],
        }
        r = http.put(f"{BASE_URL}/api/profile", json=payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        # Verify persisted
        me = http.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=TIMEOUT)
        assert me.status_code == 200
        md = me.json()
        assert md.get("name") == "Resend Tester"
        assert md.get("location") == "Remote"
        assert md.get("bio") == "Pytest bio"
        assert set(md.get("interests") or []) >= {"Graph", "Stack"}

    def test_profile_update_invalid_phone(self, http, resend_token):
        headers = {"Authorization": f"Bearer {resend_token}"}
        r = http.put(f"{BASE_URL}/api/profile",
                     json={"phone": "not-a-phone"}, headers=headers, timeout=TIMEOUT)
        assert r.status_code in (400, 422), f"expected validation error, got {r.status_code} {r.text}"

    def test_track_event(self, http, resend_token):
        headers = {"Authorization": f"Bearer {resend_token}"}
        r = http.post(f"{BASE_URL}/api/track",
                      json={"event": "page_view", "path": "/problems"},
                      headers=headers, timeout=TIMEOUT)
        assert r.status_code in (200, 201, 204)


# ---------- Admin ----------
class TestAdmin:
    def test_admin_overview_admin_user(self, http, demo_token):
        r = http.get(f"{BASE_URL}/api/admin/overview",
                     headers={"Authorization": f"Bearer {demo_token}"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        # Expect summary data
        assert any(k in d for k in ("stats", "users", "notifications", "events", "totals"))

    def test_admin_overview_forbidden_for_non_admin(self, http, resend_token):
        r = http.get(f"{BASE_URL}/api/admin/overview",
                     headers={"Authorization": f"Bearer {resend_token}"}, timeout=TIMEOUT)
        assert r.status_code == 403


# ---------- Regression: run/submit ----------
class TestRunSubmit:
    def test_guest_run_two_sum(self, http):
        code = (
            "class Solution:\n"
            "    def twoSum(self, nums, target):\n"
            "        d = {}\n"
            "        for i,v in enumerate(nums):\n"
            "            if target-v in d: return [d[target-v], i]\n"
            "            d[v] = i\n"
        )
        r = http.post(f"{BASE_URL}/api/run",
                      json={"slug": "two-sum", "language": "python", "code": code},
                      timeout=60)
        assert r.status_code == 200, r.text

    def test_submit_requires_auth(self, http):
        r = http.post(f"{BASE_URL}/api/submit",
                      json={"slug": "two-sum", "language": "python", "code": "x=1"},
                      timeout=30)
        assert r.status_code in (401, 403)
