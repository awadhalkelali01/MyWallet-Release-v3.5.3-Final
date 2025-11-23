// gold.js: منطق حساب قيمة الذهب وتحويل العملات وحفظها كأصل

// الدوال: putData, getAllData, waitForRates, currentRates, convertToYER, convertYERToSAR, showNotification
// مُحمّلة مسبقاً من core_logic.js

const goldForm = document.getElementById('goldForm');
const gold24gramsInput = document.getElementById('gold24grams');
const gold21gramsInput = document.getElementById('gold21grams');
const saveGoldAssetBtn = document.getElementById('save-gold-asset-btn'); 

const currentGoldPriceYerEl = document.getElementById('current-gold-price-yer');
const currentGoldPriceYer21El = document.getElementById('current-gold-price-yer-21');
const sarRateEl = document.getElementById('sar-rate');
const totalGoldYerEl = document.getElementById('total-gold-yer');
const totalGoldSarEl = document.getElementById('total-gold-sar');

// ثابت احتساب عيار 21
const PURE_GOLD_CONVERSION_21 = 21 / 24; 
let lastCalculatedGoldGrams = 0; 
const GOLD_ASSET_NAME = "إجمالي الذهب المحسوب (جرامات)";

const GOLD_PRICE_KEY_24 = 'gold_grams_24';
const GOLD_PRICE_KEY_21 = 'gold_grams_21';


/**
 * دالة تحديث وعرض الأسعار في البطاقة العلوية (بانتظار تحميل الأسعار الصحيحة).
 */
async function updateRateDisplay() {
    // ⚠️ الانتظار الحاسم: يجب أن نضمن تحميل الأسعار من DB
    await waitForRates(); 
    
    // استخدام الأسعار المحمّلة (والتي يفترض أنها حديثة)
    const price24k = currentRates.GOLD_PER_GRAM_YER;
    // حساب سعر عيار 21: (سعر عيار 24 * 21/24)
    const price21k = price24k * PURE_GOLD_CONVERSION_21; 
    
    currentGoldPriceYerEl.textContent = price24k.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' YER';
    currentGoldPriceYer21El.textContent = price21k.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' YER'; 
    sarRateEl.textContent = currentRates.SAR_TO_YER.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' YER';

    // تحميل القيم المحفوظة من localStorage إلى حقول الإدخال
    loadGoldValues(); 
    
    // تشغيل الحساب لمرة واحدة عند التحميل (باستخدام الأسعار الجديدة)
    calculateGoldValueLogic(); 
}

/**
 * دالة لتحميل القيم المحفوظة من localStorage للحفاظ على البيانات.
 */
function loadGoldValues() {
    const saved24 = localStorage.getItem(GOLD_PRICE_KEY_24);
    const saved21 = localStorage.getItem(GOLD_PRICE_KEY_21);

    if (saved24 !== null) gold24gramsInput.value = saved24;
    if (saved21 !== null) gold21gramsInput.value = saved21;
}

/**
 * دالة لحفظ القيم المدخلة في localStorage عند أي تغيير.
 */
function saveGoldValues() {
    localStorage.setItem(GOLD_PRICE_KEY_24, gold24gramsInput.value);
    localStorage.setItem(GOLD_PRICE_KEY_21, gold21gramsInput.value);
}

/**
 * دالة منطق الحساب الأساسي للذهب.
 */
function calculateGoldValueLogic() {
    // الحفظ أولاً
    saveGoldValues(); 
    
    const gold24grams = parseFloat(gold24gramsInput.value) || 0;
    const gold21grams = parseFloat(gold21gramsInput.value) || 0;
    
    // تصفير العرض إذا كانت الكمية صفر
    if (gold24grams === 0 && gold21grams === 0) {
        lastCalculatedGoldGrams = 0; 
        totalGoldYerEl.textContent = '— YER';
        totalGoldSarEl.textContent = '— SAR';
        return;
    }

    // 1. تحويل عيار 21 إلى ما يعادله من عيار 24
    const equivalent24k = gold21grams * PURE_GOLD_CONVERSION_21;
    
    // 2. إجمالي الذهب المكافئ لعيار 24
    const totalEquivalentGold = gold24grams + equivalent24k;
    lastCalculatedGoldGrams = totalEquivalentGold; 
    
    // 3. حساب القيمة بالريال اليمني (باستخدام الأسعار المُحمَّلة)
    const goldPricePerGramYER = currentRates.GOLD_PER_GRAM_YER;
    const totalValueYER = totalEquivalentGold * goldPricePerGramYER;
    
    // 4. حساب القيمة بالريال السعودي (باستخدام الأسعار المُحمَّلة)
    const totalValueSAR = convertYERToSAR(totalValueYER);
    
    // 5. عرض النتائج
    const formatOptions = { maximumFractionDigits: 0 };
    totalGoldYerEl.textContent = totalValueYER.toLocaleString(undefined, formatOptions) + ' YER';
    totalGoldSarEl.textContent = totalValueSAR.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' SAR';
}


function calculateGoldValue(e) {
    e.preventDefault();
    calculateGoldValueLogic();
    if (lastCalculatedGoldGrams > 0) {
        showNotification(`✅ تم حساب القيمة الإجمالية لـ ${lastCalculatedGoldGrams.toFixed(2)} جرام عيار 24.`);
    } else {
        showNotification('⚠️ يرجى إدخال كمية الذهب للحساب.', true);
    }
}


async function saveGoldAsset() {
    // يجب الحساب أولاً
    calculateGoldValueLogic();

    if (lastCalculatedGoldGrams <= 0) {
        showNotification('❌ لا توجد كمية ذهب لحفظها. يرجى الحساب أولاً.', true);
        return;
    }

    let assetToSave = null;
    try {
        const assets = await getAllData('assets');
        assetToSave = assets.find(a => a.name === GOLD_ASSET_NAME); 
    } catch(e) {
        showNotification('❌ فشل في البحث عن الأصل الموجود.', true);
        return;
    }

    const newGoldAsset = {
        // إذا كان هناك أصل موجود، نستخدم ID لتحديثه
        ...(assetToSave && { id: assetToSave.id }), 
        name: GOLD_ASSET_NAME,
        value: parseFloat(lastCalculatedGoldGrams.toFixed(2)), 
        currency: 'GRAM',
        type: 'gold' // نوع خاص للذهب
    };
    
    try {
        await putData('assets', newGoldAsset);
        showNotification(`💾 تم تحديث قيمة الذهب (${lastCalculatedGoldGrams.toFixed(2)} جرام) في قائمة الأصول بنجاح!`, false);
    } catch (error) {
        showNotification('❌ فشل في حفظ الأصل الذهبي.', true);
        console.error("Error saving gold asset:", error);
    }
}


// ربط حدث التغيير لضمان الحفظ المباشر
gold24gramsInput.addEventListener('input', calculateGoldValueLogic);
gold21gramsInput.addEventListener('input', calculateGoldValueLogic);

goldForm.addEventListener('submit', calculateGoldValue);
saveGoldAssetBtn.addEventListener('click', saveGoldAsset);

document.addEventListener('DOMContentLoaded', async () => {
    await updateRateDisplay();

    // تحميل قيمة الذهب المخزنة من IndexedDB بعد الاستعادة
    const assets = await getAllData("assets");
    const goldAsset = assets.find(a => a.name === "إجمالي الذهب المحسوب (جرامات)");

    if (goldAsset && goldAsset.value > 0) {
        // نملأ الحقول تلقائياً
        gold24gramsInput.value = goldAsset.value.toFixed(2);

        // نحسب مباشرة
        calculateGoldValueLogic();
    }
});
