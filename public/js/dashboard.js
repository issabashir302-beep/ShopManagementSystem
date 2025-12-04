// Tab Switching
document.addEventListener('DOMContentLoaded', function() {
    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show active tab content
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === tabId) {
                    pane.classList.add('active');
                }
            });
        });
    });
    
    // Add Product Form Submission
    const addProductForm = document.getElementById('add-product-form');
    if (addProductForm) {
        addProductForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('.primary-btn');
            submitBtn.classList.add('loading');
            
            // Get form data
            const formData = {
                name: document.getElementById('product_name').value,
                sku: document.getElementById('sku').value,
                category: document.getElementById('category').value,
                price: parseFloat(document.getElementById('price').value),
                stock: parseInt(document.getElementById('stock').value)
            };
            
            // Simulate API call
            setTimeout(() => {
                console.log('Product added:', formData);
                alert('Product added successfully!');
                
                // Reset form
                addProductForm.reset();
                submitBtn.classList.remove('loading');
                
                // Update stats (in real app, this would come from backend)
                updateStats();
            }, 1500);
        });
    }
    
    // Inventory search functionality
    const searchInput = document.getElementById('search_inventory');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const tableRows = document.querySelectorAll('#inventoryTable tr');
            
            tableRows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
    
    // Edit and Delete buttons
    document.querySelectorAll('.table-btn.edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            openEditModal(productId);
        });
    });
    
    document.querySelectorAll('.table-btn.delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            openDeleteModal(productId);
        });
    });
    
    // Modal controls
    const closeEditModal = document.getElementById('closeEditModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    
    if (closeEditModal) closeEditModal.addEventListener('click', () => closeModal('editModal'));
    if (closeDeleteModal) closeDeleteModal.addEventListener('click', () => closeModal('deleteModal'));
    if (cancelDelete) cancelDelete.addEventListener('click', () => closeModal('deleteModal'));
    
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            alert('Export feature would generate a CSV/Excel file in a real application.');
        });
    }
});

function openEditModal(productId) {
    // In a real app, fetch product data from backend
    const productData = {
        id: productId,
        name: 'Sample Product',
        sku: 'SAMPLE-001',
        category: 'Sample Category',
        price: 10.99,
        stock: 50
    };
    
    const modal = document.getElementById('editModal');
    const form = document.getElementById('editProductForm');
    
    // Populate form with product data
    form.innerHTML = `
        <div class="form-group">
            <label for="edit_name">Product Name</label>
            <input type="text" id="edit_name" value="${productData.name}" required>
        </div>
        <div class="form-group">
            <label for="edit_sku">SKU</label>
            <input type="text" id="edit_sku" value="${productData.sku}" required>
        </div>
        <div class="form-group">
            <label for="edit_category">Category</label>
            <input type="text" id="edit_category" value="${productData.category}">
        </div>
        <div class="form-group two-cols">
            <div>
                <label for="edit_price">Price (RM)</label>
                <input type="number" id="edit_price" value="${productData.price}" step="0.01" min="0" required>
            </div>
            <div>
                <label for="edit_stock">Stock</label>
                <input type="number" id="edit_stock" value="${productData.stock}" min="0" required>
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="secondary-btn" onclick="closeModal('editModal')">Cancel</button>
            <button type="submit" class="primary-btn">Save Changes</button>
        </div>
    `;
    
    // Add form submission
    form.onsubmit = function(e) {
        e.preventDefault();
        // Handle update logic here
        alert('Product updated successfully!');
        closeModal('editModal');
    };
    
    modal.classList.add('active');
}

function openDeleteModal(productId) {
    const modal = document.getElementById('deleteModal');
    const confirmBtn = document.getElementById('confirmDelete');
    
    confirmBtn.onclick = function() {
        // Handle delete logic here
        console.log('Deleting product:', productId);
        alert('Product deleted successfully!');
        closeModal('deleteModal');
    };
    
    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function updateStats() {
    // This function would update stats from backend in a real app
    console.log('Updating dashboard stats...');
}