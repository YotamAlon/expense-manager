import os
import csv
import io
import uuid
import re
import hashlib
import calendar
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from expense_app.database import (
    init_db,
    get_all_rules,
    get_rule_for_business,
    match_rule_for_business,
    set_business_rule,
    delete_business_rule,
    get_all_categories,
    add_category,
    insert_transactions,
    insert_single_transaction,
    get_submitted_file_rows,
    get_submitted_signatures,
    get_transactions,
    update_transaction_category,
    delete_transaction,
    clear_all_transactions,
    get_all_budgets,
    set_budget,
    delete_budget,
    clear_all_budgets,
    get_summary_data,
    get_available_months,
    get_setting,
    set_setting,
    get_all_settings
)

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "static")
)
app.secret_key = "expense-manager-secret-key-2026"

# In-memory storage for active upload sessions { session_id: { rows: [...], headers: [...] } }
UPLOAD_CACHE = {}


def parse_csv_content(file_bytes):
    """
    Robust CSV parser tailored for comma-delimited files with double-quote cell markers:
    - Automatically decodes common encodings (UTF-8, UTF-8-sig/BOM, Latin-1, CP1252)
    - Normalizes newlines (\r\n, \r -> \n)
    - Strips BOM if present
    - Uses comma delimiter with quotechar='"' and skipinitialspace=True
    - Skips leading blank lines or metadata lines
    - Strips any accidental outer quotes around header names and cell values
    - Returns headers, raw_dict_rows, and preview_cell_rows
    """
    # Decode strictly using UTF-8 (utf-8-sig transparently handles UTF-8 BOM if present)
    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = file_bytes.decode("utf-8", errors="replace")

    # Normalize newlines and strip BOM
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if text.startswith("\ufeff"):
        text = text[1:]

    raw_lines = [l for l in text.split("\n") if l.strip()]
    if not raw_lines:
        return [], [], []

    # Check primary delimiter: comma is default, fallback to semicolon or tab if no commas exist
    first_sample = "\n".join(raw_lines[:5])
    delimiter = ","
    if first_sample.count(",") == 0:
        if first_sample.count(";") > 0:
            delimiter = ";"
        elif first_sample.count("\t") > 0:
            delimiter = "\t"

    reader = csv.reader(
        io.StringIO("\n".join(raw_lines)),
        delimiter=delimiter,
        quotechar='"',
        skipinitialspace=True
    )

    all_rows = []
    for r in reader:
        if not r or all(not str(cell).strip() for cell in r):
            continue
        cleaned_row = [str(cell).strip() for cell in r]
        all_rows.append(cleaned_row)

    if not all_rows:
        return [], [], []

    # Clean headers (strip stray quotes, spaces)
    raw_headers = all_rows[0]
    headers = []
    for i, h in enumerate(raw_headers):
        clean_h = h.strip(' "\'').strip()
        if not clean_h:
            clean_h = f"Column_{i+1}"
        headers.append(clean_h)

    # Data rows
    data_rows = all_rows[1:]
    raw_dict_rows = []
    preview_cells = []

    for row in data_rows:
        row_dict = {}
        row_cells = []
        for i, header in enumerate(headers):
            val = row[i] if i < len(row) else ""
            if val.startswith('"') and val.endswith('"') and len(val) >= 2:
                val = val[1:-1].strip()
            row_dict[header] = val
            row_cells.append(val)
        raw_dict_rows.append(row_dict)
        if len(preview_cells) < 10:
            preview_cells.append(row_cells)

    return headers, raw_dict_rows, preview_cells


def clean_amount(val_str: str) -> float:
    """Parses amount string (handles currency symbols, commas, parentheses for negatives)."""
    if not val_str:
        return 0.0
    val_str = str(val_str).strip()
    is_negative = False
    if val_str.startswith("(") and val_str.endswith(")"):
        is_negative = True
        val_str = val_str[1:-1]
    # Remove currency symbols and formatting
    cleaned = re.sub(r"[^\d.-]", "", val_str)
    try:
        amt = float(cleaned)
        return -amt if is_negative else amt
    except ValueError:
        return 0.0


def clean_date(val_str: str) -> str:
    """Attempts to standardize date format to YYYY-MM-DD while falling back to original string."""
    if not val_str:
        return datetime.today().strftime("%Y-%m-%d")
    val_str = str(val_str).strip()
    formats = [
        "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d",
        "%d-%m-%Y", "%m-%d-%Y", "%b %d, %Y", "%d %b %Y",
        "%B %d, %Y", "%Y.%m.%d", "%m/%d/%y", "%d/%m/%y"
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return val_str


def add_months(date_str: str, months_to_add: int) -> str:
    """Adds months_to_add to a YYYY-MM-DD string, clamping day to target month."""
    if not date_str or months_to_add == 0:
        return date_str
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
    except Exception:
        return date_str

    total_months = (dt.year * 12 + dt.month - 1) + months_to_add
    target_year = total_months // 12
    target_month = (total_months % 12) + 1
    max_day = calendar.monthrange(target_year, target_month)[1]
    target_day = min(dt.day, max_day)
    return f"{target_year:04d}-{target_month:02d}-{target_day:02d}"


INSTALLMENT_PATTERNS = [
    # Explicit pattern with keywords: "עסקה בתשלומים תשלום - 4 מ - 5.", "תשלום 3 מתוך 12", "3 מ-12", "3 of 12", "3/12"
    re.compile(r'(?:תשלום\s*(?:מס[\'׳]\s*)?[-:]?\s*)?(\d{1,3})\s*(?:מתוך|מ\s*[-–—]?|out\s+of|of|/|\\)\s*[-–—]?\s*(\d{1,3})', re.IGNORECASE),
    # General pattern: 2 numbers separated by word(s)
    re.compile(r'\b(\d{1,3})\s+(?:[a-zA-Z\u0590-\u05fe]{1,15})\s+(\d{1,3})\b')
]


def detect_installment_info(row_dict: dict, business_name: str) -> dict:
    """
    Detects if an expense is in payments by looking for patterns like 'payment x out of y'
    or a column with 2 numbers separated by words (such as 'עסקה בתשלומים תשלום - 4 מ - 5.').
    The larger number is treated as total payments, and the smaller as current payment.
    """
    priority_keywords = ["פרטים", "details", "תשלום", "payment", "installment", "מספר", "סה״כ", "סה\"כ", "הערות", "סוג"]
    sorted_items = sorted(
        row_dict.items(),
        key=lambda item: 0 if any(k in str(item[0]).lower() for k in priority_keywords) else 1
    )

    for col_name, cell_val in sorted_items:
        cell_str = str(cell_val).strip()
        if not cell_str:
            continue
        if re.search(r'\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2}[-/.]\d{4}', cell_str):
            continue

        for pat in INSTALLMENT_PATTERNS:
            m = pat.search(cell_str)
            if m:
                n1, n2 = int(m.group(1)), int(m.group(2))
                if 1 <= n1 <= 120 and 1 <= n2 <= 120 and (n1 != n2 or n1 > 1):
                    total = max(n1, n2)
                    current = min(n1, n2)
                    if total > 1 and current <= total:
                        return {
                            "is_installment": True,
                            "current_installment": current,
                            "total_installments": total,
                            "matched_text": m.group(0),
                            "matched_column": col_name
                        }

    for pat in INSTALLMENT_PATTERNS:
        m = pat.search(business_name)
        if m:
            n1, n2 = int(m.group(1)), int(m.group(2))
            if 1 <= n1 <= 120 and 1 <= n2 <= 120 and (n1 != n2 or n1 > 1):
                total = max(n1, n2)
                current = min(n1, n2)
                if total > 1 and current <= total:
                    return {
                        "is_installment": True,
                        "current_installment": current,
                        "total_installments": total,
                        "matched_text": m.group(0),
                        "matched_column": "business_name"
                    }

    return None


@app.route("/")
def index():
    return render_template("index.html")


# ---------------- API: Summary & Dashboard ----------------

@app.route("/api/summary", methods=["GET"])
def api_summary():
    month = request.args.get("month")
    data = get_summary_data(month=month)
    return jsonify(data)


@app.route("/api/months", methods=["GET"])
def api_months():
    return jsonify(get_available_months())


# ---------------- API: Expenses CSV Upload ----------------

@app.route("/api/expenses/upload-preview", methods=["POST"])
def upload_expenses_preview():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    file_bytes = file.read()
    headers, raw_rows, preview_cells = parse_csv_content(file_bytes)

    if not headers or not raw_rows:
        return jsonify({"error": "No valid data rows found in the uploaded CSV. Please check the file formatting."}), 400

    file_hash = hashlib.sha256(file_bytes).hexdigest()
    upload_id = str(uuid.uuid4())
    UPLOAD_CACHE[upload_id] = {
        "headers": headers,
        "rows": raw_rows,
        "filename": file.filename,
        "file_hash": file_hash
    }

    # Guess columns automatically
    date_guess = ""
    biz_guess = ""
    amount_guess = ""

    for h in headers:
        hl = h.lower()
        if not date_guess and any(k in hl for k in ["date", "time", "day"]):
            date_guess = h
        elif not biz_guess and any(k in hl for k in ["business", "name", "merchant", "payee", "description", "vendor", "store"]):
            biz_guess = h
        elif not amount_guess and any(k in hl for k in ["amount", "cost", "total", "price", "sum", "charge"]):
            amount_guess = h

    return jsonify({
        "upload_id": upload_id,
        "filename": file.filename,
        "file_hash": file_hash,
        "headers": headers,
        "total_rows": len(raw_rows),
        "preview": preview_cells,
        "guesses": {
            "date": date_guess or (headers[0] if len(headers) > 0 else ""),
            "business": biz_guess or (headers[1] if len(headers) > 1 else ""),
            "amount": amount_guess or (headers[2] if len(headers) > 2 else "")
        }
    })


@app.route("/api/expenses/analyze-columns", methods=["POST"])
def analyze_expenses_columns():
    payload = request.json or {}
    upload_id = payload.get("upload_id")
    date_col = payload.get("date_col")
    business_col = payload.get("business_col")
    amount_col = payload.get("amount_col")

    if not upload_id or upload_id not in UPLOAD_CACHE:
        return jsonify({"error": "Upload session expired or invalid. Please re-upload your CSV."}), 400

    cached = UPLOAD_CACHE[upload_id]
    rows = cached["rows"]
    file_hash = cached.get("file_hash", "")

    all_rules = get_all_rules()
    categories = get_all_categories()
    submitted_file_rows = get_submitted_file_rows(file_hash)
    submitted_signatures = get_submitted_signatures()

    # Track occurrence count for each unique (date, biz, amount) in this file
    occurrence_counter = {}
    parsed_transactions = []
    already_submitted_count = 0

    for i, r in enumerate(rows, start=1):
        raw_biz = r.get(business_col, "").strip()
        if not raw_biz:
            continue
        orig_date = clean_date(r.get(date_col, ""))
        amt_val = clean_amount(r.get(amount_col, ""))
        amt_val = abs(amt_val)

        biz_key = raw_biz.lower()

        # Detect installment pattern (e.g. "payment x out of y" or 2 numbers separated by words)
        inst_info = detect_installment_info(r, raw_biz)
        if inst_info:
            is_installment = True
            current_inst = inst_info["current_installment"]
            total_inst = inst_info["total_installments"]
            effective_date = add_months(orig_date, current_inst - 1)
            total_amount = round(amt_val * total_inst, 2)
            plan_id = f"{biz_key}|{orig_date}|{total_inst}"
        else:
            is_installment = False
            current_inst = 1
            total_inst = 1
            effective_date = orig_date
            total_amount = amt_val
            plan_id = None

        occ_key = (effective_date, biz_key, round(amt_val, 2))
        occurrence_counter[occ_key] = occurrence_counter.get(occ_key, 0) + 1
        occ_num = occurrence_counter[occ_key]

        if is_installment:
            sig = f"{effective_date}|{biz_key}|{amt_val:.2f}|pmt{current_inst}of{total_inst}|#{occ_num}"
        else:
            sig = f"{effective_date}|{biz_key}|{amt_val:.2f}|#{occ_num}"

        # Check if already submitted previously
        is_submitted = (i in submitted_file_rows) or (sig in submitted_signatures)
        if is_submitted:
            already_submitted_count += 1

        remembered_cat = match_rule_for_business(raw_biz, all_rules) or ""

        tx_entry = {
            "row_id": i,
            "date": effective_date,
            "original_date": orig_date,
            "business_name": raw_biz,
            "amount": amt_val,
            "total_amount": total_amount,
            "is_installment": is_installment,
            "current_installment": current_inst,
            "total_installments": total_inst,
            "installment_plan_id": plan_id,
            "category": remembered_cat,
            "has_rule": bool(remembered_cat),
            "tx_signature": sig,
            "is_submitted": is_submitted
        }
        parsed_transactions.append(tx_entry)

    UPLOAD_CACHE[upload_id]["parsed_transactions"] = parsed_transactions

    # Only present unsubmitted expenses
    pending_expenses = [t for t in parsed_transactions if not t["is_submitted"]]

    return jsonify({
        "upload_id": upload_id,
        "total_file_rows": len(parsed_transactions),
        "already_submitted_count": already_submitted_count,
        "pending_expenses": pending_expenses,
        "categories": categories
    })


@app.route("/api/expenses/submit-single", methods=["POST"])
def submit_single_expense():
    payload = request.json or {}
    upload_id = payload.get("upload_id")
    row_id = payload.get("row_id")
    category = payload.get("category", "").strip()
    set_always = payload.get("set_always", False)

    if not upload_id or upload_id not in UPLOAD_CACHE:
        return jsonify({"error": "Upload session expired or invalid. Please re-upload your CSV."}), 400

    if not category:
        return jsonify({"error": "Please choose a category before submitting."}), 400

    cached = UPLOAD_CACHE[upload_id]
    parsed_transactions = cached.get("parsed_transactions", [])

    tx = next((t for t in parsed_transactions if t["row_id"] == row_id), None)
    if not tx:
        return jsonify({"error": f"Expense row {row_id} not found."}), 404

    if tx.get("is_submitted"):
        return jsonify({"error": f"Expense row {row_id} has already been submitted."}), 400

    # User overrides for installments
    is_inst = payload.get("is_installment", tx.get("is_installment", False))
    curr_inst = int(payload.get("current_installment", tx.get("current_installment", 1)))
    tot_inst = int(payload.get("total_installments", tx.get("total_installments", 1)))
    orig_dt = payload.get("original_date", tx.get("original_date", tx["date"]))

    if "date" in payload and payload["date"]:
        eff_dt = payload["date"]
    elif is_inst:
        eff_dt = add_months(orig_dt, curr_inst - 1)
    else:
        eff_dt = orig_dt

    tot_amt = float(payload.get("total_amount", tx.get("total_amount", tx["amount"] * tot_inst if is_inst else tx["amount"])))
    plan_id = f"{tx['business_name'].strip().lower()}|{orig_dt}|{tot_inst}" if is_inst else None

    # Save rule if set_always
    if set_always:
        set_business_rule(tx["business_name"], category)

    # Insert single transaction
    batch_id = str(uuid.uuid4())[:8]
    tx_record = {
        "date": eff_dt,
        "original_date": orig_dt,
        "business_name": tx["business_name"],
        "amount": tx["amount"],
        "total_amount": tot_amt,
        "is_installment": is_inst,
        "current_installment": curr_inst,
        "total_installments": tot_inst,
        "installment_plan_id": plan_id,
        "category": category,
        "batch_id": batch_id,
        "source_file": cached.get("filename"),
        "source_row_id": tx["row_id"],
        "file_hash": cached.get("file_hash"),
        "tx_signature": tx.get("tx_signature")
    }
    tx_id = insert_single_transaction(tx_record)
    tx["is_submitted"] = True
    tx["category"] = category
    tx["date"] = eff_dt
    tx["is_installment"] = is_inst
    tx["current_installment"] = curr_inst
    tx["total_installments"] = tot_inst

    return jsonify({
        "status": "success",
        "tx_id": tx_id,
        "row_id": row_id,
        "business_name": tx["business_name"],
        "category": category,
        "set_always": set_always
    })


@app.route("/api/expenses/confirm-import", methods=["POST"])
def confirm_expenses_import():
    payload = request.json or {}
    upload_id = payload.get("upload_id")
    # decisions: dict of { str(row_id): { category: "...", set_always: true/false, is_installment: bool, ... } }
    decisions = payload.get("decisions", {})

    if not upload_id or upload_id not in UPLOAD_CACHE:
        return jsonify({"error": "Upload session expired or invalid. Please re-upload your CSV."}), 400

    cached = UPLOAD_CACHE[upload_id]
    parsed_transactions = cached.get("parsed_transactions", [])
    if not parsed_transactions:
        return jsonify({"error": "No parsed transactions found to import."}), 400

    inserted_count = 0
    new_rules_count = 0
    batch_id = str(uuid.uuid4())[:8]

    for tx in parsed_transactions:
        if tx.get("is_submitted"):
            continue

        r_key = str(tx["row_id"])
        info = decisions.get(r_key, {})
        cat = info.get("category", "").strip() or tx.get("category", "").strip()
        set_always = info.get("set_always", False)

        if not cat:
            continue

        if set_always:
            set_business_rule(tx["business_name"], cat)
            new_rules_count += 1

        is_inst = info.get("is_installment", tx.get("is_installment", False))
        curr_inst = int(info.get("current_installment", tx.get("current_installment", 1)))
        tot_inst = int(info.get("total_installments", tx.get("total_installments", 1)))
        orig_dt = info.get("original_date", tx.get("original_date", tx["date"]))

        if "date" in info and info["date"]:
            eff_dt = info["date"]
        elif is_inst:
            eff_dt = add_months(orig_dt, curr_inst - 1)
        else:
            eff_dt = orig_dt

        tot_amt = float(info.get("total_amount", tx.get("total_amount", tx["amount"] * tot_inst if is_inst else tx["amount"])))
        plan_id = f"{tx['business_name'].strip().lower()}|{orig_dt}|{tot_inst}" if is_inst else None

        tx_record = {
            "date": eff_dt,
            "original_date": orig_dt,
            "business_name": tx["business_name"],
            "amount": tx["amount"],
            "total_amount": tot_amt,
            "is_installment": is_inst,
            "current_installment": curr_inst,
            "total_installments": tot_inst,
            "installment_plan_id": plan_id,
            "category": cat,
            "batch_id": batch_id,
            "source_file": cached.get("filename"),
            "source_row_id": tx["row_id"],
            "file_hash": cached.get("file_hash"),
            "tx_signature": tx.get("tx_signature")
        }
        insert_single_transaction(tx_record)
        tx["is_submitted"] = True
        inserted_count += 1

    return jsonify({
        "status": "success",
        "inserted_count": inserted_count,
        "new_rules_count": new_rules_count,
        "batch_id": batch_id
    })


# ---------------- API: Budget Upload & Management ----------------

@app.route("/api/budget/upload-preview", methods=["POST"])
def upload_budget_preview():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    file_bytes = file.read()
    headers, raw_rows, preview_cells = parse_csv_content(file_bytes)

    if not headers or not raw_rows:
        return jsonify({"error": "No valid budget rows found in the uploaded CSV."}), 400

    budget_upload_id = str(uuid.uuid4())
    UPLOAD_CACHE[budget_upload_id] = {
        "headers": headers,
        "rows": raw_rows,
        "filename": file.filename
    }

    # Guess category & amount columns
    cat_guess = ""
    amt_guess = ""
    for h in headers:
        hl = h.lower()
        if not cat_guess and any(k in hl for k in ["category", "cat", "name", "type"]):
            cat_guess = h
        elif not amt_guess and any(k in hl for k in ["amount", "budget", "limit", "cost", "total", "sum"]):
            amt_guess = h

    return jsonify({
        "budget_upload_id": budget_upload_id,
        "filename": file.filename,
        "headers": headers,
        "total_rows": len(raw_rows),
        "preview": preview_cells,
        "guesses": {
            "category": cat_guess or (headers[0] if len(headers) > 0 else ""),
            "amount": amt_guess or (headers[1] if len(headers) > 1 else "")
        }
    })


@app.route("/api/budget/confirm-upload", methods=["POST"])
def confirm_budget_upload():
    payload = request.json or {}
    budget_upload_id = payload.get("budget_upload_id")
    category_col = payload.get("category_col")
    amount_col = payload.get("amount_col")

    if not budget_upload_id or budget_upload_id not in UPLOAD_CACHE:
        return jsonify({"error": "Budget session expired. Please re-upload CSV."}), 400

    rows = UPLOAD_CACHE[budget_upload_id]["rows"]
    updated_count = 0

    for r in rows:
        cat = r.get(category_col, "").strip()
        amt_str = r.get(amount_col, "")
        if not cat:
            continue
        amt = clean_amount(amt_str)
        set_budget(cat, amt)
        updated_count += 1

    UPLOAD_CACHE.pop(budget_upload_id, None)

    return jsonify({
        "status": "success",
        "updated_count": updated_count
    })


@app.route("/api/budgets", methods=["GET", "POST"])
def handle_budgets():
    if request.method == "POST":
        data = request.json or {}
        cat = data.get("category", "").strip()
        amount = clean_amount(data.get("amount", 0))
        if not cat:
            return jsonify({"error": "Category name is required"}), 400
        set_budget(cat, amount)
        return jsonify({"status": "success", "category": cat, "amount": amount})

    budgets = get_all_budgets()
    return jsonify(budgets)


@app.route("/api/budgets/<int:budget_id>", methods=["DELETE"])
def remove_budget(budget_id):
    delete_budget(budget_id)
    return jsonify({"status": "success"})


@app.route("/api/budgets/clear", methods=["POST"])
def clear_budgets_endpoint():
    clear_all_budgets()
    return jsonify({"status": "success"})


# ---------------- API: Transactions ----------------

@app.route("/api/transactions", methods=["GET"])
def list_transactions():
    category = request.args.get("category")
    search = request.args.get("search")
    month = request.args.get("month")
    txs = get_transactions(category=category, search=search, month=month)
    return jsonify(txs)


@app.route("/api/transactions/<int:tx_id>", methods=["PUT", "DELETE"])
def modify_transaction(tx_id):
    if request.method == "DELETE":
        delete_transaction(tx_id)
        return jsonify({"status": "success"})
    elif request.method == "PUT":
        data = request.json or {}
        new_category = data.get("category", "").strip()
        if not new_category:
            return jsonify({"error": "Category is required"}), 400
        update_transaction_category(tx_id, new_category)
        return jsonify({"status": "success"})


@app.route("/api/transactions/clear", methods=["POST"])
def clear_transactions_endpoint():
    clear_all_transactions()
    return jsonify({"status": "success"})


# ---------------- API: Business Category Rules ----------------

@app.route("/api/rules", methods=["GET", "POST"])
def handle_rules():
    if request.method == "POST":
        data = request.json or {}
        biz = data.get("business_name", "").strip()
        cat = data.get("category", "").strip()
        if not biz or not cat:
            return jsonify({"error": "Both business name and category are required"}), 400
        set_business_rule(biz, cat)
        return jsonify({"status": "success"})

    rules = get_all_rules()
    return jsonify(rules)


@app.route("/api/rules/<int:rule_id>", methods=["DELETE"])
def remove_rule(rule_id):
    delete_business_rule(rule_id)
    return jsonify({"status": "success"})


# ---------------- API: Categories ----------------

@app.route("/api/categories", methods=["GET", "POST"])
def handle_categories():
    if request.method == "POST":
        data = request.json or {}
        cat_name = data.get("name", "").strip()
        if not cat_name:
            return jsonify({"error": "Category name is required"}), 400
        add_category(cat_name)
        return jsonify({"status": "success", "name": cat_name})

    categories = get_all_categories()
    return jsonify(categories)


# ---------------- API: Settings (Currency, Preferences) ----------------

@app.route("/api/settings", methods=["GET", "POST"])
def handle_settings():
    if request.method == "POST":
        data = request.json or {}
        for k, v in data.items():
            set_setting(str(k), str(v))
        return jsonify({"status": "success", "settings": get_all_settings()})

    settings = get_all_settings()
    # Provide defaults if not set yet
    if "currency" not in settings:
        settings["currency"] = "USD"
    if "currency_symbol" not in settings:
        settings["currency_symbol"] = "$"
    if "language" not in settings:
        settings["language"] = "en"
    return jsonify(settings)


# Initialize DB on import
init_db()


def create_app():
    return app


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
