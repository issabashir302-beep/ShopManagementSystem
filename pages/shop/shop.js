// Mock Data (In production this comes from backend/localStore)
const products = [
    { id: 1, name: "Maize Meal 2kg", category: "maize-meal", price: 120, stock: 45, image: "fas fa-bag-shopping" },
    { id: 2, name: "Sugar 1kg", category: "sugar", price: 150, stock: 12, image: "fas fa-cube" },
    { id: 3, name: "Cooking Oil 1L", category: "cooking-fat", price: 300, stock: 8, image: "fas fa-bottle-droplet" },
    { id: 4, name: "Tea Leaves 500g", category: "beverages", price: 80, stock: 100, image: "fas fa-leaf" },
    { id: 5, name: "Soda 500ml", category: "beverages", price: 60, stock: 24, image: "fas fa-bottle-water" },
    { id: 6, name: "Bar Soap", category: "cleaning", price: 40, stock: 50, image: "fas fa-soap" },
    { id: 7, name: "Milk 500ml", category: "dairy", price: 65, stock: 5, image: "fas fa-cow" },
    { id: 8, name: "Bread 400g", category: "snacks", price: 60, stock: 0, image: "fas fa-bread-slice" },
    { id: 9, name: "Mandazi", category: "snacks", price: 10, stock: 30, image: "fas fa-cookie" },
];

let cart = [];
let currentFilter = 'all';

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initPOS();
    updateDateTime();

    // Theme
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Search
    document.getElementById('posSearch').addEventListener('input', handleSearch);

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
    document.getElementById('clearCart').addEventListener('click', clearCart);
    document.getElementById('payCash').addEventListener('click', () => processPayment('Cash'));
    document.getElementById('payMpesa').addEventListener('click', () => processPayment('M-Pesa'));
    document.getElementById('checkoutBtn').addEventListener('click', () => processPayment('Cash')); // Default

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('End Shift and Logout?')) window.location.href = '../../public/login.html';
    });
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
