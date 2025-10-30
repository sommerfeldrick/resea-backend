import { query } from '../config/database.js';

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
  created_at?: Date;
  updated_at?: Date;
}

export class DocumentHistoryService {
  /**
   * Salvar um documento gerado no histórico
   */
  static async saveDocument(doc: GeneratedDocument) {
    try {
      const result = await query(
        `INSERT INTO generated_documents 
         (user_id, title, content, document_type, template_id, research_query, word_count, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, created_at`,
        [
          doc.user_id,
          doc.title,
          doc.content,
          doc.document_type,
          doc.template_id || null,
          doc.research_query || null,
          doc.word_count || 0,
          doc.status || 'completed'
        ]
      );

      console.log(`✅ Documento "${doc.title}" salvo no histórico`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao salvar documento:', error);
      throw error;
    }
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
   * Obter um documento específico
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

      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao buscar documento:', error);
      throw error;
    }
  }

  /**
   * Deletar um documento
   */
  static async deleteDocument(documentId: number, userId: number) {
    try {
      const result = await query(
        `DELETE FROM generated_documents
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [documentId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Documento não encontrado');
      }

      console.log(`✅ Documento ${documentId} deletado`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar documento:', error);
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
