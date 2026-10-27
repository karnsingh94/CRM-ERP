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

  async create(req, res, next) {
    try {
      const data = await productService.createProduct(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
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
