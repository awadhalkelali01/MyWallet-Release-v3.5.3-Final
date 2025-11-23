// debts.js: منطق إدارة الديون (owed_to_me أو owed_by_me)
// تم افتراض أن core_logic.js يحتوي على الدوال المحدثة (مثل getAllData المحصنة)

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. تعريف جميع المتغيرات هنا لضمان وجود العناصر في DOM
    const debtForm = document.getElementById('debtForm');
    const debtsList = document.getElementById('debtsList');
    const totalOwedToMeEl = document.getElementById('total-owed-to-me-yer');
    const totalOwedByMeEl = document.getElementById('total-owed-by-me-yer');

    let currentEditDebt = null; 
    
    // هذه الرسالة يجب أن تظهر الآن
    console.log("✅ جميع عناصر صفحة الديون (Form, List, Totals) جاهزة في DOM.");

    // ----------------------------------------------------\
    // 1. عرض قائمة الديون الحالية (مع إضافة الحذف والتسديد والتاريخ)
    // ----------------------------------------------------\
    async function displayDebts() {
        try {
            await waitForRates(); 
            // getAllData تم تحصينها لتعيد [] في حالة الفشل
            const debts = await getAllData('debts'); 
            
            debtsList.innerHTML = ''; 
            let totalOwedToMeYER = 0;
            let totalOwedByMeYER = 0;
            
            // فرز الديون بحيث تظهر الأحدث أولاً
            const sortedDebts = debts.sort((a, b) => b.timestamp - a.timestamp); 

            if (sortedDebts.length === 0) {
                debtsList.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 20px; grid-column: 1 / -1;">لا توجد ديون مسجلة بعد.</p>';
            }

            // بناء قائمة الديون بالتفاصيل
            sortedDebts.forEach(debt => {
                // 🛑 تم التأكد من تمرير الوسيط الثالث 'debt'
                const valueInYER = convertToYER(Number(debt.value), debt.currency, 'debt'); 
                const isOwedToMe = debt.type === 'owed_to_me';
                
                // حساب الإجمالي
                if (isOwedToMe) {
                    totalOwedToMeYER += valueInYER;
                } else {
                    totalOwedByMeYER += valueInYER;
                }
                
                const cardColor = isOwedToMe ? 'rgba(99, 199, 108, 0.1)' : 'rgba(255, 85, 85, 0.1)';
                const statusText = isOwedToMe ? 'دين مستحق لك (أصل)' : 'دين مستحق عليك (خصم)';
                
                // عرض تاريخ الإضافة
                const dateString = new Date(debt.timestamp).toLocaleDateString('ar-EG', {
                    year: 'numeric', month: 'short', day: 'numeric' 
                });
                
                const debtItem = document.createElement('div');
                debtItem.className = 'card debt-item';
                debtItem.style.background = cardColor;
                debtItem.dataset.id = debt.id;
                
                debtItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <h3 class="card-title" style="font-size: 16px; margin: 0;">${debt.name}</h3>
                        <span style="font-size: 12px; color: var(--muted);">${statusText}</span>
                    </div>
                    
                    <div class="card-amount" style="font-size: 20px;">
                        ${valueInYER.toLocaleString(undefined, { maximumFractionDigits: 0 })} YER
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-top: 8px; border-top: 1px dashed var(--glass-border); padding-top: 8px;">
                        <p class="card-note" style="color: var(--gold);">
                            القيمة الأصلية: ${debt.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${debt.currency}
                        </p>
                        <p class="card-note">تاريخ الإضافة: ${dateString}</p>
                    </div>
                    
                    <div class="action-row" style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="btn primary btn-small btn-settle" data-id="${debt.id}" style="flex-grow: 1; background: ${isOwedToMe ? 'var(--gold)' : '#5a2a6b'}; color: ${isOwedToMe ? '#333' : 'var(--text)'};">
                            ${isOwedToMe ? '✅ تم التحصيل' : '✅ تم السداد'}
                        </button>
                        <button class="btn cancel btn-small btn-edit" data-id="${debt.id}">✏️ تعديل</button>
                        <button class="btn cancel btn-small btn-delete" data-id="${debt.id}">🗑️ حذف</button>
                    </div>
                `;
                
                debtsList.appendChild(debtItem);

// إظهار البطاقة (حل مشكلة الإخفاء)
debtItem.style.opacity = "1";
debtItem.style.transform = "none";
            });

            // تحديث بطاقات الملخص
            totalOwedToMeEl.textContent = totalOwedToMeYER.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' YER';
            totalOwedByMeEl.textContent = totalOwedByMeYER.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' YER';
            
        } catch (e) {
            console.error("CRITICAL ERROR: Failed to execute displayDebts logic.", e);
            debtsList.innerHTML = '<p style="text-align: center; color: #ff5555; padding: 20px;">❌ حدث خطأ غير متوقع أثناء عرض الديون. تحقق من Console.</p>';
        }
    }

    // ----------------------------------------------------\
    // 2. معالجة الإضافة والتعديل
    // ----------------------------------------------------\
    debtForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const type = document.getElementById('debtType').value; 
        const name = document.getElementById('debtName').value.trim();
        const value = parseFloat(document.getElementById('debtValue').value);
        const currency = document.getElementById('debtCurrency').value;
        
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
            ...(!currentEditDebt && { timestamp: Date.now() }) 
        };
        
        try {
            const action = currentEditDebt ? 'تعديل' : 'إضافة';
            await putData('debts', newDebt); 
            showNotification(`✅ تم ${action} الدين (${name}) بنجاح.`);
            
            currentEditDebt = null;
            debtForm.reset();
            document.querySelector('#newDebtCard .card-title').textContent = '➕ إضافة دين جديد'; 
            
            await displayDebts(); 
            
        } catch (error) {
            showNotification(`❌ فشل في ${action} الدين. تحقق من Console.`, true);
            console.error("Error saving debt:", error);
        }
    });


    // ----------------------------------------------------\
    // 3. معالجة التفاعلات (الحذف، التسديد، التعديل)
    // ----------------------------------------------------\
    debtsList.addEventListener('click', async (e) => {
        const target = e.target;
        const id = parseInt(target.dataset.id); 
        if (!id) return;
        
        // 3.1. معالجة زر الحذف النهائي (Delete)
        if (target.classList.contains('btn-delete')) {
            if (confirm("هل أنت متأكد من حذف هذا الدين نهائياً؟")) {
                try {
                    await deleteData('debts', id); 
                    showNotification('✅ تم حذف الدين بنجاح.');
                    await displayDebts(); 
                } catch (error) {
                    showNotification('❌ فشل حذف الدين.', true);
                    console.error("Delete Debt Error:", error);
                }
            }
        } 
        
        // 3.2. معالجة زر التسديد/التحصيل (Settle)
        else if (target.classList.contains('btn-settle')) {
            const debtName = target.closest('.debt-item').querySelector('.card-title').textContent;
            const action = target.textContent;
            
            if (confirm(`هل أنت متأكد من تأكيد ${action.trim()} للدين: ${debtName}؟ سيتم حذفه من القائمة.`)) {
                 try {
                    await deleteData('debts', id); 
                    showNotification(`✅ تم تسجيل ${action.trim()} الدين بنجاح.`);
                    await displayDebts(); 
                } catch (error) {
                    showNotification('❌ فشل تسجيل التسديد/التحصيل.', true);
                    console.error("Settle Debt Error:", error);
                }
            }
        }
        
        // 3.3. معالجة زر التعديل (Edit)
        else if (target.classList.contains('btn-edit')) {
            const debts = await getAllData('debts');
            const debtToEdit = debts.find(d => d.id === id);
            
            if (debtToEdit) {
                currentEditDebt = debtToEdit;
                
                document.getElementById('debtType').value = debtToEdit.type;
                document.getElementById('debtName').value = debtToEdit.name;
                document.getElementById('debtValue').value = debtToEdit.value;
                document.getElementById('debtCurrency').value = debtToEdit.currency;
                
                document.querySelector('#newDebtCard .card-title').textContent = '✏️ تعديل الدين الحالي';
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    });


    // ----------------------------------------------------\
    // 4. بدء التشغيل
    // ----------------------------------------------------\
    displayDebts(); 
});