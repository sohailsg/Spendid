# Spec: Registration

## Overview
Implement the user registration flow so new visitors can create a Spendly account. The `/register` route already renders `register.html` with a POST form, but the POST handler is missing. This step wires up form validation, password hashing, duplicate-email detection, and inserts the new user into the `users` table.

## Depends on
Step 1 (Landing page) — the landing page and base layout must already exist.

## Routes
- `POST /register` — validate form, hash password, insert user, redirect to login — public

No new GET routes (the GET `/register` already exists).

## Database changes
No database changes. The `users` table already has all required columns:
- `id`, `name`, `email` (UNIQUE), `password_hash`, `created_at`

## Templates
- **Modify:** `templates/register.html` — the template already exists with the correct form fields (`name`, `email`, `password`) and an `{% if error %}` block. No structural changes needed unless adding server-side validation feedback.

## Files to change
- `app.py` — add POST handler to the existing `/register` route, import `session` and `redirect`/`url_for`

## Files to create
None.

## New dependencies
No new dependencies. `werkzeug.security.generate_password_hash` is already imported in `database/db.py`.

## Rules for implementation
- No SQLAlchemy or ORMs — raw sqlite3 only
- Parameterised queries only — no string formatting in SQL
- Passwords hashed with `werkzeug.security.generate_password_hash`
- Use CSS variables — never hardcode hex values
- All templates extend `base.html`
- Reuse `get_db()` from `database/db.py` for all database access
- Validate that name, email, and password are all non-empty
- Validate minimum password length (8 characters)
- Check for duplicate email before inserting — show friendly error if taken
- On successful registration, redirect to `/login` (not auto-login)
- Do not implement login/logout yet — that is Step 3

## Definition of done
- [ ] Visiting `/register` shows the registration form
- [ ] Submitting the form with valid data inserts a new user and redirects to `/login`
- [ ] Submitting with a duplicate email shows an error message
- [ ] Submitting with a password shorter than 8 characters shows an error message
- [ ] Submitting with empty fields shows an error message
- [ ] The password is stored as a hash, not plaintext, in the `users` table
- [ ] The new user can be found in the database with the correct name, email, and hashed password
