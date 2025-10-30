import React, { useEffect, useState } from 'react';
import { smileaiAPI } from '../services/smileaiAPI';

/**
 * Componente para integração de autenticação com SmileAI
 *
 * Estratégias suportadas:
 * 1. Token via URL (mais seguro) - Recomendado
 * 2. Cookie compartilhado entre domínios
 * 3. PostMessage entre janelas
 */

interface AuthIntegrationProps {
  onAuthSuccess?: () => void;
  onAuthError?: (error: string) => void;
}

export const AuthIntegration: React.FC<AuthIntegrationProps> = ({
  onAuthSuccess,
  onAuthError,
}) => {
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      // ESTRATÉGIA 1: Token via URL
      // Exemplo: app.smileai.com.br?token=xxxxx
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');

      if (tokenFromUrl) {
        console.log('Token encontrado na URL');
        smileaiAPI.setAccessToken(tokenFromUrl);

        // Remove o token da URL por segurança
        window.history.replaceState({}, document.title, window.location.pathname);

        // Verifica se o token é válido
        try {
          await smileaiAPI.getUserProfile();
          setAuthStatus('authenticated');
          onAuthSuccess?.();
          return;
        } catch (err) {
          console.error('Token inválido:', err);
          smileaiAPI.clearAccessToken();
        }
      }

      // ESTRATÉGIA 2: Token já existe no localStorage
      if (smileaiAPI.isAuthenticated()) {
        try {
          await smileaiAPI.getUserProfile();
          setAuthStatus('authenticated');
          onAuthSuccess?.();
          return;
        } catch (err) {
          console.error('Token expirado:', err);
          smileaiAPI.clearAccessToken();
        }
      }

      // ESTRATÉGIA 3: Tentar ler de um cookie compartilhado
      // (requer configuração de domínio no backend)
      const tokenFromCookie = getCookie('smileai_token');
      if (tokenFromCookie) {
        smileaiAPI.setAccessToken(tokenFromCookie);
        try {
          await smileaiAPI.getUserProfile();
          setAuthStatus('authenticated');
          onAuthSuccess?.();
          return;
        } catch (err) {
          console.error('Token do cookie inválido:', err);
          smileaiAPI.clearAccessToken();
        }
      }

      // Se chegou aqui, não está autenticado
      setAuthStatus('unauthenticated');
      setError('Usuário não autenticado');
      onAuthError?.('Usuário não autenticado');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao verificar autenticação';
      setError(errorMessage);
      setAuthStatus('unauthenticated');
      onAuthError?.(errorMessage);
    }
  };

  const redirectToLogin = () => {
    // Redireciona para a página de login do domínio principal
    // Passa a URL atual como parâmetro de retorno
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://smileai.com.br/login?return=${returnUrl}`;
  };

  if (authStatus === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-white">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Autenticação Necessária</h2>
            <p className="text-gray-600">
              Para usar esta ferramenta, você precisa estar logado na sua conta SmileAI.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={redirectToLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Fazer Login
          </button>

          <p className="mt-4 text-center text-sm text-gray-500">
            Não tem uma conta?{' '}
            <a
              href="https://smileai.com.br/register"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Criar conta gratuita
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Se autenticado, não renderiza nada (deixa o app principal aparecer)
  return null;
};

// Função auxiliar para ler cookies
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

// Hook para usar autenticação em qualquer componente
export const useSmileAIAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = smileaiAPI.isAuthenticated();

      if (authenticated) {
        try {
          await smileaiAPI.getUserProfile();
          setIsAuthenticated(true);
        } catch {
          setIsAuthenticated(false);
          smileaiAPI.clearAccessToken();
        }
      } else {
        setIsAuthenticated(false);
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const logout = async () => {
    await smileaiAPI.logout();
    setIsAuthenticated(false);
    window.location.href = 'https://smileai.com.br';
  };

  return {
    isAuthenticated,
    loading,
    logout,
  };
};
