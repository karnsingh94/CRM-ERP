import productService from '../../services/crm/product.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const productController = {
  async list(req, res, next) {
    try {
      const data = await productService.listProducts(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async get(req, res, next) {
    try {
      const data = await productService.getProduct(String(req.params.companyId), req.params.productId);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async getImage(req, res, next) {
    try {
      const { filePath, mimeType } = await productService.getProductImageStream(
        String(req.params.companyId),
        req.params.productId
      );
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(filePath);
    } catch (err) { respondError(err, res, next); }
  },

  async create(req, res, next) {
    try {
      const data = await productService.createProduct(
        String(req.params.companyId),
        req.body || {},
        req.file || null
      );
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async update(req, res, next) {
    try {
      const data = await productService.updateProduct(
        String(req.params.companyId),
        req.params.productId,
        req.body || {},
        req.file || null
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async remove(req, res, next) {
    try {
      await productService.removeProduct(String(req.params.companyId), req.params.productId);
      res.json({ success: true, message: 'Product deleted.' });
    } catch (err) { respondError(err, res, next); }
  },
};

export default productController;
