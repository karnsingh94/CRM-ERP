import contactService from '../../services/crm/contact.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const contactController = {
  async list(req, res, next) {
    try {
      const data = await contactService.listContacts(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async create(req, res, next) {
    try {
      const data = await contactService.createContact(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async update(req, res, next) {
    try {
      const data = await contactService.updateContact(
        String(req.params.companyId),
        String(req.params.contactId),
        req.body || {}
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async remove(req, res, next) {
    try {
      await contactService.removeContact(String(req.params.companyId), req.params.contactId);
      res.json({ success: true, message: 'Contact deleted.' });
    } catch (err) { respondError(err, res, next); }
  },
};

export default contactController;
