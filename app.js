/* ============================================================
   app.js — النسخة النهائية المستقرة
   ============================================================ */

const showDuration = 400;

/* عناصر العرض */
const totalYerEl = document.getElementById("total-yer");
const totalSarEl = document.getElementById("total-sar");
const totalUsdEl = document.getElementById("total-usd");

const origTotalYerEl = document.getElementById("orig-total-yer");
const origTotalSarEl = document.getElementById("orig-total-sar");
const origTotalUsdEl = document.getElementById("orig-total-usd");

const goldTotalEl = document.getElementById("gold-total");
const goldGramsEl = document.getElementById("gold-grams");

const debtsToMeEl = document.getElementById("debts-to-me");
const debtsOnMeEl = document.getElementById("debts-on-me");

const zakatDueEl = document.getElementById("zakat-due");
const zakatPaidEl = document.getElementById("zakat-paid");
const zakatRemainingEl = document.getElementById("zakat-remaining");
const zakatPercentEl = document.getElementById("zakat-percent");
const zakatProgressInner = document.getElementById("zakat-progress-inner");

const trendYer = document.getElementById("trend-yer");
const trendSar = document.getElementById("trend-sar");
const trendUsd = document.getElementById("trend-usd");

const cards = Array.from(document.querySelectorAll(".card"));
const quickRefreshBtn = document.getElementById("quickRefreshBtn");

let prevTotalsRaw = JSON.parse(sessionStorage.getItem("cachedTotalsRaw") || "null");

/* -------------------- 1) أنيميشن الأرقام -------------------- */
function animateNumber(el, value, opts = {}) {
    if (!el) return;
    const duration = opts.duration || 800;
    const start = 0;
    const startTime = performance.now();
    const format = opts.format || (v => v.toLocaleString());

    function frame(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = t < 0.5 ? 2*t*t : -1 + (4 - 2*t) * t;
        const val = Math.round(start + (value - start) * eased);
        el.innerHTML = format(val);
        if (t < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

/* -------------------- 2) حساب القيم الخام -------------------- */
async function calculateTotalsRaw() {
    await waitForRates();

    const assets = await getAllData("assets");
    const debts = await getAllData("debts");

    let totalYER = 0;
    let goldYER = 0, goldGrams = 0;
    let origYER = 0, origSAR = 0, origUSD = 0;

    assets.forEach(a => {
        if (a.type === "zakat_payment") return;
        if (a.type === "zakat_base_year") return;

        if (a.type === "gold") {
            goldGrams += Number(a.value || 0);
            goldYER += convertToYER(a.value, a.currency, "gold");
            totalYER += convertToYER(a.value, a.currency, "gold");
            return;
        }

        totalYER += convertToYER(a.value, a.currency, a.type);

        if (a.currency === "YER") origYER += Number(a.value || 0);
        else if (a.currency === "SAR") origSAR += Number(a.value || 0);
        else if (a.currency === "USD") origUSD += Number(a.value || 0);
    });

    let debtsMine = 0, debtsOwed = 0;
    debts.forEach(d => {
        if (d.type === "owed_to_me") debtsMine += convertToYER(d.value, d.currency);
        if (d.type === "owed_by_me") debtsOwed += convertToYER(d.value, d.currency);
    });

    const year = new Date().getFullYear();
    const fixedBase = await getZakatFixedBase(year);

    let zakatDue = 0;
    if (fixedBase && fixedBase > 0)
        zakatDue = Math.round(fixedBase * 0.025);
    else {
        const nisaab = currentRates.GOLD_PER_GRAM_YER * 85;
        zakatDue = totalYER >= nisaab ? Math.round(totalYER * 0.025) : 0;
    }

    const yearPayments = assets.filter(
        p => p.type === "zakat_payment" && Number(p.zakat_year) === year
    );
    const zakatPaid = yearPayments.reduce((s,p)=> s + Number(p.value||0), 0);

    return {
        totalYER,
        totalSAR: totalYER / currentRates.SAR_TO_YER,
        totalUSD: totalYER / currentRates.USD_TO_YER,
        origYER, origSAR, origUSD,
        goldYER, goldGrams,
        debtsMine, debtsOwed,
        zakatDue, zakatPaid
    };
}

/* -------------------- 3) اتجاه التغيير -------------------- */
function setTrend(el, current, previous) {
    if (!el) return;
    if (previous == null) return el.innerHTML = "";
    if (current > previous) el.innerHTML = `<span class="trend up">▲</span>`;
    else if (current < previous) el.innerHTML = `<span class="trend down">▼</span>`;
    else el.innerHTML = "";
}

/* -------------------- 4) عرض البيانات -------------------- */
async function displayTotals(useCache = true) {
    const cached = sessionStorage.getItem("cachedTotalsPretty");

    if (useCache && cached) {
        const p = JSON.parse(cached);
        const t = p._raw;

        if (!t) return;

        animateNumber(totalYerEl, t.totalYER, { format: v => v.toLocaleString() + " YER" });
        animateNumber(totalSarEl, t.totalSAR, { format: v => v.toLocaleString() + " SAR" });
        animateNumber(totalUsdEl, t.totalUSD, { format: v => v.toLocaleString() + " USD" });

        animateNumber(origTotalYerEl, t.origYER, { format: v => v.toLocaleString() + " YER" });
        animateNumber(origTotalSarEl, t.origSAR, { format: v => v.toLocaleString() + " SAR" });
        animateNumber(origTotalUsdEl, t.origUSD, { format: v => v.toLocaleString() + " USD" });

        animateNumber(goldTotalEl, t.goldYER, { format: v => v.toLocaleString() + " YER" });
        goldGramsEl.textContent = t.goldGrams + " g";

        animateNumber(debtsToMeEl, t.debtsMine, { format: v => v.toLocaleString() + " YER" });
        animateNumber(debtsOnMeEl, t.debtsOwed, { format: v => v.toLocaleString() + " YER" });

        animateNumber(zakatDueEl, t.zakatDue, { format: v => v.toLocaleString() + " YER" });
        animateNumber(zakatPaidEl, t.zakatPaid, { format: v => v.toLocaleString() + " YER" });

        const remaining = t.zakatDue - t.zakatPaid;
        animateNumber(zakatRemainingEl, remaining, { format: v => v.toLocaleString() + " YER" });

        const pct = t.zakatDue ? Math.round((t.zakatPaid / t.zakatDue) * 100) : 0;
        zakatProgressInner.style.width = pct + "%";
        zakatPercentEl.textContent = pct + "%";

        setTrend(trendYer, t.totalYER, prevTotalsRaw?.totalYER);
        setTrend(trendSar, t.totalSAR, prevTotalsRaw?.totalSAR);
        setTrend(trendUsd, t.totalUSD, prevTotalsRaw?.totalUSD);

        return;
    }

    /* حساب جديد */
    const t = await calculateTotalsRaw();

    animateNumber(totalYerEl, t.totalYER, { format: v => v.toLocaleString() + " YER" });
    animateNumber(totalSarEl, t.totalSAR, { format: v => v.toLocaleString() + " SAR" });
    animateNumber(totalUsdEl, t.totalUSD, { format: v => v.toLocaleString() + " USD" });

    animateNumber(origTotalYerEl, t.origYER, { format: v => v.toLocaleString() + " YER" });
    animateNumber(origTotalSarEl, t.origSAR, { format: v => v.toLocaleString() + " SAR" });
    animateNumber(origTotalUsdEl, t.origUSD, { format: v => v.toLocaleString() + " USD" });

    animateNumber(goldTotalEl, t.goldYER, { format: v => v.toLocaleString() + " YER" });
    goldGramsEl.textContent = t.goldGrams + " g";

    animateNumber(debtsToMeEl, t.debtsMine, { format: v => v.toLocaleString() + " YER" });
    animateNumber(debtsOnMeEl, t.debtsOwed, { format: v => v.toLocaleString() + " YER" });

    animateNumber(zakatDueEl, t.zakatDue, { format: v => v.toLocaleString() + " YER" });
    animateNumber(zakatPaidEl, t.zakatPaid, { format: v => v.toLocaleString() + " YER" });

    const remaining = t.zakatDue - t.zakatPaid;
    animateNumber(zakatRemainingEl, remaining, { format: v => v.toLocaleString() + " YER" });

    const pct = t.zakatDue ? Math.round((t.zakatPaid / t.zakatDue) * 100) : 0;
    zakatProgressInner.style.width = pct + "%";
    zakatPercentEl.textContent = pct + "%";

    setTrend(trendYer, t.totalYER, prevTotalsRaw?.totalYER);
    setTrend(trendSar, t.totalSAR, prevTotalsRaw?.totalSAR);
    setTrend(trendUsd, t.totalUSD, prevTotalsRaw?.totalUSD);

    sessionStorage.setItem("cachedTotalsPretty", JSON.stringify({ _raw: t }));
    sessionStorage.setItem("cachedTotalsRaw", JSON.stringify(t));
    prevTotalsRaw = t;
}

/* -------------------- 5) آخر تحديث -------------------- */
async function updateLastUpdateLabels() {
    try {
        const rates = await getAllData("rates");
        const lastUpdate = rates.find(r => r.key === "LAST_UPDATE");
        if (!lastUpdate) return;

        const date = new Date(lastUpdate.value);
        const formatted = date.toLocaleString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });

        const globalLabel = document.getElementById("global-last-update");
        if (globalLabel)
            globalLabel.textContent = "آخر تحديث: " + formatted;

    } catch (e) {
        console.warn("updateLastUpdateLabels error", e);
    }
}

/* -------------------- 6) anim ظهور البطاقات -------------------- */
function startCardsSequence() {
    cards.forEach((c,i) => {
        setTimeout(() => {
            c.style.opacity = "1";
            c.style.transform = "translateY(0)";
        }, 50 * i);
    });
}

/* -------------------- 7) زر التحديث السريع -------------------- */
quickRefreshBtn?.addEventListener("click", async () => {

    // 1) مسح الكاش
    sessionStorage.removeItem("cachedTotalsPretty");
    sessionStorage.removeItem("cachedTotalsRaw");

    // 2) تحديث وقت LAST_UPDATE داخل قاعدة البيانات
    await putData("rates", {
        id: "LAST_UPDATE",
        key: "LAST_UPDATE",
        value: new Date().toISOString()
    });

    // 3) عرض الأرقام من جديد
    await displayTotals(false);

    // 4) تحديث "آخر تحديث" الموحد
    await updateLastUpdateLabels();
});

/* -------------------- 8) عند تحميل الصفحة -------------------- */
document.addEventListener("DOMContentLoaded", async () => {
    const cached = sessionStorage.getItem("cachedTotalsPretty");

    if (cached) {
        await displayTotals(true);
        await updateLastUpdateLabels();
        startCardsSequence();
        return;
    }

    setTimeout(async () => {
        await displayTotals(false);
        await updateLastUpdateLabels();
        startCardsSequence();
    }, showDuration);
});
