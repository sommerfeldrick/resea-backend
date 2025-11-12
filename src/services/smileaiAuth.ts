/**
 * SmileAI Authentication Service
 *
 * Serviço completo de autenticação e integração com a plataforma SmileAI
 * usando Laravel Passport OAuth2
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger.js';
import { oauthConfig } from '../config/oauth.js';

export interface SmileAIUser {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any; // Campos adicionais do perfil
}

export interface TokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export interface AuthResponse {
  success: boolean;
  user?: SmileAIUser;
  token?: TokenResponse;
  error?: string;
}

/**
 * Cliente HTTP configurado para SmileAI API
 */
class SmileAIAuthClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: oauthConfig.baseUrl,
      timeout: oauthConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
    });

    // Interceptor para logs
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('SmileAI API Request', {
          method: config.method,
          url: config.url,
          baseURL: config.baseURL,
        });
        return config;
      },
      (error) => {
        logger.error('SmileAI API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('SmileAI API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('SmileAI API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.response?.data || error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Obter access token usando Password Grant
   * Usado para autenticar usuários com email/senha
   */
  async loginWithPassword(
    email: string,
    password: string
  ): Promise<AuthResponse> {
    try {
      const requestData = {
        grant_type: 'password',
        client_id: oauthConfig.passwordGrant.clientId,
        client_secret: oauthConfig.passwordGrant.clientSecret,
        username: email,
        password: password,
        scope: oauthConfig.scopes.all,
      };

      logger.info('SmileAI: Attempting password grant', {
        email,
        endpoint: oauthConfig.oauth.token,
        baseUrl: oauthConfig.baseUrl,
        fullUrl: `${oauthConfig.baseUrl}${oauthConfig.oauth.token}`,
        clientId: oauthConfig.passwordGrant.clientId,
        clientIdType: typeof oauthConfig.passwordGrant.clientId,
        hasClientSecret: !!oauthConfig.passwordGrant.clientSecret,
        clientSecretLength: oauthConfig.passwordGrant.clientSecret?.length || 0,
        clientSecretFirst5: oauthConfig.passwordGrant.clientSecret?.substring(0, 5) || '',
        scope: oauthConfig.scopes.all,
        requestData: {
          grant_type: requestData.grant_type,
          client_id: requestData.client_id,
          username: requestData.username,
          hasPassword: !!requestData.password,
          scope: requestData.scope,
        }
      });

      const response = await this.client.post<TokenResponse>(
        oauthConfig.oauth.token,
        requestData
      );

      logger.info('SmileAI: Password grant successful', { email });

      // Obter dados do usuário
      const user = await this.getUserInfo(response.data.access_token);

      return {
        success: true,
        token: response.data,
        user,
      };
    } catch (error: any) {
      logger.error('SmileAI: Password grant failed', {
        email,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          method: error.config?.method,
        }
      });

      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || 'Falha na autenticação',
      };
    }
  }

  /**
   * Obter access token usando Personal Access Token
   * Usado para chamadas de API sem interação do usuário
   */
  async getPersonalAccessToken(): Promise<string | null> {
    try {
      const response = await this.client.post<TokenResponse>(
        oauthConfig.oauth.token,
        {
          grant_type: 'client_credentials',
          client_id: oauthConfig.personalAccess.clientId,
          client_secret: oauthConfig.personalAccess.clientSecret,
          scope: oauthConfig.scopes.all,
        }
      );

      logger.info('SmileAI: Personal access token obtained');
      return response.data.access_token;
    } catch (error: any) {
      logger.error('SmileAI: Failed to get personal access token', {
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  /**
   * Refresh access token usando refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse | null> {
    try {
      const response = await this.client.post<TokenResponse>(
        oauthConfig.oauth.refresh,
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: oauthConfig.passwordGrant.clientId,
          client_secret: oauthConfig.passwordGrant.clientSecret,
          scope: oauthConfig.scopes.all,
        }
      );

      logger.info('SmileAI: Token refreshed successfully');
      return response.data;
    } catch (error: any) {
      logger.error('SmileAI: Token refresh failed', {
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  /**
   * Obter informações do usuário autenticado
   */
  async getUserInfo(accessToken: string): Promise<SmileAIUser | null> {
    try {
      const response = await this.client.get<SmileAIUser>(
        oauthConfig.auth.me,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      logger.info('SmileAI: User info retrieved', {
        userId: response.data.id,
        email: response.data.email,
      });

      return response.data;
    } catch (error: any) {
      logger.error('SmileAI: Failed to get user info', {
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  /**
   * Obter perfil completo do usuário
   */
  async getUserProfile(accessToken: string): Promise<any> {
    try {
      const response = await this.client.get(oauthConfig.auth.profile, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      logger.info('SmileAI: User profile retrieved');
      return response.data;
    } catch (error: any) {
      logger.error('SmileAI: Failed to get user profile', {
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  /**
   * Validar access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const user = await this.getUserInfo(accessToken);
      return user !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Logout (revogar token)
   */
  async logout(accessToken: string): Promise<boolean> {
    try {
      await this.client.post(
        oauthConfig.auth.logout,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      logger.info('SmileAI: User logged out successfully');
      return true;
    } catch (error: any) {
      logger.error('SmileAI: Logout failed', {
        error: error.response?.data || error.message,
      });
      return false;
    }
  }

  /**
   * Fazer requisição autenticada para qualquer endpoint SmileAI
   */
  async authenticatedRequest<T = any>(
    accessToken: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T | null> {
    try {
      const response = await this.client.request<T>({
        method,
        url: endpoint,
        data,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error('SmileAI: Authenticated request failed', {
        method,
        endpoint,
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  /**
   * Acessar recursos da plataforma SmileAI
   */
  async getDocuments(accessToken: string): Promise<any> {
    return this.authenticatedRequest(
      accessToken,
      'GET',
      oauthConfig.features.documents
    );
  }

  async getChatTemplates(accessToken: string): Promise<any> {
    return this.authenticatedRequest(
      accessToken,
      'GET',
      oauthConfig.features.chatTemplates
    );
  }

  async getBrandVoice(accessToken: string): Promise<any> {
    return this.authenticatedRequest(
      accessToken,
      'GET',
      oauthConfig.features.brandVoice
    );
  }

  async getUserPayments(accessToken: string): Promise<any> {
    return this.authenticatedRequest(
      accessToken,
      'GET',
      oauthConfig.features.payments
    );
  }

  /**
   * Obter dados de uso e créditos do usuário
   * Endpoint: /api/app/usage-data
   */
  async getUserUsageData(accessToken: string): Promise<any> {
    return this.authenticatedRequest(
      accessToken,
      'GET',
      '/api/app/usage-data'
    );
  }
}

// Singleton instance
export const smileaiAuth = new SmileAIAuthClient();

/**
 * Helper: Verificar se o token está próximo de expirar
 */
export function isTokenExpiringSoon(
  expiresIn: number,
  issuedAt: number = Date.now()
): boolean {
  const expiresAt = issuedAt + expiresIn * 1000;
  const now = Date.now();
  const timeUntilExpiry = expiresAt - now;

  // Considera "expirando em breve" se faltam menos de 5 minutos
  return timeUntilExpiry < 5 * 60 * 1000;
}

/**
 * Helper: Extrair token do header Authorization
 */
export function extractTokenFromHeader(
  authHeader: string | undefined
): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

export default smileaiAuth;
