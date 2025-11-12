/**
 * OAuth Configuration for SmileAI Platform Integration
 *
 * Integração completa com a plataforma SmileAI usando Laravel Passport OAuth2
 * Documentação oficial: https://smileai.com.br/docs
 *
 * Módulos disponíveis na plataforma:
 * - AI Chat, AI Writer, AI Image Generation
 * - Documents, Brand Voice, Chat Templates
 * - User Profile, Payments, Support, Affiliates
 */

export const oauthConfig = {
  // Personal Access Client (Client ID: 1)
  // Usado para chamadas diretas de API sem interação do usuário
  personalAccess: {
    clientId: '1',
    clientSecret: 'Q2NM4Z6f4xt6HzlGhwRroO6eN5byqdjjmJoblJZX',
  },

  // Password Grant Client (Client ID: 2) ⭐ RECOMENDADO para SSO
  // Usado para autenticação de usuários com email/senha
  passwordGrant: {
    clientId: parseInt(process.env.OAUTH_CLIENT_ID || '2'),
    clientSecret: process.env.OAUTH_CLIENT_SECRET as string,
  },

  // Base URL da plataforma SmileAI (Laravel Passport)
  baseUrl: process.env.MAIN_DOMAIN_API || 'https://smileai.com.br',

  // Endpoints OAuth2 (Laravel Passport)
  oauth: {
    authorize: '/oauth/authorize',  // GET - Tela de autorização
    token: '/oauth/token',          // POST - Obter access token (usado também para refresh)
    refresh: '/oauth/token',        // POST - Refresh access token (mesmo endpoint, grant_type diferente)
  },

  // Endpoints de Autenticação
  auth: {
    login: '/api/login',           // POST - Login (se disponível)
    logout: '/api/logout',         // POST - Logout
    me: '/api/user',               // GET - Usuário autenticado
    profile: '/api/user/profile',  // GET - Perfil completo
  },

  // Endpoints de funcionalidades SmileAI disponíveis
  features: {
    // AI Features
    aiChat: '/api/ai-chat',
    aiWriter: '/api/ai-writer',
    aiImageGeneration: '/api/ai-image-generation',

    // Content Management
    documents: '/api/documents',
    brandVoice: '/api/brand-voice',
    chatTemplates: '/api/chat-templates',

    // User & Business
    userProfile: '/api/user/profile',
    payments: '/api/payments',
    affiliates: '/api/affiliates',
    support: '/api/support',
    appSettings: '/api/app-settings',
  },

  // Scopes OAuth2 (deixar vazio para acesso total se não houver scopes específicos)
  // Laravel Passport geralmente não requer scope específico para password grant
  scopes: {
    default: '',
    all: ''  // Deixar vazio - Laravel Passport aceita requisições sem scope
  },

  // Configurações de requisição
  timeout: 8000, // 8 segundos (reduzido para evitar timeout no frontend)
  retries: 0, // Sem retry - falha rápido se Cloudflare bloquear
};

export default oauthConfig;
