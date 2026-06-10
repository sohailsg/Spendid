import random
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import get_db, generate_password_hash

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Pranav", "Dhruv",
    "Krishna", "Shaurya", "Aadhya", "Ananya", "Diya", "Ishita", "Myra", "Sara",
    "Priya", "Neha", "Riya", "Kavya", "Rahul", "Amit", "Vikram", "Suresh",
    "Rajesh", "Manish", "Deepak", "Sanjay", "Anil", "Ravi", "Sunita", "Laxmi",
    "Anita", "Kavita", "Shweta", "Pooja", "Nisha", "Divya", "Meera", "Lakshmi",
]

LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Kumar", "Singh", "Reddy", "Patel", "Joshi",
    "Das", "Banerjee", "Mukherjee", "Iyer", "Nair", "Menon", "Rao", "Naidu",
    "Acharya", "Deshmukh", "Kulkarni", "Pillai", "Bose", "Sen", "Choudhury",
    "Mishra", "Pandey", "Tiwari", "Dubey", "Trivedi", "Saxena", "Mathur",
]

DOMAINS = ["gmail.com", "yahoo.co.in", "rediffmail.com", "outlook.com"]

def generate_user():
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    name = f"{first} {last}"
    suffix = random.randint(10, 999)
    email = f"{first.lower()}.{last.lower()}{suffix}@{random.choice(DOMAINS)}"
    return name, email

def main():
    conn = get_db()
    cur = conn.cursor()

    name, email = generate_user()
    while cur.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        name, email = generate_user()

    pw_hash = generate_password_hash("password123")
    cur.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        (name, email, pw_hash)
    )
    conn.commit()

    user_id = cur.lastrowid
    print(f"id={user_id}, name={name}, email={email}")

    conn.close()

if __name__ == "__main__":
    main()
