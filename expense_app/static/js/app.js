// Global state
let currentExpenseUploadId = null;
let currentBudgetUploadId = null;
let globalCategories = [];
let categoryChartInstance = null;
let latestPendingData = null;

// Month filtering state
let currentMonth = null;
let availableMonths = [];

function formatMonthLabel(monthStr) {
  if (!monthStr || monthStr === "all") {
    return t("opt_all_months");
  }
  const parts = monthStr.split("-");
  if (parts.length === 2) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(y) && !isNaN(m)) {
      const date = new Date(y, m - 1, 1);
      const locale = currentLanguage === "he" ? "he-IL" : "en-US";
      return date.toLocaleDateString(locale, { year: "numeric", month: "long" });
    }
  }
  return monthStr;
}

function updateMonthDropdowns() {
  const dropdownIds = ["dash-month-select", "budget-month-select", "tx-month-filter"];
  dropdownIds.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    const previousVal = select.value;
    select.innerHTML = "";

    // "all" option
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = t("opt_all_months");
    select.appendChild(allOpt);

    // If currentMonth is set and not "all" and not in availableMonths, add it to list
    const monthsList = [...availableMonths];
    if (currentMonth && currentMonth !== "all" && !monthsList.includes(currentMonth)) {
      monthsList.push(currentMonth);
      monthsList.sort().reverse();
    }

    monthsList.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = formatMonthLabel(m);
      select.appendChild(opt);
    });

    if (currentMonth) {
      select.value = currentMonth;
    } else if (previousVal) {
      select.value = previousVal;
    }
  });

  // Update subtitle in budget tab
  const budgetSub = document.getElementById("budget-month-subtitle");
  if (budgetSub) {
    if (!currentMonth || currentMonth === "all") {
      budgetSub.textContent = t("budget_month_all");
    } else {
      budgetSub.textContent = t("budget_month_for", { month: formatMonthLabel(currentMonth) });
    }
  }
}

function handleMonthChange(newMonth) {
  currentMonth = newMonth;
  updateMonthDropdowns();
  loadDashboard();
  loadBudgets();
  loadTransactions();
}

function navigateMonth(direction) {
  // direction: -1 for previous (older), +1 for next (newer)
  if (availableMonths.length === 0 && !currentMonth) return;

  if (!currentMonth || currentMonth === "all") {
    handleMonthChange(availableMonths.length > 0 ? availableMonths[0] : new Date().toISOString().substring(0, 7));
    return;
  }

  const idx = availableMonths.indexOf(currentMonth);
  if (idx !== -1) {
    // availableMonths is DESC: idx - 1 is newer (+1), idx + 1 is older (-1)
    const targetIdx = idx - direction;
    if (targetIdx >= 0 && targetIdx < availableMonths.length) {
      handleMonthChange(availableMonths[targetIdx]);
      return;
    }
  }

  // If at edge of availableMonths or current month not in availableMonths, step by 1 calendar month
  const parts = currentMonth.split("-");
  if (parts.length === 2) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = new Date(y, m - 1 + direction, 1);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, "0");
    handleMonthChange(`${ny}-${nm}`);
  }
}

function initMonthControls() {
  const dashSelect = document.getElementById("dash-month-select");
  if (dashSelect) {
    dashSelect.addEventListener("change", (e) => handleMonthChange(e.target.value));
  }
  const budgetSelect = document.getElementById("budget-month-select");
  if (budgetSelect) {
    budgetSelect.addEventListener("change", (e) => handleMonthChange(e.target.value));
  }
  const txSelect = document.getElementById("tx-month-filter");
  if (txSelect) {
    txSelect.addEventListener("change", (e) => handleMonthChange(e.target.value));
  }

  const prevBtn = document.getElementById("dash-month-prev");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => navigateMonth(-1));
  }
  const nextBtn = document.getElementById("dash-month-next");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => navigateMonth(1));
  }
}

// Currency state
let currentCurrency = {
  code: "USD",
  symbol: "$"
};

function formatCurrency(amount, withSign = true) {
  const num = typeof amount === "number" ? amount : parseFloat(amount) || 0;
  const isNeg = num < 0;
  const absFormatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const sym = currentCurrency.symbol || "$";
  const symStr = sym.length > 2 ? `${sym} ` : sym;

  if (!withSign) {
    return `${symStr}${absFormatted}`;
  }
  return isNeg ? `-${symStr}${absFormatted}` : `${symStr}${absFormatted}`;
}

async function initCurrency() {
  const select = document.getElementById("currency-select");
  if (!select) return;

  // 1. Check localStorage for immediate render without waiting for network
  const savedCode = localStorage.getItem("expense_currency_code");
  const savedSym = localStorage.getItem("expense_currency_symbol");
  if (savedCode && savedSym) {
    currentCurrency.code = savedCode;
    currentCurrency.symbol = savedSym;
    select.value = savedCode;
    updateCurrencySymbolLabels();
  }

  // 2. Sync with backend settings
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const settings = await res.json();
      if (settings.currency && settings.currency_symbol) {
        currentCurrency.code = settings.currency;
        currentCurrency.symbol = settings.currency_symbol;
        select.value = settings.currency;
        localStorage.setItem("expense_currency_code", settings.currency);
        localStorage.setItem("expense_currency_symbol", settings.currency_symbol);
        updateCurrencySymbolLabels();
      }
    }
  } catch (err) {
    console.warn("Could not sync currency settings from server:", err);
  }

  // 3. Dropdown change listener
  select.addEventListener("change", async () => {
    const selectedOption = select.options[select.selectedIndex];
    const code = select.value;
    const symbol = selectedOption.getAttribute("data-symbol") || "$";

    currentCurrency.code = code;
    currentCurrency.symbol = symbol;

    localStorage.setItem("expense_currency_code", code);
    localStorage.setItem("expense_currency_symbol", symbol);
    updateCurrencySymbolLabels();

    // Persist to server
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: code, currency_symbol: symbol })
      });
    } catch (err) {
      console.warn("Could not persist currency setting:", err);
    }

    showToast(t("toast_currency_changed", { code: code, symbol: symbol }), "info");

    // Re-render all views that display currency
    loadDashboard();
    loadTransactions();
    loadBudgets();
    if (latestPendingData) {
      renderCategorizationStep(latestPendingData);
    }
  });
}

function updateCurrencySymbolLabels() {
  document.querySelectorAll(".currency-symbol-label").forEach(el => {
    el.textContent = currentCurrency.symbol;
  });
}

async function initLanguage() {
  const select = document.getElementById("lang-select");
  if (!select) return;

  // 1. Check localStorage first for instant display
  const savedLang = localStorage.getItem("expense_language");
  if (savedLang) {
    setLanguage(savedLang, false);
    select.value = savedLang;
  }

  // 2. Sync from backend settings
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const settings = await res.json();
      if (settings.language) {
        setLanguage(settings.language, false);
        select.value = settings.language;
      }
    }
  } catch (err) {
    console.warn("Could not sync language settings from server:", err);
  }

  // 3. Dropdown change listener
  select.addEventListener("change", () => {
    const newLang = select.value;
    setLanguage(newLang, true);
    showToast(t("toast_language_changed"), "info");

    // Refresh active views to update dynamic text
    loadDashboard();
    loadTransactions();
    loadBudgets();
    loadRules();
    if (latestPendingData) {
      renderCategorizationStep(latestPendingData);
    }
  });
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  initLanguage();
  initCurrency();
  initNavigation();
  initMonthControls();
  initExpenseUpload();
  initBudgetUpload();
  initTransactions();
  initRules();
  initModals();

  // Language change listener hook
  window.onLanguageChanged = () => {
    updateMonthDropdowns();
  };

  // Load initial data
  loadCategories();
  loadDashboard();
});

// Toast notification helper
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : (type === 'error' ? '⚠️' : 'ℹ️')}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Navigation Tabs
function initNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-tab");
      switchTab(targetId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-tab").forEach(t => {
    t.classList.toggle("active", t.getAttribute("data-tab") === tabId);
  });
  document.querySelectorAll(".tab-pane").forEach(p => {
    p.classList.toggle("active", p.id === tabId);
  });

  if (tabId === "tab-dashboard") {
    loadDashboard();
  } else if (tabId === "tab-budget") {
    loadBudgets();
  } else if (tabId === "tab-transactions") {
    loadTransactions();
  } else if (tabId === "tab-rules") {
    loadRules();
  }
}

// Wizard Step Navigation
function goToStep(stepNumber) {
  document.querySelectorAll(".wizard-step").forEach((el, index) => {
    el.classList.toggle("active", index + 1 === stepNumber);
    el.classList.toggle("completed", index + 1 < stepNumber);
  });

  document.querySelectorAll(".wizard-content").forEach((el, index) => {
    el.classList.toggle("active", index + 1 === stepNumber);
  });
}

function resetExpenseWizard() {
  currentExpenseUploadId = null;
  const fileInput = document.getElementById("expenses-file-input");
  if (fileInput) fileInput.value = "";
  goToStep(1);
}

// ---------------- Categories ----------------

async function loadCategories() {
  try {
    const res = await fetch("/api/categories");
    if (!res.ok) return;
    globalCategories = await res.json();
    
    // Update datalist
    const datalist = document.getElementById("category-datalist");
    if (datalist) {
      datalist.innerHTML = globalCategories.map(c => `<option value="${escapeHtml(c)}">`).join("");
    }

    // Update filter dropdown in transactions
    const filterSelect = document.getElementById("tx-category-filter");
    if (filterSelect) {
      const currentVal = filterSelect.value;
      let html = '<option value="all">All Categories</option>';
      globalCategories.forEach(c => {
        html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
      });
      filterSelect.innerHTML = html;
      filterSelect.value = currentVal;
    }
  } catch (err) {
    console.error("Failed to load categories:", err);
  }
}

// ---------------- TAB 1: Dashboard ----------------

async function loadDashboard() {
  try {
    const url = currentMonth ? `/api/summary?month=${encodeURIComponent(currentMonth)}` : "/api/summary";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load summary");
    const data = await res.json();

    if (!currentMonth) {
      currentMonth = data.selected_month;
    }
    availableMonths = data.available_months || [];
    updateMonthDropdowns();

    // Stats cards
    document.getElementById("dash-total-spent").textContent = formatCurrency(data.total_spent);
    document.getElementById("dash-tx-count").textContent = `${data.transaction_count} ${data.transaction_count === 1 ? t("transaction_singular") : t("transaction_plural")}`;

    document.getElementById("dash-total-budget").textContent = formatCurrency(data.total_budget);
    document.getElementById("dash-budget-cat-count").textContent = `${data.budget_comparison.length} ${data.budget_comparison.length === 1 ? t("category_budget_singular") : t("category_budget_plural")}`;

    const remEl = document.getElementById("dash-total-remaining");
    const remIcon = document.getElementById("dash-remaining-icon");
    const remStatus = document.getElementById("dash-budget-status");

    remEl.textContent = formatCurrency(data.total_remaining);
    if (data.total_remaining < 0) {
      remEl.style.color = "var(--danger)";
      remIcon.className = "stat-icon red";
      remStatus.textContent = t("over_budget");
    } else {
      remEl.style.color = "var(--text-main)";
      remIcon.className = "stat-icon green";
      remStatus.textContent = t("within_budget");
    }

    document.getElementById("dash-rules-count").textContent = data.rules_count;
    document.getElementById("nav-rules-count").textContent = data.rules_count;

    // Render Chart
    renderCategoryChart(data.category_spending);

    // Render Budget Progress Bars
    renderBudgetProgress(data.budget_comparison, data.unbudgeted);

  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

function renderCategoryChart(categorySpending) {
  const chartCanvas = document.getElementById("categoryChart");
  const emptyState = document.getElementById("category-chart-empty");
  const labels = Object.keys(categorySpending);
  const values = Object.values(categorySpending);

  if (labels.length === 0) {
    chartCanvas.style.display = "none";
    emptyState.style.display = "block";
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
      categoryChartInstance = null;
    }
    return;
  }

  emptyState.style.display = "none";
  chartCanvas.style.display = "block";

  const palette = [
    "#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#06b6d4", "#ec4899", "#84cc16", "#14b8a6", "#6366f1",
    "#f97316", "#a855f7", "#64748b"
  ];

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  if (typeof Chart === 'undefined') {
    return;
  }

  categoryChartInstance = new Chart(chartCanvas, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            boxWidth: 12,
            font: { family: "'Inter', sans-serif", size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const val = ctx.raw || 0;
              return ` ${ctx.label}: ${formatCurrency(val)}`;
            }
          }
        }
      },
      cutout: "65%"
    }
  });
}

function renderBudgetProgress(budgetComparison, unbudgeted) {
  const container = document.getElementById("budget-progress-list");
  if (!container) return;

  if (budgetComparison.length === 0 && (!unbudgeted || unbudgeted.length === 0)) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${t("no_budgets_configured")}</p>
        <button class="btn btn-primary btn-sm" onclick="switchTab('tab-budget')">${t("btn_set_budget")}</button>
      </div>
    `;
    return;
  }

  let html = "";
  budgetComparison.forEach(item => {
    const pct = Math.min(item.percentage, 100);
    const statusClass = item.status === "over" ? "over" : (item.status === "warning" ? "warning" : "ok");
    const badgeHtml = item.status === "over"
      ? `<span class="badge badge-danger">${t("badge_over", { amount: formatCurrency(Math.abs(item.remaining)) })}</span>`
      : (item.status === "warning" 
          ? `<span class="badge badge-warning">${t("badge_used", { pct: item.percentage })}</span>`
          : `<span class="badge badge-success">${t("badge_left", { amount: formatCurrency(item.remaining) })}</span>`);

    html += `
      <div class="progress-list-item">
        <div class="progress-header">
          <strong>${escapeHtml(item.category)}</strong>
          <div>
            <span>${formatCurrency(item.spent)} / ${formatCurrency(item.budget)}</span>
            ${badgeHtml}
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${statusClass}" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  });

  if (unbudgeted && unbudgeted.length > 0) {
    html += `<div style="margin-top: 15px; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">${t("unbudgeted_spending")}</div>`;
    unbudgeted.forEach(item => {
      html += `
        <div class="progress-list-item" style="margin-top: 6px;">
          <div class="progress-header">
            <span>${escapeHtml(item.category)}</span>
            <span class="badge badge-neutral">${t("spent_no_budget", { amount: formatCurrency(item.spent) })}</span>
          </div>
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

// ---------------- TAB 2: Upload Expenses Workflow ----------------

function initExpenseUpload() {
  const dropzone = document.getElementById("expenses-dropzone");
  const fileInput = document.getElementById("expenses-file-input");

  if (dropzone && fileInput) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        handleExpenseFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleExpenseFile(e.target.files[0]);
      }
    });
  }

  // Step 2 Next button
  const btnNextCategorize = document.getElementById("btn-proceed-to-categorize");
  if (btnNextCategorize) {
    btnNextCategorize.addEventListener("click", proceedToCategorizeStep);
  }

  // Step 3 Buttons
  const btnCheckAllAlways = document.getElementById("btn-check-all-always");
  const btnUncheckAllAlways = document.getElementById("btn-uncheck-all-always");
  const btnSubmitAllReady = document.getElementById("btn-submit-all-ready");
  const btnConfirmImport = document.getElementById("btn-confirm-import");

  if (btnCheckAllAlways) {
    btnCheckAllAlways.addEventListener("click", () => {
      document.querySelectorAll("#pending-expenses-tbody .row-set-always-check").forEach(cb => cb.checked = true);
    });
  }
  if (btnUncheckAllAlways) {
    btnUncheckAllAlways.addEventListener("click", () => {
      document.querySelectorAll("#pending-expenses-tbody .row-set-always-check").forEach(cb => cb.checked = false);
    });
  }
  if (btnSubmitAllReady) {
    btnSubmitAllReady.addEventListener("click", confirmExpenseImport);
  }
  if (btnConfirmImport) {
    btnConfirmImport.addEventListener("click", confirmExpenseImport);
  }
}

async function handleExpenseFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showToast("Please upload a valid CSV file (.csv)", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    showToast(`Reading ${file.name}...`, "info");
    const res = await fetch("/api/expenses/upload-preview", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to inspect CSV");

    currentExpenseUploadId = data.upload_id;

    // Reset file input so user can re-upload same file if desired
    const fileInput = document.getElementById("expenses-file-input");
    if (fileInput) fileInput.value = "";

    // Populate the 3 select elements
    populateColumnSelect("map-date-col", data.headers, data.guesses.date);
    populateColumnSelect("map-biz-col", data.headers, data.guesses.business);
    populateColumnSelect("map-amount-col", data.headers, data.guesses.amount);

    // Update preview title
    const previewTitle = document.getElementById("csv-preview-title");
    if (previewTitle) {
      previewTitle.innerHTML = `CSV Preview — <strong>${escapeHtml(file.name)}</strong> (${data.total_rows} row${data.total_rows === 1 ? '' : 's'} detected):`;
    }

    // Render Preview Table
    renderCsvPreviewTable(data.headers, data.preview);

    goToStep(2);
    showToast(`Loaded ${data.total_rows} rows from ${file.name}. Please verify columns.`, "success");

  } catch (err) {
    showToast(err.message, "error");
  }
}

function populateColumnSelect(selectId, headers, selectedValue) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = headers.map(h => {
    const isSelected = h === selectedValue ? "selected" : "";
    return `<option value="${escapeHtml(h)}" ${isSelected}>${escapeHtml(h)}</option>`;
  }).join("");
}

function renderCsvPreviewTable(headers, previewRows) {
  const thead = document.getElementById("csv-preview-thead");
  const tbody = document.getElementById("csv-preview-tbody");

  if (!thead || !tbody) return;

  if (!headers || headers.length === 0) {
    thead.innerHTML = "";
    tbody.innerHTML = `<tr><td class="text-muted" style="text-align: center; padding: 1.5rem;">No preview columns found.</td></tr>`;
    return;
  }

  thead.innerHTML = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;

  if (!previewRows || previewRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${headers.length}" class="text-muted" style="text-align: center; padding: 1.5rem;">No data rows found.</td></tr>`;
    return;
  }

  tbody.innerHTML = previewRows.map(row => {
    if (Array.isArray(row)) {
      return `<tr>${row.map(cell => `<td>${escapeHtml(cell !== null && cell !== undefined ? String(cell) : "")}</td>`).join("")}</tr>`;
    } else {
      return `<tr>${headers.map(h => `<td>${escapeHtml(row[h] !== null && row[h] !== undefined ? String(row[h]) : "")}</td>`).join("")}</tr>`;
    }
  }).join("");
}

async function proceedToCategorizeStep() {
  const dateCol = document.getElementById("map-date-col").value;
  const bizCol = document.getElementById("map-biz-col").value;
  const amountCol = document.getElementById("map-amount-col").value;

  if (!dateCol || !bizCol || !amountCol) {
    showToast("Please select all 3 required columns (Date, Business Name, Amount)", "error");
    return;
  }

  try {
    showToast("Matching against remembered business rules...", "info");
    const res = await fetch("/api/expenses/analyze-columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_id: currentExpenseUploadId,
        date_col: dateCol,
        business_col: bizCol,
        amount_col: amountCol
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to analyze columns");

    globalCategories = data.categories || globalCategories;
    await loadCategories();

    renderCategorizationStep(data);
    goToStep(3);

  } catch (err) {
    showToast(err.message, "error");
  }
}

function buildCategorySelectorHtml(rowId, bizEscaped, defaultCategory) {
  if (globalCategories && globalCategories.length > 0) {
    let optionsHtml = `<option value="">${t("choose_category")}</option>`;
    globalCategories.forEach(cat => {
      const isSelected = (defaultCategory && cat.toLowerCase() === defaultCategory.toLowerCase()) ? "selected" : "";
      optionsHtml += `<option value="${escapeHtml(cat)}" ${isSelected}>${escapeHtml(cat)}</option>`;
    });
    optionsHtml += `<option value="__custom__">✏️ ${t("custom_category_option")}</option>`;

    return `
      <div class="category-field-wrapper" data-row-id="${rowId}">
        <select class="form-control row-category-select" data-row-id="${rowId}" onchange="handleCategorySelectChange(this)">
          ${optionsHtml}
        </select>
        <input type="text" class="form-control row-category-custom" 
               style="display: none; margin-top: 6px;" 
               placeholder="${t("enter_custom_category")}" 
               data-row-id="${rowId}">
      </div>
    `;
  } else {
    return `
      <div class="category-field-wrapper" data-row-id="${rowId}">
        <input type="text" class="form-control row-category-custom" 
               value="${escapeHtml(defaultCategory || '')}" 
               placeholder="${t("enter_custom_category")}" 
               data-row-id="${rowId}" required>
      </div>
    `;
  }
}

function handleCategorySelectChange(selectEl) {
  const wrapper = selectEl.closest(".category-field-wrapper");
  if (!wrapper) return;
  const customInput = wrapper.querySelector(".row-category-custom");
  if (customInput) {
    if (selectEl.value === "__custom__") {
      customInput.style.display = "block";
      customInput.focus();
    } else {
      customInput.style.display = "none";
      customInput.value = "";
    }
  }
}

function getCategoryFromRow(row) {
  const selectEl = row.querySelector(".row-category-select");
  const customInput = row.querySelector(".row-category-custom");
  if (selectEl) {
    if (selectEl.value === "__custom__" && customInput) {
      return customInput.value.trim();
    }
    return selectEl.value.trim();
  } else if (customInput) {
    return customInput.value.trim();
  }
  return "";
}

function addMonths(dateStr, monthsToAdd) {
  if (!monthsToAdd || !dateStr) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;

  const totalMonths = (y * 12 + m - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(d, daysInMonth);

  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

function toggleInstallmentRow(rowId) {
  if (!latestPendingData || !latestPendingData.pending_expenses) return;
  const item = latestPendingData.pending_expenses.find(t => t.row_id === rowId);
  if (!item) return;

  const check = document.querySelector(`.inst-check[data-row-id="${rowId}"]`);
  const inputs = document.getElementById(`inst-inputs-${rowId}`);
  const isChecked = check ? check.checked : false;

  item.is_installment = isChecked;
  if (inputs) {
    inputs.style.display = isChecked ? "flex" : "none";
  }

  if (isChecked) {
    const currInput = document.getElementById(`inst-curr-${rowId}`);
    const totalInput = document.getElementById(`inst-total-${rowId}`);
    let curr = parseInt(currInput?.value, 10) || item.current_installment || 1;
    let tot = parseInt(totalInput?.value, 10) || item.total_installments || 12;
    if (tot < 2) tot = 2;
    if (curr > tot) curr = 1;
    if (currInput) currInput.value = curr;
    if (totalInput) totalInput.value = tot;
    item.current_installment = curr;
    item.total_installments = tot;
  }

  updateInstallmentDate(rowId);
}

function updateInstallmentDate(rowId) {
  if (!latestPendingData || !latestPendingData.pending_expenses) return;
  const item = latestPendingData.pending_expenses.find(t => t.row_id === rowId);
  if (!item) return;

  const isInst = item.is_installment;
  const origDate = item.original_date || item.date;

  let effDate = origDate;
  let totalAmt = item.amount;

  if (isInst) {
    const currInput = document.getElementById(`inst-curr-${rowId}`);
    const totalInput = document.getElementById(`inst-total-${rowId}`);
    const curr = Math.max(1, parseInt(currInput?.value, 10) || 1);
    const tot = Math.max(2, parseInt(totalInput?.value, 10) || 2);
    item.current_installment = curr;
    item.total_installments = tot;
    effDate = addMonths(origDate, curr - 1);
    totalAmt = item.amount * tot;
    item.total_amount = totalAmt;
  }

  item.date = effDate;

  // Update Date cell
  const dateCell = document.getElementById(`date-cell-${rowId}`);
  if (dateCell) {
    dateCell.innerHTML = `
      <div class="date-main" style="font-weight: 500;">${escapeHtml(effDate)}</div>
      ${isInst && origDate !== effDate ? `<div class="text-muted" style="font-size: 0.72rem;">${t("orig_date_label")} ${escapeHtml(origDate)}</div>` : ''}
    `;
  }

  // Update Amount cell
  const amtCell = document.getElementById(`amount-cell-${rowId}`);
  if (amtCell) {
    amtCell.innerHTML = `
      <div><strong>${formatCurrency(item.amount)}</strong></div>
      ${isInst ? `<div class="text-muted" style="font-size: 0.72rem;">${t("total_label")} ${formatCurrency(totalAmt)}</div>` : ''}
    `;
  }
}

function renderCategorizationStep(data) {
  latestPendingData = data;
  const tbody = document.getElementById("pending-expenses-tbody");
  const countNum = document.getElementById("pending-count-num");
  const trackingBanner = document.getElementById("expenses-tracking-banner");

  const pendingExpenses = data.pending_expenses || [];
  const alreadySubmittedCount = data.already_submitted_count || 0;
  const totalFileRows = data.total_file_rows || (pendingExpenses.length + alreadySubmittedCount);

  // Update tracking banner
  if (trackingBanner) {
    if (alreadySubmittedCount > 0) {
      trackingBanner.style.display = "flex";
      trackingBanner.className = "status-banner";
      trackingBanner.innerHTML = `
        <span>ℹ️</span>
        <div>
          ${t("skipped_tracking_banner", { skipped: alreadySubmittedCount, pending: pendingExpenses.length })}
        </div>
      `;
    } else {
      trackingBanner.style.display = "none";
    }
  }

  if (countNum) {
    countNum.textContent = pendingExpenses.length;
  }

  if (pendingExpenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem 1.5rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
          <h3 style="margin-bottom: 0.5rem;">${t("all_expenses_submitted_title")}</h3>
          <p class="text-muted" style="margin-bottom: 1rem;">${t("all_expenses_submitted_sub", { count: totalFileRows })}</p>
          <button class="btn btn-primary btn-sm" onclick="switchTab('tab-transactions')">${t("btn_view_transactions")}</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pendingExpenses.map(item => {
    const bizEscaped = escapeHtml(item.business_name);
    const isInst = Boolean(item.is_installment);
    const origDate = item.original_date || item.date;

    return `
      <tr data-row-id="${item.row_id}" data-biz="${bizEscaped}">
        <td style="text-align: center; font-weight: 600; color: var(--text-muted);">${item.row_id}</td>
        <td id="date-cell-${item.row_id}">
          <div class="date-main" style="font-weight: 500;">${escapeHtml(item.date)}</div>
          ${isInst && origDate !== item.date ? `<div class="text-muted" style="font-size: 0.72rem;">${t("orig_date_label")} ${escapeHtml(origDate)}</div>` : ''}
        </td>
        <td>
          <strong>${bizEscaped}</strong>
          ${item.has_rule ? '<span class="badge badge-primary" style="margin-left: 5px; font-size: 0.68rem;">' + t("badge_rule") + '</span>' : ''}
        </td>
        <td id="amount-cell-${item.row_id}">
          <div><strong>${formatCurrency(item.amount)}</strong></div>
          ${isInst && item.total_amount ? `<div class="text-muted" style="font-size: 0.72rem;">${t("total_label")} ${formatCurrency(item.total_amount)}</div>` : ''}
        </td>
        <td style="text-align: center;">
          <div class="installment-control-box" data-row-id="${item.row_id}">
            <label class="inst-toggle-label" title="Toggle Installments / תשלומים">
              <input type="checkbox" class="inst-check" data-row-id="${item.row_id}" ${isInst ? 'checked' : ''} onchange="toggleInstallmentRow(${item.row_id})">
              <span>${t("lbl_installments")}</span>
            </label>
            <div class="inst-inputs-wrapper" id="inst-inputs-${item.row_id}" style="${isInst ? 'display: flex;' : 'display: none;'} align-items: center; justify-content: center; gap: 4px; margin-top: 4px;">
              <input type="number" min="1" max="120" class="form-control form-control-xs inst-curr" id="inst-curr-${item.row_id}" value="${item.current_installment || 1}" style="width: 44px; text-align: center; padding: 2px 4px; font-size: 0.82rem;" oninput="updateInstallmentDate(${item.row_id})" title="Current Payment / תשלום נוכחי">
              <span style="font-size: 0.8rem; color: var(--text-muted);">/</span>
              <input type="number" min="2" max="120" class="form-control form-control-xs inst-total" id="inst-total-${item.row_id}" value="${item.total_installments || 12}" style="width: 44px; text-align: center; padding: 2px 4px; font-size: 0.82rem;" oninput="updateInstallmentDate(${item.row_id})" title="Total Payments / סה״כ תשלומים">
            </div>
          </div>
        </td>
        <td>
          ${buildCategorySelectorHtml(item.row_id, bizEscaped, item.category)}
        </td>
        <td style="text-align: center;">
          <label class="set-always-label" title="Remember this category for ${bizEscaped}">
            <input type="checkbox" class="row-set-always-check" data-row-id="${item.row_id}" ${item.has_rule ? 'checked' : ''}>
            <span>${t("th_set_always")}</span>
          </label>
        </td>
        <td style="text-align: center;" class="row-action-cell">
          <button class="btn btn-primary btn-xs btn-submit-row" onclick="submitSingleExpenseRow(${item.row_id})">
            ${t("btn_submit_row")}
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function submitSingleExpenseRow(rowId) {
  if (!currentExpenseUploadId) {
    showToast("No active upload session found.", "error");
    return;
  }

  const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
  if (!row) return;

  const biz = row.getAttribute("data-biz");
  const selectEl = row.querySelector(".row-category-select");
  const customInput = row.querySelector(".row-category-custom");
  const alwaysCheck = row.querySelector(".row-set-always-check");
  const submitBtn = row.querySelector(".btn-submit-row");

  let cat = "";
  if (selectEl) {
    if (selectEl.value === "__custom__" && customInput) {
      cat = customInput.value.trim();
    } else {
      cat = selectEl.value.trim();
    }
  } else if (customInput) {
    cat = customInput.value.trim();
  }

  if (!cat) {
    showToast(t("toast_choose_cat_for", { biz: biz }), "error");
    if (selectEl) {
      selectEl.focus();
      selectEl.style.borderColor = "var(--danger)";
      setTimeout(() => { selectEl.style.borderColor = ""; }, 2000);
    }
    return;
  }

  const setAlways = alwaysCheck ? alwaysCheck.checked : false;

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "...";
    }

    const item = (latestPendingData?.pending_expenses || []).find(t => t.row_id === rowId);

    const res = await fetch("/api/expenses/submit-single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_id: currentExpenseUploadId,
        row_id: rowId,
        category: cat,
        set_always: setAlways,
        is_installment: item ? Boolean(item.is_installment) : false,
        current_installment: item ? item.current_installment : 1,
        total_installments: item ? item.total_installments : 1,
        original_date: item ? item.original_date : null,
        date: item ? item.date : null,
        total_amount: item ? item.total_amount : null
      })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Failed to submit expense");

    // Success: mark row as submitted
    row.classList.add("submitted-row");
    const actionCell = row.querySelector(".row-action-cell");
    if (actionCell) {
      actionCell.innerHTML = `<span class="badge badge-success">${t("badge_saved")}</span>`;
    }
    if (selectEl) selectEl.disabled = true;
    if (customInput) customInput.disabled = true;
    if (alwaysCheck) alwaysCheck.disabled = true;
    const instCheck = row.querySelector(".inst-check");
    const instCurr = row.querySelector(".inst-curr");
    const instTotal = row.querySelector(".inst-total");
    if (instCheck) instCheck.disabled = true;
    if (instCurr) instCurr.disabled = true;
    if (instTotal) instTotal.disabled = true;

    // If "Set Always" was checked, immediately update all other unsubmitted rows with this same business name!
    if (setAlways) {
      document.querySelectorAll(`tr[data-biz="${biz}"]:not(.submitted-row)`).forEach(otherRow => {
        const otherSelect = otherRow.querySelector(".row-category-select");
        if (otherSelect && !otherSelect.value) {
          otherSelect.value = cat;
        }
        const otherCheck = otherRow.querySelector(".row-set-always-check");
        if (otherCheck) {
          otherCheck.checked = true;
        }
      });
      showToast(t("toast_single_saved", { biz: biz, cat: cat }), "success");
    } else {
      showToast(t("toast_single_saved_no_rule", { biz: biz, cat: cat }), "success");
    }

    // Update pending count
    updatePendingCount();
    loadCategories();

  } catch (err) {
    showToast(err.message, "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }
}

function updatePendingCount() {
  const remainingRows = document.querySelectorAll("#pending-expenses-tbody tr:not(.submitted-row)");
  const countNum = document.getElementById("pending-count-num");
  if (countNum) {
    countNum.textContent = remainingRows.length;
  }
}

async function confirmExpenseImport() {
  if (!currentExpenseUploadId) {
    showToast("No active upload session found.", "error");
    return;
  }

  const unsubmittedRows = document.querySelectorAll("#pending-expenses-tbody tr:not(.submitted-row)");
  if (unsubmittedRows.length === 0) {
    showToast("No pending expenses left to submit.", "info");
    return;
  }

  const decisions = {};
  let uncategorizedCount = 0;

  unsubmittedRows.forEach(row => {
    const rowId = row.getAttribute("data-row-id");
    const alwaysCheck = row.querySelector(".row-set-always-check");
    const cat = getCategoryFromRow(row);
    const item = (latestPendingData?.pending_expenses || []).find(x => String(x.row_id) === String(rowId));

    if (cat) {
      decisions[rowId] = {
        category: cat,
        set_always: alwaysCheck ? alwaysCheck.checked : false,
        is_installment: item ? Boolean(item.is_installment) : false,
        current_installment: item ? item.current_installment : 1,
        total_installments: item ? item.total_installments : 1,
        original_date: item ? item.original_date : null,
        date: item ? item.date : null,
        total_amount: item ? item.total_amount : null
      };
    } else {
      uncategorizedCount++;
    }
  });

  const readyKeys = Object.keys(decisions);
  if (readyKeys.length === 0) {
    showToast("Please choose categories for the expenses before submitting.", "error");
    return;
  }

  try {
    const btn = document.getElementById("btn-confirm-import");
    btn.disabled = true;
    btn.textContent = "Saving...";

    const res = await fetch("/api/expenses/confirm-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_id: currentExpenseUploadId,
        decisions: decisions
      })
    });
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = "✓ Submit All Remaining Ready Expenses";

    if (!res.ok) throw new Error(data.error || "Failed to submit expenses");

    // Mark submitted rows
    readyKeys.forEach(rowId => {
      const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
      if (row) {
        row.classList.add("submitted-row");
        const actionCell = row.querySelector(".row-action-cell");
        if (actionCell) actionCell.innerHTML = `<span class="badge badge-success">✓ Saved</span>`;
        const sel = row.querySelector(".row-category-select");
        if (sel) sel.disabled = true;
        const chk = row.querySelector(".row-set-always-check");
        if (chk) chk.disabled = true;
      }
    });

    showToast(`Successfully submitted ${data.inserted_count} expenses!`, "success");
    updatePendingCount();
    await loadCategories();

    if (uncategorizedCount === 0) {
      resetExpenseWizard();
      switchTab("tab-dashboard");
    } else {
      showToast(`${uncategorizedCount} expenses still pending categorization.`, "info");
    }

  } catch (err) {
    showToast(err.message, "error");
    document.getElementById("btn-confirm-import").disabled = false;
  }
}

// ---------------- TAB 3: Budget Management ----------------

function initBudgetUpload() {
  const dropzone = document.getElementById("budget-dropzone");
  const fileInput = document.getElementById("budget-file-input");

  if (dropzone && fileInput) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        handleBudgetFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleBudgetFile(e.target.files[0]);
      }
    });
  }

  // Confirm budget upload button
  const btnConfirmBudgetUpload = document.getElementById("btn-confirm-budget-upload");
  if (btnConfirmBudgetUpload) {
    btnConfirmBudgetUpload.addEventListener("click", confirmBudgetCsvImport);
  }

  // Manual budget form
  const formManualBudget = document.getElementById("form-manual-budget");
  if (formManualBudget) {
    formManualBudget.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cat = document.getElementById("manual-budget-cat").value.trim();
      const amt = parseFloat(document.getElementById("manual-budget-amt").value);
      if (!cat || isNaN(amt)) return;

      try {
        const res = await fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: cat, amount: amt })
        });
        if (!res.ok) throw new Error("Failed to save budget");
        showToast(`Budget for "${cat}" set to ${formatCurrency(amt)}`, "success");
        formManualBudget.reset();
        await loadCategories();
        loadBudgets();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // Clear all budgets button
  const btnClearBudgets = document.getElementById("btn-clear-budgets");
  if (btnClearBudgets) {
    btnClearBudgets.addEventListener("click", async () => {
      if (confirm("Are you sure you want to clear all budget entries?")) {
        await fetch("/api/budgets/clear", { method: "POST" });
        showToast("All budgets cleared", "info");
        loadBudgets();
      }
    });
  }
}

async function handleBudgetFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showToast("Please upload a valid CSV file (.csv)", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/budget/upload-preview", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to inspect budget CSV");

    currentBudgetUploadId = data.budget_upload_id;

    // Show mapping controls
    populateColumnSelect("budget-map-cat", data.headers, data.guesses.category);
    populateColumnSelect("budget-map-amt", data.headers, data.guesses.amount);
    document.getElementById("budget-mapping-box").style.display = "block";
    showToast(`Found ${data.total_rows} budget rows. Confirm columns to import.`, "info");

  } catch (err) {
    showToast(err.message, "error");
  }
}

async function confirmBudgetCsvImport() {
  if (!currentBudgetUploadId) return;

  const catCol = document.getElementById("budget-map-cat").value;
  const amtCol = document.getElementById("budget-map-amt").value;

  try {
    const res = await fetch("/api/budget/confirm-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budget_upload_id: currentBudgetUploadId,
        category_col: catCol,
        amount_col: amtCol
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to import budget");

    showToast(`Successfully imported ${data.updated_count} budget categories!`, "success");
    document.getElementById("budget-mapping-box").style.display = "none";
    document.getElementById("budget-file-input").value = "";
    currentBudgetUploadId = null;

    await loadCategories();
    loadBudgets();

  } catch (err) {
    showToast(err.message, "error");
  }
}

async function loadBudgets() {
  try {
    const url = currentMonth ? `/api/summary?month=${encodeURIComponent(currentMonth)}` : "/api/summary";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load budget summary");
    const data = await res.json();

    const tbody = document.getElementById("budget-tbody");
    if (!tbody) return;

    if (data.budget_comparison.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            ${t("no_budgets_table")}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.budget_comparison.map(item => {
      const pct = Math.min(item.percentage, 100);
      const statusClass = item.status === "over" ? "over" : (item.status === "warning" ? "warning" : "ok");
      const badgeHtml = item.status === "over"
        ? `<span class="badge badge-danger">${t("badge_over_budget")}</span>`
        : (item.status === "warning" ? `<span class="badge badge-warning">${t("badge_near_limit")}</span>` : `<span class="badge badge-success">${t("badge_on_track")}</span>`);

      return `
        <tr>
          <td><strong>${escapeHtml(item.category)}</strong></td>
          <td>${formatCurrency(item.budget)}</td>
          <td>${formatCurrency(item.spent)}</td>
          <td style="color: ${item.remaining < 0 ? 'var(--danger)' : 'inherit'}; font-weight: 500;">
            ${formatCurrency(item.remaining)}
          </td>
          <td>
            <div class="progress-track">
              <div class="progress-fill ${statusClass}" style="width: ${pct}%;"></div>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
              ${item.percentage}% used
            </div>
          </td>
          <td>${badgeHtml}</td>
          <td style="text-align: right;">
            <button class="btn btn-outline btn-xs text-danger" onclick="deleteBudgetItem(${item.id})">${t("btn_delete")}</button>
          </td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    console.error("Budget load error:", err);
  }
}

async function deleteBudgetItem(id) {
  if (confirm(t("confirm_delete_budget"))) {
    await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    showToast(t("toast_budget_deleted"), "info");
    loadBudgets();
  }
}

// ---------------- TAB 4: Transactions ----------------

function initTransactions() {
  const searchInput = document.getElementById("tx-search-input");
  const catFilter = document.getElementById("tx-category-filter");
  const btnClearTx = document.getElementById("btn-clear-transactions");

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadTransactions, 250);
    });
  }

  if (catFilter) {
    catFilter.addEventListener("change", loadTransactions);
  }

  if (btnClearTx) {
    btnClearTx.addEventListener("click", async () => {
      if (confirm(t("confirm_clear_all_tx"))) {
        await fetch("/api/transactions/clear", { method: "POST" });
        showToast(t("toast_tx_cleared"), "info");
        loadTransactions();
      }
    });
  }
}

async function loadTransactions() {
  try {
    const search = document.getElementById("tx-search-input")?.value || "";
    const category = document.getElementById("tx-category-filter")?.value || "all";
    const month = document.getElementById("tx-month-filter")?.value || currentMonth || "all";

    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (category && category !== "all") params.append("category", category);
    if (month && month !== "all") params.append("month", month);

    const res = await fetch(`/api/transactions?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to load transactions");
    const txs = await res.json();

    const tbody = document.getElementById("transactions-tbody");
    const summaryText = document.getElementById("tx-summary-text");
    if (summaryText) {
      if (!month || month === "all") {
        summaryText.textContent = `${t("tx_table_sub")} (${txs.length})`;
      } else {
        summaryText.textContent = `${t("showing_tx_for_month", { month: formatMonthLabel(month) })} (${txs.length})`;
      }
    }

    if (!tbody) return;

    if (txs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            ${t("no_transactions_table")}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = txs.map(tx => {
      const isInst = Boolean(tx.is_installment);
      let instBadge = "";
      if (isInst) {
        const titleText = t("installment_badge_title", {
          current: tx.current_installment || 1,
          total: tx.total_installments || 1,
          date: escapeHtml(tx.original_date || tx.date),
          amount: formatCurrency(tx.total_amount || tx.amount)
        });
        instBadge = `<span class="badge badge-info" style="margin-inline-start: 6px; font-size: 0.72rem; cursor: help;" title="${titleText}">${tx.current_installment}/${tx.total_installments}</span>`;
      }

      return `
        <tr>
          <td>
            <div>${escapeHtml(tx.date)}</div>
            ${isInst && tx.original_date && tx.original_date !== tx.date ? `<div class="text-muted" style="font-size: 0.72rem;">${t("orig_date_label")} ${escapeHtml(tx.original_date)}</div>` : ''}
          </td>
          <td>
            <strong>${escapeHtml(tx.business_name)}</strong>
            ${instBadge}
          </td>
          <td><span class="badge badge-primary">${escapeHtml(tx.category)}</span></td>
          <td>
            <div><strong>${formatCurrency(tx.amount)}</strong></div>
            ${isInst && tx.total_amount ? `<div class="text-muted" style="font-size: 0.72rem;">${t("total_label")} ${formatCurrency(tx.total_amount)}</div>` : ''}
          </td>
          <td style="text-align: right;">
            <button class="btn btn-outline btn-xs" onclick="openEditTxModal(${tx.id}, '${escapeJs(tx.business_name)}', '${escapeJs(tx.category)}', ${tx.amount})">${t("btn_edit_category")}</button>
            <button class="btn btn-outline btn-xs text-danger" onclick="deleteTxItem(${tx.id})">${t("btn_delete")}</button>
          </td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    console.error("Failed to load transactions:", err);
  }
}

async function deleteTxItem(id) {
  if (confirm(t("confirm_delete_tx"))) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    showToast(t("toast_tx_deleted"), "info");
    loadTransactions();
  }
}

// ---------------- TAB 5: Always-Set Rules ----------------

function initRules() {
  const formManualRule = document.getElementById("form-manual-rule");
  if (formManualRule) {
    formManualRule.addEventListener("submit", async (e) => {
      e.preventDefault();
      const biz = document.getElementById("rule-biz-input").value.trim();
      const cat = document.getElementById("rule-cat-input").value.trim();
      if (!biz || !cat) return;

      try {
        const res = await fetch("/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_name: biz, category: cat })
        });
        if (!res.ok) throw new Error("Failed to save rule");
        showToast(t("toast_rule_saved", { biz: biz, cat: cat }), "success");
        formManualRule.reset();
        await loadCategories();
        loadRules();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
}

async function loadRules() {
  try {
    const res = await fetch("/api/rules");
    if (!res.ok) throw new Error("Failed to load rules");
    const rules = await res.json();

    const tbody = document.getElementById("rules-tbody");
    document.getElementById("nav-rules-count").textContent = rules.length;

    if (!tbody) return;

    if (rules.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            ${t("no_rules_table")}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rules.map(rule => {
      const isGlob = /[*?\[\]]/.test(rule.business_name);
      const typeBadge = isGlob
        ? `<span class="badge badge-purple" style="font-size: 0.68rem; margin-left: 6px;" title="Glob Pattern">${t("badge_glob")}</span>`
        : `<span class="badge badge-neutral" style="font-size: 0.68rem; margin-left: 6px;" title="Exact Match">${t("badge_exact")}</span>`;
      return `
        <tr>
          <td><strong>${escapeHtml(rule.business_name)}</strong> ${typeBadge}</td>
          <td><span class="badge badge-primary">${escapeHtml(rule.category)}</span></td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(rule.updated_at || rule.created_at)}</td>
          <td style="text-align: right;">
            <button class="btn btn-outline btn-xs text-danger" onclick="deleteRuleItem(${rule.id}, '${escapeJs(rule.business_name)}')">${t("btn_delete_rule")}</button>
          </td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    console.error("Rules load error:", err);
  }
}

async function deleteRuleItem(id, bizName) {
  if (confirm(t("confirm_delete_rule", { biz: bizName }))) {
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    showToast(t("confirm_delete_rule", { biz: bizName }), "info");
    loadRules();
  }
}

// ---------------- Modals ----------------

function initModals() {
  const saveBtn = document.getElementById("btn-save-edit-tx");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const id = document.getElementById("edit-tx-id").value;
      const biz = document.getElementById("edit-tx-biz").value;
      const cat = document.getElementById("edit-tx-category").value.trim();
      const setAlways = document.getElementById("edit-tx-set-always").checked;

      if (!cat) {
        showToast("Category cannot be empty", "error");
        return;
      }

      try {
        await fetch(`/api/transactions/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: cat })
        });

        if (setAlways) {
          await fetch("/api/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ business_name: biz, category: cat })
          });
          showToast(`Updated expense & remembered "${biz}" as "${cat}"`, "success");
        } else {
          showToast("Expense category updated", "success");
        }

        closeModal("edit-tx-modal");
        loadTransactions();
      } catch (err) {
        showToast("Failed to update transaction", "error");
      }
    });
  }
}

function openEditTxModal(id, biz, cat, amt) {
  document.getElementById("edit-tx-id").value = id;
  document.getElementById("edit-tx-biz").value = biz;
  document.getElementById("edit-tx-amt").value = formatCurrency(amt);
  document.getElementById("edit-tx-category").value = cat;
  document.getElementById("edit-tx-set-always").checked = false;
  document.getElementById("edit-tx-modal").style.display = "flex";
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}

// ---------------- Utility Helpers ----------------

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
