import React, { useState, useEffect, useRef } from 'react';
import { LandingPage } from './components/LandingPage';
import { ResearchPage } from './components/ResearchPage';
import { LoginPage } from './components/LoginPage';
import { ContentGenerationFlow } from './components/ContentGenerationFlow';
import { UserDashboard } from './components/UserDashboard';
import { AuthIntegration } from './components/AuthIntegration';
import { LogoIcon, PlusIcon, BrainCircuitIcon, MoreHorizontalIcon } from './components/icons';
import type { TaskPlan, CompletedResearch, MindMapData, ResearchResult } from './types';
import { mockHistory } from './mockData';
import { AuthProvider, useAuth } from './contexts/AuthContext';


const HistoryItem: React.FC<{
    item: CompletedResearch;
    isActive: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
}> = ({ item, isActive, onSelect, onDelete }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={`group flex items-center justify-between rounded-md ${isActive ? 'bg-indigo-100' : 'hover:bg-gray-200'}`}>
            <button 
                onClick={() => onSelect(item.id)} 
                className={`flex-grow text-left px-2 py-1.5 text-sm rounded-l-md truncate ${isActive ? 'text-indigo-700 font-medium' : 'text-gray-600'}`}
            >
                {item.query}
            </button>
            <div className="relative pr-1" ref={menuRef}>
                <button onClick={() => setMenuOpen(prev => !prev)} className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-500 hover:text-gray-800 p-1 rounded-full" aria-label="Opções">
                    <MoreHorizontalIcon className="w-4 h-4" />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                        <button onClick={() => { onDelete(item.id); setMenuOpen(false); }} className="block w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md">
                            Excluir
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};


const Sidebar: React.FC<{
    onNewSearch: () => void;
    onSelectHistory: (id: string) => void;
    onDeleteHistory: (id: string) => void;
    activeItemId: string | null;
    history: CompletedResearch[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}> = ({ onNewSearch, onSelectHistory, onDeleteHistory, activeItemId, history, isCollapsed, onToggleCollapse }) => {
    const { user, logout } = useAuth();
    const [showProfileMenu, setShowProfileMenu] = React.useState(false);

    // For demonstration, we'll split the mock history.
    const recents = history.slice(0, 1);
    const historyItems = history.slice(1);

    if (isCollapsed) {
        return (
            <aside className="w-16 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-2 h-full relative">
                <button
                    onClick={onToggleCollapse}
                    className="w-full flex items-center justify-center p-2 mb-4 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Expandir sidebar"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                </button>
                <button
                    onClick={onNewSearch}
                    className="w-full flex items-center justify-center p-2 text-white bg-gray-800 dark:bg-indigo-600 rounded-lg hover:bg-gray-700 dark:hover:bg-indigo-700 transition-colors"
                    title="Novo Documento"
                >
                    <PlusIcon className="h-5 w-5" />
                </button>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                        {user?.name?.substring(0, 1).toUpperCase() || 'U'}
                    </div>
                </div>
            </aside>
        );
    }

    return (
        <aside className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 h-full relative">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                    <LogoIcon className="h-8 w-8 dark:text-white" />
                    <span className="text-xl font-bold text-gray-900 dark:text-white">SmileAI</span>
                </div>
                <button
                    onClick={onToggleCollapse}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Recolher sidebar"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </button>
            </div>
            <button
                onClick={onNewSearch}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-800 dark:bg-indigo-600 rounded-lg hover:bg-gray-700 dark:hover:bg-indigo-700 transition-colors mb-4"
            >
                <PlusIcon className="h-5 w-5" />
                Novo Documento
            </button>

            {/* Card de Perfil - Fixo no fim da sidebar */}
            <div className="absolute bottom-4 left-4 right-4">
                <div className="relative">
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                    >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                            {user?.name?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {user?.name || 'Usuário'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {user?.email || ''}
                            </div>
                        </div>
                        <svg
                            className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${showProfileMenu ? 'rotate-180' : ''}`}
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showProfileMenu && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 py-3 px-3 z-50 w-56 space-y-3">
                            {/* Dados do Plano */}
                            <div className="border-b border-gray-200 dark:border-gray-600 pb-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Plano</span>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {user?.plan_name || 'Básico'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Créditos</span>
                                    <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                                        {user?.words_left || user?.credits || '0'}
                                    </span>
                                </div>
                            </div>

                            {/* Botão Upgrade */}
                            <a 
                                href="https://smileai.com.br/dashboard" 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full text-center bg-indigo-600 text-white rounded-lg px-3 py-2 text-xs font-semibold hover:bg-indigo-700 transition-colors"
                            >
                                Fazer Upgrade
                            </a>

                            {/* Botão Sair */}
                            <button
                                onClick={() => {
                                    setShowProfileMenu(false);
                                    logout();
                                }}
                                className="w-full px-3 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 rounded-lg transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Sair
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};


const PlanConfirmation: React.FC<{ plan: TaskPlan, onConfirm: () => void, onCancel: () => void }> = ({ plan, onConfirm, onCancel }) => {
    const renderPhaseList = (title: string, steps: string[]) => (
        <div>
            <h4 className="font-semibold text-gray-700 mt-4 mb-2 flex items-center gap-2">
                <BrainCircuitIcon className="w-5 h-5" /> Fase de {title}
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {steps.map((step, i) => <li key={i}>{step}</li>)}
            </ul>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center flex-shrink-0">
                <h1 className="text-lg font-semibold text-gray-800">Plano de Execução da Tarefa</h1>
                <div>
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Voltar
                    </button>
                    <button onClick={onConfirm} className="ml-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                        Iniciar Pesquisa
                    </button>
                </div>
            </header>
            <main className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <p className="text-gray-700 mb-6">Aqui está o plano de pesquisa que preparei com base em sua solicitação. Por favor, revise e confirme para iniciar o processo.</p>

                    <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <h2 className="text-lg font-bold text-indigo-900 mb-4">{plan.taskTitle}</h2>
                        <div>
                            <h3 className="font-semibold text-gray-800 mb-2">Descrição da Tarefa</h3>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <div><span className="text-gray-500">Tipo:</span> <span className="text-gray-800">{plan.taskDescription.type}</span></div>
                                <div><span className="text-gray-500">Público:</span> <span className="text-gray-800">{plan.taskDescription.audience}</span></div>
                                <div><span className="text-gray-500">Estilo:</span> <span className="text-gray-800">{plan.taskDescription.style}</span></div>
                                <div><span className="text-gray-500">Contagem de Palavras:</span> <span className="text-gray-800">{plan.taskDescription.wordCount}</span></div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <h3 className="font-semibold text-gray-800 mb-2">Plano de Execução da Tarefa</h3>
                            {renderPhaseList('pensamento', plan.executionPlan.thinking)}
                            {renderPhaseList('pesquisa', plan.executionPlan.research)}
                            {renderPhaseList('escrita', plan.executionPlan.writing)}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, loading, handleTokenRedirect } = useAuth();
  const [view, setView] = useState<'landing' | 'plan_confirmation' | 'research' | 'content_generation'>('landing');
  const [taskPlan, setTaskPlan] = useState<TaskPlan | null>(null);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<CompletedResearch[]>(mockHistory);
  const [currentResearch, setCurrentResearch] = useState<CompletedResearch | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Handle token from redirect URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      handleTokenRedirect(token);
      // Clean URL after handling the token
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [handleTokenRedirect]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handlePlanGenerated = (plan: TaskPlan, userQuery: string) => {
    setTaskPlan(plan);
    setQuery(userQuery);
    setCurrentResearch(null);
    setView('plan_confirmation');
  };

  const handleStartResearch = () => {
    if (taskPlan) {
      setView('research');
    }
  };

  const handleNewSearch = () => {
    setView('landing');
    setTaskPlan(null);
    setQuery('');
    setCurrentResearch(null);
  };
  
  const handleSelectHistory = (id: string) => {
      const item = history.find(h => h.id === id);
      if (item) {
          setCurrentResearch(item);
          setTaskPlan(null);
          setQuery('');
          setView('research');
      }
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (currentResearch?.id === id) {
        handleNewSearch();
    }
  };
  
  const handleResearchComplete = (data: Omit<CompletedResearch, 'id' | 'query'>) => {
      const newEntry: CompletedResearch = {
          id: `history-${Date.now()}`,
          query: query,
          ...data,
      };
      setHistory(prev => [newEntry, ...prev]);
      setCurrentResearch(newEntry);
  };

  const getActiveItemId = () => {
      if (currentResearch) {
          return currentResearch.id;
      }
      // If it's a new search that matches a historic query, also activate it.
      const existing = history.find(h => h.query === query);
      return existing?.id || null;
  }

  const renderContent = () => {
    switch (view) {
      case 'landing':
        return <LandingPage onPlanGenerated={handlePlanGenerated} />;
      case 'content_generation':
        return <ContentGenerationFlow onBack={handleNewSearch} />;
      case 'plan_confirmation':
        return taskPlan ? (
          <PlanConfirmation plan={taskPlan} onConfirm={handleStartResearch} onCancel={handleNewSearch} />
        ) : (
          <div className="flex items-center justify-center h-full">Error: No plan to confirm.</div>
        );
      case 'research':
        if (currentResearch) {
            return <ResearchPage key={currentResearch.id} initialData={currentResearch} />
        }
        if (taskPlan && query) {
            return <ResearchPage key={query} taskPlan={taskPlan} query={query} onResearchComplete={handleResearchComplete} />
        }
        return <div className="flex items-center justify-center h-full">Carregando...</div>;
      default:
        return <LandingPage onPlanGenerated={handlePlanGenerated} />;
    }
  }

  return (
    <div className="h-screen bg-white text-gray-800 font-sans">
      <div className="fixed top-0 left-0 h-screen z-40">
        <Sidebar
          onNewSearch={handleNewSearch}
          onSelectHistory={handleSelectHistory}
          onDeleteHistory={handleDeleteHistory}
          activeItemId={getActiveItemId()}
          history={history}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>
      <main className={`h-screen flex flex-col ${sidebarCollapsed ? 'ml-16' : 'ml-64'} transition-all duration-300`}>
        {renderContent()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
// Create a new file for mock data to keep App.tsx clean
const mockDataFile = 'mockData.ts';
const mockDataContent = `
import type { CompletedResearch } from './types';

export const mockHistory: CompletedResearch[] = [
    {
        id: 'hist-1',
        query: 'implantes hexágono externo...',
        taskPlan: {
            taskTitle: 'Revisão de Literatura: Aplicações de Implantes de Hexágono Externo',
            taskDescription: { type: 'Revisão Acadêmica', style: 'Científico', audience: 'Estudantes de Odontologia', wordCount: '5000' },
            executionPlan: { thinking: [], research: [], writing: [] }
        },
        mindMapData: {
            nodes: [{ id: '1', type: 'input', data: { label: 'Implantes Hexágono Externo' }, position: { x: 250, y: 25 } }],
            edges: []
        },
        researchResults: [],
        outline: '## Esboço de Exemplo',
        writtenContent: '# Documento de Exemplo para Histórico'
    },
    {
        id: 'hist-2',
        query: 'Revisão Sistemática da Liter...',
        taskPlan: {
            taskTitle: 'Revisão Sistemática da Literatura sobre IA',
            taskDescription: { type: 'Revisão Sistemática', style: 'Acadêmico', audience: 'Pesquisadores', wordCount: '10000' },
            executionPlan: { thinking: [], research: [], writing: [] }
        },
        mindMapData: null,
        researchResults: [],
        outline: '',
        writtenContent: '# Revisão Sistemática sobre IA'
    },
     {
        id: 'hist-3',
        query: 'Impacto das Mudanças Clim...',
        taskPlan: { taskTitle: 'Impacto das Mudanças Climáticas', taskDescription: { type: 'Artigo', style: 'Divulgação', audience: 'Público Geral', wordCount: '2000' }, executionPlan: { thinking: [], research: [], writing: [] }},
        mindMapData: null, researchResults: [], outline: '', writtenContent: ''
    },
     {
        id: 'hist-4',
        query: 'Análise do Cenário Competi...',
        taskPlan: { taskTitle: 'Análise do Cenário Competitivo de Startups', taskDescription: { type: 'Relatório', style: 'Negócios', audience: 'Investidores', wordCount: '3000' }, executionPlan: { thinking: [], research: [], writing: [] }},
        mindMapData: null, researchResults: [], outline: '', writtenContent: ''
    },
     {
        id: 'hist-5',
        query: 'Pesquisa de Posicionament...',
        taskPlan: { taskTitle: 'Pesquisa de Posicionamento de Marca', taskDescription: { type: 'Estudo de Caso', style: 'Marketing', audience: 'Gerentes de Produto', wordCount: '4000' }, executionPlan: { thinking: [], research: [], writing: [] }},
        mindMapData: null, researchResults: [], outline: '', writtenContent: ''
    },
     {
        id: 'hist-6',
        query: 'Apresentando Resea',
        taskPlan: { taskTitle: 'Apresentando Resea AI', taskDescription: { type: 'Apresentação', style: 'Técnico', audience: 'Desenvolvedores', wordCount: '1500' }, executionPlan: { thinking: [], research: [], writing: [] }},
        mindMapData: null, researchResults: [], outline: '', writtenContent: ''
    }
];
`;
// Note: In a real environment, you'd create this file. 
// For this tool, the content is just illustrative of the separation of concerns.
// Let's create `mockData.ts`
import { mockHistory as importedMock } from './mockData';