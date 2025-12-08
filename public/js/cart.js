// Sample inventory data
const inventory = [
  { id: 1, name: "Sugar 2kg", sku: "SUG-001", category: "Grocery", price: 250, stock: 45 },
  { id: 2, name: "Cooking Oil 3L", sku: "OIL-002", category: "Grocery", price: 650, stock: 28 },
  { id: 3, name: "Rice 5kg", sku: "RCE-003", category: "Grocery", price: 850, stock: 32 },
  { id: 4, name: "Wheat Flour 2kg", sku: "FLO-004", category: "Grocery", price: 180, stock: 67 },
  { id: 5, name: "Tea Leaves 500g", sku: "TEA-005", category: "Grocery", price: 320, stock: 24 },
  { id: 6, name: "Bread 400g", sku: "BRD-006", category: "Bakery", price: 60, stock: 89 },
  { id: 7, name: "Milk 500ml", sku: "MLK-007", category: "Dairy", price: 75, stock: 42 },
  { id: 8, name: "Eggs Tray", sku: "EGG-008", category: "Dairy", price: 450, stock: 31 },
  { id: 9, name: "Soap Bar", sku: "SOA-009", category: "Personal Care", price: 120, stock: 56 },
  { id: 10, name: "Toothpaste", sku: "TPT-010", category: "Personal Care", price: 180, stock: 39 },
];

// Cart data
let cart = [];

// Sales history
let salesHistory = [
  {
    id: "ORD-1001",
    products: ["Sugar 2kg", "Cooking Oil 3L"],
    items: 2,
    total: 900,
    date: "2024-03-15",
    time: "14:30"
  },
  {
    id: "ORD-1002",
    products: ["Rice 5kg", "Bread 400g"],
    items: 2,
    total: 910,
    date: "2024-03-15",
    time: "16:45"
  },
];

// DOM elements
const inventoryTable = document.getElementById('inventoryTable');
const cartItems = document.getElementById('cartItems');
const emptyCartMessage = document.getElementById('emptyCartMessage');
const cartItemCount = document.getElementById('cartItemCount');
const cartSubtotal = document.getElementById('cartSubtotal');
const cartTotal = document.getElementById('cartTotal');
const clearCartBtn = document.getElementById('clearCartBtn');
const checkoutBtn = document.getElementById('checkoutBtn');
const printReceiptBtn = document.getElementById('printReceiptBtn');
const searchInput = document.getElementById('search_inventory');
const salesTableBody = document.getElementById('salesTableBody');
const refreshSalesBtn = document.getElementById('refreshSalesBtn');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');
const logoutBtn = document.getElementById('logoutBtn');

// Initialize the app
async function init() {
  // Check authentication
  const auth = await requireAuthAndRole('shopkeeper');
  if (!auth) return;

  renderInventory();
  renderCart();
  renderSalesHistory();
  loadCartFromStorage();

  // Add event listeners
  if (searchInput) searchInput.addEventListener('input', filterInventory);
  if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
  if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);
  if (printReceiptBtn) printReceiptBtn.addEventListener('click', printReceipt);
  if (refreshSalesBtn) refreshSalesBtn.addEventListener('click', renderSalesHistory);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}

// ... (rest of the file)

// Checkout process
function checkout() {
  if (cart.length === 0) {
    showNotification('Cart is empty', 'warning');
    return;
  }

  // Check stock availability
  for (const cartItem of cart) {
    const inventoryItem = inventory.find(p => p.id === cartItem.id);
    if (cartItem.quantity > inventoryItem.stock) {
      showNotification(`Insufficient stock for ${cartItem.name}. Only ${inventoryItem.stock} units available.`, 'error');
      return;
    }
  }

  // Update inventory and create sale record
  const saleItems = [];
  let total = 0;
  let totalItems = 0;

  // Prepare receipt items
  const receiptItems = cart.map(item => ({
    name: item.name,
    price: item.price,
    quantity: item.quantity
  }));

  cart.forEach(cartItem => {
    const inventoryItem = inventory.find(p => p.id === cartItem.id);
    inventoryItem.stock -= cartItem.quantity;

    saleItems.push(cartItem.name);
    total += cartItem.price * cartItem.quantity;
    totalItems += cartItem.quantity;
  });

  // Create sale record
  const saleId = 'ORD-' + (1000 + salesHistory.length + 1);
  const now = new Date();
  const saleDate = now.toISOString().split('T')[0];
  const saleTime = now.toTimeString().split(' ')[0].substring(0, 5);

  const sale = {
    id: saleId,
    products: saleItems,
    items: totalItems,
    total: total,
    date: saleDate,
    time: saleTime
  };

  salesHistory.unshift(sale);

  // Save receipt data to localStorage
  const receiptData = {
    number: saleId,
    cashier: "Shopkeeper", // You might want to get this from auth
    date: now,
    items: receiptItems,
    amountPaid: total, // Assuming exact amount for now
    taxRate: 0.16,
    total: total
  };
  localStorage.setItem('lastReceipt', JSON.stringify(receiptData));

  // Clear cart
  cart = [];
  updateCart();

  // Update UI
  renderInventory();
  renderSalesHistory();

  // Enable print button
  if (printReceiptBtn) {
    printReceiptBtn.disabled = false;
  }

  // Show success message
  showNotification(`Sale completed! Order ${saleId} for KSH ${total.toLocaleString()}`, 'success');

  // Save to localStorage
  saveCartToStorage();
  saveSalesHistory();
}

function printReceipt() {
  // Open receipt page in new window/tab and trigger print
  const printWindow = window.open('reciept.html?print=true', '_blank');
  if (!printWindow) {
    showNotification('Please allow popups to print receipt', 'error');
  }


}

// Render inventory table
function renderInventory(filter = '') {
  if (!inventoryTable) return;
  inventoryTable.innerHTML = '';

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(filter.toLowerCase()) ||
    item.sku.toLowerCase().includes(filter.toLowerCase())
  );

  filteredInventory.forEach(item => {
    const row = document.createElement('tr');

    // Determine stock status
    let stockClass = 'stock-high';
    if (item.stock < 10) stockClass = 'stock-low';
    else if (item.stock < 20) stockClass = 'stock-medium';

    row.innerHTML = `
        <td>${item.name}</td>
        <td>${item.sku}</td>
        <td>${item.category}</td>
        <td>KSH ${item.price.toLocaleString()}</td>
        <td><span class="stock-badge ${stockClass}">${item.stock} units</span></td>
        <td>
          <button class="add-to-cart-btn" data-id="${item.id}" ${item.stock === 0 ? 'disabled' : ''}>
            ${item.stock === 0 ? 'Out of Stock' : '<i class="fas fa-cart-plus"></i> Add to Cart'}
          </button>
        </td>
      `;

    inventoryTable.appendChild(row);
  });

  // Add event listeners to "Add to Cart" buttons
  document.querySelectorAll('.add-to-cart-btn:not(:disabled)').forEach(button => {
    button.addEventListener('click', function () {
      const productId = parseInt(this.getAttribute('data-id'));
      addToCart(productId);
    });
  });
}

// Filter inventory
function filterInventory() {
  renderInventory(searchInput.value);
}

// Add item to cart
function addToCart(productId) {
  const product = inventory.find(p => p.id === productId);

  if (!product) {
    showNotification('Product not found', 'error');
    return;
  }

  if (product.stock === 0) {
    showNotification('Product is out of stock', 'warning');
    return;
  }

  // Check if product is already in cart
  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    // Check if we have enough stock
    if (existingItem.quantity >= product.stock) {
      showNotification(`Only ${product.stock} units available in stock`, 'warning');
      return;
    }
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity: 1,
      stock: product.stock
    });
  }

  updateCart();
  showNotification(`${product.name} added to cart`, 'success');
}

// Update item quantity in cart
function updateQuantity(productId, newQuantity) {
  const cartItem = cart.find(item => item.id === productId);
  const inventoryItem = inventory.find(p => p.id === productId);

  if (!cartItem || !inventoryItem) return;

  if (newQuantity < 1) {
    removeFromCart(productId);
    return;
  }

  if (newQuantity > inventoryItem.stock) {
    showNotification(`Only ${inventoryItem.stock} units available`, 'warning');
    return;
  }

  cartItem.quantity = newQuantity;
  updateCart();
}

// Remove item from cart
function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  updateCart();
  showNotification('Item removed from cart', 'warning');
}

// Render cart
function renderCart() {
  if (!cartItems) return;
  cartItems.innerHTML = '';

  if (cart.length === 0) {
    cartItems.appendChild(emptyCartMessage);
    emptyCartMessage.style.display = 'block';
    if (clearCartBtn) clearCartBtn.disabled = true;
    if (checkoutBtn) checkoutBtn.disabled = true;
  } else {
    emptyCartMessage.style.display = 'none';

    cart.forEach(item => {
      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      cartItem.innerHTML = `
          <div class="cart-item-name">
            ${item.name}
            <div class="cart-item-price">KSH ${item.price.toLocaleString()}/unit</div>
          </div>
          <div>${item.sku}</div>
          <div>KSH ${(item.price * item.quantity).toLocaleString()}</div>
          <div class="cart-item-controls">
            <button class="quantity-btn decrease" data-id="${item.id}">-</button>
            <span class="cart-item-quantity">${item.quantity}</span>
            <button class="quantity-btn increase" data-id="${item.id}">+</button>
          </div>
          <div>
            <button class="remove-item-btn" data-id="${item.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;

      cartItems.appendChild(cartItem);
    });

    // Add event listeners to cart controls
    document.querySelectorAll('.decrease').forEach(button => {
      button.addEventListener('click', function () {
        const productId = parseInt(this.getAttribute('data-id'));
        const item = cart.find(item => item.id === productId);
        if (item) updateQuantity(productId, item.quantity - 1);
      });
    });

    document.querySelectorAll('.increase').forEach(button => {
      button.addEventListener('click', function () {
        const productId = parseInt(this.getAttribute('data-id'));
        const item = cart.find(item => item.id === productId);
        if (item) updateQuantity(productId, item.quantity + 1);
      });
    });

    document.querySelectorAll('.remove-item-btn').forEach(button => {
      button.addEventListener('click', function () {
        const productId = parseInt(this.getAttribute('data-id'));
        removeFromCart(productId);
      });
    });

    if (clearCartBtn) clearCartBtn.disabled = false;
    if (checkoutBtn) checkoutBtn.disabled = false;
  }

  updateCartSummary();
  saveCartToStorage();
}

// Update cart summary
function updateCartSummary() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (cartItemCount) cartItemCount.textContent = totalItems;
  if (cartSubtotal) cartSubtotal.textContent = `KSH ${subtotal.toLocaleString()}`;
  if (cartTotal) cartTotal.textContent = `KSH ${subtotal.toLocaleString()}`;
}

// Clear cart
function clearCart() {
  if (cart.length === 0) return;

  if (confirm('Are you sure you want to clear the cart?')) {
    cart = [];
    updateCart();
    showNotification('Cart cleared', 'warning');
  }
}



// Render sales history
function renderSalesHistory() {
  if (!salesTableBody) return;
  salesTableBody.innerHTML = '';

  // Show only last 10 sales
  const recentSales = salesHistory.slice(0, 10);

  if (recentSales.length === 0) {
    salesTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-light);">
            <i class="fas fa-receipt" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
            No sales recorded yet
          </td>
        </tr>
      `;
    return;
  }

  recentSales.forEach(sale => {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${sale.id}</td>
        <td>${sale.products.join(', ')}</td>
        <td>${sale.items}</td>
        <td>KSH ${sale.total.toLocaleString()}</td>
        <td>${sale.date}</td>
        <td>${sale.time}</td>
      `;
    salesTableBody.appendChild(row);
  });
}

// Show notification
function showNotification(message, type = 'success') {
  if (!notification || !notificationText) return;

  notification.className = 'notification';
  notification.classList.add('show', `notification-${type}`);
  notificationText.textContent = message;

  // Set icon based on type
  const icon = notification.querySelector('i');
  if (icon) {
    if (type === 'success') {
      icon.className = 'fas fa-check-circle';
    } else if (type === 'error') {
      icon.className = 'fas fa-exclamation-circle';
    } else {
      icon.className = 'fas fa-exclamation-triangle';
    }
  }

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Save cart to localStorage
function saveCartToStorage() {
  localStorage.setItem('shopCart', JSON.stringify(cart));
}

// Load cart from localStorage
function loadCartFromStorage() {
  const savedCart = localStorage.getItem('shopCart');
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
      updateCart();
    } catch (e) {
      console.error('Error loading cart from storage:', e);
    }
  }
}

// Save sales history
function saveSalesHistory() {
  localStorage.setItem('shopSales', JSON.stringify(salesHistory));
}

// Load sales history
function loadSalesHistory() {
  const savedSales = localStorage.getItem('shopSales');
  if (savedSales) {
    try {
      salesHistory = JSON.parse(savedSales);
    } catch (e) {
      console.error('Error loading sales history:', e);
    }
  }
}

// Logout function
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    // Clear cart from localStorage
    localStorage.removeItem('shopCart');
    // Show logout message
    showNotification('Logged out successfully', 'success');

    // Redirect to login page after a short delay to show the notification
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);
  }
}

// Update cart function
function updateCart() {
  renderCart();
}

// Load sales history on init
loadSalesHistory();

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', init);
