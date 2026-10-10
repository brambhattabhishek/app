# AlgoForge — LeetCode-style coding platform

## Original problem statement
Build a LeetCode-like website with a Java backend and a React frontend. Problems are listed the way LeetCode does it. Opening a problem shows the description on the left (plus Editorial and Submissions tabs) and the code editor on the right, with default boilerplate for each language. Under the editor there is a console with Testcase, Test Result and Console logs tabs. Users must log in to submit solutions; login options are Google, GitHub, mobile OTP and email/password. The profile shows the user's analytics. Guests can view problems, write code and run tests, but cannot submit and have no profile.

## User choices
Java Spring Boot + MongoDB; code runs locally on the server (Python, Java, C++, JavaScript); email/password + Google login now, GitHub and OTP later; 16 problems; dark and light themes with a toggle.

## Architecture
- /app/backend-java: Spring Boot 3.3 (Java 17). ApiController (problems, run, submit, submissions, profile), AuthController (register, login, me, google), Executor (runs code in a temp folder with time limits), CodeTemplates (boilerplate and drivers generated from each problem's signature), problems.json seeded into MongoDB.
- /app/backend/server.py: FastAPI proxy. It starts the jar on 127.0.0.1:8095 and forwards /api/*. It is needed because supervisor only runs uvicorn on port 8001.
- Frontend: React, Monaco editor, resizable panels, next-themes, shadcn.
- Auth: JWT Bearer token (7 days) stored in localStorage. Google uses Emergent OAuth; the backend exchanges the session_id for its own JWT.

## Implemented (2026-06)
- Problem list with stats, search, difficulty/status/tag filters and a random-problem button
- Workspace: description, examples, constraints, editorial, submission history (click a submission to load its code)
- Run as a guest: custom testcases, expected output computed by the reference solution, stdout and error capture
- Submit when logged in: sample plus hidden tests, verdicts (Accepted, Wrong Answer, Runtime Error, Compile Error, TLE)
- Profile: solved ring, difficulty bars, 52-week heatmap, streak, acceptance rate, languages, recent submissions
- Rebuild after Java changes: cd /app/backend-java && mvn package -DskipTests && pkill -f codelab.jar && sudo supervisorctl restart backend

## Iteration 2 (2026-06)
- 40 problems with real company tags (multiple per problem; none shown when empty), hints, edge cases, "Understand the problem"; company filter
- Users store phone, bio, location, interests, providers, login_count, last_login/last_active, last_ip/UA; profile edit dialog; admin page /admin (ADMIN_EMAILS)
- Login: Google (preview iframe fix: opens in a new tab, syncs across tabs), GitHub + LinkedIn OAuth (code flow, server-side state) - activate when keys are added to backend/.env; Mobile OTP via Twilio Verify, or DEMO mode (code shown on screen) until keys are set
- Welcome email/SMS for new users, "welcome back" after 7+ days inactive, nothing for active users (Notifier.java). Email = Emergent-managed (live). SMS = MOCKED until Twilio keys are set
- Tracking: /api/track page_view + login events in Mongo; GA4 via REACT_APP_GA_ID; AdSense slot via REACT_APP_ADSENSE_CLIENT/SLOT (placeholder for now)
- For You: "Continue where you left off" (opened/attempted, not solved) + "Recommended for you" (most-solved tags + interests)
- JDK copied to /root/jdk17 (persists across restarts); server.py downloads Temurin 17 if it's missing

## Backlog
- P0: Add keys: GITHUB_*, LINKEDIN_*, TWILIO_*, REACT_APP_GA_ID, REACT_APP_ADSENSE_*. OAuth redirect URIs must use the current domain (code-arena-42.preview.emergentagent.com)
- P1: Discussion tab, daily challenge, admin panel to add problems, sandboxing (docker/nsjail), memory stats
- P2: Leaderboard, contests, linked list/tree problem types
