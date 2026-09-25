# Spendly

A personal expense tracker built with Flask.

## Setup

```bash
python -m venv venv
venv\Scripts\Activate.ps1   # PowerShell
pip install -r requirements.txt
python app.py
```

The dev server runs at **http://127.0.0.1:5001**.

## Project structure

| Path | Purpose |
|---|---|
| `app.py` | Flask routes |
| `database/db.py` | Database init, seed, and user helpers |
| `database/queries.py` | Query helpers for profile/dashboard data |
| `templates/` | Jinja2 templates |
| `static/` | CSS, JS, and images |

## Tech stack

- **Python 3.14** + **Flask**
- **SQLite** (via `sqlite3`)
- **Jinja2** templates
- **Vanilla CSS/JS** (no frameworks)
