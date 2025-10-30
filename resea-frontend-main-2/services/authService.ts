/**
 * Authentication Service - SmileAI Integration
 */

// URL base for API requests
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface SmileAIUser {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  plan_name?: string;
  plan_type?: 'basic' | 'standard' | 'premium';
  plan_status?: string;
  words_left?: number;
  total_words?: number;
  images_left?: number;
  total_images?: number;
  credits?: number;
  type?: string;
  status?: number;
  remaining_words?: string;
  remaining_images?: string;
  entity_credits?: {
    openai?: { [key: string]: { credit: number, isUnlimited: boolean } };
    stable_diffusion?: { [key: string]: { credit: number, isUnlimited: boolean } };
    anthropic?: { [key: string]: { credit: number, isUnlimited: boolean } };
    gemini?: { [key: string]: { credit: number, isUnlimited: boolean } };
    clipdrop?: { [key: string]: { credit: number, isUnlimited: boolean } };
    azure?: { [key: string]: { credit: number, isUnlimited: boolean } };
    pebblely?: { [key: string]: { credit: number, isUnlimited: boolean } };
    piapi?: { [key: string]: { credit: number, isUnlimited: boolean } };
    [key: string]: { [key: string]: { credit: number, isUnlimited: boolean } } | undefined;
  };
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthResponse {
  user: SmileAIUser;
  token: AuthToken;
}

// Cache configuration
const CACHE_TTL = 30 * 1000; // 30 seconds
// Cache global compartilhado entre todas as instâncias
if (!(global as any).cache) {
  (global as any).cache = new Map<string, {data: any, timestamp: number}>();
}

// Plan configuration
const PLAN_DETAILS: Record<string, { name: string; maxSearches: number; maxWords: number }> = {
  basic: { name: 'Básico', maxSearches: 5, maxWords: 50000 },
  standard: { name: 'Standard', maxSearches: 10, maxWords: 100000 },
  premium: { name: 'Premium', maxSearches: 20, maxWords: 200000 }
};

class AuthService {
  private readonly TOKEN_KEY = 'smileai_token';
  private readonly REFRESH_TOKEN_KEY = 'smileai_refresh_token';
  private readonly USER_KEY = 'smileai_user';

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Credenciais inválidas');
    }

    const { data } = await response.json();
    this.saveAuth(data);
    return data;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    const token = this.getToken();
    
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    this.clearAuth();
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<AuthToken | null> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        this.clearAuth();
        return null;
      }

      const { data } = await response.json();
      this.saveToken(data);
      return data;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearAuth();
      return null;
    }
  }

  /**
   * Cache wrapper
   */
  private async withCache<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const cache = (global as any).cache;
    const cached = cache.get(key);
    const now = Date.now();

    // Se há dados em cache e eles são válidos
    if (cached && now - cached.timestamp < CACHE_TTL) {
      console.log('Usando cache para:', key);
      return cached.data;
    }

    // Caso contrário, buscar dados novos
    console.log('Buscando dados novos para:', key);
    const data = await fetchFn();

    // Armazenar no cache apenas se não for null
    if (data !== null) {
      console.log('Armazenando em cache:', key, data);
      cache.set(key, { data, timestamp: now });
    }

    return data;
  }

  /**
   * Get current user with full profile (including credits/words)
   */
  async getCurrentUser(): Promise<SmileAIUser | null> {
    return this.withCache('currentUser', async () => {
      const token = this.getToken();
      if (!token) return null;

      try {
        console.log('🔐 [RESEA-CREDITOS] Iniciando busca de dados do usuário...');
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          if (response.status === 401) {
            console.log('Token expirado, tentando renovar...');
            const newToken = await this.refreshToken();
            if (newToken) {
              console.log('Token renovado com sucesso, tentando novamente...');
              return this.getCurrentUser();
            }
          }
          console.error('Falha ao buscar dados do usuário:', response.status);
          return null;
        }

        const { data: userData } = await response.json();
        console.log('📦 User data obtido:', {
          id: userData.id,
          name: userData.name,
          remaining_words: userData.remaining_words,
          entity_credits: !!userData.entity_credits
        });
        
        // Estratégia de múltiplas tentativas para obter créditos
        let usageData: any = null;
        let creditsSource = 'nenhum';

        // Tentativa 1: /api/auth/usage-data (endpoint de uso)
        try {
          console.log('🔍 Tentativa 1: Buscando /api/auth/usage-data...');
          const usageResponse = await fetch(`${API_BASE_URL}/api/auth/usage-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (usageResponse.ok) {
            const usageJson = await usageResponse.json();
            usageData = usageJson.data || usageJson;
            creditsSource = 'usage-data';
            console.log('✅ Dados de usage-data obtidos:', usageData);
          } else {
            console.warn('⚠️ /api/auth/usage-data retornou status:', usageResponse.status);
          }
        } catch (error) {
          console.warn('⚠️ Erro ao buscar /api/auth/usage-data:', error);
        }

        // Se não conseguiu do usage-data, tenta /api/auth/profile
        if (!usageData || usageData.words_left === undefined) {
          try {
            console.log('🔍 Tentativa 2: Buscando /api/auth/profile...');
            const profileResponse = await fetch(`${API_BASE_URL}/api/auth/profile`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (profileResponse.ok) {
              const profileJson = await profileResponse.json();
              const profileData = profileJson.data || profileJson;
              if (profileData.words_left !== undefined) {
                usageData = profileData;
                creditsSource = 'profile';
                console.log('✅ Dados de profile obtidos:', usageData);
              }
            } else {
              console.warn('⚠️ /api/auth/profile retornou status:', profileResponse.status);
            }
          } catch (error) {
            console.warn('⚠️ Erro ao buscar /api/auth/profile:', error);
          }
        }

        // Se ainda não tem usageData, tenta extrair de userData.entity_credits
        if (!usageData) {
          console.log('🔍 Tentativa 3: Extraindo de entity_credits...');
          if (userData.entity_credits && typeof userData.entity_credits === 'object') {
            creditsSource = 'entity_credits';
            usageData = {
              words_left: Math.min(
                Object.entries(userData.entity_credits).reduce((sum: number, [_, provider]) => {
                  if (!provider || typeof provider !== 'object') return sum;
                  return sum + Object.values(provider as Record<string, { credit: number, isUnlimited: boolean }>)
                    .reduce((total: number, model) => {
                      if (model.isUnlimited) return total + 999999;
                      return total + (model.credit || 0);
                    }, 0);
                }, 0),
                88600
              )
            };
            console.log('✅ Credits extraídos de entity_credits:', usageData);
          }
        }

        // Se ainda sem dados, tenta usar remaining_words do userData
        if (!usageData && userData.remaining_words) {
          console.log('🔍 Tentativa 4: Usando remaining_words...');
          creditsSource = 'remaining_words';
          usageData = { words_left: Number(userData.remaining_words) };
          console.log('✅ Usando remaining_words:', usageData);
        }

        // Última tentativa: valor padrão
        if (!usageData) {
          console.log('⚠️ Usando fallback padrão: 100 palavras');
          creditsSource = 'fallback-padrão';
          usageData = { words_left: 100 };
        }
        
        // Calcula os totais baseado nos créditos das diferentes APIs
        const totalWords = Math.min(
          Object.entries(userData.entity_credits || {}).reduce((sum: number, [_, provider]) => {
            if (!provider || typeof provider !== 'object') return sum;
            return sum + Object.values(provider as Record<string, { credit: number; isUnlimited: boolean }>)
              .reduce((total: number, model) => {
                if (model.isUnlimited) return total + 999999;
                return total + (model.credit || 0);
              }, 0);
          }, 0),
          88600 // Limite máximo corrigido
        );

        // Mapeia os dados do usuário com o plano correto
        // Prioriza dados de uso se disponíveis, caso contrário usa remaining_words
        // Fallback: se nenhum dado de crédito, começa com 100 palavras padrão
        const wordsLeft = usageData?.words_left !== undefined 
          ? Number(usageData.words_left)
          : userData.remaining_words !== undefined
          ? Number(userData.remaining_words)
          : totalWords > 0 ? totalWords : 100; // Fallback para 100 se nenhum dado
        
        const fullUserData: SmileAIUser = {
          ...userData,
          plan_name: PLAN_DETAILS[userData.plan_type]?.name || (usageData?.plan_name || 'Básico'),
          role: userData.type,
          words_left: Math.max(0, wordsLeft),
          total_words: usageData?.total_words || totalWords || 100,
          images_left: usageData?.images_left !== undefined ? Number(usageData.images_left) : (Number(userData.remaining_images) || 0),
          total_images: usageData?.total_images || 0,
          plan_status: usageData?.plan_status || (userData.status === 1 ? 'active' : 'inactive')
        };

        console.log(`\n✅ [RESEA-CREDITOS] RESULTADO FINAL (fonte: ${creditsSource}):`);
        console.log({
          name: fullUserData.name,
          email: fullUserData.email,
          plan: fullUserData.plan_name,
          words_left: fullUserData.words_left,
          total_words: fullUserData.total_words,
          source: creditsSource
        });
        console.log('[RESEA-CREDITOS] Procure por estes logs para diagnosticar créditos\n');

        this.saveUser(fullUserData);
        return fullUserData;
      } catch (error) {
        console.error('Get current user error:', error);
        return null;
      }
    });
  }

  /**
   * Validate token
   */
  async validateToken(): Promise<boolean> {
    const token = this.getToken();
    
    if (!token) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        return false;
      }

      const { valid } = await response.json();
      return valid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save authentication data
   */
  private saveAuth(data: AuthResponse): void {
    this.saveToken(data.token);
    this.saveUser(data.user);
  }

  /**
   * Save token data
   */
  private saveToken(token: AuthToken): void {
    localStorage.setItem(this.TOKEN_KEY, token.access_token);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token.refresh_token);
  }

  /**
   * Save user data
   */
  private saveUser(user: SmileAIUser): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Clear all authentication data
   */
  private clearAuth(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * Clear cache for a specific key or all cache if no key is provided
   */
  private clearCache(key?: string): void {
    const cache = (global as any).cache;
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get stored refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Get stored user
   */
  getUser(): SmileAIUser | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Make authenticated API request
   */
  /**
   * Get available credits for a user
   */
  async getAvailableCredits(user: SmileAIUser): Promise<number> {
    // Se não tem dados de créditos, retorna 0
    if (!user.entity_credits) return 0;

    // Calcula o total baseado nos créditos das diferentes APIs
    const totalCredits = Object.entries(user.entity_credits).reduce((sum: number, [_, provider]) => {
      if (!provider || typeof provider !== 'object') return sum;
      
      return sum + Object.values(provider as Record<string, { credit: number, isUnlimited: boolean }>)
        .reduce((total: number, model) => {
          if (model.isUnlimited) return total + 88600; // Créditos ilimitados = máximo permitido
          return total + (model.credit || 0);
        }, 0);
    }, 0);

    // Retorna o mínimo entre o total calculado e o limite máximo
    return Math.min(totalCredits, 88600);
  }

  /**
   * Public method to clear authentication data
   */
  clearAuthData(): void {
    this.clearAuth();
    this.clearCache();
  }

  /**
   * Public method to clear user cache
   */
  clearUserCache(): void {
    this.clearCache('currentUser');
  }

  async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
      }
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (response.status === 401) {
      // Try to refresh token
      const newToken = await this.refreshToken();
      if (newToken) {
        // Retry request with new token
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${newToken.access_token}`
        };
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await retryResponse.json();
        return data.data || data;
      } else {
        this.clearAuth();
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    const data = await response.json();
    return data.data || data;
  }
}

export const authService = new AuthService();
