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


# ---------- Iteration 4: Profile avatar + socials/about ----------
def _tiny_png_bytes():
    import struct, zlib
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    def ch(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    idat = zlib.compress(b'\x00\xff\x00\x00')
    return sig + ch(b'IHDR', ihdr) + ch(b'IDAT', idat) + ch(b'IEND', b'')


class TestProfileAvatarSocials:
    def test_avatar_upload_get_remove(self, http, resend_token):
        headers = {"Authorization": f"Bearer {resend_token}"}
        files = {"file": ("a.png", _tiny_png_bytes(), "image/png")}
        r = requests.post(f"{BASE_URL}/api/profile/avatar", headers=headers, files=files, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        pic = r.json().get("picture")
        assert pic and pic.startswith("/api/avatars/")
        file_id = pic.split("/")[-1]
        # GET the image
        g = requests.get(f"{BASE_URL}/api/avatars/{file_id}", timeout=TIMEOUT)
        assert g.status_code == 200
        assert "image/" in g.headers.get("content-type", "")
        # Remove
        rem = http.delete(f"{BASE_URL}/api/profile/avatar", headers=headers, timeout=TIMEOUT)
        assert rem.status_code == 200
        assert rem.json().get("picture") in (None, "")

    def test_avatar_rejects_non_image(self, resend_token):
        headers = {"Authorization": f"Bearer {resend_token}"}
        files = {"file": ("a.txt", b"hello", "text/plain")}
        r = requests.post(f"{BASE_URL}/api/profile/avatar", headers=headers, files=files, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_avatar_rejects_too_large(self, resend_token):
        headers = {"Authorization": f"Bearer {resend_token}"}
        big = b"\x89PNG\r\n\x1a\n" + b"0" * (3 * 1024 * 1024 + 100)
        files = {"file": ("big.png", big, "image/png")}
        r = requests.post(f"{BASE_URL}/api/profile/avatar", headers=headers, files=files, timeout=TIMEOUT)
        assert r.status_code in (400, 413)  # 413 from Spring's multipart limit, 400 from our check

    def test_socials_about_reminder_persist(self, http, resend_token):
        headers = {"Authorization": f"Bearer {resend_token}"}
        payload = {
            "about": "Pytest about text",
            "daily_reminder": True,
            "socials": {
                "github": "https://github.com/pytestuser",
                "linkedin": "https://www.linkedin.com/in/pytest",
                "twitter": "https://x.com/pytest",
                "website": "https://example.com",
            },
        }
        r = http.put(f"{BASE_URL}/api/profile", json=payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        me = http.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=TIMEOUT).json()
        assert me.get("about") == "Pytest about text"
        assert me.get("daily_reminder") is True
        assert me["socials"]["github"] == "https://github.com/pytestuser"
        assert me["socials"]["twitter"] == "https://x.com/pytest"
        assert me["socials"]["website"] == "https://example.com"

    def test_socials_rejects_wrong_host(self, http, resend_token):
        headers = {"Authorization": f"Bearer {resend_token}"}
        r = http.put(f"{BASE_URL}/api/profile",
                     json={"socials": {"github": "https://evil.com/x"}},
                     headers=headers, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "github" in (r.json().get("message") or "").lower()

    def test_socials_rejects_non_https(self, http, resend_token):
        headers = {"Authorization": f"Bearer {resend_token}"}
        r = http.put(f"{BASE_URL}/api/profile",
                     json={"socials": {"github": "http://github.com/x"}},
                     headers=headers, timeout=TIMEOUT)
        assert r.status_code == 400


# ---------- Iteration 4: Daily challenge ----------
class TestDaily:
    def test_daily_guest(self, http):
        r = http.get(f"{BASE_URL}/api/daily", timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert d.get("problem") and d["problem"].get("slug")
        assert d.get("reason")
        # guest should not get streak/coins fields
        assert "streak" not in d

    def test_daily_logged_in(self, http, demo_token):
        r = http.get(f"{BASE_URL}/api/daily",
                     headers={"Authorization": f"Bearer {demo_token}"}, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        for k in ("streak", "coins", "badges", "reminder", "completed", "problem", "reason"):
            assert k in d, f"missing {k}"

    def test_fresh_user_daily_submit_rewards(self, http):
        """Register a fresh user, fetch their daily, submit editorial, verify reward."""
        email = f"daily_{uuid.uuid4().hex[:8]}@algoforge.dev"
        reg = http.post(f"{BASE_URL}/api/auth/register",
                        json={"name": "Daily T", "email": email, "password": "testing123"},
                        timeout=TIMEOUT)
        assert reg.status_code == 200
        tok = reg.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}
        daily = http.get(f"{BASE_URL}/api/daily", headers=headers, timeout=TIMEOUT).json()
        slug = daily["problem"]["slug"]
        assert daily["completed"] is False
        detail = http.get(f"{BASE_URL}/api/problems/{slug}", timeout=TIMEOUT).json()
        code = detail["editorial"]["code"]
        sub = http.post(f"{BASE_URL}/api/submit",
                        json={"slug": slug, "language": "python", "code": code},
                        headers=headers, timeout=60)
        assert sub.status_code == 200, sub.text
        sd = sub.json()
        assert sd["status"] == "Accepted", sd
        assert sd.get("daily") is not None
        assert sd["daily"]["streak"] == 1
        assert sd["daily"]["coins_earned"] == 10
        after = http.get(f"{BASE_URL}/api/daily", headers=headers, timeout=TIMEOUT).json()
        assert after["completed"] is True
        assert after["streak"] == 1
        assert after["coins"] == 10


# ---------- Iteration 4: Companies ----------
class TestCompanies:
    def test_companies_list_guest(self, http):
        r = http.get(f"{BASE_URL}/api/companies", timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list) and len(d) >= 5
        names = [c["name"] for c in d]
        assert "Google" in names
        for c in d:
            assert set(c.keys()) >= {"name", "count", "solved"}
            assert c["solved"] == 0  # guest -> no solved

    def test_companies_list_authed_shows_solved(self, http, demo_token):
        r = http.get(f"{BASE_URL}/api/companies",
                     headers={"Authorization": f"Bearer {demo_token}"}, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        google = next(c for c in d if c["name"] == "Google")
        assert google["solved"] == google["count"]  # demo solved all

    def test_company_detail(self, http, demo_token):
        r = http.get(f"{BASE_URL}/api/companies/Google",
                     headers={"Authorization": f"Bearer {demo_token}"}, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "Google"
        assert d["total"] == len(d["problems"])
        assert d["solved"] == d["total"]
        assert "byDifficulty" in d
        for p in d["problems"]:
            assert "status" in p
            assert "slug" in p

    def test_company_unknown_404(self, http):
        r = http.get(f"{BASE_URL}/api/companies/NotARealCo_zzz", timeout=TIMEOUT)
        assert r.status_code == 404


# ---------- Iteration 4: Admin daily-reminders ----------
class TestDailyReminders:
    def test_admin_run_reminders(self, http, demo_token):
        r = http.post(f"{BASE_URL}/api/admin/daily-reminders/run",
                      headers={"Authorization": f"Bearer {demo_token}"}, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "sent" in d
        assert isinstance(d["sent"], int)

    def test_run_reminders_requires_admin(self, http, resend_token):
        r = http.post(f"{BASE_URL}/api/admin/daily-reminders/run",
                      headers={"Authorization": f"Bearer {resend_token}"}, timeout=TIMEOUT)
        assert r.status_code == 403

    def test_run_reminders_unauthenticated(self, http):
        r = http.post(f"{BASE_URL}/api/admin/daily-reminders/run", timeout=TIMEOUT)
        assert r.status_code in (401, 403)
