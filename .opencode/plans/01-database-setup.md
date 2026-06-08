# Plan: 01-database-setup

## Goal

Replace the stub in `database/db.py` with a working SQLite implementation and wire it into `app.py` so the database is initialized and seeded on startup.

---

## Files to Change

| File | Action |
|------|--------|
| `database/db.py` | Full rewrite — implement `get_db()`, `init_db()`, `seed_db()` |
| `app.py` | Add imports + startup calls in `app_context()` |

No new files needed.

---

## Step 1: Implement `database/db.py`

### Imports

- `sqlite3` (standard library)
- `os` (to build DB path relative to project root)
- `werkzeug.security.generate_password_hash` (already installed via Flask)

### `get_db()`

- Connect to `expense_tracker.db` in the project root directory
- Set `row_factory = sqlite3.Row` (dictionary-like row access)
- Execute `PRAGMA foreign_keys = ON` on the connection
- Return the connection

### `init_db()`

- Obtain connection via `get_db()`
- Create a cursor
- Execute `CREATE TABLE IF NOT EXISTS` for both tables:

**users table:**
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**expenses table:**
```sql
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

- Commit and close cursor/connection

### `seed_db()`

- Obtain connection via `get_db()`
- Check if `users` table already has rows — if yes, return early (no duplication)
- Insert one demo user:
  - name: `Demo User`
  - email: `demo@spendly.com`
  - password: `demo123` hashed via `generate_password_hash()`
- Insert 8 sample expenses linked to the demo user:

| # | Category | Amount | Date | Description |
|---|----------|--------|------|-------------|
| 1 | Food | 45.50 | 2026-06-01 | Grocery shopping |
| 2 | Transport | 25.00 | 2026-06-02 | Gas refill |
| 3 | Bills | 120.00 | 2026-06-03 | Electricity bill |
| 4 | Health | 35.00 | 2026-06-04 | Pharmacy visit |
| 5 | Entertainment | 15.00 | 2026-06-05 | Movie tickets |
| 6 | Shopping | 89.99 | 2026-06-06 | New shoes |
| 7 | Food | 22.75 | 2026-06-07 | Restaurant dinner |
| 8 | Other | 50.00 | 2026-06-08 | Miscellaneous |

- Use **parameterized queries only** (no string formatting in SQL)
- Commit and close connection

---

## Step 2: Update `app.py`

### New imports (top of file)

```python
from database.db import get_db, init_db, seed_db
```

### Startup block

Add before `if __name__ == "__main__":`:

```python
with app.app_context():
    init_db()
    seed_db()
```

This ensures the database is ready before any routes are served.

---

## Rules / Constraints

- No ORMs — raw `sqlite3` only
- Parameterized queries only — never format strings into SQL
- `PRAGMA foreign_keys = ON` on every connection
- `amount` stored as `REAL` (float)
- Passwords hashed with `werkzeug.security.generate_password_hash`
- Dates in YYYY-MM-DD format
- `seed_db()` must be idempotent (safe to call multiple times)

---

## Definition of Done

- [ ] `expense_tracker.db` file is created on app startup
- [ ] `users` table exists with correct schema and constraints
- [ ] `expenses` table exists with correct schema and FK to `users`
- [ ] Demo user exists with hashed password (not plaintext)
- [ ] 8 sample expenses across all categories
- [ ] No duplicate seed data on repeated runs
- [ ] App starts without errors on port 5001
- [ ] All queries use parameterized SQL
- [ ] Foreign key enforcement works (invalid `user_id` rejected)
