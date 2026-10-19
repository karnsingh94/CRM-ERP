import { catalogService } from '../services/catalog.service.js';

export const catalogController = {
  // ==================== SERVICES ====================
  async getServices(req, res, next) {
    try {
      const services = await catalogService.getServices();
      res.json({ success: true, data: services });
    } catch (err) {
      next(err);
    }
  },

  async getServiceById(req, res, next) {
    try {
      const service = await catalogService.getServiceById(req.params.id);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }
      res.json({ success: true, data: service });
    } catch (err) {
      next(err);
    }
  },

  async createService(req, res, next) {
    try {
      const { name, code, description, order_no, status } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Valid service name is required' });
      }
      const service = await catalogService.createService(
        { name, code, description, order_no, status },
        req.meta || {}
      );
      res.status(201).json({ success: true, data: service });
    } catch (err) {
      next(err);
    }
  },

  async updateService(req, res, next) {
    try {
      const updated = await catalogService.updateService(req.params.id, req.body, req.meta || {});
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async toggleServiceStatus(req, res, next) {
    try {
      const updated = await catalogService.toggleServiceStatus(req.params.id, req.meta || {});
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async deleteService(req, res, next) {
    try {
      const deleted = await catalogService.deleteService(req.params.id, req.meta || {});
      if (deleted === null) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }
      if (deleted === false) {
        return res.status(403).json({ success: false, message: 'Seeded core services cannot be deleted' });
      }
      res.json({ success: true, message: 'Service deleted successfully' });
    } catch (err) {
      next(err);
    }
  },

  // ==================== MODULES ====================
  async createModule(req, res, next) {
    try {
      const { name, code, description, icon, order_no, status } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Valid module name is required' });
      }
      const module = await catalogService.createModule(
        req.params.serviceId,
        { name, code, description, icon, order_no, status },
        req.meta || {}
      );
      if (!module) {
        return res.status(404).json({ success: false, message: 'Parent Service not found' });
      }
      res.status(201).json({ success: true, data: module });
    } catch (err) {
      next(err);
    }
  },

  async updateModule(req, res, next) {
    try {
      const updated = await catalogService.updateModule(req.params.id, req.body, req.meta || {});
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Module not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async toggleModuleStatus(req, res, next) {
    try {
      const updated = await catalogService.toggleModuleStatus(req.params.id, req.meta || {});
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Module not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  // ==================== SUB-MODULES ====================
  async createSubModule(req, res, next) {
    try {
      const { name, code, order_no, status } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Valid sub-module name is required' });
      }
      const subModule = await catalogService.createSubModule(
        req.params.moduleId,
        { name, code, order_no, status },
        req.meta || {}
      );
      if (!subModule) {
        return res.status(404).json({ success: false, message: 'Parent Module not found' });
      }
      res.status(201).json({ success: true, data: subModule });
    } catch (err) {
      next(err);
    }
  },

  async updateSubModule(req, res, next) {
    try {
      const updated = await catalogService.updateSubModule(req.params.id, req.body, req.meta || {});
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Sub-Module not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async toggleSubModuleStatus(req, res, next) {
    try {
      const updated = await catalogService.toggleSubModuleStatus(req.params.id, req.meta || {});
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Sub-Module not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
};

export default catalogController;
