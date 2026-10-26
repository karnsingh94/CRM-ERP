import prisma from '../config/prisma.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const crmCoreService = {
  // ==================== CUSTOMERS ====================
  async listCustomers(companyId) {
    return prisma.crmCustomer.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createCustomer(companyId, data) {
    if (!data.companyName?.trim()) {
      throw coreError('Company name is required.');
    }
    const customer = await prisma.crmCustomer.create({
      data: {
        companyId,
        companyName: data.companyName.trim(),
        gstin: data.gstin?.trim() || null,
        contactPerson: data.contactPerson?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        industry: data.industry?.trim() || 'Technology & IT',
        requirements: data.requirements?.trim() || null,
        assignedTo: data.assignedTo?.trim() || null,
        status: data.status?.trim() || 'ACTIVE',
      },
    });

    // Auto-register Contact person under Contacts if contactPerson is provided
    let createdContact = null;
    if (data.contactPerson?.trim()) {
      try {
        createdContact = await prisma.crmContact.create({
          data: {
            companyId,
            name: data.contactPerson.trim(),
            companyName: data.companyName.trim(),
            role: data.role?.trim() || 'Primary Contact',
            email: data.email?.trim() || null,
            phone: data.phone?.trim() || null,
            channel: data.channel?.trim() || 'Direct',
          },
        });
      } catch (err) {
        // Silently continue if contact already exists
      }
    }

    return { ...customer, createdContact };
  },

  async removeCustomer(companyId, customerId) {
    const existing = await prisma.crmCustomer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!existing) throw coreError('Customer not found.', 404);
    await prisma.crmCustomer.delete({ where: { id: customerId } });
    return true;
  },

  // ==================== CONTACTS ====================
  async listContacts(companyId) {
    return prisma.crmContact.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createContact(companyId, data) {
    if (!data.name?.trim()) {
      throw coreError('Contact person name is required.');
    }
    return prisma.crmContact.create({
      data: {
        companyId,
        name: data.name.trim(),
        companyName: data.companyName?.trim() || null,
        role: data.role?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        channel: data.channel?.trim() || 'Email',
      },
    });
  },

  async removeContact(companyId, contactId) {
    const existing = await prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!existing) throw coreError('Contact not found.', 404);
    await prisma.crmContact.delete({ where: { id: contactId } });
    return true;
  },

  // ==================== OPPORTUNITIES ====================
  async listOpportunities(companyId) {
    return prisma.crmOpportunity.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createOpportunity(companyId, data) {
    if (!data.title?.trim()) {
      throw coreError('Opportunity title is required.');
    }
    const val = data.value !== undefined && data.value !== null && String(data.value).trim() !== ''
      ? parseFloat(String(data.value).replace(/[^0-9.]/g, ''))
      : null;

    return prisma.crmOpportunity.create({
      data: {
        companyId,
        title: data.title.trim(),
        companyName: data.companyName?.trim() || 'General Opportunity',
        stage: data.stage?.trim() || 'DISCOVERY',
        value: val !== null && !isNaN(val) ? val : null,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        probability: data.probability?.trim() || '50%',
      },
    });
  },

  async updateOpportunity(companyId, opportunityId, data) {
    const existing = await prisma.crmOpportunity.findFirst({
      where: { id: opportunityId, companyId },
    });
    if (!existing) throw coreError('Opportunity not found.', 404);

    const updateData = {};
    if (data.stage) updateData.stage = data.stage.trim();
    if (data.title) updateData.title = data.title.trim();
    if (data.probability) updateData.probability = data.probability.trim();
    if (data.value !== undefined) {
      const val = parseFloat(String(data.value).replace(/[^0-9.]/g, ''));
      updateData.value = !isNaN(val) ? val : null;
    }

    return prisma.crmOpportunity.update({
      where: { id: opportunityId },
      data: updateData,
    });
  },

  async removeOpportunity(companyId, opportunityId) {
    const existing = await prisma.crmOpportunity.findFirst({
      where: { id: opportunityId, companyId },
    });
    if (!existing) throw coreError('Opportunity not found.', 404);
    await prisma.crmOpportunity.delete({ where: { id: opportunityId } });
    return true;
  },

  // ==================== PRODUCTS ====================
  async listProducts(companyId) {
    return prisma.product.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createProduct(companyId, data) {
    if (!data.sku?.trim() || !data.name?.trim()) {
      throw coreError('SKU code and product name are required.');
    }
    const sku = data.sku.trim().toUpperCase();
    const existing = await prisma.product.findFirst({
      where: { companyId, sku },
    });
    if (existing) throw coreError(`Product with SKU "${sku}" already exists.`);

    return prisma.product.create({
      data: {
        companyId,
        sku,
        name: data.name.trim(),
        category: data.category?.trim() || 'Finished Goods',
        uom: data.uom?.trim() || 'PCS',
        sellingPrice: parseFloat(data.sellingPrice) || 0,
        purchasePrice: parseFloat(data.purchasePrice) || 0,
        stock: parseInt(data.stock) || 0,
        status: data.status?.trim() || 'ACTIVE',
      },
    });
  },

  async removeProduct(companyId, productId) {
    const existing = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!existing) throw coreError('Product not found.', 404);
    await prisma.product.delete({ where: { id: productId } });
    return true;
  },

  // ==================== SALES ORDERS ====================
  async listSalesOrders(companyId) {
    return prisma.salesOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createSalesOrder(companyId, data) {
    if (!data.customer?.trim()) {
      throw coreError('Customer name is required.');
    }
    const orderNo = data.orderNo?.trim() || `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;
    let computedAmount = parseFloat(data.amount) || 0;
    let computedItemsCount = parseInt(data.itemsCount) || 1;

    if (items) {
      computedItemsCount = items.reduce((acc, it) => acc + (parseInt(it.qty) || 1), 0);
      computedAmount = items.reduce((acc, it) => {
        const qty = parseInt(it.qty) || 1;
        const rate = parseFloat(it.rate) || 0;
        const gstPct = parseFloat(it.gst) || 0;
        const subtotal = qty * rate;
        const total = subtotal + (subtotal * gstPct) / 100;
        return acc + (it.total !== undefined ? parseFloat(it.total) : total);
      }, 0);
    }

    return prisma.salesOrder.create({
      data: {
        companyId,
        orderNo,
        customer: data.customer.trim(),
        date: data.date ? new Date(data.date) : new Date(),
        itemsCount: computedItemsCount,
        amount: computedAmount,
        items: items,
        notes: data.notes?.trim() || null,
        assignedTo: data.assignedTo?.trim() || null,
        status: data.status?.trim() || 'PENDING_APPROVAL',
        paymentStatus: data.paymentStatus?.trim() || 'PENDING',
      },
    });
  },

  async updateSalesOrderStatus(companyId, orderId, status, paymentStatus) {
    const existing = await prisma.salesOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!existing) throw coreError('Sales order not found.', 404);
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    return prisma.salesOrder.update({
      where: { id: orderId },
      data: updateData,
    });
  },

  async removeSalesOrder(companyId, orderId) {
    const existing = await prisma.salesOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!existing) throw coreError('Sales order not found.', 404);
    await prisma.salesOrder.delete({ where: { id: orderId } });
    return true;
  },

  // ==================== SALES QUOTATIONS ====================
  async listQuotations(companyId) {
    return prisma.salesQuotation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createQuotation(companyId, data) {
    if (!data.customer?.trim() || !data.title?.trim()) {
      throw coreError('Customer and quote title are required.');
    }
    const quoteNo = data.quoteNo?.trim() || `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;
    let computedAmount = parseFloat(data.amount) || 0;

    if (items) {
      computedAmount = items.reduce((acc, it) => {
        const qty = parseInt(it.qty) || 1;
        const rate = parseFloat(it.rate) || 0;
        const gstPct = parseFloat(it.gst) || 0;
        const subtotal = qty * rate;
        const total = subtotal + (subtotal * gstPct) / 100;
        return acc + (it.total !== undefined ? parseFloat(it.total) : total);
      }, 0);
    }

    return prisma.salesQuotation.create({
      data: {
        companyId,
        quoteNo,
        customer: data.customer.trim(),
        title: data.title.trim(),
        amount: computedAmount,
        items: items,
        notes: data.notes?.trim() || null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        status: data.status?.trim() || 'SENT',
      },
    });
  },

  async updateQuotationStatus(companyId, quoteId, status) {
    const existing = await prisma.salesQuotation.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!existing) throw coreError('Quotation not found.', 404);
    return prisma.salesQuotation.update({
      where: { id: quoteId },
      data: { status },
    });
  },

  async convertQuotationToOrder(companyId, quoteId) {
    const quote = await prisma.salesQuotation.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!quote) throw coreError('Quotation not found.', 404);

    const orderNo = `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const items = quote.items;
    const itemsCount = Array.isArray(items) ? items.reduce((acc, it) => acc + (parseInt(it.qty) || 1), 0) : 1;

    const newOrder = await prisma.salesOrder.create({
      data: {
        companyId,
        orderNo,
        customer: quote.customer,
        date: new Date(),
        itemsCount,
        amount: quote.amount,
        items: quote.items,
        notes: quote.notes ? `Converted from Quote ${quote.quoteNo}. ${quote.notes}` : `Converted from Quote ${quote.quoteNo}`,
        status: 'APPROVED',
        paymentStatus: 'PENDING',
      },
    });

    await prisma.salesQuotation.update({
      where: { id: quoteId },
      data: { status: 'ACCEPTED' },
    });

    return newOrder;
  },

  async removeQuotation(companyId, quoteId) {
    const existing = await prisma.salesQuotation.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!existing) throw coreError('Quotation not found.', 404);
    await prisma.salesQuotation.delete({ where: { id: quoteId } });
    return true;
  },

  // ==================== SALES PROFORMA ====================
  async listProformas(companyId) {
    return prisma.salesProforma.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createProforma(companyId, data) {
    if (!data.customer?.trim()) {
      throw coreError('Customer name is required.');
    }
    const invoiceNo = data.invoiceNo?.trim() || `PI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return prisma.salesProforma.create({
      data: {
        companyId,
        invoiceNo,
        customer: data.customer.trim(),
        orderRef: data.orderRef?.trim() || null,
        amount: parseFloat(data.amount) || 0,
        date: data.date ? new Date(data.date) : new Date(),
        status: data.status?.trim() || 'ISSUED',
      },
    });
  },

  async updateProformaStatus(companyId, proformaId, status) {
    const existing = await prisma.salesProforma.findFirst({
      where: { id: proformaId, companyId },
    });
    if (!existing) throw coreError('Proforma invoice not found.', 404);
    return prisma.salesProforma.update({
      where: { id: proformaId },
      data: { status },
    });
  },

  async removeProforma(companyId, proformaId) {
    const existing = await prisma.salesProforma.findFirst({
      where: { id: proformaId, companyId },
    });
    if (!existing) throw coreError('Proforma invoice not found.', 404);
    await prisma.salesProforma.delete({ where: { id: proformaId } });
    return true;
  },

  // ==================== VENDORS ====================
  async listVendors(companyId) {
    return prisma.vendor.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createVendor(companyId, data) {
    if (!data.name?.trim()) {
      throw coreError('Vendor/Supplier name is required.');
    }
    return prisma.vendor.create({
      data: {
        companyId,
        name: data.name.trim(),
        contact: data.contact?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        category: data.category?.trim() || 'Raw Materials',
        rating: data.rating?.trim() || '5.0 ★',
      },
    });
  },

  async removeVendor(companyId, vendorId) {
    const existing = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
    });
    if (!existing) throw coreError('Vendor not found.', 404);
    await prisma.vendor.delete({ where: { id: vendorId } });
    return true;
  },

  // ==================== INVENTORY STOCKS ====================
  async listInventoryStocks(companyId) {
    return prisma.inventoryStock.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createInventoryStock(companyId, data) {
    if (!data.sku?.trim() || !data.name?.trim()) {
      throw coreError('SKU and item name are required.');
    }
    const sku = data.sku.trim().toUpperCase();
    const warehouse = data.warehouse?.trim() || 'Main Warehouse';

    const existing = await prisma.inventoryStock.findFirst({
      where: { companyId, sku, warehouse },
    });
    if (existing) {
      throw coreError(`Item ${sku} already registered in ${warehouse}.`);
    }

    return prisma.inventoryStock.create({
      data: {
        companyId,
        sku,
        name: data.name.trim(),
        warehouse,
        stock: parseInt(data.stock) || 0,
        reorderLevel: parseInt(data.reorderLevel) || 10,
        uom: data.uom?.trim() || 'PCS',
      },
    });
  },

  async adjustInventoryStock(companyId, stockId, qtyDiff) {
    const existing = await prisma.inventoryStock.findFirst({
      where: { id: stockId, companyId },
    });
    if (!existing) throw coreError('Stock item not found.', 404);

    const diff = parseInt(qtyDiff) || 0;
    const newStock = Math.max(0, existing.stock + diff);

    return prisma.inventoryStock.update({
      where: { id: stockId },
      data: { stock: newStock },
    });
  },
};

export default crmCoreService;
