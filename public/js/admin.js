// js/admin.js

let currentUserId = null;
let allProducts = []; // Store all products for search functionality

// Tab switching function - defined first so it's available immediately
function setupTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  if (tabButtons.length === 0) {
    console.warn('Tab buttons not found');
    return;
  }
  
  if (tabPanes.length === 0) {
    console.warn('Tab panes not found');
    return;
  }

  // Remove any existing event listeners by using event delegation or one-time setup
  tabButtons.forEach((button, index) => {
    // Use a named function to allow removal if needed
    button.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const tabId = this.getAttribute('data-tab');
      
      if (!tabId) {
        console.warn('No data-tab attribute found on button');
        return;
      }

      // Get fresh references to avoid stale NodeList issues
      const allButtons = document.querySelectorAll('.tab-btn');
      const allPanes = document.querySelectorAll('.tab-pane');

      // Update active tab button
      allButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');

      // Show active tab content
      allPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === tabId) {
          pane.classList.add('active');
        }
      });
    };
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  // Set up tab switching immediately - don't wait for auth
  setupTabSwitching();
  
  // Check Auth
  const authInfo = await requireAuthAndRole('admin');
  if (!authInfo) return;
  currentUserId = authInfo.session.user.id;

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  // Theme toggle is handled by theme.js

  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // Current Date
  const currentDate = document.getElementById('currentDate');
  if (currentDate) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDate.textContent = now.toLocaleDateString('en-US', options);
  }

  // Initialize Data
  setupAddProductForm();
  loadInventoryProducts();
  setupInventorySearch();
  setupModalControls();
  loadAdminTodayAnalytics();
});

// Load products for inventory table
async function loadInventoryProducts() {
  const tbody = document.querySelector('#inventoryTable');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Loading...</td></tr>';

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--danger-color);">Error loading products</td></tr>';
    console.error(error);
    return;
  }

  // Store all products for search functionality
  allProducts = data || [];

  // Render products
  renderInventoryTable(allProducts);
}

// Render products to inventory table
function renderInventoryTable(products) {
  const tbody = document.querySelector('#inventoryTable');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No products found</td></tr>';
    return;
  }

  products.forEach(product => {
    const tr = document.createElement('tr');
    
    // Determine stock badge class and display value
    // For display purposes, we'll show the primary stock value
    const quantityPieces = product.quantity_pieces || 0;
    const quantityKg = product.quantity_kg || 0;
    
    let stockBadgeClass = 'high';
    let stockDisplay = '';
    
    // Determine which is the primary unit and format display
    if (quantityKg > 0 && quantityPieces === 0) {
      // Only kg
      stockDisplay = `${quantityKg} kg`;
      stockBadgeClass = quantityKg < 10 ? 'low' : (quantityKg < 20 ? 'medium' : 'high');
    } else if (quantityPieces > 0 && quantityKg === 0) {
      // Only pieces
      stockDisplay = `${quantityPieces} pcs`;
      stockBadgeClass = quantityPieces < 10 ? 'low' : (quantityPieces < 20 ? 'medium' : 'high');
    } else if (quantityKg > 0 && quantityPieces > 0) {
      // Both units
      stockDisplay = `${quantityKg} kg, ${quantityPieces} pcs`;
      const totalStock = quantityKg + quantityPieces;
      stockBadgeClass = totalStock < 10 ? 'low' : (totalStock < 20 ? 'medium' : 'high');
    } else {
      // No stock
      stockDisplay = '0';
      stockBadgeClass = 'low';
    }

    // Calculate sales from actual sales data (placeholder for now)
    const sales = 0; // TODO: Calculate from sales table

    tr.innerHTML = `
      <td>${product.name || '-'}</td>
      <td>${product.sku || '-'}</td>
      <td>${product.category || '-'}</td>
      <td>KSH ${Number(product.buying_price || 0).toFixed(2)}</td>
      <td>KSH ${Number(product.selling_price || 0).toFixed(2)}</td>
      <td><span class="stock-badge ${stockBadgeClass}">${stockDisplay}</span></td>
      <td>KSH ${sales.toFixed(2)}</td>
      <td>
        <button class="table-btn edit" data-id="${product.id}">
          <i class="fas fa-pen"></i>
        </button>
        <button class="table-btn delete" data-id="${product.id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach edit and delete button listeners
  attachInventoryActionListeners();
}

// Setup search functionality for inventory
function setupInventorySearch() {
  const searchInput = document.getElementById('search_inventory');
  if (!searchInput) return;

  searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.trim().toLowerCase();
    filterInventoryProducts(searchTerm);
  });
}

// Filter products based on search term
function filterInventoryProducts(searchTerm) {
  if (!searchTerm) {
    // If search is empty, show all products
    renderInventoryTable(allProducts);
    return;
  }

  // Filter products by name, SKU, or category
  const filteredProducts = allProducts.filter(product => {
    const name = (product.name || '').toLowerCase();
    const sku = (product.sku || '').toLowerCase();
    const category = (product.category || '').toLowerCase();
    
    return name.includes(searchTerm) || 
           sku.includes(searchTerm) || 
           category.includes(searchTerm);
  });

  renderInventoryTable(filteredProducts);
}

// Attach event listeners to edit and delete buttons
function attachInventoryActionListeners() {
  // Edit buttons
  document.querySelectorAll('.table-btn.edit').forEach(btn => {
    btn.addEventListener('click', function() {
      const productId = this.getAttribute('data-id');
      openEditModal(productId);
    });
  });

  // Delete buttons
  document.querySelectorAll('.table-btn.delete').forEach(btn => {
    btn.addEventListener('click', function() {
      const productId = this.getAttribute('data-id');
      openDeleteModal(productId);
    });
  });
}

// Keep the old loadProducts function for backward compatibility if needed
async function loadProducts() {
  const tbody = document.querySelector('#products-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Loading...</td></tr>';

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--danger-color);">Error loading products</td></tr>';
    console.error(error);
    return;
  }

  tbody.innerHTML = '';
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No products found</td></tr>';
    return;
  }

  data.forEach(product => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="font-weight: 500; color: var(--dark-color);">${product.name}</div>
      </td>
      <td>${product.quantity_kg || 0}</td>
      <td>${product.quantity_pieces || 0}</td>
      <td>$${Number(product.buying_price).toFixed(2)}</td>
      <td>$${Number(product.selling_price).toFixed(2)}</td>
      <td>${product.expiry_date || '-'}</td>
      <td>
        <button data-id="${product.id}" class="update-stock-btn quick-action-btn" style="padding: 6px 12px; font-size: 13px;">Update Stock</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach listeners
  document.querySelectorAll('.update-stock-btn').forEach(btn => {
    btn.addEventListener('click', () => openUpdateStockPrompt(btn.dataset.id));
  });
}

// Modal functions for edit and delete
function openEditModal(productId) {
  // Find product from allProducts
  const product = allProducts.find(p => p.id == productId);
  
  if (!product) {
    alert('Product not found');
    return;
  }

  const modal = document.getElementById('editModal');
  const form = document.getElementById('editProductForm');
  
  if (!modal || !form) {
    alert('Edit modal not found');
    return;
  }

  // Populate form with product data
  form.innerHTML = `
    <div class="form-group">
      <label for="edit_name">Product Name</label>
      <input type="text" id="edit_name" value="${product.name || ''}" required>
    </div>
    <div class="form-group">
      <label for="edit_sku">SKU</label>
      <input type="text" id="edit_sku" value="${product.sku || ''}" required>
    </div>
    <div class="form-group">
      <label for="edit_category">Category</label>
      <input type="text" id="edit_category" value="${product.category || ''}">
    </div>
    <div class="form-group two-cols">
      <div>
        <label for="edit_buy_price">Buying Price (KSH)</label>
        <input type="number" id="edit_buy_price" value="${product.buying_price || 0}" step="0.01" min="0" required>
      </div>
      <div>
        <label for="edit_sell_price">Selling Price (KSH)</label>
        <input type="number" id="edit_sell_price" value="${product.selling_price || 0}" step="0.01" min="0" required>
      </div>
    </div>
    <div class="form-group two-cols">
      <div>
        <label for="edit_stock">Stock (Pieces)</label>
        <input type="number" id="edit_stock" value="${product.quantity_pieces || 0}" min="0" required>
      </div>
      <div>
        <label for="edit_stock_kg">Stock (Kg)</label>
        <input type="number" id="edit_stock_kg" value="${product.quantity_kg || 0}" min="0">
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="secondary-btn" onclick="closeModal('editModal')">Cancel</button>
      <button type="submit" class="primary-btn">Save Changes</button>
    </div>
  `;
  
  // Add form submission
  form.onsubmit = async function(e) {
    e.preventDefault();
    
    const updatedData = {
      name: document.getElementById('edit_name').value.trim(),
      sku: document.getElementById('edit_sku').value.trim(),
      category: document.getElementById('edit_category').value.trim(),
      buying_price: Number(document.getElementById('edit_buy_price').value),
      selling_price: Number(document.getElementById('edit_sell_price').value),
      quantity_pieces: Number(document.getElementById('edit_stock').value),
      quantity_kg: Number(document.getElementById('edit_stock_kg').value) || 0
    };

    const { error } = await supabase
      .from('products')
      .update(updatedData)
      .eq('id', productId);

    if (error) {
      alert('Error updating product: ' + error.message);
      console.error(error);
      return;
    }

    alert('Product updated successfully!');
    closeModal('editModal');
    
    // Reload products and refresh table
    await loadInventoryProducts();
  };
  
  modal.classList.add('active');
}

function openDeleteModal(productId) {
  const modal = document.getElementById('deleteModal');
  const confirmBtn = document.getElementById('confirmDelete');
  
  if (!modal || !confirmBtn) {
    alert('Delete modal not found');
    return;
  }

  // Find product name for confirmation
  const product = allProducts.find(p => p.id == productId);
  const productName = product ? product.name : 'this product';

  confirmBtn.onclick = async function() {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      alert('Error deleting product: ' + error.message);
      console.error(error);
      return;
    }

    alert('Product deleted successfully!');
    closeModal('deleteModal');
    
    // Reload products and refresh table
    await loadInventoryProducts();
  };
  
  modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// Setup modal close buttons
function setupModalControls() {
  const closeEditModal = document.getElementById('closeEditModal');
  const closeDeleteModal = document.getElementById('closeDeleteModal');
  const cancelDelete = document.getElementById('cancelDelete');

  if (closeEditModal) {
    closeEditModal.addEventListener('click', () => closeModal('editModal'));
  }

  if (closeDeleteModal) {
    closeDeleteModal.addEventListener('click', () => closeModal('deleteModal'));
  }

  if (cancelDelete) {
    cancelDelete.addEventListener('click', () => closeModal('deleteModal'));
  }

  // Close modals when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('active');
      }
    });
  });
}

function setupAddProductForm() {
  const form = document.getElementById('add-product-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const name = document.getElementById('product_name').value.trim();
    const sku = document.getElementById('sku').value.trim();
    const category = document.getElementById('category').value.trim();
    const stock = Number(document.getElementById('stock').value) || 0;
    const unit = document.getElementById('unit').value;
    const buyingPrice = Number(document.getElementById('buy_price').value);
    const sellingPrice = Number(document.getElementById('sell_price').value);

    // Validate required fields
    if (!name || !sku || !unit || !buyingPrice || !sellingPrice) {
      alert('Please fill in all required fields');
      return;
    }

    // Determine quantity based on unit
    let quantityKg = 0;
    let quantityPieces = 0;
    
    if (unit === 'kg') {
      quantityKg = stock;
      quantityPieces = 0;
    } else {
      // For pieces, cartons, bale, outer - all go to pieces
      quantityPieces = stock;
      quantityKg = 0;
    }

    // Show loading state
    const submitBtn = form.querySelector('.primary-btn');
    if (submitBtn) {
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;
    }

    try {
      const { data, error } = await supabase.from('products').insert({
        name,
        sku,
        category: category || null,
        quantity_kg: quantityKg,
        quantity_pieces: quantityPieces,
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        created_by: currentUserId
      }).select();

      if (error) {
        throw error;
      }

      // Success - reset form and reload inventory
      form.reset();
      
      // Show success message
      alert('Product added successfully!');
      
      // Reload inventory products to show the new product immediately
      await loadInventoryProducts();
      
      // Clear search if active to show the new product
      const searchInput = document.getElementById('search_inventory');
      if (searchInput) {
        searchInput.value = '';
      }
      
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product: ' + (error.message || 'Unknown error'));
    } finally {
      // Reset button state
      if (submitBtn) {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    }
  });
}

async function openUpdateStockPrompt(productId) {
  // Get current product
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !product) {
    alert('Error fetching product');
    console.error(error);
    return;
  }

  const newKg = prompt(`Current kg: ${product.quantity_kg || 0}\nEnter new kg (leave blank to keep same):`);
  if (newKg === null) return; // Cancelled

  const newPieces = prompt(`Current pieces: ${product.quantity_pieces || 0}\nEnter new pieces (leave blank to keep same):`);
  if (newPieces === null) return; // Cancelled

  const updated = {
    quantity_kg: newKg === '' ? product.quantity_kg : Number(newKg),
    quantity_pieces: newPieces === '' ? product.quantity_pieces : Number(newPieces)
  };

  // Insert into stock_history
  const { error: historyError } = await supabase.from('stock_history').insert({
    product_id: product.id,
    old_quantity: JSON.stringify({
      kg: product.quantity_kg,
      pieces: product.quantity_pieces
    }),
    new_quantity: JSON.stringify({
      kg: updated.quantity_kg,
      pieces: updated.quantity_pieces
    }),
    user_id: currentUserId,
    action_type: 'MANUAL_UPDATE'
  });

  if (historyError) {
    console.error('Error logging stock history:', historyError);
    // Continue anyway
  }

  // Update products table
  const { error: updateError } = await supabase
    .from('products')
    .update(updated)
    .eq('id', product.id);

  if (updateError) {
    alert('Error updating product');
    console.error(updateError);
    return;
  }

  loadProducts();
}


function getTodayRangeISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

async function loadAdminTodayAnalytics() {
  const { start, end } = getTodayRangeISO();

  const { data, error } = await supabase
    .from('sales')
    .select('total_amount')
    .gte('created_at', start)
    .lt('created_at', end);

  if (error) {
    console.error(error);
    return;
  }

  const total = data.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

  const totalEl = document.getElementById('totalRevenue');
  const salesCountEl = document.getElementById('currentSales'); // Using existing IDs from admin.html

  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
  // Note: 'currentSales' in HTML seems to be for today's sales amount or count? 
  // The HTML says "Today's running total", so let's put the count or maybe the same amount?
  // Actually, let's put the count in a new element if needed, or just update the existing ones.
  // The HTML has:
  // id="totalRevenue" -> $24,850
  // id="currentSales" -> $3,420 (Today's running total)

  if (salesCountEl) salesCountEl.textContent = `$${total.toFixed(2)}`;
}