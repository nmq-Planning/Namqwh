/* ============================================================
   Inventory ERP — Suppliers, Brands, Brand Detail, Analytics, Alerts
   ============================================================ */

function renderSuppliers() {
  const app = document.getElementById("app");
  const map = {};
  DATA.items.forEach((i) => {
    const key = i.supplier || "Unassigned";
    map[key] ??= { supplier: key, itemsCount: 0, inventoryValue: 0, monthlyCost: 0, leadTimes: [], criticalItems: 0, paymentRequired: 0, categories: new Set() };
    const s = map[key];
    s.itemsCount += 1;
    s.inventoryValue += i.inventoryValue;
    s.monthlyCost += i.monthlyStockCost;
    s.leadTimes.push(i.leadTime);
    if (i.orderStatus === "Critical") s.criticalItems += 1;
    s.paymentRequired += i.paymentToReachOptimum || 0;
    s.categories.add(i.category);
  });
  const allSuppliers = Object.values(map)
    .map((s) => ({
      ...s,
      categories: [...s.categories],
      avgLeadTime: +(s.leadTimes.reduce((a, b) => a + b, 0) / (s.leadTimes.length || 1)).toFixed(1),
      score: Math.max(0, Math.round(100 - (s.leadTimes.reduce((a, b) => a + b, 0) / (s.leadTimes.length || 1)) * 0.5 - (s.criticalItems / s.itemsCount) * 40)),
    }))
    .sort((a, b) => b.inventoryValue - a.inventoryValue)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  const categoryOptions = ["All", ...new Set(allSuppliers.flatMap((s) => s.categories))];

  function scoreInRange(score, range) {
    if (range === "All") return true;
    if (range === "high") return score >= 80;
    if (range === "medium") return score >= 50 && score < 80;
    if (range === "low") return score < 50;
    return true;
  }

  const search = SUP_SEARCH.trim().toLowerCase();
  const suppliers = allSuppliers.filter((s) => {
    if (search && !s.supplier.toLowerCase().includes(search)) return false;
    if (SUP_FILTERS.category !== "All" && !s.categories.includes(SUP_FILTERS.category)) return false;
    if (!scoreInRange(s.score, SUP_FILTERS.score)) return false;
    return true;
  });

  const totalValue = suppliers.reduce((s, x) => s + x.inventoryValue, 0);
  const totalCritical = suppliers.reduce((s, x) => s + x.criticalItems, 0);
  const isAdmin = ROLE_PERMISSIONS[CURRENT_USER.role].canEditSettings;

  function creditTermsSummary(supplier) {
    const terms = getSupplierTerms(supplier);
    if (!terms.creditRequired) return t("sup.noCredit");
    return terms.paymentType === "percentage" ? `${terms.paymentValue}%` : formatCurrency(terms.paymentValue);
  }

  app.innerHTML = `
    <div class="space-y-6">
      <div><h1 class="text-xl font-bold">${t("sup.title")}</h1><p class="text-sm text-erp-muted">${t("sup.subtitle")}</p></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${kpiCard(t("kpi.suppliers"), formatNumber(suppliers.length), "truck", "navy")}
        ${kpiCard(t("kpi.totalInventoryValue"), formatCurrency(totalValue), "dollar-sign", "success")}
        ${kpiCard(t("kpi.criticalItems"), formatNumber(totalCritical), "alert-triangle", "critical")}
        ${kpiCard(t("kpi.topSupplier"), suppliers[0] ? suppliers[0].supplier : "-", "package", "accent")}
      </div>
      <div class="card p-3 flex flex-wrap gap-2 items-center">
        <div class="relative">
          <i data-lucide="search" style="width:14px;height:14px" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="supSearch" value="${escapeAttr(SUP_SEARCH)}" placeholder="${t("sup.searchPlaceholder")}" class="field-input" style="width:16rem;padding-left:2rem" />
        </div>
        <select id="supCategory" class="field-input" style="width:auto">${categoryOptions.map((c) => `<option value="${escapeAttr(c)}" ${c === SUP_FILTERS.category ? "selected" : ""}>${c === "All" ? t("inv.allCategories") : c}</option>`).join("")}</select>
        <select id="supScore" class="field-input" style="width:auto">
          <option value="All" ${SUP_FILTERS.score === "All" ? "selected" : ""}>${t("sup.allScores")}</option>
          <option value="high" ${SUP_FILTERS.score === "high" ? "selected" : ""}>${t("sup.scoreHigh")}</option>
          <option value="medium" ${SUP_FILTERS.score === "medium" ? "selected" : ""}>${t("sup.scoreMedium")}</option>
          <option value="low" ${SUP_FILTERS.score === "low" ? "selected" : ""}>${t("sup.scoreLow")}</option>
        </select>
      </div>
      <div class="card overflow-x-auto">
        <table class="erp-table">
          <thead><tr><th>${t("sup.rank")}</th><th>${t("col.supplier")}</th><th>${t("sup.items")}</th><th>${t("col.inventoryValue")}</th><th>${t("sup.monthlyCost")}</th><th>${t("sup.avgLeadTime")}</th><th>${t("sup.criticalItems")}</th><th>${t("col.paymentRequired")}</th><th>${t("sup.score")}</th><th>${t("sup.creditTerms")}</th></tr></thead>
          <tbody>
            ${suppliers
              .map(
                (s) =>
                  `<tr><td class="font-semibold">${s.rank}</td><td><a href="#/suppliers/${encodeURIComponent(s.supplier)}" class="text-erp-accent font-medium hover:underline">${escapeHtml(s.supplier)}</a></td><td>${formatNumber(s.itemsCount)}</td><td>${formatCurrency(s.inventoryValue)}</td><td>${formatCurrency(s.monthlyCost)}</td><td>${formatNumber(s.avgLeadTime)} ${t("pd.days")}</td><td>${s.criticalItems}</td><td>${formatCurrency(s.paymentRequired)}</td><td class="font-semibold">${s.score}</td><td>${escapeHtml(creditTermsSummary(s.supplier))}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        ${suppliers.length === 0 ? `<p class="text-xs text-erp-muted p-4">${t("sup.noMatches")}</p>` : ""}
      </div>
      ${
        isAdmin
          ? `<div class="card p-5 space-y-3">
        <h3 class="text-sm font-semibold">${t("sup.creditTerms")}</h3>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("col.supplier")}</span>
            <select id="ctSupplier" class="field-input">${allSuppliers.map((s) => `<option value="${escapeAttr(s.supplier)}">${escapeAttr(s.supplier)}</option>`).join("")}</select>
          </label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="ctRequired" /> ${t("sup.creditRequired")}</label>
          <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("sup.paymentType")}</span>
            <select id="ctType" class="field-input">
              <option value="percentage">${t("sup.paymentPercentage")}</option>
              <option value="amount">${t("sup.paymentAmount")}</option>
            </select>
          </label>
          <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("sup.paymentValue")}</span>
            <input id="ctValue" type="number" min="0" step="0.01" class="field-input" />
          </label>
        </div>
        <button id="ctSave" class="btn btn-primary"><i data-lucide="save" style="width:14px;height:14px"></i> ${t("sup.saveTerms")}</button>
        <div id="ctMsg"></div>
      </div>`
          : ""
      }
    </div>
  `;

  document.getElementById("supSearch").addEventListener("input", (e) => {
    SUP_SEARCH = e.target.value;
    renderSuppliers();
  });
  document.getElementById("supCategory").addEventListener("change", (e) => {
    SUP_FILTERS.category = e.target.value;
    renderSuppliers();
  });
  document.getElementById("supScore").addEventListener("change", (e) => {
    SUP_FILTERS.score = e.target.value;
    renderSuppliers();
  });

  if (isAdmin && allSuppliers.length) {
    const supplierSelect = document.getElementById("ctSupplier");
    const requiredCb = document.getElementById("ctRequired");
    const typeSelect = document.getElementById("ctType");
    const valueInput = document.getElementById("ctValue");

    function loadFormFor(supplier) {
      const terms = getSupplierTerms(supplier);
      requiredCb.checked = terms.creditRequired;
      typeSelect.value = terms.paymentType;
      valueInput.value = terms.paymentValue || "";
    }
    loadFormFor(supplierSelect.value);
    supplierSelect.addEventListener("change", () => loadFormFor(supplierSelect.value));

    document.getElementById("ctSave").addEventListener("click", () => {
      const supplier = supplierSelect.value;
      SUPPLIER_TERMS[supplier] = {
        creditRequired: requiredCb.checked,
        paymentType: typeSelect.value,
        paymentValue: Number(valueInput.value) || 0,
      };
      saveSupplierTerms();
      renderSuppliers();
      const msgEl = document.getElementById("ctMsg");
      if (msgEl) msgEl.innerHTML = msgBox(t("sup.creditSaved"), "success");
    });
  }

  if (window.lucide) lucide.createIcons();
}

// Drill-down: everything a single supplier provides. Mirrors the
// Category/Brand detail pages so the UX is consistent across the app.
function renderSupplierDetail(supplierName) {
  const app = document.getElementById("app");
  const items = DATA.items.filter((i) => (i.supplier || "Unassigned") === supplierName);
  if (!items.length) {
    app.innerHTML = `<div class="space-y-4"><a href="#/suppliers" class="inline-flex items-center gap-1 text-sm text-erp-accent"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> ${t("sup.backToSuppliers")}</a><p class="text-sm text-erp-muted">"${escapeHtml(supplierName)}" ${t("pd.notFound")}</p></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  const inventoryValue = items.reduce((s, i) => s + i.inventoryValue, 0);
  const monthlyCost = items.reduce((s, i) => s + i.monthlyStockCost, 0);
  const avgLeadTime = +(items.reduce((s, i) => s + i.leadTime, 0) / items.length).toFixed(1);
  const criticalItems = items.filter((i) => i.orderStatus === "Critical").length;
  const categories = [...new Set(items.map((i) => i.category))];

  app.innerHTML = `
    <div class="space-y-6">
      <a href="#/suppliers" class="inline-flex items-center gap-1 text-sm text-erp-accent"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> ${t("sup.backToSuppliers")}</a>
      <div><h1 class="text-xl font-bold">${escapeHtml(supplierName)}</h1><p class="text-sm text-erp-muted">${t("sup.itemsSuppliedBy")} ${escapeHtml(supplierName)} &middot; ${categories.join(", ")}</p></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${kpiCard(t("kpi.itemsCount"), formatNumber(items.length), "package", "navy")}
        ${kpiCard(t("kpi.inventoryValue"), formatCurrency(inventoryValue), "dollar-sign", "success")}
        ${kpiCard(t("sup.monthlyCost"), formatCurrency(monthlyCost), "wallet", "accent")}
        ${kpiCard(t("kpi.avgLeadTime"), `${formatNumber(avgLeadTime)} ${t("pd.days")}`, "clock", "muted")}
      </div>
      <div id="grid" class="ag-theme-quartz rounded-xl2 overflow-hidden border border-erp-border shadow-card" style="height:560px;width:100%"></div>
    </div>
  `;
  createInventoryGrid("grid", items);
  if (window.lucide) lucide.createIcons();
}

function renderBrands() {
  const app = document.getElementById("app");
  const allBrands = BRANDS.map((brand) => {
    const brandItems = DATA.items.filter((i) => i.brands[brand]);
    const itemsUsed = brandItems.length;
    const inventoryValue = brandItems.reduce((s, i) => s + i.inventoryValue, 0);
    const monthlyDemand = brandItems.reduce((s, i) => s + i.monthlyDemand, 0);
    const avgCoverage = brandItems.reduce((s, i) => s + i.coverage, 0) / (brandItems.length || 1);
    const criticalItems = brandItems.filter((i) => i.orderStatus === "Critical").length;
    return { brand, itemsUsed, inventoryValue, monthlyDemand, avgCoverage, criticalItems };
  });
  const search = BRAND_SEARCH.trim().toLowerCase();
  const brands = search ? allBrands.filter((b) => b.brand.toLowerCase().includes(search)) : allBrands;

  app.innerHTML = `
    <div class="space-y-6">
      <div><h1 class="text-xl font-bold">${t("brand.title")}</h1><p class="text-sm text-erp-muted">${t("brand.subtitle")}</p></div>
      <div class="card p-3 flex flex-wrap gap-2 items-center">
        <div class="relative">
          <i data-lucide="search" style="width:14px;height:14px" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="brandSearch" value="${escapeAttr(BRAND_SEARCH)}" placeholder="${t("brand.searchPlaceholder")}" class="field-input" style="width:16rem;padding-left:2rem" />
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${brands
          .map(
            (b) => `
          <a href="#/brands/${b.brand}" class="block card p-4 hover:shadow-cardHover transition-shadow">
            <h3 class="text-base font-semibold">${b.brand}</h3>
            <div class="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div><span class="text-erp-muted block text-xs">${t("brand.itemsUsed")}</span>${formatNumber(b.itemsUsed)}</div>
              <div><span class="text-erp-muted block text-xs">${t("kpi.inventoryValue")}</span>${formatCurrency(b.inventoryValue)}</div>
              <div><span class="text-erp-muted block text-xs">${t("kpi.monthlyDemand")}</span>${formatNumber(b.monthlyDemand)}</div>
              <div><span class="text-erp-muted block text-xs">${t("kpi.avgCoverage")}</span>${formatNumber(b.avgCoverage)} ${t("pd.days")}</div>
              <div><span class="text-erp-muted block text-xs">${t("kpi.criticalItems")}</span>${formatNumber(b.criticalItems)}</div>
            </div>
          </a>`
          )
          .join("")}
        ${brands.length === 0 ? `<p class="text-xs text-erp-muted">${t("sup.noMatches")}</p>` : ""}
      </div>
    </div>
  `;
  document.getElementById("brandSearch").addEventListener("input", (e) => {
    BRAND_SEARCH = e.target.value;
    renderBrands();
  });
  if (window.lucide) lucide.createIcons();
}

function renderBrandDetail(brand) {
  const app = document.getElementById("app");
  const items = DATA.items.filter((i) => i.brands[brand]);
  app.innerHTML = `
    <div class="space-y-4">
      <a href="#/brands" class="inline-flex items-center gap-1 text-sm text-erp-accent"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> ${t("brand.backToBrands")}</a>
      <div><h1 class="text-xl font-bold">${brand}</h1><p class="text-sm text-erp-muted">${t("brand.itemsUsedBy")} ${brand}.</p></div>
      <div id="grid" class="ag-theme-quartz rounded-xl2 overflow-hidden border border-erp-border shadow-card" style="height:560px;width:100%"></div>
    </div>
  `;
  createInventoryGrid("grid", items);
}

function renderAnalytics() {
  const app = document.getElementById("app");
  const categories = ["All", ...new Set(DATA.items.map((i) => i.category))];
  const suppliersList = ["All", ...new Set(DATA.items.map((i) => i.supplier).filter(Boolean))];
  if (!categories.includes(AN_FILTERS.category)) AN_FILTERS.category = "All";
  if (!suppliersList.includes(AN_FILTERS.supplier)) AN_FILTERS.supplier = "All";

  const filteredItems = DATA.items.filter((i) => {
    if (AN_FILTERS.category !== "All" && i.category !== AN_FILTERS.category) return false;
    if (AN_FILTERS.supplier !== "All" && i.supplier !== AN_FILTERS.supplier) return false;
    return true;
  });
  const a = buildAnalyticsAggregates(filteredItems);
  const insights = generateAIInsights(filteredItems);
  const deadStock = deadStockList(filteredItems);

  app.innerHTML = `
    <div class="space-y-6">
      <div><h1 class="text-xl font-bold">${t("an.title")}</h1><p class="text-sm text-erp-muted">${t("an.subtitle")}</p></div>
      <div class="card p-3 flex flex-wrap gap-2 items-center">
        <select id="anCategory" class="field-input" style="width:auto">${categories.map((c) => `<option value="${escapeAttr(c)}" ${c === AN_FILTERS.category ? "selected" : ""}>${c === "All" ? t("inv.allCategories") : c}</option>`).join("")}</select>
        <select id="anSupplier" class="field-input" style="width:auto">${suppliersList.map((c) => `<option value="${escapeAttr(c)}" ${c === AN_FILTERS.supplier ? "selected" : ""}>${c === "All" ? t("inv.allSuppliers") : c}</option>`).join("")}</select>
      </div>
      <div class="card p-4">
        <h3 class="text-sm font-semibold mb-3 flex items-center gap-2"><i data-lucide="lightbulb" style="width:16px;height:16px" class="text-amber-500"></i> ${t("an.insights")}</h3>
        <ul class="space-y-1.5">${insights.map((s) => `<li class="text-sm flex gap-2"><span class="text-erp-accent">&bull;</span> ${s}</li>`).join("") || `<p class="text-xs text-erp-muted">${t("sup.noMatches")}</p>`}</ul>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        ${chartCardShell("cCategory", t("dash.valueByCategory"))}
        ${chartCardShell("cSupplier", t("cat.valueBySupplier"))}
        ${chartCardShell("cCost", t("an.costByCategory"))}
        ${chartCardShell("cStockDemand", t("an.stockVsDemand"))}
        ${chartCardShell("cCoverage", t("an.coverageDist"))}
        ${chartCardShell("cLeadTime", t("an.leadTimeDist"))}
        ${chartCardShell("cCriticality", t("an.criticalityDist"))}
        ${chartCardShell("cABC", t("an.abc"))}
        ${chartCardShell("cXYZ", t("an.xyz"))}
        ${chartCardShell("cFSN", t("an.fsn"))}
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div class="card p-4"><h3 class="text-sm font-semibold mb-2">${t("an.top20Value")}</h3>${miniTable(a.topValueItems, [["itemCode", t("col.itemCode")], ["description", t("col.description")], ["inventoryValue", t("col.inventoryValue"), formatCurrency]])}</div>
        <div class="card p-4"><h3 class="text-sm font-semibold mb-2">${t("an.top20Coverage")}</h3>${miniTable(a.topLowCoverage, [["itemCode", t("col.itemCode")], ["description", t("col.description")], ["coverage", t("col.coverage"), formatNumber]])}</div>
        <div class="card p-4"><h3 class="text-sm font-semibold mb-2">${t("an.top20Demand")}</h3>${miniTable(a.topDemand, [["itemCode", t("col.itemCode")], ["description", t("col.description")], ["monthlyDemand", t("col.monthlyDemand"), formatNumber]])}</div>
      </div>
      <div class="card p-4">
        <h3 class="text-sm font-semibold mb-2">${t("an.deadStock")}</h3>
        ${deadStock.length ? miniTable(deadStock, [["itemCode", t("col.itemCode")], ["description", t("col.description")], ["daysWithoutUsage", "Days"], ["inventoryValue", t("col.inventoryValue"), formatCurrency], ["supplier", t("col.supplier")], ["recommendedAction", "Action"]]) : `<p class="text-xs text-erp-muted">${t("an.noDeadStock")}</p>`}
      </div>
    </div>
  `;

  document.getElementById("anCategory").addEventListener("change", (e) => {
    AN_FILTERS.category = e.target.value;
    renderAnalytics();
  });
  document.getElementById("anSupplier").addEventListener("change", (e) => {
    AN_FILTERS.supplier = e.target.value;
    renderAnalytics();
  });

  echarts.init(document.getElementById("cCategory")).setOption({
    tooltip: { trigger: "item" }, legend: { bottom: 0, textStyle: { fontSize: 10 } },
    series: [{ type: "pie", radius: ["40%", "70%"], data: Object.entries(a.byCategory).map(([name, v]) => ({ name, value: +v.value.toFixed(0) })) }],
  });
  echarts.init(document.getElementById("cSupplier")).setOption({
    tooltip: { trigger: "axis" }, grid: { left: 60, right: 20, bottom: 70 },
    xAxis: { type: "category", data: Object.keys(a.bySupplier), axisLabel: { rotate: 30, fontSize: 9 } }, yAxis: { type: "value" },
    series: [{ type: "bar", data: Object.values(a.bySupplier).map((v) => +v.value.toFixed(0)), itemStyle: { color: SETTINGS.primaryColor, borderRadius: [6, 6, 0, 0] } }],
  });
  echarts.init(document.getElementById("cCost")).setOption({
    tooltip: { trigger: "axis" }, xAxis: { type: "category", data: Object.keys(a.byCategory), axisLabel: { fontSize: 9 } }, yAxis: { type: "value" },
    series: [{ type: "bar", data: Object.values(a.byCategory).map((v) => +v.cost.toFixed(0)), itemStyle: { color: "#16A34A", borderRadius: [6, 6, 0, 0] } }],
  });
  echarts.init(document.getElementById("cStockDemand")).setOption({
    tooltip: { trigger: "axis" }, legend: { top: 0 },
    xAxis: { type: "category", data: Object.keys(a.byCategory), axisLabel: { fontSize: 9 } }, yAxis: { type: "value" },
    series: [
      { name: t("kpi.currentStock"), type: "bar", data: Object.values(a.byCategory).map((v) => v.stock), itemStyle: { color: SETTINGS.primaryColor } },
      { name: t("kpi.monthlyDemand"), type: "bar", data: Object.values(a.byCategory).map((v) => v.demand), itemStyle: { color: "#D97706" } },
    ],
  });
  echarts.init(document.getElementById("cCoverage")).setOption({
    tooltip: { trigger: "axis" }, xAxis: { type: "category", data: Object.keys(a.coverageBuckets) }, yAxis: { type: "value" },
    series: [{ type: "bar", data: Object.values(a.coverageBuckets), itemStyle: { color: "#D97706", borderRadius: [6, 6, 0, 0] } }],
  });
  echarts.init(document.getElementById("cLeadTime")).setOption({
    tooltip: { trigger: "axis" }, xAxis: { type: "category", data: Object.keys(a.leadTimeBuckets) }, yAxis: { type: "value" },
    series: [{ type: "bar", data: Object.values(a.leadTimeBuckets), itemStyle: { color: "#2563EB", borderRadius: [6, 6, 0, 0] } }],
  });
  echarts.init(document.getElementById("cCriticality")).setOption({
    tooltip: { trigger: "item" }, legend: { bottom: 0 },
    series: [{ type: "pie", radius: "65%", data: Object.entries(a.criticalityBuckets).map(([name, value]) => ({ name: t("crit." + name), value })) }],
  });
  echarts.init(document.getElementById("cABC")).setOption({
    tooltip: { trigger: "item" }, legend: { bottom: 0 },
    series: [{ type: "pie", radius: ["40%", "70%"], data: Object.entries(a.abcBuckets).map(([name, value]) => ({ name, value })) }],
  });
  echarts.init(document.getElementById("cXYZ")).setOption({
    tooltip: { trigger: "item" }, legend: { bottom: 0 },
    series: [{ type: "pie", radius: ["40%", "70%"], data: Object.entries(a.xyzBuckets).map(([name, value]) => ({ name, value })) }],
  });
  echarts.init(document.getElementById("cFSN")).setOption({
    tooltip: { trigger: "item" }, legend: { bottom: 0, textStyle: { fontSize: 10 } },
    series: [{ type: "pie", radius: ["40%", "70%"], data: Object.entries(a.fsnBuckets).map(([name, value]) => ({ name, value })) }],
  });
}

function renderAlerts() {
  const app = document.getElementById("app");
  const itemLookup = {};
  DATA.items.forEach((i) => (itemLookup[i.itemCode] = i));
  const categories = ["All", ...new Set(DATA.items.map((i) => i.category))];
  const suppliersList = ["All", ...new Set(DATA.items.map((i) => i.supplier).filter(Boolean))];
  if (!categories.includes(ALERTS_FILTERS.category)) ALERTS_FILTERS.category = "All";
  if (!suppliersList.includes(ALERTS_FILTERS.supplier)) ALERTS_FILTERS.supplier = "All";

  const bySelectors = DATA.alerts.filter((al) => {
    const item = itemLookup[al.itemCode];
    if (ALERTS_FILTERS.category !== "All" && (!item || item.category !== ALERTS_FILTERS.category)) return false;
    if (ALERTS_FILTERS.supplier !== "All" && (!item || item.supplier !== ALERTS_FILTERS.supplier)) return false;
    return true;
  });

  app.innerHTML = `
    <div class="space-y-6">
      <div><h1 class="text-xl font-bold">${t("alerts.title")}</h1><p class="text-sm text-erp-muted">${t("alerts.subtitle")}</p></div>
      <div class="card p-3 flex flex-wrap gap-2 items-center">
        <select id="alCategory" class="field-input" style="width:auto">${categories.map((c) => `<option value="${escapeAttr(c)}" ${c === ALERTS_FILTERS.category ? "selected" : ""}>${c === "All" ? t("inv.allCategories") : c}</option>`).join("")}</select>
        <select id="alSupplier" class="field-input" style="width:auto">${suppliersList.map((c) => `<option value="${escapeAttr(c)}" ${c === ALERTS_FILTERS.supplier ? "selected" : ""}>${c === "All" ? t("inv.allSuppliers") : c}</option>`).join("")}</select>
      </div>
      <div class="flex gap-2 flex-wrap" id="alertTabs">
        ${["All", "critical", "warning", "info"]
          .map((tab) => {
            const label = tab === "All" ? t("alerts.all") : t("alerts." + tab);
            const count = tab === "All" ? bySelectors.length : bySelectors.filter((a) => a.severity === tab).length;
            return `<button data-tab="${tab}" class="btn ${tab === ALERTS_FILTERS.severity ? "btn-primary" : ""}">${label} (${count})</button>`;
          })
          .join("")}
      </div>
      <div id="alertGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"></div>
      <p id="alertEmpty" class="text-sm text-erp-muted hidden">${t("alerts.noneInCategory")}</p>
    </div>
  `;
  function showTab(tab) {
    ALERTS_FILTERS.severity = tab;
    const filtered = tab === "All" ? bySelectors : bySelectors.filter((a) => a.severity === tab);
    document.getElementById("alertGrid").innerHTML = filtered.map(alertCardHTML).join("");
    document.getElementById("alertEmpty").classList.toggle("hidden", filtered.length > 0);
    [...document.querySelectorAll("#alertTabs button")].forEach((b) => b.classList.toggle("btn-primary", b.dataset.tab === tab));
    if (window.lucide) lucide.createIcons();
  }
  document.querySelectorAll("#alertTabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.getElementById("alCategory").addEventListener("change", (e) => {
    ALERTS_FILTERS.category = e.target.value;
    renderAlerts();
  });
  document.getElementById("alSupplier").addEventListener("change", (e) => {
    ALERTS_FILTERS.supplier = e.target.value;
    renderAlerts();
  });
  showTab(ALERTS_FILTERS.severity);
}
