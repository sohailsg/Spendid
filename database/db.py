import sqlite3
import os
from werkzeug.security import generate_password_hash

DB_NAME = "expense_tracker.db"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), DB_NAME)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()


def seed_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] > 0:
        conn.close()
        return

    cur.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        ("Demo User", "demo@spendly.com", generate_password_hash("demo123"))
    )
    user_id = cur.lastrowid

    expenses = [
        (user_id, 45.50, "Food", "2026-06-01", "Grocery shopping"),
        (user_id, 25.00, "Transport", "2026-06-02", "Gas refill"),
        (user_id, 120.00, "Bills", "2026-06-03", "Electricity bill"),
        (user_id, 35.00, "Health", "2026-06-04", "Pharmacy visit"),
        (user_id, 15.00, "Entertainment", "2026-06-05", "Movie tickets"),
        (user_id, 89.99, "Shopping", "2026-06-06", "New shoes"),
        (user_id, 22.75, "Food", "2026-06-07", "Restaurant dinner"),
        (user_id, 50.00, "Other", "2026-06-08", "Miscellaneous"),
    ]
    cur.executemany(
        "INSERT INTO expenses (user_id, amount, category, date, description) VALUES (?, ?, ?, ?, ?)",
        expenses
    )

    conn.commit()
    conn.close()
