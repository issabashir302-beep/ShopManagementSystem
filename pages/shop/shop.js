

let products = [];
let cart = [];
let currentFilter = 'all';

// Pagination for inventory table
let inventoryPage = 1;
const inventoryPageSize = 7;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initPOS();
    updateDateTime();

    // Theme
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    const themeToggleEl = document.getElementById('themeToggle');
    if (themeToggleEl) themeToggleEl.addEventListener('click', toggleTheme);

    // Search
    const posSearchEl = document.getElementById('posSearch');
    if (posSearchEl) posSearchEl.addEventListener('input', handleSearch);

    // Filters
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.cat;
            renderGrid();
        });
    });

    // Cart Actions
    const clearCartEl = document.getElementById('clearCart');
    if (clearCartEl) clearCartEl.addEventListener('click', clearCart);
    const payCashEl = document.getElementById('payCash');
    if (payCashEl) payCashEl.addEventListener('click', () => processPayment('Cash'));
    const payMpesaEl = document.getElementById('payMpesa');
    if (payMpesaEl) payMpesaEl.addEventListener('click', () => processPayment('M-Pesa'));
    const checkoutBtnEl = document.getElementById('checkoutBtn');
    if (checkoutBtnEl) checkoutBtnEl.addEventListener('click', () => processPayment('Cash'));

    // Logout
    const logoutBtnEl = document.getElementById('logoutBtn');
    if (logoutBtnEl) logoutBtnEl.addEventListener('click', async () => {
        if (!confirm('End Shift and Logout?')) return;
        const btn = logoutBtnEl;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
        }

        const token = localStorage.getItem('access_token');
        try {
            if (token) {
                const res = await fetch('http://localhost:5000/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) {
                    if (res.status === 401) {
                        localStorage.removeItem('access_token');
                        if (typeof showToast === 'function') showToast('Session expired', 'info');
                        setTimeout(() => window.location.href = '/pages/auth/login.html', 500);
                        return;
                    }
                    const err = await res.json().catch(() => ({ message: 'Logout failed' }));
                    throw new Error(err.error || err.message || 'Failed to logout');
                }
            }

            localStorage.removeItem('access_token');
            if (typeof showToast === 'function') showToast('Logged out', 'success');
            setTimeout(() => window.location.href = '/pages/auth/login.html', 500);
        } catch (err) {
            console.error('Logout error:', err);
            if (typeof showToast === 'function') showToast(err.message || 'Logout failed', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Logout';
            }
        }
    });

    // Shopkeeper inventory: fetch and wire search
    if (document.getElementById('inventoryTable')) {
        // initial load
        inventoryPage = 1;
        fetchProductsForShopkeeper();

        const searchInv = document.getElementById('search_inventory');
        if (searchInv) searchInv.addEventListener('input', (e) => {
            inventoryPage = 1; // reset to first page on search
            renderInventoryTable(e.target.value);
        });

        // pagination controls
        const prevBtn = document.getElementById('inventoryPrev');
        const nextBtn = document.getElementById('inventoryNext');
        if (prevBtn) prevBtn.addEventListener('click', () => { if (inventoryPage > 1) { inventoryPage--; renderInventoryTable(); } });
        if (nextBtn) nextBtn.addEventListener('click', () => { inventoryPage++; renderInventoryTable(); });
    }
});

function initPOS() {
    renderGrid();
    renderCart();
}

function updateDateTime() {
    const el = document.getElementById('currentDate');
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-KE', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    setTimeout(updateDateTime, 60000);
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}

// ===== POS LOGIC =====

function handleSearch(e) {
    renderGrid(e.target.value.toLowerCase());
}

function renderGrid(searchTerm = '') {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        const matchesCat = currentFilter === 'all' || p.category === currentFilter;
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-tertiary);">No products found</div>`;
        return;
    }

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => addToCart(p.id);

        // Stock logic
        const stockStatus = p.stock <= 5 ? 'low' : 'good';
        const stockBadge = p.stock > 0
            ? `<span class="stock-badge ${stockStatus}">${p.stock} left</span>`
            : `<span class="stock-badge low" style="background:var(--danger)">Out of Stock</span>`;

        card.innerHTML = `
            ${stockBadge}
            <div class="card-icon-area">
                <i class="${p.image}"></i>
            </div>
            <div class="card-info">
                <h4 title="${p.name}">${p.name}</h4>
                <div class="card-price">KSh ${p.price}</div>
            </div>
        `;

        if (p.stock === 0) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }

        grid.appendChild(card);
    });
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existing = cart.find(item => item.id === productId);

    if (existing) {
        if (existing.qty < product.stock) {
            existing.qty++;
        } else {
            showToast('Max stock reached!', 'error');
            return;
        }
    } else {
        cart.push({ ...product, qty: 1 });
    }

    renderCart();
    // Play sound optional
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    renderCart();
}

function updateQty(productId, delta) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;

    if (delta > 0) { // Add
        const product = products.find(p => p.id === productId);
        if (item.qty < product.stock) {
            item.qty++;
        } else {
            showToast('Max stock limit', 'error');
        }
    } else { // Subtract
        if (item.qty > 1) {
            item.qty--;
        } else {
            removeFromCart(productId);
        }
    }
    renderCart();
}

function clearCart() {
    if (cart.length > 0 && confirm('Clear current cart?')) {
        cart = [];
        renderCart();
    }
}

function renderCart() {
    const container = document.getElementById('cartContainer');
    const totalEl = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (cart.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-tertiary); margin-top: 50px;">
                <i class="fas fa-store-slash" style="font-size: 3rem; margin-bottom: 10px; opacity: 0.5;"></i>
                <p>Cart is empty</p>
                <small>Scan or click items to add</small>
            </div>
        `;
        totalEl.textContent = 'KSh 0.00';
        checkoutBtn.disabled = true;
        return;
    }

    container.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <span>@ KSh ${item.price}</span>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn" onclick="updateQty(${item.id}, -1)"><i class="fas fa-minus"></i></button>
                <span style="font-weight: 600; min-width: 20px; text-align: center;">${item.qty}</span>
                <button class="qty-btn" onclick="updateQty(${item.id}, 1)"><i class="fas fa-plus"></i></button>
                <span style="min-width: 60px; text-align: right; font-weight: 600;">${itemTotal}</span>
            </div>
        `;
        container.appendChild(row);
    });

    totalEl.textContent = `KSh ${total.toLocaleString()}`;
    checkoutBtn.disabled = false;
}

// ===== New: Fetch products from backend and render inventory table for shopkeepers =====
async function fetchProductsForShopkeeper() {
    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('http://localhost:5000/api/inventory', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Failed to fetch products' }));
            throw new Error(err.error || err.message || 'Failed to load products');
        }

        const data = await res.json();
        // Normalize to expected local product shape
        products = data.map(p => ({
            id: p.id,
            name: p.name || p.product_name || '',
            sku: p.sku || p.code || '',
            category: p.category || '',
            buyPrice: Number(p.buying_price ?? p.buy_price ?? p.buyPrice ?? 0),
            price: Number(p.selling_price ?? p.sellPrice ?? p.sell_price ?? 0),
            stock: Number(p.quantity ?? p.stock ?? 0),
            unit: p.unit || '',
            supplier: p.supplier || ''
        }));

        inventoryPage = 1; // reset pagination on fresh load
        renderInventoryTable();
        renderGrid(); // update POS grid too if present
    } catch (err) {
        console.error('fetchProductsForShopkeeper error:', err);
        showToast(err.message || 'Failed to load products', 'error');
    }
}

function renderInventoryTable(searchTerm = '') {
    // prefer the admin-style tbody id if present
    const tbody = document.getElementById('inventoryTableBody') || document.getElementById('inventoryTable') || null;
    if (!tbody) return;

    const term = (searchTerm || '').toLowerCase();
    const filtered = products.filter(p => {
        return (!term) || p.name.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term);
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        // determine column count
        const colCount = 8;
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; color: var(--text-tertiary); padding: 20px;">No products available</td></tr>`;
        // update pagination UI
        const pageInfoEl = document.getElementById('inventoryPagination');
        const prevBtn = document.getElementById('inventoryPrev');
        const nextBtn = document.getElementById('inventoryNext');
        if (pageInfoEl) pageInfoEl.textContent = `0-0 of 0`;
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        const btnContainer = document.getElementById('inventoryPageButtons');
        if (btnContainer) btnContainer.innerHTML = '';
        return;
    }

    // Apply pagination
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / inventoryPageSize));
    if (inventoryPage > totalPages) inventoryPage = totalPages;

    const startIdx = (inventoryPage - 1) * inventoryPageSize;
    const endIdx = Math.min(startIdx + inventoryPageSize, total);

    const toDisplay = filtered.slice(startIdx, endIdx);

    toDisplay.forEach(p => {
        const tr = document.createElement('tr');

        const totalValue = Number((p.price || 0) * (p.stock || 0));

        tr.innerHTML = `
            <td>
                <div style="font-weight: 600;">${p.name}</div>
                <div style="font-size:0.85rem; color: var(--text-tertiary);">${p.supplier || ''}</div>
            </td>
            <td>${p.sku || ''}</td>
            <td>${p.category || ''}</td>
            <td>KSh ${Number(p.buyPrice || 0).toLocaleString('en-KE')}</td>
            <td style="font-weight:700;">KSh ${Number(p.price || 0).toLocaleString('en-KE')}</td>
            <td>${p.stock}</td>
            <td style="font-weight:700;">KSh ${totalValue.toLocaleString('en-KE')}</td>
            <td>
                <button class="primary-btn" ${p.stock <= 0 ? 'disabled' : ''} onclick="addToCart(${p.id})">Add to Cart</button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Update pagination UI if present
    const pageInfoEl = document.getElementById('inventoryPagination');
    const prevBtn = document.getElementById('inventoryPrev');
    const nextBtn = document.getElementById('inventoryNext');
    if (pageInfoEl) pageInfoEl.textContent = `${startIdx + 1}-${endIdx} of ${total}`;
    if (prevBtn) prevBtn.disabled = inventoryPage <= 1;
    if (nextBtn) nextBtn.disabled = inventoryPage >= totalPages;

    // Render numeric page buttons (if container exists)
    renderPageButtons(totalPages);
}

function renderPageButtons(totalPages) {
    const container = document.getElementById('inventoryPageButtons');
    if (!container) return;
    container.innerHTML = '';

    const maxButtons = 7;

    const addBtn = (i) => {
        const btn = document.createElement('button');
        btn.className = 'pagination-number-btn';
        if (i === inventoryPage) btn.classList.add('active');
        btn.textContent = i;
        btn.addEventListener('click', () => {
            if (i === inventoryPage) return;
            inventoryPage = i;
            renderInventoryTable();
        });
        container.appendChild(btn);
    };

    const addEllipsis = () => {
        const span = document.createElement('span');
        span.className = 'pagination-ellipsis';
        span.textContent = '...';
        span.style.margin = '0 6px';
        container.appendChild(span);
    };

    if (totalPages <= maxButtons) {
        for (let i = 1; i <= totalPages; i++) addBtn(i);
        return;
    }

    // show first page, windowed middle, and last page
    const delta = Math.floor((maxButtons - 3) / 2); // pages around current
    let start = Math.max(2, inventoryPage - delta);
    let end = Math.min(totalPages - 1, inventoryPage + delta);

    // expand range when close to edges
    if (inventoryPage - start < delta) end = Math.min(totalPages - 1, start + (maxButtons - 3));
    if (end - start < (maxButtons - 3)) start = Math.max(2, end - (maxButtons - 3));

    addBtn(1);
    if (start > 2) addEllipsis();
    for (let i = start; i <= end; i++) addBtn(i);
    if (end < totalPages - 1) addEllipsis();
    addBtn(totalPages);
}

// Wire the refresh button for inventory (optional)
const refreshSalesBtn = document.getElementById('refreshSalesBtn');
if (refreshSalesBtn) {
    refreshSalesBtn.addEventListener('click', async () => {
        inventoryPage = 1;
        await fetchProductsForShopkeeper();
        showToast('Inventory refreshed', 'success');
    });
}

// ===== PAYMENT Logic =====

function processPayment(method) {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Show Modal
    const modal = document.getElementById('paymentModal');
    document.getElementById('receiptRef').textContent = '#INV-' + Math.floor(Math.random() * 100000);
    document.getElementById('receiptAmount').textContent = `KSh ${total.toLocaleString()}`;
    document.getElementById('receiptChange').textContent = 'KSh 0'; // Placeholder for change logic

    modal.style.display = 'flex';

    // Log sale to history (Mock)
    const sale = {
        ref: document.getElementById('receiptRef').textContent,
        time: new Date().toLocaleTimeString(),
        items: cart.length,
        method: method,
        amount: total,
        status: 'Completed'
    };
    addHistoryRow(sale);

    // Clear logic (after modal close usually, but for demo now)
    cart = [];
    renderCart();
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function printReceipt() {
    showToast('Receipt sent to printer', 'success');
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message p').textContent = msg;
    toast.classList.add('show');
    if (type === 'error') toast.style.borderColor = 'var(--danger)';

    setTimeout(() => {
        toast.classList.remove('show');
        toast.style.borderColor = '';
    }, 3000);
}


// ===== VIEW SWITCHING =====
function switchView(viewName, element) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (element) element.classList.add('active');

    document.getElementById('posView').style.display = viewName === 'pos' ? 'block' : 'none';
    document.getElementById('historyView').style.display = viewName === 'history' ? 'block' : 'none';
}

// History
function addHistoryRow(sale) {
    const tbody = document.getElementById('historyTableBody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${sale.ref}</td>
        <td>${sale.time}</td>
        <td>${sale.items} items</td>
        <td>${sale.method}</td>
        <td style="font-weight: 700;">KSh ${sale.amount}</td>
        <td><span class="status-pill completed">Completed</span></td>
    `;
    tbody.prepend(row);
}

function refreshHistory() {
    // Re-fetch logic
    showToast('History refreshed');
}
