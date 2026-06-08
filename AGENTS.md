# AGENTS.md

## Project

Spendly — a Flask expense tracker. Single-module Flask app (`app.py`) with Jinja templates in `templates/`, static assets in `static/`, and a `database/` package for SQLite access. This is a **step-by-step student/learning project** — many routes in `app.py` are intentional placeholders that return `"... — coming in Step N"`. Do not "fix" them by implementing ahead of the relevant step; match the step in the comment header above each placeholder block.

## Run

- Python 3.14, virtualenv at `venv/` (already created, pointed at `C:\Python314`).
- Activate: `venv\Scripts\Activate.ps1` (PowerShell) or `venv\Scripts\activate` (cmd).
- Install deps if needed: `pip install -r requirements.txt`.
- Dev server: `python app.py` — listens on **`http://127.0.0.1:5001`** (custom port, not Flask's default 5000). `debug=True` is on.
- SQLite DB file `expense_tracker.db` is created at repo root and is git-ignored.

## Layout

- `app.py` — Flask routes, app factory-style single file. `app = Flask(__name__)`.
- `database/db.py` — **stub, students implement**: must expose `get_db()`, `init_db()`, `seed_db()`. `get_db()` should set `row_factory` to `sqlite3.Row` and enable foreign keys (`PRAGMA foreign_keys = ON`). `init_db()` uses `CREATE TABLE IF NOT EXISTS`.
- `database/__init__.py` — empty package marker.
- `templates/base.html` — shared layout (nav + footer + block `content`, `head`, `scripts`); brand name is **Spendly**.
- `templates/login.html` — already references a `{% if error %}` block, so the login POST handler must pass `error=` to the template.
- `static/css/style.css`, `static/css/landing.css`, `static/js/main.js` — styling and the landing-page "how it works" modal logic (data-attribute driven, no framework).

## Tests

`pytest` and `pytest-flask` are in `requirements.txt`, but **no tests exist yet** (`tests/`, `conftest.py`, `pytest.ini`, `pyproject.toml` are all absent). When adding tests: import `app` from `app.py` and use `pytest-flask`'s `client` fixture, or build a fixture that yields `app.test_client()`. Use a temp DB path, not the real `expense_tracker.db`.

## Conventions

- No README, no CI, no linter/formatter/typechecker configured — do not invent one unless asked.
- Keep changes minimal and matching the existing `app.py` style (route functions, simple `render_template`).
- Don't commit `venv/`, `expense_tracker.db`, `__pycache__/`, `.env`, or `.claude/plans/` (already in `.gitignore`).
