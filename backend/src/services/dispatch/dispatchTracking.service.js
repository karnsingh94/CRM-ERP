import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';

function trackingError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const VALID_STATUSES = [
  'PLANNED',
  'PACKED',
  'READY_FOR_DISPATCH',
  'DISPATCHED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'PARTIALLY_DELIVERED',
  'FAILED',
  'CANCELLED',
];

export const dispatchTrackingService = {
  async addTrackingEvent(companyId, dispatchOrderId, data, actor = {}) {
    const { status, location, carrierStatus, remarks, eventDate } = data;

    if (!status || !VALID_STATUSES.includes(status)) {
      throw trackingError(`Invalid tracking status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}.`);
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.dispatchOrder.findFirst({
        where: { id: dispatchOrderId, companyId },
      });

      if (!order) {
        throw trackingError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
      }

      const trackingEvent = await tx.dispatchTracking.create({
        data: {
          companyId,
          dispatchOrderId: order.id,
          status,
          location: location || null,
          carrierStatus: carrierStatus || null,
          remarks: remarks || null,
          eventDate: eventDate ? new Date(eventDate) : new Date(),
          recordedBy: actor.name || 'Carrier API / Logistics Agent',
        },
      });

      const updateData = { status };
      if (status === 'DELIVERED') {
        updateData.deliveredAt = new Date();
        updateData.deliveredById = actor.id || actor.userId || null;
      }

      await tx.dispatchOrder.update({
        where: { id: order.id },
        data: updateData,
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Logistics Coordinator',
        action: 'DISPATCH_TRACKING_EVENT',
        serviceCode: 'dispatch_returns',
        moduleCode: 'dispatch_tracking',
        details: `Updated shipment status to ${status} for Dispatch Order ${order.dispatchNo}. Location: ${location || 'N/A'}.`,
      });

      return trackingEvent;
    });
  },

  async getTrackingHistory(companyId, dispatchOrderId) {
    const order = await prisma.dispatchOrder.findFirst({
      where: { id: dispatchOrderId, companyId },
      include: {
        trackingEvents: {
          orderBy: { eventDate: 'asc' },
        },
      },
    });

    if (!order) {
      throw trackingError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
    }

    return {
      dispatchNo: order.dispatchNo,
      currentStatus: order.status,
      carrierName: order.carrierName,
      trackingNo: order.trackingNo,
      vehicleNo: order.vehicleNo,
      dispatchedAt: order.dispatchedAt,
      deliveredAt: order.deliveredAt,
      podAttachmentUrl: order.podAttachmentUrl,
      timeline: order.trackingEvents.map((evt) => ({
        id: evt.id,
        eventDate: evt.eventDate,
        status: evt.status,
        location: evt.location,
        carrierStatus: evt.carrierStatus,
        remarks: evt.remarks,
        recordedBy: evt.recordedBy,
      })),
    };
  },

  async recordPOD(companyId, dispatchOrderId, podData, actor = {}) {
    const { receiverName, podAttachmentUrl, notes, receivedAt } = podData;

    return prisma.$transaction(async (tx) => {
      const order = await tx.dispatchOrder.findFirst({
        where: { id: dispatchOrderId, companyId },
      });

      if (!order) {
        throw trackingError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
      }

      if (order.status === 'DELIVERED') {
        throw trackingError(`Dispatch Order ${order.dispatchNo} is already marked as DELIVERED.`);
      }

      const deliveredAt = receivedAt ? new Date(receivedAt) : new Date();

      const updated = await tx.dispatchOrder.update({
        where: { id: order.id },
        data: {
          status: 'DELIVERED',
          deliveredAt,
          deliveredById: actor.id || actor.userId || null,
          podAttachmentUrl: podAttachmentUrl || order.podAttachmentUrl || null,
          notes: notes ? (order.notes ? `${order.notes}\nPOD Notes: ${notes}` : `POD Notes: ${notes}`) : order.notes,
        },
      });

      await tx.dispatchTracking.create({
        data: {
          companyId,
          dispatchOrderId: order.id,
          status: 'DELIVERED',
          location: order.shippingAddress ? 'Customer Premises' : 'Delivered',
          carrierStatus: 'Delivered - POD Signed',
          remarks: `Delivered to ${receiverName || order.customerName}. Proof of delivery confirmed.`,
          eventDate: deliveredAt,
          recordedBy: actor.name || 'Delivery Agent',
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Delivery Agent',
        action: 'DISPATCH_POD_RECORDED',
        serviceCode: 'dispatch_returns',
        moduleCode: 'dispatch_tracking',
        details: `Recorded Proof of Delivery (POD) for Dispatch Order ${order.dispatchNo}. Receiver: ${receiverName || order.customerName}.`,
      });

      return updated;
    });
  },

  async recordFailedDelivery(companyId, dispatchOrderId, failData, actor = {}) {
    const { failureReason, location, remarks, attemptNumber = 1 } = failData;

    return prisma.$transaction(async (tx) => {
      const order = await tx.dispatchOrder.findFirst({
        where: { id: dispatchOrderId, companyId },
      });

      if (!order) {
        throw trackingError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
      }

      const updated = await tx.dispatchOrder.update({
        where: { id: order.id },
        data: {
          status: 'FAILED',
          notes: order.notes
            ? `${order.notes}\nDelivery Attempt ${attemptNumber} Failed: ${failureReason || 'N/A'}`
            : `Delivery Attempt ${attemptNumber} Failed: ${failureReason || 'N/A'}`,
        },
      });

      const trackingEvent = await tx.dispatchTracking.create({
        data: {
          companyId,
          dispatchOrderId: order.id,
          status: 'FAILED',
          location: location || null,
          carrierStatus: `Attempt ${attemptNumber} Failed`,
          remarks: `Delivery failed: ${failureReason || 'Recipient unavailable'}. ${remarks || ''}`.trim(),
          eventDate: new Date(),
          recordedBy: actor.name || 'Carrier Agent',
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Logistics Coordinator',
        action: 'DISPATCH_DELIVERY_FAILED',
        serviceCode: 'dispatch_returns',
        moduleCode: 'dispatch_tracking',
        details: `Recorded delivery failure for Dispatch Order ${order.dispatchNo}. Reason: ${failureReason || 'N/A'}.`,
      });

      return {
        dispatchOrderId: order.id,
        dispatchNo: order.dispatchNo,
        status: updated.status,
        event: trackingEvent,
      };
    });
  },
};

export default dispatchTrackingService;

