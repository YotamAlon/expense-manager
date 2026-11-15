// Internationalization (i18n) - English and Hebrew support

const TRANSLATIONS = {
  en: {
    // App Header
    brand_title: "ExpenseManager",
    brand_tagline: "Smart CSV Expense & Budget Management",
    select_currency: "Currency:",
    select_language: "Language:",

    // Navigation Tabs
    nav_dashboard: "Dashboard",
    nav_upload_expenses: "Upload Expenses",
    nav_budget: "Budget",
    nav_transactions: "Transactions",
    nav_rules: "Always-Set Rules",

    // Dashboard
    total_spent: "Total Spent",
    total_budget: "Total Budget",
    remaining_budget: "Remaining Budget",
    rules_remembered: "Rules Remembered",
    within_budget: "Within total budget",
    over_budget: "Over budget!",
    category_budget_singular: "category budget",
    category_budget_plural: "category budgets",
    transaction_singular: "transaction",
    transaction_plural: "transactions",
    active_rules_sub: "Active rules auto-categorizing",
    spending_by_category: "Spending by Category",
    budget_vs_actual: "Budget vs Actual",
    no_expenses_recorded: "No expenses recorded yet. Upload a CSV to get started!",
    no_budgets_configured: "No budgets configured. Upload a budget CSV or add categories!",
    btn_set_budget: "Set Budget",
    unbudgeted_spending: "Unbudgeted Spending:",
    spent_no_budget: "{amount} spent (no budget set)",
    badge_over: "Over ({amount})",
    badge_left: "{amount} left",
    badge_used: "{pct}% used",
    filter_month: "Month:",
    opt_all_months: "All Months",
    btn_prev_month: "Previous Month",
    btn_next_month: "Next Month",
    budget_month_for: "Budget & Spending for {month}",
    budget_month_all: "Budget & Spending across All Months",

    // Wizard Navigation
    wizard_step_1: "1. Upload CSV",
    wizard_step_2: "2. Map Columns",
    wizard_step_3: "3. Review & Categorize",

    // Wizard Step 1
    dropzone_title: "Drag & Drop your Expenses CSV file here",
    dropzone_sub: "Supports bank/credit card statements in CSV format (UTF-8)",
    browse_files: "Browse Files",

    // Wizard Step 2
    step2_title: "Specify the 3 Required Columns",
    step2_sub: "Tell us which columns in your CSV correspond to the <strong>Date</strong>, <strong>Business Name</strong>, and <strong>Amount</strong>.",
    col_date: "Date Column",
    col_date_hint: "e.g., Transaction Date, Posting Date",
    col_business: "Business Name Column",
    col_business_hint: "e.g., Description, Merchant, Payee, Name",
    col_amount: "Amount Column",
    col_amount_hint: "e.g., Amount, Total, Cost, Charge",
    csv_preview_title: "CSV Preview (First Rows):",
    btn_choose_diff_file: "← Choose Different File",
    btn_proceed_to_categorize: "Next: Categorize Businesses →",

    // Wizard Step 3
    step3_title: "Review & Submit Expenses",
    step3_sub: "Assign a category to each expense and submit them <strong>one by one</strong> or all at once. Check <strong>\"Set Always\"</strong> to automatically remember that category for the business name!",
    pending_title: "Expenses Pending Submission",
    pending_sub: "Submit expenses individually or all together.",
    btn_check_all_always: "Check all \"Set Always\"",
    btn_uncheck_all_always: "Uncheck all",
    btn_submit_all_ready: "Submit All Ready",
    th_num: "#",
    th_date: "Date",
    th_business: "Business Name",
    th_amount: "Amount",
    th_payments: "Payments",
    lbl_installments: "In Payments",
    orig_date_label: "Orig:",
    total_label: "Total:",
    installment_badge_title: "Payment {current} of {total} (Original: {date}, Total: {amount})",
    th_category: "Category",
    th_set_always: "Set always",
    th_action: "Action",
    btn_submit_row: "Submit",
    badge_saved: "✓ Saved",
    badge_rule: "Rule",
    choose_category: "-- Choose Category --",
    custom_category_option: "+ New category...",
    enter_custom_category: "Enter new category name...",
    all_expenses_submitted_title: "All Expenses Already Submitted!",
    all_expenses_submitted_sub: "All {count} expenses from this file are already recorded in your transactions.",
    btn_view_transactions: "View Transactions",
    skipped_tracking_banner: "<strong>{skipped}</strong> expense(s) from this file were already submitted previously and skipped. Showing <strong>{pending}</strong> remaining expense(s).",

    // Budget Tab
    budget_tab_title: "Budget Management",
    add_budget_title: "➕ Add / Adjust Category Budget",
    add_budget_sub: "Set a monthly target for any category. Expenses will automatically track against this.",
    lbl_category_name: "Category Name",
    ph_category_name: "e.g. Groceries or Dining Out",
    lbl_monthly_amount: "Monthly Budget Amount",
    btn_save_budget: "Save Budget",
    upload_budget_title: "📤 Upload Budget CSV",
    upload_budget_sub: "Import your monthly category targets from a spreadsheet.",
    dropzone_budget: "Drag & Drop Budget CSV",
    btn_select_csv: "Select CSV",
    map_budget_columns: "Map Budget Columns",
    lbl_budget_cat_col: "Category Column:",
    lbl_budget_amt_col: "Amount Column:",
    btn_import_budget: "Import Budget →",
    budget_table_title: "Current Budget & Spending Status",
    budget_table_sub: "Compare your allocated budget against actual expenses.",
    btn_clear_all_budgets: "Clear All Budgets",
    th_cat: "Category",
    th_budget: "Budget",
    th_spent: "Actual Spent",
    th_remaining: "Remaining",
    th_usage: "Usage",
    th_status: "Status",
    badge_over_budget: "Over Budget",
    badge_near_limit: "Near Limit",
    badge_on_track: "On Track",
    btn_delete: "Delete",
    no_budgets_table: "No budgets configured yet. Upload a budget CSV above!",

    // Transactions Tab
    tx_table_title: "All Recorded Expenses",
    tx_table_sub: "Showing all transactions",
    showing_tx_for_month: "Showing transactions for {month}",
    btn_clear_all_tx: "Clear All Expenses",
    ph_search_business: "Search by business name...",
    opt_all_categories: "All Categories",
    btn_edit_category: "Edit Category",
    no_transactions_table: "No transactions found matching your filter.",

    // Always-Set Rules Tab
    rules_tab_title: "➕ Add Always-Set Rule",
    rules_tab_sub: "Whenever a transaction with this business name is uploaded, it will automatically receive this category.",
    lbl_rule_biz: "Business Name or Pattern",
    ph_rule_biz: "e.g. PAYPAL * or Starbucks",
    hint_rule_glob: "Supports exact names or glob wildcards like <code>PAYPAL *</code>, <code>*AMAZON*</code>, <code>SHELL [0-9]*</code>",
    lbl_rule_cat: "Category",
    ph_rule_cat: "e.g. Subscriptions",
    btn_save_rule: "Save Rule",
    rules_info_title: "⚡ How \"Set Always\" & Glob Rules Work",
    rules_info_1: "Zero friction: Once you check \"Set Always\" during expense upload, the app remembers the mapping forever.",
    rules_info_2: "Case-insensitive: \"starbucks\", \"STARBUCKS\", and \"Starbucks\" all match the same rule.",
    rules_info_3: "Exact match priority: Exact merchant matches always take priority over glob patterns.",
    rules_info_glob_title: "Glob Pattern Options:",
    rules_info_glob_star: "* — Matches any sequence of characters (e.g. PAYPAL * matches PAYPAL *SPOTIFY)",
    rules_info_glob_quest: "? — Matches exactly one character (e.g. STORE ?? matches STORE 01)",
    rules_info_glob_seq: "[seq] — Matches any character in sequence (e.g. SHELL [0-9]*, [A-Z]*)",
    rules_info_glob_notseq: "[!seq] — Matches any character NOT in sequence (e.g. STORE [!0-9]*)",
    rules_info_4: "Always editable: You can edit or delete rules anytime right here.",
    saved_rules_title: "Saved Category Memory Rules",
    th_rule_pattern: "Business Name",
    th_rule_category: "Always Assigned Category",
    th_rule_created: "Created / Updated",
    btn_delete_rule: "Delete Rule",
    badge_glob: "Glob",
    badge_exact: "Exact",
    no_rules_table: "No rules remembered yet. When you check \"Set Always\" during CSV upload, rules will appear here!",

    // Modal
    modal_edit_title: "Edit Expense Category",
    lbl_modal_biz: "Business Name:",
    lbl_modal_amt: "Amount:",
    lbl_modal_new_cat: "New Category:",
    lbl_modal_always: "Update \"Set Always\" memory rule for this business name",
    btn_save_changes: "Save Changes",
    btn_cancel: "Cancel",

    // Toasts & Messages
    toast_language_changed: "Language changed to English",
    toast_currency_changed: "Currency changed to {code} ({symbol})",
    toast_rule_saved: "Rule saved: \"{biz}\" → \"{cat}\"",
    toast_budget_saved: "Budget for \"{cat}\" set to {amount}",
    toast_budget_deleted: "Budget removed",
    toast_budgets_cleared: "All budgets cleared",
    toast_tx_deleted: "Transaction deleted",
    toast_tx_cleared: "All transactions cleared",
    toast_choose_cat_for: "Please choose a category for \"{biz}\" before submitting.",
    toast_single_saved: "Saved expense & remembered \"{biz}\" as \"{cat}\"",
    toast_single_saved_no_rule: "Saved expense for \"{biz}\" as \"{cat}\"",
    toast_all_ready_saved: "Successfully submitted {count} expenses!",
    toast_reading_file: "Reading {filename}...",
    toast_loaded_rows: "Loaded {count} rows from {filename}. Please verify columns.",
    toast_valid_csv: "Please upload a valid CSV file (.csv)",
    toast_found_budget_rows: "Found {count} budget rows. Confirm columns to import.",
    toast_budget_imported: "Successfully imported {count} budget categories!",
    confirm_clear_all_tx: "Are you sure you want to clear ALL transactions? This cannot be undone.",
    confirm_clear_all_budgets: "Are you sure you want to clear all budget entries?",
    confirm_delete_budget: "Delete this budget category?",
    confirm_delete_tx: "Delete this transaction?",
    confirm_delete_rule: "Forget remembered category rule for \"{biz}\"?"
  },

  he: {
    // App Header
    brand_title: "ExpenseManager",
    brand_tagline: "ניהול הוצאות ותקציב חכם מקבצי CSV",
    select_currency: "מטבע:",
    select_language: "שפה:",

    // Navigation Tabs
    nav_dashboard: "לוח בקרה",
    nav_upload_expenses: "העלאת הוצאות",
    nav_budget: "תקציב",
    nav_transactions: "עסקאות",
    nav_rules: "חוקי סיווג קבועים",

    // Dashboard
    total_spent: "סך הכל הוצאות",
    total_budget: "סך תקציב כולל",
    remaining_budget: "יתרה לתקציב",
    rules_remembered: "חוקים שנשמרו",
    within_budget: "במסגרת התקציב הכולל",
    over_budget: "חריגה מהתקציב!",
    category_budget_singular: "קטגוריה מתוקצבת",
    category_budget_plural: "קטגוריות מתוקצבות",
    transaction_singular: "עסקה",
    transaction_plural: "עסקאות",
    active_rules_sub: "חוקים פעילים לסיווג אוטומטי",
    spending_by_category: "התפלגות הוצאות לפי קטגוריה",
    budget_vs_actual: "תקציב מול ביצוע בפועל",
    no_expenses_recorded: "עדיין לא נרשמו הוצאות. העלה קובץ CSV כדי להתחיל!",
    no_budgets_configured: "לא הוגדרו תקציבים. העלה קובץ תקציב או הוסף קטגוריות!",
    btn_set_budget: "הגדר תקציב",
    unbudgeted_spending: "הוצאות ללא תקציב מוגדר:",
    spent_no_budget: "{amount} הוצאו (ללא יעד תקציב)",
    badge_over: "חריגה ({amount})",
    badge_left: "נותרו {amount}",
    badge_used: "{pct}% נוצלו",
    filter_month: "חודש:",
    opt_all_months: "כל החודשים",
    btn_prev_month: "חודש קודם",
    btn_next_month: "חודש הבא",
    budget_month_for: "תקציב והוצאות עבור {month}",
    budget_month_all: "תקציב והוצאות לכל החודשים",

    // Wizard Navigation
    wizard_step_1: "1. העלאת CSV",
    wizard_step_2: "2. התאמת עמודות",
    wizard_step_3: "3. בדיקה וסיווג",

    // Wizard Step 1
    dropzone_title: "גרור ושחרר קובץ CSV של הוצאות לכאן",
    dropzone_sub: "תומך בדפי חשבון ופירוט אשראי בפורמט CSV (קידוד UTF-8)",
    browse_files: "בחר קובץ מהמחשב",

    // Wizard Step 2
    step2_title: "הגדרת 3 עמודות החובה",
    step2_sub: "בחר את העמודות בקובץ המתאימות ל-<strong>תאריך</strong>, <strong>שם בית העסק</strong>, ו-<strong>סכום</strong>.",
    col_date: "עמודת תאריך",
    col_date_hint: "לדוגמה: תאריך עסקה, תאריך חיוב",
    col_business: "עמודת בית עסק",
    col_business_hint: "לדוגמה: תיאור, שם בית עסק, מוטב",
    col_amount: "עמודת סכום",
    col_amount_hint: "לדוגמה: סכום, חובה, סך הכל",
    csv_preview_title: "תצוגה מקדימה של הקובץ (שורות ראשונות):",
    btn_choose_diff_file: "← בחר קובץ אחר",
    btn_proceed_to_categorize: "המשך: סיווג בתי עסק ←",

    // Wizard Step 3
    step3_title: "בדיקה והזנת הוצאות",
    step3_sub: "בחר קטגוריה לכל הוצאה והזן אותן <strong>אחת-אחת</strong> או את כולן ביחד. סמן <strong>\"קבע תמיד\"</strong> כדי לזכור את הסיווג לעתיד!",
    pending_title: "הוצאות ממתינות להזנה",
    pending_sub: "הזן הוצאות בנפרד או יחד.",
    btn_check_all_always: "סמן הכל \"קבע תמיד\"",
    btn_uncheck_all_always: "בטל סימון הכל",
    btn_submit_all_ready: "הזן את כל ההוצאות המוכנות",
    th_num: "#",
    th_date: "תאריך",
    th_business: "בית עסק",
    th_amount: "סכום",
    th_payments: "תשלומים",
    lbl_installments: "בתשלומים",
    orig_date_label: "מקור:",
    total_label: "סה״כ:",
    installment_badge_title: "תשלום {current} מתוך {total} (תאריך מקורי: {date}, סה״כ: {amount})",
    th_category: "קטגוריה",
    th_set_always: "קבע תמיד",
    th_action: "פעולה",
    btn_submit_row: "הזן",
    badge_saved: "✓ נשמר",
    badge_rule: "חוק קיים",
    choose_category: "-- בחר קטגוריה --",
    custom_category_option: "+ קטגוריה חדשה...",
    enter_custom_category: "הזן שם קטגוריה חדשה...",
    all_expenses_submitted_title: "כל ההוצאות כבר הוזנו!",
    all_expenses_submitted_sub: "כל {count} ההוצאות מקובץ זה כבר רשומות במערכת.",
    btn_view_transactions: "צפה בעסקאות",
    skipped_tracking_banner: "<strong>{skipped}</strong> הוצאות מקובץ זה כבר הוזנו בעבר ודולגו. מציג <strong>{pending}</strong> הוצאות שנותרו.",

    // Budget Tab
    budget_tab_title: "ניהול תקציב",
    add_budget_title: "➕ הוספה / עדכון תקציב לפי קטגוריה",
    add_budget_sub: "הגדר יעד חודשי לכל קטגוריה. ההוצאות ינוטרו אוטומטית מול היעד.",
    lbl_category_name: "שם קטגוריה",
    ph_category_name: "למשל: סופרמרקט או מסעדות",
    lbl_monthly_amount: "סכום תקציב חודשי",
    btn_save_budget: "שמור תקציב",
    upload_budget_title: "📤 העלאת תקציב מקובץ CSV",
    upload_budget_sub: "ייבא את יעדי התקציב החודשיים מקובץ גיליון אלקטרוני.",
    dropzone_budget: "גרור ושחרר קובץ תקציב CSV כאן",
    btn_select_csv: "בחר קובץ",
    map_budget_columns: "התאמת עמודות תקציב",
    lbl_budget_cat_col: "עמודת קטגוריה:",
    lbl_budget_amt_col: "עמודת סכום:",
    btn_import_budget: "ייבא תקציב ←",
    budget_table_title: "סטטוס תקציב והוצאות בפועל",
    budget_table_sub: "השוואה בין התקציב שהוקצה להוצאות בפועל.",
    btn_clear_all_budgets: "נקה את כל התקציבים",
    th_cat: "קטגוריה",
    th_budget: "תקציב",
    th_spent: "הוצאות בפועל",
    th_remaining: "יתרה",
    th_usage: "ניצול",
    th_status: "סטטוס",
    badge_over_budget: "חריגה",
    badge_near_limit: "קרוב ליעד",
    badge_on_track: "במסגרת",
    btn_delete: "מחק",
    no_budgets_table: "עדיין לא הוגדרו תקציבים. העלה קובץ תקציב למעלה!",

    // Transactions Tab
    tx_table_title: "כל ההוצאות שנרשמו",
    tx_table_sub: "מציג את כל העסקאות",
    showing_tx_for_month: "מציג עסקאות עבור {month}",
    btn_clear_all_tx: "נקה את כל ההוצאות",
    ph_search_business: "חיפוש לפי שם בית עסק...",
    opt_all_categories: "כל הקטגוריות",
    btn_edit_category: "ערוך קטגוריה",
    no_transactions_table: "לא נמצאו עסקאות התואמות לחיפוש.",

    // Always-Set Rules Tab
    rules_tab_title: "➕ הוספת חוק סיווג קבוע",
    rules_tab_sub: "בכל פעם שתועלה עסקה עם שם עסק זה, היא תסווג אוטומטית לקטגוריה זו.",
    lbl_rule_biz: "שם בית עסק או תבנית Glob",
    ph_rule_biz: "למשל: PAYPAL * או Starbucks",
    hint_rule_glob: "תומך בשמות מדויקים או תבניות כגון <code>PAYPAL *</code>, <code>*AMAZON*</code>, <code>SHELL [0-9]*</code>",
    lbl_rule_cat: "קטגוריה",
    ph_rule_cat: "למשל: מנויים",
    btn_save_rule: "שמור חוק",
    rules_info_title: "⚡ כיצד פועלים חוקי סיווג ותבניות Glob",
    rules_info_1: "ללא מאמץ: ברגע שמסמנים \"קבע תמיד\" בעת הזנת הוצאה, המערכת זוכרת את המיפוי לתמיד.",
    rules_info_2: "ללא תלות באותיות רישיות: \"starbucks\", \"STARBUCKS\", ו-\"Starbucks\" יתאימו כולם לאותו חוק.",
    rules_info_3: "עדיפות להתאמה מדויקת: שמות עסק מדויקים קודמים תמיד לתבניות glob.",
    rules_info_glob_title: "אפשרויות לתבניות Glob:",
    rules_info_glob_star: "* — מתאים לכל רצף תווים (למשל: PAYPAL * יתאים ל-PAYPAL *SPOTIFY)",
    rules_info_glob_quest: "? — מתאים לתו בודד בדיוק (למשל: STORE ?? יתאים ל-STORE 01)",
    rules_info_glob_seq: "[seq] — מתאים לתו מתוך הרצף (למשל: SHELL [0-9]*, [A-Z]*)",
    rules_info_glob_notseq: "[!seq] — מתאים לתו שאינו ברצף (למשל: STORE [!0-9]*)",
    rules_info_4: "ניתן לעריכה תמיד: תוכל לערוך או למחוק חוקים בכל עת במסך זה.",
    saved_rules_title: "חוקי סיווג שמורים",
    th_rule_pattern: "שם בית עסק / תבנית",
    th_rule_category: "קטגוריה קבועה",
    th_rule_created: "נוצר / עודכן",
    btn_delete_rule: "מחק חוק",
    badge_glob: "תבנית",
    badge_exact: "מדויק",
    no_rules_table: "אין עדיין חוקים שמורים. כשמסמנים \"קבע תמיד\" בעת העלאת CSV, חוקים יופיעו כאן!",

    // Modal
    modal_edit_title: "עריכת קטגוריית הוצאה",
    lbl_modal_biz: "שם בית עסק:",
    lbl_modal_amt: "סכום:",
    lbl_modal_new_cat: "קטגוריה חדשה:",
    lbl_modal_always: "עדכן חוק זיכרון קבוע (\"קבע תמיד\") עבור בית עסק זה",
    btn_save_changes: "שמור שינויים",
    btn_cancel: "ביטול",

    // Toasts & Messages
    toast_language_changed: "השפה שונתה לעברית",
    toast_currency_changed: "המטבע שונה ל-{code} ({symbol})",
    toast_rule_saved: "חוק נשמר: \"{biz}\" ← \"{cat}\"",
    toast_budget_saved: "התקציב עבור \"{cat}\" הוגדר ל-{amount}",
    toast_budget_deleted: "התקציב נמחק",
    toast_budgets_cleared: "כל התקציבים נמחקו",
    toast_tx_deleted: "העסקה נמחקה",
    toast_tx_cleared: "כל ההוצאות נמחקו",
    toast_choose_cat_for: "אנא בחר קטגוריה עבור \"{biz}\" לפני ההזנה.",
    toast_single_saved: "ההוצאה נשמרה ונזכרה עבור \"{biz}\" כ-\"{cat}\"",
    toast_single_saved_no_rule: "ההוצאה נשמרה עבור \"{biz}\" כ-\"{cat}\"",
    toast_all_ready_saved: "הוזנו בהצלחה {count} הוצאות!",
    toast_reading_file: "קורא קובץ {filename}...",
    toast_loaded_rows: "נטענו {count} שורות מתוך {filename}. אנא ודא את העמודות.",
    toast_valid_csv: "אנא העלה קובץ CSV תקין (.csv)",
    toast_found_budget_rows: "נמצאו {count} שורות תקציב. אשר את העמודות לייבוא.",
    toast_budget_imported: "יובאו בהצלחה {count} קטגוריות תקציב!",
    confirm_clear_all_tx: "האם אתה בטוח שברצונך למחוק את כל ההוצאות? לא ניתן לבטל פעולה זו.",
    confirm_clear_all_budgets: "האם אתה בטוח שברצונך למחוק את כל התקציבים?",
    confirm_delete_budget: "למחוק קטגוריית תקציב זו?",
    confirm_delete_tx: "למחוק עסקה זו?",
    confirm_delete_rule: "למחוק את חוק הסיווג הקבוע עבור \"{biz}\"?"
  }
};

let currentLanguage = "en";

function t(key, params = {}) {
  const langDict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
  let text = langDict[key] || TRANSLATIONS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return text;
}

function setLanguage(lang, persist = true) {
  if (!TRANSLATIONS[lang]) lang = "en";
  currentLanguage = lang;

  const htmlEl = document.documentElement;
  htmlEl.setAttribute("lang", lang);
  htmlEl.setAttribute("dir", lang === "he" ? "rtl" : "ltr");

  // Sync select element if present
  const langSelect = document.getElementById("lang-select");
  if (langSelect && langSelect.value !== lang) {
    langSelect.value = lang;
  }

  // Update all elements with data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.innerHTML = t(key);
  });

  // Update placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", t(key));
  });

  // Update titles
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    el.setAttribute("title", t(key));
  });

  if (persist) {
    localStorage.setItem("expense_language", lang);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang })
    }).catch(err => console.warn("Failed to persist language:", err));
  }

  if (typeof window.onLanguageChanged === "function") {
    window.onLanguageChanged(lang);
  }
}
