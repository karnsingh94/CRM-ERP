import prisma from '../config/prisma.js';
import auditService from './audit.service.js';

const WORK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

function httpError(message, statusCode = 400, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function parseId(value, label) {
  try {
    const id = BigInt(value);
    if (id <= 0n) throw new Error('invalid');
    return id;
  } catch {
    throw httpError(`${label} must be a valid identifier.`);
  }
}

function formatWorkItem(item) {
  return {
    id: item.id.toString(),
    title: item.title,
    description: item.description || '',
    status: item.status,
    progress: item.progress,
    dueDate: item.dueDate,
    serviceId: item.serviceId.toString(),
    assignedTo: {
      id: item.assignee.id.toString(),
      name: item.assignee.name,
      email: item.assignee.email,
    },
    createdBy: item.createdByName,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    updates: (item.updates || []).map((update) => ({
      id: update.id.toString(),
      author: update.authorName,
      status: update.status,
      progress: update.progress,
      note: update.note || '',
      createdAt: update.createdAt,
    })),
  };
}

async function resolveService(companyId, serviceCodeOrId) {
  const normalizedCode = String(serviceCodeOrId || '').replace(/-/g, '_');
  const service = await prisma.service.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        ...( /^\d+$/.test(String(serviceCodeOrId || '')) ? [{ id: BigInt(serviceCodeOrId) }] : []),
        { code: String(serviceCodeOrId) },
        { code: normalizedCode },
      ],
    },
  });
  if (!service) throw httpError('Service not found or inactive.', 404, 'SERVICE_NOT_FOUND');
  const access = await prisma.clientServiceAccess.findFirst({
    where: { clientAdminId: BigInt(companyId), serviceId: service.id, isAllowed: true },
  });
  if (!access) throw httpError('This service is not assigned to the company.', 403, 'SERVICE_NOT_ASSIGNED');
  return service;
}

async function resolveEmployee(actor, companyId) {
  if (actor?.role === 'COMPANY_ADMIN') return null;
  const employee = await prisma.companyEmployee.findFirst({
    where: {
      id: BigInt(actor?.userId || 0),
      companyId: BigInt(companyId),
      status: 'ACTIVE',
      team: { isNot: null },
    },
    include: { team: true },
  });
  if (!employee) throw httpError('Active service team membership is required.', 403, 'TEAM_MEMBERSHIP_REQUIRED');
  return employee;
}

function requireHeadPermission(employee, permission) {
  if (
    employee?.team?.headEmployeeId !== employee.id ||
    employee.permissions?.[permission] !== true
  ) {
    throw httpError('The required Service Head permission is not assigned.', 403, 'TEAM_PERMISSION_REQUIRED');
  }
}

async function loadWorkItem(companyId, workItemId) {
  let id;
  try {
    id = BigInt(workItemId);
  } catch {
    throw httpError('Invalid work item ID.', 400);
  }
  const item = await prisma.serviceWorkItem.findFirst({
    where: { id, companyId: BigInt(companyId) },
    include: {
      assignee: true,
      updates: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!item) throw httpError('Work item not found.', 404, 'WORK_ITEM_NOT_FOUND');
  return item;
}

function parseDueDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw httpError('Due date must be a valid date.');
  return date;
}

function validateStatus(status) {
  if (status !== undefined && !WORK_STATUSES.includes(status)) {
    throw httpError(`Status must be one of: ${WORK_STATUSES.join(', ')}.`);
  }
}

function validateProgress(progress) {
  if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
    throw httpError('Progress must be a whole number between 0 and 100.');
  }
}

const workItemService = {
  async list(companyId, serviceCode, actor) {
    const service = await resolveService(companyId, serviceCode);
    const employee = await resolveEmployee(actor, companyId);
    const where = { companyId: BigInt(companyId), serviceId: service.id };
    if (employee) {
      if (employee.team.serviceId !== service.id) {
        throw httpError('This work board is outside your assigned service.', 403, 'SERVICE_SCOPE_VIOLATION');
      }
      if (employee.team.headEmployeeId !== employee.id) where.assignedToId = employee.id;
    }
    const items = await prisma.serviceWorkItem.findMany({
      where,
      include: {
        assignee: true,
        updates: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
    });
    return items.map(formatWorkItem);
  },

  async create(companyId, serviceCode, data, actor, meta = {}) {
    const cid = BigInt(companyId);
    const service = await resolveService(companyId, serviceCode);
    const employee = await resolveEmployee(actor, companyId);
    if (employee) {
      if (employee.team.serviceId !== service.id) {
        throw httpError('You can only create work for your assigned service.', 403, 'SERVICE_SCOPE_VIOLATION');
      }
      requireHeadPermission(employee, 'assignWork');
    }

    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    if (!title || title.length > 180) throw httpError('A work title of 1 to 180 characters is required.');
    const assigneeId = parseId(data.assignedToId, 'Assignee');
    const assignee = await prisma.companyEmployee.findFirst({
      where: {
        id: assigneeId,
        companyId: cid,
        team: { companyId: cid, serviceId: service.id },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!assignee) throw httpError('Choose an active employee from this service team.');

    const status = data.status || 'TODO';
    validateStatus(status);
    const progress = data.progress === undefined ? 0 : Number(data.progress);
    validateProgress(progress);
    const dueDate = parseDueDate(data.dueDate);
    const createdByName = actor?.name || 'Company Admin';
    const createdById = employee?.id || null;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceWorkItem.create({
        data: {
          companyId: cid,
          serviceId: service.id,
          createdById,
          createdByName,
          assignedToId: assigneeId,
          title,
          description: description || null,
          status,
          progress,
          dueDate,
        },
        include: { assignee: true },
      });
      await tx.serviceWorkUpdate.create({
        data: {
          workItemId: created.id,
          authorId: employee?.id || null,
          authorName: createdByName,
          status,
          progress,
          note: 'Work item created',
        },
      });
      return created;
    });

    await auditService.logAudit({
      action: 'CREATE',
      entityType: 'SERVICE_WORK_ITEM',
      entityId: item.id,
      newValue: { title, service: service.code, assignedToId: assigneeId.toString() },
      reason: `${actor?.role || 'COMPANY_ADMIN'} created work "${title}" for ${service.name}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return formatWorkItem({ ...item, updates: [] });
  },

  async update(companyId, workItemId, data, actor, meta = {}) {
    const item = await loadWorkItem(companyId, workItemId);
    const employee = await resolveEmployee(actor, companyId);
    const isAdmin = actor?.role === 'COMPANY_ADMIN';
    const isHead = employee?.team.headEmployeeId === employee?.id;
    const isAssignee = employee?.id === item.assignedToId;

    if (!isAdmin && !isAssignee && !(isHead && employee.permissions?.updateWork === true)) {
      throw httpError('Only the assignee, permitted Service Head, or Company Admin can update this work.', 403, 'WORK_UPDATE_FORBIDDEN');
    }
    if (employee && employee.team.serviceId !== item.serviceId) {
      throw httpError('This work item is outside your assigned service.', 403, 'SERVICE_SCOPE_VIOLATION');
    }

    const changes = {};
    const hasManagerPermission = isAdmin || (isHead && employee.permissions?.updateWork === true);
    if (data.status !== undefined) {
      validateStatus(data.status);
      changes.status = data.status;
    }
    if (data.progress !== undefined) {
      const progress = Number(data.progress);
      validateProgress(progress);
      changes.progress = progress;
    }
    if (data.note !== undefined) {
      if (typeof data.note !== 'string' || data.note.trim().length > 2000) {
        throw httpError('Update note must be text no longer than 2000 characters.');
      }
    }
    if (data.title !== undefined || data.description !== undefined || data.dueDate !== undefined) {
      if (!hasManagerPermission) {
        throw httpError('Only a permitted Service Head or Company Admin can edit work details.', 403, 'WORK_UPDATE_FORBIDDEN');
      }
      if (data.title !== undefined) {
        if (typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 180) {
          throw httpError('A work title of 1 to 180 characters is required.');
        }
        changes.title = data.title.trim();
      }
      if (data.description !== undefined) {
        if (typeof data.description !== 'string' || data.description.trim().length > 10000) {
          throw httpError('Work description must be text no longer than 10000 characters.');
        }
        changes.description = data.description.trim() || null;
      }
      if (data.dueDate !== undefined) changes.dueDate = parseDueDate(data.dueDate);
    }
    if (data.assignedToId !== undefined) {
      if (!isAdmin && !(isHead && employee.permissions?.assignWork === true)) {
        throw httpError('Only a permitted Service Head or Company Admin can reassign work.', 403, 'WORK_ASSIGN_FORBIDDEN');
      }
      const newAssigneeId = parseId(data.assignedToId, 'Assignee');
      const validAssignee = await prisma.companyEmployee.findFirst({
        where: {
          id: newAssigneeId,
          companyId: BigInt(companyId),
          status: 'ACTIVE',
          team: { companyId: BigInt(companyId), serviceId: item.serviceId },
        },
        select: { id: true },
      });
      if (!validAssignee) throw httpError('Choose an active employee from this service team.');
      changes.assignedToId = newAssigneeId;
    }

    if (Object.keys(changes).length === 0 && data.note === undefined) {
      throw httpError('Provide at least one work item update.');
    }
    const authorName = actor?.name || 'Company Admin';
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.serviceWorkItem.update({
        where: { id: item.id },
        data: changes,
        include: { assignee: true },
      });
      await tx.serviceWorkUpdate.create({
        data: {
          workItemId: item.id,
          authorId: employee?.id || null,
          authorName,
          status: changes.status ?? null,
          progress: changes.progress ?? null,
          note: typeof data.note === 'string' && data.note.trim() ? data.note.trim() : null,
        },
      });
      return record;
    });
    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'SERVICE_WORK_ITEM',
      entityId: item.id,
      newValue: changes,
      reason: `${authorName} updated work "${item.title}"`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return formatWorkItem({ ...updated, updates: [] });
  },
};

export default workItemService;
