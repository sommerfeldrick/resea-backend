import { query } from '../config/database.js';

export interface User {
  id?: number;
  email: string;
  name?: string;
  oauth_id?: string;
  credits?: number;
  created_at?: Date;
  updated_at?: Date;
}

export class UserService {
  /**
   * Obter ou criar usuário
   */
  static async getOrCreateUser(email: string, oauthId?: string, name?: string): Promise<User> {
    try {
      // Primeiro, tenta buscar pelo email
      let result = await query(
        `SELECT * FROM users WHERE email = $1`,
        [email]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Se não existe, cria um novo
      result = await query(
        `INSERT INTO users (email, oauth_id, name, credits)
         VALUES ($1, $2, $3, 100)
         RETURNING *`,
        [email, oauthId || null, name || null]
      );

      console.log(`✅ Novo usuário criado: ${email}`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao buscar/criar usuário:', error);
      throw error;
    }
  }

  /**
   * Obter créditos do usuário
   */
  static async getCredits(userId: number): Promise<number> {
    try {
      const result = await query(
        `SELECT credits FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      return result.rows[0].credits;
    } catch (error) {
      console.error('❌ Erro ao buscar créditos:', error);
      throw error;
    }
  }

  /**
   * Atualizar créditos
   */
  static async updateCredits(userId: number, amount: number, operation: 'add' | 'subtract' = 'subtract') {
    try {
      const operator = operation === 'add' ? '+' : '-';
      const result = await query(
        `UPDATE users 
         SET credits = credits ${operator} $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING credits`,
        [Math.abs(amount), userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      console.log(`✅ Créditos atualizados: ${result.rows[0].credits}`);
      return result.rows[0].credits;
    } catch (error) {
      console.error('❌ Erro ao atualizar créditos:', error);
      throw error;
    }
  }

  /**
   * Obter informações do usuário
   */
  static async getUser(userId: number): Promise<User> {
    try {
      const result = await query(
        `SELECT id, email, name, oauth_id, credits, created_at, updated_at
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao buscar usuário:', error);
      throw error;
    }
  }

  /**
   * Atualizar informações do usuário
   */
  static async updateUser(userId: number, updates: Partial<User>) {
    try {
      const { name, email } = updates;
      
      const result = await query(
        `UPDATE users 
         SET name = COALESCE($1, name),
             email = COALESCE($2, email),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [name || null, email || null, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      console.log(`✅ Usuário ${userId} atualizado`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  /**
   * Deletar usuário (e todo seu histórico)
   */
  static async deleteUser(userId: number) {
    try {
      const result = await query(
        `DELETE FROM users WHERE id = $1 RETURNING id`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      console.log(`✅ Usuário ${userId} deletado`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar usuário:', error);
      throw error;
    }
  }
}
