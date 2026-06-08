import random
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from database.db import get_db

user_id = 2
count = 5
months = 3

conn = get_db()
cur = conn.cursor()

try:
    cur.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not cur.fetchone():
        print(f"No user found with id {user_id}.")
        sys.exit(1)

    categories = {
        "Food":          {"range": (50, 800),  "weight": 30, "descs": [
            "Grocery shopping", "Tea and snacks at chai stall", "Lunch at dhaba",
            "Vegetables from sabzi mandi", "Morning idli and dosa", "Office lunch",
            "Weekend biryani order", "Momos from street vendor", "Fruit basket"
        ]},
        "Transport":     {"range": (20, 500),  "weight": 20, "descs": [
            "Auto ride to office", "Ola cab to railway station", "Metro pass recharge",
            "Petrol refill", "Bus pass monthly", "Ride to airport"
        ]},
        "Bills":         {"range": (200, 3000), "weight": 15, "descs": [
            "Electricity bill payment", "Water bill", "Internet broadband bill",
            "Mobile recharge", "Gas cylinder refill", "Society maintenance"
        ]},
        "Health":        {"range": (100, 2000), "weight": 10, "descs": [
            "Pharmacy medicine purchase", "Doctor consultation fee", "Gym monthly",
            "Health checkup", "Vitamin supplements", "Lab test"
        ]},
        "Entertainment": {"range": (100, 1500), "weight": 10, "descs": [
            "Movie tickets", "Netflix subscription", "Cricket match tickets",
            "Concert tickets", "Stand-up comedy show", "Amusement park"
        ]},
        "Shopping":      {"range": (200, 5000), "weight": 10, "descs": [
            "New shoes from Bata", "Shirt from Reliance Trends", "Kitchen utensils",
            "Festival shopping", "Books from Flipkart", "Electronics from Croma"
        ]},
        "Other":         {"range": (50, 1000),  "weight": 5,  "descs": [
            "Miscellaneous household", "Gift for friend", "Donation",
            "Pet food", "Courier charges", "Stationery items"
        ]},
    }

    cat_names = list(categories.keys())
    weights = [categories[c]["weight"] for c in cat_names]

    today = datetime.now().date()
    start_date = today - timedelta(days=months * 30)

    rows = []
    for _ in range(count):
        cat = random.choices(cat_names, weights=weights, k=1)[0]
        lo, hi = categories[cat]["range"]
        amount = round(random.uniform(lo, hi), 2)
        day_offset = random.randint(0, months * 30)
        dt = start_date + timedelta(days=day_offset)
        desc = random.choice(categories[cat]["descs"])
        rows.append((user_id, amount, cat, dt.isoformat(), desc))

    cur.execute("BEGIN")
    cur.executemany(
        "INSERT INTO expenses (user_id, amount, category, date, description) VALUES (?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()

    print(f"Inserted {len(rows)} expenses for user_id {user_id}.")

    cur.execute("SELECT MIN(date), MAX(date) FROM expenses WHERE user_id = ?", (user_id,))
    min_date, max_date = cur.fetchone()
    print(f"Date range: {min_date} to {max_date}")

    cur.execute(
        "SELECT id, user_id, amount, category, date, description FROM expenses WHERE user_id = ? ORDER BY RANDOM() LIMIT 5",
        (user_id,),
    )
    samples = cur.fetchall()
    print("\nSample (5 random rows):")
    for r in samples:
        print(f"  id={r['id']} | Rs.{r['amount']:.2f} | {r['category']} | {r['date']} | {r['description']}")

except Exception as e:
    conn.rollback()
    print(f"Error — rolled back: {e}")
finally:
    conn.close()
