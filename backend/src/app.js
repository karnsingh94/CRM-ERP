import express from 'express';
import env from './config/env.js';
import { securityHeadersMiddleware, corsMiddleware } from './middlewares/cors.middleware.js';
import notFoundMiddleware from './middlewares/notFound.middleware.js';
import errorHandlerMiddleware from './middlewares/errorHandler.middleware.js';
import apiRoutes from './routes/api.routes.js';
import './config/prisma.js';

const app = express();

app.set('trust proxy', env.trustProxy);

// 1. Security baseline headers
app.use(securityHeadersMiddleware);

// 2. Cross-Origin Resource Sharing
app.use(corsMiddleware);

// 3. Request body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 4. Root information endpoint
app.get('/', (req, res) => {
  res.json({
    project: 'AZZUNIQE CRM & ERP Super Admin API',
    version: '1.0.0',
    documentation: '/api/health',
    authStatus: 'Integration Pending (Developed separately)',
  });
});

// 5. Mount API Routes
app.use('/api', apiRoutes);

// 6. 404 Not Found Handler
app.use(notFoundMiddleware);

// 7. Centralized Error Handler
app.use(errorHandlerMiddleware);

export { app };
export default app;
