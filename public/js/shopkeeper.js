// js/shopkeeper.js

let shopkeeperUserId = null;
let allProducts = []; // full list from DB

document.addEventListener('DOMContentLoaded', async () => {
  // --- UI INITIALIZATION ---
  
  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // Theme toggle is handled by theme.js

  // Tab switching
  const menuItems = document.querySelectorAll('.menu-item');
  const contentSections = document.querySelectorAll('.content-section');
  
  menuItems.forEach(item => {
    item.addEventListener('click', function() {
      const tab = this.dataset.tab;
      
      // Update active menu item
      menuItems.forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      
      // Show content section
      contentSections.forEach(section => section.classList.remove('active'));
      document.getElementById(tab).classList.add('active');
    });
  });

  // Current Date
  const currentDate = document.getElementById('currentDate');
  if (currentDate) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDate.textContent = now.toLocaleDateString('en-US', options);
  }

  // --- AUTH & DATA LOADING ---

  const authInfo = await requireAuthAndRole('shopkeeper');
  if (!authInfo) return;
  shopkeeperUserId = authInfo.session.user.id;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });

  // Search handler (Inventory)
  const inventorySearch = document.getElementById('search_inventory');
  if (inventorySearch) {
    inventorySearch.addEventListener('input', () => {
      const term = inventorySearch.value.trim().toLowerCase();
      if (!term) {
        renderProductsTable(allProducts);
        return;
      }
      const filtered = allProducts.filter(p =>
        (p.name || '').toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term)
      );
      renderProductsTable(filtered);
    });
  }

  // Initial Data Load
  await loadProducts();
  await loadTodaySummary();
  await loadRecentSales();
  
  // Setup sale form
  setupSaleForm();
});

/* ---------- PRODUCTS / INVENTORY ---------- */

async function loadProducts() {
  const tbody = document.querySelector('#inventoryTable');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Loading...</td></tr>';

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--danger-color);">Error loading products</td></tr>';
    return;
  }

  allProducts = data || [];
  renderProductsTable(allProducts);
  
  // Repopulate sale form products if function exists
  if (window.populateSaleProducts) {
    window.populateSaleProducts();
  }
}

function renderProductsTable(products) {
  const tbody = document.querySelector('#inventoryTable');
  if (!tbody) return;
  
  tbody.innerHTML = '';

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No products found</td></tr>';
    return;
  }

  products.forEach(product => {
    const tr = document.createElement('tr');
    
    // Format stock display
    const quantityPieces = product.quantity_pieces || 0;
    const quantityKg = product.quantity_kg || 0;
    let stockDisplay = '';
    
    if (quantityKg > 0 && quantityPieces === 0) {
      stockDisplay = `${quantityKg} kg`;
    } else if (quantityPieces > 0 && quantityKg === 0) {
      stockDisplay = `${quantityPieces} pcs`;
    } else if (quantityKg > 0 && quantityPieces > 0) {
      stockDisplay = `${quantityKg} kg, ${quantityPieces} pcs`;
    } else {
      stockDisplay = '0';
    }

    tr.innerHTML = `
      <td>${product.name || '-'}</td>
      <td>${product.sku || '-'}</td>
      <td>${product.category || '-'}</td>
      <td>KSH ${Number(product.selling_price || 0).toFixed(2)}</td>
      <td>${stockDisplay}</td>
    `;

    tbody.appendChild(tr);
  });
}

async function openSellPrompt(product) {
  const quantityStr = prompt(
    `Selling product: ${product.name}\nCurrent pieces: ${product.quantity_pieces ?? 0}\n\nEnter quantity to sell (pieces):`
  );

  if (quantityStr === null) return; // user cancelled

  const quantity = Number(quantityStr);
  if (!quantity || quantity <= 0) {
    alert('Invalid quantity');
    return;
  }

  if ((product.quantity_pieces ?? 0) < quantity) {
    alert('Not enough stock!');
    return;
  }

  const totalAmount = quantity * product.selling_price;

  // 1. Insert into sales table
  const { error: saleError } = await supabase.from('sales').insert({
    product_id: product.id,
    quantity,
    total_amount: totalAmount
  });

  if (saleError) {
    console.error(saleError);
    alert('Error recording sale');
    return;
  }

  // 2. Update product stock
  const newPieces = (product.quantity_pieces ?? 0) - quantity;

  const { error: updateError } = await supabase
    .from('products')
    .update({ quantity_pieces: newPieces })
    .eq('id', product.id);

  if (updateError) {
    console.error(updateError);
    alert('Error updating stock');
    return;
  }

  // 3. Stock history (optional but good)
  const { error: historyError } = await supabase.from('stock_history').insert({
    product_id: product.id,
    old_quantity: JSON.stringify({
      kg: product.quantity_kg,
      pieces: product.quantity_pieces
    }),
    new_quantity: JSON.stringify({
      kg: product.quantity_kg,
      pieces: newPieces
    }),
    user_id: shopkeeperUserId,
    action_type: 'SALE'
  });

  if (historyError) {
    console.error(historyError);
  }

  alert(`Sale recorded. Total = $${totalAmount.toFixed(2)}`);

  // Update local cache product + refresh UI
  product.quantity_pieces = newPieces;
  await loadProducts();          // reload table
  await loadTodaySummary();      // update summary
  await loadRecentSales();       // update recent sales
}

/* ---------- TODAY SUMMARY ---------- */

function getTodayRangeISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

async function loadTodaySummary() {
  const { start, end } = getTodayRangeISO();

  const { data, error } = await supabase
    .from('sales')
    .select('total_amount, created_at')
    .gte('created_at', start)
    .lt('created_at', end);

  if (error) {
    console.error(error);
    return;
  }

  const totalAmount = data.reduce(
    (sum, s) => sum + Number(s.total_amount || 0),
    0
  );

  document.getElementById('today-total-amount').textContent = `$${totalAmount.toFixed(2)}`;
  document.getElementById('today-total-sales').textContent = data.length;
}

/* ---------- RECENT SALES ---------- */

async function loadRecentSales() {
  const tbody = document.querySelector('#sales-table tbody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Loading...</td></tr>';

  const { data, error } = await supabase
    .from('sales')
    .select('id, quantity, total_amount, unit, created_at, products(name, selling_price)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--danger-color);">Error loading sales</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No recent sales</td></tr>';
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');
    const orderId = `#ORD-${String(row.id).padStart(3, '0')}`;
    const saleDate = new Date(row.created_at);
    const unit = row.unit || 'pcs';
    tr.innerHTML = `
      <td>${orderId}</td>
      <td>${row.products?.name || 'Unknown Product'}</td>
      <td>${row.quantity} ${unit}</td>
      <td>KSH ${Number(row.products?.selling_price || 0).toFixed(2)}</td>
      <td>KSH ${Number(row.total_amount).toFixed(2)}</td>
      <td>${saleDate.toLocaleDateString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- SALE FORM HANDLING ---------- */

function setupSaleForm() {
  const saleForm = document.getElementById('sale-form');
  if (!saleForm) return;

  const saleProductSelect = document.getElementById('sale_product');
  const saleQuantityInput = document.getElementById('sale_quantity');
  const saleUnitSelect = document.getElementById('sale_unit');
  const saleStockDisplay = document.getElementById('sale_stock_display');
  const salePriceDisplay = document.getElementById('sale_price_display');
  const saleTotalDisplay = document.getElementById('sale_total_display');

  if (!saleProductSelect || !saleQuantityInput || !saleUnitSelect) return;

  // Populate product dropdown
  function populateSaleProducts() {
    saleProductSelect.innerHTML = '<option value="">Select product...</option>';
    
    allProducts.forEach(product => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = `${product.name} (${product.sku || 'N/A'})`;
      option.dataset.quantityKg = product.quantity_kg || 0;
      option.dataset.quantityPieces = product.quantity_pieces || 0;
      saleProductSelect.appendChild(option);
    });
  }

  // Update preview and stock display
  function updateSalePreview() {
    const productId = saleProductSelect.value;
    const quantity = parseInt(saleQuantityInput.value, 10) || 0;
    const unit = saleUnitSelect.value;

    const product = allProducts.find(p => p.id == productId);

    if (!product) {
      if (saleStockDisplay) saleStockDisplay.textContent = '—';
      if (salePriceDisplay) salePriceDisplay.textContent = '—';
      if (saleTotalDisplay) saleTotalDisplay.textContent = '—';
      return;
    }

    // Display available stock based on selected unit
    if (unit === 'kg') {
      const availableKg = product.quantity_kg || 0;
      if (saleStockDisplay) {
        saleStockDisplay.textContent = `${availableKg} kg available`;
        saleStockDisplay.style.color = availableKg >= quantity ? '#059669' : '#dc2626';
      }
    } else if (unit && unit !== '') {
      // For pieces, cartons, bale, outer - all use pieces
      const availablePieces = product.quantity_pieces || 0;
      if (saleStockDisplay) {
        saleStockDisplay.textContent = `${availablePieces} pieces available`;
        saleStockDisplay.style.color = availablePieces >= quantity ? '#059669' : '#dc2626';
      }
    } else {
      // Show both if no unit selected
      const availableKg = product.quantity_kg || 0;
      const availablePieces = product.quantity_pieces || 0;
      if (saleStockDisplay) {
        if (availableKg > 0 && availablePieces > 0) {
          saleStockDisplay.textContent = `${availableKg} kg, ${availablePieces} pieces available`;
        } else if (availableKg > 0) {
          saleStockDisplay.textContent = `${availableKg} kg available`;
        } else if (availablePieces > 0) {
          saleStockDisplay.textContent = `${availablePieces} pieces available`;
        } else {
          saleStockDisplay.textContent = 'No stock available';
          saleStockDisplay.style.color = '#dc2626';
        }
      }
    }

    if (salePriceDisplay) {
      salePriceDisplay.textContent = `KSH ${Number(product.selling_price || 0).toFixed(2)}`;
    }

    if (quantity > 0 && saleTotalDisplay) {
      const total = Number(product.selling_price || 0) * quantity;
      saleTotalDisplay.textContent = `KSH ${total.toFixed(2)}`;
    } else if (saleTotalDisplay) {
      saleTotalDisplay.textContent = '—';
    }
  }

  // Event listeners
  saleProductSelect.addEventListener('change', updateSalePreview);
  saleQuantityInput.addEventListener('input', updateSalePreview);
  saleUnitSelect.addEventListener('change', updateSalePreview);

  // Form submission
  saleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const productId = saleProductSelect.value;
    const quantity = parseInt(saleQuantityInput.value, 10);
    const unit = saleUnitSelect.value;

    if (!productId || !quantity || quantity <= 0 || !unit) {
      alert('Please select a product, enter a valid quantity, and choose a unit.');
      return;
    }

    const product = allProducts.find(p => p.id == productId);

    if (!product) {
      alert('Product not found.');
      return;
    }

    // Check stock based on selected unit
    let availableStock = 0;
    let stockField = '';
    
    if (unit === 'kg') {
      availableStock = product.quantity_kg || 0;
      stockField = 'quantity_kg';
    } else {
      // For pieces, cartons, bale, outer - all use pieces
      availableStock = product.quantity_pieces || 0;
      stockField = 'quantity_pieces';
    }

    if (quantity > availableStock) {
      alert(`Not enough stock! Available: ${availableStock} ${unit === 'kg' ? 'kg' : 'pieces'}`);
      return;
    }

    // Show loading state
    const submitBtn = saleForm.querySelector('.primary-btn');
    if (submitBtn) {
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;
    }

    try {
      const totalAmount = Number(product.selling_price || 0) * quantity;

      // 1. Insert into sales table
      const { error: saleError } = await supabase.from('sales').insert({
        product_id: product.id,
        quantity,
        total_amount: totalAmount,
        unit: unit
      });

      if (saleError) {
        throw saleError;
      }

      // 2. Update product stock based on unit
      const updateData = {};
      if (unit === 'kg') {
        updateData.quantity_kg = (product.quantity_kg || 0) - quantity;
      } else {
        updateData.quantity_pieces = (product.quantity_pieces || 0) - quantity;
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', product.id);

      if (updateError) {
        throw updateError;
      }

      // 3. Update local product cache
      if (unit === 'kg') {
        product.quantity_kg = updateData.quantity_kg;
      } else {
        product.quantity_pieces = updateData.quantity_pieces;
      }

      // 4. Refresh UI
      await loadProducts();
      await loadTodaySummary();
      await loadRecentSales();

      // Reset form
      saleForm.reset();
      if (saleStockDisplay) saleStockDisplay.textContent = '—';
      if (salePriceDisplay) salePriceDisplay.textContent = '—';
      if (saleTotalDisplay) saleTotalDisplay.textContent = '—';

      alert(`Sale recorded successfully! Total: KSH ${totalAmount.toFixed(2)}`);

    } catch (error) {
      console.error('Error recording sale:', error);
      alert('Error recording sale: ' + (error.message || 'Unknown error'));
    } finally {
      // Reset button state
      if (submitBtn) {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    }
  });

  // Initial population - will be called after products load
  // Store reference to repopulate when products reload
  window.populateSaleProducts = populateSaleProducts;
}
