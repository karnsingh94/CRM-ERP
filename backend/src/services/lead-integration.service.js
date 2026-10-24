import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { isUuid } from '../utils/uuid.js';

export const SUPPORTED_PROVIDERS = [
  {
    id: 'INDIAMART',
    name: 'IndiaMART Lead API',
    category: 'B2B Marketplace',
    icon: '🇮🇳',
    color: '#005b9f',
    description: 'Auto-sync inquiries and buyer demands directly using your IndiaMART CRM Key (GLUSR_CRM_KEY).',
    fields: [
      { key: 'glusrCrmKey', label: 'IndiaMART CRM Key (GLUSR_CRM_KEY)', type: 'password', required: true, placeholder: 'e.g. mRxxxxxxxxxxxxxxxxxxxx==' },
      { key: 'autoSyncInterval', label: 'Auto-Sync Frequency (Minutes)', type: 'number', defaultValue: 15, placeholder: '15' },
    ],
  },
  {
    id: 'META_FACEBOOK',
    name: 'Facebook Lead Ads (Meta)',
    category: 'Social Media Ads',
    icon: '📘',
    color: '#1877f2',
    description: 'Capture instant lead submissions from your Facebook Lead Generation campaigns.',
    fields: [
      { key: 'pageId', label: 'Facebook Page ID', type: 'text', placeholder: 'e.g. 1092837465' },
      { key: 'pageAccessToken', label: 'Page Access Token / Secret', type: 'password', placeholder: 'EAAB...' },
      { key: 'formId', label: 'Lead Form ID (Optional)', type: 'text', placeholder: 'e.g. 89234827364' },
    ],
    hasWebhook: true,
  },
  {
    id: 'META_INSTAGRAM',
    name: 'Instagram Lead Generation',
    category: 'Social Media Ads',
    icon: '📸',
    color: '#e1306c',
    description: 'Capture inquiries from Instagram Ads, Story swipe-ups, and Instant Lead forms.',
    fields: [
      { key: 'instagramAccountId', label: 'Instagram Business Account ID', type: 'text', placeholder: 'e.g. 17841400...' },
      { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'IGQV...' },
    ],
    hasWebhook: true,
  },
  {
    id: 'WEBSITE_WEBHOOK',
    name: 'Website & Landing Pages (Universal Webhook)',
    category: 'Website Ingestion',
    icon: '🌐',
    color: '#059669',
    description: 'Connect any website contact form (WordPress, Elementor, CF7, Webflow, Shopify, Zapier, Make).',
    fields: [
      { key: 'defaultSourceTag', label: 'Lead Source Label in CRM', type: 'text', defaultValue: 'Website Ingestion', placeholder: 'e.g. Website Contact Form' },
    ],
    hasWebhook: true,
  },
  {
    id: 'GMAIL',
    name: 'Gmail / Email Inquiries',
    category: 'Email Ingestion',
    icon: '✉️',
    color: '#ea4335',
    description: 'Forward client inquiry emails directly into your CRM Leads Pipeline.',
    fields: [
      { key: 'inquiryEmail', label: 'Business Inquiry Email', type: 'email', placeholder: 'sales@yourdomain.com' },
      { key: 'appPassword', label: 'Email App Password / Token (Optional)', type: 'password', placeholder: '••••••••' },
    ],
    hasWebhook: true,
  },
  {
    id: 'JUSTDIAL',
    name: 'JustDial & TradeIndia',
    category: 'B2B Marketplace',
    icon: '📞',
    color: '#f59e0b',
    description: 'Real-time push notifications from JustDial buyer leads and TradeIndia inquiries.',
    fields: [
      { key: 'apiKey', label: 'API Key / Secret Token', type: 'password', placeholder: 'Enter vendor key' },
    ],
    hasWebhook: true,
  },
];

function generateWebhookToken(companyId, provider) {
  const hash = crypto.createHash('sha256').update(`${companyId}:${provider}:${Date.now()}:${Math.random()}`).digest('hex');
  return `wh_${provider.toLowerCase().slice(0, 4)}_${hash.slice(0, 24)}`;
}

export const leadIntegrationService = {
  getSupportedProviders() {
    return SUPPORTED_PROVIDERS;
  },

  /**
   * List all lead integrations for a company
   */
  async getCompanyIntegrations(companyId) {
    if (!companyId) return [];
    const integrations = await prisma.companyLeadIntegration.findMany({
      where: { companyId: String(companyId) },
      orderBy: { createdAt: 'asc' },
    });

    return SUPPORTED_PROVIDERS.map((provider) => {
      const match = integrations.find((i) => i.provider === provider.id);
      let creds = match?.credentials || {};
      if (typeof creds === 'string') {
        try { creds = JSON.parse(creds); } catch (e) { creds = {}; }
      }

      // Mask sensitive fields
      const maskedCredentials = {};
      Object.keys(creds).forEach((key) => {
        const val = creds[key];
        if (typeof val === 'string' && val.length > 6) {
          maskedCredentials[key] = `${val.slice(0, 3)}••••••••${val.slice(-3)}`;
        } else if (typeof val === 'string' && val.length > 0) {
          maskedCredentials[key] = '••••••••';
        } else {
          maskedCredentials[key] = val;
        }
      });

      return {
        ...provider,
        configured: Boolean(match),
        integrationId: match?.id || null,
        status: match?.status || 'INACTIVE',
        credentials: match ? maskedCredentials : {},
        rawCredentialsPresent: Boolean(match?.credentials),
        webhookToken: match?.webhookToken || null,
        webhookUrl: match?.webhookToken ? `/api/webhooks/leads/${match.webhookToken}` : null,
        lastSyncAt: match?.lastSyncAt ? match.lastSyncAt.toISOString() : null,
        totalSynced: match?.totalSynced || 0,
        lastSyncStatus: match?.lastSyncStatus || null,
        lastSyncError: match?.lastSyncError || null,
      };
    });
  },

  /**
   * Save or update integration settings for a company
   */
  async saveCompanyIntegration(companyId, providerId, payload) {
    const provider = SUPPORTED_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) {
      const error = new Error(`Unsupported lead provider: ${providerId}`);
      error.statusCode = 400;
      throw error;
    }

    const company = await prisma.clientAdmin.findUnique({
      where: { id: String(companyId) },
    });
    if (!company) {
      const error = new Error('Company not found.');
      error.statusCode = 404;
      throw error;
    }

    const existing = await prisma.companyLeadIntegration.findUnique({
      where: {
        companyId_provider: {
          companyId: String(companyId),
          provider: providerId,
        },
      },
    });

    // Merge credentials if incoming contains masked values
    let mergedCredentials = payload.credentials || {};
    if (existing?.credentials) {
      let oldCreds = existing.credentials;
      if (typeof oldCreds === 'string') {
        try { oldCreds = JSON.parse(oldCreds); } catch (e) { oldCreds = {}; }
      }
      Object.keys(oldCreds).forEach((k) => {
        if (mergedCredentials[k] && String(mergedCredentials[k]).includes('••••')) {
          mergedCredentials[k] = oldCreds[k]; // keep original
        } else if (mergedCredentials[k] === undefined && oldCreds[k] !== undefined) {
          mergedCredentials[k] = oldCreds[k];
        }
      });
    }

    const webhookToken = existing?.webhookToken || generateWebhookToken(companyId, providerId);
    const status = payload.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const result = await prisma.companyLeadIntegration.upsert({
      where: {
        companyId_provider: {
          companyId: String(companyId),
          provider: providerId,
        },
      },
      create: {
        companyId: String(companyId),
        provider: providerId,
        status,
        credentials: mergedCredentials,
        webhookToken,
      },
      update: {
        status,
        credentials: mergedCredentials,
        webhookToken: existing?.webhookToken || webhookToken,
      },
    });

    return {
      success: true,
      providerId,
      status: result.status,
      webhookToken: result.webhookToken,
      webhookUrl: `/api/webhooks/leads/${result.webhookToken}`,
      message: `${provider.name} settings saved successfully.`,
    };
  },

  /**
   * Ingest lead payload received via public Webhook
   */
  async ingestWebhookLead(webhookToken, payload, meta = {}) {
    if (!webhookToken) {
      const error = new Error('Webhook token is required.');
      error.statusCode = 400;
      throw error;
    }

    const integration = await prisma.companyLeadIntegration.findUnique({
      where: { webhookToken: String(webhookToken) },
      include: { clientAdmin: true },
    });

    if (!integration) {
      const error = new Error('Invalid webhook token or integration not configured.');
      error.statusCode = 404;
      throw error;
    }

    if (integration.status === 'INACTIVE' || integration.clientAdmin.status === 'INACTIVE') {
      const error = new Error('This integration or company workspace is currently inactive.');
      error.statusCode = 403;
      throw error;
    }

    const body = payload || {};
    // Extract contact details supporting multiple JSON conventions
    const name = (
      body.name ||
      body.fullName ||
      body.full_name ||
      body.contact_name ||
      body.contactName ||
      (body.first_name ? `${body.first_name} ${body.last_name || ''}`.trim() : null) ||
      body.sender_name ||
      body.SenderName ||
      'Website Prospect'
    ).trim().slice(0, 150);

    const email = (
      body.email ||
      body.email_id ||
      body.emailId ||
      body.work_email ||
      body.mail ||
      body.SenderEmail ||
      `lead_${Date.now()}@inquiry.local`
    ).trim().toLowerCase().slice(0, 180);

    const phone = (
      body.phone ||
      body.mobile ||
      body.phone_number ||
      body.contact_number ||
      body.SenderMobile ||
      null
    )?.toString().trim().slice(0, 40) || null;

    const companyName = (
      body.company ||
      body.organization ||
      body.company_name ||
      body.org_name ||
      body.SenderCompany ||
      null
    )?.toString().trim().slice(0, 180) || null;

    let leadValue = null;
    const rawVal = body.value || body.deal_value || body.budget || body.price || body.amount;
    if (rawVal !== undefined && rawVal !== null) {
      const num = String(rawVal).replace(/[^\d.]/g, '');
      if (num && !isNaN(Number(num))) {
        leadValue = num;
      }
    }

    // Determine Source tag
    let sourceTag = 'Website Ingestion';
    if (integration.provider === 'META_FACEBOOK') sourceTag = 'Facebook Ads';
    else if (integration.provider === 'META_INSTAGRAM') sourceTag = 'Instagram Lead';
    else if (integration.provider === 'INDIAMART') sourceTag = 'IndiaMART';
    else if (integration.provider === 'GMAIL') sourceTag = 'Gmail Inquiry';
    else if (integration.provider === 'JUSTDIAL') sourceTag = 'JustDial';
    else if (body.source) sourceTag = String(body.source).slice(0, 100);

    // External ID for deduplication
    const externalId = (
      body.id ||
      body.lead_id ||
      body.query_id ||
      body.form_id ||
      body.entry_id ||
      body.QUERY_ID ||
      null
    )?.toString() || null;

    let lead = null;
    if (externalId) {
      // Check for existing lead with same externalId
      lead = await prisma.lead.findFirst({
        where: {
          companyId: integration.companyId,
          externalId,
        },
      });
    }

    if (lead) {
      // Update existing
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          name,
          phone: phone || lead.phone,
          company: companyName || lead.company,
          value: leadValue !== null ? leadValue : lead.value,
        },
      });
    } else {
      // Create new lead
      lead = await prisma.lead.create({
        data: {
          companyId: integration.companyId,
          name,
          email,
          phone,
          company: companyName,
          source: sourceTag,
          value: leadValue,
          status: 'NEW',
          externalId,
        },
      });

      // Update integration statistics
      await prisma.companyLeadIntegration.update({
        where: { id: integration.id },
        data: {
          totalSynced: { increment: 1 },
          lastSyncAt: new Date(),
          lastSyncStatus: 'SUCCESS',
          lastSyncError: null,
        },
      });
    }

    return {
      success: true,
      message: 'Lead captured successfully.',
      leadId: lead.id,
      name: lead.name,
      source: lead.source,
      status: lead.status,
    };
  },

  /**
   * Sync leads directly from IndiaMART CRM Listing API
   */
  async syncIndiaMart(companyId) {
    const integration = await prisma.companyLeadIntegration.findUnique({
      where: {
        companyId_provider: {
          companyId: String(companyId),
          provider: 'INDIAMART',
        },
      },
    });

    if (!integration) {
      const error = new Error('IndiaMART integration is not configured for this company.');
      error.statusCode = 404;
      throw error;
    }

    let creds = integration.credentials || {};
    if (typeof creds === 'string') {
      try { creds = JSON.parse(creds); } catch (e) { creds = {}; }
    }

    const glusrCrmKey = creds.glusrCrmKey;
    if (!glusrCrmKey || !glusrCrmKey.trim()) {
      const error = new Error('IndiaMART CRM Key (GLUSR_CRM_KEY) is missing. Please configure it first.');
      error.statusCode = 400;
      throw error;
    }

    let insertedCount = 0;
    let fetchedTotal = 0;

    try {
      // IndiaMART CRM API Endpoint
      const now = new Date();
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Past 7 days
      const formatDate = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${pad(d.getDate())}-${months[d.getMonth()]}-${d.getFullYear()}`;
      };

      const start = formatDate(past);
      const end = formatDate(now);
      const url = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${encodeURIComponent(glusrCrmKey.trim())}&start_time=${start}&end_time=${end}`;

      let rawRecords = [];

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000), // 8 sec timeout
        });

        if (response.ok) {
          const json = await response.json();
          if (json.RESPONSE && Array.isArray(json.RESPONSE)) {
            rawRecords = json.RESPONSE;
          }
        }
      } catch (fetchErr) {
        // If IndiaMART API is unreachable or key is mock, we handle gracefully
        console.warn('[IndiaMART API Notice]:', fetchErr.message);
      }

      fetchedTotal = rawRecords.length;

      for (const item of rawRecords) {
        const queryId = item.QUERY_ID || item.UNIQUE_QUERY_ID;
        if (!queryId) continue;

        const existing = await prisma.lead.findFirst({
          where: {
            companyId: String(companyId),
            externalId: String(queryId),
          },
        });

        if (!existing) {
          const senderName = (item.SENDER_NAME || 'IndiaMART Buyer').trim().slice(0, 150);
          const senderEmail = (item.SENDER_EMAIL || `buyer_${queryId}@indiamart.local`).trim().toLowerCase().slice(0, 180);
          const senderMobile = (item.SENDER_MOBILE || '').trim().slice(0, 40) || null;
          const senderCompany = (item.SENDER_COMPANY || '').trim().slice(0, 180) || null;

          await prisma.lead.create({
            data: {
              companyId: String(companyId),
              name: senderName,
              email: senderEmail,
              phone: senderMobile,
              company: senderCompany,
              source: 'IndiaMART',
              status: 'NEW',
              externalId: String(queryId),
            },
          });
          insertedCount++;
        }
      }

      await prisma.companyLeadIntegration.update({
        where: { id: integration.id },
        data: {
          totalSynced: { increment: insertedCount },
          lastSyncAt: new Date(),
          lastSyncStatus: 'SUCCESS',
          lastSyncError: null,
        },
      });

      return {
        success: true,
        provider: 'INDIAMART',
        fetchedTotal,
        insertedCount,
        message: `IndiaMART sync complete. ${insertedCount} new leads added to pipeline.`,
      };
    } catch (err) {
      await prisma.companyLeadIntegration.update({
        where: { id: integration.id },
        data: {
          lastSyncStatus: 'FAILED',
          lastSyncError: err.message,
        },
      });
      throw err;
    }
  },
};

export default leadIntegrationService;
