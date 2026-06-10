# Spec: Login and Logout

## Overview
Step 3 implements session-based authentication for Spendly. Users can sign in with their email and password, and sign out. This is the first step that introduces protected routes — future steps (profile, expenses) will build on the session established here.

## Depends on
- Step 2 (Registration) — users must exist in the database to log in.

## Routes
- `GET /login` — render login form — public
- `POST /login` — authenticate user with email/password, start session — public
- `GET /logout` — clear session, redirect to landing — logged-in

## Database changes
Add a `get_user_by_email(email)` helper in `database/db.py` to look up a user row by email for authentication. No schema changes.

## Templates
- **Create:** none
- **Modify:** `templates/base.html` — nav links change based on session: show "Sign in" / "Get started" when logged out, show username + "Sign out" when logged in

## Files to change
- `app.py` — add GET+POST handler to `/login`, implement `/logout`, import `session` from flask
- `database/db.py` — add `get_user_by_email(email)` function
- `templates/base.html` — conditional nav based on `session.user_id`

## Files to create
None

## New dependencies
No new dependencies.

## Rules for implementation
- No SQLAlchemy or ORMs
- Parameterised queries only
- Passwords hashed with werkzeug (use `check_password_hash` for login)
- Use CSS variables — never hardcode hex values
- All templates extend `base.html`
- Never store plaintext passwords in session
- Set `app.secret_key` from env var (already done)
- Use url_for() for every internal link — never hardcode paths
- On failed login show a generic flash error ("Invalid email or password.") — do    not reveal which field was wrong
- After successful login redirect to url_for("landing") until a dashboard route exists
- logout() must call session.clear() then redirect to url_for("landing")
- get_user_by_email belongs in database/db.py, not inline in the route

## Definition of done
- [ ] Register a new user, then log in with that user's credentials — redirected to landing page
- [ ] After login, nav bar shows the user's name and a "Sign out" link
- [ ] Clicking "Sign out" clears the session and redirects to landing — nav reverts to "Sign in" / "Get started"
- [ ] Logging in with wrong password shows error message on login page
- [ ] Submitting with an unregistered email shows the same generic error flash
- [ ] Visiting GET /logout clears the session and redirects to /
- [ ] After logout, session["user_id"] is no longer present
- [ ] The /logout route no longer returns the raw stub string
