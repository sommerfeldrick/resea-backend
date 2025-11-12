import { query } from '../config/database.js';
import { storageService } from './storageService.js';
import { logger } from '../config/logger.js';

export interface GeneratedDocument {
  id?: number;
  user_id: number;
  title: string;
  content: string;
  document_type: string;
  template_id?: string;
  research_query?: string;
  word_count?: number;
  status?: string;
  file_format?: string;
  s3_key?: string;
  s3_url?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class DocumentHistoryService {
  /**
   * Salvar um documento gerado no histórico (com suporte a R2/S3)
   */
  static async saveDocument(doc: GeneratedDocument) {
    try {
      let s3_key: string | null = null;
      let s3_url: string | null = null;
      let contentToStore = doc.content;
      const fileFormat = doc.file_format || 'html';

      // Se R2 estiver disponível, faz upload do conteúdo
      if (storageService.isAvailable()) {
        try {
          // Gera ID temporário para o documento (será substituído pelo ID real do PostgreSQL)
          const tempDocId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

          const uploadResult = await storageService.uploadDocument(
            doc.user_id.toString(),
            tempDocId,
            doc.content,
            this.getContentType(fileFormat),
            fileFormat
          );

          s3_key = uploadResult.key;
          s3_url = uploadResult.url;

          // Se upload foi bem-sucedido, não armazena conteúdo no PostgreSQL
          contentToStore = '';

          logger.info(`Document uploaded to R2: ${s3_key}`);
        } catch (error) {
          logger.error('Failed to upload document to R2, falling back to PostgreSQL:', error);
          // Fallback: armazena no PostgreSQL se R2 falhar
        }
      }

      // Salva metadados no PostgreSQL
      const result = await query(
        `INSERT INTO generated_documents
         (user_id, title, content, document_type, template_id, research_query, word_count, status, s3_key, s3_url, file_format)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, created_at`,
        [
          doc.user_id,
          doc.title,
          contentToStore,
          doc.document_type,
          doc.template_id || null,
          doc.research_query || null,
          doc.word_count || 0,
          doc.status || 'completed',
          s3_key,
          s3_url,
          fileFormat
        ]
      );

      const documentId = result.rows[0].id;

      // Se usou ID temporário, atualiza o arquivo no R2 com o ID real
      if (s3_key && s3_key.includes('temp_')) {
        try {
          const newKey = `documents/${doc.user_id}/${documentId}.${fileFormat}`;

          // Re-upload com o ID correto
          const uploadResult = await storageService.uploadDocument(
            doc.user_id.toString(),
            documentId.toString(),
            doc.content,
            this.getContentType(fileFormat),
            fileFormat
          );

          // Atualiza a chave no banco
          await query(
            `UPDATE generated_documents SET s3_key = $1, s3_url = $2 WHERE id = $3`,
            [uploadResult.key, uploadResult.url, documentId]
          );

          // Deleta o arquivo temporário (opcional, pode deixar para job de limpeza)
          // await storageService.deleteDocument(s3_key);

          logger.info(`Document key updated: ${s3_key} -> ${uploadResult.key}`);
        } catch (error) {
          logger.error('Failed to update document key:', error);
        }
      }

      logger.info(`✅ Document "${doc.title}" saved successfully (ID: ${documentId}, Storage: ${s3_key ? 'R2' : 'PostgreSQL'})`);
      return result.rows[0];
    } catch (error) {
      logger.error('❌ Error saving document:', error);
      throw error;
    }
  }

  /**
   * Determina o Content-Type baseado no formato do arquivo
   */
  private static getContentType(fileFormat: string): string {
    const contentTypes: Record<string, string> = {
      'html': 'text/html',
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json'
    };

    return contentTypes[fileFormat] || 'text/plain';
  }

  /**
   * Obter histórico de documentos do usuário
   */
  static async getUserDocuments(userId: number, limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT id, title, document_type, template_id, word_count, status, created_at
         FROM generated_documents
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar histórico de documentos:', error);
      throw error;
    }
  }

  /**
   * Obter um documento específico (com suporte a R2/S3)
   */
  static async getDocument(documentId: number, userId: number) {
    try {
      const result = await query(
        `SELECT * FROM generated_documents
         WHERE id = $1 AND user_id = $2`,
        [documentId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Documento não encontrado');
      }

      const doc = result.rows[0];

      // Se o documento está no R2, busca de lá
      if (doc.s3_key && storageService.isAvailable()) {
        try {
          // Retorna URL assinada para download ao invés do conteúdo
          // Isso melhora performance para documentos grandes
          const downloadUrl = await storageService.getSignedDownloadUrl(doc.s3_key, 3600);

          return {
            ...doc,
            download_url: downloadUrl,
            storage_type: 'r2'
          };
        } catch (error) {
          logger.error(`Failed to get R2 download URL for document ${documentId}:`, error);
          // Fallback: retorna metadados do PostgreSQL
        }
      }

      // Retorna documento do PostgreSQL (fallback ou storage desabilitado)
      return {
        ...doc,
        storage_type: 'postgresql'
      };
    } catch (error) {
      logger.error('❌ Error fetching document:', error);
      throw error;
    }
  }

  /**
   * Obter conteúdo completo do documento (força download do R2 se necessário)
   */
  static async getDocumentContent(documentId: number, userId: number): Promise<string> {
    try {
      const doc = await this.getDocument(documentId, userId);

      // Se está no R2, faz download
      if (doc.s3_key && storageService.isAvailable()) {
        try {
          const downloadResult = await storageService.downloadDocument(doc.s3_key);

          // Converte stream para string
          const chunks: Buffer[] = [];
          for await (const chunk of downloadResult.stream) {
            chunks.push(Buffer.from(chunk));
          }

          return Buffer.concat(chunks).toString('utf-8');
        } catch (error) {
          logger.error(`Failed to download content from R2 for document ${documentId}:`, error);
        }
      }

      // Fallback: retorna do PostgreSQL
      return doc.content || '';
    } catch (error) {
      logger.error('❌ Error fetching document content:', error);
      throw error;
    }
  }

  /**
   * Deletar um documento (com suporte a R2/S3)
   */
  static async deleteDocument(documentId: number, userId: number) {
    try {
      // Busca documento para pegar s3_key
      const doc = await query(
        `SELECT s3_key FROM generated_documents
         WHERE id = $1 AND user_id = $2`,
        [documentId, userId]
      );

      if (doc.rows.length === 0) {
        throw new Error('Documento não encontrado');
      }

      const s3_key = doc.rows[0].s3_key;

      // Deleta do R2 se existir
      if (s3_key && storageService.isAvailable()) {
        try {
          await storageService.deleteDocument(s3_key);
          logger.info(`Document deleted from R2: ${s3_key}`);
        } catch (error) {
          logger.error(`Failed to delete document from R2: ${s3_key}`, error);
          // Continua com a deleção do PostgreSQL mesmo se R2 falhar
        }
      }

      // Deleta do PostgreSQL
      const result = await query(
        `DELETE FROM generated_documents
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [documentId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Documento não encontrado');
      }

      logger.info(`✅ Document ${documentId} deleted successfully`);
      return true;
    } catch (error) {
      logger.error('❌ Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas do usuário
   */
  static async getUserStats(userId: number) {
    try {
      const result = await query(
        `SELECT 
           COUNT(*) as total_documents,
           SUM(word_count) as total_words,
           MAX(created_at) as last_document,
           COUNT(DISTINCT document_type) as document_types
         FROM generated_documents
         WHERE user_id = $1`,
        [userId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Salvar query de busca no histórico
   */
  static async saveSearchQuery(userId: number, query_text: string, resultsCount: number) {
    try {
      await query(
        `INSERT INTO search_history (user_id, query, results_count)
         VALUES ($1, $2, $3)`,
        [userId, query_text, resultsCount]
      );

      console.log(`✅ Busca salva no histórico`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar busca:', error);
      throw error;
    }
  }

  /**
   * Obter histórico de buscas do usuário
   */
  static async getSearchHistory(userId: number, limit = 20) {
    try {
      const result = await query(
        `SELECT id, query, results_count, created_at
         FROM search_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar histórico de buscas:', error);
      throw error;
    }
  }
}
