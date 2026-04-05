(function () {
  "use strict";

  const fmtMoney = (n) =>
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 0,
    }).format(Math.round(n));

  const fmtPct = (n) =>
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n) + "%";

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const p = line.split(",");
      if (p.length < 5) continue;
      const [date, category, sales, profit, region] = p;
      out.push({
        date,
        category,
        sales: Number(sales),
        profit: Number(profit),
        region,
      });
    }
    return out;
  }

  let rawRows = [];
  let charts = { line: null, bar: null, pie: null };

  const el = (id) => document.getElementById(id);

  async function loadData() {
    const urls = ["data.csv", "../PP12_ISP23_dashboard.csv"];
    let text = null;
    let lastErr = null;
    for (const u of urls) {
      try {
        const r = await fetch(u + "?t=" + Date.now(), { cache: "no-store" });
        if (r.ok) {
          text = await r.text();
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!text) throw lastErr || new Error("Не удалось загрузить CSV");
    rawRows = parseCSV(text);
    return rawRows.length;
  }

  function getBounds(rows) {
    let min = null;
    let max = null;
    for (const r of rows) {
      const t = r.date;
      if (!min || t < min) min = t;
      if (!max || t > max) max = t;
    }
    return { min, max };
  }

  function buildFilterUI(rows) {
    const cats = [...new Set(rows.map((r) => r.category))].sort();
    const regs = [...new Set(rows.map((r) => r.region))].sort();
    const catBox = el("categoryFilters");
    const regBox = el("regionFilters");
    catBox.innerHTML = "";
    regBox.innerHTML = "";
    cats.forEach((c) => {
      const id = "cat_" + c.replace(/\W/g, "_");
      const lab = document.createElement("label");
      lab.innerHTML = `<input type="checkbox" checked data-kind="category" value="${c.replace(/"/g, "&quot;")}" id="${id}" /> ${c}`;
      catBox.appendChild(lab);
    });
    regs.forEach((r) => {
      const id = "reg_" + r.replace(/\W/g, "_");
      const lab = document.createElement("label");
      lab.innerHTML = `<input type="checkbox" checked data-kind="region" value="${r.replace(/"/g, "&quot;")}" id="${id}" /> ${r}`;
      regBox.appendChild(lab);
    });
    const { min, max } = getBounds(rows);
    el("dateFrom").value = min || "";
    el("dateTo").value = max || "";
    el("dateFrom").min = min || "";
    el("dateFrom").max = max || "";
    el("dateTo").min = min || "";
    el("dateTo").max = max || "";
  }

  function selectedCategories() {
    return [
      ...document.querySelectorAll(
        '#categoryFilters input[type="checkbox"]:checked'
      ),
    ].map((x) => x.value);
  }

  function selectedRegions() {
    return [
      ...document.querySelectorAll('#regionFilters input[type="checkbox"]:checked'),
    ].map((x) => x.value);
  }

  function filterRows(rows) {
    const from = el("dateFrom").value;
    const to = el("dateTo").value;
    const cats = new Set(selectedCategories());
    const regs = new Set(selectedRegions());
    return rows.filter((r) => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (cats.size && !cats.has(r.category)) return false;
      if (regs.size && !regs.has(r.region)) return false;
      return true;
    });
  }

  function aggregateByDate(rows) {
    const map = new Map();
    for (const r of rows) {
      map.set(r.date, (map.get(r.date) || 0) + r.sales);
    }
    const dates = [...map.keys()].sort();
    return { labels: dates, values: dates.map((d) => map.get(d)) };
  }

  function aggregateByCategory(rows) {
    const sales = new Map();
    const profit = new Map();
    for (const r of rows) {
      sales.set(r.category, (sales.get(r.category) || 0) + r.sales);
      profit.set(r.category, (profit.get(r.category) || 0) + r.profit);
    }
    const labels = [...sales.keys()].sort();
    return {
      labels,
      sales: labels.map((k) => sales.get(k)),
      profit: labels.map((k) => profit.get(k)),
    };
  }

  function aggregateByRegion(rows) {
    const map = new Map();
    for (const r of rows) {
      map.set(r.region, (map.get(r.region) || 0) + r.sales);
    }
    const labels = [...map.keys()].sort();
    return { labels, values: labels.map((k) => map.get(k)) };
  }

  function destroyCharts() {
    if (charts.line) {
      charts.line.destroy();
      charts.line = null;
    }
    if (charts.bar) {
      charts.bar.destroy();
      charts.bar = null;
    }
    if (charts.pie) {
      charts.pie.destroy();
      charts.pie = null;
    }
  }

  function chartCommonTheme() {
    Chart.defaults.color = "#8b9cb3";
    Chart.defaults.borderColor = "#2d3a4f";
  }

  function renderCharts(rows) {
    chartCommonTheme();
    destroyCharts();

    const lineData = aggregateByDate(rows);
    const barData = aggregateByCategory(rows);
    const pieData = aggregateByRegion(rows);

    const ctxL = el("chartLine").getContext("2d");
    charts.line = new Chart(ctxL, {
      type: "line",
      data: {
        labels: lineData.labels,
        datasets: [
          {
            label: "Выручка",
            data: lineData.values,
            borderColor: "#3b9eff",
            backgroundColor: "rgba(59, 158, 255, 0.15)",
            fill: true,
            tension: 0.2,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => " Выручка: " + fmtMoney(c.parsed.y),
            },
          },
        },
        scales: {
          x: {
            ticks: { maxRotation: 45, minRotation: 0, maxTicksLimit: 14 },
            grid: { color: "#243044" },
          },
          y: {
            beginAtZero: true,
            grid: { color: "#243044" },
            ticks: {
              callback: (v) => fmtMoney(v),
            },
          },
        },
      },
    });

    const ctxB = el("chartBar").getContext("2d");
    charts.bar = new Chart(ctxB, {
      type: "bar",
      data: {
        labels: barData.labels,
        datasets: [
          {
            label: "Выручка",
            data: barData.sales,
            backgroundColor: "rgba(59, 158, 255, 0.75)",
          },
          {
            label: "Прибыль",
            data: barData.profit,
            backgroundColor: "rgba(52, 211, 153, 0.75)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              label: (c) =>
                " " + c.dataset.label + ": " + fmtMoney(c.parsed.y),
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => fmtMoney(v) },
            grid: { color: "#243044" },
          },
        },
      },
    });

    const colors = [
      "#3b9eff",
      "#34d399",
      "#fbbf24",
      "#a78bfa",
      "#fb7185",
      "#2dd4bf",
    ];
    const ctxP = el("chartPie").getContext("2d");
    charts.pie = new Chart(ctxP, {
      type: "pie",
      data: {
        labels: pieData.labels,
        datasets: [
          {
            data: pieData.values,
            backgroundColor: pieData.labels.map(
              (_, i) => colors[i % colors.length]
            ),
            borderColor: "#1a2332",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right" },
          tooltip: {
            callbacks: {
              label: (c) => {
                const total = c.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total ? (c.parsed / total) * 100 : 0;
                return (
                  " " +
                  c.label +
                  ": " +
                  fmtMoney(c.parsed) +
                  " (" +
                  fmtPct(pct) +
                  ")"
                );
              },
            },
          },
        },
      },
    });
  }

  function renderKPI(rows) {
    let sales = 0;
    let profit = 0;
    const days = new Set();
    for (const r of rows) {
      sales += r.sales;
      profit += r.profit;
      days.add(r.date);
    }
    const nDays = days.size || 1;
    const margin = sales > 0 ? (profit / sales) * 100 : 0;
    const avgDaily = sales / nDays;

    el("valSales").textContent = fmtMoney(sales) + " ₽";
    el("valProfit").textContent = fmtMoney(profit) + " ₽";
    el("valMargin").textContent = fmtPct(margin);
    el("valAvgDaily").textContent = fmtMoney(avgDaily) + " ₽";

    const sorted = [...rows].sort((a, b) => b.profit - a.profit);
    const best = sorted[0];
    el("hintProfit").textContent = best
      ? "лучший день по прибыли: " +
        best.date +
        " (" +
        fmtMoney(best.profit) +
        " ₽)"
      : "нет данных";
    el("hintDays").textContent =
      "уникальных дней в выборке: " + String(days.size);
  }

  function renderTable(rows) {
    const tbody = el("tableBody");
    tbody.innerHTML = "";
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    let maxP = -Infinity;
    for (const r of sorted) {
      if (r.profit > maxP) maxP = r.profit;
    }
    const display = sorted.slice(-200);
    for (const r of display) {
      const tr = document.createElement("tr");
      const m = r.sales > 0 ? (r.profit / r.sales) * 100 : 0;
      if (maxP > -Infinity && r.profit === maxP) tr.classList.add("row-key");
      tr.innerHTML =
        "<td>" +
        r.date +
        "</td><td>" +
        r.category +
        "</td><td>" +
        r.region +
        '</td><td class="numeric">' +
        fmtMoney(r.sales) +
        '</td><td class="numeric">' +
        fmtMoney(r.profit) +
        '</td><td class="numeric">' +
        fmtPct(m) +
        "</td>";
      tbody.appendChild(tr);
    }
    if (sorted.length > 200) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td colspan="6" style="color:var(--muted);font-size:0.8rem;">Показаны последние 200 строк из ' +
        sorted.length +
        "</td>";
      tbody.insertBefore(tr, tbody.firstChild);
    }
  }

  function refreshUI() {
    const rows = filterRows(rawRows);
    el("dataMeta").textContent =
      "Записей в выборке: " +
      rows.length +
      " · обновлено: " +
      new Date().toLocaleString("ru-RU");
    renderKPI(rows);
    renderCharts(rows);
    renderTable(rows);
  }

  function resetFilters() {
    buildFilterUI(rawRows);
    refreshUI();
  }

  async function init() {
    try {
      const n = await loadData();
      buildFilterUI(rawRows);
      el("dataMeta").textContent =
        "Загружено строк: " + n + " · " + new Date().toLocaleString("ru-RU");
    } catch (e) {
      el("dataMeta").textContent =
        "Ошибка загрузки. Запустите локальный сервер из папки проекта, например: python -m http.server 8080";
      console.error(e);
      return;
    }

    el("btnRefresh").addEventListener("click", async () => {
      el("dataMeta").textContent = "Обновление…";
      try {
        await loadData();
        refreshUI();
      } catch (err) {
        el("dataMeta").textContent = "Ошибка обновления";
        console.error(err);
      }
    });

    el("btnReset").addEventListener("click", resetFilters);

    ["dateFrom", "dateTo"].forEach((id) => {
      el(id).addEventListener("change", refreshUI);
    });

    document
      .getElementById("categoryFilters")
      .addEventListener("change", refreshUI);
    document
      .getElementById("regionFilters")
      .addEventListener("change", refreshUI);

    refreshUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
