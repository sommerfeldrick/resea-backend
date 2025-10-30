// Serviço para integração com a API do SmileAI via backend proxy
// O backend proxy gerencia a autenticação e comunicação com smileai.com.br
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UserUsageData {
  words_left: number;
  images_left: number;
  plan_name: string;
  plan_status: string;
  total_words: number;
  total_images: number;
  words_used: number;
  images_used: number;
}

interface UserProfile {
  id: number;
  name: string;
  surname: string;
  email: string;
  avatar?: string;
  country?: string;
  phone?: string;
}

interface GenerateContentRequest {
  post_type: string;
  maximum_length: number;
  number_of_results: number;
  creativity: number;
  tone_of_voice: string;
  language: string;
  [key: string]: any; // Para inputs específicos de cada template
}

interface GenerateContentResponse {
  message_id: number;
  workbook: any;
  creativity: number;
  maximum_length: number;
  number_of_results: number;
  inputPrompt: string;
  generated_content: string;
}

class SmileAIAPI {
  private accessToken: string | null = null;

  constructor() {
    // Tenta recuperar o token do localStorage ao inicializar
    this.accessToken = localStorage.getItem('smileai_access_token');
  }

  /**
   * Define o token de acesso manualmente
   * Útil quando o token vem de uma autenticação externa
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
    localStorage.setItem('smileai_access_token', token);
  }

  /**
   * Remove o token de acesso (logout)
   */
  clearAccessToken(): void {
    this.accessToken = null;
    localStorage.removeItem('smileai_access_token');
  }

  /**
   * Verifica se o usuário está autenticado
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Função auxiliar para fazer requisições autenticadas
   */
  private async authenticatedFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('Usuário não autenticado. Token de acesso não encontrado.');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Se receber 401, limpa o token e lança erro
    if (response.status === 401) {
      this.clearAccessToken();
      throw new Error('Sessão expirada. Por favor, faça login novamente.');
    }

    return response;
  }

  /**
   * GET /api/app/usage-data
   * Obtém dados de uso e plano do usuário
   */
  async getUserUsageData(): Promise<UserUsageData> {
    try {
      const response = await this.authenticatedFetch('/api/app/usage-data');

      if (!response.ok) {
        throw new Error(`Erro ao buscar dados de uso: ${response.statusText}`);
      }

      const result = await response.json();
      // Backend retorna { success: true, data: {...} }
      return result.data || result;
    } catch (error) {
      console.error('Erro ao buscar dados de uso:', error);
      throw error;
    }
  }

  /**
   * GET /api/auth/me
   * Obtém perfil do usuário autenticado
   */
  async getUserProfile(): Promise<UserProfile> {
    try {
      const response = await this.authenticatedFetch('/api/auth/me');

      if (!response.ok) {
        throw new Error(`Erro ao buscar perfil: ${response.statusText}`);
      }

      const result = await response.json();
      // Backend retorna { success: true, data: {...} }
      return result.data || result;
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      throw error;
    }
  }

  /**
   * POST /api/aiwriter/generate
   * Gera conteúdo usando IA (texto, código, etc.)
   */
  async generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse> {
    try {
      const formData = new FormData();

      // Adiciona todos os campos do request ao FormData
      Object.keys(request).forEach(key => {
        formData.append(key, String(request[key]));
      });

      const response = await this.authenticatedFetch('/aiwriter/generate', {
        method: 'POST',
        body: formData,
        headers: {
          // Não definir Content-Type para FormData - o browser faz automaticamente
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (response.status === 419) {
        const error = await response.json();
        throw new Error('Créditos insuficientes. Por favor, atualize seu plano.');
      }

      if (!response.ok) {
        throw new Error(`Erro ao gerar conteúdo: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao gerar conteúdo:', error);
      throw error;
    }
  }

  /**
   * POST /api/aiimage/generate-image
   * Gera imagem usando IA
   */
  async generateImage(params: {
    prompt: string;
    size?: string;
    n?: number;
    [key: string]: any;
  }): Promise<any> {
    try {
      const response = await this.authenticatedFetch('/aiimage/generate-image', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (response.status === 419) {
        throw new Error('Créditos de imagem insuficientes. Por favor, atualize seu plano.');
      }

      if (response.status === 409) {
        throw new Error('Geração de imagem em andamento. Por favor, aguarde.');
      }

      if (!response.ok) {
        throw new Error(`Erro ao gerar imagem: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      throw error;
    }
  }

  /**
   * GET /api/documents/recent
   * Obtém os últimos 10 documentos recentes
   */
  async getRecentDocuments(): Promise<any[]> {
    try {
      const response = await this.authenticatedFetch('/documents/recent');

      if (!response.ok) {
        throw new Error(`Erro ao buscar documentos recentes: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Erro ao buscar documentos recentes:', error);
      throw error;
    }
  }

  /**
   * POST /api/auth/logout
   * Faz logout do usuário
   */
  async logout(): Promise<void> {
    try {
      await this.authenticatedFetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      this.clearAccessToken();
    }
  }
}

// Exporta uma instância singleton
export const smileaiAPI = new SmileAIAPI();
export type { UserUsageData, UserProfile, GenerateContentRequest, GenerateContentResponse };
