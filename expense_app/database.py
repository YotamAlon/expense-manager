import sqlite3
import os
import fnmatch
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.environ.get("EXPENSE_DB_PATH", os.path.join(os.path.dirname(__file__), "expenses.db"))


def set_db_path(path: str):
    global DB_PATH
    DB_PATH = path


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Transactions table with tracking and installment columns
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            business_name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            batch_id TEXT,
            source_file TEXT,
            source_row_id INTEGER,
            file_hash TEXT,
            tx_signature TEXT,
            is_installment INTEGER DEFAULT 0,
            current_installment INTEGER DEFAULT 1,
            total_installments INTEGER DEFAULT 1,
            original_date TEXT,
            total_amount REAL,
            installment_plan_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Safe migration: ensure new tracking and installment columns exist if table was created previously
    existing_cols = [r["name"] for r in cursor.execute("PRAGMA table_info(transactions)").fetchall()]
    new_cols = {
        "source_file": "TEXT",
        "source_row_id": "INTEGER",
        "file_hash": "TEXT",
        "tx_signature": "TEXT",
        "is_installment": "INTEGER DEFAULT 0",
        "current_installment": "INTEGER DEFAULT 1",
        "total_installments": "INTEGER DEFAULT 1",
        "original_date": "TEXT",
        "total_amount": "REAL",
        "installment_plan_id": "TEXT"
    }
    for col_name, col_type in new_cols.items():
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE transactions ADD COLUMN {col_name} {col_type}")

    # Business category rules ("set always")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS business_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            category TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Budget table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL UNIQUE COLLATE NOCASE,
            amount REAL NOT NULL,
            period TEXT DEFAULT 'monthly',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # App Settings table (key-value store, e.g. currency, currency_symbol)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


# ---------------- App Settings ----------------

def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    conn = get_db_connection()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    if row:
        return row["value"]
    return default


def set_setting(key: str, value: str):
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
    """, (key.strip(), value.strip()))
    conn.commit()
    conn.close()


def get_all_settings() -> Dict[str, str]:
    conn = get_db_connection()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


# ---------------- Business Rules ----------------

def get_all_rules() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM business_rules ORDER BY business_name COLLATE NOCASE ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def match_rule_for_business(business_name: str, rules: Optional[List[Dict[str, Any]]] = None) -> Optional[str]:
    """
    Finds matching category for a business name using exact match first,
    then glob patterns (e.g. 'PAYPAL *', '*UBER*', 'SHELL [0-9]*', 'STORE [!12]*').
    Case-insensitive matching.
    """
    if not business_name:
        return None
    b_name = business_name.strip()
    b_lower = b_name.lower()

    if rules is None:
        rules = get_all_rules()

    # Pass 1: Exact match first (highest priority)
    for r in rules:
        pat = r["business_name"].strip()
        if pat.lower() == b_lower:
            return r["category"]

    # Pass 2: Glob patterns
    # Longer patterns take precedence (more specific)
    glob_rules = [r for r in rules if any(c in r["business_name"] for c in ["*", "?", "[", "]"])]
    glob_rules.sort(key=lambda x: len(x["business_name"]), reverse=True)

    for r in glob_rules:
        pat = r["business_name"].strip().lower()
        if fnmatch.fnmatchcase(b_lower, pat):
            return r["category"]

    return None


def get_rule_for_business(business_name: str) -> Optional[str]:
    return match_rule_for_business(business_name)


def set_business_rule(business_name: str, category: str):
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO business_rules (business_name, category, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(business_name) DO UPDATE SET
            category = excluded.category,
            updated_at = CURRENT_TIMESTAMP
    """, (business_name.strip(), category.strip()))
    conn.commit()
    conn.close()


def delete_business_rule(rule_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM business_rules WHERE id = ?", (rule_id,))
    conn.commit()
    conn.close()


# ---------------- Categories ----------------

def get_all_categories() -> List[str]:
    """Returns only categories defined in the budget or previously entered in transactions/rules."""
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT DISTINCT category FROM (
            SELECT category FROM budgets WHERE TRIM(category) != ''
            UNION
            SELECT category FROM transactions WHERE TRIM(category) != ''
            UNION
            SELECT category FROM business_rules WHERE TRIM(category) != ''
        ) ORDER BY category COLLATE NOCASE ASC
    """).fetchall()
    conn.close()
    return [r["category"].strip() for r in rows if r["category"] and r["category"].strip()]


def get_budget_categories() -> List[str]:
    """Returns only categories defined in the budget."""
    conn = get_db_connection()
    rows = conn.execute("SELECT category FROM budgets WHERE TRIM(category) != '' ORDER BY category COLLATE NOCASE ASC").fetchall()
    conn.close()
    return [r["category"].strip() for r in rows if r["category"] and r["category"].strip()]


def add_category(name: str):
    # When a category is explicitly added, if no budget exists, we can ensure it's recorded
    pass


# ---------------- Transactions ----------------

def insert_single_transaction(tx: Dict[str, Any]) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO transactions (
            date, business_name, amount, category, batch_id,
            source_file, source_row_id, file_hash, tx_signature,
            is_installment, current_installment, total_installments, original_date, total_amount, installment_plan_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        tx["date"],
        tx["business_name"].strip(),
        float(tx["amount"]),
        tx["category"].strip(),
        tx.get("batch_id"),
        tx.get("source_file"),
        tx.get("source_row_id"),
        tx.get("file_hash"),
        tx.get("tx_signature"),
        1 if tx.get("is_installment") else 0,
        int(tx.get("current_installment", 1)),
        int(tx.get("total_installments", 1)),
        tx.get("original_date") or tx["date"],
        float(tx.get("total_amount", tx["amount"])) if tx.get("total_amount") is not None else float(tx["amount"]),
        tx.get("installment_plan_id")
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id


def insert_transactions(transactions: List[Dict[str, Any]], batch_id: Optional[str] = None) -> int:
    conn = get_db_connection()
    inserted_count = 0
    for tx in transactions:
        conn.execute("""
            INSERT INTO transactions (
                date, business_name, amount, category, batch_id,
                source_file, source_row_id, file_hash, tx_signature,
                is_installment, current_installment, total_installments, original_date, total_amount, installment_plan_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            tx["date"],
            tx["business_name"].strip(),
            float(tx["amount"]),
            tx["category"].strip(),
            batch_id or tx.get("batch_id"),
            tx.get("source_file"),
            tx.get("source_row_id"),
            tx.get("file_hash"),
            tx.get("tx_signature"),
            1 if tx.get("is_installment") else 0,
            int(tx.get("current_installment", 1)),
            int(tx.get("total_installments", 1)),
            tx.get("original_date") or tx["date"],
            float(tx.get("total_amount", tx["amount"])) if tx.get("total_amount") is not None else float(tx["amount"]),
            tx.get("installment_plan_id")
        ))
        inserted_count += 1
    conn.commit()
    conn.close()
    return inserted_count


def get_submitted_file_rows(file_hash: str) -> set:
    if not file_hash:
        return set()
    conn = get_db_connection()
    rows = conn.execute("SELECT source_row_id FROM transactions WHERE file_hash = ? AND source_row_id IS NOT NULL", (file_hash,)).fetchall()
    conn.close()
    return {int(r["source_row_id"]) for r in rows}


def get_submitted_signatures() -> set:
    conn = get_db_connection()
    rows = conn.execute("SELECT tx_signature FROM transactions WHERE tx_signature IS NOT NULL AND tx_signature != ''").fetchall()
    conn.close()
    return {r["tx_signature"] for r in rows}


def get_available_months() -> List[str]:
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT DISTINCT SUBSTR(date, 1, 7) as month
        FROM transactions
        WHERE date IS NOT NULL AND TRIM(date) != '' AND LENGTH(date) >= 7
        ORDER BY month DESC
    """).fetchall()
    conn.close()
    return [r["month"] for r in rows if r["month"]]


def get_transactions(category: Optional[str] = None, search: Optional[str] = None, month: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    query = "SELECT * FROM transactions WHERE 1=1"
    params = []

    if month and month != "all":
        query += " AND SUBSTR(date, 1, 7) = ?"
        params.append(month)

    if category and category != "all":
        query += " AND category = ?"
        params.append(category)

    if search:
        query += " AND business_name LIKE ?"
        params.append(f"%{search}%")

    query += " ORDER BY date DESC, id DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_transaction_category(tx_id: int, category: str):
    conn = get_db_connection()
    conn.execute("UPDATE transactions SET category = ? WHERE id = ?", (category.strip(), tx_id))
    conn.commit()
    conn.close()


def delete_transaction(tx_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
    conn.commit()
    conn.close()


def clear_all_transactions():
    conn = get_db_connection()
    conn.execute("DELETE FROM transactions")
    conn.commit()
    conn.close()


# ---------------- Budgets ----------------

def get_all_budgets() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM budgets ORDER BY category COLLATE NOCASE ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def set_budget(category: str, amount: float, period: str = "monthly"):
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO budgets (category, amount, period, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(category) DO UPDATE SET
            amount = excluded.amount,
            period = excluded.period,
            updated_at = CURRENT_TIMESTAMP
    """, (category.strip(), float(amount), period))
    conn.commit()
    conn.close()


def delete_budget(budget_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM budgets WHERE id = ?", (budget_id,))
    conn.commit()
    conn.close()


def clear_all_budgets():
    conn = get_db_connection()
    conn.execute("DELETE FROM budgets")
    conn.commit()
    conn.close()


# ---------------- Analytics / Summary ----------------

def get_summary_data(month: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    available_months = get_available_months()

    # Determine active month
    if month is None:
        if available_months:
            selected_month = available_months[0]
        else:
            selected_month = datetime.today().strftime("%Y-%m")
    else:
        selected_month = month

    tx_filter = ""
    params = []
    if selected_month != "all":
        tx_filter = "WHERE SUBSTR(date, 1, 7) = ?"
        params = [selected_month]

    # Total spent
    total_spent_row = conn.execute(f"SELECT COALESCE(SUM(amount), 0) as total FROM transactions {tx_filter}", params).fetchone()
    total_spent = float(total_spent_row["total"])

    # Total budget
    month_multiplier = max(1, len(available_months)) if selected_month == "all" else 1
    total_budget_row = conn.execute("SELECT COALESCE(SUM(amount), 0) as total FROM budgets").fetchone()
    total_budget = float(total_budget_row["total"]) * month_multiplier

    # Spending by category
    group_sql = f"""
        SELECT category, COALESCE(SUM(amount), 0) as spent, COUNT(*) as count
        FROM transactions
        {tx_filter}
        GROUP BY category
        ORDER BY spent DESC
    """
    category_spending_rows = conn.execute(group_sql, params).fetchall()
    category_spending = {r["category"]: float(r["spent"]) for r in category_spending_rows}

    # Budgets list with actual spent
    budgets = conn.execute("SELECT * FROM budgets ORDER BY category COLLATE NOCASE ASC").fetchall()
    budget_comparison = []
    budget_categories = set()

    for b in budgets:
        cat = b["category"]
        budget_categories.add(cat.lower())
        spent = category_spending.get(cat, 0.0)
        # Also check case-insensitive match if needed
        if spent == 0.0:
            for s_cat, s_val in category_spending.items():
                if s_cat.lower() == cat.lower():
                    spent = s_val
                    break

        budget_amt = float(b["amount"]) * month_multiplier
        remaining = budget_amt - spent
        percent = (spent / budget_amt * 100) if budget_amt > 0 else 0
        budget_comparison.append({
            "id": b["id"],
            "category": cat,
            "budget": round(budget_amt, 2),
            "spent": round(spent, 2),
            "remaining": round(remaining, 2),
            "percentage": round(percent, 1),
            "status": "over" if spent > budget_amt else ("warning" if percent >= 85 else "ok")
        })

    # Categories with spending but no budget
    unbudgeted = []
    for cat, spent in category_spending.items():
        if cat.lower() not in budget_categories:
            unbudgeted.append({
                "category": cat,
                "spent": round(spent, 2)
            })

    # Total transactions count
    count_row = conn.execute(f"SELECT COUNT(*) as cnt FROM transactions {tx_filter}", params).fetchone()
    tx_count = count_row["cnt"]

    # Total rules count
    rules_row = conn.execute("SELECT COUNT(*) as cnt FROM business_rules").fetchone()
    rules_count = rules_row["cnt"]

    conn.close()

    return {
        "selected_month": selected_month,
        "available_months": available_months,
        "total_spent": round(total_spent, 2),
        "total_budget": round(total_budget, 2),
        "total_remaining": round(total_budget - total_spent, 2),
        "transaction_count": tx_count,
        "rules_count": rules_count,
        "category_spending": category_spending,
        "budget_comparison": budget_comparison,
        "unbudgeted": unbudgeted
    }
