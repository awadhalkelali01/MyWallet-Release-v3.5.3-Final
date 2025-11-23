// settings.js: منطق حفظ وتحديث أسعار الصرف وحذف قاعدة البيانات

// الدوال putData, loadRates, showNotification, deleteDB يتم تحميلها من core_logic.js

const saveRatesBtn = document.getElementById('save-rates-btn');
const deleteDbBtn = document.getElementById('delete-db-btn');
const usdRateInput = document.getElementById('usd-rate-input');
const sarRateInput = document.getElementById('sar-rate-input');
const goldPriceInput = document.getElementById('gold-price-input'); 
const lastUpdateEl = document.getElementById('last-update');

/* ----------------------------------------------------
   1. تحميل وعرض الأسعار + قراءة LAST_UPDATE من قاعدة البيانات
---------------------------------------------------- */
async function loadAndPopulateRates() {

    await loadRates(); 

    usdRateInput.value = currentRates.USD_TO_YER;
    sarRateInput.value = currentRates.SAR_TO_YER;
    goldPriceInput.value = currentRates.GOLD_PER_GRAM_YER;

    // قراءة آخر تحديث الحقيقي من قاعدة البيانات
    const lastUpdate = await getData("rates", "LAST_UPDATE");

    if (lastUpdate && lastUpdate.value) {
        const dt = new Date(lastUpdate.value);
        lastUpdateEl.textContent =
            "آخر تحديث: " +
            dt.toLocaleString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            });
    } else {
        lastUpdateEl.textContent = "آخر تحديث: —";
    }
}

/* ----------------------------------------------------
   2. حفظ الأسعار في قاعدة البيانات
---------------------------------------------------- */
async function saveRates() {

    const usdRate = parseFloat(usdRateInput.value);
    const sarRate = parseFloat(sarRateInput.value);
    const goldPrice = parseFloat(goldPriceInput.value);
    
    if (isNaN(usdRate) || isNaN(sarRate) || isNaN(goldPrice) || 
        usdRate <= 0 || sarRate <= 0 || goldPrice <= 0) {
        showNotification("❌ يرجى إدخال قيم صحيحة وموجبة.", true);
        return;
    }

    const ratesToSave = [
        { key: "USD_TO_YER", value: usdRate.toString() },
        { key: "SAR_TO_YER", value: sarRate.toString() },
        { key: "GOLD_PER_GRAM_YER", value: goldPrice.toString() }
    ];

    try {
        // حفظ الأسعار
        await Promise.all(ratesToSave.map(r => putData("rates", r)));

        // حفظ وقت آخر تحديث
        await putData("rates", { key: "LAST_UPDATE", value: new Date().toISOString() });

        // تحديث الذاكرة
        await loadRates();

        showNotification("✅ تم حفظ الأسعار بنجاح!", false);

        // تحديث العرض
        await loadAndPopulateRates();

    } catch (err) {
        console.error(err);
        showNotification("❌ حدث خطأ أثناء الحفظ.", true);
    }
}

/* ----------------------------------------------------
   3. حذف قاعدة البيانات
---------------------------------------------------- */
async function handleDeleteDatabase() {
    const modal = document.getElementById("confirmModal");
    const yesBtn = document.getElementById("confirmYes");
    const noBtn  = document.getElementById("confirmNo");

    modal.style.display = "flex";

    return new Promise(resolve => {

        noBtn.onclick = () => {
            modal.style.display = "none";
            resolve(false);
        };

        yesBtn.onclick = async () => {
            modal.style.display = "none";
            try {
                await deleteDB();
                localStorage.removeItem("gold_grams_24");
                localStorage.removeItem("gold_grams_21");

                showNotification("🗑️ تم حذف جميع البيانات!", false);
                setTimeout(() => window.location.reload(), 1000);

            } catch (error) {
                showNotification("❌ فشل الحذف", true);
                console.error(error);
            }
            resolve(true);
        };
    });
}

/* ----------------------------------------------------
   4. النسخة الاحتياطية
---------------------------------------------------- */
document.getElementById("exportBackupBtn")?.addEventListener("click", exportBackup);

document.getElementById("importBackupBtn")?.addEventListener("click", () =>
    document.getElementById("importBackupInput").click()
);

document.getElementById("importBackupInput")?.addEventListener("change", handleImportBackup);

async function handleImportBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const backup = JSON.parse(text);

        for (let store of Object.keys(backup)) {
            for (let item of backup[store]) {
                await putData(store, item);
            }
        }

        showNotification("✅ تمت الاستعادة بنجاح!");

    } catch (e) {
        console.error(e);
        showNotification("❌ فشل الاستعادة.", true);
    }

    event.target.value = "";
}

/* ----------------------------------------------------
   5. تشغيل الصفحة
---------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    loadAndPopulateRates();
    saveRatesBtn.addEventListener("click", saveRates);
    deleteDbBtn.addEventListener("click", handleDeleteDatabase);
});

/* ----------------------------------------------------
   6. التفعيل التلقائي للنسخ الاحتياطي
---------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("autoBackupToggle");
    if (!toggle) return;

    toggle.checked = isAutoBackupEnabled();

    toggle.addEventListener("change", () => {
        setAutoBackupEnabled(toggle.checked);

        if (toggle.checked) {
            showNotification("✔️ تم تفعيل النسخ الاحتياطي التلقائي");
            checkAndRunAutoBackup();
        } else {
            showNotification("⛔ تم إيقاف النسخ التلقائي");
        }
    });
});
/* ----------------------------------------------------
   7. تفعيل تبديل الثيم
---------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.getElementById("themeToggle");
    if (!themeToggle) return;

    // تحميل الثيم المخزن
    const savedTheme = localStorage.getItem("theme") || "dark";

    if (savedTheme === "gold") {
        document.body.classList.add("gold-theme");
        themeToggle.checked = true;
    } else {
        document.body.classList.add("dark-theme");
    }

    themeToggle.addEventListener("change", () => {
        if (themeToggle.checked) {
            document.body.classList.remove("dark-theme");
            document.body.classList.add("gold-theme");
            localStorage.setItem("theme", "gold");
            showNotification("✨ تم تفعيل الثيم الذهبي", false);
        } else {
            document.body.classList.remove("gold-theme");
            document.body.classList.add("dark-theme");
            localStorage.setItem("theme", "dark");
            showNotification("🌙 تم تفعيل الثيم الداكن", false);
        }
    });
});
