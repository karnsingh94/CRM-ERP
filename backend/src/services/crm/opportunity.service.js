import prisma from '../../config/prisma.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const VALID_STAGES = ['DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

export const opportunityService = {
  async listOpportunities(companyId, options = {}) {
    const { search, stage, limit, offset } = options;
    const where = { companyId };
    if (stage && stage !== 'ALL' && VALID_STAGES.includes(stage)) {
      where.stage = stage;
    }
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { companyName: { contains: search.trim() } },
      ];
    }

    const queryOptions = {
      where,
      orderBy: { createdAt: 'desc' },
    };

    if (limit && Number(limit) > 0) {
      queryOptions.take = Math.min(Number(limit), 200);
      if (offset && Number(offset) >= 0) {
        queryOptions.skip = Number(offset);
      }
    }

    return prisma.crmOpportunity.findMany(queryOptions);
  },

  async createOpportunity(companyId, data) {
    if (!data.title?.trim()) {
      throw coreError('Opportunity title is required.');
    }
    const val = data.value !== undefined && data.value !== null && String(data.value).trim() !== ''
      ? parseFloat(String(data.value).replace(/[^0-9.]/g, ''))
      : null;

    const requestedStage = data.stage?.trim().toUpperCase() || 'DISCOVERY';
    const stage = VALID_STAGES.includes(requestedStage) ? requestedStage : 'DISCOVERY';

    return prisma.crmOpportunity.create({
      data: {
        companyId,
        title: data.title.trim(),
        companyName: data.companyName?.trim() || 'General Opportunity',
        stage,
        value: val !== null && !isNaN(val) ? val : null,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        probability: data.probability?.trim() || (stage === 'WON' ? '100%' : stage === 'LOST' ? '0%' : '50%'),
      },
    });
  },

  async updateOpportunity(companyId, opportunityId, data) {
    const existing = await prisma.crmOpportunity.findFirst({
      where: { id: opportunityId, companyId },
    });
    if (!existing) throw coreError('Opportunity not found.', 404);

    const updateData = {};
    if (data.stage) {
      const targetStage = data.stage.trim().toUpperCase();
      if (!VALID_STAGES.includes(targetStage)) {
        throw coreError(`Invalid stage "${data.stage}". Valid stages: ${VALID_STAGES.join(', ')}`);
      }
      if (targetStage === 'LOST' && !data.lossReason && !data.reason && !existing.title.includes('[LOST]')) {
        // Enforce loss reason or accept reason in request
        if (!data.lossReason && !data.reason) {
          throw coreError('A reason is mandatory when marking a deal as LOST.');
        }
      }
      updateData.stage = targetStage;
      if (targetStage === 'WON' && !data.probability) updateData.probability = '100%';
      if (targetStage === 'LOST' && !data.probability) updateData.probability = '0%';
    }
    if (data.title) updateData.title = data.title.trim();
    if (data.probability) updateData.probability = data.probability.trim();
    if (data.expectedCloseDate) {
      updateData.expectedCloseDate = new Date(data.expectedCloseDate);
    }
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
};

export default opportunityService;
