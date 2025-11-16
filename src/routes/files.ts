import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../config/logger.js';
import { extractPDFFromBuffer } from '../services/pdfExtractor.js';

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

const fileFilter = (req: any, file: any, cb: any) => {
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

    logger.info('File processing started', { fileId: id });

    // Buscar informações do arquivo do corpo da requisição
    // Em produção, isso viria do banco de dados
    const fileInfo = req.body;

    if (!fileInfo || !fileInfo.filename) {
      return res.json({
        success: true,
        data: {
          id,
          status: 'ready',
          extractedText: '',
          metadata: { wordCount: 0 }
        }
      });
    }

    const filePath = path.join(process.cwd(), 'uploads', fileInfo.filename);
    let extractedText = '';
    let metadata: any = {};

    try {
      // Verificar se o arquivo existe
      await fs.access(filePath);

      const fileBuffer = await fs.readFile(filePath);
      const mimeType = fileInfo.mimeType || '';

      if (mimeType === 'application/pdf') {
        // Extrair texto de PDF
        const pdfData = await extractPDFFromBuffer(fileBuffer);
        extractedText = pdfData?.fullText || pdfData?.text || '';
        metadata = {
          pageCount: pdfData?.metadata?.pages || 0,
          wordCount: pdfData?.metadata?.wordCount || extractedText.split(/\s+/).filter(w => w.length > 0).length
        };
        logger.info('PDF processed', { fileId: id, pages: metadata.pageCount, words: metadata.wordCount });
      } else if (mimeType === 'text/plain' || mimeType === 'text/csv') {
        // Ler arquivo de texto
        extractedText = fileBuffer.toString('utf-8');
        metadata = {
          wordCount: extractedText.split(/\s+/).filter(w => w.length > 0).length
        };
        logger.info('Text file processed', { fileId: id, words: metadata.wordCount });
      } else if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
        // DOCX/DOC - placeholder para implementação futura
        extractedText = '[Extração de DOCX em desenvolvimento. Por favor, converta para PDF ou TXT]';
        metadata = { wordCount: 0 };
        logger.warn('DOCX not yet supported', { fileId: id });
      }

      res.json({
        success: true,
        data: {
          id,
          status: 'ready',
          extractedText: extractedText.substring(0, 50000), // Limitar a 50k caracteres
          metadata,
          processedAt: new Date()
        }
      });
    } catch (fileError: any) {
      logger.error('File read/extraction failed', { fileId: id, error: fileError.message });

      res.json({
        success: true,
        data: {
          id,
          status: 'error',
          extractedText: '',
          metadata: {},
          error: `Falha ao processar arquivo: ${fileError.message}`
        }
      });
    }
  } catch (error: any) {
    logger.error('File processing failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
