import os
import sqlite3
from flask import Flask, render_template, request, redirect, url_for, flash, session
from database.db import init_db, seed_db, create_user, get_user_by_email
from werkzeug.security import check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")


# ------------------------------------------------------------------ #
# Routes                                                              #
# ------------------------------------------------------------------ #

@app.route("/")
def landing():
    return render_template("landing.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if session.get("user_id"):
        return redirect(url_for("landing"))

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        if not name or not email or not password:
            return render_template("register.html", error="All fields are required")

        if len(password) < 8:
            return render_template("register.html", error="Password must be at least 8 characters")

        if password != confirm_password:
            return render_template("register.html", error="Passwords do not match")

        try:
            create_user(name, email, password)
        except sqlite3.IntegrityError:
            return render_template("register.html", error="Email already registered")

        flash("Account created! Please sign in.")
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        return redirect(url_for("profile"))

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        user = get_user_by_email(email)
        if user and check_password_hash(user["password_hash"], password):
            session["user_id"] = user["id"]
            session["user_name"] = user["name"]
            flash("Welcome back!")
            return redirect(url_for("profile"))

        return render_template("login.html", error="Invalid email or password.")

    return render_template("login.html")


@app.route("/terms")
def terms():
    return render_template("terms.html")


@app.route("/privacy")
def privacy():
    return render_template("privacy.html")


# ------------------------------------------------------------------ #
# Placeholder routes — students will implement these                  #
# ------------------------------------------------------------------ #

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("landing"))


@app.route("/profile")
def profile():
    if not session.get("user_id"):
        return redirect(url_for("login"))

    user = {
        "name": session.get("user_name", "Demo User"),
        "email": "demo@spendly.com",
        "member_since": "June 2026",
    }

    stats = {
        "total_spent": 417.24,
        "transaction_count": 8,
        "top_category": "Bills",
    }

    transactions = [
        {"date": "2026-06-08", "description": "Miscellaneous", "category": "Other", "amount": 50.00},
        {"date": "2026-06-07", "description": "Restaurant dinner", "category": "Food", "amount": 22.75},
        {"date": "2026-06-06", "description": "New shoes", "category": "Shopping", "amount": 89.99},
        {"date": "2026-06-05", "description": "Movie tickets", "category": "Entertainment", "amount": 15.00},
        {"date": "2026-06-04", "description": "Pharmacy visit", "category": "Health", "amount": 35.00},
        {"date": "2026-06-03", "description": "Electricity bill", "category": "Bills", "amount": 120.00},
        {"date": "2026-06-02", "description": "Gas refill", "category": "Transport", "amount": 25.00},
        {"date": "2026-06-01", "description": "Grocery shopping", "category": "Food", "amount": 45.50},
    ]

    categories = [
        {"name": "Bills", "total": 120.00, "percentage": 29},
        {"name": "Shopping", "total": 89.99, "percentage": 22},
        {"name": "Food", "total": 68.25, "percentage": 16},
        {"name": "Other", "total": 50.00, "percentage": 12},
        {"name": "Health", "total": 35.00, "percentage": 8},
        {"name": "Transport", "total": 25.00, "percentage": 6},
        {"name": "Entertainment", "total": 15.00, "percentage": 4},
    ]

    return render_template(
        "profile.html",
        user=user,
        stats=stats,
        transactions=transactions,
        categories=categories,
    )


@app.route("/expenses/add")
def add_expense():
    return "Add expense — coming in Step 7"


@app.route("/expenses/<int:id>/edit")
def edit_expense(id):
    return "Edit expense — coming in Step 8"


@app.route("/expenses/<int:id>/delete")
def delete_expense(id):
    return "Delete expense — coming in Step 9"


with app.app_context():
    init_db()
    seed_db()

if __name__ == "__main__":
    app.run(debug=True, port=5001)
