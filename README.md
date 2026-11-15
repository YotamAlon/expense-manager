# ExpenseManager

A lightweight, modern web application to manage expenses and track budgets using CSV statement uploads.

## Key Features

1. **Expenses CSV Upload with Flexible Column Mapping**:
   - Upload any credit card or bank statement CSV.
   - Specify 3 columns:
     - **Date**
     - **Business Name** (Merchant / Payee / Description)
     - **Amount**
   - Automatically detects common column names and previews the first 5 rows before importing.

2. **Smart Business Categorization with "Set Always" Memory**:
   - Reviews every unique business name extracted from your statement.
   - Displays occurrence count, total amount, and sample transaction dates.
   - Assign a category to each business with an option to check **"⚡ Set Always"**.
   - If checked, the app **remembers the business-to-category mapping forever**. Subsequent uploads automatically assign that category!
   - Dedicated **Always-Set Rules** tab to inspect, add, or delete remembered rules at any time.

3. **Budget Upload & Category Tracking**:
   - Upload your monthly budget via CSV (**Category** and **Amount** columns) or enter budgets manually in the UI.
   - Real-time **Budget vs Actual** comparison with color-coded progress bars (green for on track, yellow for warning at >85%, red for over-budget).

4. **Interactive Dashboard**:
   - Overview metrics: Total Spent, Total Budget, Total Remaining, Transactions Count, and Active Rules Count.
   - Interactive Doughnut Chart showing spending breakdown by category.
   - Category budget usage and unbudgeted spending alerts.

5. **Transactions Management**:
   - View, search by business name, and filter by category.
   - In-place category editing with option to update the "Set Always" rule.
   - Delete transactions or clear history.

6. **Multi-Currency & Internationalization (LTR / RTL)**:
   - Dynamic currency selector supporting USD, EUR, GBP, ILS (₪), and more.
   - Full English and Hebrew localization with automatic RTL layout switching and flipped navigation arrows.

7. **Installment & Recurring Expense Detection**:
   - Detects payment plan patterns (e.g., "payment 4 of 5") from statement notes.
   - Calculates installment amounts and automatically projects remaining charges across subsequent monthly budgets.

---

## Folder Structure

```text
ExpenseManager/
├── expense_app/                  # Application package
│   ├── static/
│   │   ├── css/style.css         # Modern, responsive UI design
│   │   ├── js/app.js             # Interactive client-side application logic
│   │   └── js/i18n.js            # Internationalization & translations (EN / HE)
│   ├── templates/
│   │   └── index.html            # Main web interface
│   ├── __init__.py
│   ├── app.py                    # Flask server & REST API
│   └── database.py               # SQLite database setup & queries
├── tests/
│   └── test_app.py               # Automated unit tests
├── requirements.txt              # Dependencies (Flask)
├── run.py                        # Top-level application runner
└── README.md
```

---

## How to Run the Application

1. Open a terminal in the project directory:
   ```powershell
   cd C:\Users\yotam\Projects\ExpenseManager
   ```

2. Run the application using the project virtual environment:
   ```powershell
   .venv\Scripts\python run.py
   ```

3. Open your web browser and navigate to:
   [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## Running the Automated Tests

Run the test suite anytime with:
```powershell
.venv\Scripts\python -m unittest tests/test_app.py
```
