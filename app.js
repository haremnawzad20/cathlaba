// app.js

// 0. تكوين وربط قاعدة بيانات Firebase السحابية الحية (Live Realtime Cloud Database)
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDn8-jFp0goP3MrLGrY3_djHau2393FYao",
    authDomain: "azadicathlab.firebaseapp.com",
    databaseURL: "https://azadicathlab-default-rtdb.firebaseio.com",
    projectId: "azadicathlab",
    storageBucket: "azadicathlab.firebasestorage.app",
    messagingSenderId: "850987340553",
    appId: "1:850987340553:web:3448e0ec99986f8f16f9d8",
    measurementId: "G-Y6Y5C1HVDZ"
};

let firebaseDb = null;
try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps || !firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        firebaseDb = firebase.database();
        console.log('Firebase Realtime Database initialized successfully for azadicathlab.');
    }
} catch (e) {
    console.warn('Firebase initialization notice:', e);
}

function updateCloudStatus(status) {
    const badge = document.getElementById('cloud-sync-status');
    const text = document.getElementById('cloud-sync-text');
    if (!badge) return;
    
    if (status === 'connected') {
        badge.style.background = 'rgba(16, 185, 129, 0.12)';
        badge.style.color = '#10b981';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        badge.innerHTML = `<span style="width:7px; height:7px; border-radius:50%; background:#10b981; display:inline-block; box-shadow:0 0 6px #10b981;"></span> <span id="cloud-sync-text">سحابي متصل</span>`;
    } else if (status === 'saving') {
        badge.style.background = 'rgba(245, 158, 11, 0.12)';
        badge.style.color = '#f59e0b';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
        badge.innerHTML = `<span style="width:7px; height:7px; border-radius:50%; background:#f59e0b; display:inline-block;"></span> <span id="cloud-sync-text">جاري المزامنة...</span>`;
    } else {
        badge.style.background = 'rgba(239, 68, 68, 0.12)';
        badge.style.color = '#ef4444';
        badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        badge.innerHTML = `<span style="width:7px; height:7px; border-radius:50%; background:#ef4444; display:inline-block;"></span> <span id="cloud-sync-text">حفظ محلي</span>`;
    }
}
window.updateCloudStatus = updateCloudStatus;

// 1. التكوين الافتراضي ومستخدمي النظام
const DEFAULT_USERS = {
    'admin': { username: 'admin', name: 'أمين المخزن', role: 'admin', password: 'admin', permission: 'full' },
    'catheter': { username: 'catheter', name: 'شعبة القسطرة', role: 'customer', password: '123', permission: 'full' },
    'transfers': { username: 'transfers', name: 'المناقلات', role: 'customer', password: '123', permission: 'full' }
};

// 2. تهيئة البيانات التجريبية للمخزن إذا كان فارغاً (اعتماد رصيد جرد مخزن 2)
const MOCK_MATERIALS = (typeof STENTS_STORE2_DATA !== 'undefined' && Array.isArray(STENTS_STORE2_DATA))
    ? [...STENTS_STORE2_DATA]
    : [];

// تهيئة حركات سابقة للمخزن
const MOCK_TRANSACTIONS = [
    { id: 'tx-import-20261028', type: 'reconcile', fromStore: 'store2', toDest: 'جرد عام واعتماد أرصدة جديدة', materialName: 'كافة شبكات Boston Scientific', batchNumber: '2026-10-28', quantity: 1069, date: '2026-10-28' }
];

// تهيئة طلبيات وهمية
const MOCK_ORDERS = [
    { id: 'ord-1', customerId: 'catheter', customerName: 'شعبة القسطرة', items: [{ name: 'قسطرة تشخيصية JL4 6F', quantity: 15 }], status: 'pending', date: '2026-07-19T14:30:00' },
    { id: 'ord-2', customerId: 'transfers', customerName: 'المناقلات', items: [{ name: 'شبكية قسطرة معدنية 2.75x24mm', quantity: 5 }], status: 'approved', sourceStore: 'store1', date: '2026-07-18T10:00:00' }
];

// تصنيفات المواد الافتراضية
const DEFAULT_CATEGORIES = ['STENT', 'بالونات', 'قساطر تشخيصية', 'أسلاك توجيهية', 'أخرى'];

// تكوين النظام الافتراضي
const DEFAULT_CONFIG = {
    centerName: 'مستشفى القلب التخصصي',
    reportSubtitle: 'إدارة مخازن ومستودعات المستهلكات الطبية',
    reportStyle: 'blue', // 'blue', 'slate', 'teal'
    sidebarOrder: ['stores', 'orders', 'reports', 'settings'],
    sidebarOpenSubmenus: ['stores-submenu', 'orders-submenu', 'reports-submenu']
};

// 3. إدارة حالة التطبيق (State Management)
class AppState {
    constructor() {
        // التحقق من تلف ترميز النصوص (علامات استفهام) في التخزين المحلي وتصفيته إذا كان تالفاً لإنقاذ التطبيق
        const localMaterials = localStorage.getItem('cath_materials');
        const localConfig = localStorage.getItem('cath_config');
        if ((localMaterials && localMaterials.includes('??')) || (localConfig && localConfig.includes('??'))) {
            console.warn('Local storage data is corrupted with question marks. Clearing local cache to restore Arabic text.');
            localStorage.clear();
        }

        // إعادة تعيين وحذف المواد السابقة واعتماد جرد 2026-10-28 الجديد وتحويل المصدر إلى عامة
        const INVENTORY_VERSION = '20261029_v2';
        if (localStorage.getItem('cath_inventory_version') !== INVENTORY_VERSION) {
            localStorage.removeItem('cath_materials');
            localStorage.removeItem('cath_invoices');
            localStorage.removeItem('cath_receipt_lists');
            localStorage.removeItem('cath_purchase_invoices');
            localStorage.removeItem('cath_invoice_items');
            localStorage.removeItem('cath_purchases');
            localStorage.removeItem('cath_purchase_details');
            localStorage.removeItem('cath_transactions');
            localStorage.setItem('cath_inventory_version', INVENTORY_VERSION);
        }

        this.materials = JSON.parse(localStorage.getItem('cath_materials')) || MOCK_MATERIALS;
        this.transactions = JSON.parse(localStorage.getItem('cath_transactions')) || MOCK_TRANSACTIONS;
        this.orders = JSON.parse(localStorage.getItem('cath_orders')) || MOCK_ORDERS;
        this.categories = JSON.parse(localStorage.getItem('cath_categories')) || DEFAULT_CATEGORIES;
        this.users = JSON.parse(localStorage.getItem('cath_users')) || DEFAULT_USERS;
        this.systemConfig = JSON.parse(localStorage.getItem('cath_config')) || DEFAULT_CONFIG;
        // استعادة المظهر الداكن الأصلي المطلوب
        if (!localStorage.getItem('cath_theme_restored_dark_v2')) {
            this.theme = 'dark';
            localStorage.setItem('cath_theme', 'dark');
            localStorage.setItem('cath_theme_restored_dark_v2', 'true');
        } else {
            this.theme = localStorage.getItem('cath_theme') || 'dark';
        }
        this.customerCart = JSON.parse(localStorage.getItem('cath_cart')) || [];
        
        // الكيانات الجديدة الخاصة بفواتير ومواد التوريد
        this.receiptLists = JSON.parse(localStorage.getItem('cath_receipt_lists')) || [];
        this.PurchaseInvoices = JSON.parse(localStorage.getItem('cath_purchase_invoices')) || [];
        this.InvoiceItems = JSON.parse(localStorage.getItem('cath_invoice_items')) || [];
        this.Purchases = JSON.parse(localStorage.getItem('cath_purchases')) || [];
        this.PurchaseDetails = JSON.parse(localStorage.getItem('cath_purchase_details')) || [];
        
        this.Invoices = JSON.parse(localStorage.getItem('cath_invoices')) || [];
        this.Invoice_Items = JSON.parse(localStorage.getItem('cath_invoice_items_rel')) || [];
        this.dismissedAlerts = JSON.parse(localStorage.getItem('cath_dismissed_alerts')) || [];
        
        // الهجرة التلقائية من الهيكل القديم للهيكل الجديد عند أول تشغيل
        this.migrateReceiptListsToEntities();

        // استيراد وضمان وجود بيانات شبكات مخزن 2 (176 مادة) من تقرير الجرد
        this.ensureStore2StentsImported();

        // تحويل كافة المواد المصنفة "أخرى" أو بدون تصنيف تلقائياً إلى "STENT"
        this.migrateOtherCategoriesToStent();
        
        this.isSaving = false; // تهيئة متغير حالة الحفظ لمنع تعارض المزامنة
        
        // التحقق من وجود تعديلات محلية معلقة لم ترفع للسحابة بعد (لحمايتها من الفقدان)
        this.hasUnsavedChanges = localStorage.getItem('cath_has_unsaved_changes') === 'true';
        
        // بدء الاستماع والمزامنة السحابية اللحظية (Firebase Realtime Database)
        this.initRealtimeSync();
    }

    ensureStore2StentsImported() {
        if (!this.materials || this.materials.length === 0) {
            this.materials = (typeof STENTS_STORE2_DATA !== 'undefined' && Array.isArray(STENTS_STORE2_DATA))
                ? [...STENTS_STORE2_DATA]
                : [];
        } else if (typeof STENTS_STORE2_DATA !== 'undefined' && Array.isArray(STENTS_STORE2_DATA)) {
            const validIds = new Set(STENTS_STORE2_DATA.map(s => s.id));
            const hasOldMats = this.materials.some(m => !validIds.has(m.id) && !m.id.startsWith('mat-stent-'));
            if (hasOldMats) {
                this.materials = [...STENTS_STORE2_DATA];
            } else {
                let addedCount = 0;
                STENTS_STORE2_DATA.forEach(stent => {
                    const exists = this.materials.some(m => 
                        m.id === stent.id || 
                        (m.name === stent.name && m.batchNumber === stent.batchNumber && m.store === 'store2' && m.expiryDate === stent.expiryDate)
                    );
                    if (!exists) {
                        this.materials.push({ ...stent });
                        addedCount++;
                    }
                });
            }
        }

        // ضمان تحويل كافة مواد مخزن 2 من فاتورة إلى عامة
        if (this.materials) {
            this.materials.forEach(m => {
                if (m.store === 'store2' && (m.sourceType === 'فاتورة' || !m.sourceType)) {
                    m.sourceType = 'عامة';
                }
            });
        }

        if (!this.Invoices) this.Invoices = [];
        const invoiceExists = this.Invoices.some(inv => inv.id === 'inv-stents-store2' || inv.invoice_number === 'INV-2026-10-28');
        if (!invoiceExists && typeof STENTS_STORE2_DATA !== 'undefined' && Array.isArray(STENTS_STORE2_DATA)) {
            const invoiceItems = STENTS_STORE2_DATA.map(stent => ({
                name: stent.name,
                company: stent.company,
                batchNumber: stent.batchNumber,
                expiryDate: stent.expiryDate,
                store: stent.store,
                category: stent.category,
                sourceType: stent.sourceType || 'عامة',
                price: stent.price,
                quantity: stent.quantity
            }));
            const totalAmt = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            this.Invoices.unshift({
                id: 'inv-stents-store2',
                invoice_number: 'INV-2026-10-28',
                supplier_name: 'تقرير جرد مخزن 2 (Boston Scientific)',
                date: '2026-10-28',
                created_at: '2026-10-28',
                status: 'completed',
                total_amount: totalAmt,
                items: invoiceItems
            });
        }

        if (this.Invoices) {
            this.Invoices.forEach(inv => {
                if (inv.items) {
                    inv.items.forEach(it => {
                        if (it.store === 'store2' && (it.sourceType === 'فاتورة' || !it.sourceType)) {
                            it.sourceType = 'عامة';
                        }
                    });
                }
            });
        }

        localStorage.setItem('cath_materials', JSON.stringify(this.materials));
        localStorage.setItem('cath_invoices', JSON.stringify(this.Invoices));
    }

    migrateOtherCategoriesToStent() {
        if (!this.materials) return;
        let modified = false;

        // التأكد من وجود STENT في قائمة التصنيفات
        if (!this.categories) this.categories = [];
        if (!this.categories.includes('STENT')) {
            const indexShabakat = this.categories.indexOf('شبكات');
            if (indexShabakat !== -1) {
                this.categories[indexShabakat] = 'STENT';
            } else {
                this.categories.unshift('STENT');
            }
            modified = true;
        }
        if (this.categories.includes('شبكات')) {
            this.categories = this.categories.filter(c => c !== 'شبكات');
            modified = true;
        }

        this.materials.forEach(mat => {
            const cat = mat.category ? mat.category.trim() : '';
            const isOther = (!cat) || cat === 'أخرى' || cat === 'اخرى' || cat.toLowerCase() === 'other' || cat === 'شبكات';
            if (isOther) {
                mat.category = 'STENT';
                modified = true;
            }
        });

        if (this.Invoices && Array.isArray(this.Invoices)) {
            this.Invoices.forEach(inv => {
                if (inv.items && Array.isArray(inv.items)) {
                    inv.items.forEach(item => {
                        const cat = item.category ? item.category.trim() : '';
                        const isOther = (!cat) || cat === 'أخرى' || cat === 'اخرى' || cat.toLowerCase() === 'other' || cat === 'شبكات';
                        if (isOther) {
                            item.category = 'STENT';
                            modified = true;
                        }
                    });
                }
            });
        }

        if (modified) {
            localStorage.setItem('cath_materials', JSON.stringify(this.materials));
            localStorage.setItem('cath_categories', JSON.stringify(this.categories));
            if (this.Invoices) {
                localStorage.setItem('cath_invoices', JSON.stringify(this.Invoices));
            }
            console.log('[Category Migration] Successfully migrated all "أخرى" materials to "STENT".');
        }
    }

    migrateReceiptListsToEntities() {
        // 1. الهجرة من receiptLists القديم جداً
        if (this.receiptLists && this.receiptLists.length > 0 && (!this.Invoices || this.Invoices.length === 0)) {
            this.Invoices = [];
            this.Invoice_Items = [];
            this.receiptLists.forEach(list => {
                const totalAmt = list.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);
                this.Invoices.push({
                    id: list.listId,
                    invoice_number: list.receiptNumber,
                    supplier_name: list.supplier || 'مورد خارجي',
                    date: list.date,
                    created_at: list.date,
                    status: list.status === 'confirmed' ? 'completed' : 'draft',
                    total_amount: totalAmt
                });
                
                list.items.forEach(item => {
                    let product = this.materials.find(m => 
                        m.name.toLowerCase() === item.name.toLowerCase() && 
                        m.batchNumber === item.batchNumber && 
                        m.store === item.store
                    );
                    const productId = product ? product.id : ('mat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5));
                    
                    this.Invoice_Items.push({
                        id: 'det-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                        invoice_id: list.listId,
                        product_id: productId,
                        quantity: item.quantity,
                        price: item.price
                    });
                });
            });
            this.receiptLists = [];
        }
        
        // 2. الهجرة من PurchaseInvoices و InvoiceItems
        if (this.PurchaseInvoices && this.PurchaseInvoices.length > 0) {
            if (!this.Invoices) this.Invoices = [];
            if (!this.Invoice_Items) this.Invoice_Items = [];
            
            this.PurchaseInvoices.forEach(inv => {
                if (!this.Invoices.find(i => i.id === inv.id)) {
                    this.Invoices.push({
                        id: inv.id,
                        invoice_number: inv.invoice_number,
                        supplier_name: inv.supplier_id,
                        date: inv.created_at,
                        created_at: inv.created_at,
                        status: inv.status,
                        total_amount: 0
                    });
                }
            });
            
            if (this.InvoiceItems && this.InvoiceItems.length > 0) {
                this.InvoiceItems.forEach(item => {
                    this.Invoice_Items.push({
                        id: item.id,
                        invoice_id: item.invoice_id,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        price: item.cost_price
                    });
                    const inv = this.Invoices.find(i => i.id === item.invoice_id);
                    if (inv) {
                        inv.total_amount += (item.quantity * item.cost_price);
                    }
                });
            }
            
            this.PurchaseInvoices = [];
            this.InvoiceItems = [];
        }

        // 3. الهجرة من Purchases و PurchaseDetails
        if (this.Purchases && this.Purchases.length > 0) {
            if (!this.Invoices) this.Invoices = [];
            if (!this.Invoice_Items) this.Invoice_Items = [];
            
            this.Purchases.forEach(pur => {
                if (!this.Invoices.find(i => i.id === pur.id)) {
                    this.Invoices.push({
                        id: pur.id,
                        invoice_number: pur.invoice_number,
                        supplier_name: pur.supplier_name,
                        date: pur.date,
                        created_at: pur.created_at,
                        status: pur.status,
                        total_amount: 0
                    });
                }
            });
            
            if (this.PurchaseDetails && this.PurchaseDetails.length > 0) {
                this.PurchaseDetails.forEach(det => {
                    this.Invoice_Items.push({
                        id: det.id,
                        invoice_id: det.purchase_id,
                        product_id: det.product_id,
                        quantity: det.quantity,
                        price: det.price
                    });
                    const inv = this.Invoices.find(i => i.id === det.purchase_id);
                    if (inv) {
                        inv.total_amount += (det.quantity * det.price);
                    }
                });
            }
            
            this.Purchases = [];
            this.PurchaseDetails = [];
        }

        // 4. الهجرة التلقائية لدمج وتخزين المواد مباشرة داخل كائن الفاتورة (Odoo style) لضمان حمايتها من المسح
        if (this.Invoices && this.Invoices.length > 0) {
            this.Invoices.forEach(invoice => {
                if (!invoice.items || invoice.items.length === 0) {
                    invoice.items = [];
                    const details = this.Invoice_Items.filter(d => d.invoice_id === invoice.id);
                    details.forEach(detail => {
                        const product = this.materials.find(m => m.id === detail.product_id);
                        if (product) {
                            invoice.items.push({
                                name: product.name,
                                company: product.company || 'غير محدد',
                                batchNumber: product.batchNumber || 'بدون باج',
                                expiryDate: product.expiryDate || 'غير محدد',
                                store: product.store || 'store1',
                                category: product.category || 'أخرى',
                                sourceType: product.sourceType || 'عامة',
                                price: detail.price || 0,
                                quantity: detail.quantity || 0
                            });
                        }
                    });
                }
            });
        }
    }

    initRealtimeSync() {
        if (firebaseDb) {
            try {
                const invRef = firebaseDb.ref('inventory');
                invRef.on('value', (snapshot) => {
                    if (this.isSaving) return;
                    const data = snapshot.val();
                    if (!data) {
                        console.log('Firebase inventory empty, pushing local state...');
                        this.saveToCloud();
                        return;
                    }
                    this.applyCloudData(data);
                }, (error) => {
                    console.warn('Firebase realtime listener warning:', error);
                    updateCloudStatus('offline');
                });
                return;
            } catch (err) {
                console.warn('Realtime listener failed, falling back to REST sync:', err);
            }
        }

        // في حال عدم توفر مكتبة الـ SDK، يتم استخدام REST API التلقائي
        if (this.hasUnsavedChanges) {
            this.saveToCloud();
        } else {
            this.syncWithCloud();
        }
    }

    applyCloudData(data) {
        if (!data || this.isSaving) return;

        // التحقق من سلامة البيانات السحابية ومنع استيرادها إن كانت تالفة
        if (data.materials && Array.isArray(data.materials) && data.materials.length > 0) {
            const firstMatName = data.materials[0].name || '';
            if (firstMatName.includes('??')) {
                console.warn('Cloud database appears to have corrupted text. Skipping sync.');
                return;
            }
        }

        let updated = false;

        if (data.materials && Array.isArray(data.materials)) { this.materials = data.materials; localStorage.setItem('cath_materials', JSON.stringify(data.materials)); updated = true; }
        if (data.transactions) { this.transactions = data.transactions; localStorage.setItem('cath_transactions', JSON.stringify(data.transactions)); updated = true; }
        if (data.orders) { this.orders = data.orders; localStorage.setItem('cath_orders', JSON.stringify(data.orders)); updated = true; }
        if (data.categories) { this.categories = data.categories; localStorage.setItem('cath_categories', JSON.stringify(data.categories)); updated = true; }
        if (data.users) { this.users = data.users; localStorage.setItem('cath_users', JSON.stringify(data.users)); updated = true; }
        if (data.config) { this.systemConfig = data.config; localStorage.setItem('cath_config', JSON.stringify(data.config)); updated = true; }
        if (data.receiptLists) { this.receiptLists = data.receiptLists; localStorage.setItem('cath_receipt_lists', JSON.stringify(data.receiptLists)); updated = true; }
        if (data.PurchaseInvoices) { this.PurchaseInvoices = data.PurchaseInvoices; localStorage.setItem('cath_purchase_invoices', JSON.stringify(data.PurchaseInvoices)); updated = true; }
        if (data.InvoiceItems) { this.InvoiceItems = data.InvoiceItems; localStorage.setItem('cath_invoice_items', JSON.stringify(data.InvoiceItems)); updated = true; }
        if (data.Purchases) { this.Purchases = data.Purchases; localStorage.setItem('cath_purchases', JSON.stringify(data.Purchases)); updated = true; }
        if (data.PurchaseDetails) { this.PurchaseDetails = data.PurchaseDetails; localStorage.setItem('cath_purchase_details', JSON.stringify(data.PurchaseDetails)); updated = true; }
        if (data.Invoices) { this.Invoices = data.Invoices; localStorage.setItem('cath_invoices', JSON.stringify(data.Invoices)); updated = true; }
        if (data.Invoice_Items) { this.Invoice_Items = data.Invoice_Items; localStorage.setItem('cath_invoice_items_rel', JSON.stringify(data.Invoice_Items)); updated = true; }
        if (data.dismissedAlerts) { this.dismissedAlerts = data.dismissedAlerts; localStorage.setItem('cath_dismissed_alerts', JSON.stringify(data.dismissedAlerts)); updated = true; }

        if (updated) {
            this.ensureStore2StentsImported();
            this.migrateOtherCategoriesToStent();
            updateCloudStatus('connected');
            updateCategoryUI();
            if (this.currentUser) {
                if (this.currentUser.role === 'admin') {
                    renderAdminSidebarMenu();
                    renderAdminDashboard();
                    renderSavedReceiptsTable();
                } else {
                    renderCustomerDashboard();
                }
            }
        }
    }

    async syncWithCloud() {
        if (this.isSaving || this.hasUnsavedChanges) return;
        try {
            updateCloudStatus('saving');
            const res = await fetch(`https://azadicathlab-default-rtdb.firebaseio.com/inventory.json?t=${Date.now()}`, {
                cache: 'no-store'
            });
            if (!res.ok) {
                updateCloudStatus('offline');
                return;
            }
            const data = await res.json();
            if (!data) {
                await this.saveToCloud();
                return;
            }
            this.applyCloudData(data);
            updateCloudStatus('connected');
        } catch (e) {
            console.error('Error syncing with Firebase REST:', e);
            updateCloudStatus('offline');
        }
    }

    async save() {
        this.hasUnsavedChanges = true;
        localStorage.setItem('cath_has_unsaved_changes', 'true');

        // 1. حفظ محلي سريع لضمان سلاسة الاستجابة للواجهة
        localStorage.setItem('cath_materials', JSON.stringify(this.materials));
        localStorage.setItem('cath_transactions', JSON.stringify(this.transactions));
        localStorage.setItem('cath_orders', JSON.stringify(this.orders));
        localStorage.setItem('cath_categories', JSON.stringify(this.categories));
        localStorage.setItem('cath_users', JSON.stringify(this.users));
        localStorage.setItem('cath_config', JSON.stringify(this.systemConfig));
        localStorage.setItem('cath_cart', JSON.stringify(this.customerCart));
        localStorage.setItem('cath_receipt_lists', JSON.stringify(this.receiptLists));
        localStorage.setItem('cath_purchase_invoices', JSON.stringify(this.PurchaseInvoices));
        localStorage.setItem('cath_invoice_items', JSON.stringify(this.InvoiceItems));
        localStorage.setItem('cath_purchases', JSON.stringify(this.Purchases));
        localStorage.setItem('cath_purchase_details', JSON.stringify(this.PurchaseDetails));
        localStorage.setItem('cath_invoices', JSON.stringify(this.Invoices));
        localStorage.setItem('cath_invoice_items_rel', JSON.stringify(this.Invoice_Items));
        localStorage.setItem('cath_dismissed_alerts', JSON.stringify(this.dismissedAlerts));

        // 2. الحفظ السحابي التلقائي لمزامنة بقية الأجهزة فوراً
        const success = await this.saveToCloud();
        return success;
    }

    async saveToCloud() {
        this.isSaving = true;
        updateCloudStatus('saving');
        const payload = {
            materials: this.materials,
            transactions: this.transactions,
            orders: this.orders,
            categories: this.categories,
            users: this.users,
            config: this.systemConfig,
            receiptLists: this.receiptLists,
            PurchaseInvoices: this.PurchaseInvoices,
            InvoiceItems: this.InvoiceItems,
            Purchases: this.Purchases,
            PurchaseDetails: this.PurchaseDetails,
            Invoices: this.Invoices,
            Invoice_Items: this.Invoice_Items,
            dismissedAlerts: this.dismissedAlerts,
            lastUpdated: new Date().toISOString()
        };

        try {
            if (firebaseDb) {
                await firebaseDb.ref('inventory').set(payload);
                this.hasUnsavedChanges = false;
                localStorage.setItem('cath_has_unsaved_changes', 'false');
                updateCloudStatus('connected');
                return true;
            }

            // Fallback: REST API PUT to Firebase Realtime Database
            const res = await fetch('https://azadicathlab-default-rtdb.firebaseio.com/inventory.json', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                this.hasUnsavedChanges = false;
                localStorage.setItem('cath_has_unsaved_changes', 'false');
                updateCloudStatus('connected');
                return true;
            }
        } catch (err) {
            console.error('Error saving state to Firebase:', err);
            updateCloudStatus('offline');
        } finally {
            this.isSaving = false;
        }
        return false;
    }

    login(username, password) {
        const user = this.users[username.toLowerCase().trim()];
        if (user && user.password === password) {
            this.currentUser = user;
            sessionStorage.setItem('cath_user', JSON.stringify(user));
            return true;
        }
        return false;
    }

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('cath_user');
    }

    setTheme(theme) {
        this.theme = theme;
        localStorage.setItem('cath_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }
}

const state = new AppState();

// تنظيف تلقائي للتصنيفات غير المرغوب فيها التي تحتوي على علامات اقتباس خاطئة (مثل Ballon' أو Ballon’)
const undesirableKeywords = ["ballon'", "ballon’"];
const hasUndesirable = state.categories.some(c => 
    undesirableKeywords.some(kw => c.toLowerCase().trim().includes(kw))
);

if (hasUndesirable) {
    state.categories = state.categories.filter(c => {
        const lowerC = c.toLowerCase().trim();
        return !undesirableKeywords.some(kw => lowerC.includes(kw));
    });
    
    state.materials.forEach(mat => {
        if (mat.category) {
            const lowerCat = mat.category.toLowerCase().trim();
            if (undesirableKeywords.some(kw => lowerCat.includes(kw))) {
                mat.category = 'بالونات';
            }
        }
    });
    state.save();
}

// تحويل أي مادة مصنفة "أخرى" تلقائياً إلى "STENT"
state.migrateOtherCategoriesToStent();

// فلاتر التصنيفات النشطة
let currentAdminCategoryFilter = 'all';
let currentCustomerCategoryFilter = 'all';
let currentAdminSortMode = 'none';

// دالة مساعدة لترتيب وفرز المواد حسب الاسم أو الكمية
function sortItems(items, sortMode) {
    if (sortMode === 'name-asc') {
        return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    } else if (sortMode === 'name-desc') {
        return [...items].sort((a, b) => b.name.localeCompare(a.name, 'ar'));
    } else if (sortMode === 'qty-desc') {
        return [...items].sort((a, b) => b.quantity - a.quantity);
    } else if (sortMode === 'qty-asc') {
        return [...items].sort((a, b) => a.quantity - b.quantity);
    }
    return items;
}

// 4. الدوال المساعدة والمنطق الحسابي (Helper Functions)

// حساب تنبيهات الصلاحية (أقل من 6 أشهر)
function getExpiryAlerts() {
    const today = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(today.getMonth() + 6);

    return state.materials.filter(mat => {
        if (mat.quantity <= 0) return false;
        if (state.dismissedAlerts && state.dismissedAlerts.includes(mat.id)) return false;
        
        const expiry = new Date(mat.expiryDate);
        return expiry >= today && expiry <= sixMonthsLater;
    }).map(mat => {
        const diffTime = Math.abs(new Date(mat.expiryDate) - today);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = (diffDays / 30).toFixed(1);
        return {
            ...mat,
            remainingMonths: diffMonths,
            remainingDays: diffDays,
            level: diffMonths <= 2 ? 'danger' : 'warning'
        };
    }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
}

// حساب تخمين صرفيات المواد وتوقع الهدر للاكسباير
function getForecastData() {
    const forecast = [];
    const today = new Date();
    
    state.materials.forEach(mat => {
        if (mat.quantity <= 0) return;
        
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(today.getDate() - 90);
        
        const relevantTx = state.transactions.filter(tx => 
            tx.type === 'issue' && 
            tx.materialName === mat.name &&
            new Date(tx.date) >= ninetyDaysAgo
        );
        
        const totalIssued = relevantTx.reduce((sum, tx) => sum + tx.quantity, 0);
        const monthlyConsumption = totalIssued > 0 ? (totalIssued / 3).toFixed(1) : 12.0; 
        
        const expiryDate = new Date(mat.expiryDate);
        const diffTime = expiryDate - today;
        const remainingMonths = diffTime > 0 ? (diffTime / (1000 * 60 * 60 * 24 * 30)).toFixed(2) : 0;
        
        const expectedConsumption = parseFloat(monthlyConsumption) * parseFloat(remainingMonths);
        const expectedWaste = Math.max(0, Math.ceil(mat.quantity - expectedConsumption));
        
        let verdict = 'آمن (كافٍ للاستهلاك)';
        let statusClass = 'verdict-safe';
        
        if (expectedWaste > 0 && remainingMonths > 0) {
            if (expectedWaste > mat.quantity * 0.5) {
                verdict = `خطر هدر كبير: متوقع تلف ${expectedWaste} قطعة`;
                statusClass = 'verdict-danger';
            } else {
                verdict = `تحذير هدر جزئي: متوقع تلف ${expectedWaste} قطعة`;
                statusClass = 'verdict-risk';
            }
        } else if (remainingMonths <= 0) {
            verdict = 'منتهي الصلاحية بالفعل!';
            statusClass = 'verdict-danger';
        }

        forecast.push({
            id: mat.id,
            name: mat.name,
            batchNumber: mat.batchNumber,
            expiryDate: mat.expiryDate,
            quantity: mat.quantity,
            store: mat.store === 'store1' ? 'مخزن 1' : 'مخزن 2',
            monthlyConsumption: parseFloat(monthlyConsumption),
            remainingMonths: parseFloat(remainingMonths).toFixed(1),
            expectedWaste,
            verdict,
            statusClass,
            category: mat.category
        });
    });

    return forecast;
}

// الحصول على مجموع كلي للمواد (دمج المواد التي تحمل نفس الاسم عبر المخازن)
function getGrandTotalMaterials() {
    const totals = {};
    state.materials.forEach(mat => {
        if (!totals[mat.name]) {
            totals[mat.name] = {
                name: mat.name,
                company: mat.company,
                category: mat.category || 'أخرى',
                quantity: 0,
                store1Qty: 0,
                store2Qty: 0,
                totalValue: 0,
                batches: []
            };
        }
        totals[mat.name].quantity += mat.quantity;
        totals[mat.name].totalValue += mat.quantity * (mat.price || 0);
        if (mat.store === 'store1') totals[mat.name].store1Qty += mat.quantity;
        if (mat.store === 'store2') totals[mat.name].store2Qty += mat.quantity;
        
        totals[mat.name].batches.push({
            batchNumber: mat.batchNumber,
            expiryDate: mat.expiryDate,
            quantity: mat.quantity,
            store: mat.store === 'store1' ? 'مخزن 1' : 'مخزن 2',
            sourceType: mat.sourceType || 'عامة',
            price: mat.price || 0
        });
    });
    return Object.values(totals);
}

// 5. إدارة العمليات الحركية والطلبات (Transactions Management)

// تحويل من مخزن 1 إلى مخزن 2
function transferBetweenStores(materialId, qty) {
    const mat1 = state.materials.find(m => m.id === materialId && m.store === 'store1');
    if (!mat1 || mat1.quantity < qty) {
        showToast('الكمية المطلوبة غير متوفرة في مخزن 1', 'danger');
        return false;
    }

    mat1.quantity -= qty;

    let mat2 = state.materials.find(m => m.name === mat1.name && m.batchNumber === mat1.batchNumber && m.store === 'store2');
    if (mat2) {
        mat2.quantity += qty;
    } else {
        const newMat2 = {
            id: 'mat-' + Date.now(),
            name: mat1.name,
            batchNumber: mat1.batchNumber,
            expiryDate: mat1.expiryDate,
            quantity: qty,
            company: mat1.company,
            store: 'store2',
            category: mat1.category || 'أخرى',
            sourceType: mat1.sourceType || 'عامة',
            price: mat1.price || 0
        };
        state.materials.push(newMat2);
    }

    state.transactions.unshift({
        id: 'tx-' + Date.now(),
        type: 'transfer',
        fromStore: 'store1',
        toDest: 'مخزن 2',
        materialName: mat1.name,
        batchNumber: mat1.batchNumber,
        quantity: qty,
        date: new Date().toISOString().split('T')[0]
    });

    state.save();
    showToast(`تم تحويل ${qty} قطعة بنجاح إلى مخزن 2`, 'success');
    return true;
}

// صرف مباشر للزبائن
function issueStockToCustomer(materialId, qty, customer, storeSource) {
    const mat = state.materials.find(m => m.id === materialId && m.store === storeSource);
    if (!mat || mat.quantity < qty) {
        showToast(`الكمية المطلوبة غير متوفرة في ${storeSource === 'store1' ? 'مخزن 1' : 'مخزن 2'}`, 'danger');
        return false;
    }

    mat.quantity -= qty;

    state.transactions.unshift({
        id: 'tx-' + Date.now(),
        type: 'issue',
        fromStore: storeSource,
        toDest: customer,
        materialName: mat.name,
        batchNumber: mat.batchNumber,
        quantity: qty,
        date: new Date().toISOString().split('T')[0]
    });

    state.save();
    showToast(`تم صرف ${qty} قطعة بنجاح إلى ${customer}`, 'success');
    return true;
}

// عملية الجرد والتعديل الفعلي
function reconcileMaterial(materialId, newQty) {
    const mat = state.materials.find(m => m.id === materialId);
    if (!mat) return false;

    const oldQty = mat.quantity;
    mat.quantity = newQty;

    state.transactions.unshift({
        id: 'tx-' + Date.now(),
        type: 'reconcile',
        fromStore: mat.store,
        toDest: 'جرد وتعديل مخزون',
        materialName: mat.name,
        batchNumber: mat.batchNumber,
        quantity: newQty - oldQty,
        date: new Date().toISOString().split('T')[0]
    });

    state.save();
    showToast(`تم تحديث كمية الجرد للمادة ${mat.name} إلى ${newQty}`, 'success');
    return true;
}

// إضافة مادة جديدة للمخازن
function addNewMaterial(name, batch, expiry, quantity, company, store, category, sourceType = 'عامة', price = 0) {
    let existing = state.materials.find(m => 
        m.name.toLowerCase() === name.toLowerCase().trim() && 
        m.batchNumber.toUpperCase() === batch.toUpperCase().trim() && 
        m.store === store
    );

    if (existing) {
        existing.quantity += parseInt(quantity);
        if (category) existing.category = category;
        existing.sourceType = sourceType;
        existing.price = parseFloat(price) || 0;
    } else {
        state.materials.push({
            id: 'mat-' + Date.now(),
            name: name.trim(),
            batchNumber: batch.toUpperCase().trim(),
            expiryDate: expiry,
            quantity: parseInt(quantity),
            company: company.trim(),
            store: store,
            category: category || 'أخرى',
            sourceType: sourceType,
            price: parseFloat(price) || 0
        });
    }

    state.transactions.unshift({
        id: 'tx-' + Date.now(),
        type: 'receipt',
        fromStore: 'مورد خارجي',
        toDest: store === 'store1' ? 'مخزن 1' : 'مخزن 2',
        materialName: name.trim(),
        batchNumber: batch.toUpperCase().trim(),
        quantity: parseInt(quantity),
        date: new Date().toISOString().split('T')[0]
    });

    state.save();
    showToast(`تمت إضافة المادة ${name} بنجاح`, 'success');
    return true;
}

// تعديل بيانات مادة
function editMaterial(id, name, batch, expiry, quantity, company, store, category, sourceType = 'عامة', price = 0) {
    const mat = state.materials.find(m => m.id === id);
    if (!mat) return false;
    
    mat.name = name.trim();
    mat.batchNumber = batch.toUpperCase().trim();
    mat.expiryDate = expiry;
    mat.quantity = parseInt(quantity);
    mat.company = company.trim();
    mat.store = store;
    mat.category = category;
    mat.sourceType = sourceType;
    mat.price = parseFloat(price) || 0;
    
    state.save();
    showToast(`تم تعديل بيانات المادة "${mat.name}" بنجاح`, 'success');
    return true;
}

// حذف مادة بالكامل من المخازن
function deleteMaterial(id) {
    const index = state.materials.findIndex(m => m.id === id);
    if (index === -1) return false;
    
    const mat = state.materials[index];
    state.materials.splice(index, 1);
    
    state.transactions.unshift({
        id: 'tx-' + Date.now(),
        type: 'reconcile',
        fromStore: mat.store,
        toDest: 'شطب وحذف مادة',
        materialName: mat.name,
        batchNumber: mat.batchNumber,
        quantity: -mat.quantity,
        date: new Date().toISOString().split('T')[0]
    });
    
    state.save();
    showToast(`تم حذف المادة "${mat.name}" نهائياً من المخازن`, 'success');
    return true;
}

// طلب مواد من قبل الزبون
function placeCustomerOrder(items, sendWA = true) {
    if (items.length === 0) return false;

    const newOrder = {
        id: 'ord-' + Date.now(),
        customerId: state.currentUser.username,
        customerName: state.currentUser.name,
        items: items,
        status: 'pending',
        date: new Date().toISOString()
    };

    state.orders.unshift(newOrder);
    state.save();
    
    // إرسال إشعار للواتساب بالرقم المطلوب إذا اختار الزبون ذلك
    if (sendWA) {
        sendWhatsAppNotification(newOrder);
    }
    
    showToast('تم تقديم طلبك بنجاح وقيد المراجعة الآن', 'success');
    return true;
}

// دالة مساعدة لنسخ النصوص تدعم البيئة غير الآمنة (مثل تشغيل الملف محلياً file:///)
function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                resolve();
            } else {
                reject("execCommand copy failed");
            }
        } catch (err) {
            reject(err);
        }
    });
}

// إرسال إشعار تفاصيل الطلبية لمجموعة الواتساب ونسخ النص تلقائياً
function sendWhatsAppNotification(order) {
    const groupUrl = 'https://chat.whatsapp.com/KlZpWwnbzLI3rNR6h4t9io?s=hd&p=i&ilr=4&amv=2';
    
    // تنسيق قائمة المواد المطلوبة
    const itemsList = order.items.map(i => `• ${i.name} (العدد: ${i.quantity} قطعة)`).join('\n');
    
    const message = `لديك طلبية ارجو تجهيزونا باسرع وقت\n\n` +
                    `*الجهة الطالبة:* ${order.customerName}\n` +
                    `*المواد المطلوبة:*\n${itemsList}\n\n` +
                    `*تاريخ الطلب:* ${new Date(order.date).toLocaleString('ar-EG')}`;
                    
    copyTextToClipboard(message).then(() => {
        alert("📋 تم نسخ قائمة المواد المطلوبة تلقائياً لحافظة جهازك!\n\nبمجرد دخولك للمجموعة، يرجى عمل 'لصق' (Paste) أو (Ctrl + V) لإرسال تفاصيل الطلبية مباشرة.");
        window.open(groupUrl, '_blank');
    }).catch(err => {
        // في حال فشل النسخ، نفتح الواتساب التقليدي كحل أخير
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://api.whatsapp.com/send?text=${encodedMessage}`, '_blank');
    });
}

// اعتماد الطلب وصرف المواد (من قبل الأدمن)
function approveCustomerOrder(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') return false;

    let validationFailed = false;
    let missingItemName = '';

    order.items.forEach(item => {
        const totalAvailable = state.materials
            .filter(m => m.name === item.name)
            .reduce((sum, m) => sum + m.quantity, 0);

        if (totalAvailable < item.quantity) {
            validationFailed = true;
            missingItemName = item.name;
        }
    });

    if (validationFailed) {
        showToast(`الكمية الكلية غير كافية لـ "${missingItemName}" في مستودعات المستشفى`, 'danger');
        return false;
    }

    order.dispatchedItems = [];

    order.items.forEach(item => {
        let remainingToDeduct = item.quantity;

        // 1. الخصم أولاً من مخزن 2 (الفرعي) - الدفعات الأقدم صلاحية أولاً
        const store2Batches = state.materials
            .filter(m => m.name === item.name && m.store === 'store2' && m.quantity > 0)
            .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

        for (let mat of store2Batches) {
            if (remainingToDeduct <= 0) break;
            
            const deduction = Math.min(mat.quantity, remainingToDeduct);
            mat.quantity -= deduction;
            remainingToDeduct -= deduction;

            order.dispatchedItems.push({
                materialName: mat.name,
                batchNumber: mat.batchNumber,
                store: mat.store,
                quantity: deduction
            });

            state.transactions.unshift({
                id: 'tx-' + Date.now() + '-' + mat.batchNumber,
                type: 'issue',
                fromStore: 'store2',
                toDest: order.customerName,
                materialName: mat.name,
                batchNumber: mat.batchNumber,
                quantity: deduction,
                date: new Date().toISOString().split('T')[0]
            });
        }

        // 2. إذا تبقى عجز، يتم خصمه من مخزن 1 (الرئيسي) - الدفعات الأقدم صلاحية أولاً
        if (remainingToDeduct > 0) {
            const store1Batches = state.materials
                .filter(m => m.name === item.name && m.store === 'store1' && m.quantity > 0)
                .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

            for (let mat of store1Batches) {
                if (remainingToDeduct <= 0) break;
                
                const deduction = Math.min(mat.quantity, remainingToDeduct);
                mat.quantity -= deduction;
                remainingToDeduct -= deduction;

                order.dispatchedItems.push({
                    materialName: mat.name,
                    batchNumber: mat.batchNumber,
                    store: mat.store,
                    quantity: deduction
                });

                state.transactions.unshift({
                    id: 'tx-' + Date.now() + '-' + mat.batchNumber,
                    type: 'issue',
                    fromStore: 'store1',
                    toDest: order.customerName,
                    materialName: mat.name,
                    batchNumber: mat.batchNumber,
                    quantity: deduction,
                    date: new Date().toISOString().split('T')[0]
                });
            }
        }
    });

    order.status = 'approved';
    order.sourceStore = 'مخزن 2 ثم 1';
    state.save();
    showToast('تم اعتماد وصرف الطلب بنجاح وتحديث الأرصدة تلقائياً (مخزن 2 ثم 1)', 'success');
    return true;
}

// رفض الطلب
function rejectCustomerOrder(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') return false;

    order.status = 'rejected';
    state.save();
    showToast('تم رفض الطلب بنجاح', 'warning');
    return true;
}

// 6. نظام الإشعارات العائمة (Toast System)
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'danger' ? '✗' : '⚠'}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// 7. إدارة الواجهة الرسومية وعرض البيانات (UI Rendering)
function checkAuthentication() {
    if (!state.currentUser) {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    } else {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        document.getElementById('username-display').innerText = state.currentUser.name;
        const userBadge = document.getElementById('user-role-badge');
        userBadge.className = `user-badge ${state.currentUser.role}`;
        userBadge.querySelector('.badge-text').innerText = state.currentUser.role === 'admin' ? 'أمين المخزن' : 'زبون';

        // تحديث إسم المركز بالواجهة
        const appCenterTitle = document.getElementById('app-center-title');
        if (appCenterTitle) appCenterTitle.innerText = state.systemConfig.centerName;

        // إخفاء/إظهار زر الإعدادات للأدمن فقط
        const settingsBtn = document.getElementById('btn-system-settings');
        if (settingsBtn) {
            if (state.currentUser.role === 'admin') {
                settingsBtn.classList.remove('hidden');
            } else {
                settingsBtn.classList.add('hidden');
            }
        }

        // إظهار أيقونة تنبيهات الصلاحية للأدمن فقط
        const notifWrapper = document.getElementById('notifications-wrapper');
        if (notifWrapper) {
            if (state.currentUser.role === 'admin') {
                notifWrapper.classList.remove('hidden');
            } else {
                notifWrapper.classList.add('hidden');
            }
        }

        const adminMenu = document.getElementById('admin-sidebar-menu');
        const customerMenu = document.getElementById('customer-sidebar-menu');

        if (state.currentUser.role === 'admin') {
            document.getElementById('admin-dashboard').classList.remove('hidden');
            document.getElementById('customer-dashboard').classList.add('hidden');
            if (adminMenu) adminMenu.classList.remove('hidden');
            if (customerMenu) customerMenu.classList.add('hidden');
            renderAdminSidebarMenu();
            renderAdminDashboard();
        } else {
            document.getElementById('admin-dashboard').classList.add('hidden');
            document.getElementById('customer-dashboard').classList.remove('hidden');
            if (adminMenu) adminMenu.classList.add('hidden');
            if (customerMenu) customerMenu.classList.remove('hidden');
            renderCustomerDashboard();
        }
    }
}

// عرض لوحة تحكم الأدمن
function renderAdminDashboard() {
    let filteredMaterials = state.materials;
    let filterSuffix = '';
    
    if (currentAdminCategoryFilter !== 'all') {
        filteredMaterials = state.materials.filter(m => m.category === currentAdminCategoryFilter);
        filterSuffix = ` (تصنيف: ${currentAdminCategoryFilter})`;
    }

    const store1Qty = filteredMaterials.filter(m => m.store === 'store1').reduce((sum, m) => sum + m.quantity, 0);
    const store1Val = filteredMaterials.filter(m => m.store === 'store1').reduce((sum, m) => sum + m.quantity * (m.price || 0), 0);
    
    const store2Qty = filteredMaterials.filter(m => m.store === 'store2').reduce((sum, m) => sum + m.quantity, 0);
    const store2Val = filteredMaterials.filter(m => m.store === 'store2').reduce((sum, m) => sum + m.quantity * (m.price || 0), 0);
    
    const grandTotalQty = store1Qty + store2Qty;
    const totalVal = store1Val + store2Val;
    
    const pendingOrders = state.orders.filter(o => o.status === 'pending').length;
    const alertsCount = getExpiryAlerts().length;

    // تحديث عناوين الإحصائيات لتوضيح التصنيف النشط
    document.getElementById('stat-grand-total-title').innerText = `المجموع الكلي للمواد${filterSuffix}`;
    document.getElementById('stat-store1-title').innerText = `رصيد مخزن رقم 1 (الرئيسي)${filterSuffix}`;
    document.getElementById('stat-store2-title').innerText = `رصيد مخزن رقم 2 (الفرعي)${filterSuffix}`;
    document.getElementById('stat-total-value-title').innerText = `إجمالي قيمة المستودعات${filterSuffix}`;

    document.getElementById('stat-grand-total').innerText = grandTotalQty;

    document.getElementById('stat-store1').innerText = store1Qty;
    document.getElementById('stat-store1-value').innerText = `القيمة: ${store1Val.toLocaleString('ar-EG')} د.ع`;
    
    document.getElementById('stat-store2').innerText = store2Qty;
    document.getElementById('stat-store2-value').innerText = `القيمة: ${store2Val.toLocaleString('ar-EG')} د.ع`;
    
    document.getElementById('stat-total-value').innerText = `${totalVal.toLocaleString('ar-EG')} د.ع`;
    document.getElementById('stat-pending-orders').innerText = pendingOrders;
    
    const pendingOrdersBadge = document.getElementById('alert-bell-badge');
    if (pendingOrdersBadge) {
        if (pendingOrders > 0) {
            pendingOrdersBadge.innerText = pendingOrders;
            pendingOrdersBadge.classList.remove('hidden');
        } else {
            pendingOrdersBadge.classList.add('hidden');
        }
    }

    renderStore1Table();
    renderStore2Table();
    renderGrandTotalTable();
    renderAdminOrdersTable();
    renderExpiryAlertsPanel();
    renderForecastPanel();
    renderTransactionsTable();
    if (document.getElementById('issue-reports-container') || document.getElementById('issue-reports-tbody')) {
        renderIssueReportsTable();
    }
    if (document.getElementById('tab-system-materials') && document.getElementById('tab-system-materials').classList.contains('active')) {
        renderSystemMaterialsTable();
    }
    renderAdminSidebarMenu();
}

// عرض لوحة تحكم الزبون
function renderCustomerDashboard() {
    let materialsList = getGrandTotalMaterials();
    const tbody = document.getElementById('customer-stock-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        const searchVal = document.getElementById('customer-search-input').value.toLowerCase();

        // فلترة بالتصنيف
        if (currentCustomerCategoryFilter !== 'all') {
            materialsList = materialsList.filter(m => m.category === currentCustomerCategoryFilter);
        }

        const canOrder = state.currentUser.permission !== 'view_only';

        materialsList.forEach(mat => {
            if (mat.quantity <= 0) return;
            if (searchVal && !mat.name.toLowerCase().includes(searchVal)) return;

            const batchesDetails = mat.batches.map(b => 
                `<div style="font-size:0.8rem; border-bottom:1px solid var(--border-color); padding: 4px 0;">
                    الدفعة: <code style="color:var(--accent)">${b.batchNumber}</code> | 
                    الاكسباير: <span style="font-weight:600">${b.expiryDate}</span> | 
                    العدد: <span class="tag tag-store1">${b.quantity} ق</span> (${b.store})
                 </div>`
            ).join('');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:700;">
                    ${mat.name} 
                    <span class="tag" style="background-color:var(--bg-tertiary); color:var(--text-secondary); font-size:0.75rem; padding: 2px 6px; margin-right:8px;">${mat.category}</span>
                </td>
                <td>${mat.company}</td>
                <td style="font-size:1.1rem; font-weight:700; color:var(--success);">${mat.quantity} قطعة</td>
                <td>
                    <div style="max-height: 120px; overflow-y:auto; padding-left:10px;">
                        ${batchesDetails}
                    </div>
                </td>
                <td>
                    ${canOrder ? `
                        <button class="btn btn-primary" onclick="openOrderModalFor('${encodeURIComponent(mat.name)}')">➕ إضافة للطلبية</button>
                    ` : `
                        <span class="tag tag-rejected" style="font-size:0.85rem;">عرض فقط (صلاحية مقلصة)</span>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (tbody.children.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">لا توجد مواد متوفرة تطابق خيارات التصفية والبحث حالياً</td></tr>`;
        }
    }

    renderCustomerCartTable();
    updateCartBadge();
    renderCustomerOrdersTable();
}

// فتح مودال تقديم الطلبية الفورية المباشرة للزبون
let selectedMaterialNameForOrder = null;
function openOrderModalFor(encodedName) {
    if (state.currentUser.permission === 'view_only') {
        showToast('صلاحيتك مقلصة (عرض فقط). لا يمكنك إضافة مواد للطلبية.', 'danger');
        return;
    }
    selectedMaterialNameForOrder = decodeURIComponent(encodedName);
    document.getElementById('order-item-name').innerText = selectedMaterialNameForOrder;
    document.getElementById('order-item-qty').value = 1;
    openModal('customer-order-modal');
}

// إضافة المادة للطلبية (السلة) بالكمية المحددة
function submitCustomerOrderForm() {
    const qty = parseInt(document.getElementById('order-item-qty').value);
    if (isNaN(qty) || qty <= 0) {
        showToast('الرجاء إدخال كمية صحيحة', 'danger');
        return;
    }
    
    if (!selectedMaterialNameForOrder) return;
    
    const totalAvailable = state.materials
        .filter(m => m.name.toLowerCase() === selectedMaterialNameForOrder.toLowerCase())
        .reduce((sum, m) => sum + m.quantity, 0);

    let item = state.customerCart.find(i => i.name === selectedMaterialNameForOrder);
    const requestedQty = (item ? item.quantity : 0) + qty;
    
    if (requestedQty > totalAvailable) {
        showToast(`رصيد غير كافي! الكمية المتوفرة الكلية في المخازن هي ${totalAvailable} قطعة فقط.`, 'danger');
        return;
    }

    if (item) {
        item.quantity += qty;
    } else {
        state.customerCart.push({ name: selectedMaterialNameForOrder, quantity: qty });
    }
    state.save();
    showToast(`تمت إضافة ${qty} قطعة من "${selectedMaterialNameForOrder}" إلى قائمة الطلبية`, 'success');
    
    closeModal('customer-order-modal');
    selectedMaterialNameForOrder = null;
    
    updateCartBadge();
    renderCustomerDashboard();
}

// رسم جدول سلة الطلبية الحالية (قائمة طلبية زبون)
function renderCustomerCartTable() {
    const tbody = document.getElementById('cust-cart-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    state.customerCart.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700; color:var(--text-primary);">${item.name}</td>
            <td style="text-align: center;">
                <input type="number" class="form-control" style="width: 90px; text-align: center; display: inline-block;" min="1" value="${item.quantity}" onchange="updateCartQty(${index}, this.value)">
            </td>
            <td style="text-align: left;">
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem; background-color: var(--danger-bg); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.2);" onclick="removeFromCart(${index})">🗑️ إزالة</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    const actionsContainer = document.getElementById('cart-actions-container');
    if (state.customerCart.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-secondary); padding: 25px;">قائمة الطلبية فارغة حالياً. قم بإضافة مواد من تبويب "المواد الطبية المتوفرة للتصنيف".</td></tr>`;
        if (actionsContainer) actionsContainer.style.display = 'none';
    } else {
        if (actionsContainer) actionsContainer.style.display = 'flex';
    }
}

// إزالة مادة من قائمة طلبية الزبون
function removeFromCart(index) {
    if (index >= 0 && index < state.customerCart.length) {
        const removedItem = state.customerCart[index];
        state.customerCart.splice(index, 1);
        state.save();
        showToast(`تمت إزالة "${removedItem.name}" من الطلبية`, 'warning');
        updateCartBadge();
        renderCustomerCartTable();
    }
}

// تعديل كمية مادة داخل قائمة الطلبية
function updateCartQty(index, qty) {
    const quantity = parseInt(qty);
    if (isNaN(quantity) || quantity <= 0) {
        removeFromCart(index);
        return;
    }
    
    const itemName = state.customerCart[index].name;
    const totalAvailable = state.materials
        .filter(m => m.name.toLowerCase() === itemName.toLowerCase())
        .reduce((sum, m) => sum + m.quantity, 0);

    if (quantity > totalAvailable) {
        showToast(`رصيد غير كافي! الكمية المتوفرة الكلية للمادة "${itemName}" هي ${totalAvailable} قطعة فقط.`, 'danger');
        renderCustomerCartTable(); // إعادة رسم السلة للتراجع عن القيمة المدخلة الخاطئة في خانة المدخل الرقمي
        return;
    }
    
    state.customerCart[index].quantity = quantity;
    state.save();
    updateCartBadge();
}

// تحديث شارة عدد المواد في تبويب قائمة طلبية زبون
function updateCartBadge() {
    const badge = document.getElementById('cust-cart-badge');
    if (!badge) return;
    
    const count = state.customerCart.reduce((sum, item) => sum + item.quantity, 0);
    if (count > 0) {
        badge.innerText = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// إرسال الطلبية كاملة وتوجيهها للمستودع وتفريغ القائمة
function checkoutCart(sendWA) {
    if (state.customerCart.length === 0) {
        showToast('سلة الطلبية فارغة حالياً! يرجى إضافة مواد أولاً.', 'warning');
        return;
    }
    
    // التحقق النهائي من الأرصدة المتوفرة في المخازن لجميع بنود السلة
    for (let item of state.customerCart) {
        const totalAvailable = state.materials
            .filter(m => m.name.toLowerCase() === item.name.toLowerCase())
            .reduce((sum, m) => sum + m.quantity, 0);
            
        if (item.quantity > totalAvailable) {
            showToast(`رصيد غير كافي للمادة "${item.name}"! الكمية المطلوبة: ${item.quantity} قطعة، والمتوفر في المخازن: ${totalAvailable} قطعة فقط.`, 'danger');
            return;
        }
    }
    
    const newOrder = {
        id: 'ord-' + Date.now(),
        customerId: state.currentUser.username,
        customerName: state.currentUser.name,
        items: [...state.customerCart],
        status: 'pending',
        date: new Date().toISOString()
    };
    
    state.orders.unshift(newOrder);
    
    // تفريغ السلة بعد الطلب
    state.customerCart = [];
    state.save();
    
    updateCartBadge();
    
    // التبديل التلقائي لتبويب "طلبياتي السابقة وتتبع التجهيز"
    const tabBtn = document.querySelector(`.tab-btn[data-tab="tab-cust-orders"]`);
    if (tabBtn) {
        tabBtn.click();
    }
    
    // إعادة رسم لوحة تحكم الزبون وتحديث القوائم
    renderCustomerDashboard();
    
    if (sendWA) {
        // توليد ملف الـ PDF لطلب التجهيز
        generateCustomerOrderPDF(newOrder);
        
        // إرسال إشعار تفاصيل الطلبية لمجموعة الواتساب ونسخ النص تلقائياً
        sendWhatsAppNotification(newOrder);
    } else {
        showToast('تم تقديم طلب التجهيز الصامت لقسم المخازن بنجاح وقيد المراجعة', 'success');
    }
}



// توليد صفحة طباعة طلب العميل بصيغة PDF
function generateCustomerOrderPDF(order) {
    const today = new Date().toLocaleDateString('ar-EG');
    const printWindow = window.open('', '_blank');
    
    const tableRows = order.items.map((item, idx) => `
        <tr>
            <td style="width: 10%; text-align: center; border: 1px solid #cbd5e1; padding: 12px 15px; font-size: 13px;">${idx + 1}</td>
            <td style="width: 70%; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px 15px; font-size: 13px;">${item.name}</td>
            <td style="width: 20%; font-weight: bold; text-align: center; font-size: 14px; color: #1e3a8a; border: 1px solid #cbd5e1; padding: 12px 15px;">${item.quantity}</td>
        </tr>
    `).join('');
    
    const reportTitle = `طلب تجهيز مواد طبية - رقم الطلب: ${order.id.split('-')[1]}`;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${reportTitle}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                body {
                    font-family: 'Cairo', sans-serif;
                    padding: 40px;
                    color: #1e293b;
                    background-color: #ffffff;
                    direction: rtl;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #3b82f6;
                    padding-bottom: 15px;
                }
                .header h1 {
                    margin: 0 0 5px 0;
                    font-size: 22px;
                    color: #1e3a8a;
                }
                .header h2 {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                    color: #475569;
                    font-weight: normal;
                }
                .header p {
                    margin: 5px 0;
                    color: #2563eb;
                    font-size: 16px;
                    font-weight: bold;
                }
                .meta-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 25px;
                    font-size: 13px;
                    color: #475569;
                    background-color: #f8fafc;
                    padding: 12px 20px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                    margin-bottom: 30px;
                }
                th {
                    border: 1px solid #cbd5e1;
                    padding: 12px 15px;
                    text-align: right;
                    font-size: 13px;
                    background-color: #f1f5f9;
                    color: #0f172a;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                .signature-section {
                    margin-top: 50px;
                    display: flex;
                    justify-content: space-between;
                    padding: 0 30px;
                    font-size: 13px;
                }
                .signature-box {
                    text-align: center;
                    width: 180px;
                }
                .signature-line {
                    margin-top: 40px;
                    border-top: 1px solid #475569;
                }
                .footer {
                    margin-top: 60px;
                    text-align: center;
                    font-size: 10px;
                    color: #94a3b8;
                    border-top: 1px dashed #cbd5e1;
                    padding-top: 15px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${state.systemConfig.centerName}</h1>
                <h2>شعبة جرد ومستودعات المستهلكات الطبية</h2>
                <p style="color: #ef4444;">طلب تجهيز مواد قسطرة رسمية (PDF)</p>
            </div>
            
            <div class="meta-info">
                <div>الجهة الطالبة: <strong>${order.customerName}</strong></div>
                <div>تاريخ الطلب: <strong>${today}</strong></div>
                <div>حالة الطلب: <strong>قيد المراجعة والاعتماد</strong></div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 10%; text-align: center;">#</th>
                        <th style="width: 70%;">إسم المادة الطبية المطلوبة</th>
                        <th style="width: 20%; text-align: center;">الكمية المطلوبة</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <p style="font-size: 12px; color: #475569; margin-bottom: 30px;">
                * يرجى التفضل بالموافقة على صرف المواد المدرجة في الجدول أعلاه لغرض استخدامها في صالات العمليات.
            </p>
            
            <div class="signature-section">
                <div class="signature-box">
                    <p>توقيع الجهة الطالبة</p>
                    <p style="font-size:0.85rem; color:#64748b; margin-top:5px;">(${order.customerName})</p>
                    <div class="signature-line"></div>
                </div>
                <div class="signature-box">
                    <p>اعتماد مدير المخازن</p>
                    <div class="signature-line"></div>
                </div>
            </div>
            
            <div class="footer">
                <p>تم توليد هذا الطلب الرسمي بواسطة نظام مخازن القسطرة. معرف الطلب: ${order.id}</p>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// متغيرات وتكوين ترقيم صفحات المخازن والأدمن (الافتراضي 10 صفوف / قوائم)
let paginationConfig = {
    store1: { page: 1, rowsPerPage: 10 },
    store2: { page: 1, rowsPerPage: 10 },
    'grand-total': { page: 1, rowsPerPage: 10 },
    forecast: { page: 1, rowsPerPage: 10 },
    invoices: { page: 1, rowsPerPage: 10 },
    'system-materials': { page: 1, rowsPerPage: 10 }
};

function changeStorePageSize(storeKey) {
    const select = document.getElementById(`${storeKey}-rows-per-page`);
    if (!select) return;
    const value = select.value;
    
    paginationConfig[storeKey].rowsPerPage = value === 'all' ? 'all' : parseInt(value);
    paginationConfig[storeKey].page = 1; // إعادة للصفحة الأولى عند تغيير مقاس الصفحة
    
    if (storeKey === 'store1') renderStore1Table();
    else if (storeKey === 'store2') renderStore2Table();
    else if (storeKey === 'grand-total') renderGrandTotalTable();
    else if (storeKey === 'forecast') renderForecastPanel();
    else if (storeKey === 'invoices') renderSavedReceiptsTable();
    else if (storeKey === 'system-materials') renderSystemMaterialsTable();
}
window.changeStorePageSize = changeStorePageSize;

// دالة تغيير الصفحة النشطة
function changeStorePage(storeKey, pageNum) {
    paginationConfig[storeKey].page = pageNum;
    if (storeKey === 'store1') renderStore1Table();
    else if (storeKey === 'store2') renderStore2Table();
    else if (storeKey === 'grand-total') renderGrandTotalTable();
    else if (storeKey === 'forecast') renderForecastPanel();
    else if (storeKey === 'invoices') renderSavedReceiptsTable();
    else if (storeKey === 'system-materials') renderSystemMaterialsTable();
}
window.changeStorePage = changeStorePage;

// دالة مساعدة لرسم أزرار الانتقال بين الصفحات
function renderPaginationButtons(storeKey, totalItems) {
    const buttonsContainer = document.getElementById(`${storeKey}-pagination-buttons`);
    if (!buttonsContainer) return;
    
    buttonsContainer.innerHTML = '';
    const config = paginationConfig[storeKey];
    
    if (config.rowsPerPage === 'all') {
        return;
    }
    
    const totalPages = Math.ceil(totalItems / config.rowsPerPage) || 1;
    
    // زر السابق
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '‹';
    prevBtn.disabled = config.page === 1;
    const prevPageNum = config.page - 1;
    prevBtn.onclick = () => changeStorePage(storeKey, prevPageNum);
    buttonsContainer.appendChild(prevBtn);
    
    // حساب الصفحات المعروضة
    const startPage = Math.max(1, config.page - 2);
    const endPage = Math.min(totalPages, config.page + 2);
    
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.className = 'page-btn';
        firstBtn.innerText = '1';
        firstBtn.onclick = () => changeStorePage(storeKey, 1);
        buttonsContainer.appendChild(firstBtn);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.innerText = '...';
            dots.style.margin = '0 5px';
            dots.style.color = 'var(--text-secondary)';
            buttonsContainer.appendChild(dots);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${config.page === i ? 'active' : ''}`;
        pageBtn.innerText = i;
        const pageNum = i;
        pageBtn.onclick = () => changeStorePage(storeKey, pageNum);
        buttonsContainer.appendChild(pageBtn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.innerText = '...';
            dots.style.margin = '0 5px';
            dots.style.color = 'var(--text-secondary)';
            buttonsContainer.appendChild(dots);
        }
        
        const lastBtn = document.createElement('button');
        lastBtn.className = 'page-btn';
        lastBtn.innerText = totalPages;
        const lastPageNum = totalPages;
        lastBtn.onclick = () => changeStorePage(storeKey, lastPageNum);
        buttonsContainer.appendChild(lastBtn);
    }
    
    // زر التالي
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '›';
    nextBtn.disabled = config.page === totalPages;
    const nextPageNum = config.page + 1;
    nextBtn.onclick = () => changeStorePage(storeKey, nextPageNum);
    buttonsContainer.appendChild(nextBtn);
}

// تفاصيل مخزن 1
function renderStore1Table() {
    const tbody = document.getElementById('store1-tbody');
    tbody.innerHTML = '';
    const searchVal = document.getElementById('admin-search-input').value.toLowerCase();

    let store1Items = state.materials.filter(m => m.store === 'store1');

    if (currentAdminCategoryFilter !== 'all') {
        store1Items = store1Items.filter(m => m.category === currentAdminCategoryFilter);
    }

    if (searchVal) {
        store1Items = store1Items.filter(mat => 
            mat.name.toLowerCase().includes(searchVal) || 
            mat.batchNumber.toLowerCase().includes(searchVal)
        );
    }

    // فرز المواد حسب خيار الترتيب المختار
    store1Items = sortItems(store1Items, currentAdminSortMode);

    // تطبيق ترقيم الصفحات
    const totalItems = store1Items.length;
    const config = paginationConfig.store1;
    
    let displayedItems = store1Items;
    if (config.rowsPerPage !== 'all') {
        const totalPages = Math.ceil(totalItems / config.rowsPerPage);
        if (config.page > totalPages && totalPages > 0) {
            config.page = totalPages;
        }
        const startIndex = (config.page - 1) * config.rowsPerPage;
        const endIndex = startIndex + config.rowsPerPage;
        displayedItems = store1Items.slice(startIndex, endIndex);
    }

    displayedItems.forEach(mat => {
        const isExpired = new Date(mat.expiryDate) < new Date();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700">
                ${mat.name}
                <span class="tag" style="background-color:var(--bg-tertiary); color:var(--text-secondary); font-size:0.75rem; padding: 2px 6px; margin-right:8px;">${mat.category || 'أخرى'}</span>
                <span class="tag tag-source-${mat.sourceType === 'مشتريات' ? 'purchase' : mat.sourceType === 'فاتورة' ? 'invoice' : 'general'}" style="font-size:0.75rem; padding: 2px 6px; margin-right:4px;">${mat.sourceType || 'عامة'}</span>
            </td>
            <td><code style="color:var(--accent)">${mat.batchNumber}</code></td>
            <td class="${isExpired ? 'verdict-danger' : ''}" style="font-weight:600">${mat.expiryDate} ${isExpired ? '(منتهي)' : ''}</td>
            <td style="font-size:1.05rem; font-weight:700">${mat.quantity}</td>
            <td style="font-weight:600; color:var(--text-secondary);">${(mat.price || 0).toLocaleString('ar-EG')} د.ع</td>
            <td style="font-weight:700; color:var(--success);">${((mat.price || 0) * mat.quantity).toLocaleString('ar-EG')} د.ع</td>
            <td>${mat.company}</td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.75rem;" onclick="openEditMaterialModal('${mat.id}')">📝 تعديل</button>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.75rem; background-color:var(--danger-bg); color:#fca5a5;" onclick="triggerDeleteMaterial('${mat.id}')">🗑️ حذف</button>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.75rem;" onclick="openReconcileModal('${mat.id}')">✍ جرد</button>
                    <button class="btn btn-primary" style="padding: 4px 8px; font-size:0.75rem;" onclick="openTransferModal('${mat.id}')">⇄ تحويل لـ 2</button>
                    <button class="btn btn-primary" style="padding: 4px 8px; font-size:0.75rem; background-color:var(--accent);" onclick="openDirectIssueModal('${mat.id}', 'store1')">صرف مباشر</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (tbody.children.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">لا توجد مواد تطابق خيارات التصفية والبحث في مخزن 1</td></tr>`;
    }

    renderPaginationButtons('store1', totalItems);
}

// تفاصيل مخزن 2
function renderStore2Table() {
    const tbody = document.getElementById('store2-tbody');
    tbody.innerHTML = '';
    const searchVal = document.getElementById('admin-search-input').value.toLowerCase();

    let store2Items = state.materials.filter(m => m.store === 'store2');

    if (currentAdminCategoryFilter !== 'all') {
        store2Items = store2Items.filter(m => m.category === currentAdminCategoryFilter);
    }

    if (searchVal) {
        store2Items = store2Items.filter(mat => 
            mat.name.toLowerCase().includes(searchVal) || 
            mat.batchNumber.toLowerCase().includes(searchVal)
        );
    }

    // فرز المواد حسب خيار الترتيب المختار
    store2Items = sortItems(store2Items, currentAdminSortMode);

    // تطبيق ترقيم الصفحات
    const totalItems = store2Items.length;
    const config = paginationConfig.store2;
    
    let displayedItems = store2Items;
    if (config.rowsPerPage !== 'all') {
        const totalPages = Math.ceil(totalItems / config.rowsPerPage);
        if (config.page > totalPages && totalPages > 0) {
            config.page = totalPages;
        }
        const startIndex = (config.page - 1) * config.rowsPerPage;
        const endIndex = startIndex + config.rowsPerPage;
        displayedItems = store2Items.slice(startIndex, endIndex);
    }

    displayedItems.forEach(mat => {
        const isExpired = new Date(mat.expiryDate) < new Date();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700">
                ${mat.name}
                <span class="tag" style="background-color:var(--bg-tertiary); color:var(--text-secondary); font-size:0.75rem; padding: 2px 6px; margin-right:8px;">${mat.category || 'أخرى'}</span>
                <span class="tag tag-source-${mat.sourceType === 'مشتريات' ? 'purchase' : mat.sourceType === 'فاتورة' ? 'invoice' : 'general'}" style="font-size:0.75rem; padding: 2px 6px; margin-right:4px;">${mat.sourceType || 'عامة'}</span>
            </td>
            <td><code style="color:var(--accent)">${mat.batchNumber}</code></td>
            <td class="${isExpired ? 'verdict-danger' : ''}" style="font-weight:600">${mat.expiryDate} ${isExpired ? '(منتهي)' : ''}</td>
            <td style="font-size:1.05rem; font-weight:700">${mat.quantity}</td>
            <td style="font-weight:600; color:var(--text-secondary);">${(mat.price || 0).toLocaleString('ar-EG')} د.ع</td>
            <td style="font-weight:700; color:var(--success);">${((mat.price || 0) * mat.quantity).toLocaleString('ar-EG')} د.ع</td>
            <td>${mat.company}</td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.75rem;" onclick="openEditMaterialModal('${mat.id}')">📝 تعديل</button>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.75rem; background-color:var(--danger-bg); color:#fca5a5;" onclick="triggerDeleteMaterial('${mat.id}')">🗑️ حذف</button>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.75rem;" onclick="openReconcileModal('${mat.id}')">✍ جرد</button>
                    <button class="btn btn-primary" style="padding: 4px 8px; font-size:0.75rem; background-color:var(--accent);" onclick="openDirectIssueModal('${mat.id}', 'store2')">صرف للزبائن</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (tbody.children.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">لا توجد مواد تطابق خيارات التصفية والبحث في مخزن 2</td></tr>`;
    }

    renderPaginationButtons('store2', totalItems);
}

// المجموع الكلي
function renderGrandTotalTable() {
    const tbody = document.getElementById('grand-total-tbody');
    tbody.innerHTML = '';
    const searchVal = document.getElementById('admin-search-input').value.toLowerCase();

    let totals = getGrandTotalMaterials();

    if (currentAdminCategoryFilter !== 'all') {
        totals = totals.filter(m => m.category === currentAdminCategoryFilter);
    }

    if (searchVal) {
        totals = totals.filter(mat => mat.name.toLowerCase().includes(searchVal));
    }

    // فرز المواد حسب خيار الترتيب المختار
    totals = sortItems(totals, currentAdminSortMode);

    // تطبيق ترقيم الصفحات
    const totalItems = totals.length;
    const config = paginationConfig['grand-total'];
    
    let displayedItems = totals;
    if (config.rowsPerPage !== 'all') {
        const totalPages = Math.ceil(totalItems / config.rowsPerPage);
        if (config.page > totalPages && totalPages > 0) {
            config.page = totalPages;
        }
        const startIndex = (config.page - 1) * config.rowsPerPage;
        const endIndex = startIndex + config.rowsPerPage;
        displayedItems = totals.slice(startIndex, endIndex);
    }

    displayedItems.forEach(mat => {
        const sources = [...new Set(mat.batches.map(b => b.sourceType || 'عامة'))];
        const sourceBadges = sources.map(s => 
            `<span class="tag tag-source-${s === 'مشتريات' ? 'purchase' : s === 'فاتورة' ? 'invoice' : 'general'}" style="font-size:0.75rem; padding: 2px 6px; margin-right:4px;">${s}</span>`
        ).join('');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700">
                ${mat.name}
                <span class="tag" style="background-color:var(--bg-tertiary); color:var(--text-secondary); font-size:0.75rem; padding: 2px 6px; margin-right:8px;">${mat.category}</span>
                ${sourceBadges}
            </td>
            <td>${mat.company}</td>
            <td style="font-weight:700; color:var(--primary); font-size:1.1rem;">${mat.quantity} قطعة</td>
            <td><span class="tag tag-store1">${mat.store1Qty} قطعة</span></td>
            <td><span class="tag tag-store2">${mat.store2Qty} قطعة</span></td>
            <td style="font-weight:600; color:var(--text-secondary);">${(mat.quantity > 0 ? (mat.totalValue / mat.quantity) : 0).toLocaleString('ar-EG')} د.ع</td>
            <td style="font-weight:700; color:var(--success);">${mat.totalValue.toLocaleString('ar-EG')} د.ع</td>
        `;
        tbody.appendChild(tr);
    });

    if (tbody.children.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">لا توجد مواد مطابقة للبحث والتصنيف</td></tr>`;
    }

    renderPaginationButtons('grand-total', totalItems);
}

// --- تقارير صرف المواد للمرضى والعمليات ---
function onOpenIssueReportsTab() {
    const tabPane = document.getElementById('tab-issue-reports');
    if (tabPane) {
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        tabPane.classList.add('active');
    }
    
    document.querySelectorAll('.menu-item.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === 'tab-issue-reports') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const matInput = document.getElementById('issue-report-material-filter');
    if (matInput) {
        matInput.value = '';
    }

    const catSelect = document.getElementById('issue-report-category-filter');
    if (catSelect) {
        catSelect.innerHTML = '<option value="all">📁 كل التصنيفات</option>';
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            catSelect.appendChild(opt);
        });
    }

    const dateFromInput = document.getElementById('issue-report-date-from');
    const dateToInput = document.getElementById('issue-report-date-to');
    
    if (dateFromInput && !dateFromInput.value) {
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        dateFromInput.value = firstDay;
    }
    if (dateToInput && !dateToInput.value) {
        const today = new Date().toISOString().split('T')[0];
        dateToInput.value = today;
    }

    renderIssueReportsTable();
}
window.onOpenIssueReportsTab = onOpenIssueReportsTab;

function formatArabicDate(dateStr) {
    if (!dateStr || dateStr === 'غير محدد') return 'غير محدد';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) {
            const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const dayName = days[d.getDay()];
            return `${dayName} (${dateStr})`;
        }
    }
    return dateStr;
}
window.formatArabicDate = formatArabicDate;

function renderIssueReportsTable() {
    const container = document.getElementById('issue-reports-container');
    const tbody = document.getElementById('issue-reports-tbody');
    if (!container && !tbody) return;
    
    if (container) container.innerHTML = '';
    if (tbody) tbody.innerHTML = '';
    
    const matFilterInput = document.getElementById('issue-report-material-filter');
    const matFilter = matFilterInput ? matFilterInput.value.trim().toLowerCase() : '';
    
    const catFilterSelect = document.getElementById('issue-report-category-filter');
    const catFilter = catFilterSelect ? catFilterSelect.value : 'all';
    
    const sortOrderSelect = document.getElementById('issue-report-sort-order');
    const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'desc';
    
    const dateFromInput = document.getElementById('issue-report-date-from');
    const dateFrom = dateFromInput ? dateFromInput.value : '';
    
    const dateToInput = document.getElementById('issue-report-date-to');
    const dateTo = dateToInput ? dateToInput.value : '';
    
    let issueTxs = state.transactions.filter(tx => tx.type === 'issue');
    
    if (matFilter) {
        issueTxs = issueTxs.filter(tx => tx.materialName.toLowerCase().includes(matFilter));
    }
    
    if (catFilter !== 'all') {
        issueTxs = issueTxs.filter(tx => {
            const mat = state.materials.find(m => m.name === tx.materialName);
            return (mat ? mat.category : 'أخرى') === catFilter;
        });
    }
    
    if (dateFrom) {
        issueTxs = issueTxs.filter(tx => (tx.date || '').split('T')[0] >= dateFrom);
    }
    if (dateTo) {
        issueTxs = issueTxs.filter(tx => (tx.date || '').split('T')[0] <= dateTo);
    }
    
    // تجميع الحركات في قوائم يومية حسب تاريخ الصرف
    const dateGroups = {};
    issueTxs.forEach(tx => {
        const dKey = tx.date ? tx.date.split('T')[0] : 'غير محدد';
        if (!dateGroups[dKey]) {
            dateGroups[dKey] = [];
        }
        dateGroups[dKey].push(tx);
    });
    
    // ترتيب تواريخ القوائم حسب اختيار المستخدم
    const sortedDates = Object.keys(dateGroups).sort((a, b) => {
        if (a === 'غير محدد') return 1;
        if (b === 'غير محدد') return -1;
        return sortOrder === 'desc' 
            ? new Date(b) - new Date(a)
            : new Date(a) - new Date(b);
    });
    
    let grandTotalQty = 0;
    let grandTotalValue = 0;
    
    if (container) {
        if (sortedDates.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 40px 15px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                    <span style="font-size: 2.2rem; display: block; margin-bottom: 10px;">📋</span>
                    لا توجد أي حركات صرف مطابقة للخيارات المحددة في هذا النطاق.
                </div>
            `;
        } else {
            sortedDates.forEach((dateKey) => {
                const dayTxs = dateGroups[dateKey];
                let dayTotalQty = 0;
                let dayTotalVal = 0;
                
                let rowsHtml = '';
                dayTxs.forEach((tx, idx) => {
                    const mat = state.materials.find(m => m.name === tx.materialName);
                    const category = mat ? mat.category : 'أخرى';
                    const price = mat ? (mat.price || 0) : 0;
                    const totalLineValue = tx.quantity * price;
                    
                    dayTotalQty += tx.quantity;
                    dayTotalVal += totalLineValue;
                    grandTotalQty += tx.quantity;
                    grandTotalValue += totalLineValue;
                    
                    const storeBadge = tx.fromStore === 'store1' ? 'مخزن 1' : (tx.fromStore === 'store2' ? 'مخزن 2' : (tx.fromStore || 'المخزن'));
                    
                    rowsHtml += `
                        <tr>
                            <td style="text-align:center; font-weight:700;">${idx + 1}</td>
                            <td style="font-weight:700; color:var(--text-primary);">${tx.materialName}</td>
                            <td><code style="font-size:0.85rem; color:var(--accent);">${tx.batchNumber || 'بدون باج'}</code></td>
                            <td><span class="tag" style="background-color:var(--bg-tertiary); color:var(--text-secondary); font-size:0.75rem;">${category}</span></td>
                            <td style="font-weight:800; color:var(--primary); text-align:center; font-size:0.95rem;">${tx.quantity}</td>
                            <td>${price.toLocaleString('ar-EG')} د.ع</td>
                            <td style="font-weight:800; color:var(--success); font-size:0.95rem;">${totalLineValue.toLocaleString('ar-EG')} د.ع</td>
                            <td style="font-weight:700; color:#3b82f6;">${tx.toDest || 'قسم غير محدد'}</td>
                            <td><span class="tag" style="font-size:0.75rem;">${storeBadge}</span></td>
                        </tr>
                    `;
                });
                
                const safeId = dateKey.replace(/[^a-zA-Z0-9]/g, '_');
                const isCollapsed = !openedIssueDates.has(dateKey);

                const card = document.createElement('div');
                card.className = `daily-issue-card ${isCollapsed ? 'collapsed' : ''}`;
                card.id = `daily-issue-card-${safeId}`;
                card.setAttribute('data-date', dateKey);
                card.setAttribute('data-safe-id', safeId);

                card.innerHTML = `
                    <div class="daily-issue-header" onclick="toggleDailyIssueCard('${dateKey}', '${safeId}')" title="انقر لفتح / طي قائمة هذا اليوم">
                        <div class="daily-issue-header-info">
                            <span class="daily-issue-arrow">▼</span>
                            <span class="daily-issue-date-badge">📅 ${formatArabicDate(dateKey)}</span>
                            <span class="daily-issue-count-tag">${dayTxs.length} صنف / حركة صرف</span>
                        </div>
                        <div class="daily-issue-header-stats">
                            <span class="daily-stat-pill">مجموع القطع: <strong style="color:var(--primary); font-size:0.95rem;">${dayTotalQty.toLocaleString('ar-EG')}</strong> قطعة</span>
                            <span class="daily-stat-pill">القيمة الإجمالية: <strong style="color:var(--success); font-size:0.95rem;">${dayTotalVal.toLocaleString('ar-EG')} د.ع</strong></span>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); exportDailyIssueReportPDF('${dateKey}')" style="padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center; gap:5px; background:var(--primary-light); color:var(--primary); border:1px solid var(--primary); border-radius:6px; cursor:pointer;" title="طباعة قائمة هذا اليوم">
                                🖨️ طباعة قائمة هذا اليوم
                            </button>
                            <span class="daily-issue-toggle-btn">
                                <span class="daily-issue-toggle-text">${isCollapsed ? 'انقر للعرض 🔽' : 'طي القائمة 🔼'}</span>
                            </span>
                        </div>
                    </div>
                    <div class="daily-issue-body" id="daily-issue-body-${safeId}">
                        <div class="table-responsive">
                            <table class="table" style="margin-bottom:0;">
                                <thead>
                                    <tr>
                                        <th style="width:40px; text-align:center;">#</th>
                                        <th>إسم المادة الطبية</th>
                                        <th>رقم التشغيلة (الباج)</th>
                                        <th>التصنيف</th>
                                        <th style="text-align:center;">الكمية المصروفة</th>
                                        <th>سعر المفرد</th>
                                        <th>القيمة الإجمالية</th>
                                        <th>الجهة المستلمة / القسم</th>
                                        <th>المخزن الصادر منه</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                        </div>
                        <div class="daily-issue-footer">
                            <span>إجمالي صرفيات يوم ${formatArabicDate(dateKey)}</span>
                            <div style="display:flex; gap:15px;">
                                <span>القطع: <strong style="color:var(--primary);">${dayTotalQty.toLocaleString('ar-EG')}</strong> قطعة</span>
                                <span>المبلغ: <strong style="color:var(--success);">${dayTotalVal.toLocaleString('ar-EG')} د.ع</strong></span>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    }
    
    // تحديث إجماليات الفلتر
    const totalDaysSpan = document.getElementById('issue-report-total-days');
    if (totalDaysSpan) totalDaysSpan.innerText = sortedDates.length.toLocaleString('ar-EG');
    
    const totalQtySpan = document.getElementById('issue-report-total-qty');
    if (totalQtySpan) totalQtySpan.innerText = grandTotalQty.toLocaleString('ar-EG');
    
    const totalValSpan = document.getElementById('issue-report-total-value');
    if (totalValSpan) totalValSpan.innerText = grandTotalValue.toLocaleString('ar-EG');
}
window.renderIssueReportsTable = renderIssueReportsTable;

// حالة القوائم اليومية المفتوحة
let openedIssueDates = new Set();

function toggleDailyIssueCard(dateKey, safeId) {
    const card = document.getElementById(`daily-issue-card-${safeId}`) || document.querySelector(`.daily-issue-card[data-date="${dateKey}"]`);
    if (!card) return;
    
    const isCollapsed = card.classList.contains('collapsed');
    const toggleText = card.querySelector('.daily-issue-toggle-text');
    
    if (isCollapsed) {
        card.classList.remove('collapsed');
        openedIssueDates.add(dateKey);
        if (toggleText) toggleText.innerText = 'طي القائمة 🔼';
    } else {
        card.classList.add('collapsed');
        openedIssueDates.delete(dateKey);
        if (toggleText) toggleText.innerText = 'انقر للعرض 🔽';
    }
}
window.toggleDailyIssueCard = toggleDailyIssueCard;

function expandAllIssueReportCards() {
    document.querySelectorAll('.daily-issue-card').forEach(card => {
        card.classList.remove('collapsed');
        const dateKey = card.getAttribute('data-date');
        if (dateKey) openedIssueDates.add(dateKey);
        const toggleText = card.querySelector('.daily-issue-toggle-text');
        if (toggleText) toggleText.innerText = 'طي القائمة 🔼';
    });
}
window.expandAllIssueReportCards = expandAllIssueReportCards;

function collapseAllIssueReportCards() {
    document.querySelectorAll('.daily-issue-card').forEach(card => {
        card.classList.add('collapsed');
        const dateKey = card.getAttribute('data-date');
        if (dateKey) openedIssueDates.delete(dateKey);
        const toggleText = card.querySelector('.daily-issue-toggle-text');
        if (toggleText) toggleText.innerText = 'انقر للعرض 🔽';
    });
}
window.collapseAllIssueReportCards = collapseAllIssueReportCards;

// طباعة قائمة صرف يوم محدد كملف PDF
function exportDailyIssueReportPDF(dateKey) {
    const dayTxs = state.transactions.filter(tx => tx.type === 'issue' && (tx.date || '').split('T')[0] === dateKey);
    if (!dayTxs || dayTxs.length === 0) {
        showToast('لا توجد حركات صرف مسجلة لهذا التاريخ', 'warning');
        return;
    }
    
    let totalQty = 0;
    let totalVal = 0;
    
    const rowsHtml = dayTxs.map((tx, idx) => {
        const mat = state.materials.find(m => m.name === tx.materialName);
        const category = mat ? mat.category : 'أخرى';
        const price = mat ? (mat.price || 0) : 0;
        const totalLineValue = tx.quantity * price;
        
        totalQty += tx.quantity;
        totalVal += totalLineValue;
        
        const storeBadge = tx.fromStore === 'store1' ? 'مخزن 1' : (tx.fromStore === 'store2' ? 'مخزن 2' : (tx.fromStore || 'المخزن'));
        
        return `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td style="font-weight:bold;">${tx.materialName}</td>
                <td style="text-align:center;"><code>${tx.batchNumber || 'بدون باج'}</code></td>
                <td>${category}</td>
                <td style="font-weight:bold; color:#1e3a8a; text-align:center;">${tx.quantity}</td>
                <td style="text-align:center;">${price.toLocaleString('ar-EG')} د.ع</td>
                <td style="font-weight:bold; color:#15803d; text-align:center;">${totalLineValue.toLocaleString('ar-EG')} د.ع</td>
                <td style="font-weight:bold;">${tx.toDest || 'غير محدد'}</td>
                <td style="text-align:center;">${storeBadge}</td>
            </tr>
        `;
    }).join('');
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>قائمة صرف مواد - ${dateKey}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                body {
                    font-family: 'Cairo', sans-serif;
                    padding: 25px 35px;
                    color: #1e293b;
                    background-color: #ffffff;
                    direction: rtl;
                    font-size: 11px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #2563eb;
                    padding-bottom: 12px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 18px;
                    color: #1e3a8a;
                }
                .header h2 {
                    margin: 4px 0 0 0;
                    font-size: 13px;
                    color: #475569;
                    font-weight: normal;
                }
                .meta-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 15px;
                    font-size: 11px;
                    color: #1e293b;
                    background-color: #f8fafc;
                    padding: 10px 18px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: 8px 10px;
                    text-align: right;
                }
                th {
                    background-color: #f1f5f9;
                    color: #0f172a;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                .summary-section {
                    margin-top: 15px;
                    padding: 12px 18px;
                    background-color: #f0fdf4;
                    border: 1px solid #16a34a;
                    border-radius: 6px;
                    display: flex;
                    justify-content: space-between;
                    font-weight: bold;
                    font-size: 12px;
                }
                .signature-section {
                    margin-top: 40px;
                    display: flex;
                    justify-content: space-between;
                    padding: 0 30px;
                }
                .signature-box {
                    text-align: center;
                    width: 160px;
                }
                .signature-line {
                    margin-top: 35px;
                    border-top: 1px solid #475569;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${state.systemConfig.centerName}</h1>
                <h2>شعبة جرد ومستودعات المستهلكات الطبية</h2>
                <h3 style="color:#2563eb; margin: 6px 0 0 0; font-size: 15px;">قائمة صرف وتجهيز المواد للمرضى والعمليات</h3>
            </div>
            
            <div class="meta-info">
                <div>تاريخ الصرف: <strong style="color:#2563eb;">${formatArabicDate(dateKey)}</strong></div>
                <div>عدد الأصناف المصروفة: <strong>${dayTxs.length} صنف</strong></div>
                <div>تاريخ الطباعة: <strong>${new Date().toLocaleDateString('ar-EG')}</strong></div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%; text-align:center;">#</th>
                        <th style="width: 28%;">إسم المادة</th>
                        <th style="width: 12%; text-align:center;">الباج</th>
                        <th style="width: 12%;">التصنيف</th>
                        <th style="width: 10%; text-align:center;">الكمية</th>
                        <th style="width: 11%; text-align:center;">السعر</th>
                        <th style="width: 12%; text-align:center;">القيمة</th>
                        <th style="width: 12%;">المستلم / القسم</th>
                        <th style="width: 8%; text-align:center;">المخزن</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            
            <div class="summary-section">
                <span style="color:#166534;">إجمالي القطع المصروفة: ${totalQty.toLocaleString('ar-EG')} قطعة</span>
                <span style="color:#166534;">إجمالي القيمة المالية: ${totalVal.toLocaleString('ar-EG')} د.ع</span>
            </div>
            
            <div class="signature-section">
                <div class="signature-box">
                    <p>توقيع مسؤول الشعبة / الطبيب المستلم</p>
                    <div class="signature-line"></div>
                </div>
                <div class="signature-box">
                    <p>توقيع أمين المخزن المسؤول</p>
                    <div class="signature-line"></div>
                </div>
            </div>
            
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}
window.exportDailyIssueReportPDF = exportDailyIssueReportPDF;

// طباعة التقرير الشامل لجميع القوائم مقسمة ومرتبة حسب التاريخ
function exportIssueReportPDF() {
    const matFilterInput = document.getElementById('issue-report-material-filter');
    const matFilter = matFilterInput ? matFilterInput.value.trim().toLowerCase() : '';
    
    const catFilterSelect = document.getElementById('issue-report-category-filter');
    const catFilter = catFilterSelect ? catFilterSelect.value : 'all';
    
    const sortOrderSelect = document.getElementById('issue-report-sort-order');
    const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'desc';
    
    const dateFromInput = document.getElementById('issue-report-date-from');
    const dateFrom = dateFromInput ? dateFromInput.value : '';
    
    const dateToInput = document.getElementById('issue-report-date-to');
    const dateTo = dateToInput ? dateToInput.value : '';
    
    let issueTxs = state.transactions.filter(tx => tx.type === 'issue');
    
    if (matFilter) {
        issueTxs = issueTxs.filter(tx => tx.materialName.toLowerCase().includes(matFilter));
    }
    if (catFilter !== 'all') {
        issueTxs = issueTxs.filter(tx => {
            const mat = state.materials.find(m => m.name === tx.materialName);
            return (mat ? mat.category : 'أخرى') === catFilter;
        });
    }
    if (dateFrom) {
        issueTxs = issueTxs.filter(tx => (tx.date || '').split('T')[0] >= dateFrom);
    }
    if (dateTo) {
        issueTxs = issueTxs.filter(tx => (tx.date || '').split('T')[0] <= dateTo);
    }
    
    // تجميع الحركات حسب التاريخ
    const dateGroups = {};
    issueTxs.forEach(tx => {
        const dKey = tx.date ? tx.date.split('T')[0] : 'غير محدد';
        if (!dateGroups[dKey]) dateGroups[dKey] = [];
        dateGroups[dKey].push(tx);
    });
    
    const sortedDates = Object.keys(dateGroups).sort((a, b) => {
        if (a === 'غير محدد') return 1;
        if (b === 'غير محدد') return -1;
        return sortOrder === 'desc' 
            ? new Date(b) - new Date(a)
            : new Date(a) - new Date(b);
    });
    
    let totalQty = 0;
    let totalValue = 0;
    
    let dailyTablesHtml = '';
    
    sortedDates.forEach(dateKey => {
        const dayTxs = dateGroups[dateKey];
        let dayQty = 0;
        let dayVal = 0;
        
        const rowsHtml = dayTxs.map((tx, idx) => {
            const mat = state.materials.find(m => m.name === tx.materialName);
            const category = mat ? mat.category : 'أخرى';
            const price = mat ? (mat.price || 0) : 0;
            const totalLineValue = tx.quantity * price;
            
            dayQty += tx.quantity;
            dayVal += totalLineValue;
            totalQty += tx.quantity;
            totalValue += totalLineValue;
            
            const storeBadge = tx.fromStore === 'store1' ? 'مخزن 1' : (tx.fromStore === 'store2' ? 'مخزن 2' : (tx.fromStore || 'المخزن'));
            
            return `
                <tr>
                    <td style="text-align:center;">${idx + 1}</td>
                    <td style="font-weight:bold;">${tx.materialName}</td>
                    <td style="text-align:center;"><code>${tx.batchNumber || 'بدون باج'}</code></td>
                    <td>${category}</td>
                    <td style="font-weight:bold; color:#1e3a8a; text-align:center;">${tx.quantity}</td>
                    <td style="text-align:center;">${price.toLocaleString('ar-EG')} د.ع</td>
                    <td style="font-weight:bold; color:#15803d; text-align:center;">${totalLineValue.toLocaleString('ar-EG')} د.ع</td>
                    <td>${tx.toDest || 'غير محدد'}</td>
                    <td style="text-align:center;">${storeBadge}</td>
                </tr>
            `;
        }).join('');
        
        dailyTablesHtml += `
            <div style="margin-top: 25px; page-break-inside: avoid;">
                <div style="background-color: #f1f5f9; padding: 8px 14px; border: 1px solid #cbd5e1; border-bottom: none; font-weight: bold; display: flex; justify-content: space-between; border-radius: 6px 6px 0 0;">
                    <span style="color:#1e3a8a;">📅 قائمة صرف يوم: ${formatArabicDate(dateKey)} (${dayTxs.length} صنف)</span>
                    <span style="color:#0f172a;">مجموع اليوم: ${dayQty} قطعة (${dayVal.toLocaleString('ar-EG')} د.ع)</span>
                </div>
                <table style="margin-top: 0;">
                    <thead>
                        <tr>
                            <th style="width: 5%; text-align:center;">#</th>
                            <th style="width: 28%;">إسم المادة</th>
                            <th style="width: 12%; text-align:center;">الباج</th>
                            <th style="width: 12%;">التصنيف</th>
                            <th style="width: 10%; text-align:center;">الكمية</th>
                            <th style="width: 11%; text-align:center;">السعر</th>
                            <th style="width: 12%; text-align:center;">القيمة</th>
                            <th style="width: 12%;">المستلم / القسم</th>
                            <th style="width: 8%; text-align:center;">المخزن</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    });
    
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير صرف المواد الطبية الشامل</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                body {
                    font-family: 'Cairo', sans-serif;
                    padding: 20px 30px;
                    color: #1e293b;
                    background-color: #ffffff;
                    direction: rtl;
                    font-size: 11px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #2563eb;
                    padding-bottom: 12px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 18px;
                    color: #1e3a8a;
                }
                .header h2 {
                    margin: 4px 0 0 0;
                    font-size: 13px;
                    color: #475569;
                    font-weight: normal;
                }
                .meta-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 15px;
                    font-size: 10px;
                    color: #475569;
                    background-color: #f8fafc;
                    padding: 8px 15px;
                    border-radius: 5px;
                    border: 1px solid #e2e8f0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: 7px 9px;
                    text-align: right;
                }
                th {
                    background-color: #f8fafc;
                    color: #0f172a;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #fdfdfd;
                }
                .summary-section {
                    margin-top: 25px;
                    padding: 12px 18px;
                    background-color: #f0fdf4;
                    border: 1px solid #16a34a;
                    border-radius: 6px;
                    display: flex;
                    justify-content: space-between;
                    font-weight: bold;
                    font-size: 12px;
                }
                .signature-section {
                    margin-top: 35px;
                    display: flex;
                    justify-content: space-between;
                    padding: 0 20px;
                }
                .signature-box {
                    text-align: center;
                    width: 150px;
                }
                .signature-line {
                    margin-top: 30px;
                    border-top: 1px solid #475569;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${state.systemConfig.centerName}</h1>
                <h2>شعبة جرد ومستودعات المستهلكات الطبية</h2>
                <h3 style="color:#2563eb; margin: 5px 0 0 0;">تقرير صرف وتفصيل استهلاك المواد الطبية (مقسم حسب الأيام)</h3>
            </div>
            
            <div class="meta-info">
                <div>النطاق الزمني: <strong>${dateFrom || 'البداية'} إلى ${dateTo || 'اليوم'}</strong></div>
                <div>الترتيب: <strong>${sortOrder === 'desc' ? 'من الأحدث للأقدم' : 'من الأقدم للأحدث'}</strong></div>
                <div>المادة المصفاة: <strong>${matFilter ? matFilter : 'كل المواد'}</strong></div>
                <div>التصنيف: <strong>${catFilter === 'all' ? 'كل التصنيفات' : catFilter}</strong></div>
            </div>
            
            ${dailyTablesHtml || '<div style="text-align:center; padding:30px; color:#64748b;">لا توجد حركات صرف مطابقة للخيارات</div>'}
            
            <div class="summary-section">
                <span style="color:#166534;">إجمالي القوائم / الأيام: ${sortedDates.length} قائمة</span>
                <span style="color:#166534;">إجمالي الكمية المصروفة: ${totalQty.toLocaleString('ar-EG')} قطعة</span>
                <span style="color:#166534;">إجمالي القيمة المالية: ${totalValue.toLocaleString('ar-EG')} د.ع</span>
            </div>
            
            <div class="signature-section">
                <div class="signature-box">
                    <p>توقيع أمين المخزن المختص</p>
                    <div class="signature-line"></div>
                </div>
                <div class="signature-box">
                    <p>توقيع مدير قسم المخازن</p>
                    <div class="signature-line"></div>
                </div>
            </div>
            
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}
window.exportIssueReportPDF = exportIssueReportPDF;

// طلبات الزبائن (لوحة الأدمن) مرتبة تسلسلياً وتفاعلياً
let selectedAdminOrderId = null;
let currentAdminOrdersFilter = 'all'; // 'all', 'pending', 'completed'

function setAdminOrdersFilter(filter) {
    currentAdminOrdersFilter = filter;
    renderAdminOrdersTable();
}
window.setAdminOrdersFilter = setAdminOrdersFilter;

function renderAdminOrdersTable() {
    const listGroup = document.getElementById('admin-orders-list-group');
    if (!listGroup) return;

    listGroup.innerHTML = '';

    const allOrders = state.orders; // كل الطلبيات الواردة لجميع الزبائن للأدمن
    
    // الترتيب التاريخي التصاعدي: الأقدم يأخذ الرقم 1، والثاني الرقم 2...
    const chronologicalOrders = [...allOrders].reverse();
    
    // إنشاء مصفوفة العرض مرتبة تنازلياً (الأحدث بالأعلى)
    let reversedDisplayOrders = [];
    chronologicalOrders.forEach((ord, index) => {
        reversedDisplayOrders.unshift({
            order: ord,
            sequenceNumber: index + 1
        });
    });

    // تطبيق فلترة الطلبيات حسب التصفية المختارة
    if (currentAdminOrdersFilter === 'pending') {
        reversedDisplayOrders = reversedDisplayOrders.filter(item => item.order.status === 'pending');
    } else if (currentAdminOrdersFilter === 'completed') {
        reversedDisplayOrders = reversedDisplayOrders.filter(item => item.order.status === 'approved' || item.order.status === 'rejected');
    }

    // تصفية إضافية حسب اسم المادة المطلوبة (كتابة الاسم)
    const matFilterInput = document.getElementById('admin-orders-material-filter');
    if (matFilterInput && matFilterInput.value.trim()) {
        const query = matFilterInput.value.trim().toLowerCase();
        reversedDisplayOrders = reversedDisplayOrders.filter(item => 
            item.order.items.some(orderItem => orderItem.name.toLowerCase().includes(query))
        );
    }

    reversedDisplayOrders.forEach(item => {
        const ord = item.order;
        const seq = item.sequenceNumber;
        
        const dateStr = new Date(ord.date).toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        const statusClass = {
            'pending': 'tag-pending',
            'approved': 'tag-approved',
            'rejected': 'tag-rejected'
        }[ord.status];
        
        const statusText = {
            'pending': 'قيد الانتظار',
            'approved': 'تم الصرف',
            'rejected': 'مرفوض'
        }[ord.status];

        const isActive = ord.id === selectedAdminOrderId;
        
        const btn = document.createElement('div');
        btn.className = `order-list-item ${isActive ? 'active' : ''}`;
        
        btn.style.cssText = `
            padding: 12px 15px;
            background: ${isActive ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)'};
            border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'};
            border-radius: 8px;
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        btn.innerHTML = `
            <div>
                <strong style="display:block; color:var(--text-primary); font-size:0.95rem;">طلب رقم ${seq} (${ord.customerName})</strong>
                <span style="font-size:0.75rem; color:var(--text-secondary);">${dateStr}</span>
            </div>
            <span class="tag ${statusClass}" style="font-size:0.75rem; padding:3px 8px;">${statusText}</span>
        `;
        
        btn.addEventListener('click', () => {
            selectedAdminOrderId = ord.id;
            renderAdminOrdersTable(); // إعادة التلوين وتحديث التفاصيل
        });
        
        listGroup.appendChild(btn);
    });

    if (allOrders.length === 0) {
        listGroup.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary); font-size:0.85rem;">لا توجد طلبيات مسجلة حالياً.</div>`;
        renderAdminOrderDetails(null);
        return;
    }

    // إذا لم يكن هناك طلب محدد مسبقاً، نحدد الأحدث تلقائياً
    if (!selectedAdminOrderId && reversedDisplayOrders.length > 0) {
        selectedAdminOrderId = reversedDisplayOrders[0].order.id;
    }

    // عرض تفاصيل الطلب المحدد
    const activeItem = reversedDisplayOrders.find(item => item.order.id === selectedAdminOrderId);
    if (activeItem) {
        renderAdminOrderDetails(activeItem.order, activeItem.sequenceNumber);
    } else {
        renderAdminOrderDetails(null);
    }
}

// عرض تفاصيل طلب الزبون للأدمن في اللوحة اليسرى واتخاذ إجراءات الصرف أو الرفض
function renderAdminOrderDetails(order, sequenceNumber = 1) {
    const panel = document.getElementById('admin-order-details-panel');
    if (!panel) return;

    if (!order) {
        panel.innerHTML = `
            <span style="font-size: 3rem; margin-bottom: 15px;">📋</span>
            <p>الرجاء تحديد أحد الطلبات الواردة من القائمة الجانبية لعرض تفاصيل المواد واتخاذ إجراءات الموافقة والصرف أو الرفض.</p>
        `;
        return;
    }

    const dateStr = new Date(order.date).toLocaleString('ar-EG');
    
    const statusBadge = {
        'pending': '<span class="tag tag-pending" style="font-size:0.9rem; padding: 4px 10px;">⏳ قيد الانتظار وبانتظار قرار الصرف</span>',
        'approved': `<span class="tag tag-approved" style="font-size:0.9rem; padding: 4px 10px;">✓ تم الصرف والتجهيز (${order.sourceStore || 'مخزن 2 ثم 1'})</span>`,
        'rejected': '<span class="tag tag-rejected" style="font-size:0.9rem; padding: 4px 10px;">✗ تم رفض هذا الطلب من قبل إدارة المخازن</span>'
    }[order.status];

    const tableRows = order.items.map((item, idx) => `
        <tr>
            <td style="width: 10%; text-align: center;">${idx + 1}</td>
            <td style="font-weight: 700;">${item.name}</td>
            <td style="width: 30%; font-weight: bold; text-align: center; color: var(--primary); font-size: 1.05rem;">${item.quantity} قطعة</td>
        </tr>
    `).join('');

    panel.innerHTML = `
        <div style="width: 100%; text-align: right;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; border-bottom:1px solid var(--border-color); padding-bottom:15px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h4 style="margin:0; font-size:1.2rem; color:var(--text-primary);">طلب رقم ${sequenceNumber} - زبون: ${order.customerName}</h4>
                    <span style="font-size:0.8rem; color:var(--text-secondary);">تاريخ الإرسال: ${dateStr}</span>
                </div>
                <div>
                    ${statusBadge}
                </div>
            </div>
            
            <span class="form-label" style="margin-bottom: 10px; display:block;">المواد والكميات المطلوبة من الزبون:</span>
            <div class="table-responsive" style="margin-bottom: 25px;">
                <table class="table">
                    <thead>
                        <tr>
                            <th style="width: 10%; text-align: center;">#</th>
                            <th>اسم المادة الطبية</th>
                            <th style="width: 30%; text-align: center;">الكمية المطلوبة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>

            <div style="display:flex; justify-content: space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:15px; flex-wrap:wrap; gap:12px;">
                <div>
                    <button class="btn btn-secondary" style="padding:8px 16px; font-size:0.85rem; background-color:var(--danger-bg); color:#fca5a5; border-color:rgba(239, 68, 68, 0.2);" onclick="deleteEntireOrderAdmin('${order.id}')">🗑️ حذف وإزالة القائمة</button>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="btn btn-secondary" style="padding:8px 16px; font-size:0.85rem;" onclick="generateCustomerOrderPDFById('${order.id}')">🖨️ طباعة الطلب (PDF)</button>
                    ${order.status === 'pending' ? `
                        <button class="btn btn-secondary" style="padding:8px 16px; font-size:0.85rem;" onclick="triggerRejectOrder('${order.id}')">✗ رفض الطلب</button>
                        <button class="btn btn-primary" style="padding:8px 16px; font-size:0.85rem;" onclick="openApproveModal('${order.id}')">✓ موافقة وصرف الطلبية</button>
                    ` : `
                        <span style="color:var(--text-secondary); font-size:0.85rem;">* تم اتخاذ قرار الصرف / الرفض مسبقاً.</span>
                    `}
                </div>
            </div>
        </div>
    `;
}

// حذف وإلغاء طلبية الزبون بالكامل من طرف الأدمن
function deleteEntireOrderAdmin(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    
    if (confirm('هل أنت متأكد من حذف وإزالة هذه الطلبية/القائمة بالكامل نهائياً من سجلات النظام وإرجاع أرصدتها للمخازن؟')) {
        // إرجاع الأرصدة للمخازن في حال كان الطلب معتمداً ومصروفاً بالفعل
        if (order.status === 'approved' && order.dispatchedItems) {
            order.dispatchedItems.forEach(item => {
                let mat = state.materials.find(m => 
                    m.name === item.materialName && 
                    m.batchNumber === item.batchNumber && 
                    m.store === item.store
                );
                
                if (mat) {
                    mat.quantity += item.quantity;
                } else {
                    // إذا حُذفت الدفعة تماماً في هذه الأثناء، نقوم بإعادة إنشائها
                    const refMat = state.materials.find(m => m.name === item.materialName) || {};
                    state.materials.push({
                        id: 'mat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                        name: item.materialName,
                        batchNumber: item.batchNumber,
                        expiryDate: refMat.expiryDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
                        quantity: item.quantity,
                        company: refMat.company || 'غير محددة',
                        store: item.store,
                        category: refMat.category || 'أخرى',
                        sourceType: refMat.sourceType || 'عامة',
                        price: refMat.price || 0
                    });
                }
                
                // تسجيل معاملة إرجاع للتاريخ والشفافية
                state.transactions.unshift({
                    id: 'tx-' + Date.now() + '-return-' + item.batchNumber,
                    type: 'receipt',
                    fromStore: 'إرجاع طلب ملغي: ' + order.customerName,
                    toDest: item.store === 'store1' ? 'مخزن 1' : 'مخزن 2',
                    materialName: item.materialName,
                    batchNumber: item.batchNumber,
                    quantity: item.quantity,
                    date: new Date().toISOString().split('T')[0]
                });
            });
        }
        
        state.orders = state.orders.filter(o => o.id !== orderId);
        if (selectedAdminOrderId === orderId) {
            selectedAdminOrderId = null;
        }
        state.save();
        showToast('تم إلغاء وحذف قائمة الطلب بنجاح وإرجاع أرصدتها للمخازن', 'success');
        renderAdminDashboard();
    }
}

// طلبات الزبون الخاصة به (لوحة الزبون) مرتبة تسلسلياً وتفاعلياً
let selectedCustomerOrderId = null;

function renderCustomerOrdersTable() {
    const listGroup = document.getElementById('customer-orders-list-group');
    if (!listGroup) return;

    listGroup.innerHTML = '';

    const myOrders = state.orders.filter(o => o.customerId === state.currentUser.username);
    
    // الترتيب التاريخي التصاعدي: الأقدم يأخذ الرقم 1، والثاني الرقم 2...
    const chronologicalOrders = [...myOrders].reverse();
    
    // إنشاء مصفوفة العرض مرتبة تنازلياً (الأحدث بالأعلى)
    const reversedDisplayOrders = [];
    chronologicalOrders.forEach((ord, index) => {
        reversedDisplayOrders.unshift({
            order: ord,
            sequenceNumber: index + 1
        });
    });

    reversedDisplayOrders.forEach(item => {
        const ord = item.order;
        const seq = item.sequenceNumber;
        
        const dateStr = new Date(ord.date).toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        const statusClass = {
            'pending': 'tag-pending',
            'approved': 'tag-approved',
            'rejected': 'tag-rejected'
        }[ord.status];
        
        const statusText = {
            'pending': 'قيد الانتظار',
            'approved': 'تم الصرف',
            'rejected': 'مرفوض'
        }[ord.status];

        const isActive = ord.id === selectedCustomerOrderId;
        
        const btn = document.createElement('div');
        btn.className = `order-list-item ${isActive ? 'active' : ''}`;
        
        // تطبيق التنسيقات التفاعلية
        btn.style.cssText = `
            padding: 12px 15px;
            background: ${isActive ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)'};
            border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'};
            border-radius: 8px;
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        btn.innerHTML = `
            <div>
                <strong style="display:block; color:var(--text-primary); font-size:0.95rem;">طلب رقم ${seq}</strong>
                <span style="font-size:0.75rem; color:var(--text-secondary);">${dateStr}</span>
            </div>
            <span class="tag ${statusClass}" style="font-size:0.75rem; padding:3px 8px;">${statusText}</span>
        `;
        
        btn.addEventListener('click', () => {
            selectedCustomerOrderId = ord.id;
            renderCustomerOrdersTable(); // إعادة التلوين وتفعيل التفاصيل
        });
        
        listGroup.appendChild(btn);
    });

    if (myOrders.length === 0) {
        listGroup.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary); font-size:0.85rem;">لم تقم بتقديم أي طلبات بعد.</div>`;
        renderCustomerOrderDetails(null);
        return;
    }

    // إذا لم يكن هناك طلب محدد مسبقاً، نحدد الأحدث تلقائياً
    if (!selectedCustomerOrderId && reversedDisplayOrders.length > 0) {
        selectedCustomerOrderId = reversedDisplayOrders[0].order.id;
    }

    // عرض تفاصيل الطلب المحدد
    const activeItem = reversedDisplayOrders.find(item => item.order.id === selectedCustomerOrderId);
    if (activeItem) {
        renderCustomerOrderDetails(activeItem.order, activeItem.sequenceNumber);
    } else {
        renderCustomerOrderDetails(null);
    }
}

// عرض تفاصيل الطلب المحدد في اللوحة اليسرى
function renderCustomerOrderDetails(order, sequenceNumber = 1) {
    const panel = document.getElementById('customer-order-details-panel');
    if (!panel) return;

    if (!order) {
        panel.innerHTML = `
            <span style="font-size: 3rem; margin-bottom: 15px;">📋</span>
            <p>الرجاء تحديد أحد الطلبات من القائمة الجانبية لعرض تفاصيل المواد والكميات وحالة الصرف هنا.</p>
        `;
        return;
    }

    const dateStr = new Date(order.date).toLocaleString('ar-EG');
    const isEditable = order.status === 'pending' || order.status === 'rejected';
    
    const statusBadge = {
        'pending': '<span class="tag tag-pending" style="font-size:0.9rem; padding: 4px 10px;">⏳ قيد الانتظار والمراجعة في المستودع</span>',
        'approved': `<span class="tag tag-approved" style="font-size:0.9rem; padding: 4px 10px;">✓ تم الصرف والتجهيز (${order.sourceStore || 'مخزن 2 ثم 1'})</span>`,
        'rejected': '<span class="tag tag-rejected" style="font-size:0.9rem; padding: 4px 10px;">✗ تم رفض الصرف لعدم توفر المواد أو انتهاء الصلاحية</span>'
    }[order.status];

    const tableRows = order.items.map((item, idx) => {
        if (isEditable) {
            return `
                <tr>
                    <td style="width: 10%; text-align: center;">${idx + 1}</td>
                    <td style="font-weight: 700;">${item.name}</td>
                    <td style="width: 25%; font-weight: bold; text-align: center;">
                        <input type="number" min="1" value="${item.quantity}" class="form-control" style="width:75px; padding:4px 8px; text-align:center; display:inline-block;" onchange="updateOrderItemQty('${order.id}', ${idx}, this.value)">
                    </td>
                    <td style="width: 15%; text-align: center;">
                        <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; background-color:var(--danger-bg); color:#fca5a5;" onclick="deleteOrderItem('${order.id}', ${idx})">🗑️ إزالة</button>
                    </td>
                </tr>
            `;
        } else {
            return `
                <tr>
                    <td style="width: 10%; text-align: center;">${idx + 1}</td>
                    <td style="font-weight: 700;">${item.name}</td>
                    <td style="width: 25%; font-weight: bold; text-align: center; color: var(--primary); font-size: 1.05rem;" colspan="2">${item.quantity} قطعة</td>
                </tr>
            `;
        }
    }).join('');

    panel.innerHTML = `
        <div style="width: 100%; text-align: right;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; border-bottom:1px solid var(--border-color); padding-bottom:15px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h4 style="margin:0; font-size:1.2rem; color:var(--text-primary);">تفاصيل الطلب رقم ${sequenceNumber}</h4>
                    <span style="font-size:0.8rem; color:var(--text-secondary);">تاريخ الإرسال: ${dateStr}</span>
                </div>
                <div>
                    ${statusBadge}
                </div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span class="form-label" style="margin: 0;">المواد والكميات المطلوبة:</span>
                ${isEditable ? `<span style="font-size:0.8rem; color:var(--accent);">* يمكنك تعديل الأعداد أو إزالة المواد مباشرة من الجدول.</span>` : ''}
            </div>
            
            <div class="table-responsive" style="margin-bottom: 25px;">
                <table class="table">
                    <thead>
                        <tr>
                            <th style="width: 10%; text-align: center;">#</th>
                            <th>اسم المادة الطبية</th>
                            <th style="width: 25%; text-align: center;">الكمية</th>
                            ${isEditable ? `<th style="width: 15%; text-align: center;">إجراء</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>

            <div style="display:flex; justify-content: space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:15px; flex-wrap:wrap; gap:12px;">
                <div>
                    ${isEditable ? `
                        <button class="btn btn-secondary" style="padding:8px 16px; font-size:0.85rem; background-color:var(--danger-bg); color:#fca5a5; border-color:rgba(239, 68, 68, 0.2);" onclick="deleteEntireOrder('${order.id}')">🗑️ إلغاء وحذف الطلبية بالكامل</button>
                    ` : ''}
                </div>
                <div style="display:flex; gap:12px;">
                    <button class="btn btn-secondary" style="padding:8px 16px; font-size:0.85rem;" onclick="generateCustomerOrderPDFById('${order.id}')">🖨️ طباعة الطلب (PDF)</button>
                    <button class="btn btn-primary" style="padding:8px 16px; font-size:0.85rem; background-color:var(--success); border-color:var(--success);" onclick="resendOrderToWhatsApp('${order.id}')">📱 إعادة إرسال للواتساب</button>
                </div>
            </div>
        </div>
    `;
}

// تعديل كمية مادة داخل طلبية قيد الانتظار أو مرفوضة
function updateOrderItemQty(orderId, itemIndex, newQty) {
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty <= 0) {
        showToast('الرجاء إدخال كمية صحيحة أكبر من الصفر', 'danger');
        return;
    }
    
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    
    if (order.status === 'approved') {
        showToast('لا يمكن تعديل الطلبيات التي تم صرفها بالفعل', 'danger');
        return;
    }
    
    order.items[itemIndex].quantity = qty;
    state.save();
    showToast('تم تحديث الكمية المطلوبة بنجاح', 'success');
    renderCustomerOrdersTable();
}

// حذف مادة من طلبية قيد الانتظار أو مرفوضة
function deleteOrderItem(orderId, itemIndex) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    
    if (order.status === 'approved') {
        showToast('لا يمكن تعديل الطلبيات التي تم صرفها بالفعل', 'danger');
        return;
    }
    
    if (confirm(`هل أنت متأكد من إزالة المادة "${order.items[itemIndex].name}" من هذه الطلبية؟`)) {
        order.items.splice(itemIndex, 1);
        if (order.items.length === 0) {
            // حذف الطلبية كاملة إذا أصبحت فارغة
            state.orders = state.orders.filter(o => o.id !== orderId);
            if (selectedCustomerOrderId === orderId) {
                selectedCustomerOrderId = null;
            }
            showToast('تم حذف الطلبية بالكامل لعدم احتوائها على مواد', 'warning');
        } else {
            showToast('تمت إزالة المادة من الطلبية', 'warning');
        }
        state.save();
        renderCustomerOrdersTable();
    }
}

// حذف وإلغاء الطلبية بالكامل قيد الانتظار أو المرفوضة
function deleteEntireOrder(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    
    if (order.status === 'approved') {
        showToast('لا يمكن حذف الطلبيات التي تم صرفها بالفعل', 'danger');
        return;
    }
    
    if (confirm('هل أنت متأكد من إلغاء وحذف هذه الطلبية بالكامل نهائياً؟')) {
        state.orders = state.orders.filter(o => o.id !== orderId);
        if (selectedCustomerOrderId === orderId) {
            selectedCustomerOrderId = null;
        }
        state.save();
        showToast('تم إلغاء وحذف الطلبية بنجاح', 'success');
        renderCustomerOrdersTable();
    }
}

function generateCustomerOrderPDFById(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (order) generateCustomerOrderPDF(order);
}

function resendOrderToWhatsApp(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (order) sendWhatsAppNotification(order);
}

// فتح وإغلاق القائمة المنسدلة لإشعارات الصلاحية
function toggleExpiryNotificationsDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('expiry-notifications-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('hidden');
}
window.toggleExpiryNotificationsDropdown = toggleExpiryNotificationsDropdown;

// إغلاق قائمة الإشعارات تلقائياً عند النقر خارجها
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('notifications-wrapper');
    const dropdown = document.getElementById('expiry-notifications-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (wrapper && !wrapper.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

// لوحة تنبيهات انتهاء الصلاحية (مربوطة بأيقونة الجرس والقائمة المنسدلة)
function renderExpiryAlertsPanel() {
    const container = document.getElementById('expiry-alerts-container');
    const badge = document.getElementById('expiry-notification-badge');
    const countTag = document.getElementById('notifications-dropdown-count');
    const bellBtn = document.getElementById('notifications-bell-btn');

    const alerts = getExpiryAlerts();

    // تحديث شارة العداد على أيقونة الجرس
    if (badge) {
        if (alerts.length > 0) {
            badge.innerText = alerts.length;
            badge.classList.remove('hidden');
        } else {
            badge.innerText = '0';
            badge.classList.add('hidden');
        }
    }

    // تنبيه حركي على أيقونة الجرس في حالة وجود تنبيهات خطيرة (أقل من شهرين)
    if (bellBtn) {
        const hasUrgent = alerts.some(a => a.level === 'danger');
        if (hasUrgent) {
            bellBtn.classList.add('has-urgent-alerts');
        } else {
            bellBtn.classList.remove('has-urgent-alerts');
        }
    }

    if (countTag) {
        countTag.innerText = `${alerts.length} مواد`;
    }

    if (!container) return;
    container.innerHTML = '';

    alerts.forEach(alt => {
        const div = document.createElement('div');
        div.className = `alert-item ${alt.level}`;
        div.style.position = 'relative';
        div.innerHTML = `
            <div class="alert-content">
                <span style="font-size: 1.3rem;">${alt.level === 'danger' ? '🚨' : '⚠️'}</span>
                <div>
                    <div class="alert-text">مادة <strong>${alt.name}</strong></div>
                    <div class="alert-meta">
                        <span>دفعة: <code>${alt.batchNumber}</code></span> • 
                        <span>${alt.store === 'store1' ? 'مخزن 1' : 'مخزن 2'}</span> • 
                        <span>صلاحية: ${alt.expiryDate}</span>
                    </div>
                    <div style="font-size: 0.75rem; margin-top: 3px; font-weight: 600; opacity: 0.9;">
                        (متبقي: ${alt.remainingMonths} شهر / ${alt.remainingDays} يوم)
                    </div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink: 0;">
                <span class="tag" style="background-color:rgba(0,0,0,0.2); font-weight:700; font-size: 0.75rem;">${alt.quantity} ق</span>
                <button onclick="dismissExpiryAlert('${alt.id}', event)" title="تجاهل ومسح هذا التنبيه" class="alert-dismiss-btn">✕</button>
            </div>
        `;
        container.appendChild(div);
    });

    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="notifications-empty-state">
                <span style="font-size: 2rem;">✅</span>
                <p style="margin: 6px 0 2px; font-weight: 700; color: var(--success); font-size: 0.9rem;">جميع المواد صالحة لأكثر من 6 أشهر</p>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">لا توجد مواد قريبة من الانتهاء حالياً.</span>
            </div>
        `;
    }
}

async function dismissExpiryAlert(matId, event) {
    if (event) event.stopPropagation();
    if (confirm('هل أنت متأكد من مسح وتجاهل هذا التنبيه؟')) {
        if (!state.dismissedAlerts) state.dismissedAlerts = [];
        state.dismissedAlerts.push(matId);
        state.save(); // يرفع بالخلفية دون حجب الواجهة
        showToast('تم مسح وتجاهل التنبيه بنجاح!', 'success');
        renderExpiryAlertsPanel();
    }
}
window.dismissExpiryAlert = dismissExpiryAlert;

// لوحة تخمين صرفيات المواد وتوقعات الهدر
function renderForecastPanel() {
    const tbody = document.getElementById('forecast-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let forecast = getForecastData();

    if (currentAdminCategoryFilter !== 'all') {
        forecast = forecast.filter(f => f.category === currentAdminCategoryFilter);
    }

    const statusFilter = document.getElementById('forecast-status-filter');
    if (statusFilter && statusFilter.value !== 'all') {
        forecast = forecast.filter(f => f.statusClass === statusFilter.value);
    }

    // تطبيق ترقيم الصفحات
    const totalItems = forecast.length;
    const config = paginationConfig.forecast;
    
    let displayedItems = forecast;
    if (config.rowsPerPage !== 'all') {
        const totalPages = Math.ceil(totalItems / config.rowsPerPage);
        if (config.page > totalPages && totalPages > 0) {
            config.page = totalPages;
        }
        const startIndex = (config.page - 1) * config.rowsPerPage;
        const endIndex = startIndex + config.rowsPerPage;
        displayedItems = forecast.slice(startIndex, endIndex);
    }

    displayedItems.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${f.name}</td>
            <td><code style="color:var(--accent)">${f.batchNumber}</code></td>
            <td>${f.store}</td>
            <td style="font-weight:700;">${f.quantity} قطعة</td>
            <td>${f.expiryDate}</td>
            <td>
                <div class="forecast-badge">
                    <span style="font-weight:600; color:var(--text-primary);">${f.monthlyConsumption} ق/شهر</span>
                    <span class="forecast-rate">حسابي تقريبي</span>
                </div>
            </td>
            <td>
                <span class="forecast-verdict ${f.statusClass}">${f.verdict}</span>
                ${f.expectedWaste > 0 ? `
                    <div class="progress-bar-container">
                        <div class="progress-bar ${f.expectedWaste > f.quantity*0.5 ? 'danger' : 'warning'}" style="width: ${Math.min(100, (f.expectedWaste/f.quantity)*100)}%"></div>
                    </div>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (forecast.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">لا توجد مواد كافية للتنبؤ بها أو تطابق التصنيف</td></tr>`;
    }

    renderPaginationButtons('forecast', totalItems);
}

// سجل الحركات (التاريخ)
function renderTransactionsTable() {
    const tbody = document.getElementById('transactions-tbody');
    tbody.innerHTML = '';

    state.transactions.slice(0, 15).forEach(tx => {
        const typeBadge = {
            'transfer': '<span class="tag tag-store1">تحويل مخزني</span>',
            'issue': '<span class="tag tag-store2">صرف لزبون</span>',
            'receipt': '<span class="tag tag-approved">توريد جديد</span>',
            'reconcile': '<span class="tag tag-rejected">تعديل جرد</span>'
        }[tx.type];

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size:0.85rem;">${tx.date}</td>
            <td>${typeBadge}</td>
            <td style="font-weight:700;">${tx.materialName}</td>
            <td><code>${tx.batchNumber || 'N/A'}</code></td>
            <td style="font-weight:700; color:${tx.quantity < 0 ? 'var(--danger)' : 'var(--success)'}">${tx.quantity > 0 ? '+' : ''}${tx.quantity}</td>
            <td>${tx.fromStore} ➔ ${tx.toDest}</td>
        `;
        tbody.appendChild(tr);
    });

    if (state.transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">لا توجد حركات مسجلة</td></tr>`;
    }
}

// 8. إدارة النوافذ المنبثقة (Modals Control)
// فتح مودال إضافة المواد للسلة للزبون وتحديد الكمية
let cartMaterialNamePending = null;
function openAddToCartModal(encodedName) {
    if (state.currentUser.permission === 'view_only') {
        showToast('صلاحيتك مقلصة (عرض فقط). لا يمكنك إضافة مواد للطلبية.', 'danger');
        return;
    }
    cartMaterialNamePending = decodeURIComponent(encodedName);
    document.getElementById('add-to-cart-material-name').innerText = cartMaterialNamePending;
    document.getElementById('add-to-cart-qty').value = 1;
    openModal('add-to-cart-modal');
}

// تأكيد إضافة الكمية للسلّة
function submitAddToCartForm() {
    const qty = parseInt(document.getElementById('add-to-cart-qty').value);
    if (isNaN(qty) || qty <= 0) {
        showToast('الرجاء إدخال كمية صحيحة', 'danger');
        return;
    }
    
    if (!cartMaterialNamePending) return;
    
    let item = state.customerCart.find(i => i.name === cartMaterialNamePending);
    if (item) {
        item.quantity += qty;
    } else {
        state.customerCart.push({ name: cartMaterialNamePending, quantity: qty });
    }
    state.save();
    showToast(`تمت إضافة ${qty} قطعة من "${cartMaterialNamePending}" إلى قائمة الطلبية`, 'success');
    
    closeModal('add-to-cart-modal');
    cartMaterialNamePending = null;
    
    updateCartBadge();
    renderCustomerDashboard();
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// فتح مودال الإضافة
function openAddMaterialModal() {
    document.getElementById('add-material-form').reset();
    renderCategorySelectDropdown(); // تحديث القائمة المنسدلة للتصنيفات فورياً
    openModal('add-material-modal');
}

// فتح مودال الجرد
let selectedMaterialIdForReconcile = null;
function openReconcileModal(id) {
    selectedMaterialIdForReconcile = id;
    const mat = state.materials.find(m => m.id === id);
    if (!mat) return;

    document.getElementById('reconcile-name-display').innerText = mat.name;
    document.getElementById('reconcile-batch-display').innerText = mat.batchNumber;
    document.getElementById('reconcile-store-display').innerText = mat.store === 'store1' ? 'مخزن 1' : 'مخزن 2';
    document.getElementById('reconcile-qty').value = mat.quantity;

    openModal('reconcile-modal');
}

// فتح مودال التحويل
let selectedMaterialIdForTransfer = null;
function openTransferModal(id) {
    selectedMaterialIdForTransfer = id;
    const mat = state.materials.find(m => m.id === id && m.store === 'store1');
    if (!mat) return;

    document.getElementById('transfer-name-display').innerText = mat.name;
    document.getElementById('transfer-batch-display').innerText = mat.batchNumber;
    document.getElementById('transfer-max-qty').innerText = mat.quantity;
    document.getElementById('transfer-qty').max = mat.quantity;
    document.getElementById('transfer-qty').value = Math.min(10, mat.quantity);

    openModal('transfer-modal');
}

// فتح مودال الصرف المباشر
let selectedMaterialIdForIssue = null;
let selectedStoreSourceForIssue = null;
function openDirectIssueModal(id, store) {
    selectedMaterialIdForIssue = id;
    selectedStoreSourceForIssue = store;
    const mat = state.materials.find(m => m.id === id && m.store === store);
    if (!mat) return;

    document.getElementById('issue-name-display').innerText = mat.name;
    document.getElementById('issue-batch-display').innerText = mat.batchNumber;
    document.getElementById('issue-store-display').innerText = store === 'store1' ? 'مخزن 1' : 'مخزن 2';
    document.getElementById('issue-max-qty').innerText = mat.quantity;
    document.getElementById('issue-qty').max = mat.quantity;
    document.getElementById('issue-qty').value = Math.min(10, mat.quantity);

    openModal('direct-issue-modal');
}

// فتح مودال موافقة الطلبيات
let selectedOrderIdForApproval = null;
function openApproveModal(id) {
    selectedOrderIdForApproval = id;
    const order = state.orders.find(o => o.id === id);
    if (!order) return;

    document.getElementById('approve-customer-name').innerText = order.customerName;
    const list = order.items.map(i => `<li>${i.name} (المطلوب: <strong>${i.quantity} قطعة</strong>)</li>`).join('');
    document.getElementById('approve-items-list').innerHTML = list;

    openModal('approve-order-modal');
}



// رفض طلبية
function triggerRejectOrder(id) {
    if (confirm('هل أنت متأكد من رفض هذا الطلب؟')) {
        rejectCustomerOrder(id);
        renderAdminDashboard();
    }
}

// حفظ تعديل الجرد
function submitReconcileForm() {
    const qty = parseInt(document.getElementById('reconcile-qty').value);
    if (isNaN(qty) || qty < 0) {
        showToast('الرجاء إدخال كمية صحيحة', 'danger');
        return;
    }

    if (reconcileMaterial(selectedMaterialIdForReconcile, qty)) {
        closeModal('reconcile-modal');
        renderAdminDashboard();
    }
}

// حفظ التحويل
function submitTransferForm() {
    const qty = parseInt(document.getElementById('transfer-qty').value);
    const max = parseInt(document.getElementById('transfer-qty').max);
    if (isNaN(qty) || qty <= 0 || qty > max) {
        showToast('الرجاء إدخال كمية صحيحة وصالحة للتحويل', 'danger');
        return;
    }

    if (transferBetweenStores(selectedMaterialIdForTransfer, qty)) {
        closeModal('transfer-modal');
        renderAdminDashboard();
    }
}

// حفظ الصرف المباشر
function submitDirectIssueForm() {
    const qty = parseInt(document.getElementById('issue-qty').value);
    const max = parseInt(document.getElementById('issue-qty').max);
    const customer = document.getElementById('issue-customer-select').value;
    
    if (isNaN(qty) || qty <= 0 || qty > max) {
        showToast('الرجاء إدخال كمية صحيحة وصالحة للصرف', 'danger');
        return;
    }

    if (issueStockToCustomer(selectedMaterialIdForIssue, qty, customer, selectedStoreSourceForIssue)) {
        closeModal('direct-issue-modal');
        renderAdminDashboard();
    }
}

// حفظ إضافة مادة
function submitAddMaterialForm() {
    const name = document.getElementById('add-name').value;
    const batch = document.getElementById('add-batch').value;
    const expiry = document.getElementById('add-expiry').value;
    const qty = parseInt(document.getElementById('add-qty').value);
    const company = document.getElementById('add-company').value;
    const store = document.getElementById('add-store-select').value;
    const category = document.getElementById('add-category-select').value;
    const source = document.getElementById('add-source-select').value;
    const price = parseFloat(document.getElementById('add-price').value) || 0;

    // تنبيه تشخيصي للتأكد من القيمة المقروءة ومساعدة المستخدم في تأكيد التحديث
    alert(`المعلومات المقروءة من المتصفح:\nاسم المادة: ${name}\nالتصنيف المختار: ${category}`);

    if (!name || !batch || !expiry || isNaN(qty) || qty <= 0 || !company || !category || !source || isNaN(price) || price < 0) {
        showToast('الرجاء تعبئة كافة الحقول بشكل صحيح', 'danger');
        return;
    }

    if (addNewMaterial(name, batch, expiry, qty, company, store, category, source, price)) {
        closeModal('add-material-modal');
        renderAdminDashboard();
        // إرجاع قيمة السعر للنموذج إلى صفر بعد الحفظ
        document.getElementById('add-price').value = 0;
    }
}

// الموافقة على الطلب
function submitApproveOrder() {
    if (approveCustomerOrder(selectedOrderIdForApproval)) {
        closeModal('approve-order-modal');
        renderAdminDashboard();
    }
}

// 9. تفعيل التبويبات (Tabs Nav)
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // 1. تحديث أزرار التبويبات النشطة بالقائمة الجانبية أو التبويبات العلوية
    document.querySelectorAll(`.tab-btn[data-tab="${tabId}"]`).forEach(btn => {
        const container = btn.closest('.sidebar-menu') || btn.closest('.tabs-nav') || document;
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });

    // 2. تحديث التبويب النشط وعرض محتواه
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
        tabContent.parentElement.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tabContent.classList.add('active');
    }

    // 3. تهيئة أو إعادة رسم جداول التبويبات عند الدخول إليها
    if (tabId === 'tab-add-material') {
        const tbody = document.getElementById('invoice-grid-tbody');
        if (tbody && tbody.children.length === 0) {
            initNewReceiptDraft();
        }
    } else if (tabId === 'tab-saved-receipts') {
        renderSavedReceiptsTable();
    } else if (tabId === 'tab-system-materials') {
        renderSystemMaterialsTable();
    }
}
window.switchTab = switchTab;

// تصفية أزرار التصنيفات
function setAdminCategoryFilter(category) {
    currentAdminCategoryFilter = category;
    const select = document.getElementById('admin-category-select-filter');
    if (select) {
        select.value = category;
    }
    renderAdminDashboard();
}

function setCustomerCategoryFilter(category) {
    currentCustomerCategoryFilter = category;
    const select = document.getElementById('customer-category-select-filter');
    if (select) {
        select.value = category;
    }
    renderCustomerDashboard();
}

// إضافة تصنيف ديناميكي جديد
function addNewCategory(name) {
    const cleanName = name.trim();
    if (!cleanName) {
        showToast('الرجاء إدخال اسم تصنيف صالح', 'danger');
        return false;
    }

    const exists = state.categories.some(c => c.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
        showToast('هذا التصنيف موجود بالفعل', 'warning');
        return false;
    }

    state.categories.push(cleanName);
    state.save();
    
    updateCategoryUI();
    
    if (state.currentUser && state.currentUser.role === 'admin') {
        renderAdminDashboard();
    } else if (state.currentUser) {
        renderCustomerDashboard();
    }
    
    showToast(`تمت إضافة التصنيف "${cleanName}" بنجاح`, 'success');
    return true;
}

// حذف تصنيف ديناميكي
function removeCategory(name) {
    const cleanName = name.trim();
    if (cleanName === 'أخرى') {
        showToast('لا يمكن حذف التصنيف الافتراضي (أخرى)', 'danger');
        return false;
    }

    const index = state.categories.indexOf(cleanName);
    if (index === -1) return false;

    state.categories.splice(index, 1);

    // تحويل المواد إلى تصنيف "أخرى"
    state.materials.forEach(mat => {
        if (mat.category === cleanName) {
            mat.category = 'أخرى';
        }
    });

    state.save();

    if (currentAdminCategoryFilter === cleanName) currentAdminCategoryFilter = 'all';
    if (currentCustomerCategoryFilter === cleanName) currentCustomerCategoryFilter = 'all';

    updateCategoryUI();
    
    if (state.currentUser && state.currentUser.role === 'admin') {
        renderAdminDashboard();
    } else if (state.currentUser) {
        renderCustomerDashboard();
    }

    showToast(`تم مسح التصنيف "${cleanName}" بنجاح وتحويل مواده إلى "أخرى"`, 'success');
    return true;
}

// تحديث العناصر الرسومية للتصنيفات ديناميكياً
function updateCategoryUI() {
    renderCategoryFilters();
    renderCategorySelectDropdown();
    renderCategoriesSettingsList();
}

function renderCategoryFilters() {
    const adminSelect = document.getElementById('admin-category-select-filter');
    if (adminSelect) {
        adminSelect.innerHTML = '<option value="all">📁 كل التصنيفات</option>';
        state.categories.forEach(cat => {
            let icon = '📦';
            if (cat.includes('شبكة') || cat.includes('Bare') || cat.includes('stent')) icon = '🕸️';
            else if (cat.includes('بالون') || cat.includes('Balloon')) icon = '🎈';
            else if (cat.includes('قسطرة') || cat.includes('Cath')) icon = '🩺';
            else if (cat.includes('سلك') || cat.includes('Guide') || cat.includes('wire')) icon = '🧵';

            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = `${icon} ${cat}`;
            if (cat === currentAdminCategoryFilter) {
                opt.selected = true;
            }
            adminSelect.appendChild(opt);
        });
    }

    const customerSelect = document.getElementById('customer-category-select-filter');
    if (customerSelect) {
        customerSelect.innerHTML = '<option value="all">📁 كل التصنيفات</option>';
        state.categories.forEach(cat => {
            let icon = '📦';
            if (cat.includes('شبكة') || cat.includes('Bare') || cat.includes('stent')) icon = '🕸️';
            else if (cat.includes('بالون') || cat.includes('Balloon')) icon = '🎈';
            else if (cat.includes('قسطرة') || cat.includes('Cath')) icon = '🩺';
            else if (cat.includes('سلك') || cat.includes('Guide') || cat.includes('wire')) icon = '🧵';

            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = `${icon} ${cat}`;
            if (cat === currentCustomerCategoryFilter) {
                opt.selected = true;
            }
            customerSelect.appendChild(opt);
        });
    }
}

// نظام الجدول الشبكي لإدخال وتوريد المواد كوجبة (Invoice Grid Editor)
function generateNewListId() {
    return 'LST-' + Math.floor(100000 + Math.random() * 900000);
}

function generateAutoInvoiceNumber() {
    const year = new Date().getFullYear();
    const nextSeq = String(state.Invoices.length + 1).padStart(4, '0');
    return `INV-${year}-${nextSeq}`;
}

function initNewReceiptDraft() {
    const listIdInput = document.getElementById('add-tab-list-id');
    if (listIdInput) {
        listIdInput.value = generateNewListId();
    }
    
    const receiptNumInput = document.getElementById('add-tab-receipt-number');
    if (receiptNumInput) {
        receiptNumInput.value = generateAutoInvoiceNumber();
    }

    const sourceSelect = document.getElementById('add-tab-source-type');
    if (sourceSelect) {
        sourceSelect.value = 'عامة';
    }
    
    const tbody = document.getElementById('invoice-grid-tbody');
    if (tbody) {
        tbody.innerHTML = '';
    }
    
    // إضافة سطرين فارغين تلقائياً للبدء لتسهيل التعبئة المباشرة للمستخدم
    addNewInvoiceRow();
    addNewInvoiceRow();
}
window.initNewReceiptDraft = initNewReceiptDraft;

function getUniqueMaterials() {
    const map = new Map();
    state.materials.forEach(m => {
        if (!m.name) return;
        const key = m.name.trim().toLowerCase();
        if (!map.has(key)) {
            map.set(key, {
                name: m.name.trim(),
                company: m.company || '',
                category: m.category || 'أخرى',
                price: m.price || 0
            });
        } else {
            const existing = map.get(key);
            if (!existing.company && m.company) existing.company = m.company;
            if ((existing.category === 'أخرى' || !existing.category) && m.category) existing.category = m.category;
            if (m.price > (existing.price || 0)) existing.price = m.price;
        }
    });
    return Array.from(map.values());
}
window.getUniqueMaterials = getUniqueMaterials;

let activeRowIdForQuickAdd = null;

function openQuickAddMaterial(rowId = null, typedName = '') {
    activeRowIdForQuickAdd = rowId;
    
    const catSelect = document.getElementById('quick-add-category');
    if (catSelect) {
        catSelect.innerHTML = '';
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            if (cat === 'أخرى') opt.selected = true;
            catSelect.appendChild(opt);
        });
    }
    
    const nameInput = document.getElementById('quick-add-name');
    if (nameInput) {
        nameInput.value = typedName || '';
    }
    
    document.getElementById('quick-add-company').value = '';
    document.getElementById('quick-add-price').value = '0';
    
    const submitBtn = document.querySelector('#quick-add-material-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerText = rowId ? '💾 حفظ وإضافة للسطر' : '💾 حفظ المادة الجديدة بالنظام';
    }
    
    openModal('quick-add-material-modal');
}
window.openQuickAddMaterial = openQuickAddMaterial;

function submitQuickAddMaterialForm() {
    const name = document.getElementById('quick-add-name').value.trim();
    const company = document.getElementById('quick-add-company').value.trim();
    const category = document.getElementById('quick-add-category').value;
    const price = parseFloat(document.getElementById('quick-add-price').value) || 0;
    
    if (!name) {
        showToast('الرجاء إدخال اسم المادة الطبية', 'danger');
        return;
    }
    
    const newId = 'mat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    state.materials.push({
        id: newId,
        name: name,
        company: company,
        category: category,
        price: price,
        quantity: 0,
        batchNumber: 'TEMPLATE',
        expiryDate: new Date().toISOString().split('T')[0],
        store: 'store1',
        sourceType: 'عامة'
    });
    state.save();
    
    if (activeRowIdForQuickAdd) {
        const row = document.getElementById(activeRowIdForQuickAdd);
        if (row) {
            const m = { name, company, category, price };
            selectSuggestion(row, m);
        }
        closeModal('quick-add-material-modal');
        showToast(`تمت إضافة المادة "${name}" بنجاح وتعبئتها في السطر!`, 'success');
    } else {
        closeModal('quick-add-material-modal');
        showToast(`تمت إضافة المادة "${name}" بنجاح إلى قائمة المواد بالنظام!`, 'success');
        if (state.currentUser && state.currentUser.role === 'admin') {
            renderAdminDashboard();
        }
        if (typeof renderSystemMaterialsTable === 'function') {
            renderSystemMaterialsTable();
        }
    }
}
window.submitQuickAddMaterialForm = submitQuickAddMaterialForm;

let activeRowIdForQuickEdit = null;

function openQuickEditMaterial(material, rowId = null) {
    activeRowIdForQuickEdit = rowId;
    
    const origNameInput = document.getElementById('quick-edit-original-name');
    const nameInput = document.getElementById('quick-edit-name');
    const companyInput = document.getElementById('quick-edit-company');
    const catSelect = document.getElementById('quick-edit-category');
    const priceInput = document.getElementById('quick-edit-price');
    
    if (origNameInput) origNameInput.value = material.name;
    if (nameInput) nameInput.value = material.name;
    if (companyInput) companyInput.value = material.company || '';
    if (priceInput) priceInput.value = material.price || 0;
    
    if (catSelect) {
        catSelect.innerHTML = '';
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            if (cat === material.category) opt.selected = true;
            catSelect.appendChild(opt);
        });
    }
    
    openModal('quick-edit-material-modal');
}
window.openQuickEditMaterial = openQuickEditMaterial;

async function submitQuickEditMaterialForm() {
    const originalName = document.getElementById('quick-edit-original-name').value.trim();
    const newName = document.getElementById('quick-edit-name').value.trim();
    const newCompany = document.getElementById('quick-edit-company').value.trim();
    const newCategory = document.getElementById('quick-edit-category').value;
    const newPrice = parseFloat(document.getElementById('quick-edit-price').value) || 0;
    
    if (!newName) {
        showToast('الرجاء إدخال اسم المادة الطبية', 'danger');
        return;
    }
    
    // 1. تحديث كافة السجلات المطابقة في state.materials
    let matchCount = 0;
    state.materials.forEach(mat => {
        if (mat.name && mat.name.trim().toLowerCase() === originalName.toLowerCase()) {
            mat.name = newName;
            mat.company = newCompany;
            mat.category = newCategory;
            mat.price = newPrice;
            matchCount++;
        }
    });
    
    // إذا لم يكن لها سجل مطابق سابقاً في المخزن ننشئ لها قالباً
    if (matchCount === 0) {
        state.materials.push({
            id: 'mat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            name: newName,
            company: newCompany,
            category: newCategory,
            price: newPrice,
            quantity: 0,
            batchNumber: 'TEMPLATE',
            expiryDate: new Date().toISOString().split('T')[0],
            store: 'store1',
            sourceType: 'عامة'
        });
    }
    
    // 2. الحفظ والمزامنة السحابية مع Firebase والتخزين المحلي
    state.save();
    
    // 3. إذا كان هناك سطر نشط في الجدول، نحدث قيمه فوراً
    if (activeRowIdForQuickEdit) {
        const row = document.getElementById(activeRowIdForQuickEdit);
        if (row) {
            const nameInput = row.querySelector('.row-name');
            const companyInput = row.querySelector('.row-company');
            const categorySelect = row.querySelector('.row-category');
            const priceInput = row.querySelector('.row-price');
            
            if (nameInput) nameInput.value = newName;
            if (companyInput) companyInput.value = newCompany;
            if (categorySelect) categorySelect.value = newCategory;
            if (priceInput) priceInput.value = newPrice;
            
            if (typeof calculateInvoiceGrandTotal === 'function') {
                calculateInvoiceGrandTotal();
            }
            
            // إعادة تشغيل البحث في القائمة لإظهار التعديل الجديد
            if (nameInput) {
                nameInput.dispatchEvent(new Event('input'));
            }
        }
    }
    
    closeModal('quick-edit-material-modal');
    showToast(`تم تعديل وتحديث بيانات المادة "${newName}" بنجاح!`, 'success');
    
    if (typeof renderInventory === 'function') renderInventory();
    if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
}
window.submitQuickEditMaterialForm = submitQuickEditMaterialForm;

function selectSuggestion(rowElement, material) {
    const nameInput = rowElement.querySelector('.row-name');
    const companyInput = rowElement.querySelector('.row-company');
    const categorySelect = rowElement.querySelector('.row-category');
    const priceInput = rowElement.querySelector('.row-price');
    
    nameInput.value = material.name;
    companyInput.value = material.company;
    categorySelect.value = material.category;
    priceInput.value = material.price;
    
    const batchInput = rowElement.querySelector('.row-batch');
    const expiryInput = rowElement.querySelector('.row-expiry');
    const qtyInput = rowElement.querySelector('.row-qty');
    
    batchInput.value = '';
    expiryInput.value = '';
    qtyInput.value = '';
    
    calculateInvoiceGrandTotal();
    batchInput.focus();
}
window.selectSuggestion = selectSuggestion;

function addNewInvoiceRow(data = null) {
    const tbody = document.getElementById('invoice-grid-tbody');
    if (!tbody) return;
    
    const rowId = 'row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    
    let catOptions = '';
    state.categories.forEach(cat => {
        catOptions += `<option value="${cat}" ${cat === 'أخرى' ? 'selected' : ''}>${cat}</option>`;
    });
    
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.innerHTML = `
        <td>
            <div class="searchable-select-container">
                <input type="text" class="row-name form-control" required placeholder="ابحث أو اختر مادة..." style="height: 34px; padding: 4px 8px; font-size: 0.8rem; width: 100%;" value="${data ? data.name : ''}" autocomplete="off">
                <div class="search-suggestions-dropdown hidden"></div>
            </div>
        </td>
        <td>
            <input type="text" class="row-company form-control" required placeholder="مثال: Medtronic" style="height: 34px; padding: 4px 8px; font-size: 0.8rem; width: 100%;" value="${data ? data.company : ''}">
        </td>
        <td>
            <input type="text" class="row-batch form-control" required placeholder="الباج..." style="height: 34px; padding: 4px 8px; font-size: 0.8rem; width: 100%; text-transform: uppercase;" value="${data ? data.batchNumber : ''}">
        </td>
        <td>
            <input type="date" class="row-expiry form-control" required style="height: 34px; padding: 4px 8px; font-size: 0.8rem; width: 100%;" value="${data ? data.expiryDate : ''}">
        </td>
        <td>
            <select class="row-store form-control" style="height: 34px; padding: 4px 8px; font-size: 0.8rem; width: 100%; cursor: pointer;">
                <option value="store1" ${data && data.store === 'store1' ? 'selected' : ''}>مخزن 1</option>
                <option value="store2" ${data && data.store === 'store2' ? 'selected' : ''}>مخزن 2</option>
            </select>
        </td>
        <td>
            <select class="row-category form-control" required style="height: 34px; padding: 4px 8px; font-size: 0.8rem; width: 100%; cursor: pointer;">
                ${catOptions}
            </select>
        </td>
        <td>
            <input type="number" class="row-price form-control" required min="0" value="${data ? data.price : '0'}" style="height: 34px; padding: 4px 8px; font-size: 0.85rem; width: 100%; font-weight: 600; color: var(--success);" oninput="calculateInvoiceGrandTotal()">
        </td>
        <td>
            <input type="number" class="row-qty form-control" required min="1" value="${data ? data.quantity : ''}" style="height: 34px; padding: 4px 8px; font-size: 0.85rem; width: 100%; text-align: center; font-weight: 700; color: var(--primary);" oninput="calculateInvoiceGrandTotal()">
        </td>
        <td style="text-align: left; vertical-align: middle; padding-left: 15px;">
            <span class="row-total" style="font-weight: 700; color: var(--success); font-size: 0.85rem;">0 د.ع</span>
        </td>
        <td style="text-align: center; vertical-align: middle;">
            <button type="button" class="btn-icon" onclick="removeInvoiceRow('${rowId}')" style="background: none; border: none; color: var(--danger); font-size: 1.25rem; cursor: pointer; padding: 0; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px;">✕</button>
        </td>
    `;
    tbody.appendChild(tr);
    
    if (data && data.category) {
        tr.querySelector('.row-category').value = data.category;
    }
    
    // ربط مستمعي الأحداث للبحث الذكي والكيبورد
    const nameInput = tr.querySelector('.row-name');
    const dropdown = tr.querySelector('.search-suggestions-dropdown');
    const companyInput = tr.querySelector('.row-company');
    const qtyInput = tr.querySelector('.row-qty');
    const batchInput = tr.querySelector('.row-batch');
    
    let highlightedIndex = -1;
    
    nameInput.addEventListener('input', () => {
        const query = nameInput.value.trim().toLowerCase();
        if (query.length < 2) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
            highlightedIndex = -1;
            return;
        }
        
        const uniqueMaterials = getUniqueMaterials();
        const filtered = uniqueMaterials.filter(m => m.name.toLowerCase().includes(query));
        
        dropdown.innerHTML = '';
        if (filtered.length > 0) {
            filtered.forEach((m) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'suggestion-item';
                
                const textSpan = document.createElement('span');
                textSpan.className = 'suggestion-item-text';
                textSpan.innerText = m.name;
                
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'btn-suggestion-edit';
                editBtn.innerHTML = '✏️ تعديل';
                editBtn.title = 'تعديل بيانات هذه المادة (الاسم، التصنيف، الشركة، السعر)';
                
                editBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropdown.classList.add('hidden');
                    openQuickEditMaterial(m, tr.id);
                });
                
                itemDiv.appendChild(textSpan);
                itemDiv.appendChild(editBtn);
                
                itemDiv.addEventListener('mousedown', (e) => {
                    if (e.target.closest('.btn-suggestion-edit')) return;
                    e.preventDefault(); // يمنع فقدان التركيز الفوري
                    selectSuggestion(tr, m);
                    dropdown.classList.add('hidden');
                });
                dropdown.appendChild(itemDiv);
            });
        } else {
            const noResultDiv = document.createElement('div');
            noResultDiv.className = 'suggestion-item';
            noResultDiv.style.cursor = 'default';
            noResultDiv.style.color = 'var(--text-secondary)';
            noResultDiv.innerText = 'لا توجد نتائج مطابقة';
            dropdown.appendChild(noResultDiv);
        }
        
        const addNewDiv = document.createElement('div');
        addNewDiv.className = 'suggestion-add-new';
        addNewDiv.innerText = '➕ إضافة مادة جديدة للنظام';
        addNewDiv.addEventListener('mousedown', (e) => {
            e.preventDefault();
            openQuickAddMaterial(tr.id, nameInput.value);
            dropdown.classList.add('hidden');
        });
        dropdown.appendChild(addNewDiv);
        
        dropdown.classList.remove('hidden');
    });
    
    nameInput.addEventListener('focus', () => {
        if (nameInput.value.trim().length >= 2) {
            nameInput.dispatchEvent(new Event('input'));
        }
    });
    
    nameInput.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.classList.add('hidden');
            highlightedIndex = -1;
        }, 200);
    });
    
    nameInput.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.suggestion-item:not([style*="cursor: default"])');
        const addNewBtn = dropdown.querySelector('.suggestion-add-new');
        const totalItemsCount = items.length + (addNewBtn ? 1 : 0);
        
        if (dropdown.classList.contains('hidden') || totalItemsCount === 0) {
            if (e.key === 'Enter') {
                e.preventDefault();
                companyInput.focus();
            }
            return;
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = (highlightedIndex + 1) % totalItemsCount;
            updateHighlight(items, addNewBtn, highlightedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = (highlightedIndex - 1 + totalItemsCount) % totalItemsCount;
            updateHighlight(items, addNewBtn, highlightedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0) {
                if (highlightedIndex < items.length) {
                    const query = nameInput.value.trim().toLowerCase();
                    const uniqueMaterials = getUniqueMaterials();
                    const filtered = uniqueMaterials.filter(m => m.name.toLowerCase().includes(query));
                    if (filtered[highlightedIndex]) {
                        selectSuggestion(tr, filtered[highlightedIndex]);
                    }
                    dropdown.classList.add('hidden');
                } else if (addNewBtn) {
                    openQuickAddMaterial(tr.id, nameInput.value);
                    dropdown.classList.add('hidden');
                }
            } else {
                dropdown.classList.add('hidden');
                companyInput.focus();
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
            highlightedIndex = -1;
        }
    });
    
    function updateHighlight(items, addNewBtn, index) {
        items.forEach((item, idx) => {
            if (idx === index) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('highlighted');
            }
        });
        if (addNewBtn) {
            if (index === items.length) {
                addNewBtn.classList.add('highlighted');
                addNewBtn.scrollIntoView({ block: 'nearest' });
            } else {
                addNewBtn.classList.remove('highlighted');
            }
        }
    }
    
    qtyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addNewInvoiceRow();
            setTimeout(() => {
                const lastRow = tbody.lastElementChild;
                if (lastRow) {
                    const nextNameInput = lastRow.querySelector('.row-name');
                    if (nextNameInput) nextNameInput.focus();
                }
            }, 50);
        }
    });
    
    calculateInvoiceGrandTotal();
}
window.addNewInvoiceRow = addNewInvoiceRow;

function removeInvoiceRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        calculateInvoiceGrandTotal();
    }
}
window.removeInvoiceRow = removeInvoiceRow;

function calculateInvoiceGrandTotal() {
    let totalQty = 0;
    let totalValue = 0;
    
    const rows = document.querySelectorAll('#invoice-grid-tbody tr');
    rows.forEach(row => {
        const priceInput = row.querySelector('.row-price');
        const qtyInput = row.querySelector('.row-qty');
        const totalSpan = row.querySelector('.row-total');
        
        const price = parseFloat(priceInput.value) || 0;
        const qty = parseInt(qtyInput.value) || 0;
        const rowTotal = price * qty;
        
        totalQty += qty;
        totalValue += rowTotal;
        
        if (totalSpan) {
            totalSpan.innerText = rowTotal.toLocaleString('ar-EG') + ' د.ع';
        }
    });
    
    const draftTotalQtySpan = document.getElementById('draft-total-qty');
    if (draftTotalQtySpan) draftTotalQtySpan.innerText = totalQty.toLocaleString('ar-EG');
    
    const draftTotalValSpan = document.getElementById('draft-total-value');
    if (draftTotalValSpan) draftTotalValSpan.innerText = totalValue.toLocaleString('ar-EG');
}
window.calculateInvoiceGrandTotal = calculateInvoiceGrandTotal;

function cancelEntireReceiptDraft() {
    const rows = document.querySelectorAll('#invoice-grid-tbody tr');
    if (rows.length === 0) {
        initNewReceiptDraft();
        return;
    }
    if (confirm('هل أنت متأكد من إلغاء وتفريغ هذا الوصل بالكامل؟ سيتم مسح المواد المدرجة بالجدول.')) {
        initNewReceiptDraft();
        showToast('تم إلغاء وتفريغ مسودة الوصل بالكامل', 'info');
    }
}
window.cancelEntireReceiptDraft = cancelEntireReceiptDraft;

async function submitFinalizeReceiptDraft(isDraft = true) {
    const receiptNum = document.getElementById('add-tab-receipt-number').value.trim();
    if (!receiptNum) {
        showToast('الرجاء إدخال رقم الوصل لتأكيد التوريد', 'danger');
        document.getElementById('add-tab-receipt-number').focus();
        return;
    }

    const sourceType = document.getElementById('add-tab-source-type').value;
    const supplier = sourceType;
    
    const rows = document.querySelectorAll('#invoice-grid-tbody tr');
    if (rows.length === 0) {
        showToast('الرجاء إضافة مادة واحدة على الأقل في الجدول للتوريد', 'warning');
        return;
    }
    
    const itemsToValidate = [];
    let isValid = true;
    
    rows.forEach(row => {
        const name = row.querySelector('.row-name').value.trim();
        const company = row.querySelector('.row-company').value.trim();
        const batch = row.querySelector('.row-batch').value.trim();
        const expiry = row.querySelector('.row-expiry').value;
        const store = row.querySelector('.row-store').value;
        const category = row.querySelector('.row-category').value;
        const price = parseFloat(row.querySelector('.row-price').value) || 0;
        const qty = parseInt(row.querySelector('.row-qty').value) || 0;
        
        // التحقق إذا كان الصف فارغاً تماماً لتجاهله وسكيب التقييد
        const isRowEmpty = !name && !company && !batch && !expiry && (price === 0);
        if (isRowEmpty) {
            row.style.border = 'none';
            return;
        }
        
        if (!name || isNaN(qty) || qty <= 0) {
            row.style.border = '2px solid var(--danger)';
            isValid = false;
        } else {
            row.style.border = 'none';
            itemsToValidate.push({
                name,
                batchNumber: batch ? batch.toUpperCase().trim() : 'بدون باج',
                expiryDate: expiry || 'غير محدد',
                quantity: qty,
                company: company || 'غير محدد',
                store,
                category,
                sourceType: sourceType,
                price
            });
        }
    });
    
    if (!isValid) {
        showToast('الرجاء ملء كافة حقول المواد المحددة باللون الأحمر بشكل صحيح', 'danger');
        return;
    }
    
    if (itemsToValidate.length === 0) {
        showToast('الرجاء تعبئة وتوريد مادة واحدة على الأقل في الجدول', 'warning');
        return;
    }
    
    const listId = document.getElementById('add-tab-list-id').value;
    const totalVal = itemsToValidate.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    if (isDraft) {
        if (confirm(`هل أنت متأكد من حفظ هذه القائمة كمسودة مؤقتة؟ (لن يتم زيادة رصيد المواد الفعلي بالمخازن)`)) {
            // الخطوة الأولى: إعداد وحفظ السجل بـ Invoices
            const existingInvoiceIdx = state.Invoices.findIndex(i => i.id === listId);
            
            const invoiceData = {
                id: listId,
                invoice_number: receiptNum,
                supplier_name: supplier,
                date: new Date().toISOString().split('T')[0],
                created_at: new Date().toISOString().split('T')[0],
                total_amount: totalVal,
                status: 'draft',
                items: itemsToValidate
            };
            
            // نسخة احتياطية محلية للتراجع في حال فشل الحفظ
            const backupInvoices = [...state.Invoices];
            const backupDetails = [...state.Invoice_Items];
            const backupMaterials = JSON.parse(JSON.stringify(state.materials));
            
            // إذا كانت الفاتورة معتمدة سابقاً وتم تحويلها لمسودة، نخصم كمياتها القديمة من رصيد المخزن
            if (existingInvoiceIdx !== -1 && state.Invoices[existingInvoiceIdx].status === 'completed') {
                const oldInvoice = state.Invoices[existingInvoiceIdx];
                if (oldInvoice.items && oldInvoice.items.length > 0) {
                    oldInvoice.items.forEach(oldItem => {
                        let prod = state.materials.find(m => 
                            m.name.toLowerCase() === oldItem.name.toLowerCase() && 
                            m.batchNumber === oldItem.batchNumber && 
                            m.store === oldItem.store
                        );
                        if (prod) {
                            prod.quantity = Math.max(0, (parseInt(prod.quantity) || 0) - oldItem.quantity);
                        }
                    });
                }
                state.transactions = state.transactions.filter(t => t.listId !== listId && t.receiptNumber !== oldInvoice.invoice_number);
            }

            if (existingInvoiceIdx !== -1) {
                state.Invoices[existingInvoiceIdx] = invoiceData;
            } else {
                state.Invoices.unshift(invoiceData);
            }
            
            // الخطوة الثانية: حفظ المواد بـ Invoice_Items وربطها بـ invoice_id
            state.Invoice_Items = state.Invoice_Items.filter(d => d.invoice_id !== listId);
            
            itemsToValidate.forEach(item => {
                let product = state.materials.find(m => 
                    m.name.toLowerCase() === item.name.toLowerCase() && 
                    m.batchNumber === item.batchNumber && 
                    m.store === item.store
                );
                
                let productId;
                if (product) {
                    productId = product.id;
                    product.price = item.price;
                    product.company = item.company;
                    product.expiryDate = item.expiryDate;
                    product.category = item.category;
                    product.sourceType = item.sourceType;
                } else {
                    productId = 'mat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                    state.materials.push({
                        id: productId,
                        name: item.name,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        quantity: 0, // مسودة: لا زيادة بالرصيد
                        company: item.company,
                        store: item.store,
                        category: item.category,
                        sourceType: item.sourceType,
                        price: item.price
                    });
                }
                
                state.Invoice_Items.push({
                    id: 'det-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    invoice_id: listId,
                    product_id: productId,
                    quantity: item.quantity,
                    price: item.price
                });
            });
            
            // الحفظ سريع ومحلي فوراً
            state.save(); // يرفع بالخلفية دون حجب الواجهة
            
            const redirectBtn = `<button class="btn btn-secondary" style="margin-right:12px; padding:3px 8px; font-size:0.75rem; background-color:#3b82f6; color:white; border:none; cursor:pointer; border-radius:4px; font-weight:bold;" onclick="switchTab('tab-saved-receipts')">الانتقال لإدارة الفواتير ➔</button>`;
            showToast(`تم حفظ الفاتورة رقم ${receiptNum} كمسودة بنجاح! ${redirectBtn}`, 'success');
            
            initNewReceiptDraft();
            renderAdminDashboard();
            switchTab('tab-saved-receipts');
        }
    } else {
        const existingInvoiceIdx = state.Invoices.findIndex(i => i.id === listId);
        const isEditingCompleted = (existingInvoiceIdx !== -1 && state.Invoices[existingInvoiceIdx].status === 'completed');

        const confirmMsg = isEditingCompleted
            ? `هل أنت متأكد من حفظ وتحديث هذه القائمة المعتمدة رقم "${receiptNum}"؟\nسيتم تحديث كميات المواد بالمخازن تلقائياً بناءً على البيانات المعدلة.`
            : `هل أنت متأكد من اعتماد وترحيل هذه القائمة رقم "${receiptNum}" نهائياً للمخزن؟`;

        if (confirm(confirmMsg)) {
            // إذا كانت الفاتورة معتمدة سابقاً، نقوم بخصم كمياتها القديمة أولاً لكي لا تتكرر الزيادة
            if (isEditingCompleted) {
                const oldInvoice = state.Invoices[existingInvoiceIdx];
                if (oldInvoice.items && oldInvoice.items.length > 0) {
                    oldInvoice.items.forEach(oldItem => {
                        let prod = state.materials.find(m => 
                            m.name.toLowerCase() === oldItem.name.toLowerCase() && 
                            m.batchNumber === oldItem.batchNumber && 
                            m.store === oldItem.store
                        );
                        if (prod) {
                            prod.quantity = Math.max(0, (parseInt(prod.quantity) || 0) - oldItem.quantity);
                        }
                    });
                }
                state.transactions = state.transactions.filter(t => t.listId !== listId && t.receiptNumber !== oldInvoice.invoice_number);
            }
            
            const invoiceData = {
                id: listId,
                invoice_number: receiptNum,
                supplier_name: supplier,
                date: (existingInvoiceIdx !== -1 && state.Invoices[existingInvoiceIdx].date) ? state.Invoices[existingInvoiceIdx].date : new Date().toISOString().split('T')[0],
                created_at: (existingInvoiceIdx !== -1 && state.Invoices[existingInvoiceIdx].created_at) ? state.Invoices[existingInvoiceIdx].created_at : new Date().toISOString().split('T')[0],
                updated_at: new Date().toISOString().split('T')[0],
                total_amount: totalVal,
                status: 'completed',
                items: itemsToValidate
            };
            
            if (existingInvoiceIdx !== -1) {
                state.Invoices[existingInvoiceIdx] = invoiceData;
            } else {
                state.Invoices.unshift(invoiceData);
            }
            
            state.Invoice_Items = state.Invoice_Items.filter(d => d.invoice_id !== listId);
            
            // الخطوة الثالثة: زيادة رصيد الكميات فقط في جدول Products
            itemsToValidate.forEach(item => {
                let product = state.materials.find(m => 
                    m.name.toLowerCase() === item.name.toLowerCase() && 
                    m.batchNumber === item.batchNumber && 
                    m.store === item.store
                );
                
                let productId;
                if (product) {
                    productId = product.id;
                    product.quantity = (parseInt(product.quantity) || 0) + item.quantity;
                    product.price = item.price;
                    product.company = item.company;
                    product.expiryDate = item.expiryDate;
                    product.category = item.category;
                    product.sourceType = item.sourceType;
                } else {
                    productId = 'mat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                    state.materials.push({
                        id: productId,
                        name: item.name,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        quantity: item.quantity,
                        company: item.company,
                        store: item.store,
                        category: item.category,
                        sourceType: item.sourceType,
                        price: item.price
                    });
                }
                
                state.Invoice_Items.push({
                    id: 'det-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    invoice_id: listId,
                    product_id: productId,
                    quantity: item.quantity,
                    price: item.price
                });
                
                // تسجيل الحركة المخزنية
                state.transactions.unshift({
                    id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    type: 'receipt',
                    fromStore: `مورد: ${supplier} (وصل: ${receiptNum})`,
                    toDest: item.store === 'store1' ? 'مخزن 1' : 'مخزن 2',
                    materialName: item.name,
                    batchNumber: item.batchNumber,
                    quantity: item.quantity,
                    date: new Date().toISOString().split('T')[0],
                    receiptNumber: receiptNum,
                    listId: listId // مرجع لرقم الوصل / الفاتورة
                });
            });
            
            // الحفظ والتوريد محلياً فوراً
            state.save(); // يرفع بالخلفية دون حجب الواجهة
            
            const redirectBtn = `<button class="btn btn-secondary" style="margin-right:12px; padding:3px 8px; font-size:0.75rem; background-color:#10b981; color:white; border:none; cursor:pointer; border-radius:4px; font-weight:bold;" onclick="switchTab('tab-saved-receipts')">الانتقال لإدارة الفواتير ➔</button>`;
            showToast(`تم ${isEditingCompleted ? 'تعديل وتحديث' : 'اعتماد وتوريد'} الفاتورة رقم ${receiptNum} بنجاح! ${redirectBtn}`, 'success');
            
            initNewReceiptDraft();
            renderAdminDashboard();
            switchTab('tab-saved-receipts');
        }
    }
}
window.submitFinalizeReceiptDraft = submitFinalizeReceiptDraft;

function loadDraftForEditing(listId) {
    const invoice = state.Invoices.find(i => i.id === listId);
    if (!invoice) {
        showToast('لم يتم العثور على القائمة المطلوبة', 'danger');
        return;
    }
    
    // إغلاق نافذة التفاصيل إذا كانت مفتوحة
    if (typeof closeModal === 'function') {
        closeModal('receipt-details-modal');
    }
    
    const isCompleted = invoice.status === 'completed';
    
    const listIdInput = document.getElementById('add-tab-list-id');
    if (listIdInput) listIdInput.value = invoice.id;
    
    const receiptNumInput = document.getElementById('add-tab-receipt-number');
    if (receiptNumInput) receiptNumInput.value = invoice.invoice_number;
    
    const sourceSelect = document.getElementById('add-tab-source-type');
    if (sourceSelect) sourceSelect.value = invoice.supplier_name || 'عامة';
    
    const tbody = document.getElementById('invoice-grid-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        
        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => {
                addNewInvoiceRow({
                    name: item.name,
                    company: item.company,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    store: item.store,
                    category: item.category,
                    sourceType: item.sourceType,
                    price: item.price,
                    quantity: item.quantity
                });
            });
        } else {
            // جلب المواد المرتبطة بهذه الفاتورة (توافق رجوعي للبيانات القديمة)
            const details = state.Invoice_Items.filter(d => d.invoice_id === listId);
            details.forEach(detail => {
                const product = state.materials.find(m => m.id === detail.product_id);
                if (product) {
                    addNewInvoiceRow({
                        name: product.name,
                        company: product.company,
                        batchNumber: product.batchNumber,
                        expiryDate: product.expiryDate,
                        store: product.store,
                        category: product.category,
                        sourceType: product.sourceType,
                        price: detail.price,
                        quantity: detail.quantity
                    });
                }
            });
        }
    }
    
    switchTab('tab-add-material');
    if (isCompleted) {
        showToast(`تم فتح الفاتورة المعتمدة #${invoice.invoice_number} للتعديل. عند حفظها سيتم تحديث الكميات في المخازن تلقائياً.`, 'info');
    } else {
        showToast('تم تحميل بيانات المسودة للمحرر', 'info');
    }
}
window.loadDraftForEditing = loadDraftForEditing;
window.loadInvoiceForEditing = loadDraftForEditing;

async function confirmDraftReceipt(listId) {
    const invoice = state.Invoices.find(i => i.id === listId);
    if (!invoice) return;
    
    if (invoice.status === 'completed') {
        showToast('هذه الفاتورة معتمدة ومكتملة بالفعل', 'warning');
        return;
    }
    
    if (confirm(`هل أنت متأكد من اعتماد وترحيل الفاتورة رقم "${invoice.invoice_number}" للمخزن؟ (سيتم زيادة رصيد المواد الفعلي بالمخازن ولا يمكن التراجع)`)) {
        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => {
                let product = state.materials.find(m => 
                    m.name.toLowerCase() === item.name.toLowerCase() && 
                    m.batchNumber === item.batchNumber && 
                    m.store === item.store
                );
                
                if (product) {
                    product.quantity = (parseInt(product.quantity) || 0) + item.quantity;
                    product.price = item.price;
                    product.company = item.company;
                    product.expiryDate = item.expiryDate;
                    product.category = item.category;
                } else {
                    state.materials.push({
                        id: 'mat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                        name: item.name,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        quantity: item.quantity,
                        company: item.company,
                        store: item.store,
                        category: item.category,
                        sourceType: item.sourceType || 'عامة',
                        price: item.price
                    });
                }
                
                // تسجيل الحركة المخزنية
                state.transactions.unshift({
                    id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    type: 'receipt',
                    fromStore: `مورد: ${invoice.supplier_name || 'مورد خارجي'} (وصل: ${invoice.invoice_number})`,
                    toDest: item.store === 'store1' ? 'مخزن 1' : 'مخزن 2',
                    materialName: item.name,
                    batchNumber: item.batchNumber,
                    quantity: item.quantity,
                    date: new Date().toISOString().split('T')[0],
                    receiptNumber: invoice.invoice_number,
                    listId: invoice.id // مرجع لرقم الفاتورة
                });
            });
        } else {
            // التوافق الرجوعي (في حال عدم وجود حقل items بالفاتورة القديمة)
            const details = state.Invoice_Items.filter(d => d.invoice_id === listId);
            details.forEach(detail => {
                const product = state.materials.find(m => m.id === detail.product_id);
                if (product) {
                    product.quantity = (parseInt(product.quantity) || 0) + detail.quantity;
                    
                    // تسجيل الحركة المخزنية
                    state.transactions.unshift({
                        id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                        type: 'receipt',
                        fromStore: `مورد: ${invoice.supplier_name || 'مورد خارجي'} (وصل: ${invoice.invoice_number})`,
                        toDest: product.store === 'store1' ? 'مخزن 1' : 'مخزن 2',
                        materialName: product.name,
                        batchNumber: product.batchNumber,
                        quantity: detail.quantity,
                        date: new Date().toISOString().split('T')[0],
                        receiptNumber: invoice.invoice_number,
                        listId: invoice.id // مرجع لرقم الفاتورة
                    });
                }
            });
        }
        
        invoice.status = 'completed';
        showToast('جاري ترحيل الفاتورة وتحديث المخازن...', 'info');
        state.save(); // يرفع بالخلفية دون حجب الواجهة
        
        showToast(`تم اعتماد وتوريد الفاتورة رقم "${invoice.invoice_number}" بنجاح!`, 'success');
        renderAdminDashboard();
        renderSavedReceiptsTable();
    }
}
window.confirmDraftReceipt = confirmDraftReceipt;

async function deleteDraftReceipt(listId) {
    const idx = state.Invoices.findIndex(i => i.id === listId);
    if (idx === -1) {
        showToast('لم يتم العثور على القائمة لحذفها', 'warning');
        return;
    }
    
    const invoice = state.Invoices[idx];
    const isCompleted = invoice.status === 'completed';
    
    const confirmMessage = isCompleted
        ? `هل أنت متأكد من حذف قائمة التوريد المعتمدة رقم "${invoice.invoice_number}" نهائياً؟\n\nتنبيه: سيتم خصم وإلغاء كميات هذه القائمة من رصيد المخزن تلقائياً لإبقاء الجرد متطابقاً.`
        : `هل أنت متأكد من حذف قائمة التوريد المسودة رقم "${invoice.invoice_number}" نهائياً؟`;
    
    if (confirm(confirmMessage)) {
        // إذا كانت معتمدة، نخصم كمياتها من المخازن ونلغي حركاتها
        if (isCompleted) {
            if (invoice.items && invoice.items.length > 0) {
                invoice.items.forEach(oldItem => {
                    let prod = state.materials.find(m => 
                        m.name.toLowerCase() === oldItem.name.toLowerCase() && 
                        m.batchNumber === oldItem.batchNumber && 
                        m.store === oldItem.store
                    );
                    if (prod) {
                        prod.quantity = Math.max(0, (parseInt(prod.quantity) || 0) - oldItem.quantity);
                    }
                });
            } else {
                const details = state.Invoice_Items.filter(d => d.invoice_id === listId);
                details.forEach(detail => {
                    const product = state.materials.find(m => m.id === detail.product_id);
                    if (product) {
                        product.quantity = Math.max(0, (parseInt(product.quantity) || 0) - detail.quantity);
                    }
                });
            }
            
            // إزالة حركات التوريد المرتبطة بهذه القائمة
            state.transactions = state.transactions.filter(t => t.listId !== listId && t.receiptNumber !== invoice.invoice_number);
        }
        
        // حذف الفاتورة وتفاصيلها من السجلات
        state.Invoices.splice(idx, 1);
        state.Invoice_Items = state.Invoice_Items.filter(d => d.invoice_id !== listId);
        
        showToast('جاري حذف القائمة وتحديث البيانات...', 'info');
        state.save(); // يرفع بالخلفية ويزامن مع كلاود فايربيس
        
        showToast(isCompleted ? 'تم حذف القائمة وتعديل أرصدة المخازن بنجاح' : 'تم حذف المسودة بنجاح', 'success');
        
        if (typeof closeModal === 'function') {
            closeModal('receipt-details-modal');
        }
        
        renderSavedReceiptsTable();
        renderAdminSidebarMenu();
        if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
        if (typeof renderInventory === 'function') renderInventory();
    }
}
window.deleteDraftReceipt = deleteDraftReceipt;
window.deleteInvoice = deleteDraftReceipt;

async function clearAllInvoices() {
    if (confirm('هل أنت متأكد من مسح جميع الفواتير المدخلة وتفاصيلها نهائياً من النظام؟ (لن يؤثر هذا على رصيد المواد الحالي بالمخازن)')) {
        state.Invoices = [];
        state.Invoice_Items = [];
        showToast('جاري مسح الفواتير...', 'info');
        state.save(); // يرفع بالخلفية دون حجب الواجهة
        showToast('تم مسح جميع الفواتير والمستندات بنجاح!', 'success');
        renderSavedReceiptsTable();
        renderAdminSidebarMenu();
    }
}
window.clearAllInvoices = clearAllInvoices;

function toggleInvoiceDropdown(invoiceId) {
    const dropdown = document.getElementById(`dropdown-${invoiceId}`);
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains('hidden');
    hideAllInvoiceDropdowns();
    if (isHidden) {
        dropdown.classList.remove('hidden');
    }
}
window.toggleInvoiceDropdown = toggleInvoiceDropdown;

function hideAllInvoiceDropdowns() {
    const dropdowns = document.querySelectorAll('.erp-invoice-dropdown-menu');
    dropdowns.forEach(d => d.classList.add('hidden'));
}
window.hideAllInvoiceDropdowns = hideAllInvoiceDropdowns;

// إغلاق قوائم الإجراءات عند النقر في أي مكان آخر
document.addEventListener('click', () => {
    hideAllInvoiceDropdowns();
});

function renderSavedReceiptsTable() {
    const container = document.getElementById('saved-receipts-container');
    if (!container) return;
    container.innerHTML = '';
    
    const allInvoices = state.Invoices || [];
    const totalItems = allInvoices.length;
    const config = paginationConfig.invoices || { page: 1, rowsPerPage: 10 };
    
    if (config.rowsPerPage !== 'all') {
        const totalPages = Math.ceil(totalItems / config.rowsPerPage) || 1;
        if (config.page > totalPages) {
            config.page = totalPages;
        }
    }
    
    let invoicesToDisplay = allInvoices;
    if (config.rowsPerPage !== 'all') {
        const startIndex = (config.page - 1) * config.rowsPerPage;
        const endIndex = startIndex + config.rowsPerPage;
        invoicesToDisplay = allInvoices.slice(startIndex, endIndex);
    }
    
    invoicesToDisplay.forEach((purchase, idx) => {
        let listTotalQty = 0;
        let listTotalValue = 0;
        let detailsLength = 0;
        
        if (purchase.items && purchase.items.length > 0) {
            detailsLength = purchase.items.length;
            purchase.items.forEach(detail => {
                listTotalQty += detail.quantity;
                listTotalValue += (detail.quantity * (detail.price || 0));
            });
        } else {
            const details = state.Invoice_Items.filter(d => d.invoice_id === purchase.id);
            detailsLength = details.length;
            details.forEach(detail => {
                listTotalQty += detail.quantity;
                listTotalValue += (detail.quantity * (detail.price || 0));
            });
        }
        
        const isDraft = purchase.status === 'draft';
        const supplierName = purchase.supplier_name || 'مورد خارجي';
        const firstLetter = supplierName.charAt(0).toUpperCase();
        
        const formattedDateTime = purchase.created_at 
            ? purchase.created_at 
            : `12:00:00 ${purchase.date}`;
            
        const card = document.createElement('div');
        card.className = 'erp-invoice-card';
        card.id = `invoice-card-${purchase.id}`;
        
        card.onclick = (e) => {
            if (e.target.closest('.erp-invoice-actions-dropdown') || e.target.closest('.erp-invoice-checkbox')) {
                return;
            }
            showReceiptDetails(purchase.id);
        };
        
        card.innerHTML = `
            <!-- الجانب الأيمن (النتائج) -->
            <div class="erp-invoice-right-section">
                <input type="checkbox" class="erp-invoice-checkbox" onclick="event.stopPropagation();">
                <div class="erp-invoice-avatar" style="background-color: ${isDraft ? '#f59e0b' : '#ec4899'};">
                    ${firstLetter}
                </div>
                <div class="erp-invoice-info-cols">
                    <div class="erp-invoice-title">
                        <a href="javascript:void(0)" onclick="event.stopPropagation(); showReceiptDetails('${purchase.id}');">
                            ${purchase.date} - #${purchase.invoice_number}
                        </a>
                    </div>
                    <div class="erp-invoice-vendor">
                        <span>${supplierName}</span>
                        <i class="erp-invoice-vendor-edit-icon" style="cursor: pointer; font-style: normal;" title="تعديل القائمة" onclick="event.stopPropagation(); loadDraftForEditing('${purchase.id}')">✏️</i>
                    </div>
                    <div class="erp-invoice-details-text">
                        رقم التعريف: <code style="color: var(--accent); font-family: monospace;">${purchase.id}</code> | عدد الأصناف: <strong>${detailsLength} أصناف</strong> | مجموع القطع: <strong>${listTotalQty} قطعة</strong>
                    </div>
                </div>
            </div>
            
            <!-- المنتصف (الوثيقة) -->
            <div class="erp-invoice-middle-section">
                <div class="erp-invoice-created-by">
                    👤 <span>أمين المخزن (Harem Nawzad)</span>
                </div>
                <div class="erp-invoice-date-time">
                    ⏱️ أنشئت: ${formattedDateTime}
                </div>
            </div>
            
            <!-- الجانب الأيسر (الماليات والإجراءات) -->
            <div class="erp-invoice-left-section">
                <div class="erp-invoice-amount-block">
                    <div class="erp-invoice-amount">${listTotalValue.toLocaleString('ar-EG')} د.ع</div>
                    <span class="erp-invoice-status-tag ${purchase.status}">
                        ${isDraft ? '📝 مسودة' : '✓ معتمد'}
                    </span>
                </div>
                
                <!-- إجراءات ثلاثي النقاط -->
                <div class="erp-invoice-actions-dropdown">
                    <button class="erp-invoice-actions-btn" onclick="event.stopPropagation(); toggleInvoiceDropdown('${purchase.id}')">
                        ⋮
                    </button>
                    <div id="dropdown-${purchase.id}" class="erp-invoice-dropdown-menu hidden">
                        <div class="erp-invoice-dropdown-item" onclick="event.stopPropagation(); showReceiptDetails('${purchase.id}'); hideAllInvoiceDropdowns();">🔍 عرض التفاصيل</div>
                        <div class="erp-invoice-dropdown-item" onclick="event.stopPropagation(); loadDraftForEditing('${purchase.id}'); hideAllInvoiceDropdowns();">✏️ تعديل القائمة</div>
                        ${isDraft ? `
                            <div class="erp-invoice-dropdown-item" onclick="event.stopPropagation(); confirmDraftReceipt('${purchase.id}'); hideAllInvoiceDropdowns();">🚀 اعتماد وترحيل</div>
                        ` : ''}
                        <div class="erp-invoice-dropdown-item" onclick="event.stopPropagation(); generateReceiptInvoicePDF('${purchase.id}'); hideAllInvoiceDropdowns();">📄 تصدير PDF</div>
                        <div class="erp-invoice-dropdown-item" style="color: var(--danger); font-weight: 600;" onclick="event.stopPropagation(); deleteDraftReceipt('${purchase.id}'); hideAllInvoiceDropdowns();">🗑️ حذف القائمة</div>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    if (totalItems === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 40px 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                <span style="font-size: 2rem; display: block; margin-bottom: 10px;">📋</span>
                لا توجد أي فواتير أو قوائم توريد مسجلة حالياً في النظام.
            </div>
        `;
    }
    
    // رسم أزرار الترقيم للقوائم
    renderPaginationButtons('invoices', totalItems);
}
window.renderSavedReceiptsTable = renderSavedReceiptsTable;

function showReceiptDetails(listId) {
    const purchase = state.Invoices.find(p => p.id === listId);
    if (!purchase) return;
    
    const listIdSpan = document.getElementById('detail-receipt-list-id');
    if (listIdSpan) listIdSpan.innerText = purchase.id;
    
    const receiptNumSpan = document.getElementById('detail-receipt-number');
    if (receiptNumSpan) receiptNumSpan.innerText = purchase.invoice_number;
    
    const dateSpan = document.getElementById('detail-receipt-date');
    if (dateSpan) dateSpan.innerText = purchase.date;

    const supplierSpan = document.getElementById('detail-receipt-supplier');
    if (supplierSpan) supplierSpan.innerText = purchase.supplier_name || 'مورد خارجي';
    
    const statusSpan = document.getElementById('detail-receipt-status');
    if (statusSpan) {
        statusSpan.innerText = purchase.status === 'draft' ? 'مسودة مؤقتة' : 'معتمدة ومكتملة';
        statusSpan.style.color = purchase.status === 'draft' ? 'var(--accent)' : '#10b981';
    }
    
    const tbody = document.getElementById('receipt-details-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        let totalQty = 0;
        let totalVal = 0;
        
        let details = [];
        let isNewSchema = false;
        
        if (purchase.items && purchase.items.length > 0) {
            details = purchase.items;
            isNewSchema = true;
        } else {
            details = state.Invoice_Items.filter(d => d.invoice_id === listId);
        }
        
        details.forEach((detail, idx) => {
            let name, batchNumber, storeText, quantity, expiryDate, category, price, lineVal;
            if (isNewSchema) {
                name = detail.name;
                batchNumber = detail.batchNumber;
                storeText = detail.store === 'store1' ? 'مخزن 1' : 'مخزن 2';
                quantity = detail.quantity;
                expiryDate = detail.expiryDate;
                category = detail.category;
                price = detail.price || 0;
                lineVal = quantity * price;
            } else {
                const product = state.materials.find(m => m.id === detail.product_id);
                name = product ? product.name : 'مادة محذوفة';
                batchNumber = product ? product.batchNumber : '';
                storeText = (product && product.store === 'store1') ? 'مخزن 1' : 'مخزن 2';
                quantity = detail.quantity;
                expiryDate = product ? product.expiryDate : '';
                category = product ? product.category : '';
                price = detail.price || 0;
                lineVal = quantity * price;
            }
            
            totalQty += quantity;
            totalVal += lineVal;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td style="font-weight: 700;">${name}</td>
                <td><code>${batchNumber}</code></td>
                <td><span class="tag">${storeText}</span></td>
                <td style="text-align: center; font-weight: 700; color: var(--primary);">${quantity}</td>
                <td>${expiryDate}</td>
                <td>${category}</td>
                <td>${price.toLocaleString('ar-EG')} د.ع</td>
                <td style="font-weight: 700; color: var(--success);">${lineVal.toLocaleString('ar-EG')} د.ع</td>
            `;
            tbody.appendChild(tr);
        });
        
        const totalItemsSpan = document.getElementById('detail-receipt-total-items');
        if (totalItemsSpan) totalItemsSpan.innerText = details.length + ' أصناف';

        const totalQtySpan = document.getElementById('detail-receipt-total-qty');
        if (totalQtySpan) totalQtySpan.innerText = totalQty.toLocaleString('ar-EG') + ' قطعة';
        
        const totalValSpan = document.getElementById('detail-receipt-total-value');
        if (totalValSpan) totalValSpan.innerText = totalVal.toLocaleString('ar-EG');
    }
    
    openModal('receipt-details-modal');
}
window.showReceiptDetails = showReceiptDetails;

// فتح الفاتورة مباشرة من القائمة الجانبية (Sub Menu)
function openInvoiceDirectly(invoiceId) {
    const invIndex = state.Invoices.findIndex(p => p.id === invoiceId);
    if (invIndex !== -1 && paginationConfig.invoices && paginationConfig.invoices.rowsPerPage !== 'all') {
        const targetPage = Math.floor(invIndex / paginationConfig.invoices.rowsPerPage) + 1;
        paginationConfig.invoices.page = targetPage;
    }
    switchTab('tab-saved-receipts');
    showReceiptDetails(invoiceId);
    setTimeout(() => {
        const card = document.getElementById(`invoice-card-${invoiceId}`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('highlight-pulse');
            setTimeout(() => card.classList.remove('highlight-pulse'), 2000);
        }
    }, 300);
}
window.openInvoiceDirectly = openInvoiceDirectly;

function generateReceiptInvoicePDF(listId) {
    const purchase = state.Invoices.find(p => p.id === listId);
    if (!purchase) return;

    let details = [];
    let isNewSchema = false;
    
    if (purchase.items && purchase.items.length > 0) {
        details = purchase.items;
        isNewSchema = true;
    } else {
        details = state.Invoice_Items.filter(d => d.invoice_id === listId);
    }
    
    let totalQty = 0;
    let totalVal = 0;
    
    const tableRows = details.map((detail, idx) => {
        let name, price, quantity, lineVal;
        if (isNewSchema) {
            name = detail.name;
            price = detail.price || 0;
            quantity = detail.quantity;
            lineVal = quantity * price;
        } else {
            const product = state.materials.find(m => m.id === detail.product_id);
            name = product ? product.name : 'مادة محذوفة';
            price = detail.price || 0;
            quantity = detail.quantity;
            lineVal = quantity * price;
        }
        
        totalQty += quantity;
        totalVal += lineVal;
        
        return `
            <tr>
                <td style="text-align: right; border: 1.5px solid #000000; padding: 12px 15px; font-weight: bold; font-size: 14px;">${name}</td>
                <td style="text-align: center; border: 1.5px solid #000000; padding: 12px 15px; font-size: 14px;">${price.toLocaleString('en-US')}</td>
                <td style="text-align: center; border: 1.5px solid #000000; padding: 12px 15px; font-size: 14px; font-weight: bold;">${quantity}</td>
                <td style="text-align: left; border: 1.5px solid #000000; padding: 12px 15px; font-weight: bold; font-size: 14px;">${lineVal.toLocaleString('en-US')}</td>
            </tr>
        `;
    }).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>أمر شراء رقم ${purchase.invoice_number}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                body {
                    font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 40px;
                    background-color: #ffffff;
                    color: #000000;
                    direction: rtl;
                }
                .invoice-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 40px;
                    font-size: 14px;
                    line-height: 1.6;
                }
                .right-side {
                    text-align: right;
                }
                .left-side {
                    text-align: left;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }
                .left-side-row {
                    display: flex;
                    justify-content: space-between;
                    width: 250px;
                    margin-bottom: 5px;
                }
                .left-side-row span.label {
                    font-weight: bold;
                    color: #000000;
                    text-align: right;
                }
                .left-side-row span.value {
                    font-weight: bold;
                    text-align: left;
                }
                .invoice-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 30px;
                    margin-bottom: 30px;
                    border: 1.5px solid #000000;
                }
                .invoice-table th {
                    background-color: #e5e7eb;
                    border: 1.5px solid #000000;
                    padding: 12px 15px;
                    font-weight: bold;
                    font-size: 14px;
                    text-align: center;
                }
                .invoice-table th:first-child {
                    text-align: right;
                }
                .invoice-table th:last-child {
                    text-align: left;
                }
                .totals-wrapper {
                    display: flex;
                    justify-content: flex-end; /* يدفعه لليسار في RTL */
                    margin-top: 15px;
                }
                .totals-table {
                    width: 350px;
                    border-collapse: collapse;
                    border: 1.5px solid #000000;
                }
                .totals-table td {
                    padding: 10px 15px;
                    border: 1.5px solid #000000;
                    font-size: 14px;
                    font-weight: bold;
                }
                .totals-table tr td:first-child {
                    text-align: right;
                    width: 40%;
                }
                .totals-table tr td:last-child {
                    text-align: left;
                    width: 60%;
                }
                .totals-table tr.highlight {
                    background-color: #e5e7eb;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                }
            </style>
        </head>
        <body>
            
            <div class="invoice-header">
                <div class="right-side">
                    <span style="font-weight: bold; font-size: 15px;">المورد:</span><br>
                    <span style="font-weight: bold; font-size: 15px;">${purchase.supplier_name || 'Light Health'}</span><br>
                    <span>Harem Nawzad</span><br>
                    <span>kirkuk-heron</span><br>
                    <span>Kirkuk-Z22</span><br>
                    <span>kirkuk, AA 36001</span>
                </div>
                <div class="left-side">
                    <div class="left-side-row">
                        <span class="label">رقم أمر الشراء #</span>
                        <span class="value">${purchase.invoice_number.replace('INV-', '')}</span>
                    </div>
                    <div class="left-side-row">
                        <span class="label">التاريخ</span>
                        <span class="value" style="font-family: sans-serif;">${purchase.date.split('-').reverse().join('/')}</span>
                    </div>
                </div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width: 50%;">البند</th>
                        <th style="width: 15%;">سعر الوحدة</th>
                        <th style="width: 15%;">الكمية</th>
                        <th style="width: 20%;">المجموع</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <div class="totals-wrapper">
                <table class="totals-table">
                    <tr>
                        <td>المجموع:</td>
                        <td>${totalVal.toLocaleString('en-US')} د.ع</td>
                    </tr>
                    <tr>
                        <td>الشحن:</td>
                        <td>0.00 د.ع</td>
                    </tr>
                    <tr class="highlight">
                        <td>الإجمالي:</td>
                        <td>${totalVal.toLocaleString('en-US')} د.ع</td>
                    </tr>
                    <tr>
                        <td>مدفوعة:</td>
                        <td>-${totalVal.toLocaleString('en-US')} د.ع</td>
                    </tr>
                    <tr>
                        <td>المبلغ المستحق:</td>
                        <td>0.00 د.ع</td>
                    </tr>
                </table>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}
window.generateReceiptInvoicePDF = generateReceiptInvoicePDF;

function renderCategorySelectDropdown() {
    const select = document.getElementById('add-category-select');
    if (select) {
        select.innerHTML = '';
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            if (cat === 'أخرى') opt.selected = true;
            select.appendChild(opt);
        });
    }

    const tabSelect = document.getElementById('add-tab-category-select');
    if (tabSelect) {
        tabSelect.innerHTML = '';
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            if (cat === 'أخرى') opt.selected = true;
            tabSelect.appendChild(opt);
        });
    }

    const editSelect = document.getElementById('edit-category-select');
    if (editSelect) {
        editSelect.innerHTML = '';
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            editSelect.appendChild(opt);
        });
    }
}

function renderCategoriesSettingsList() {
    const tbody = document.getElementById('settings-categories-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    state.categories.forEach(cat => {
        const tr = document.createElement('tr');
        const isDefault = cat === 'أخرى';
        
        tr.innerHTML = `
            <td style="font-weight:700;">${cat} ${isDefault ? '<span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">(افتراضي للنظام)</span>' : ''}</td>
            <td style="text-align:left;">
                ${isDefault ? '-' : `
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem;" onclick="triggerEditCategoryName('${cat}')">تعديل 📝</button>
                        <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem; background-color:var(--danger-bg); color:#fca5a5;" onclick="triggerDeleteCategory('${cat}')">مسح 🗑️</button>
                    </div>
                `}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function triggerEditCategoryName(oldName) {
    const newName = prompt(`تعديل اسم التصنيف "${oldName}" إلى:`, oldName);
    if (!newName) return;
    const cleanName = newName.trim();
    if (!cleanName || cleanName === oldName) return;

    if (cleanName === 'أخرى') {
        showToast('لا يمكن استخدام اسم التصنيف الافتراضي (أخرى)', 'danger');
        return;
    }

    const exists = state.categories.some(c => c.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
        showToast('هذا التصنيف موجود بالفعل', 'warning');
        return;
    }

    const index = state.categories.indexOf(oldName);
    if (index === -1) return;

    // تحديث اسم التصنيف في مصفوفة التصنيفات الحالية
    state.categories[index] = cleanName;

    // تحديث كافة المواد المرتبطة بهذا التصنيف
    state.materials.forEach(mat => {
        if (mat.category === oldName) {
            mat.category = cleanName;
        }
    });

    state.save();

    // تحديث الفلاتر النشطة إذا كانت مطابقة للاسم القديم
    if (currentAdminCategoryFilter === oldName) currentAdminCategoryFilter = cleanName;
    if (currentCustomerCategoryFilter === oldName) currentCustomerCategoryFilter = cleanName;

    updateCategoryUI();
    
    if (state.currentUser && state.currentUser.role === 'admin') {
        renderAdminDashboard();
    } else if (state.currentUser) {
        renderCustomerDashboard();
    }

    showToast(`تم تعديل اسم التصنيف بنجاح إلى "${cleanName}"`, 'success');
}

function triggerDeleteCategory(cat) {
    if (confirm(`هل أنت متأكد من مسح التصنيف "${cat}"؟ سيتم تحويل كافة المواد المرتبطة به تلقائياً إلى فئة "أخرى".`)) {
        removeCategory(cat);
    }
}

function submitAddCategoryForm() {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    if (addNewCategory(name)) {
        input.value = '';
    }
}

function openCategoriesSettingsModal() {
    renderCategoriesSettingsList();
    openModal('categories-settings-modal');
}

// حفظ إعدادات النظام والهوية
function saveSystemConfig(centerName, reportSubtitle, reportStyle) {
    if (!centerName.trim()) {
        showToast('الرجاء إدخال اسم مركز صالح', 'danger');
        return false;
    }
    state.systemConfig.centerName = centerName.trim();
    state.systemConfig.reportSubtitle = reportSubtitle.trim();
    state.systemConfig.reportStyle = reportStyle;
    state.save();
    
    const appCenterTitle = document.getElementById('app-center-title');
    if (appCenterTitle) appCenterTitle.innerText = state.systemConfig.centerName;
    
    showToast('تم حفظ إعدادات النظام والتقارير بنجاح', 'success');
    return true;
}

// إضافة حساب زبون جديد
function addUserAccount(username, displayName, password, permission) {
    const cleanUsername = username.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanPassword = password.trim();
    
    if (!cleanUsername || !cleanName || !cleanPassword) {
        showToast('الرجاء تعبئة كافة الحقول لحساب الزبون', 'danger');
        return false;
    }
    
    if (state.users[cleanUsername]) {
        showToast('اسم المستخدم هذا موجود بالفعل في النظام', 'warning');
        return false;
    }
    
    state.users[cleanUsername] = {
        username: cleanUsername,
        name: cleanName,
        role: 'customer',
        password: cleanPassword,
        permission: permission
    };
    state.save();
    
    renderUsersSettingsList();
    showToast(`تمت إضافة الحساب "${cleanName}" بنجاح`, 'success');
    return true;
}

// مسح حساب زبون
function deleteUserAccount(username) {
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername === 'admin') {
        showToast('لا يمكن حذف حساب الأدمن الرئيسي', 'danger');
        return false;
    }
    
    if (!state.users[cleanUsername]) return false;
    
    const displayName = state.users[cleanUsername].name;
    delete state.users[cleanUsername];
    state.save();
    
    renderUsersSettingsList();
    showToast(`تم مسح حساب "${displayName}" بنجاح`, 'success');
    return true;
}

// تحديث لوحة عرض الحسابات
function renderUsersSettingsList() {
    const tbody = document.getElementById('settings-users-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    Object.values(state.users).forEach(user => {
        const tr = document.createElement('tr');
        const isAdmin = user.role === 'admin';
        
        const permissionText = user.permission === 'view_only' 
            ? '<span class="tag tag-rejected">عرض فقط (صلاحية مقلصة)</span>'
            : '<span class="tag tag-approved">كامل الصلاحية للطلب</span>';
            
        tr.innerHTML = `
            <td style="font-weight:700;">${user.name} <code>(${user.username})</code></td>
            <td>${isAdmin ? '<span class="tag tag-store1">أدمن النظام</span>' : permissionText}</td>
            <td style="text-align:left;">
                ${isAdmin ? '-' : `
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="toggleUserPermission('${user.username}')">⇄ تعديل الصلاحية</button>
                        <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; background-color:var(--danger-bg); color:#fca5a5;" onclick="triggerDeleteUser('${user.username}')">مسح الحساب</button>
                    </div>
                `}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleUserPermission(username) {
    const user = state.users[username];
    if (!user || user.role === 'admin') return;
    
    user.permission = user.permission === 'view_only' ? 'full' : 'view_only';
    state.save();
    
    renderUsersSettingsList();
    showToast(`تم تعديل صلاحية حساب "${user.name}" إلى ${user.permission === 'view_only' ? 'عرض فقط' : 'صلاحية كاملة'}`, 'success');
}

function triggerDeleteUser(username) {
    const user = state.users[username];
    if (!user) return;
    
    if (confirm(`هل أنت متأكد من مسح حساب "${user.name}"؟ لن يتمكن من تسجيل الدخول مجدداً.`)) {
        deleteUserAccount(username);
    }
}

function submitAddUserForm() {
    const userIn = document.getElementById('new-user-username');
    const nameIn = document.getElementById('new-user-name');
    const passIn = document.getElementById('new-user-password');
    const permIn = document.getElementById('new-user-permission');
    
    const username = userIn.value;
    const name = nameIn.value;
    const password = passIn.value;
    const permission = permIn.value;
    
    if (addUserAccount(username, name, password, permission)) {
        userIn.value = '';
        nameIn.value = '';
        passIn.value = '';
    }
}

function submitSystemConfigForm() {
    const center = document.getElementById('config-center-name').value;
    const subtitle = document.getElementById('config-report-subtitle').value;
    const style = document.getElementById('config-report-style').value;
    
    if (saveSystemConfig(center, subtitle, style)) {
        closeModal('system-settings-modal');
    }
}

function openSystemSettingsModal() {
    document.getElementById('config-center-name').value = state.systemConfig.centerName;
    document.getElementById('config-report-subtitle').value = state.systemConfig.reportSubtitle;
    document.getElementById('config-report-style').value = state.systemConfig.reportStyle || 'blue';
    
    // تحميل إعدادات فتح القوائم الجانبية تلقائياً
    const openStoresSubmenuCheckbox = document.getElementById('config-open-stores-submenu');
    const openInvoicesSubmenuCheckbox = document.getElementById('config-open-invoices-submenu');
    const openOrdersSubmenuCheckbox = document.getElementById('config-open-orders-submenu');
    const openReportsSubmenuCheckbox = document.getElementById('config-open-reports-submenu');
    const openSubs = state.systemConfig.sidebarOpenSubmenus || ['stores-submenu', 'invoices-submenu', 'orders-submenu', 'reports-submenu'];
    
    if (openStoresSubmenuCheckbox) {
        openStoresSubmenuCheckbox.checked = openSubs.includes('stores-submenu');
    }
    if (openInvoicesSubmenuCheckbox) {
        openInvoicesSubmenuCheckbox.checked = openSubs.includes('invoices-submenu');
    }
    if (openOrdersSubmenuCheckbox) {
        openOrdersSubmenuCheckbox.checked = openSubs.includes('orders-submenu');
    }
    if (openReportsSubmenuCheckbox) {
        openReportsSubmenuCheckbox.checked = openSubs.includes('reports-submenu');
    }
    
    renderSidebarSettingsOrderList();
    renderUsersSettingsList();
    openModal('system-settings-modal');
}

// تصدير تقرير المخازن كـ PDF
// دوال مودال خيارات طباعة تقرير الجرد
function openPrintReportModal() {
    // تحديد المخزن النشط تلقائياً في خيار التحديد
    const activeTabBtn = document.querySelector('.tab-btn.active');
    const tabId = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'tab-store1';
    
    let defaultStore = 'all';
    let defaultType = 'inventory';
    
    if (tabId === 'tab-store1') defaultStore = 'store1';
    else if (tabId === 'tab-store2') defaultStore = 'store2';
    else if (tabId === 'tab-forecast') defaultType = 'forecast';

    const printTypeSelect = document.getElementById('print-report-type');
    if (printTypeSelect) {
        printTypeSelect.value = defaultType;
        togglePrintReportTypeFields();
    }

    const printStoreSelect = document.getElementById('print-store-filter');
    if (printStoreSelect) printStoreSelect.value = defaultStore;

    openModal('print-report-modal');
}
window.openPrintReportModal = openPrintReportModal;

function togglePrintReportTypeFields() {
    const type = document.getElementById('print-report-type').value;
    const filtersGroup = document.getElementById('print-inventory-filters-group');
    if (filtersGroup) {
        if (type === 'forecast') {
            filtersGroup.classList.add('hidden');
        } else {
            filtersGroup.classList.remove('hidden');
        }
    }
}
window.togglePrintReportTypeFields = togglePrintReportTypeFields;

function submitPrintReportForm() {
    const type = document.getElementById('print-report-type').value;
    const store = document.getElementById('print-store-filter').value;
    const source = document.getElementById('print-source-filter').value;
    const dateFrom = document.getElementById('print-date-from').value;
    const dateTo = document.getElementById('print-date-to').value;
    const format = document.getElementById('print-export-format').value;
    
    closeModal('print-report-modal');
    if (format === 'excel') {
        exportExcelReport(type, store, source, dateFrom, dateTo);
    } else {
        exportPDFReport(type, store, source, dateFrom, dateTo);
    }
}
window.submitPrintReportForm = submitPrintReportForm;

// تصدير تقرير المخازن كـ Excel (تنسيق HTML XML متوافق بنسبة 100% مع أوفيس إكسل)
function exportExcelReport(reportType = 'inventory', storeFilter = 'all', sourceFilter = 'الكل', dateFrom = null, dateTo = null) {
    const today = new Date().toISOString().split('T')[0];
    const type = reportType || 'inventory';
    const targetStore = storeFilter || 'all';
    const targetSource = sourceFilter || 'الكل';
    
    let items = [];
    let reportTitle = '';
    
    if (type === 'forecast') {
        reportTitle = 'تقرير تخمين صرفيات وهدر صلاحيات المواد';
        const forecastData = getForecastData();
        items = forecastData.map(f => ({
            name: f.name,
            batchNumber: f.batchNumber,
            category: f.category,
            expiryDate: f.expiryDate,
            quantity: f.quantity,
            storeInfo: f.store === 'store1' ? 'مخزن 1' : 'مخزن 2',
            sourceType: f.sourceType || 'عامة',
            monthlyConsumption: f.monthlyConsumption,
            verdict: f.verdict,
            statusClass: f.statusClass,
            expectedWaste: f.expectedWaste
        }));

        // تطبيق فلترة حالة التخمين
        const statusFilter = document.getElementById('forecast-status-filter');
        if (statusFilter && statusFilter.value !== 'all') {
            items = items.filter(f => f.statusClass === statusFilter.value);
        }
    } else {
        if (targetStore === 'store1') {
            reportTitle = 'تقرير جرد المستودع الرئيسي (مخزن رقم 1)';
            items = state.materials.filter(m => m.store === 'store1');
        } else if (targetStore === 'store2') {
            reportTitle = 'تقرير جرد مستودع الصرف (مخزن رقم 2)';
            items = state.materials.filter(m => m.store === 'store2');
        } else {
            reportTitle = 'تقرير الجرد العام والمجموع الكلي للمواد (مخازن 1 + 2)';
            items = state.materials;
        }

        // تطبيق التصفية حسب مصدر التوريد
        if (targetSource !== 'الكل') {
            items = items.filter(m => (m.sourceType || 'عامة') === targetSource);
        }
    }
    
    // تطبيق تصفية تواريخ الصلاحية (من - إلى)
    if (dateFrom) {
        items = items.filter(m => m.expiryDate >= dateFrom);
    }
    if (dateTo) {
        items = items.filter(m => m.expiryDate <= dateTo);
    }
    
    // تطبيق الفلتر الحالي للتصنيفات
    if (currentAdminCategoryFilter !== 'all') {
        items = items.filter(m => m.category === currentAdminCategoryFilter);
    }
    
    // تصفية المواد ذات الكميات الموجبة (إلا إذا كان في تقرير التخمين)
    if (type !== 'forecast') {
        items = items.filter(m => m.quantity > 0);
    }
    
    // تطبيق الترتيب والفرز الحالي النشط في لوحة التحكم
    items = sortItems(items, currentAdminSortMode);

    // بناء محتوى ملف الـ Excel بصيغة HTML XML
    let tableHtml = "";
    
    if (type === 'forecast') {
        tableHtml = `
            <thead>
                <tr style="background-color: #1e3a8a; color: #ffffff; font-weight: bold;">
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">اسم المادة الطبية</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">رقم التشغيلة (الباج)</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">التصنيف</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">تاريخ الصلاحية</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">المخزن</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">الكمية</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">الاستهلاك الشهري المتوقع</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">حالة الهدر</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">الهدر المتوقع</th>
                </tr>
            </thead>
            <tbody>
        `;
        items.forEach(item => {
            tableHtml += `
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.name}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${item.batchNumber}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.category}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${item.expiryDate}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.storeInfo}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${item.quantity}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${item.monthlyConsumption}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.verdict}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${item.expectedWaste}</td>
                </tr>
            `;
        });
        tableHtml += '</tbody>';
    } else {
        tableHtml = `
            <thead>
                <tr style="background-color: #1e3a8a; color: #ffffff; font-weight: bold;">
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">اسم المادة الطبية</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">الشركة المصنعة</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">رقم التشغيلة (الباج)</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">تاريخ الصلاحية</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">المخزن</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">سعر المفرد (د.ع)</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">الكمية المتوفرة</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px;">إجمالي القيمة (د.ع)</th>
                </tr>
            </thead>
            <tbody>
        `;
        items.forEach(item => {
            const storeText = item.store === 'store1' ? 'مخزن 1' : 'مخزن 2';
            const totalVal = item.quantity * (item.price || 0);
            tableHtml += `
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${item.name}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.company || ''}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${item.batchNumber}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${item.expiryDate}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${storeText}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">${(item.price || 0).toLocaleString('en-US')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${item.quantity}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: bold; color: #16a34a;">${totalVal.toLocaleString('en-US')}</td>
                </tr>
            `;
        });
        tableHtml += '</tbody>';
    }

    const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>تقرير جرد المخازن</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; }
                table { border-collapse: collapse; width: 100%; direction: rtl; }
                th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: center; }
                td { border: 1px solid #cbd5e1; padding: 8px; }
            </style>
        </head>
        <body>
            <h2 style="text-align: center; color: #1e3a8a;">${reportTitle}</h2>
            <p style="text-align: center; color: #475569;">تاريخ التصدير: ${today}</p>
            <table>
                ${tableHtml}
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(["\uFEFF" + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement("a");
    const filename = `${reportTitle.replace(/\s+/g, '_')}_${today}.xls`;
    
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`تم تصدير وتنزيل ملف Excel بنجاح: ${filename}`, 'success');
}
window.exportExcelReport = exportExcelReport;

// تصدير تقرير المخازن كـ PDF
function exportPDFReport(reportType = null, storeFilter = null, sourceFilter = null, dateFrom = null, dateTo = null) {
    if (reportType === null && storeFilter === null && sourceFilter === null) {
        openPrintReportModal();
        return;
    }

    const today = new Date().toLocaleDateString('ar-EG');
    const type = reportType || 'inventory';
    const targetStore = storeFilter || 'all';
    const targetSource = sourceFilter || 'الكل';
    
    let reportTitle = '';
    let items = [];
    
    if (type === 'forecast') {
        reportTitle = 'تقرير تخمين صرفيات وهدر صلاحيات المواد';
        const forecastData = getForecastData();
        items = forecastData.map(f => ({
            name: f.name,
            batchNumber: f.batchNumber,
            category: f.category,
            expiryDate: f.expiryDate,
            quantity: f.quantity,
            storeInfo: f.store === 'store1' ? 'مخزن 1' : 'مخزن 2',
            sourceType: f.sourceType || 'عامة',
            monthlyConsumption: f.monthlyConsumption,
            verdict: f.verdict,
            statusClass: f.statusClass,
            expectedWaste: f.expectedWaste
        }));

        // تطبيق فلترة حالة التخمين
        const statusFilter = document.getElementById('forecast-status-filter');
        if (statusFilter && statusFilter.value !== 'all') {
            items = items.filter(f => f.statusClass === statusFilter.value);
            const statusText = statusFilter.options[statusFilter.selectedIndex].text;
            reportTitle += ` - حالة: ${statusText}`;
        }
    } else {
        if (targetStore === 'store1') {
            reportTitle = 'تقرير جرد المستودع الرئيسي (مخزن رقم 1)';
            items = state.materials.filter(m => m.store === 'store1');
        } else if (targetStore === 'store2') {
            reportTitle = 'تقرير جرد مستودع الصرف (مخزن رقم 2)';
            items = state.materials.filter(m => m.store === 'store2');
        } else {
            reportTitle = 'تقرير الجرد العام والمجموع الكلي للمواد (مخازن 1 + 2)';
            items = state.materials;
        }

        // تطبيق التصفية حسب مصدر التوريد (مشتريات، عامة، فاتورة)
        if (targetSource !== 'الكل') {
            items = items.filter(m => (m.sourceType || 'عامة') === targetSource);
            reportTitle += ` - مصدر: ${targetSource}`;
        }
    }
    
    // تطبيق تصفية تواريخ الصلاحية (من - إلى)
    if (dateFrom) {
        items = items.filter(m => m.expiryDate >= dateFrom);
    }
    if (dateTo) {
        items = items.filter(m => m.expiryDate <= dateTo);
    }
    if (dateFrom || dateTo) {
        let dateRangeStr = '';
        if (dateFrom && dateTo) {
            dateRangeStr = `صلاحية بين ${dateFrom} و ${dateTo}`;
        } else if (dateFrom) {
            dateRangeStr = `صلاحية تبدأ من ${dateFrom}`;
        } else {
            dateRangeStr = `صلاحية تنتهي قبل ${dateTo}`;
        }
        reportTitle += ` (${dateRangeStr})`;
    }
    
    // تطبيق الفلتر الحالي للتصنيفات
    if (currentAdminCategoryFilter !== 'all') {
        items = items.filter(m => m.category === currentAdminCategoryFilter);
        reportTitle += ` - تصنيف: ${currentAdminCategoryFilter}`;
    }
    
    // تصفية المواد ذات الكميات الموجبة (إلا إذا كان في تقرير التخمين)
    if (type !== 'forecast') {
        items = items.filter(m => m.quantity > 0);
    }
    
    // تطبيق الترتيب والفرز الحالي النشط في لوحة التحكم
    items = sortItems(items, currentAdminSortMode);

    const reportTotalValue = items.reduce((sum, m) => sum + m.quantity * (m.price || 0), 0);
    
    // إعدادات ألوان شكل التقرير المختار
    let primaryColor = '#3b82f6';
    let headerColor = '#1e3a8a';
    let headerBg = '#f1f5f9';
    let healingText = '#2563eb';
    
    const styleChoice = state.systemConfig.reportStyle || 'blue';
    if (styleChoice === 'slate') {
        primaryColor = '#475569';
        headerColor = '#1e293b';
        headerBg = '#e2e8f0';
        healingText = '#475569';
    } else if (styleChoice === 'teal') {
        primaryColor = '#0d9488';
        headerColor = '#0f766e';
        headerBg = '#f0fdfa';
        healingText = '#0d9488';
    }

    const printWindow = window.open('', '_blank');
    
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let categoriesHtml = '';
    let catIndex = 0;
    
    // تصنيفات التقرير الحالية
    const reportCategories = currentAdminCategoryFilter !== 'all' 
        ? [currentAdminCategoryFilter] 
        : state.categories;
        
    reportCategories.forEach(cat => {
        let catItems = items.filter(m => (m.category || 'أخرى') === cat);
        if (catItems.length === 0) return; // تخطي التصنيفات الفارغة
        
        // تطبيق نفس الفرز المختار للوحة التحكم داخل التقرير المطبوع
        catItems = sortItems(catItems, currentAdminSortMode);
        
        const prefix = alphabet[catIndex % 26];
        catIndex++;
        
        let rowsHtml = '';
        if (type === 'forecast') {
            rowsHtml = catItems.map((m, idx) => {
                const verdictStyle = m.statusClass === 'success' ? 'color:#16a34a; font-weight:600;' 
                                   : m.statusClass === 'danger' ? 'color:#dc2626; font-weight:600;' 
                                   : 'color:#d97706; font-weight:600;';
                return `
                    <tr>
                        <td style="width: 5%; text-align: center;">${idx + 1}</td>
                        <td style="width: 25%; font-weight: bold;">${m.name}</td>
                        <td style="width: 12%;"><code>${m.batchNumber}</code></td>
                        <td style="width: 10%; text-align: center;">${m.storeInfo}</td>
                        <td style="width: 10%; text-align: center; font-weight: bold; color: #2563eb;">${m.quantity} قطعة</td>
                        <td style="width: 13%; text-align: center; color: #475569;">${m.expiryDate}</td>
                        <td style="width: 10%; text-align: center; font-weight: 600;">${m.monthlyConsumption} ق/شهر</td>
                        <td style="width: 15%; ${verdictStyle}">
                            ${m.verdict}
                            ${m.expectedWaste > 0 ? `<div style="font-size:0.75rem; color:#dc2626;">(الهدر المتوقع: ${m.expectedWaste} ق)</div>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            rowsHtml = catItems.map((m, idx) => {
                const uPrice = m.price || 0;
                const tPrice = m.quantity * uPrice;
                return `
                    <tr>
                        <td style="width: 5%; text-align: center;">${idx + 1}</td>
                        <td style="width: 35%; font-weight: bold;">${m.name}</td>
                        <td style="width: 12%;"><code>${m.batchNumber}</code></td>
                        <td style="width: 13%; color: #b91c1c; font-weight: 600;">${m.expiryDate}</td>
                        <td style="width: 10%; color: #15803d; font-weight: bold; text-align: center; font-size: 13px;">${m.quantity}</td>
                        <td style="width: 12%; text-align: center;">${uPrice.toLocaleString('ar-EG')} د.ع</td>
                        <td style="width: 13%; color: #15803d; font-weight: bold; text-align: center;">${tPrice.toLocaleString('ar-EG')} د.ع</td>
                    </tr>
                `;
            }).join('');
        }

        const tableHeader = type === 'forecast' ? `
            <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 25%;">إسم المادة</th>
                <th style="width: 12%;">الباج</th>
                <th style="width: 10%; text-align: center;">المخزن</th>
                <th style="width: 10%; text-align: center;">الكمية الحالية</th>
                <th style="width: 13%; text-align: center;">تاريخ الاكسباير</th>
                <th style="width: 10%; text-align: center;">معدل الاستهلاك الفعلي</th>
                <th style="width: 15%;">تخمين حالة الهدر والصلاحية</th>
            </tr>
        ` : `
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 35%;">إسم المادة الطبية</th>
                <th style="width: 12%;">رقم التشغيلة (الباج)</th>
                <th style="width: 13%; color: #b91c1c; font-weight: bold;">تاريخ الاكسباير</th>
                <th style="width: 10%; color: #15803d; font-weight: bold; text-align: center;">العدد المتوفر</th>
                <th style="width: 12%; text-align: center;">سعر المفرد</th>
                <th style="width: 13%; text-align: center; color: #15803d; font-weight: bold;">القيمة الكلية</th>
            </tr>
        `;
        
        categoriesHtml += `
            <div class="category-section" style="margin-bottom: 12px; page-break-inside: avoid;">
                <h3 class="category-title" style="margin: 8px 0 4px 0; font-size: 12px; color: ${headerColor}; background-color: ${headerBg}; padding: 4px 8px; border-right: 3px solid ${primaryColor}; border-radius: 3px; display: flex; justify-content: space-between;">
                    <span>${prefix}. ${cat}</span>
                    <span style="font-size:0.75rem; color:#475569; font-weight:normal;">المواد المدرجة: ${catItems.length}</span>
                </h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 3px;">
                    <thead>
                        ${tableHeader}
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    });

    if (catIndex === 0) {
        categoriesHtml = `<div style="text-align:center; padding:30px; color:#64748b; font-size:14px; border:1px dashed #cbd5e1; border-radius:6px;">لا توجد مواد في هذا القسم تطابق خيارات التصفية حالياً</div>`;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${reportTitle}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                body {
                    font-family: 'Cairo', sans-serif;
                    padding: 15px 25px;
                    color: #1e293b;
                    background-color: #ffffff;
                    direction: rtl;
                    font-size: 11px;
                    line-height: 1.25;
                }
                .header {
                    text-align: center;
                    margin-bottom: 15px;
                    border-bottom: 2px solid ${primaryColor};
                    padding-bottom: 10px;
                }
                .header h1 {
                    margin: 0 0 3px 0;
                    font-size: 18px;
                    color: ${headerColor};
                }
                .header h2 {
                    margin: 0 0 4px 0;
                    font-size: 13px;
                    color: #475569;
                    font-weight: normal;
                }
                .header p {
                    margin: 3px 0;
                    color: ${healingText};
                    font-size: 13px;
                    font-weight: bold;
                }
                .meta-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 15px;
                    font-size: 10px;
                    color: #475569;
                    background-color: #f8fafc;
                    padding: 6px 12px;
                    border-radius: 5px;
                    border: 1px solid #e2e8f0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: 6px 8px;
                    text-align: right;
                    font-size: 11px;
                }
                th {
                    background-color: #f1f5f9;
                    color: #0f172a;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                .signature-section {
                    margin-top: 25px;
                    display: flex;
                    justify-content: space-between;
                    padding: 0 30px;
                    font-size: 10px;
                }
                .signature-box {
                    text-align: center;
                    width: 150px;
                }
                .signature-line {
                    margin-top: 25px;
                    border-top: 1px solid #475569;
                }
                .footer {
                    margin-top: 20px;
                    text-align: center;
                    font-size: 9px;
                    color: #94a3b8;
                    border-top: 1px dashed #cbd5e1;
                    padding-top: 6px;
                }
                @media print {
                    body { padding: 0; margin: 0; }
                    .category-section { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${state.systemConfig.centerName}</h1>
                <h2>${state.systemConfig.reportSubtitle}</h2>
                <p>${reportTitle}</p>
            </div>
            
            <div class="meta-info">
                <div>تاريخ سحب التقرير: <strong>${today}</strong></div>
                <div>الجهة المصدرة: <strong>شعبة جرد المخازن الطبية</strong></div>
                <div>نوع المستند: <strong>تقرير جرد مصنف (PDF)</strong></div>
                <div>المصدر المشمول بالجرد: <strong>${targetSource}</strong></div>
                ${currentAdminSortMode !== 'none' ? `<div>ترتيب البنود: <strong>${
                    currentAdminSortMode === 'name-asc' ? 'أبجدي (أ - ي)' : 
                    currentAdminSortMode === 'name-desc' ? 'أبجدي (ي - أ)' : 
                    currentAdminSortMode === 'qty-desc' ? 'حسب الكمية (الأكثر للأقل)' : 
                    'حسب الكمية (الأقل للأكثر)'
                }</strong></div>` : ''}
            </div>
            
            <div class="report-content">
                ${categoriesHtml}
            </div>
            
            ${type !== 'forecast' ? `
            <div style="margin-top: 15px; padding: 10px 15px; background-color: ${headerBg}; border: 1px solid ${primaryColor}; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <span style="font-size: 11px; font-weight: bold; color: ${headerColor};">إجمالي القيمة المالية للمواد المشمولة بالجرد أعلاه:</span>
                <span style="font-size: 13px; font-weight: 800; color: #15803d;">${reportTotalValue.toLocaleString('ar-EG')} دينار عراقي (د.ع)</span>
            </div>
            ` : ''}
            
            <div class="signature-section">
                <div class="signature-box">
                    <p>توقيع أمين المخزن المختص</p>
                    <div class="signature-line"></div>
                </div>
                <div class="signature-box">
                    <p>توقيع مدير قسم المخازن الطبية</p>
                    <div class="signature-line"></div>
                </div>
            </div>
            
            <div class="footer">
                <p>تم توليد هذا التقرير تلقائياً بواسطة نظام إدارة مخازن القسطرة التخصصي. تاريخ الإصدار: ${new Date().toLocaleString('ar-EG')}</p>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function switchSettingsTab(event, subtabId) {
    document.querySelectorAll('.settings-subtab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const target = document.getElementById(subtabId);
    if (target) target.classList.remove('hidden');
    
    event.currentTarget.parentElement.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.currentTarget.classList.add('active');
}

let selectedMaterialIdForEdit = null;
function openEditMaterialModal(id) {
    selectedMaterialIdForEdit = id;
    const mat = state.materials.find(m => m.id === id);
    if (!mat) return;
    
    document.getElementById('edit-id').value = mat.id;
    document.getElementById('edit-name').value = mat.name;
    document.getElementById('edit-batch').value = mat.batchNumber;
    document.getElementById('edit-expiry').value = mat.expiryDate;
    document.getElementById('edit-qty').value = mat.quantity;
    document.getElementById('edit-company').value = mat.company;
    document.getElementById('edit-store-select').value = mat.store;
    document.getElementById('edit-source-select').value = mat.sourceType || 'عامة';
    document.getElementById('edit-price').value = mat.price || 0;
    
    renderCategorySelectDropdown();
    
    // تأمين اختيار التصنيف: إذا كان تصنيف المادة غير موجود في القائمة الحالية، نقوم بإضافته مؤقتاً كخيار في القائمة لمنع الفشل والسماح بالتعديل والحفظ
    const editSelect = document.getElementById('edit-category-select');
    if (editSelect) {
        const hasOption = Array.from(editSelect.options).some(opt => opt.value === mat.category);
        if (!hasOption && mat.category) {
            const opt = document.createElement('option');
            opt.value = mat.category;
            opt.innerText = mat.category;
            editSelect.appendChild(opt);
        }
    }
    
    document.getElementById('edit-category-select').value = mat.category || 'أخرى';
    
    openModal('edit-material-modal');
}

function submitEditMaterialForm() {
    const id = document.getElementById('edit-id').value;
    const name = document.getElementById('edit-name').value;
    const batch = document.getElementById('edit-batch').value;
    const expiry = document.getElementById('edit-expiry').value;
    const qty = parseInt(document.getElementById('edit-qty').value);
    const company = document.getElementById('edit-company').value;
    const store = document.getElementById('edit-store-select').value;
    const category = document.getElementById('edit-category-select').value;
    const source = document.getElementById('edit-source-select').value;
    const price = parseFloat(document.getElementById('edit-price').value) || 0;
    
    if (!name || !batch || !expiry || isNaN(qty) || qty < 0 || !company || !category || !source || isNaN(price) || price < 0) {
        showToast('الرجاء تعبئة كافة الحقول بشكل صحيح', 'danger');
        return;
    }
    
    if (editMaterial(id, name, batch, expiry, qty, company, store, category, source, price)) {
        closeModal('edit-material-modal');
        renderAdminDashboard();
        if (typeof renderSystemMaterialsTable === 'function') {
            renderSystemMaterialsTable();
        }
    }
}

function triggerDeleteMaterial(id) {
    const mat = state.materials.find(m => m.id === id);
    if (!mat) return;
    
    if (confirm(`هل أنت متأكد من حذف المادة "${mat.name}" (دفعة: ${mat.batchNumber}) نهائياً من المخازن؟`)) {
        if (deleteMaterial(id)) {
            renderAdminDashboard();
        }
    }
}

// تصدير للـ window لتسهيل الاستدعاء
window.setAdminCategoryFilter = setAdminCategoryFilter;
window.setCustomerCategoryFilter = setCustomerCategoryFilter;
window.addNewCategory = addNewCategory;
window.removeCategory = removeCategory;
window.openCategoriesSettingsModal = openCategoriesSettingsModal;
window.submitAddCategoryForm = submitAddCategoryForm;
window.triggerEditCategoryName = triggerEditCategoryName;
window.triggerDeleteCategory = triggerDeleteCategory;
window.exportPDFReport = exportPDFReport;
window.openSystemSettingsModal = openSystemSettingsModal;
window.submitSystemConfigForm = submitSystemConfigForm;
window.submitAddUserForm = submitAddUserForm;
window.triggerDeleteUser = triggerDeleteUser;
window.toggleUserPermission = toggleUserPermission;
window.switchSettingsTab = switchSettingsTab;
window.openEditMaterialModal = openEditMaterialModal;
window.submitEditMaterialForm = submitEditMaterialForm;
window.triggerDeleteMaterial = triggerDeleteMaterial;
window.openOrderModalFor = openOrderModalFor;
window.submitCustomerOrderForm = submitCustomerOrderForm;
window.generateCustomerOrderPDFById = generateCustomerOrderPDFById;
window.resendOrderToWhatsApp = resendOrderToWhatsApp;
window.updateOrderItemQty = updateOrderItemQty;
window.deleteOrderItem = deleteOrderItem;
window.deleteEntireOrder = deleteEntireOrder;
window.deleteEntireOrderAdmin = deleteEntireOrderAdmin;
window.removeFromCart = removeFromCart;
window.updateCartQty = updateCartQty;
window.checkoutCart = checkoutCart;

// دالة لتطبيق الفرز وتحديث الجداول
function triggerAdminSort() {
    const select = document.getElementById('admin-sort-select');
    if (select) {
        currentAdminSortMode = select.value;
        renderAdminDashboard();
    }
}
window.triggerAdminSort = triggerAdminSort;

// دوال تطبيق فلترة التصنيفات من القوائم المنسدلة
function triggerAdminCategorySelectFilter() {
    const select = document.getElementById('admin-category-select-filter');
    if (select) {
        setAdminCategoryFilter(select.value);
    }
}
window.triggerAdminCategorySelectFilter = triggerAdminCategorySelectFilter;

function triggerCustomerCategorySelectFilter() {
    const select = document.getElementById('customer-category-select-filter');
    if (select) {
        setCustomerCategoryFilter(select.value);
    }
}
window.triggerCustomerCategorySelectFilter = triggerCustomerCategorySelectFilter;

// دالة للتحكم بالقوائم الفرعية الجانبية المنسدلة
function toggleSubmenu(id) {
    const submenu = document.getElementById(id);
    if (!submenu) return;
    
    const toggleBtn = submenu.previousElementSibling;
    submenu.classList.toggle('collapsed');
    
    if (toggleBtn) {
        toggleBtn.classList.toggle('active');
    }
}
window.toggleSubmenu = toggleSubmenu;

// دالة لرسم القائمة الجانبية للأدمن ديناميكياً بناءً على الترتيب المختار
function renderAdminSidebarMenu() {
    const adminMenu = document.getElementById('admin-sidebar-menu');
    if (!adminMenu) return;

    // الحصول على التبويب النشط الحالي للمحافظة عليه
    let activeTab = 'tab-store1';
    const activePane = document.querySelector('.tab-pane.active');
    if (activePane) {
        activeTab = activePane.id;
    }

    // التحقق من حالة فتح القائمة الفرعية للمخازن والطلبيات والتقارير (يدوياً أو كافتراضي)
    let isStoresOpen = state.systemConfig.sidebarOpenSubmenus ? state.systemConfig.sidebarOpenSubmenus.includes('stores-submenu') : true;
    const currentStoresSubmenu = document.getElementById('stores-submenu');
    if (currentStoresSubmenu) {
        isStoresOpen = !currentStoresSubmenu.classList.contains('collapsed');
    }

    let isOrdersOpen = state.systemConfig.sidebarOpenSubmenus ? state.systemConfig.sidebarOpenSubmenus.includes('orders-submenu') : true;
    const currentOrdersSubmenu = document.getElementById('orders-submenu');
    if (currentOrdersSubmenu) {
        isOrdersOpen = !currentOrdersSubmenu.classList.contains('collapsed');
    }

    let isReportsOpen = state.systemConfig.sidebarOpenSubmenus ? state.systemConfig.sidebarOpenSubmenus.includes('reports-submenu') : true;
    const currentReportsSubmenu = document.getElementById('reports-submenu');
    if (currentReportsSubmenu) {
        isReportsOpen = !currentReportsSubmenu.classList.contains('collapsed');
    }

    let isInvoicesOpen = state.systemConfig.sidebarOpenSubmenus ? state.systemConfig.sidebarOpenSubmenus.includes('invoices-submenu') : true;
    const currentInvoicesSubmenu = document.getElementById('invoices-submenu');
    if (currentInvoicesSubmenu) {
        isInvoicesOpen = !currentInvoicesSubmenu.classList.contains('collapsed');
    }

    const pendingCount = state.orders.filter(o => o.status === 'pending').length;

    adminMenu.innerHTML = '';
    let order = state.systemConfig.sidebarOrder ? [...state.systemConfig.sidebarOrder] : ['stores', 'invoices', 'orders', 'reports', 'settings'];
    if (!order.includes('invoices')) {
        const storesIdx = order.indexOf('stores');
        if (storesIdx !== -1) {
            order.splice(storesIdx + 1, 0, 'invoices');
        } else {
            order.unshift('invoices');
        }
    }

    order.forEach(key => {
        if (key === 'stores') {
            const div = document.createElement('div');
            div.className = 'menu-group';
            div.innerHTML = `
                <ul class="menu-list">
                    <li>
                        <button class="menu-item submenu-toggle ${isStoresOpen ? 'active' : ''}" onclick="toggleSubmenu('stores-submenu')">
                            <span class="menu-icon">🏢</span>
                            <span class="menu-text">المخازن والمستودعات</span>
                            <span class="submenu-arrow">▼</span>
                        </button>
                        <ul id="stores-submenu" class="submenu-list ${isStoresOpen ? '' : 'collapsed'}">
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-store1' ? 'active' : ''}" data-tab="tab-store1">
                                    <span class="menu-icon">🏦</span>
                                    <span class="menu-text">مخزن رقم 1 (الرئيسي)</span>
                                </button>
                            </li>
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-store2' ? 'active' : ''}" data-tab="tab-store2">
                                    <span class="menu-icon">🏬</span>
                                    <span class="menu-text">مخزن رقم 2 (الصرف)</span>
                                </button>
                            </li>
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-grand-total' ? 'active' : ''}" data-tab="tab-grand-total">
                                    <span class="menu-icon">📦</span>
                                    <span class="menu-text">المجموع الكلي للمواد</span>
                                </button>
                            </li>
                        </ul>
                    </li>
                </ul>
            `;
            adminMenu.appendChild(div);
        } else if (key === 'invoices') {
            const divInvoices = document.createElement('div');
            divInvoices.className = 'menu-group';

            let invoicesListHtml = '';
            if (state.Invoices && state.Invoices.length > 0) {
                invoicesListHtml = `
                    <div style="padding: 6px 10px 2px; font-size: 0.72rem; color: var(--text-secondary); border-top: 1px dashed var(--border-color); margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <span>قائمة الفواتير</span>
                        <span class="badge" style="font-size:0.65rem; background: var(--bg-tertiary);">${state.Invoices.length}</span>
                    </div>
                    <div class="invoices-sub-container">
                        ${state.Invoices.map(inv => {
                            const isDraft = inv.status === 'draft';
                            const supplier = inv.supplier_name || 'توريد';
                            const invNum = inv.invoice_number ? `#${inv.invoice_number}` : inv.id.slice(-5);
                            return `
                                <button type="button" class="menu-item invoice-sub-btn" onclick="openInvoiceDirectly('${inv.id}')" title="فتح فاتورة ${invNum} (${supplier})">
                                    <span class="menu-icon" style="font-size: 0.85rem;">${isDraft ? '📝' : '📄'}</span>
                                    <div class="menu-text" style="display: flex; flex-direction: column; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; text-align: right; line-height: 1.2;">
                                        <span style="font-weight: 700; font-size: 0.78rem;">فاتورة ${invNum}</span>
                                        <span style="font-size: 0.68rem; color: var(--text-secondary);">${supplier} • ${inv.date}</span>
                                    </div>
                                    <span class="tag ${inv.status}" style="font-size: 0.65rem; padding: 1px 4px; margin-right: auto;">
                                        ${isDraft ? 'مسودة' : 'معتمد'}
                                    </span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                invoicesListHtml = `
                    <div style="padding: 6px 12px; font-size: 0.75rem; color: var(--text-secondary); text-align: center;">
                        لا توجد فواتير مسجلة بعد
                    </div>
                `;
            }

            divInvoices.innerHTML = `
                <ul class="menu-list">
                    <li>
                        <button class="menu-item submenu-toggle ${isInvoicesOpen ? 'active' : ''}" onclick="toggleSubmenu('invoices-submenu')">
                            <span class="menu-icon">🧾</span>
                            <span class="menu-text">الفواتير وقوائم التوريد</span>
                            <span class="submenu-arrow">▼</span>
                        </button>
                        <ul id="invoices-submenu" class="submenu-list ${isInvoicesOpen ? '' : 'collapsed'}">
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-add-material' ? 'active' : ''}" data-tab="tab-add-material">
                                    <span class="menu-icon">➕</span>
                                    <span class="menu-text">إنشاء فاتورة جديدة</span>
                                </button>
                            </li>
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-saved-receipts' ? 'active' : ''}" data-tab="tab-saved-receipts">
                                    <span class="menu-icon">📋</span>
                                    <span class="menu-text">جميع الفواتير المحفوظة</span>
                                </button>
                            </li>
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-system-materials' ? 'active' : ''}" data-tab="tab-system-materials">
                                    <span class="menu-icon">📦</span>
                                    <span class="menu-text">تفاصيل المواد المدخلة</span>
                                </button>
                            </li>
                            ${invoicesListHtml}
                        </ul>
                    </li>
                </ul>
            `;
            adminMenu.appendChild(divInvoices);
        } else if (key === 'orders') {
            const div = document.createElement('div');
            div.className = 'menu-group';
            div.innerHTML = `
                <ul class="menu-list">
                    <li>
                        <button class="menu-item submenu-toggle ${isOrdersOpen ? 'active' : ''}" onclick="toggleSubmenu('orders-submenu')">
                            <span class="menu-icon">📥</span>
                            <span class="menu-text">طلبيات الزبائن</span>
                            <span class="submenu-arrow">▼</span>
                        </button>
                        <ul id="orders-submenu" class="submenu-list ${isOrdersOpen ? '' : 'collapsed'}">
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-orders' && currentAdminOrdersFilter === 'all' ? 'active' : ''}" data-tab="tab-orders" onclick="setAdminOrdersFilter('all')">
                                    <span class="menu-icon">📋</span>
                                    <span class="menu-text">كل الطلبيات</span>
                                </button>
                            </li>
                            <li>
                                <button class="menu-item tab-btn icon-badge ${activeTab === 'tab-orders' && currentAdminOrdersFilter === 'pending' ? 'active' : ''}" data-tab="tab-orders" onclick="setAdminOrdersFilter('pending')">
                                    <span class="menu-icon">⏳</span>
                                    <span class="menu-text">الطلبات المعلقة</span>
                                    <span id="alert-bell-badge" class="badge-count ${pendingCount > 0 ? '' : 'hidden'}">${pendingCount}</span>
                                </button>
                            </li>
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-orders' && currentAdminOrdersFilter === 'completed' ? 'active' : ''}" data-tab="tab-orders" onclick="setAdminOrdersFilter('completed')">
                                    <span class="menu-icon">✅</span>
                                    <span class="menu-text">الطلبيات المكتملة</span>
                                </button>
                            </li>
                        </ul>
                    </li>
                </ul>
            `;
            adminMenu.appendChild(div);
        } else if (key === 'reports') {
            const div = document.createElement('div');
            div.className = 'menu-group';
            div.innerHTML = `
                <ul class="menu-list">
                    <li>
                        <button class="menu-item submenu-toggle ${isReportsOpen ? 'active' : ''}" onclick="toggleSubmenu('reports-submenu')">
                            <span class="menu-icon">📊</span>
                            <span class="menu-text">التقارير والإحصائيات</span>
                            <span class="submenu-arrow">▼</span>
                        </button>
                        <ul id="reports-submenu" class="submenu-list ${isReportsOpen ? '' : 'collapsed'}">
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-issue-reports' ? 'active' : ''}" data-tab="tab-issue-reports" onclick="onOpenIssueReportsTab()">
                                    <span class="menu-icon">📋</span>
                                    <span class="menu-text">تقارير صرف المواد</span>
                                </button>
                            </li>
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-transactions' ? 'active' : ''}" data-tab="tab-transactions">
                                    <span class="menu-icon">⏳</span>
                                    <span class="menu-text">سجل الحركة والتاريخ</span>
                                </button>
                            </li>
                            <li>
                                <button class="menu-item tab-btn ${activeTab === 'tab-forecast' ? 'active' : ''}" data-tab="tab-forecast">
                                    <span class="menu-icon">🤖</span>
                                    <span class="menu-text">تخمين صرفيات المواد</span>
                                </button>
                            </li>
                            <li>
                                <button class="menu-item" onclick="exportPDFReport()">
                                    <span class="menu-icon">🖨️</span>
                                    <span class="menu-text">طباعة تقرير PDF</span>
                                </button>
                            </li>
                        </ul>
                    </li>
                </ul>
            `;
            adminMenu.appendChild(div);
        } else if (key === 'settings') {
            const div = document.createElement('div');
            div.className = 'menu-group';
            div.innerHTML = `
                <ul class="menu-list">
                    <li>
                        <button class="menu-item" onclick="openCategoriesSettingsModal()">
                            <span class="menu-icon">🏷️</span>
                            <span class="menu-text">إدارة التصنيفات</span>
                        </button>
                    </li>
                    <li>
                        <button class="menu-item" id="btn-system-settings" onclick="openSystemSettingsModal()" style="margin-top: 4px;">
                            <span class="menu-icon">⚙️</span>
                            <span class="menu-text">الإعدادات العامة</span>
                        </button>
                    </li>
                </ul>
            `;
            adminMenu.appendChild(div);
        }
    });

    setupTabs();
}
window.renderAdminSidebarMenu = renderAdminSidebarMenu;

// دالة لرسم قائمة تخصيص ترتيب القائمة الجانبية داخل الإعدادات
function renderSidebarSettingsOrderList() {
    const listContainer = document.getElementById('sidebar-order-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    let order = state.systemConfig.sidebarOrder ? [...state.systemConfig.sidebarOrder] : ['stores', 'invoices', 'orders', 'reports', 'settings'];
    if (!order.includes('invoices')) {
        const storesIdx = order.indexOf('stores');
        if (storesIdx !== -1) order.splice(storesIdx + 1, 0, 'invoices');
        else order.unshift('invoices');
    }
    
    const titles = {
        'stores': '🏢 المخازن والمستودعات',
        'invoices': '🧾 الفواتير وقوائم التوريد',
        'orders': '📥 طلبيات الزبائن',
        'reports': '📊 التقارير والإحصائيات',
        'settings': '⚙️ إعدادات النظام'
    };

    order.forEach((key, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); padding:10px 15px; border-radius:6px; border:1px solid var(--border-color);';
        
        div.innerHTML = `
            <span style="font-weight:600; font-size:0.9rem;">${titles[key] || key}</span>
            <div style="display:flex; gap:5px;">
                <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem;" onclick="moveSidebarItemUp(${index})">▲ لأعلى</button>
                <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem;" onclick="moveSidebarItemDown(${index})">▼ لأسفل</button>
            </div>
        `;
        listContainer.appendChild(div);
    });
}
window.renderSidebarSettingsOrderList = renderSidebarSettingsOrderList;

function moveSidebarItemUp(index) {
    if (index === 0) return;
    let order = [...(state.systemConfig.sidebarOrder || ['stores', 'invoices', 'orders', 'reports', 'settings'])];
    if (!order.includes('invoices')) {
        const storesIdx = order.indexOf('stores');
        if (storesIdx !== -1) order.splice(storesIdx + 1, 0, 'invoices');
        else order.unshift('invoices');
    }
    const temp = order[index];
    order[index] = order[index - 1];
    order[index - 1] = temp;
    state.systemConfig.sidebarOrder = order;
    state.save();
    renderSidebarSettingsOrderList();
    renderAdminSidebarMenu();
}
window.moveSidebarItemUp = moveSidebarItemUp;

function moveSidebarItemDown(index) {
    let order = [...(state.systemConfig.sidebarOrder || ['stores', 'invoices', 'orders', 'reports', 'settings'])];
    if (!order.includes('invoices')) {
        const storesIdx = order.indexOf('stores');
        if (storesIdx !== -1) order.splice(storesIdx + 1, 0, 'invoices');
        else order.unshift('invoices');
    }
    if (index === order.length - 1) return;
    const temp = order[index];
    order[index] = order[index + 1];
    order[index + 1] = temp;
    state.systemConfig.sidebarOrder = order;
    state.save();
    renderSidebarSettingsOrderList();
    renderAdminSidebarMenu();
}
window.moveSidebarItemDown = moveSidebarItemDown;

function saveSidebarSettings() {
    const openStoresSubmenu = document.getElementById('config-open-stores-submenu').checked;
    const openInvoicesSubmenu = document.getElementById('config-open-invoices-submenu') ? document.getElementById('config-open-invoices-submenu').checked : true;
    const openOrdersSubmenu = document.getElementById('config-open-orders-submenu').checked;
    const openReportsSubmenu = document.getElementById('config-open-reports-submenu').checked;
    
    const openSubs = [];
    if (openStoresSubmenu) openSubs.push('stores-submenu');
    if (openInvoicesSubmenu) openSubs.push('invoices-submenu');
    if (openOrdersSubmenu) openSubs.push('orders-submenu');
    if (openReportsSubmenu) openSubs.push('reports-submenu');
    
    state.systemConfig.sidebarOpenSubmenus = openSubs;
    state.save();
    
    renderAdminSidebarMenu();
    showToast('تم حفظ وتطبيق إعدادات القائمة الجانبية بنجاح', 'success');
}
window.saveSidebarSettings = saveSidebarSettings;

// 10. تسجيل الدخول والخروج
function setupAuthForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userVal = document.getElementById('login-username').value;
            const passVal = document.getElementById('login-password').value;

            if (state.login(userVal, passVal)) {
                showToast(`أهلاً بك مجدداً، ${state.currentUser.name}`, 'success');
                checkAuthentication();
            } else {
                showToast('اسم المستخدم أو كلمة المرور غير صحيحة', 'danger');
            }
        });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            state.logout();
            showToast('تم تسجيل الخروج بنجاح');
            checkAuthentication();
        });
    }
}

// 11. تبديل السمة (Dark/Light mode)
function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const newTheme = state.theme === 'dark' ? 'light' : 'dark';
            state.setTheme(newTheme);
            themeBtn.innerHTML = newTheme === 'dark' ? '☀️ مظهر مضيء' : '🌙 مظهر داكن';
        });
    }
    document.documentElement.setAttribute('data-theme', state.theme);
    if (themeBtn) themeBtn.innerHTML = state.theme === 'dark' ? '☀️ مظهر مضيء' : '🌙 مظهر داكن';
}

// 12. تشغيل وإدارة القائمة الجانبية المنسدلة للجوال
function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.querySelector('.sidebar');
    
    if (toggleBtn && sidebar) {
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }
        
        const closeSidebar = () => {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        };
        
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
        });
        
        overlay.addEventListener('click', closeSidebar);
        
        // إغلاق القائمة عند النقر على أي عنصر بداخلها في الجوال
        sidebar.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', closeSidebar);
        });
    }
}

// 13. البحث
function setupSearch() {
    const adminSearch = document.getElementById('admin-search-input');
    if (adminSearch) {
        adminSearch.addEventListener('input', () => {
            renderStore1Table();
            renderStore2Table();
            renderGrandTotalTable();
        });
    }

    const customerSearch = document.getElementById('customer-search-input');
    if (customerSearch) {
        customerSearch.addEventListener('input', () => {
            renderCustomerDashboard();
        });
    }
}

// ================= إدارة وعرض تفاصيل المواد المدخلة بالنظام =================
function filterSystemMaterials() {
    if (paginationConfig['system-materials']) {
        paginationConfig['system-materials'].page = 1;
    }
    renderSystemMaterialsTable();
}
window.filterSystemMaterials = filterSystemMaterials;

function renderSystemMaterialsTable() {
    const tbody = document.getElementById('system-materials-tbody');
    if (!tbody) return;
    
    // 1. تحديث خيارات فلتر التصنيفات ديناميكياً
    const catFilter = document.getElementById('system-materials-category-filter');
    if (catFilter) {
        const currentVal = catFilter.value;
        const availableCategories = state.categories || [];
        const existingValues = Array.from(catFilter.options).map(o => o.value);
        const needsUpdate = availableCategories.some(c => !existingValues.includes(c)) || catFilter.options.length <= 1;
        if (needsUpdate) {
            catFilter.innerHTML = '<option value="all">كل التصنيفات</option>';
            availableCategories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.innerText = cat;
                if (cat === currentVal) opt.selected = true;
                catFilter.appendChild(opt);
            });
            if (existingValues.includes(currentVal)) {
                catFilter.value = currentVal;
            }
        }
    }
    
    const searchVal = document.getElementById('system-materials-search') ? document.getElementById('system-materials-search').value.trim().toLowerCase() : '';
    const selectedCategory = catFilter ? catFilter.value : 'all';
    const storeFilter = document.getElementById('system-materials-store-filter') ? document.getElementById('system-materials-store-filter').value : 'all';
    const stockFilter = document.getElementById('system-materials-stock-filter') ? document.getElementById('system-materials-stock-filter').value : 'all';
    
    // 2. حساب وتحديث الإحصائيات في الصناديق العلوية
    const allMaterials = state.materials || [];
    const uniqueNames = new Set(allMaterials.map(m => m.name ? m.name.trim().toLowerCase() : '')).size;
    const totalQty = allMaterials.reduce((sum, m) => sum + (m.quantity || 0), 0);
    const totalValue = allMaterials.reduce((sum, m) => sum + ((m.quantity || 0) * (m.price || 0)), 0);
    
    const statRecs = document.getElementById('stat-system-mat-total-records');
    const statNames = document.getElementById('stat-system-mat-unique-names');
    const statQty = document.getElementById('stat-system-mat-total-qty');
    const statVal = document.getElementById('stat-system-mat-total-value');
    
    if (statRecs) statRecs.innerText = allMaterials.length;
    if (statNames) statNames.innerText = uniqueNames;
    if (statQty) statQty.innerText = totalQty.toLocaleString();
    if (statVal) statVal.innerText = totalValue.toLocaleString();
    
    // 3. الفلترة والتصفية
    let filtered = allMaterials.filter(m => {
        if (!m.name) return false;
        
        // البحث
        if (searchVal) {
            const matchesName = m.name.toLowerCase().includes(searchVal);
            const matchesCompany = (m.company || '').toLowerCase().includes(searchVal);
            const matchesBatch = (m.batchNumber || '').toLowerCase().includes(searchVal);
            const matchesCategory = (m.category || '').toLowerCase().includes(searchVal);
            if (!matchesName && !matchesCompany && !matchesBatch && !matchesCategory) return false;
        }
        
        // التصنيف
        if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
        
        // المخزن
        if (storeFilter !== 'all' && m.store !== storeFilter) return false;
        
        // حالة الرصيد
        if (stockFilter === 'in-stock' && (!m.quantity || m.quantity <= 0)) return false;
        if (stockFilter === 'zero-stock' && m.quantity > 0) return false;
        
        return true;
    });
    
    // 4. ترقيم الصفحات
    const totalItems = filtered.length;
    const config = paginationConfig['system-materials'] || { page: 1, rowsPerPage: 10 };
    
    if (config.rowsPerPage !== 'all') {
        const totalPages = Math.ceil(totalItems / config.rowsPerPage) || 1;
        if (config.page > totalPages) {
            config.page = totalPages;
        }
    }
    
    let displayedItems = filtered;
    if (config.rowsPerPage !== 'all') {
        const startIndex = (config.page - 1) * config.rowsPerPage;
        const endIndex = startIndex + config.rowsPerPage;
        displayedItems = filtered.slice(startIndex, endIndex);
    }
    
    renderPaginationButtons('system-materials', totalItems);
    
    // 5. رسم صفوف الجدول
    tbody.innerHTML = '';
    if (displayedItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 35px 20px; color: var(--text-secondary); font-size: 0.95rem;">
                    🔍 لا توجد مواد تطابق معايير البحث والفلترة المحددة
                </td>
            </tr>
        `;
        return;
    }
    
    const startIndex = (config.rowsPerPage === 'all') ? 0 : (config.page - 1) * config.rowsPerPage;
    const today = new Date().toISOString().split('T')[0];
    
    displayedItems.forEach((mat, idx) => {
        const tr = document.createElement('tr');
        tr.style.transition = 'background-color 0.15s ease';
        
        const rowNum = startIndex + idx + 1;
        const isTemplate = mat.batchNumber === 'TEMPLATE' || !mat.batchNumber;
        const qty = mat.quantity || 0;
        const price = mat.price || 0;
        const lineTotal = qty * price;
        
        // فحص تاريخ الصلاحية
        let expiryBadge = `<span style="font-size:0.85rem; color:var(--text-secondary);">${mat.expiryDate || '—'}</span>`;
        if (mat.expiryDate && !isTemplate) {
            if (mat.expiryDate < today) {
                expiryBadge = `<span class="badge" style="background:rgba(239,68,68,0.2); color:#ef4444; font-weight:bold;">منتهي (${mat.expiryDate})</span>`;
            } else {
                const diffDays = Math.ceil((new Date(mat.expiryDate) - new Date(today)) / (1000 * 60 * 60 * 24));
                if (diffDays <= 60) {
                    expiryBadge = `<span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; font-weight:bold;">قريب (${mat.expiryDate})</span>`;
                }
            }
        }
        
        // شارة المخزن
        const storeBadge = mat.store === 'store1' 
            ? `<span class="badge" style="background:rgba(37,99,235,0.15); color:#60a5fa; font-size:0.8rem;">مخزن 1 (الرئيسي)</span>`
            : `<span class="badge" style="background:rgba(16,185,129,0.15); color:#34d399; font-size:0.8rem;">مخزن 2 (الفرعي)</span>`;
            
        // شارة الكمية
        const qtyBadge = qty > 0
            ? `<span class="badge" style="background:rgba(16,185,129,0.2); color:#10b981; font-weight:800; font-size:0.9rem; padding:3px 10px;">${qty}</span>`
            : `<span class="badge" style="background:rgba(148,163,184,0.15); color:var(--text-secondary); font-size:0.8rem;">0 (رصيد مسجل)</span>`;
            
        tr.innerHTML = `
            <td style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">${rowNum}</td>
            <td>
                <strong style="color: var(--text-primary); font-size: 0.95rem;">${mat.name}</strong>
                ${isTemplate ? '<span class="tag" style="font-size:0.65rem; margin-right:6px; background:rgba(99,102,241,0.15); color:#818cf8;">تعريف عام</span>' : ''}
            </td>
            <td><span class="tag" style="font-size:0.75rem; background:rgba(59,130,246,0.12); color:#60a5fa;">${mat.category || 'عامة'}</span></td>
            <td style="color: var(--text-secondary); font-size: 0.85rem;">${mat.company || '—'}</td>
            <td><code style="font-size:0.85rem; padding:2px 6px; border-radius:4px; background:var(--bg-tertiary);">${isTemplate ? '—' : mat.batchNumber}</code></td>
            <td>${expiryBadge}</td>
            <td>${storeBadge}</td>
            <td style="text-align: center;">${qtyBadge}</td>
            <td style="text-align: left; font-weight: 600; font-size: 0.88rem; direction: ltr;">${price.toLocaleString()} د.ع</td>
            <td style="text-align: left; font-weight: 700; color: var(--success); font-size: 0.88rem; direction: ltr;">${lineTotal.toLocaleString()} د.ع</td>
            <td style="text-align: center;">
                <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: center;">
                    <button type="button" class="btn btn-primary" onclick="openEditMaterialModal('${mat.id}')" style="padding: 4px 8px; font-size: 0.78rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="تعديل تفاصيل المادة">
                        ✏️ تعديل
                    </button>
                    <button type="button" class="btn btn-danger" onclick="triggerDeleteSystemMaterial('${mat.id}')" style="padding: 4px 8px; font-size: 0.78rem; background-color: #ef4444; border-color: #ef4444; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="حذف المادة من النظام">
                        🗑️ حذف
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
window.renderSystemMaterialsTable = renderSystemMaterialsTable;

function triggerDeleteSystemMaterial(id) {
    const mat = state.materials.find(m => m.id === id);
    if (!mat) return;
    
    const batchInfo = (mat.batchNumber && mat.batchNumber !== 'TEMPLATE') ? ` (دفعة: ${mat.batchNumber})` : '';
    if (confirm(`هل أنت متأكد من حذف المادة "${mat.name}"${batchInfo} نهائياً من النظام؟\nسيتم شطبها من المخازن وحذف قيدها بشكل دائم.`)) {
        if (deleteMaterial(id)) {
            renderSystemMaterialsTable();
            if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
        }
    }
}
window.triggerDeleteSystemMaterial = triggerDeleteSystemMaterial;

// تهيئة التطبيق عند التحميل
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupAuthForms();
    setupThemeToggle();
    setupSidebarToggle();
    setupSearch();
    updateCategoryUI(); // تهيئة القوائم والتصنيفات ديناميكياً
    checkAuthentication();

    // بدء مزامنة دورية كل 10 ثوانٍ لجلب التغييرات من الأجهزة الأخرى تلقائياً
    setInterval(() => {
        state.syncWithCloud();
    }, 10000);
});
