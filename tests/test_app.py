import unittest
import os
import io
import json
import tempfile

from expense_app.database import (
    init_db,
    set_db_path,
    get_db_connection,
    set_business_rule,
    get_rule_for_business,
    get_all_rules,
    set_budget,
    get_all_budgets,
    insert_transactions,
    get_transactions,
    get_summary_data,
    get_available_months
)
from expense_app.app import app, add_months, detect_installment_info


class ExpenseManagerTestCase(unittest.TestCase):
    def setUp(self):
        # Create a temporary database file for isolated testing
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        self.temp_db.close()
        self.original_db_path = os.environ.get("EXPENSE_DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "expense_app", "expenses.db"))
        set_db_path(self.temp_db.name)

        # Configure app for testing
        app.config["TESTING"] = True
        self.client = app.test_client()
        init_db()

    def tearDown(self):
        # Restore original database path and remove temporary test database
        set_db_path(self.original_db_path)
        if os.path.exists(self.temp_db.name):
            try:
                os.remove(self.temp_db.name)
            except OSError:
                pass

    def test_database_rules(self):
        set_business_rule("Starbucks", "Dining Out")
        rule_cat = get_rule_for_business("starbucks")
        self.assertEqual(rule_cat, "Dining Out")

    def test_glob_rules(self):
        # 1. Test wildcard *
        set_business_rule("PAYPAL *", "Online Subscriptions")
        self.assertEqual(get_rule_for_business("PAYPAL *SPOTIFY"), "Online Subscriptions")
        self.assertEqual(get_rule_for_business("paypal *netflix"), "Online Subscriptions")

        # 2. Test exact match priority over glob
        set_business_rule("PAYPAL *EXACT", "Priority Category")
        self.assertEqual(get_rule_for_business("PAYPAL *EXACT"), "Priority Category")
        self.assertEqual(get_rule_for_business("PAYPAL *OTHER"), "Online Subscriptions")

        # 3. Test single character ?
        set_business_rule("STORE ??", "Retail")
        self.assertEqual(get_rule_for_business("STORE 42"), "Retail")
        self.assertIsNone(get_rule_for_business("STORE 123"))

        # 4. Test character set [0-9]
        set_business_rule("SHELL [0-9]*", "Gas & Fuel")
        self.assertEqual(get_rule_for_business("SHELL 892 Broadway"), "Gas & Fuel")
        self.assertIsNone(get_rule_for_business("SHELL EXPRESS"))

        # 5. Test negated character set [!seq]
        set_business_rule("BRANCH [!0-9]*", "HQ")
        self.assertEqual(get_rule_for_business("BRANCH MAIN"), "HQ")
        self.assertIsNone(get_rule_for_business("BRANCH 104"))

    def test_glob_rule_applied_in_csv_analysis(self):
        # Set a glob rule
        set_business_rule("AMAZON *", "Shopping")

        csv_content = (
            "Date,Merchant,Amount\n"
            "2026-11-05,AMAZON *ORDER123,45.99\n"
        )
        data = {
            "file": (io.BytesIO(csv_content.encode("utf-8")), "expenses.csv")
        }
        res = self.client.post("/api/expenses/upload-preview", data=data, content_type="multipart/form-data")
        upload_id = json.loads(res.data)["upload_id"]

        res_analyze = self.client.post("/api/expenses/analyze-columns", json={
            "upload_id": upload_id,
            "date_col": "Date",
            "business_col": "Merchant",
            "amount_col": "Amount"
        })
        analyze_data = json.loads(res_analyze.data)
        pending = analyze_data["pending_expenses"]
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["category"], "Shopping")
        self.assertTrue(pending[0]["has_rule"])

    def test_database_budgets_and_summary(self):
        set_budget("Groceries", 300.0)
        set_budget("Dining Out", 150.0)

        insert_transactions([
            {"date": "2026-11-01", "business_name": "Trader Joe's", "amount": 50.0, "category": "Groceries"},
            {"date": "2026-11-02", "business_name": "Starbucks", "amount": 10.0, "category": "Dining Out"},
        ])

        summary = get_summary_data()
        self.assertGreaterEqual(summary["total_spent"], 60.0)
        self.assertGreaterEqual(summary["total_budget"], 450.0)

    def test_expenses_upload_and_categorize_api(self):
        # 1. Upload CSV preview with 2 identical rows to verify Requirement 4
        csv_content = (
            "TransDate,MerchantName,TotalCharge\n"
            "2026-11-01,Test Coffee Shop,4.50\n"
            "2026-11-01,Test Coffee Shop,4.50\n"
            "2026-11-02,Local Grocery,25.30\n"
        )
        data = {
            "file": (io.BytesIO(csv_content.encode("utf-8")), "expenses.csv")
        }
        res = self.client.post("/api/expenses/upload-preview", data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 200)
        res_data = json.loads(res.data)
        self.assertIn("upload_id", res_data)
        upload_id = res_data["upload_id"]

        # 2. Analyze columns
        res_analyze = self.client.post("/api/expenses/analyze-columns", json={
            "upload_id": upload_id,
            "date_col": "TransDate",
            "business_col": "MerchantName",
            "amount_col": "TotalCharge"
        })
        self.assertEqual(res_analyze.status_code, 200)
        analyze_data = json.loads(res_analyze.data)
        
        # Requirement 4: 2 identical rows show as 2 separate expenses
        self.assertEqual(len(analyze_data["pending_expenses"]), 3)
        self.assertEqual(analyze_data["already_submitted_count"], 0)

        # Requirement 2: Submit expenses one by one
        res_single = self.client.post("/api/expenses/submit-single", json={
            "upload_id": upload_id,
            "row_id": 1,
            "category": "Dining Out",
            "set_always": True
        })
        self.assertEqual(res_single.status_code, 200)
        single_data = json.loads(res_single.data)
        self.assertEqual(single_data["category"], "Dining Out")

        # Verify rule was remembered
        rule = get_rule_for_business("Test Coffee Shop")
        self.assertEqual(rule, "Dining Out")

        # Submit row 2 with different category
        res_single2 = self.client.post("/api/expenses/submit-single", json={
            "upload_id": upload_id,
            "row_id": 2,
            "category": "Coffee",
            "set_always": False
        })
        self.assertEqual(res_single2.status_code, 200)

        # Requirement 3: Re-upload the exact same file
        data2 = {
            "file": (io.BytesIO(csv_content.encode("utf-8")), "expenses.csv")
        }
        res2 = self.client.post("/api/expenses/upload-preview", data=data2, content_type="multipart/form-data")
        upload_id2 = json.loads(res2.data)["upload_id"]

        res_analyze2 = self.client.post("/api/expenses/analyze-columns", json={
            "upload_id": upload_id2,
            "date_col": "TransDate",
            "business_col": "MerchantName",
            "amount_col": "TotalCharge"
        })
        analyze_data2 = json.loads(res_analyze2.data)

        # Rows 1 and 2 are already submitted, so only Row 3 remains pending!
        self.assertEqual(analyze_data2["already_submitted_count"], 2)
        self.assertEqual(len(analyze_data2["pending_expenses"]), 1)
        self.assertEqual(analyze_data2["pending_expenses"][0]["business_name"], "Local Grocery")

    def test_budget_upload_api(self):
        budget_csv = "Category,MonthlyLimit\nGroceries,400\nUtilities,120\n"
        data = {
            "file": (io.BytesIO(budget_csv.encode("utf-8")), "budget.csv")
        }
        res = self.client.post("/api/budget/upload-preview", data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 200)
        res_data = json.loads(res.data)
        self.assertIn("budget_upload_id", res_data)

        res_confirm = self.client.post("/api/budget/confirm-upload", json={
            "budget_upload_id": res_data["budget_upload_id"],
            "category_col": "Category",
            "amount_col": "MonthlyLimit"
        })
        self.assertEqual(res_confirm.status_code, 200)
        confirm_data = json.loads(res_confirm.data)
        self.assertEqual(confirm_data["updated_count"], 2)

    def test_settings_currency_api(self):
        # 1. Default settings
        res = self.client.get("/api/settings")
        self.assertEqual(res.status_code, 200)
        settings = json.loads(res.data)
        self.assertEqual(settings.get("currency"), "USD")
        self.assertEqual(settings.get("currency_symbol"), "$")
        self.assertEqual(settings.get("language"), "en")

        # 2. Update currency to EUR
        res_post = self.client.post("/api/settings", json={"currency": "EUR", "currency_symbol": "€"})
        self.assertEqual(res_post.status_code, 200)

        # 3. Verify updated currency
        res2 = self.client.get("/api/settings")
        settings2 = json.loads(res2.data)
        self.assertEqual(settings2.get("currency"), "EUR")
        self.assertEqual(settings2.get("currency_symbol"), "€")

    def test_settings_language_api(self):
        # Update language to Hebrew
        res_post = self.client.post("/api/settings", json={"language": "he"})
        self.assertEqual(res_post.status_code, 200)

        res = self.client.get("/api/settings")
        settings = json.loads(res.data)
        self.assertEqual(settings.get("language"), "he")

    def test_monthly_separation_and_filtering(self):
        set_budget("Groceries", 500.0)
        set_budget("Dining Out", 200.0)

        # October transactions (total = 150)
        insert_transactions([
            {"date": "2026-10-05", "business_name": "Trader Joe's", "amount": 100.0, "category": "Groceries"},
            {"date": "2026-10-15", "business_name": "Starbucks", "amount": 50.0, "category": "Dining Out"}
        ])

        # November transactions (total = 230)
        insert_transactions([
            {"date": "2026-11-01", "business_name": "Whole Foods", "amount": 150.0, "category": "Groceries"},
            {"date": "2026-11-10", "business_name": "Chipotle", "amount": 80.0, "category": "Dining Out"}
        ])

        # 1. Test get_available_months returns both months descending
        months = get_available_months()
        self.assertEqual(months, ["2026-11", "2026-10"])

        # 2. Test /api/months endpoint
        res_months = self.client.get("/api/months")
        self.assertEqual(res_months.status_code, 200)
        self.assertEqual(json.loads(res_months.data), ["2026-11", "2026-10"])

        # 3. Test summary for October 2026
        res_oct = self.client.get("/api/summary?month=2026-10")
        self.assertEqual(res_oct.status_code, 200)
        oct_data = json.loads(res_oct.data)
        self.assertEqual(oct_data["selected_month"], "2026-10")
        self.assertEqual(oct_data["total_spent"], 150.0)
        self.assertEqual(oct_data["total_budget"], 700.0)
        self.assertEqual(oct_data["transaction_count"], 2)
        groceries_oct = next(b for b in oct_data["budget_comparison"] if b["category"] == "Groceries")
        self.assertEqual(groceries_oct["spent"], 100.0)

        # 4. Test summary for November 2026
        res_nov = self.client.get("/api/summary?month=2026-11")
        self.assertEqual(res_nov.status_code, 200)
        nov_data = json.loads(res_nov.data)
        self.assertEqual(nov_data["selected_month"], "2026-11")
        self.assertEqual(nov_data["total_spent"], 230.0)
        self.assertEqual(nov_data["total_budget"], 700.0)
        self.assertEqual(nov_data["transaction_count"], 2)
        groceries_nov = next(b for b in nov_data["budget_comparison"] if b["category"] == "Groceries")
        self.assertEqual(groceries_nov["spent"], 150.0)

        # 5. Test summary for "all" months
        res_all = self.client.get("/api/summary?month=all")
        self.assertEqual(res_all.status_code, 200)
        all_data = json.loads(res_all.data)
        self.assertEqual(all_data["selected_month"], "all")
        self.assertEqual(all_data["total_spent"], 380.0)
        self.assertEqual(all_data["transaction_count"], 4)

        # 6. Test transactions filtering by month
        res_tx_oct = self.client.get("/api/transactions?month=2026-10")
        tx_oct = json.loads(res_tx_oct.data)
        self.assertEqual(len(tx_oct), 2)
        self.assertTrue(all(t["date"].startswith("2026-10") for t in tx_oct))

        res_tx_nov = self.client.get("/api/transactions?month=2026-11")
        tx_nov = json.loads(res_tx_nov.data)
        self.assertEqual(len(tx_nov), 2)
        self.assertTrue(all(t["date"].startswith("2026-11") for t in tx_nov))

        res_tx_all = self.client.get("/api/transactions?month=all")
        tx_all = json.loads(res_tx_all.data)
        self.assertEqual(len(tx_all), 4)

    def test_installment_detection_and_date_math(self):
        # 1. Date math with clamping
        self.assertEqual(add_months("2026-05-15", 2), "2026-07-15")
        self.assertEqual(add_months("2026-01-31", 1), "2026-02-28")
        self.assertEqual(add_months("2026-11-15", 3), "2027-02-15")
        self.assertEqual(add_months("2026-05-15", 0), "2026-05-15")

        # 2. Hebrew "3 מתוך 12" pattern
        r1 = {"Description": "IKEA", "Payments": "3 מתוך 12"}
        det1 = detect_installment_info(r1, "IKEA")
        self.assertIsNotNone(det1)
        self.assertEqual(det1["current_installment"], 3)
        self.assertEqual(det1["total_installments"], 12)

        # 3. Hebrew "תשלום 2 מ-6"
        r2 = {"Description": "Super-Pharm", "Notes": "תשלום 2 מ-6"}
        det2 = detect_installment_info(r2, "Super-Pharm")
        self.assertIsNotNone(det2)
        self.assertEqual(det2["current_installment"], 2)
        self.assertEqual(det2["total_installments"], 6)

        # 4. English "3 of 10"
        r3 = {"Merchant": "Best Buy 3 of 10"}
        det3 = detect_installment_info(r3, "Best Buy 3 of 10")
        self.assertIsNotNone(det3)
        self.assertEqual(det3["current_installment"], 3)
        self.assertEqual(det3["total_installments"], 10)

        # 5. Slash format "3/12"
        r4 = {"Merchant": "Appliances", "Installment": "3/12"}
        det4 = detect_installment_info(r4, "Appliances")
        self.assertIsNotNone(det4)
        self.assertEqual(det4["current_installment"], 3)
        self.assertEqual(det4["total_installments"], 12)

        # 6. User's exact case: 'פרטים': 'עסקה בתשלומים תשלום - 4 מ - 5.'
        r_user = {"Merchant": "Zara", "פרטים": "עסקה בתשלומים תשלום - 4 מ - 5."}
        det_user = detect_installment_info(r_user, "Zara")
        self.assertIsNotNone(det_user)
        self.assertEqual(det_user["current_installment"], 4)
        self.assertEqual(det_user["total_installments"], 5)

        # 7. Negative case: regular merchant without installments
        r5 = {"Merchant": "Starbucks Coffee"}
        self.assertIsNone(detect_installment_info(r5, "Starbucks Coffee"))

    def test_installment_csv_flow_and_user_override(self):
        # 1. Upload CSV with an installment expense
        csv_content = (
            "Date,Merchant,Amount,Payments\n"
            "2026-05-15,KSP Computer,200.00,3 מתוך 12\n"
            "2026-05-16,Supermarket,80.00,Single\n"
        )
        data = {
            "file": (io.BytesIO(csv_content.encode("utf-8")), "statement.csv")
        }
        res_up = self.client.post("/api/expenses/upload-preview", data=data, content_type="multipart/form-data")
        upload_id = json.loads(res_up.data)["upload_id"]

        # 2. Analyze columns
        res_an = self.client.post("/api/expenses/analyze-columns", json={
            "upload_id": upload_id,
            "date_col": "Date",
            "business_col": "Merchant",
            "amount_col": "Amount"
        })
        parsed = json.loads(res_an.data)["pending_expenses"]
        self.assertEqual(len(parsed), 2)

        ksp = next(p for p in parsed if "KSP" in p["business_name"])
        self.assertTrue(ksp["is_installment"])
        self.assertEqual(ksp["current_installment"], 3)
        self.assertEqual(ksp["total_installments"], 12)
        self.assertEqual(ksp["original_date"], "2026-05-15")
        # Effective date shifted by (3 - 1) = 2 months to July!
        self.assertEqual(ksp["date"], "2026-07-15")
        self.assertEqual(ksp["total_amount"], 2400.00)

        # 3. User override: user submits row 1 but corrects total payments to 10
        res_sub = self.client.post("/api/expenses/submit-single", json={
            "upload_id": upload_id,
            "row_id": ksp["row_id"],
            "category": "Electronics",
            "is_installment": True,
            "current_installment": 3,
            "total_installments": 10,
            "original_date": "2026-05-15",
            "date": "2026-07-15",
            "total_amount": 2000.00
        })
        self.assertEqual(res_sub.status_code, 200)

        # 4. Check transactions in database
        txs_jul = json.loads(self.client.get("/api/transactions?month=2026-07").data)
        self.assertEqual(len(txs_jul), 1)
        self.assertEqual(txs_jul[0]["business_name"], "KSP Computer")
        self.assertEqual(txs_jul[0]["date"], "2026-07-15")
        self.assertEqual(txs_jul[0]["original_date"], "2026-05-15")
        self.assertEqual(txs_jul[0]["current_installment"], 3)
        self.assertEqual(txs_jul[0]["total_installments"], 10)
        self.assertEqual(txs_jul[0]["total_amount"], 2000.00)

        # 5. Verify it does NOT show up in May 2026
        txs_may = json.loads(self.client.get("/api/transactions?month=2026-05").data)
        self.assertEqual(len(txs_may), 0)


if __name__ == "__main__":
    unittest.main()
