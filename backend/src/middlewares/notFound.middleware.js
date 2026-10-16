/**
 * 404 Not Found Middleware
 * Returns consistent JSON response for unmatched routes
 */
export function notFoundMiddleware(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
  });
}

export default notFoundMiddleware;
