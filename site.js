(function () {
  const COLORS = {
    nfi_x3: "#3dff9a",
    nfi_x3b: "#b57aff",
    nfi_x1: "#ff8a3d",
    passivbot: "#4fd2ff",
  };

  const moneyFmt = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const pctFmt = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  });

  function money(v) {
    return v == null ? "нет данных" : moneyFmt.format(v) + " USDT";
  }
  function pct(v) {
    return v == null ? "нет данных" : pctFmt.format(v) + " %";
  }
  function cls(v) {
    if (v == null) return "muted";
    if (v > 0) return "pos";
    if (v < 0) return "neg";
    return "flat";
  }
  function text(v, suffix) {
    return v == null ? "нет данных" : String(v) + (suffix || "");
  }

  function row(b, isTotal) {
    const ok = b.status === "ok";
    const name = isTotal ? "Все роботы" : b.name;
    const dd = !ok || b.drawdown_usdt == null
      ? "нет данных"
      : money(b.drawdown_usdt) + (b.drawdown_pct != null ? " (" + moneyFmt.format(b.drawdown_pct) + " %)" : "");
    const cells = ok
      ? [
          name,
          money(b.balance_usdt),
          '<span class="' + cls(b.pnl_usdt) + '">' + money(b.pnl_usdt) + "</span>",
          '<span class="' + cls(b.pnl_pct) + '">' + pct(b.pnl_pct) + "</span>",
          dd,
          isTotal ? "—" : text(b.closed_trades),
          isTotal ? "—" : text(b.open_positions),
        ]
      : [name, "нет данных", "нет данных", "нет данных", "нет данных", "нет данных", "нет данных"];
    const tag = isTotal ? "th" : "td";
    return "<tr>" + cells.map(function (c) { return "<" + tag + ">" + c + "</" + tag + ">"; }).join("") + "</tr>";
  }

  function card(b, isTotal) {
    const ok = b.status === "ok";
    const name = isTotal ? "Все роботы" : b.name;
    if (!ok) {
      return '<article class="card stat-card"><h3>' + name + "</h3><p>нет данных</p></article>";
    }
    const rows = [
      ["Баланс", money(b.balance_usdt), ""],
      ["Результат", money(b.pnl_usdt), cls(b.pnl_usdt)],
      ["Доля", pct(b.pnl_pct), cls(b.pnl_pct)],
      ["Просадка", b.drawdown_usdt == null ? "нет данных" : money(b.drawdown_usdt) + (b.drawdown_pct != null ? " (" + moneyFmt.format(b.drawdown_pct) + " %)" : ""), ""],
    ];
    if (!isTotal) {
      rows.push(["Закрытых сделок", text(b.closed_trades), ""]);
      rows.push(["Открытых позиций", text(b.open_positions), ""]);
    }
    return (
      '<article class="card stat-card' + (isTotal ? " total" : "") + '"><h3>' + name + "</h3>" +
      rows.map(function (r) {
        return '<div class="row"><span>' + r[0] + '</span><span class="' + r[2] + '">' + r[1] + "</span></div>";
      }).join("") +
      "</article>"
    );
  }

  function renderTable(data) {
    const body = data.bots.map((b) => row(b, false)).join("");
    const foot = row(data.totals, true);
    document.getElementById("stats-body").innerHTML = body;
    document.getElementById("stats-foot").innerHTML = foot;
    document.getElementById("stats-cards").innerHTML =
      data.bots.map((b) => card(b, false)).join("") + card(data.totals, true);
  }

  function renderKpis(data) {
    const t = data.totals;
    const stamp = data.updated_at || "нет данных";
    document.getElementById("updated-at").textContent =
      "Цифры обновлены " + stamp + ". Источник: живые демо-роботы, не выдуманные значения.";
    const set = (id, value, className) => {
      const el = document.getElementById(id);
      el.textContent = value;
      el.className = "value " + (className || "");
    };
    if (t.status !== "ok") {
      set("kpi-pnl", "нет данных", "muted");
      set("kpi-pct", "нет данных", "muted");
      set("kpi-dd", "нет данных", "muted");
      set("kpi-count", "0 из 4", "muted");
      return;
    }
    set("kpi-pnl", money(t.pnl_usdt), cls(t.pnl_usdt));
    set("kpi-pct", pct(t.pnl_pct), cls(t.pnl_pct));
    set("kpi-dd", t.drawdown_usdt == null ? "нет данных" : money(t.drawdown_usdt), t.drawdown_usdt > 0 ? "neg" : "flat");
    set("kpi-count", t.bots_with_data + " из 4", "flat");
  }

  function drawChart(data) {
    const canvas = document.getElementById("balance-chart");
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 800;
    const cssH = 280;
    canvas.width = Math.round(cssW * ratio);
    canvas.height = Math.round(cssH * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const bots = data.bots.filter((b) => b.status === "ok" && b.series && b.series.length);
    if (!bots.length) {
      ctx.fillStyle = "#a8a2b8";
      ctx.font = "16px sans-serif";
      ctx.fillText("нет данных", 24, 40);
      return;
    }

    const days = Array.from(new Set(bots.flatMap((b) => b.series.map((p) => p.t)))).sort();
    const values = bots.flatMap((b) => b.series.map((p) => p.balance_usdt));
    let min = Math.min.apply(null, values);
    let max = Math.max.apply(null, values);
    if (min === max) {
      min -= 50;
      max += 50;
    }
    const pad = (max - min) * 0.12;
    min -= pad;
    max += pad;

    const left = 64;
    const right = cssW - 16;
    const top = 16;
    const bottom = cssH - 36;
    const xAt = (i) => left + (days.length === 1 ? 0 : (i / (days.length - 1)) * (right - left));
    const yAt = (v) => bottom - ((v - min) / (max - min)) * (bottom - top);

    ctx.strokeStyle = "rgba(176,132,255,0.22)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#a8a2b8";
    ctx.font = "12px sans-serif";
    for (let i = 0; i < 4; i++) {
      const v = min + ((max - min) * i) / 3;
      const y = yAt(v);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.fillText(moneyFmt.format(v), 4, y + 4);
    }
    days.forEach((d, i) => {
      const label = d.slice(8, 10) + "." + d.slice(5, 7);
      ctx.fillText(label, xAt(i) - 12, cssH - 12);
    });

    bots.forEach((b) => {
      const map = Object.fromEntries(b.series.map((p) => [p.t, p.balance_usdt]));
      ctx.beginPath();
      let started = false;
      days.forEach((d, i) => {
        if (map[d] == null) return;
        const x = xAt(i);
        const y = yAt(map[d]);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = COLORS[b.id] || "#fff";
      ctx.lineWidth = 2.4;
      ctx.stroke();
      days.forEach((d, i) => {
        if (map[d] == null) return;
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(map[d]), 3.2, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[b.id] || "#fff";
        ctx.fill();
      });
    });
  }

  function fail(msg) {
    document.getElementById("updated-at").textContent = msg;
    ["kpi-pnl", "kpi-pct", "kpi-dd", "kpi-count"].forEach((id) => {
      const el = document.getElementById(id);
      el.textContent = "нет данных";
      el.className = "value muted";
    });
    document.getElementById("stats-body").innerHTML =
      '<tr><td colspan="7">нет данных</td></tr>';
    document.getElementById("stats-foot").innerHTML = "";
    const canvas = document.getElementById("balance-chart");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#a8a2b8";
    ctx.font = "16px sans-serif";
    ctx.fillText("нет данных", 24, 40);
  }

  fetch("data.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("no json");
      return r.json();
    })
    .then((data) => {
      renderKpis(data);
      renderTable(data);
      drawChart(data);
      window.addEventListener("resize", () => drawChart(data));
    })
    .catch(() => fail("нет данных — не удалось загрузить data.json"));
})();
