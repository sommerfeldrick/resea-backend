import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const UserProfileMenu: React.FC = () => {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  
  if (!user) return null;

  const formatNumber = (num: number | undefined): string => {
    if (!num) return '0';
    return num.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setMenuOpen(!menuOpen)} 
        className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-100"
      >
        <img 
          src={user.avatar || '/default-avatar.png'} 
          alt={user.name} 
          className="w-8 h-8 rounded-full"
        />
        <div className="text-left">
          <div className="text-sm font-medium text-gray-700">{user.name}</div>
          <div className="text-xs text-gray-500">{user.email}</div>
        </div>
      </button>
      
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            {/* Dados do usuário simplificados */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Plano</span>
                <span className="text-sm font-medium text-gray-900">
                  {user.plan_name || 'Básico'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Créditos</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatNumber(user.words_left)}
                </span>
              </div>

              <div className="pt-2">
                              <a 
                href="https://smileai.com.br/dashboard" 
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-indigo-600 text-white rounded-lg px-3 py-2 text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                Fazer Upgrade
              </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
