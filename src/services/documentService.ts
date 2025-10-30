import { query } from './database.js';

export interface Document {
  id: number;
  user_id: number;
  title: string;
  content: string;
  type: string;
  template_id?: string;
  status: 'processing' | 'completed' | 'failed';
  sources: any[];
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export const documentService = {
  // Salvar novo documento
  async save(userId: number, doc: Partial<Document>) {
    try {
      const result = await query(
        `INSERT INTO documents (user_id, title, content, type, template_id, status, sources, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          doc.title,
          doc.content,
          doc.type,
          doc.template_id || null,
          doc.status || 'completed',
          JSON.stringify(doc.sources || []),
          JSON.stringify(doc.metadata || {}),
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('[Document Save Error]', error);
      throw error;
    }
  },

  // Buscar documento por ID
  async findById(id: number) {
    try {
      const result = await query(
        'SELECT * FROM documents WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('[Document Find Error]', error);
      throw error;
    }
  },

  // Listar documentos do usuário
  async findByUserId(userId: number, limit = 20, offset = 0) {
    try {
      const result = await query(
        `SELECT * FROM documents 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      
      const countResult = await query(
        'SELECT COUNT(*) FROM documents WHERE user_id = $1',
        [userId]
      );

      return {
        documents: result.rows,
        total: parseInt(countResult.rows[0].count),
      };
    } catch (error) {
      console.error('[Document List Error]', error);
      throw error;
    }
  },

  // Atualizar documento
  async update(id: number, updates: Partial<Document>) {
    try {
      const fields = [];
      const values = [];
      let index = 1;

      if (updates.title !== undefined) {
        fields.push(`title = $${index++}`);
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        fields.push(`content = $${index++}`);
        values.push(updates.content);
      }
      if (updates.status !== undefined) {
        fields.push(`status = $${index++}`);
        values.push(updates.status);
      }
      if (updates.metadata !== undefined) {
        fields.push(`metadata = $${index++}`);
        values.push(JSON.stringify(updates.metadata));
      }

      fields.push(`updated_at = $${index++}`);
      values.push(new Date());
      values.push(id);

      const result = await query(
        `UPDATE documents 
         SET ${fields.join(', ')} 
         WHERE id = $${index}
         RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (error) {
      console.error('[Document Update Error]', error);
      throw error;
    }
  },

  // Deletar documento
  async delete(id: number) {
    try {
      await query('DELETE FROM documents WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('[Document Delete Error]', error);
      throw error;
    }
  },

  // Buscar por tipo de documento
  async findByType(userId: number, type: string, limit = 10) {
    try {
      const result = await query(
        `SELECT * FROM documents 
         WHERE user_id = $1 AND type = $2 
         ORDER BY created_at DESC 
         LIMIT $3`,
        [userId, type, limit]
      );
      return result.rows;
    } catch (error) {
      console.error('[Document Type Search Error]', error);
      throw error;
    }
  },

  // Buscar por título
  async searchByTitle(userId: number, search: string, limit = 10) {
    try {
      const result = await query(
        `SELECT * FROM documents 
         WHERE user_id = $1 AND title ILIKE $2 
         ORDER BY created_at DESC 
         LIMIT $3`,
        [userId, `%${search}%`, limit]
      );
      return result.rows;
    } catch (error) {
      console.error('[Document Search Error]', error);
      throw error;
    }
  },

  // Estatísticas do usuário
  async getUserStats(userId: number) {
    try {
      const result = await query(
        `SELECT 
           COUNT(*) as total_documents,
           COUNT(CASE WHEN type = 'research' THEN 1 END) as research_count,
           COUNT(CASE WHEN type = 'essay' THEN 1 END) as essay_count,
           COUNT(CASE WHEN type = 'summary' THEN 1 END) as summary_count
         FROM documents 
         WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('[Stats Error]', error);
      throw error;
    }
  },
};

export default documentService;
