import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../config/logger.js';
import { extractPDFContent } from '../services/pdfExtractor.js';

const router = Router();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'text/plain',
    'text/csv'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

/**
 * POST /api/files/upload
 * Upload de arquivo
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    const userId = (req as any).smileaiUser?.id || 'guest';

    const fileData = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
      status: 'ready',
      url: `/uploads/${req.file.filename}`
    };

    logger.info('File uploaded', { fileId: fileData.id, filename: fileData.originalName });

    res.json({
      success: true,
      data: fileData
    });
  } catch (error: any) {
    logger.error('File upload failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao fazer upload'
    });
  }
});

/**
 * GET /api/files/:id
 * Obter informações de um arquivo
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Aqui você implementaria a busca no banco de dados
    // Por enquanto, vamos retornar um exemplo

    res.json({
      success: true,
      data: {
        id,
        filename: 'example.pdf',
        originalName: 'documento.pdf',
        status: 'ready'
      }
    });
  } catch (error: any) {
    logger.error('Get file failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/files
 * Listar arquivos do usuário
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).smileaiUser?.id || 'guest';
    const { limit = 10, offset = 0, status } = req.query;

    // Aqui você implementaria a busca no banco de dados
    // Por enquanto, retornamos um array vazio

    res.json({
      success: true,
      data: {
        files: [],
        total: 0
      }
    });
  } catch (error: any) {
    logger.error('List files failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/files/:id
 * Deletar arquivo
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).smileaiUser?.id || 'guest';

    // Aqui você implementaria a deleção no banco e no filesystem

    logger.info('File deleted', { fileId: id, userId });

    res.json({
      success: true,
      message: 'Arquivo deletado com sucesso'
    });
  } catch (error: any) {
    logger.error('Delete file failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/files/:id/process
 * Processar arquivo (extrair texto, metadata)
 */
router.post('/:id/process', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Aqui você implementaria o processamento do arquivo
    // Extrair texto de PDF, DOCX, etc.

    logger.info('File processing started', { fileId: id });

    res.json({
      success: true,
      data: {
        id,
        status: 'processing',
        message: 'Processamento iniciado'
      }
    });
  } catch (error: any) {
    logger.error('File processing failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
