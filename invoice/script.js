// State Array starting empty
let items = [];

// Elements
const itemsBody = document.getElementById('items-body');
const materialForm = document.getElementById('material-form');
const printBtn = document.getElementById('print-btn');
const subtotalEl = document.getElementById('subtotal');
const freightCostEl = document.getElementById('freight-cost');
const taxRateEl = document.getElementById('tax-rate');
const taxAmountEl = document.getElementById('tax-amount');
const grandTotalEl = document.getElementById('grand-total');

// Format Currency Utility
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

// Calculate single line item CWT total (Hundredweight)
const calculateLineTotal = (weight, basePrice, surcharge) => {
    const cwtWeight = weight / 100;
    const totalCwtPrice = basePrice + surcharge;
    return cwtWeight * totalCwtPrice;
};

// Render Items in Table
const renderItems = () => {
    itemsBody.innerHTML = '';
    
    if (items.length === 0) {
        itemsBody.innerHTML = `
            <tr id="empty-state">
                <td colspan="8" class="text-center" style="color: var(--text-muted); padding: 2rem;">No items added yet. Use the form above to add materials.</td>
            </tr>
        `;
    } else {
        items.forEach((item) => {
            const tr = document.createElement('tr');
            
            const lineTotal = calculateLineTotal(item.weight, item.basePrice, item.surcharge);
            
            tr.innerHTML = `
                <td class="col-desc">${item.desc}</td>
                <td class="col-grade">${item.grade}</td>
                <td class="col-heat">${item.heat}</td>
                <td class="col-weight">${item.weight}</td>
                <td class="col-price">${item.basePrice.toFixed(2)}</td>
                <td class="col-surcharge">${item.surcharge.toFixed(2)}</td>
                <td class="col-total">${formatCurrency(lineTotal)}</td>
                <td class="col-action no-print">
                    <button class="btn-danger delete-btn" data-id="${item.id}" title="Remove Row">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            itemsBody.appendChild(tr);
        });
    }
    
    // Attach delete events to new buttons
    const deleteBtns = document.querySelectorAll('.delete-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            removeItem(id);
        });
    });
    
    calculateTotals();
};

// Calculate and Update Grand Totals
const calculateTotals = () => {
    // 1. Material Subtotal
    const materialSubtotal = items.reduce((sum, item) => {
        return sum + calculateLineTotal(item.weight, item.basePrice, item.surcharge);
    }, 0);
    
    // 2. Freight
    const freightCost = parseFloat(freightCostEl.value) || 0;
    
    // 3. Tax
    const taxRateStr = taxRateEl.innerText.replace(/[^0-9.]/g, ''); 
    const taxRate = parseFloat(taxRateStr) || 0; 
    const taxAmount = materialSubtotal * (taxRate / 100);
    
    // 4. Grand Total
    const grandTotal = materialSubtotal + freightCost + taxAmount;
    
    // Update DOM texts
    subtotalEl.innerText = formatCurrency(materialSubtotal);
    taxAmountEl.innerText = formatCurrency(taxAmount);
    grandTotalEl.innerText = formatCurrency(grandTotal);
};

// Handle Form Submission (Add Item)
materialForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent page reload
    
    // Get values
    const desc = document.getElementById('input-desc').value;
    const grade = document.getElementById('input-grade').value;
    const heat = document.getElementById('input-heat').value;
    const weight = parseFloat(document.getElementById('input-weight').value) || 0;
    const basePrice = parseFloat(document.getElementById('input-price').value) || 0;
    const surcharge = parseFloat(document.getElementById('input-surcharge').value) || 0;
    
    // Create new item object
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    
    items.push({
        id: newId,
        desc,
        grade,
        heat,
        weight,
        basePrice,
        surcharge
    });
    
    // Reset form after adding
    materialForm.reset();
    document.getElementById('input-desc').focus(); // Put cursor back for next item
    
    // Re-render
    renderItems();
});

// Remove Item by ID
const removeItem = (id) => {
    items = items.filter(item => item.id !== id);
    renderItems();
};

// Init Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    renderItems(); // Render empty state initially
    
    // Print logic
    printBtn.addEventListener('click', () => { window.print(); });
    
    // Listen for Freight change
    freightCostEl.addEventListener('input', calculateTotals);
    
    // Listen for Tax Rate change in contenteditable
    taxRateEl.addEventListener('input', calculateTotals);
    
    // Prevent Enter key in contenteditable fields from breaking lines
    const singleLineEditables = document.querySelectorAll('.invoice-meta .editable, .tax-row .editable, .weight-summary .editable');
    singleLineEditables.forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    });
});
