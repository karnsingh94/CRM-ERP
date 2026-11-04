import solarPlantService from '../../services/solar/solarPlant.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const solarPlantController = {
  // --- Plants ---
  async listPlants(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const result = await solarPlantService.listPlants(companyId, req.query);
      res.json({ success: true, data: result.plants, pagination: result.pagination });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getPlantById(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const plant = await solarPlantService.getPlantById(companyId, req.params.plantId);
      res.json({ success: true, data: plant });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async createPlant(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const plant = await solarPlantService.createPlant(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: plant, message: 'Solar plant created successfully.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async updatePlant(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const updated = await solarPlantService.updatePlant(companyId, req.params.plantId, req.body, req.user);
      res.json({ success: true, data: updated, message: 'Solar plant updated successfully.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // --- Inverters ---
  async listInverters(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const inverters = await solarPlantService.listInverters(companyId, req.params.plantId, req.query);
      res.json({ success: true, data: inverters });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getInverterById(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const inverter = await solarPlantService.getInverterById(companyId, req.params.inverterId);
      res.json({ success: true, data: inverter });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async createInverter(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const inverter = await solarPlantService.createInverter(companyId, req.params.plantId, req.body, req.user);
      res.status(201).json({ success: true, data: inverter, message: 'Inverter added successfully.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async updateInverter(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const updated = await solarPlantService.updateInverter(companyId, req.params.inverterId, req.body, req.user);
      res.json({ success: true, data: updated, message: 'Inverter updated successfully.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // --- Panel Strings ---
  async listPanelStrings(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const strings = await solarPlantService.listPanelStrings(companyId, req.params.plantId, req.query.inverterId);
      res.json({ success: true, data: strings });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async createPanelString(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const stringItem = await solarPlantService.createPanelString(companyId, req.params.plantId, req.body, req.user);
      res.status(201).json({ success: true, data: stringItem, message: 'Panel string added successfully.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async updatePanelString(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const updated = await solarPlantService.updatePanelString(companyId, req.params.stringId, req.body);
      res.json({ success: true, data: updated, message: 'Panel string updated successfully.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },
};

export default solarPlantController;

