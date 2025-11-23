// debts.js: منطق إدارة الديون (owed_to_me أو owed_by_me)
// تم افتراض أن core_logic.js يحتوي على الدوال المحدثة (مثل getAllData المحصنة)

document.addEventListener('DOMContentLoaded', () => {
    
    const debtForm = document.getElementById('debtForm');
    const debtsList = document.getElementById('debtsList');
    const totalOwedToMeEl = document.getElementById('total-owed-to-me-yer');
    const totalOwedByMeEl = document.getElementById('total-owed-by-me-yer');

    let currentEditDebt = null; 

    console.log("✅ جميع عناصر صفحة الديون (Form, List, Totals) جاهزة في DOM.");

    async function displayDebts() {
        try {
            await waitForRates();
            const debts = await getAllData('debts'); 
            
            debtsList.innerHTML = ''; 
            let totalOwedToMeYER = 0;
            let totalOwedByMeYER = 0;

            const sortedDebts = debts.sort((a, b) => b.timestamp - a.timestamp); 

            if (sortedDebts.length === 0) {
                debtsList.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 20px;">لا توجد ديون مسجلة بعد.</p>';
            }

            sortedDebts.forEach(debt => {

                const valueInYER = convertToYER(Number(debt.value), debt.currency, 'debt'); 
                const isOwedToMe = debt.type === 'owed_to_me';

                if (isOwedToMe) {
                    totalOwedToMeYER += valueInYER;
                } else {
                    totalOwedByMeYER += valueInYER;
                }

                const statusText = isOwedToMe ? 'دين مستحق لك (أصل)' : 'دين مستحق عليك (خصم)';
                const dateString = new Date(debt.timestamp).toLocaleDateString('ar-EG', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });

                const debtItem = document.createElement('div');
                debtItem.className = 'card debt-item';
                debtItem.dataset.id = debt.id;

                debtItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <h3 class="card-title" style="font-size: 16px; margin: 0;">${debt.name}</h3>
                        <span style="font-size: 12px; color: var(--muted);">${statusText}</span>
                    </div>

                    <div class="card-amount" style="font-size: 20px;">
                        ${valueInYER.toLocaleString(undefined, { maximumFractionDigits: 0 })} YER
                    </div>

                    <div style="font-size: 14px; margin-top: 8px; border-top: 1px dashed var(--glass-border); padding-top: 8px;">
                        <p class="card-note" style="color: var(--gold);">القيمة الأصلية: ${debt.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${debt.currency}</p>
                        <p class="card-note">تاريخ الإضافة: ${dateString}</p>
                        ${debt.note ? `<p class="card-note" style="color: var(--text-muted); font-size: 13px;">ملاحظة: ${debt.note}</p>` : ""}
                    </div>

                    <div class="action-row" style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="btn primary btn-small btn-settle" data-id="${debt.id}">
                            ${isOwedToMe ? '✅ تم التحصيل' : '✅ تم السداد'}
                        </button>
                        <button class="btn cancel btn-small btn-edit" data-id="${debt.id}">✏️ تعديل</button>
                        <button class="btn cancel btn-small btn-delete" data-id="${debt.id}">🗑️ حذف</button>
                    </div>
                `;

                debtItem.style.opacity = "1";
                debtItem.style.transform = "none";

                debtsList.appendChild(debtItem);
            });

            totalOwedToMeEl.textContent = totalOwedToMeYER.toLocaleString(undefined) + ' YER';
            totalOwedByMeEl.textContent = totalOwedByMeYER.toLocaleString(undefined) + ' YER';

        } catch (e) {
            console.error("CRITICAL ERROR: Failed to execute displayDebts logic.", e);
            debtsList.innerHTML = '<p style="text-align: center; color: #ff5555; padding: 20px;">❌ حدث خطأ غير متوقع أثناء عرض الديون.</p>';
        }
    }

    debtForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const type = document.getElementById('debtType').value; 
        const name = document.getElementById('debtName').value.trim();
        const value = parseFloat(document.getElementById('debtValue').value);
        const currency = document.getElementById('debtCurrency').value;
        const note = document.getElementById('debtNote').value.trim();

        if (!name || isNaN(value) || value <= 0) {
            showNotification('❌ يرجى إدخال اسم وقيمة صحيحة للدين.', true);
            return;
        }

        const newDebt = {
            ...(currentEditDebt && { id: currentEditDebt.id, timestamp: currentEditDebt.timestamp }),
            name,
            type,
            value,
            currency,
            note: note || "",
            ...(!currentEditDebt && { timestamp: Date.now() })
        };

        try {
            const action = currentEditDebt ? 'تعديل' : 'إضافة';
            await putData('debts', newDebt);
            showNotification(`✅ تم ${action} الدين (${name}) بنجاح.`);

            currentEditDebt = null;
            debtForm.reset();
            document.getElementById('debtNote').value = "";
            document.querySelector('#newDebtCard .card-title').textContent = '➕ إضافة دين جديد';

            await displayDebts();

        } catch (error) {
            showNotification(`❌ فشل في ${action} الدين.`, true);
            console.error("Error saving debt:", error);
        }
    });

    debtsList.addEventListener('click', async (e) => {
        const target = e.target;
        const id = parseInt(target.dataset.id);
        if (!id) return;

        if (target.classList.contains('btn-delete')) {
            if (confirm("هل أنت متأكد من حذف هذا الدين نهائياً؟")) {
                await deleteData('debts', id);
                showNotification("✅ تم حذف الدين.");
                displayDebts();
            }
        }

        else if (target.classList.contains('btn-settle')) {
            if (confirm("هل تريد تسجيل التسديد؟ سيتم حذف الدين.")) {
                await deleteData('debts', id);
                showNotification("✅ تم تسجيل التسديد.");
                displayDebts();
            }
        }

        else if (target.classList.contains('btn-edit')) {
            const debts = await getAllData('debts');
            const debtToEdit = debts.find(d => d.id === id);

            if (debtToEdit) {
                currentEditDebt = debtToEdit;

                document.getElementById('debtType').value = debtToEdit.type;
                document.getElementById('debtName').value = debtToEdit.name;
                document.getElementById('debtValue').value = debtToEdit.value;
                document.getElementById('debtCurrency').value = debtToEdit.currency;
                document.getElementById('debtNote').value = debtToEdit.note || "";

                document.querySelector('#newDebtCard .card-title').textContent = '✏️ تعديل الدين الحالي';

                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    });

    displayDebts();
});
