import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { approvalService } from '../approval.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function returnError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function documentNo(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const timeSuffix = Date.now().toString().slice(-4);
  return `${prefix}-${year}${month}-${timeSuffix}${rand}`;
}

export const returnsService = {
  // =========================================================================
  // 1. DASHBOARD & ELIGIBLE DISPATCHES
  // =========================================================================
  async getDashboard(companyId) {
    const [
      pendingRma,
      approvedRma,
      awaitingInspection,
      inspectedRma,
      dispositionAgg,
      financialAgg,
    ] = await Promise.all([
      prisma.customerReturn.count({
        where: { companyId, status: { in: ['REQUESTED', 'PENDING_APPROVAL'] } },
      }),
      prisma.customerReturn.count({
        where: { companyId, status: 'APPROVED' },
      }),
      prisma.customerReturn.count({
        where: { companyId, status: 'GOODS_RECEIVED' },
      }),
      prisma.customerReturn.count({
        where: { companyId, status: { in: ['INSPECTED', 'CLOSED'] } },
      }),
      prisma.customerReturnInspection.aggregate({
        where: { companyId },
        _sum: {
          restockQty: true,
          reworkQty: true,
          rejectQty: true,
          scrapQty: true,
          inspectedQty: true,
        },
      }),
      prisma.customerReturn.aggregate({
        where: {
          companyId,
          status: { notIn: ['REJECTED', 'CANCELLED'] },
        },
        _sum: {
          totalReturnedAmount: true,
          totalReturnedQty: true,
        },
      }),
    ]);

    return {
      pendingRma,
      approvedRma,
      awaitingInspection,
      inspectedRma,
      returnedStockByDisposition: {
        restockQty: Number(dispositionAgg._sum.restockQty || 0),
        reworkQty: Number(dispositionAgg._sum.reworkQty || 0),
        rejectQty: Number(dispositionAgg._sum.rejectQty || 0),
        scrapQty: Number(dispositionAgg._sum.scrapQty || 0),
        totalInspectedQty: Number(dispositionAgg._sum.inspectedQty || 0),
      },
      totalReturnFinancialExposure: Number(financialAgg._sum.totalReturnedAmount || 0),
      totalReturnedQty: Number(financialAgg._sum.totalReturnedQty || 0),
    };
  },

  async listEligibleDispatches(companyId, filters = {}) {
    const { customerId, search } = filters;
    const where = {
      companyId,
      status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'] },
    };

    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { dispatchNo: { contains: search } },
        { customerName: { contains: search } },
        { salesOrderNo: { contains: search } },
        { invoiceNo: { contains: search } },
      ];
    }

    const dispatches = await prisma.dispatchOrder.findMany({
      where,
      orderBy: { dispatchDate: 'desc' },
      include: {
        items: true,
        customerReturns: {
          where: { status: { notIn: ['REJECTED', 'CANCELLED'] } },
          include: { items: true },
        },
      },
    });

    const eligibleList = [];

    for (const dsp of dispatches) {
      // Aggregate already returned quantities per item
      const returnedMap = new Map();
      for (const ret of dsp.customerReturns) {
        for (const rItem of ret.items) {
          const key = rItem.dispatchOrderItemId || rItem.sku;
          const curr = returnedMap.get(key) || 0;
          returnedMap.set(key, curr + Number(rItem.returnQty));
        }
      }

      const returnableItems = [];
      let totalReturnableQty = 0;

      for (const item of dsp.items) {
        const dispatchedQty = Number(item.dispatchedQty);
        const alreadyReturned = returnedMap.get(item.id) || returnedMap.get(item.sku) || 0;
        const returnableQty = Math.max(0, dispatchedQty - alreadyReturned);

        if (returnableQty > 0) {
          totalReturnableQty += returnableQty;
          returnableItems.push({
            dispatchOrderItemId: item.id,
            sku: item.sku,
            productName: item.productName,
            uom: item.uom,
            unitPrice: Number(item.unitPrice),
            dispatchedQty,
            alreadyReturnedQty: alreadyReturned,
            returnableQty,
          });
        }
      }

      if (returnableItems.length > 0) {
        eligibleList.push({
          id: dsp.id,
          dispatchNo: dsp.dispatchNo,
          dispatchDate: dsp.dispatchDate,
          salesOrderId: dsp.salesOrderId,
          salesOrderNo: dsp.salesOrderNo,
          customerId: dsp.customerId,
          customerName: dsp.customerName,
          status: dsp.status,
          totalReturnableQty,
          items: returnableItems,
        });
      }
    }

    return eligibleList;
  },

  // =========================================================================
  // 2. RMA CREATION & APPROVAL WORKFLOW
  // =========================================================================
  async createReturnRequest(companyId, data, actor = {}) {
    const {
      dispatchOrderId,
      salesOrderId,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      returnReason,
      reasonDetails,
      pickupAddress,
      receivingWarehouseId,
      notes,
      items = [],
    } = data;

    if (!items || items.length === 0) {
      throw returnError('At least one item is required to create a return request.');
    }

    if (!returnReason) {
      throw returnError('Return reason is required.');
    }

    return prisma.$transaction(async (tx) => {
      let dispatchOrder = null;
      let finalSalesOrderId = salesOrderId;
      let finalSalesOrderNo = null;
      let finalCustomerId = customerId;
      let finalCustomerName = customerName;

      if (dispatchOrderId) {
        dispatchOrder = await tx.dispatchOrder.findFirst({
          where: { id: dispatchOrderId, companyId },
          include: {
            items: true,
            customerReturns: {
              where: { status: { notIn: ['REJECTED', 'CANCELLED'] } },
              include: { items: true },
            },
          },
        });

        if (!dispatchOrder) {
          throw returnError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
        }

        finalSalesOrderId = finalSalesOrderId || dispatchOrder.salesOrderId;
        finalSalesOrderNo = dispatchOrder.salesOrderNo;
        finalCustomerId = finalCustomerId || dispatchOrder.customerId;
        finalCustomerName = finalCustomerName || dispatchOrder.customerName;
      }

      if (!finalCustomerName) {
        throw returnError('Customer name is required for RMA request.');
      }

      let totalReturnedQty = new Decimal(0);
      let totalReturnedAmount = new Decimal(0);
      const validatedItems = [];

      for (const item of items) {
        const reqQty = new Decimal(item.returnQty || 0);
        if (reqQty.lte(0)) {
          throw returnError(`Return quantity for SKU ${item.sku} must be greater than zero.`);
        }

        let unitPrice = new Decimal(item.unitPrice || 0);
        let productName = item.productName || item.sku;
        let uom = item.uom || 'PCS';
        let dispatchOrderItemId = item.dispatchOrderItemId || null;
        let productId = item.productId || null;

        if (dispatchOrder) {
          const dItem = dispatchOrder.items.find(
            (di) => di.id === item.dispatchOrderItemId || di.sku === item.sku
          );

          if (!dItem) {
            throw returnError(`Item with SKU ${item.sku} not found on Dispatch Order ${dispatchOrder.dispatchNo}.`);
          }

          dispatchOrderItemId = dItem.id;
          productId = productId || dItem.productId;
          productName = dItem.productName;
          uom = dItem.uom;
          unitPrice = dItem.unitPrice;

          // CUMULATIVE RETURN VALIDATION: Cannot exceed original dispatched quantity
          let previouslyReturned = new Decimal(0);
          for (const ret of dispatchOrder.customerReturns) {
            for (const rItem of ret.items) {
              if (rItem.dispatchOrderItemId === dItem.id || rItem.sku === dItem.sku) {
                previouslyReturned = previouslyReturned.add(rItem.returnQty);
              }
            }
          }

          const maxAllowed = dItem.dispatchedQty.sub(previouslyReturned);
          if (reqQty.gt(maxAllowed)) {
            throw returnError(
              `Requested return quantity (${reqQty}) for SKU ${dItem.sku} exceeds eligible dispatched quantity (${maxAllowed}). Dispatched: ${dItem.dispatchedQty}, Already Returned: ${previouslyReturned}.`
            );
          }
        }

        const lineAmount = reqQty.mul(unitPrice);
        totalReturnedQty = totalReturnedQty.add(reqQty);
        totalReturnedAmount = totalReturnedAmount.add(lineAmount);

        validatedItems.push({
          companyId,
          dispatchOrderItemId,
          productId,
          sku: item.sku,
          productName,
          uom,
          returnQty: reqQty,
          unitPrice,
          totalAmount: lineAmount,
          returnReason: item.returnReason || returnReason,
          conditionOnArrival: item.conditionOnArrival || null,
          status: 'PENDING_RECEIPT',
          notes: item.notes || null,
        });
      }

      const rmaNo = documentNo('RMA');

      const customerReturn = await tx.customerReturn.create({
        data: {
          companyId,
          rmaNo,
          dispatchOrderId: dispatchOrder ? dispatchOrder.id : null,
          dispatchNo: dispatchOrder ? dispatchOrder.dispatchNo : null,
          salesOrderId: finalSalesOrderId,
          salesOrderNo: finalSalesOrderNo,
          customerId: finalCustomerId,
          customerName: finalCustomerName,
          customerPhone: customerPhone || null,
          customerEmail: customerEmail || null,
          returnReason,
          reasonDetails: reasonDetails || null,
          pickupAddress: pickupAddress || null,
          receivingWarehouseId: receivingWarehouseId || null,
          status: 'REQUESTED',
          totalReturnedQty,
          totalReturnedAmount,
          notes: notes || null,
          items: {
            create: validatedItems,
          },
        },
        include: {
          items: true,
        },
      });

      // Phase 1 Approval Engine Request Integration
      await approvalService.createRequest({
        companyId,
        entityType: 'CUSTOMER_RETURN',
        entityId: customerReturn.id,
        title: `Customer Return RMA Approval: ${rmaNo}`,
        summary: `RMA request for ${totalReturnedQty} units from ${finalCustomerName}. Reason: ${returnReason}. Estimated Value: ₹${totalReturnedAmount.toFixed(2)}.`,
        creatorId: actor.id || actor.userId || 'system',
        creatorName: actor.name || 'Sales Coordinator',
      }).catch((err) => {
        // Log error but avoid failing transaction if approval config is permissive
        console.warn('Approval request creation warning:', err.message);
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Sales Coordinator',
        action: 'CUSTOMER_RETURN_CREATE',
        serviceCode: 'dispatch_returns',
        moduleCode: 'customer_returns',
        details: `Created Customer Return request ${rmaNo} for customer ${finalCustomerName} with ${validatedItems.length} items. Total: ₹${totalReturnedAmount.toFixed(2)}.`,
      });

      return customerReturn;
    });
  },

  async listReturns(companyId, filters = {}) {
    const { status, customerId, search, fromDate, toDate } = filters;
    const where = { companyId };

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { rmaNo: { contains: search } },
        { customerName: { contains: search } },
        { dispatchNo: { contains: search } },
        { salesOrderNo: { contains: search } },
      ];
    }
    if (fromDate || toDate) {
      where.requestDate = {};
      if (fromDate) where.requestDate.gte = new Date(fromDate);
      if (toDate) where.requestDate.lte = new Date(toDate);
    }

    return prisma.customerReturn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        inspections: true,
        creditNotes: true,
      },
    });
  },

  async getReturnById(companyId, returnId) {
    const ret = await prisma.customerReturn.findFirst({
      where: { id: returnId, companyId },
      include: {
        items: {
          include: {
            inspections: true,
          },
        },
        inspections: {
          include: {
            targetWarehouse: true,
            restockBatch: true,
          },
        },
        creditNotes: true,
        dispatchOrder: true,
        salesOrder: true,
        customer: true,
        receivingWarehouse: true,
      },
    });

    if (!ret) {
      throw returnError(`Customer Return not found with id ${returnId}.`, 404);
    }

    return ret;
  },

  async submitForApproval(companyId, returnId, actor = {}) {
    const ret = await prisma.customerReturn.findFirst({
      where: { id: returnId, companyId },
    });

    if (!ret) {
      throw returnError(`Customer Return not found with id ${returnId}.`, 404);
    }

    if (ret.status !== 'REQUESTED') {
      throw returnError(`Cannot submit RMA ${ret.rmaNo} in status ${ret.status}. Must be in REQUESTED status.`);
    }

    const updated = await prisma.customerReturn.update({
      where: { id: ret.id },
      data: { status: 'PENDING_APPROVAL' },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Sales Coordinator',
      action: 'CUSTOMER_RETURN_SUBMIT_APPROVAL',
      serviceCode: 'dispatch_returns',
      moduleCode: 'customer_returns',
      details: `Submitted RMA ${ret.rmaNo} for approval.`,
    });

    return updated;
  },

  async approveReturn(companyId, returnId, data = {}, actor = {}) {
    return prisma.$transaction(async (tx) => {
      const ret = await tx.customerReturn.findFirst({
        where: { id: returnId, companyId },
      });

      if (!ret) {
        throw returnError(`Customer Return not found with id ${returnId}.`, 404);
      }

      if (!['REQUESTED', 'PENDING_APPROVAL'].includes(ret.status)) {
        throw returnError(`Cannot approve RMA ${ret.rmaNo} in status ${ret.status}.`);
      }

      // Maker-Checker SoD Restriction
      const actorId = actor.id || actor.userId;
      if (ret.approvedById && ret.approvedById === actorId) {
        throw returnError('Maker-Checker violation: Creator cannot approve their own RMA request.', 403);
      }

      const updated = await tx.customerReturn.update({
        where: { id: ret.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: actorId || null,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actorId || 'system',
        actorName: actor.name || 'Commercial Manager',
        action: 'CUSTOMER_RETURN_APPROVE',
        serviceCode: 'dispatch_returns',
        moduleCode: 'customer_returns',
        details: `Approved Customer Return RMA ${ret.rmaNo}. Goods authorized for inward receiving.`,
      });

      return updated;
    });
  },

  async rejectReturn(companyId, returnId, { reason }, actor = {}) {
    const ret = await prisma.customerReturn.findFirst({
      where: { id: returnId, companyId },
    });

    if (!ret) {
      throw returnError(`Customer Return not found with id ${returnId}.`, 404);
    }

    if (!['REQUESTED', 'PENDING_APPROVAL'].includes(ret.status)) {
      throw returnError(`Cannot reject RMA ${ret.rmaNo} in status ${ret.status}.`);
    }

    const updated = await prisma.customerReturn.update({
      where: { id: ret.id },
      data: {
        status: 'REJECTED',
        notes: ret.notes ? `${ret.notes}\nRejection Reason: ${reason || 'N/A'}` : `Rejection Reason: ${reason || 'N/A'}`,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Commercial Manager',
      action: 'CUSTOMER_RETURN_REJECT',
      serviceCode: 'dispatch_returns',
      moduleCode: 'customer_returns',
      details: `Rejected RMA ${ret.rmaNo}. Reason: ${reason || 'N/A'}.`,
    });

    return updated;
  },

  // =========================================================================
  // 3. INWARD RECEIPT & QUARANTINE
  // =========================================================================
  async receiveReturnedGoods(companyId, returnId, receiveData = {}, actor = {}) {
    const { receivingWarehouseId, items = [], notes } = receiveData;

    return prisma.$transaction(async (tx) => {
      const ret = await tx.customerReturn.findFirst({
        where: { id: returnId, companyId },
        include: { items: true },
      });

      if (!ret) {
        throw returnError(`Customer Return not found with id ${returnId}.`, 404);
      }

      if (ret.status !== 'APPROVED') {
        throw returnError(`Cannot receive goods for RMA ${ret.rmaNo} with status ${ret.status}. Must be APPROVED first.`);
      }

      for (const rItem of ret.items) {
        const match = items.find((i) => i.itemId === rItem.id || i.sku === rItem.sku);
        const receivedQty = match ? new Decimal(match.receivedQty || rItem.returnQty) : rItem.returnQty;
        const condition = match ? match.conditionOnArrival : 'SEALED';

        if (receivedQty.gt(rItem.returnQty)) {
          throw returnError(
            `Received quantity (${receivedQty}) cannot exceed approved RMA return quantity (${rItem.returnQty}) for SKU ${rItem.sku}.`
          );
        }

        await tx.customerReturnItem.update({
          where: { id: rItem.id },
          data: {
            receivedQty,
            conditionOnArrival: condition,
            status: 'RECEIVED_IN_HOLD',
          },
        });
      }

      const updated = await tx.customerReturn.update({
        where: { id: ret.id },
        data: {
          status: 'GOODS_RECEIVED',
          receivingWarehouseId: receivingWarehouseId || ret.receivingWarehouseId || null,
          receivedAt: new Date(),
          receivedById: actor.id || actor.userId || null,
          notes: notes ? (ret.notes ? `${ret.notes}\nInward: ${notes}` : `Inward: ${notes}`) : ret.notes,
        },
        include: { items: true },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Warehouse Inward Clerk',
        action: 'CUSTOMER_RETURN_RECEIVE',
        serviceCode: 'dispatch_returns',
        moduleCode: 'customer_returns',
        details: `Received returned goods into quarantine (RETURN_HOLD) for RMA ${ret.rmaNo}. Total items: ${ret.items.length}.`,
      });

      return updated;
    });
  },

  // =========================================================================
  // 4. QC INSPECTION & INVENTORY REINTEGRATION
  // =========================================================================
  async inspectReturnedGoods(companyId, returnId, inspectionData, actor = {}) {
    const { items = [], targetWarehouseId, notes } = inspectionData;

    if (!items || items.length === 0) {
      throw returnError('At least one item must be inspected.');
    }

    return prisma.$transaction(async (tx) => {
      const ret = await tx.customerReturn.findFirst({
        where: { id: returnId, companyId },
        include: {
          items: true,
          inspections: true,
        },
      });

      if (!ret) {
        throw returnError(`Customer Return not found with id ${returnId}.`, 404);
      }

      if (!['GOODS_RECEIVED', 'INSPECTED'].includes(ret.status)) {
        throw returnError(`Cannot perform inspection on RMA ${ret.rmaNo} in status ${ret.status}. Goods must be received first.`);
      }

      const inspectionRecords = [];

      for (const itemInput of items) {
        const rItem = ret.items.find(
          (i) => i.id === itemInput.customerReturnItemId || i.sku === itemInput.sku
        );

        if (!rItem) {
          throw returnError(`Return line item not found for sku ${itemInput.sku}.`);
        }

        const restockQty = new Decimal(itemInput.restockQty || 0);
        const reworkQty = new Decimal(itemInput.reworkQty || 0);
        const rejectQty = new Decimal(itemInput.rejectQty || 0);
        const scrapQty = new Decimal(itemInput.scrapQty || 0);

        if (restockQty.lt(0) || reworkQty.lt(0) || rejectQty.lt(0) || scrapQty.lt(0)) {
          throw returnError('Disposition quantities cannot be negative.');
        }

        // MANDATORY VALIDATION: Restock + Rework + Rejected + Scrap = Inspected Quantity
        const calculatedInspected = restockQty.add(reworkQty).add(rejectQty).add(scrapQty);
        const inputInspected = new Decimal(itemInput.inspectedQty || calculatedInspected);

        if (!calculatedInspected.equals(inputInspected)) {
          throw returnError(
            `Inspection quantity mismatch for SKU ${rItem.sku}: Restock (${restockQty}) + Rework (${reworkQty}) + Reject (${rejectQty}) + Scrap (${scrapQty}) = ${calculatedInspected}, but inspectedQty is ${inputInspected}.`
          );
        }

        // Over-inspection guard
        const currentInspected = new Decimal(rItem.inspectedQty || 0);
        const maxReceivable = rItem.receivedQty !== null && rItem.receivedQty !== undefined && !new Decimal(rItem.receivedQty).isZero()
          ? new Decimal(rItem.receivedQty)
          : new Decimal(rItem.returnQty);
        if (currentInspected.add(calculatedInspected).gt(maxReceivable)) {
          throw returnError(
            `Over-inspection prevented for SKU ${rItem.sku}. Already inspected: ${currentInspected}, New: ${calculatedInspected}, Received: ${maxReceivable}.`
          );
        }

        // Determine primary disposition label
        let disposition = 'PENDING';
        if (restockQty.gt(0) && reworkQty.isZero() && rejectQty.isZero() && scrapQty.isZero()) disposition = 'RESTOCK_AVAILABLE';
        else if (reworkQty.gt(0) && restockQty.isZero() && rejectQty.isZero() && scrapQty.isZero()) disposition = 'REWORK_WIP';
        else if (rejectQty.gt(0) && restockQty.isZero() && reworkQty.isZero() && scrapQty.isZero()) disposition = 'REJECT_VENDOR';
        else if (scrapQty.gt(0) && restockQty.isZero() && reworkQty.isZero() && rejectQty.isZero()) disposition = 'SCRAP';
        else disposition = 'MIXED_DISPOSITION';

        const inspectionNo = documentNo('INS');

        // Execute inventory movements per disposition
        const finalWarehouseId = targetWarehouseId || ret.receivingWarehouseId;
        let warehouseName = 'Main Warehouse';
        if (finalWarehouseId) {
          const wh = await tx.inventoryWarehouse.findFirst({ where: { id: finalWarehouseId } });
          if (wh) warehouseName = wh.name;
        }

        let targetBatch = null;

        // 1. Restock into AVAILABLE
        if (restockQty.gt(0)) {
          const qtyNum = Number(restockQty);
          // Find or create batch for restocking
          targetBatch = await tx.inventoryBatch.findFirst({
            where: {
              companyId,
              sku: rItem.sku,
              warehouse: warehouseName,
              status: 'ACTIVE',
            },
            orderBy: { createdAt: 'desc' },
          });

          if (targetBatch) {
            await tx.inventoryBatch.update({
              where: { id: targetBatch.id },
              data: { availableQty: { increment: qtyNum } },
            });
          } else {
            targetBatch = await tx.inventoryBatch.create({
              data: {
                companyId,
                batchNo: documentNo('BAT-RET'),
                sku: rItem.sku,
                warehouse: warehouseName,
                availableQty: qtyNum,
                unitCost: rItem.unitPrice,
                status: 'ACTIVE',
                qualityStatus: 'ACCEPTED',
              },
            });
          }

          // Increment stock header
          const stock = await tx.inventoryStock.findFirst({
            where: { companyId, sku: rItem.sku, warehouse: warehouseName },
          });
          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: {
                stock: { increment: qtyNum },
                availableQty: { increment: qtyNum },
              },
            });
          }

          // Movement: RETURN_RESTOCK
          await tx.inventoryMovement.create({
            data: {
              companyId,
              stockId: stock ? stock.id : null,
              batchId: targetBatch.id,
              batchNo: targetBatch.batchNo,
              movementNo: documentNo('MOV'),
              movementType: 'RETURN_RESTOCK',
              sku: rItem.sku,
              itemName: rItem.productName,
              warehouse: warehouseName,
              quantity: qtyNum,
              balanceAfter: stock ? stock.stock + qtyNum : qtyNum,
              sourceBucket: 'RETURN_HOLD',
              destinationBucket: 'AVAILABLE',
              uom: rItem.uom,
              unitCost: Number(rItem.unitPrice),
              referenceType: 'CUSTOMER_RETURN_INSPECTION',
              referenceId: ret.id,
              referenceNo: ret.rmaNo,
              reason: `Returned stock reintegrated into AVAILABLE from RMA ${ret.rmaNo}`,
              createdBy: actor.name || 'QC Inspector',
            },
          });
        }

        // 2. Rework into WIP
        if (reworkQty.gt(0)) {
          const qtyNum = Number(reworkQty);
          await tx.inventoryMovement.create({
            data: {
              companyId,
              movementNo: documentNo('MOV'),
              movementType: 'RETURN_REWORK',
              sku: rItem.sku,
              itemName: rItem.productName,
              warehouse: warehouseName,
              quantity: qtyNum,
              balanceAfter: 0,
              sourceBucket: 'RETURN_HOLD',
              destinationBucket: 'WIP',
              uom: rItem.uom,
              unitCost: Number(rItem.unitPrice),
              referenceType: 'CUSTOMER_RETURN_INSPECTION',
              referenceId: ret.id,
              referenceNo: ret.rmaNo,
              reason: `Returned defective stock transferred to WIP for internal rework`,
              createdBy: actor.name || 'QC Inspector',
            },
          });
        }

        // 3. Reject into REJECTED
        if (rejectQty.gt(0)) {
          const qtyNum = Number(rejectQty);
          await tx.inventoryMovement.create({
            data: {
              companyId,
              movementNo: documentNo('MOV'),
              movementType: 'RETURN_REJECT',
              sku: rItem.sku,
              itemName: rItem.productName,
              warehouse: warehouseName,
              quantity: qtyNum,
              balanceAfter: 0,
              sourceBucket: 'RETURN_HOLD',
              destinationBucket: 'REJECTED',
              uom: rItem.uom,
              unitCost: Number(rItem.unitPrice),
              referenceType: 'CUSTOMER_RETURN_INSPECTION',
              referenceId: ret.id,
              referenceNo: ret.rmaNo,
              reason: `Unsalvageable customer return moved to REJECTED bucket`,
              createdBy: actor.name || 'QC Inspector',
            },
          });
        }

        // 4. Scrap into SCRAP
        if (scrapQty.gt(0)) {
          const qtyNum = Number(scrapQty);
          await tx.inventoryMovement.create({
            data: {
              companyId,
              movementNo: documentNo('MOV'),
              movementType: 'RETURN_SCRAP',
              sku: rItem.sku,
              itemName: rItem.productName,
              warehouse: warehouseName,
              quantity: qtyNum,
              balanceAfter: 0,
              sourceBucket: 'RETURN_HOLD',
              destinationBucket: 'SCRAP',
              uom: rItem.uom,
              unitCost: Number(rItem.unitPrice),
              referenceType: 'CUSTOMER_RETURN_INSPECTION',
              referenceId: ret.id,
              referenceNo: ret.rmaNo,
              reason: `Severely damaged return written off and moved to SCRAP bucket`,
              createdBy: actor.name || 'QC Inspector',
            },
          });
        }

        // Create Inspection record
        const inspection = await tx.customerReturnInspection.create({
          data: {
            companyId,
            inspectionNo,
            customerReturnId: ret.id,
            customerReturnItemId: rItem.id,
            sku: rItem.sku,
            inspectedQty: calculatedInspected,
            restockQty,
            reworkQty,
            rejectQty,
            scrapQty,
            targetWarehouseId: finalWarehouseId || null,
            restockBatchId: targetBatch ? targetBatch.id : null,
            restockBatchNo: targetBatch ? targetBatch.batchNo : null,
            qcFindings: itemInput.qcFindings || 'Standard return inspection completed',
            disposition,
            inspectedBy: actor.name || 'QC Inspector',
            inspectionDate: new Date(),
            status: 'COMPLETED',
            notes: itemInput.notes || null,
          },
        });

        // Update item inspected quantity and status
        const updatedInspectedQty = currentInspected.add(calculatedInspected);
        const itemStatus = updatedInspectedQty.gte(maxReceivable) ? 'INSPECTED' : 'PARTIALLY_INSPECTED';

        await tx.customerReturnItem.update({
          where: { id: rItem.id },
          data: {
            inspectedQty: updatedInspectedQty,
            status: itemStatus,
          },
        });

        inspectionRecords.push(inspection);
      }

      // Check if all items in RMA are now fully inspected
      const allItems = await tx.customerReturnItem.findMany({
        where: { customerReturnId: ret.id },
      });

      const allFullyInspected = allItems.every(
        (i) => i.inspectedQty.gte(i.receivedQty || i.returnQty)
      );

      const updatedReturn = await tx.customerReturn.update({
        where: { id: ret.id },
        data: {
          status: allFullyInspected ? 'INSPECTED' : 'INSPECTED',
          notes: notes ? (ret.notes ? `${ret.notes}\nInspection: ${notes}` : `Inspection: ${notes}`) : ret.notes,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'QC Inspector',
        action: 'CUSTOMER_RETURN_INSPECT',
        serviceCode: 'dispatch_returns',
        moduleCode: 'customer_returns',
        details: `Completed QC inspection on RMA ${ret.rmaNo} for ${inspectionRecords.length} items. Dispositions updated and inventory movements recorded.`,
      });

      return {
        returnId: updatedReturn.id,
        rmaNo: updatedReturn.rmaNo,
        status: updatedReturn.status,
        inspections: inspectionRecords,
      };
    });
  },
};

export default returnsService;
