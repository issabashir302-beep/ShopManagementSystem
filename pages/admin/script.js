// ===== SAMPLE DATA =====
// Keeping data in memory for demo purposes. In a real app, this would be fetched from a database.
let products = [
    {
        id: 1,
        name: "Unga wa Pembe (2kg)",
        sku: "UNG-001",
        category: "maize-meal",
        stock: 45,
        unit: "packet",
        buyPrice: 120,
        sellPrice: 150,
        supplier: "Unga Ltd",
        sales: 12
    },
    {
        id: 2,
        name: "Mumias Sugar (1kg)",
        sku: "SUG-001",
        category: "sugar",
        stock: 8,
        unit: "kg",
        buyPrice: 110,
        sellPrice: 140,
        supplier: "Mumias Sugar",
        sales: 8
    },
    {
        id: 3,
        name: "Kericho Gold Tea (250g)",
        sku: "TEA-001",
        category: "tea",
        stock: 32,
        unit: "g",
        buyPrice: 85,
        sellPrice: 120,
        supplier: "Kericho Tea",
        sales: 15
    }
];

let sales = [
    {
        id: "ORD-001",
        productId: 1,
        productName: "Unga wa Pembe (2kg)",
        quantity: 2,
        unit: "packet",
        buyPrice: 120,
        sellPrice: 150,
        date: "2024-03-27",
        time: "14:30",
        total: 300
    },
    {
        id: "ORD-002",
        productId: 2,
        productName: "Mumias Sugar (1kg)",
        quantity: 1,
        unit: "kg",
        buyPrice: 110,
        sellPrice: 140,
        date: "2024-03-27",
        time: "13:45",
        total: 140
    },
    {
        id: "ORD-003",
        productId: 3,
        productName: "Kericho Gold Tea (250g)",
        quantity: 3,
        unit: "g",
        buyPrice: 85,
        sellPrice: 120,
        date: "2024-03-26",
        time: "11:20",
        total: 360
    }
];

let daySales = [
    { id: "TRX-001", time: "14:30", amount: 300, items: ["Unga (2kg)"], status: "completed" },
    { id: "TRX-002", time: "13:45", amount: 140, items: ["Sugar (1kg)"], status: "completed" },
    { id: "TRX-003", time: "11:20", amount: 360, items: ["Tea (250g)"], status: "completed" },
    { id: "TRX-004", time: "10:15", amount: 450, items: ["Cooking Fat", "Milk"], status: "completed" }
];

let weekSales = [
    { date: "Mon, 25 Mar", day: "Monday", total: 12450, transactions: 8, status: "completed" },
    { date: "Tue, 26 Mar", day: "Tuesday", total: 15320, transactions: 12, status: "completed" },
    { date: "Wed, 27 Mar", day: "Wednesday", total: 8450, transactions: 6, status: "in-progress" }
];

let monthSales = [
    { week: "Week 1", range: "1-7 Mar", total: 45000, transactions: 32, status: "completed" },
    { week: "Week 2", range: "8-14 Mar", total: 52000, transactions: 38, status: "completed" },
    { week: "Week 3", range: "15-21 Mar", total: 48000, transactions: 35, status: "completed" },
    { week: "Week 4", range: "22-28 Mar", total: 38000, transactions: 28, status: "in-progress" }
];

let shopkeepers = [
    { id: 1, name: "John Kamau", email: "john@shop.com", phone: "0712345678", role: "Shopkeeper", status: "Active", addedOn: "2024-03-15" },
    { id: 2, name: "Sarah Wanjiku", email: "sarah@shop.com", phone: "0722334455", role: "Shopkeeper", status: "Pending", addedOn: "2024-03-28" }
];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
    initializeCommon();

    const title = document.title;
    if (title.includes('Inventory')) {
        initializeInventory();
    } else if (title.includes('Sales') && !title.includes('Tracker')) { // 'Sales History'
        initializeSales();
    } else if (title.includes('Shopkeeper')) {
        initializeShopkeepers();
    } else {
        // Default to Overview
        initializeOverview();
    }
});

// ===== COMMON INITIALIZATION =====
function initializeCommon() {
    updateDateTime();
    setInterval(updateDateTime, 60000);

    // Sidebar
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileOverlay = document.getElementById('mobileOverlay');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }

    // Check sidebar preference
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed && sidebar) {
        sidebar.classList.add('collapsed');
    }

    if (mobileMenuToggle && mobileOverlay) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            mobileOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            mobileOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    // Apply saved theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.querySelector('i').className = 'fas fa-moon';
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Global Search (Just a placeholder for now)
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            console.log('Global search:', e.target.value);
        });
    }

    // Modal Closers
    document.querySelectorAll('.modal-close, .reset-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const modal = this.closest('.modal');
            if (modal) {
                // If it's a reset button inside a form (not being used as cancel), don't close
                if (this.type === 'reset' && !this.id.includes('cancel')) return;
                closeModal(modal.id);
            }
        });
    });

    // Close modals on outside click
    window.addEventListener('click', function (e) {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
}

// ===== OVERVIEW PAGE INITIALIZATION =====
function initializeOverview() {
    console.log('Initializing Overview Dashboard...');

    // Add Product Form
    const addProductForm = document.getElementById('addProductForm');
    if (addProductForm) {
        addProductForm.addEventListener('submit', handleAddProduct);
    }

    // Tracker Tabs
    const trackerTabs = document.querySelectorAll('.tracker-tab');
    if (trackerTabs.length > 0) {
        trackerTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                switchTrackerTab(this);
            });
        });
        populateTrackerTables();
    }

    // Low Stock Alerts (Since owner.html has edit/delete modals, we can enable actions)
    updateLowStockList();

    // Stats
    const totalProductsEl = document.getElementById('totalProducts');
    if (totalProductsEl) totalProductsEl.textContent = products.length;

    // Additional metrics
    // Categories count
    const categories = [...new Set(products.map(p => p.category))];
    const detailValues = document.querySelectorAll('.detail-value');
    if (detailValues.length > 0) detailValues[0].textContent = categories.length;
    if (detailValues.length > 1) detailValues[1].textContent = products.length;

    // Today's Sales
    updateSalesMetrics();

    // Variant Listeners
    const hasVariants = document.getElementById('hasVariants');
    if (hasVariants) {
        hasVariants.addEventListener('change', toggleVariants);
    }
    const addVariantBtn = document.getElementById('addVariantBtn');
    if (addVariantBtn) {
        addVariantBtn.addEventListener('click', addVariantRow);
    }
    const variantsTableBody = document.getElementById('variantsTableBody');
    if (variantsTableBody) {
        variantsTableBody.addEventListener('click', function (e) {
            if (e.target.closest('.delete-variant')) {
                e.target.closest('tr').remove();
            }
        });
    }
}

// ===== INVENTORY PAGE INITIALIZATION =====
function initializeInventory() {
    console.log('Initializing Inventory Management...');
    // Load products from server (falls back to demo data if unauthenticated)
    fetchProductsFromServer();

    // Inventory Actions
    const refreshBtn = document.getElementById('refreshInventory');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshInventory);

    const searchInput = document.getElementById('inventorySearch');
    if (searchInput) searchInput.addEventListener('input', handleInventorySearch);

    const exportBtn = document.getElementById('exportInventory');
    if (exportBtn) exportBtn.addEventListener('click', () => showToast('Inventory exported!', 'success'));

    // Pagination (Placeholder)
    document.getElementById('inventoryPrev')?.addEventListener('click', () => showToast('Previous page', 'info'));
    document.getElementById('inventoryNext')?.addEventListener('click', () => showToast('Next page', 'info'));

    // Edit/Delete Modals
    const editForm = document.getElementById('editProductForm');
    if (editForm) editForm.addEventListener('submit', handleEditSubmit);

    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
}

// ===== SALES PAGE INITIALIZATION =====
function initializeSales() {
    console.log('Initializing Sales History...');
    populateSalesTable();

    // Sales Actions
    const exportBtn = document.getElementById('exportSales');
    if (exportBtn) exportBtn.addEventListener('click', exportSales);

    // Pagination
    document.getElementById('salesPrev')?.addEventListener('click', () => showToast('Previous page', 'info'));
    document.getElementById('salesNext')?.addEventListener('click', () => showToast('Next page', 'info'));

    // Sales Stats
    updateSalesMetrics(true); // pass true to target sales page specific metrics
}

// ===== SHOPKEEPERS PAGE INITIALIZATION =====
function initializeShopkeepers() {
    console.log('Initializing Shopkeeper Management...');
    populateShopkeepersTable();

    const addBtn = document.getElementById('addShopkeeperBtn');
    if (addBtn) addBtn.addEventListener('click', () => openModal('addShopkeeperModal'));

    const addForm = document.getElementById('addShopkeeperForm');
    if (addForm) addForm.addEventListener('submit', handleAddShopkeeper);
}

// ===== HELPER FUNCTIONS =====

function updateDateTime() {
    const currentDate = document.getElementById('currentDate');
    const lastUpdated = document.getElementById('lastUpdated');
    const now = new Date();

    if (currentDate) {
        const dateOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
        currentDate.textContent = now.toLocaleDateString('en-KE', dateOptions);
    }

    if (lastUpdated) {
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        lastUpdated.textContent = `Updated at ${now.toLocaleTimeString('en-KE', timeOptions)}`;
    }
}

function toggleTheme() {
    const themeToggle = document.getElementById('themeToggle');
    document.body.classList.toggle('dark-mode');
    const icon = themeToggle?.querySelector('i');
    if (document.body.classList.contains('dark-mode')) {
        if (icon) icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'dark');
    } else {
        if (icon) icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'light');
    }
}

function switchTrackerTab(clickedTab) {
    document.querySelectorAll('.tracker-tab').forEach(tab => tab.classList.remove('active'));
    clickedTab.classList.add('active');

    const period = clickedTab.getAttribute('data-period');
    document.querySelectorAll('.tracker-content').forEach(content => content.classList.remove('active'));

    const activeContent = document.getElementById(`${period}-tracker`);
    if (activeContent) activeContent.classList.add('active');
}

async function handleAddProduct(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.productName.value.trim();
    const sku = form.sku.value.trim();
    const category = form.category?.value || null;
    const stock = Number(form.stock.value || 0);
    const unit = form.unit.value;
    const buyPrice = parseFloat(form.buyPrice.value || 0);
    const sellPrice = parseFloat(form.sellPrice.value || 0);
    const supplier = form.supplier?.value || 'Not specified';

    if (!name || !sku || !unit) {
        alert('Please fill required fields (Product Name, SKU, Unit)');
        return;
    }

    const payload = {
        name,
        sku,
        category,
        stock,
        unit,
        buyPrice,
        sellPrice,
        buying_price: buyPrice,
        selling_price: sellPrice,
        supplier,
        sales: 0
    };

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        alert('You must be logged in to add products.');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn && (submitBtn.disabled = true);

    try {
        const res = await fetch('http://localhost:5000/api/inventory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error?.message || data.error || JSON.stringify(data));
        }

        showToast(`Product "${name}" added successfully!`, 'success');
        form.reset();

        // Refresh products list from server
        await fetchProductsFromServer();

    } catch (err) {
        console.error(err);
        alert('Failed to add product: ' + err.message);
    } finally {
        submitBtn && (submitBtn.disabled = false);
    }
}

async function fetchProductsFromServer() {
    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('http://localhost:5000/api/inventory', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Failed to fetch products' }));
            throw new Error(err.error?.message || err.message || JSON.stringify(err));
        }

        const data = await res.json();
        products = data.map(p => ({
            id: p.id,
            name: p.name || p.product_name || '',
            sku: p.sku || p.code || '',
            category: p.category || '',
            stock: Number(p.stock || 0),
            unit: p.unit || '',
            buyPrice: Number(p.buyPrice ?? p.buying_price ?? p.buy_price ?? 0),
            sellPrice: Number(p.sellPrice ?? p.selling_price ?? p.sell_price ?? 0),
            supplier: p.supplier || '',
            sales: Number(p.sales || 0)
        }));

        populateInventoryTable();

        const totalProducts = document.getElementById('totalProducts');
        if (totalProducts) totalProducts.textContent = products.length;
    } catch (err) {
        console.error(err);
        showToast('Failed to load products from server', 'error');
    }
}

function populateTrackerTables() {
    // Check if elements exist before populating
    const dayBody = document.getElementById('day-sales-body');
    if (dayBody) {
        dayBody.innerHTML = '';
        daySales.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sale.time}</td>
                <td>${sale.id}</td>
                <td>KSh ${sale.amount.toLocaleString('en-KE')}</td>
                <td>${sale.items.join(', ')}</td>
                <td><span class="status-pill ${sale.status}">${sale.status}</span></td>
            `;
            dayBody.appendChild(row);
        });
    }

    const weekBody = document.getElementById('week-sales-body');
    if (weekBody) {
        weekBody.innerHTML = '';
        weekSales.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sale.date}</td>
                <td>${sale.day}</td>
                <td>KSh ${sale.total.toLocaleString('en-KE')}</td>
                <td>${sale.transactions}</td>
                <td><span class="status-pill ${sale.status}">${sale.status}</span></td>
            `;
            weekBody.appendChild(row);
        });
    }

    const monthBody = document.getElementById('month-sales-body');
    if (monthBody) {
        monthBody.innerHTML = '';
        monthSales.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sale.week}</td>
                <td>${sale.range}</td>
                <td>KSh ${sale.total.toLocaleString('en-KE')}</td>
                <td>${sale.transactions}</td>
                <td><span class="status-pill ${sale.status}">${sale.status}</span></td>
            `;
            monthBody.appendChild(row);
        });
    }
}

function populateInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-tertiary);">
                    <i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 16px; display: block;"></i>
                    <p>No products in inventory.</p>
                </td>
            </tr>
        `;
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');

        let stockClass = product.stock <= 10 ? 'critical' : (product.stock <= 25 ? 'warning' : 'healthy');
        let stockText = product.stock <= 10 ? 'Low' : (product.stock <= 25 ? 'Medium' : 'Good');
        let totalValue = product.stock * product.sellPrice;

        row.innerHTML = `
            <td>
                <div style="font-weight: var(--font-weight-medium);">${product.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-tertiary);">${product.supplier}</div>
            </td>
            <td>${product.sku}</td>
            <td><span class="category-badge">${getCategoryName(product.category)}</span></td>
            <td>KSh ${product.buyPrice.toFixed(2)}</td>
            <td>KSh ${product.sellPrice.toFixed(2)}</td>
            <td>
                <div class="stock-indicator ${stockClass}">
                    <span>${product.stock} ${product.unit}</span>
                    <small>${stockText}</small>
                </div>
            </td>
            <td style="font-weight: 600;">KSh ${totalValue.toLocaleString('en-KE')}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Add listeners to new buttons
    tbody.querySelectorAll('.edit').forEach(btn => btn.addEventListener('click', () => editProduct(btn.dataset.id)));
    tbody.querySelectorAll('.delete').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.id)));
}

function populateSalesTable() {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (sales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-tertiary);">
                    <p>No sales recorded yet.</p>
                </td>
            </tr>`;
        return;
    }

    sales.forEach(sale => {
        const row = document.createElement('tr');
        const profit = (sale.sellPrice - sale.buyPrice) * sale.quantity;
        const profitMargin = ((sale.sellPrice - sale.buyPrice) / sale.sellPrice) * 100;
        const date = new Date(sale.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

        row.innerHTML = `
            <td>${sale.id}</td>
            <td>${sale.productName}</td>
            <td>${sale.quantity}</td>
            <td>${sale.unit}</td>
            <td>KSh ${sale.buyPrice.toFixed(2)}</td>
            <td>KSh ${sale.sellPrice.toFixed(2)}</td>
            <td class="${profitMargin > 20 ? 'text-success' : (profitMargin < 10 ? 'text-danger' : 'text-warning')}">
                KSh ${profit.toLocaleString('en-KE')}
                <div style="font-size: 0.75rem; opacity: 0.8;">${profitMargin.toFixed(1)}%</div>
            </td>
            <td>${date}</td>
            <td style="font-weight: 600;">KSh ${sale.total.toLocaleString('en-KE')}</td>
        `;
        tbody.appendChild(row);
    });
}

function populateShopkeepersTable() {
    const tbody = document.getElementById('shopkeepersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    shopkeepers.forEach(sk => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="font-weight: 500;">${sk.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-tertiary);">${sk.email}</div>
            </td>
            <td>${sk.phone}</td>
            <td>${sk.role}</td>
            <td><span class="status-pill ${sk.status.toLowerCase()}">${sk.status}</span></td>
            <td>${sk.addedOn}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateLowStockList() {
    const list = document.getElementById('lowStockList');
    if (!list) return;

    const lowStock = products.filter(p => p.stock <= 10);
    if (lowStock.length === 0) {
        list.innerHTML = `<div class="no-data"><i class="fas fa-check-circle"></i><p>All stock levels good!</p></div>`;
        return;
    }

    list.innerHTML = '';
    lowStock.forEach(p => {
        const div = document.createElement('div');
        div.className = `alert-item ${p.stock <= 5 ? 'critical' : 'low'}`;
        div.innerHTML = `
            <div class="product-avatar"><i class="fas fa-box"></i></div>
            <div class="alert-content">
                <h4>${p.name}</h4>
                <div class="stock-info">
                    <span class="stock-level">${p.stock} ${p.unit} left</span>
                    <span class="stock-threshold">SKU: ${p.sku}</span>
                </div>
            </div>
            <button class="alert-action" data-id="${p.id}"><i class="fas fa-plus"></i> Restock</button>
        `;
        list.appendChild(div);
    });

    // Alert actions
    list.querySelectorAll('.alert-action').forEach(btn => {
        btn.addEventListener('click', () => restockProduct(btn.dataset.id));
    });

    // Update counts
    const lowCount = document.getElementById('lowStockCount');
    if (lowCount) lowCount.textContent = lowStock.length;
}

function updateSalesMetrics(isSalesPage = false) {
    // Shared Metrics
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date === today).reduce((sum, s) => sum + s.total, 0);
    const todaySalesEl = document.getElementById('todaySalesValue');
    if (todaySalesEl) todaySalesEl.textContent = `KSh ${todaySales.toLocaleString('en-KE')}`;

    if (isSalesPage) {
        // Specific logic for sales.html metrics if any
        // ...
    }
}

function handleInventorySearch(e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#inventoryTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        showToast('Logging out...', 'info');
        // Redirect to login
    }
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // Simplified toast logic
    toast.querySelector('.toast-message p').textContent = msg;
    toast.querySelector('h4').textContent = type.charAt(0).toUpperCase() + type.slice(1);
    toast.className = `toast-notification show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

function editProduct(id) {
    const p = products.find(prod => prod.id == id);
    if (!p) return;

    const form = document.getElementById('editProductForm');
    if (!form) return;

    // Rough population for demo
    const inputs = form.querySelectorAll('input');
    if (inputs[0]) inputs[0].value = p.name;
    if (inputs[1]) inputs[1].value = p.stock;
    if (inputs[2]) inputs[2].value = p.sellPrice;

    form.dataset.productId = id;
    openModal('editModal');
}

function deleteProduct(id) {
    const btn = document.getElementById('confirmDelete');
    if (btn) {
        btn.dataset.productId = id;
        openModal('deleteModal');
    }
}

function handleEditSubmit(e) {
    e.preventDefault();
    closeModal('editModal');
    showToast('Product updated!', 'success');
    populateInventoryTable(); // Refresh
}

function handleConfirmDelete(e) {
    const id = e.target.dataset.productId;
    products = products.filter(p => p.id != id);
    closeModal('deleteModal');
    showToast('Product deleted!', 'success');
    populateInventoryTable();
    populateSalesTable(); // If sale referenced it?
    updateLowStockList();
}

function handleAddShopkeeper(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    shopkeepers.push({
        id: shopkeepers.length + 1,
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        role: "Shopkeeper",
        status: "Pending",
        addedOn: new Date().toISOString().split('T')[0]
    });
    closeModal('addShopkeeperModal');
    e.target.reset();
    showToast('Invitation sent!', 'success');
    populateShopkeepersTable();
}

function showHelp() { showToast('Help center coming soon!', 'info'); }
function showFeedback() { showToast('Feedback form coming soon!', 'info'); }

function refreshInventory() {
    const btn = document.getElementById('refreshInventory');
    if (btn) btn.classList.add('fa-spin');
    setTimeout(() => {
        if (btn) btn.classList.remove('fa-spin');
        showToast('Inventory updated', 'success');
    }, 1000);
}

function exportSales() {
    showToast('Downloading report...', 'success');
}

function restockProduct(id) {
    const p = products.find(prod => prod.id == id);
    if (p) {
        p.stock += 50;
        showToast(`Restocked ${p.name}`, 'success');
        updateLowStockList();
        populateInventoryTable();
    }
}

function getCategoryName(slug) {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Global scope expose for inline onclicks if any (though we used addEventListener)
window.showSection = function () { }; // No-op for compatibility if left over HTML calls it

function toggleVariants(e) {
    const builder = document.getElementById('variantsBuilder');
    if (e.target.checked) {
        builder.style.display = 'block';
        if (document.querySelectorAll('#variantsTableBody tr').length === 0) {
            addVariantRow(); // Add first empty row
        }
    } else {
        builder.style.display = 'none';
    }
}

function addVariantRow() {
    const tbody = document.getElementById('variantsTableBody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <select class="form-input" style="padding: 4px;">
                <option value="packet">Packet</option>
                <option value="piece">Piece</option>
                <option value="kg">Kg</option>
                <option value="g">Gram</option>
                <option value="dozen">Dozen</option>
            </select>
        </td>
        <td><input type="number" class="form-input" placeholder="Qty" style="width: 60px; padding: 4px;"></td>
        <td><input type="number" class="form-input" placeholder="Buy" style="width: 80px; padding: 4px;"></td>
        <td><input type="number" class="form-input" placeholder="Sell" style="width: 80px; padding: 4px;"></td>
        <td>
            <button type="button" class="action-btn delete delete-variant" style="color: var(--danger);">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(row);
}
