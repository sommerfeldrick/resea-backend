/**
 * User Synchronization Service
 *
 * Sincroniza usuários do SmileAI OAuth com a tabela local de usuários
 * Garante que a foreign key de generated_documents funcione corretamente
 */

import { query } from '../config/database.js';
import { logger } from '../config/logger.js';

export interface SmileAIUser {
  id: number;           // ID do usuário no SmileAI
  email: string;
  name?: string;
  [key: string]: any;   // Outros campos opcionais
}

export class UserSyncService {
  /**
   * Sincroniza um usuário do SmileAI com a tabela local
   *
   * - Se o usuário já existe (por oauth_id), atualiza os dados
   * - Se não existe, cria um novo registro
   * - Retorna o ID local do usuário (para usar nas foreign keys)
   *
   * @param smileaiUser - Dados do usuário retornados pela API SmileAI
   * @returns ID local do usuário na tabela users
   */
  static async syncUser(smileaiUser: SmileAIUser): Promise<number> {
    try {
      const { id: smileaiId, email, name } = smileaiUser;

      if (!email) {
        throw new Error('Email is required to sync user');
      }

      // 1. Verifica se o usuário já existe (por oauth_id ou email)
      const existingUser = await query(
        `SELECT id FROM users
         WHERE oauth_id = $1 OR email = $2
         LIMIT 1`,
        [smileaiId.toString(), email]
      );

      if (existingUser.rows.length > 0) {
        // Usuário já existe - atualiza os dados
        const localUserId = existingUser.rows[0].id;

        await query(
          `UPDATE users
           SET email = $1,
               name = $2,
               oauth_id = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [email, name || null, smileaiId.toString(), localUserId]
        );

        logger.debug(`User synced (updated): local_id=${localUserId}, smileai_id=${smileaiId}, email=${email}`);
        return localUserId;
      } else {
        // Usuário não existe - cria novo registro
        const result = await query(
          `INSERT INTO users (email, name, oauth_id, credits, created_at, updated_at)
           VALUES ($1, $2, $3, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [email, name || null, smileaiId.toString()]
        );

        const localUserId = result.rows[0].id;

        logger.info(`✅ New user created: local_id=${localUserId}, smileai_id=${smileaiId}, email=${email}`);
        return localUserId;
      }
    } catch (error) {
      logger.error('❌ Error syncing user:', error);
      throw error;
    }
  }

  /**
   * Busca o ID local de um usuário pelo ID do SmileAI
   *
   * @param smileaiId - ID do usuário no SmileAI
   * @returns ID local ou null se não encontrado
   */
  static async getLocalUserId(smileaiId: number): Promise<number | null> {
    try {
      const result = await query(
        `SELECT id FROM users WHERE oauth_id = $1`,
        [smileaiId.toString()]
      );

      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      logger.error('Error getting local user ID:', error);
      return null;
    }
  }

  /**
   * Busca um usuário local completo pelo email
   *
   * @param email - Email do usuário
   * @returns Dados do usuário local ou null
   */
  static async getUserByEmail(email: string) {
    try {
      const result = await query(
        `SELECT * FROM users WHERE email = $1`,
        [email]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Error getting user by email:', error);
      return null;
    }
  }
}
