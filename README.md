# 🚀 CodWP — Full-Stack DSA Practice Platform

> A modern LeetCode-style coding platform with **Brute Force → Better → Optimal** solution approach, admin-controlled problem management, MongoDB persistence, and a fully cached React frontend for instant navigation.

![CodWP Banner](https://img.shields.io/badge/CodWP-DSA%20Practice-orange?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

---

## 📖 Table of Contents

1. [Overview](#-overview)
2. [Tech Stack](#-tech-stack)
3. [Features](#-features)
4. [Project Structure](#-project-structure)
5. [Getting Started](#-getting-started)
6. [Environment Variables](#-environment-variables)
7. [Database Setup](#-database-setup)
8. [Backend API Reference](#-backend-api-reference)
9. [Admin Panel Guide](#-admin-panel-guide)
10. [Frontend Data Caching](#-frontend-data-caching)
11. [Problem Format](#-problem-format)
12. [Deployment](#-deployment)
13. [Troubleshooting](#-troubleshooting)
14. [Contributing](#-contributing)
15. [License](#-license)

---

## 🎯 Overview

**CodWP** is a full-stack coding interview preparation platform that lets you:
- **Practice DSA problems** fetched directly from LeetCode
- **Run code freely** as a guest (Python, Java, C++, JavaScript)
- **Submit against hidden tests** and track progress
- **Build daily streaks** with a smart daily challenge
- **Get personalized recommendations** based on solve history
- **Manage everything via Admin Panel** — add problems by LeetCode ID, promote users, sync data

Everything is **fully cached** in the frontend so page navigation feels **instant** (no more "data disappearing" between pages).

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite** | Build tool |
| **TailwindCSS** | Styling |
| **TanStack Query (React Query)** | Server state + caching |
| **React Router v6** | Routing |
| **Lucide React** | Icons |
| **Sonner** | Toast notifications |

### Backend
| Technology | Purpose |
|---|---|
| **Spring Boot 3.3** | REST API |
| **Spring Security + JWT** | Authentication & authorization |
| **MongoDB Atlas** | Database |
| **Spring Data MongoDB** | ODM |
| **Jackson** | JSON parsing |
| **JJWT 0.12.6** | JWT signing (HS512) |
| **Java 17** | Runtime |

### Infrastructure
- **Render** — Backend + Frontend hosting
- **MongoDB Atlas** — Cloud database
- **Cloudflare** — CDN & DDoS protection

---

## ✨ Features

### 👨‍💻 User Features
- ✅ **OAuth login** (Google, GitHub, LinkedIn)
- ✅ **Mobile OTP login** (Twilio Verify / demo mode)
- ✅ **Email + password** auth
- ✅ **Multi-language code editor** (Python, Java, C++, JavaScript)
- ✅ **Live code execution** with sandboxed runner
- ✅ **Progress tracking** — solved / attempted / todo
- ✅ **Submission heatmap** (GitHub-style)
- ✅ **Daily challenge** with streak & coins
- ✅ **Personalized recommendations**
- ✅ **Company-wise practice lists**
- ✅ **Profile customization** (avatar, bio, socials)

### 🔐 Admin Features
- ✅ **Add problems by LeetCode ID** (`1, 3, 5` or `1 3 5`)
- ✅ **Bulk fetch all problems** from LeetCode (3000+)
- ✅ **JSON → MongoDB sync**
- ✅ **User management** (promote / demote admin)
- ✅ **Live stats** (users, logins, submissions, page views)
- ✅ **Auto cache invalidation** on data changes
- ✅ **Notification logs** (welcome emails/SMS)
- ✅ **Recent activity tracking**

---

## 📁 Project Structure

```
codwp/
├── backend-java/
│   ├── src/main/java/com/codelab/
│   │   ├── CodelabApplication.java         # Entry point
│   │   ├── ApiController.java              # Public endpoints
│   │   ├── AuthController.java             # Auth endpoints
│   │   ├── AuthService.java                # Auth logic + JWT
│   │   ├── JwtService.java                 # JWT sign/parse
│   │   ├── JwtAuthFilter.java              # Filter per request
│   │   ├── SecurityConfig.java             # Spring Security config
│   │   ├── UserPrincipal.java              # Auth principal
│   │   ├── Problem.java                    # MongoDB entity
│   │   ├── ProblemMeta.java                # MongoDB entity
│   │   ├── ProblemRepository.java          # Spring Data repo
│   │   ├── ProblemMetaRepository.java
│   │   ├── LeetCodeAdminController.java    # Admin endpoints
│   │   ├── LeetCodeAdminService.java       # LeetCode GraphQL client
│   │   ├── CodeTemplates.java              # Boilerplate gen
│   │   ├── Executor.java                   # Sandboxed code runner
│   │   ├── DailyController.java            # Daily challenge
│   │   ├── MongoSeedRunner.java            # Auto-seed on boot
│   │   ├── Notifier.java                   # Email/SMS
│   │   └── AsyncConfig.java                # @Async executor
│   └── src/main/resources/
│       ├── application.properties
│       ├── problems.json                   # Seeded problems
│       ├── problems2.json
│       └── problems_meta.json
│
├── frontend/                               # React + Vite
│   ├── src/
│   │   ├── App.jsx                         # Root + QueryClientProvider
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useProblemsQuery.js         # ★ All TanStack hooks
│   │   ├── pages/
│   │   │   ├── ProblemsPage.jsx
│   │   │   ├── Workspace.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── CompaniesPage.jsx
│   │   │   ├── CompanyPage.jsx
│   │   │   ├── AdminPage.jsx
│   │   │   ├── AuthPage.jsx
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── DailyChallenge.jsx          # ★ Cached
│   │   │   ├── ForYou.jsx                  # ★ Cached
│   │   │   └── ...
│   │   └── lib/
│   │       ├── api.js
│   │       └── analytics.js
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Java 17+**
- **Node.js 18+** & npm
- **MongoDB Atlas** account (free tier works)
- **LeetCode access** (public API, no auth needed for basic)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/codwp.git
cd codwp
```

### 2. Backend Setup

```bash
cd backend-java

# Install dependencies
mvn clean install

# Configure environment (see Environment Variables section)

# Run locally
mvn spring-boot:run
```

Backend will start on **`http://localhost:8095`**.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will start on **`http://localhost:5173`**.

### 4. First Admin Setup

1. Register a new account with the email you set in `ADMIN_EMAIL` env var
2. Log in → you'll have `role: "ADMIN"`
3. Navigate to `/admin` → **Admin Panel** unlocked 🎉

---

## 🔐 Environment Variables

### Backend (`application.properties` or Render Env)

```properties
# Server
server.port=${JAVA_PORT:8095}
spring.data.mongodb.uri=${MONGO_URL}
spring.data.mongodb.database=${DB_NAME:codelab}

# JWT (min 64 chars for HS512)
JWT_SECRET=a623da0cb27a86d780a8d0a3dc64e1462b993dd5a20090472af2c883a39beaeb
JWT_EXPIRY_MS=604800000

# Admin bootstrap (this email becomes ADMIN on signup)
ADMIN_EMAIL=your-admin@example.com

# Optional: email/SMS
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_VERIFY_SERVICE_SID=

# Optional: OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Spring misc
server.error.include-message=always
spring.jackson.default-property-inclusion=always
spring.servlet.multipart.max-file-size=6MB
spring.servlet.multipart.max-request-size=7MB
```

### Frontend (`.env`)

```properties
VITE_API_URL=http://localhost:8095/api
VITE_POSTHOG_KEY=phc_your_key_here
```

---

## 🗄 Database Setup

### MongoDB Atlas (Free Tier)

1. Create free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create database: `codelab`
3. Create collections:
   - `problems`
   - `problem_meta`
   - `users`
   - `submissions`
   - `progress`
   - `events`
   - `notifications`
   - `daily`
   - `otp_codes`
   - `oauth_states`
   - `login_attempts`
4. Copy connection string → paste into `MONGO_URL`

### Collections Schema (Summary)

**`problems`**
```json
{
  "_id": 1,
  "slug": "two-sum",
  "title": "Two Sum",
  "difficulty": "Easy",
  "tags": ["Array", "Hash Table"],
  "acceptance": 53.2,
  "fn": "twoSum",
  "params": [
    { "name": "nums", "type": "int[]" },
    { "name": "target", "type": "int" }
  ],
  "ret": "int[]",
  "description": "<p>...</p>",
  "sampleTests": [
    { "input": "[2,7,11,15]\n9", "expected": "[0,1]" }
  ],
  "hiddenTests": [...],
  "editorial": { "approach": "...", "code": "..." }
}
```

**`users`**
```json
{
  "_id": "user_a7099badbf51",
  "email": "user@example.com",
  "role": "ADMIN",
  "password_hash": "$2a$10$...",
  "providers": ["email", "google"],
  "login_count": 12,
  "last_active_at": "2026-10-25T...",
  "daily_streak": 5,
  "coins": 120
}
```

---

## 📡 Backend API Reference

### Auth Endpoints (`/api/auth`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Email + password registration |
| `POST` | `/login` | Email + password login → JWT |
| `GET` | `/me` | Current user info |
| `GET` | `/providers` | Available login methods |
| `POST` | `/google` | Google OAuth session |
| `GET` | `/oauth/:provider/start` | OAuth redirect URL |
| `POST` | `/oauth/:provider/callback` | OAuth token exchange |
| `POST` | `/otp/send` | Send mobile OTP |
| `POST` | `/otp/verify` | Verify OTP → JWT |
| `POST` | `/admin/promote` | ⚠️ Admin only — promote/demote user |

### Public Endpoints (`/api`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/problems` | List all problems (with user status) |
| `GET` | `/problems/:slug` | Problem details + boilerplate |
| `POST` | `/run` | Run code against sample tests |
| `POST` | `/submit` | Submit against all tests |
| `GET` | `/daily` | Today's challenge |
| `GET` | `/recommendations` | Personalized pending + recommended |
| `GET` | `/companies` | Company list |
| `GET` | `/companies/:name` | Problems for a company |
| `GET` | `/profile` | User stats + heatmap |
| `GET` | `/submissions?slug=X` | Submission history |
| `GET` | `/admin/overview` | ⚠️ Admin only — dashboard stats |

### Admin Endpoints (`/api/admin/leetcode`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/add` | Add problems by ID (`{"numbers": "1 3 5"}`) |
| `POST` | `/fetch-all` | Sync ALL from LeetCode (background) |
| `POST` | `/migrate-json` | Seed MongoDB from local JSON files |

**All admin endpoints require:**
```
Authorization: Bearer <JWT with role=ADMIN>
```

---

## 🎛 Admin Panel Guide

### Access
1. Log in with `ADMIN_EMAIL` account
2. Navigate to **`/admin`**

### Actions

#### ➕ Add Problems
```
Input: "1 3 5" or "1,3,5"
Click "Add Problems"
Result: Problem fetched from LeetCode → saved to MongoDB + JSON
```

#### 🔄 Fetch All
```
Click "Fetch All"
Result: Background job fetches 3000+ problems (30-60 min)
Note: Only run once — use "Seed JSON → DB" for faster setup
```

#### 🗄 Seed JSON → DB
```
Click "Seed JSON → DB"
Result: Copies data/problems.json → MongoDB
Fast (30 sec), useful for initial setup
```

#### 👤 Promote User
```
Find user in table
Click "Make Admin" / "Remove Admin"
Result: User's role updated → they get/lose admin access
```

### Cache Invalidation (Automatic)
When you add a problem or sync data, the frontend **automatically** invalidates:
- `["problems"]` — ProblemsPage
- `["companies"]` — CompaniesPage
- `["recommendations"]` — ForYou component
- `["admin-overview"]` — Admin stats

**You don't need to refresh manually!** 🎉

---

## ⚡ Frontend Data Caching (TanStack Query)

### Configuration (`App.jsx`)

```jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min fresh
      gcTime: 15 * 60 * 1000,          // 15 min cache
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});
```

### Hooks (`src/hooks/useProblemsQuery.js`)

```jsx
useProblemsQuery()         // ProblemsPage
useCompaniesQuery()        // CompaniesPage
useCompanyQuery(name)      // CompanyPage
useProfileQuery()          // ProfilePage
useDailyChallengeQuery()   // DailyChallenge
useRecommendationsQuery()  // ForYou
```

### Behavior

| Action | Before Cache | After Cache |
|---|---|---|
| First load | 1-2s loading | 1-2s loading |
| Navigate away | — | — |
| **Return visit** | ❌ 1-2s again | ✅ **Instant** |
| Tab switch | Re-fetch | No re-fetch |
| Admin adds problem | Manual refresh | Auto-invalidate |

### Invalidating from a Component

```jsx
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();

// After mutation:
queryClient.invalidateQueries({ queryKey: ["problems"] });
```

---

## 📝 Problem Format

When adding a problem, it's saved in this format:

```json
{
  "id": 1,
  "slug": "two-sum",
  "title": "Two Sum",
  "difficulty": "Easy",
  "tags": ["Array", "Hash Table"],
  "acceptance": 53.2,
  "fn": "twoSum",
  "params": [
    { "name": "nums", "type": "int[]" },
    { "name": "target", "type": "int" }
  ],
  "ret": "int[]",
  "description": "<p>Given an array of integers...</p>",
  "constraints": [
    "2 <= nums.length <= 10^4"
  ],
  "sampleTests": [
    { "input": "[2,7,11,15]\n9", "expected": "[0,1]" },
    { "input": "[3,2,4]\n6", "expected": "[1,2]" }
  ],
  "hiddenTests": [...],
  "editorial": {
    "approach": "One-pass Hash Map...",
    "complexity": "Time O(n) · Space O(n)",
    "code": "class Solution: ..."
  }
}
```

### Supported Types
- `int`, `int[]`, `int[][]`
- `string`, `string[]`
- `bool`, `double`
- `TreeNode`, `ListNode` (coming soon)

---

## ☁️ Deployment

### Backend (Render)

1. Create **Web Service** → connect GitHub repo
2. Build Command: `cd backend-java && mvn clean package -DskipTests`
3. Start Command: `java -jar target/*.jar`
4. Add all **Environment Variables** (JWT_SECRET, MONGO_URL, ADMIN_EMAIL, etc.)

### Frontend (Render Static Site)

1. Create **Static Site** → connect GitHub repo
2. Build Command: `cd frontend && npm install && npm run build`
3. Publish Directory: `frontend/dist`
4. Add **Environment Variables** (VITE_API_URL, VITE_POSTHOG_KEY)

### MongoDB Atlas
- IP whitelist: `0.0.0.0/0` (for Render)
- Create user with read/write access

---

## 🔧 Troubleshooting

### ❌ "Invalid JWT signature"

**Cause**: `JWT_SECRET` mismatch or too short
**Fix**: Use the same 64+ char secret everywhere. Restart backend. Log out and back in.

### ❌ "403 Forbidden" on admin endpoints

**Cause**: User doesn't have `role: "ADMIN"` in MongoDB
**Fix**:
1. Set `ADMIN_EMAIL=you@example.com` env var on backend
2. Log out and log in again with that email
3. Verify `role` in MongoDB: `db.users.findOne({ email: "you@example.com" })`

### ❌ "Cannot query field 'acceptanceRate' on type 'QuestionNode'"

**Cause**: LeetCode GraphQL field name mismatch in search query
**Fix**: Use `acRate` in search results, `acceptanceRate` in list results. The current code handles this.

### ❌ "No slug for #X"

**Cause**: LeetCode GraphQL couldn't find the problem
**Fix**:
1. Verify the problem exists at `https://leetcode.com/problemset/all/?search=X`
2. Try adding a different problem number
3. Check backend logs for GraphQL error details

### ❌ Frontend "data disappearing" between pages

**Cause**: TanStack Query not configured
**Fix**: Ensure `QueryClientProvider` wraps the app in `App.jsx`, and pages use `useProblemsQuery()` etc.

### ❌ "Problem added but doesn't show in UI"

**Cause**: Cache not invalidated
**Fix**: Admin action automatically invalidates cache. If still not showing, hard refresh (`Ctrl+Shift+R`).

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- **Java**: 4-space indent, standard Spring Boot conventions
- **JavaScript/JSX**: 2-space indent, functional components, hooks
- **CSS**: Tailwind utility classes only

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` file for details.

---

## 🙏 Acknowledgements

- [LeetCode](https://leetcode.com) for problem data via GraphQL
- [TanStack Query](https://tanstack.com/query) for excellent caching
- [Spring Boot](https://spring.io/projects/spring-boot) for backend framework
- [Render](https://render.com) for free hosting
- [MongoDB Atlas](https://www.mongodb.com/atlas) for free database

---

## 📬 Contact

**Project Maintainer**: Abhishek Brahmbhat  
**Email**: brambhattabhishek@gmail.com  
**LinkedIn**: [linkedin.com/in/abhishek-brahmbhat](https://www.linkedin.com/in/abhishek-brahmbhat)  
**GitHub**: [github.com/AbhishekBrahmbhat](https://github.com/AbhishekBrahmbhat)

---

<div align="center">

**Built with ❤️ for coding interview preparation**

⭐ If this project helped you, please give it a star! ⭐

</div>
