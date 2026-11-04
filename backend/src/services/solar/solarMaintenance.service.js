import prisma from '../../config/prisma.js';
import { inventoryService } from '../inventory/inventory.service.js';
import auditService from '../audit.service.js';

export const solarMaintenanceService = {
  /**
   * Generate sequential unique ticket number: TKT-SOL-YYYY-XXXX
   */
  async generateTicketNo(companyId) {
    const year = new Date().getFullYear();
    const count = await prisma.solarMaintenanceTicket.count({
      where: {
        companyId,
        ticketNo: { startsWith: `TKT-SOL-${year}-` },
      },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `TKT-SOL-${year}-${seq}`;
  },

  /**
   * List maintenance tickets with filtering and pagination
   */
  async listTickets(companyId, query = {}) {
    const { plantId, inverterId, status, priority, category, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = { companyId };
    if (plantId) where.plantId = plantId;
    if (inverterId) where.inverterId = inverterId;
    if (status) where.status = String(status).toUpperCase();
    if (priority) where.priority = String(priority).toUpperCase();
    if (category) where.category = String(category).toUpperCase();

    const [tickets, total] = await Promise.all([
      prisma.solarMaintenanceTicket.findMany({
        where,
        skip,
        take,
        include: {
          plant: { select: { id: true, name: true, code: true } },
          inverter: { select: { id: true, inverterCode: true, make: true, model: true } },
          assignedTechnician: { select: { id: true, name: true, email: true, role: true } },
          alarms: { select: { id: true, alarmCode: true, severity: true, description: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.solarMaintenanceTicket.count({ where }),
    ]);

    return {
      tickets,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    };
  },

  /**
   * Get single ticket by ID
   */
  async getTicketById(companyId, ticketId) {
    const ticket = await prisma.solarMaintenanceTicket.findFirst({
      where: { id: ticketId, companyId },
      include: {
        plant: { select: { id: true, name: true, code: true, locationAddress: true } },
        inverter: { select: { id: true, inverterCode: true, make: true, model: true } },
        assignedTechnician: { select: { id: true, name: true, email: true, phone: true, role: true } },
        alarms: true,
      },
    });

    if (!ticket) {
      const error = new Error('Maintenance ticket not found.');
      error.statusCode = 404;
      throw error;
    }

    return ticket;
  },

  /**
   * Create a new maintenance ticket
   */
  async createTicket(companyId, data, actor = null) {
    const { plantId, inverterId, category, priority = 'MEDIUM', subject, description, assignedTechnicianId, alarmId } = data;

    if (!plantId || !category || !subject || !description) {
      const error = new Error('plantId, category, subject, and description are required.');
      error.statusCode = 400;
      throw error;
    }

    // Verify plant belongs to company
    const plant = await prisma.solarPlant.findFirst({
      where: { id: plantId, companyId },
    });
    if (!plant) {
      const error = new Error('Plant not found or does not belong to your company.');
      error.statusCode = 404;
      throw error;
    }

    // Verify inverter if provided
    if (inverterId) {
      const inv = await prisma.solarInverter.findFirst({
        where: { id: inverterId, plantId, companyId },
      });
      if (!inv) {
        const error = new Error('Specified inverter does not belong to this plant/company.');
        error.statusCode = 400;
        throw error;
      }
    }

    // Verify assigned technician belongs to company
    let technicianName = null;
    let initialStatus = 'OPEN';

    if (assignedTechnicianId) {
      const tech = await prisma.companyEmployee.findFirst({
        where: { id: assignedTechnicianId, companyId },
      });
      if (!tech) {
        const error = new Error('Assigned technician does not belong to your company.');
        error.statusCode = 400;
        throw error;
      }
      technicianName = tech.name;
      initialStatus = 'ASSIGNED';
    }

    const ticketNo = await this.generateTicketNo(companyId);

    const ticket = await prisma.solarMaintenanceTicket.create({
      data: {
        companyId,
        plantId,
        inverterId: inverterId || null,
        ticketNo,
        category: String(category).toUpperCase(),
        priority: String(priority).toUpperCase(),
        subject: String(subject).trim(),
        description: String(description).trim(),
        assignedTechnicianId: assignedTechnicianId || null,
        technicianName,
        status: initialStatus,
        sparePartsDetails: data.sparePartsDetails || [],
      },
      include: {
        plant: { select: { name: true, code: true } },
        inverter: { select: { inverterCode: true } },
      },
    });

    // Link alarm if provided
    if (alarmId) {
      const alarm = await prisma.solarInverterAlarm.findFirst({
        where: { id: alarmId, companyId, plantId },
      });
      if (alarm) {
        await prisma.solarInverterAlarm.update({
          where: { id: alarmId },
          data: { ticketId: ticket.id },
        });
      }
    }

    if (actor && auditService?.logAction) {
      await auditService.logAction({
        companyId,
        actorId: actor.id || actor.userId,
        actorType: actor.role || 'USER',
        action: 'SOLAR_TICKET_CREATED',
        entityType: 'SolarMaintenanceTicket',
        entityId: ticket.id,
        description: `Created ticket ${ticket.ticketNo} (${ticket.subject})`,
      });
    }

    return ticket;
  },

  /**
   * Update ticket status or resolution details
   */
  async updateTicket(companyId, ticketId, data, actor = null) {
    const ticket = await this.getTicketById(companyId, ticketId);

    const updateData = {};
    if (data.status) {
      const newStatus = String(data.status).toUpperCase();
      updateData.status = newStatus;
      if (newStatus === 'RESOLVED' && !ticket.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
      if (newStatus === 'CLOSED' && !ticket.closedAt) {
        updateData.closedAt = new Date();
      }
    }

    if (data.assignedTechnicianId !== undefined) {
      if (data.assignedTechnicianId) {
        const tech = await prisma.companyEmployee.findFirst({
          where: { id: data.assignedTechnicianId, companyId },
        });
        if (!tech) {
          const error = new Error('Assigned technician does not belong to your company.');
          error.statusCode = 400;
          throw error;
        }
        updateData.assignedTechnicianId = data.assignedTechnicianId;
        updateData.technicianName = tech.name;
        if (ticket.status === 'OPEN') updateData.status = 'ASSIGNED';
      } else {
        updateData.assignedTechnicianId = null;
        updateData.technicianName = null;
      }
    }

    if (data.priority) updateData.priority = String(data.priority).toUpperCase();
    if (data.rootCause !== undefined) updateData.rootCause = data.rootCause;
    if (data.actionTaken !== undefined) updateData.actionTaken = data.actionTaken;
    if (data.resolutionNotes !== undefined) updateData.resolutionNotes = data.resolutionNotes;

    return prisma.solarMaintenanceTicket.update({
      where: { id: ticketId },
      data: updateData,
    });
  },

  // =========================================================================
  // O&M SPARES INVENTORY INTEGRATION (REUSING PHASE 4 INVENTORY ENGINE)
  // =========================================================================
  /**
   * Issue spare parts from Phase 4 Inventory against a maintenance ticket using FIFO
   */
  async issueSparesAgainstTicket(companyId, ticketId, payload = {}, actor) {
    const { sku, quantity, warehouse } = payload;

    if (!sku || !quantity || Number(quantity) <= 0) {
      const error = new Error('sku and a positive quantity are required to issue spare parts.');
      error.statusCode = 400;
      throw error;
    }

    const qtyNumber = Number(quantity);
    const cleanSku = String(sku).trim();

    // 1. Verify Ticket
    const ticket = await this.getTicketById(companyId, ticketId);
    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)) {
      const error = new Error(`Cannot issue spares against a ticket with status ${ticket.status}.`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Delegate to Phase 4 Inventory FIFO consumption engine within an atomic transaction
    return prisma.$transaction(async (tx) => {
      const consumeResult = await inventoryService.consumeStockFIFO(
        companyId,
        {
          sku: cleanSku,
          quantity: qtyNumber,
          warehouse,
          referenceType: 'SOLAR_MAINTENANCE_TICKET',
          referenceId: ticket.id,
          referenceNo: ticket.ticketNo,
          reason: `Spares consumed for maintenance ticket ${ticket.ticketNo}`,
        },
        actor,
        tx
      );

      // 3. Update sparePartsDetails JSON on SolarMaintenanceTicket
      const currentSpares = Array.isArray(ticket.sparePartsDetails) ? [...ticket.sparePartsDetails] : [];
      currentSpares.push({
        sku: cleanSku,
        productName: consumeResult.itemName,
        quantity: qtyNumber,
        uom: consumeResult.uom,
        totalCost: consumeResult.totalCost,
        issuedAt: new Date().toISOString(),
        issuedBy: actor?.name || actor?.email || 'User',
        allocations: consumeResult.allocations,
      });

      const updatedTicket = await tx.solarMaintenanceTicket.update({
        where: { id: ticketId },
        data: {
          sparePartsDetails: currentSpares,
        },
      });

      if (actor && auditService?.logAction) {
        await auditService.logAction({
          companyId,
          actorId: actor.id || actor.userId,
          actorType: actor.role || 'USER',
          action: 'SOLAR_SPARES_ISSUED',
          entityType: 'SolarMaintenanceTicket',
          entityId: ticket.id,
          description: `Issued ${qtyNumber} ${consumeResult.uom} of ${cleanSku} for ticket ${ticket.ticketNo}`,
          metadata: { sku: cleanSku, quantity: qtyNumber, totalCost: consumeResult.totalCost, allocations: consumeResult.allocations },
        });
      }

      return {
        success: true,
        ticketNo: ticket.ticketNo,
        sku: cleanSku,
        productName: consumeResult.itemName,
        issuedQuantity: qtyNumber,
        totalCost: consumeResult.totalCost,
        allocations: consumeResult.allocations,
        sparePartsDetails: updatedTicket.sparePartsDetails,
      };
    });
  },
};

export default solarMaintenanceService;
