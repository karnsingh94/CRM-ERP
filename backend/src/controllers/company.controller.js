import companyService from '../services/company.service.js';

export const companyController = {
  // ==================== CLIENTS / TENANTS ====================
  async getClients(req, res, next) {
    try {
      const clients = await companyService.getClients();
      res.json({ success: true, data: clients });
    } catch (err) {
      next(err);
    }
  },

  async createClient(req, res, next) {
    try {
      const { name, email, mobile, organization_name, password, access, status, theme_color, themeColor } = req.body;
      if (!name || !name.trim() || !email || !email.trim() || !organization_name || !organization_name.trim()) {
        return res.status(400).json({ success: false, message: 'Company name, admin name, and email are required.' });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      }

      // Mobile validation: Exactly 10 digits starting with 6, 7, 8, or 9
      let normalizedMobile = null;
      if (mobile && String(mobile).trim()) {
        const cleanMobile = String(mobile).trim().replace(/[\s\-\+]/g, '');
        normalizedMobile = cleanMobile.length === 12 && cleanMobile.startsWith('91') ? cleanMobile.slice(2) : cleanMobile;
        const mobileRegex = /^[6-9]\d{9}$/;
        if (!mobileRegex.test(normalizedMobile)) {
          return res.status(400).json({
            success: false,
            message: 'Mobile number must be exactly 10 digits and start with 6, 7, 8, or 9 (numbers starting with 5 or less are not accepted).',
          });
        }
      }

      // Password complexity validation: At least 8 chars, 1 uppercase, 1 special character
      if (!password || !password.trim()) {
        return res.status(400).json({ success: false, message: 'Initial password is required.' });
      }
      const pwd = password.trim();
      if (pwd.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long.',
        });
      }
      if (!/[A-Z]/.test(pwd)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one uppercase letter (A-Z).',
        });
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one special character (!@#$%^&* etc.).',
        });
      }

      // Validate themeColor if provided (must be valid hex format, e.g. #7f22fe)
      let selectedThemeColor = theme_color || themeColor || '#7f22fe';
      if (selectedThemeColor && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(selectedThemeColor)) {
        selectedThemeColor = '#7f22fe';
      }

      const client = await companyService.createClient(
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: normalizedMobile,
          organization_name: organization_name.trim(),
          password: pwd,
          access,
          status,
          themeColor: selectedThemeColor,
          theme_color: selectedThemeColor,
          leadIntegrations: req.body.leadIntegrations || req.body.lead_integrations,
        },
        req.meta || {},
        req.user?.userId || req.user?.id
      );
      res.status(201).json({ success: true, data: client });
    } catch (err) {
      next(err);
    }
  },

  async getClientById(req, res, next) {
    try {
      const client = await companyService.getClientById(req.params.id);
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }
      res.json({ success: true, data: client });
    } catch (err) {
      next(err);
    }
  },

  async updateClient(req, res, next) {
    try {
      const { mobile, password } = req.body;

      // Mobile validation if provided
      if (mobile !== undefined && mobile !== null && String(mobile).trim()) {
        const cleanMobile = String(mobile).trim().replace(/[\s\-\+]/g, '');
        const normalized = cleanMobile.length === 12 && cleanMobile.startsWith('91') ? cleanMobile.slice(2) : cleanMobile;
        const mobileRegex = /^[6-9]\d{9}$/;
        if (!mobileRegex.test(normalized)) {
          return res.status(400).json({
            success: false,
            message: 'Mobile number must be exactly 10 digits and start with 6, 7, 8, or 9.',
          });
        }
        req.body.mobile = normalized;
      }

      // Password validation if provided
      if (password && password.trim()) {
        const pwd = password.trim();
        if (pwd.length < 8) {
          return res.status(400).json({
            success: false,
            message: 'Password must be at least 8 characters long.',
          });
        }
        if (!/[A-Z]/.test(pwd)) {
          return res.status(400).json({
            success: false,
            message: 'Password must contain at least one uppercase letter (A-Z).',
          });
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd)) {
          return res.status(400).json({
            success: false,
            message: 'Password must contain at least one special character (!@#$%^&* etc.).',
          });
        }
        req.body.password = pwd;
      }

      // Theme Color validation if provided
      if (req.body.theme_color !== undefined || req.body.themeColor !== undefined) {
        const rawColor = req.body.theme_color || req.body.themeColor;
        if (rawColor && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(rawColor)) {
          req.body.themeColor = rawColor;
        } else {
          req.body.themeColor = '#7f22fe';
        }
      }

      const updated = await companyService.updateClient(
        req.params.id,
        req.body,
        req.meta || {},
        req.user?.userId || req.user?.id
      );
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async toggleClientStatus(req, res, next) {
    try {
      const updated = await companyService.toggleClientStatus(req.params.id, req.meta || {});
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async deleteClient(req, res, next) {
    try {
      const success = await companyService.deleteClient(req.params.id, req.meta || {});
      if (!success) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }
      res.json({ success: true, message: 'Client panel deactivated and removed' });
    } catch (err) {
      next(err);
    }
  },

  // ==================== ACCESS PERMISSIONS ====================
  async getClientAccess(req, res, next) {
    try {
      const client = await companyService.getClientById(req.params.id);
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }
      res.json({ success: true, data: client.access });
    } catch (err) {
      next(err);
    }
  },

  async saveClientAccess(req, res, next) {
    try {
      const updated = await companyService.saveClientAccess(
        req.params.id,
        req.body.access,
        req.meta || {},
        req.user?.userId || req.user?.id
      );
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }
      res.json({ success: true, data: updated.access });
    } catch (err) {
      next(err);
    }
  },

  // ==================== ASSIGNED SERVICES ====================
  async getCompanyAssignedServices(req, res, next) {
    try {
      const includeInactive = req.query.include_inactive === 'true' && req.user?.role === 'SUPER_ADMIN';
      const services = await companyService.getCompanyAssignedServices(req.params.companyId, includeInactive);
      res.json({ success: true, data: services });
    } catch (err) {
      next(err);
    }
  },

  async switchToClientPanel(req, res, next) {
    try {
      const result = await companyService.switchToClientPanel(req.params.id, req.meta || {});
      res.json({
        success: true,
        message: `Switched into ${result.user.organizationName} panel`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
};

export default companyController;
