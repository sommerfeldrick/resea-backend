import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { config } from 'dotenv';
import { logger } from './config/logger.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import filesRoutes from './routes/files.js';
import templatesRoutes from './routes/templates.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { smileaiAuthRequired } from './middleware/smileaiAuth.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// Middleware
// ============================================================

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  'https://app.smileai.com.br',
  'https://smileai.com.br',
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requisições sem origin (como mobile apps ou curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    error: 'Muitas requisições. Por favor, tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// ============================================================
// Routes
// ============================================================

// Auth routes (SmileAI SSO)
app.use('/api/auth', authRoutes);

// Files routes (upload, processing)
app.use('/api/files', smileaiAuthRequired, filesRoutes);

// Templates routes (favorites, history, custom templates)
app.use('/api/templates', smileaiAuthRequired, templatesRoutes);

// Main API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Resea AI Research Assistant API',
    version: '2.0.0',
    status: 'running',
    smileai_integration: 'enabled',
    endpoints: {
      // Authentication (SmileAI SSO)
      login: 'POST /api/auth/login',
      refresh: 'POST /api/auth/refresh',
      logout: 'POST /api/auth/logout',
      me: 'GET /api/auth/me',
      profile: 'GET /api/auth/profile',

      // Research API
      health: '/api/health',
      aiStats: 'GET /api/ai-stats',
      generatePlan: 'POST /api/generate-plan',
      generateMindmap: 'POST /api/generate-mindmap',
      researchStep: 'POST /api/research-step',
      generateOutline: 'POST /api/generate-outline',
      generateContent: 'POST /api/generate-content',
      clearCache: 'POST /api/cache/clear',

      // SmileAI Integration
      smileaiDocuments: 'GET /api/auth/smileai/documents',
      smileaiTemplates: 'GET /api/auth/smileai/templates',
      smileaiBrandVoice: 'GET /api/auth/smileai/brand-voice',

      // File Management
      uploadFile: 'POST /api/files/upload',
      getFile: 'GET /api/files/:id',
      listFiles: 'GET /api/files',
      deleteFile: 'DELETE /api/files/:id',
      processFile: 'POST /api/files/:id/process',

      // Template Management
      addFavorite: 'POST /api/templates/favorites',
      getFavorites: 'GET /api/templates/favorites',
      removeFavorite: 'DELETE /api/templates/favorites/:templateId',
      addHistory: 'POST /api/templates/history',
      getHistory: 'GET /api/templates/history',
      clearHistory: 'DELETE /api/templates/history',
      createCustomTemplate: 'POST /api/templates/custom',
      getCustomTemplates: 'GET /api/templates/custom',
      getCustomTemplate: 'GET /api/templates/custom/:id',
      updateCustomTemplate: 'PUT /api/templates/custom/:id',
      deleteCustomTemplate: 'DELETE /api/templates/custom/:id',
      getTemplateAnalytics: 'GET /api/templates/analytics/:id'
    }
  });
});

// ============================================================
// Error Handling
// ============================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  logger.info(`🔐 SmileAI Integration: ${process.env.MAIN_DOMAIN_API || 'https://smileai.com.br'}`);
  logger.info(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
  logger.info(`💾 Cache: ${process.env.REDIS_ENABLED === 'true' ? 'Redis' : 'Memory'}`);
  logger.info(`🕷️  Web Scraping: ${process.env.ENABLE_WEB_SCRAPING === 'true' ? 'Enabled ✓' : 'Disabled ✗'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

export default app;
