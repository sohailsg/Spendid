import sqlite3
from datetime import datetime
from database.db import get_db


def get_user_by_id(user_id):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT name, email, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            return None
        member_since = row["created_at"]
        if member_since:
            dt = datetime.strptime(member_since, "%Y-%m-%d %H:%M:%S")
            member_since = dt.strftime("%B %Y")
        return {"name": row["name"], "email": row["email"], "member_since": member_since}
    finally:
        conn.close()


def get_summary_stats(user_id):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total_spent, "
            "COUNT(*) AS transaction_count "
            "FROM expenses WHERE user_id = ?",
            (user_id,),
        ).fetchone()

        total_spent = round(float(row["total_spent"]), 2)
        transaction_count = row["transaction_count"]

        if transaction_count == 0:
            return {"total_spent": 0.0, "transaction_count": 0, "top_category": "—"}

        top = conn.execute(
            "SELECT category FROM expenses WHERE user_id = ? "
            "GROUP BY category ORDER BY SUM(amount) DESC LIMIT 1",
            (user_id,),
        ).fetchone()

        return {
            "total_spent": total_spent,
            "transaction_count": transaction_count,
            "top_category": top["category"] if top else "—",
        }
    finally:
        conn.close()


def get_recent_transactions(user_id, limit=10):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT date, description, category, amount "
            "FROM expenses WHERE user_id = ? "
            "ORDER BY date DESC, created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [
            {
                "date": row["date"],
                "description": row["description"],
                "category": row["category"],
                "amount": float(row["amount"]),
            }
            for row in rows
        ]
    finally:
        conn.close()


def get_category_breakdown(user_id):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT category AS name, SUM(amount) AS total "
            "FROM expenses WHERE user_id = ? "
            "GROUP BY category ORDER BY total DESC",
            (user_id,),
        ).fetchall()

        if not rows:
            return []

        total_sum = sum(row["total"] for row in rows)
        categories = []
        for row in rows:
            total = round(row["total"], 2)
            percentage = round(row["total"] / total_sum * 100) if total_sum else 0
            categories.append({"name": row["name"], "total": total, "percentage": percentage})

        rounded_sum = sum(c["percentage"] for c in categories)
        diff = 100 - rounded_sum
        categories[0]["percentage"] += diff

        return categories
    finally:
        conn.close()
