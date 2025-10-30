import React, { useState } from 'react';
import { SparkleIcon, PaperclipIcon } from './icons';
import { generateTaskPlan } from '../services/apiService';
import type { TaskPlan } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { AcademicTemplatesGallery } from './AcademicTemplatesGallery';
import { FileUploadModal } from './FileUploadModal';
import type { UploadedFile } from '../types/templates';

interface LandingPageProps {
  onPlanGenerated: (plan: TaskPlan, query: string) => void;
  onBack?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onPlanGenerated, onBack }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      // Settings are now hardcoded in the service for deep research and humanized style.
      const plan = await generateTaskPlan(query);
      onPlanGenerated(plan, query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar o plano de pesquisa. Por favor, tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="p-4 sm:p-6 flex justify-end items-center gap-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  title="Voltar ao dashboard"
                  className="p-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => {
                  const html = document.documentElement;
                  html.classList.toggle('dark');
                  localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
                }}
                title="Alternar tema"
                className="p-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>

          </div>
      </header>
      <main className="flex-grow flex items-center justify-center px-6 py-12 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-5xl">
          <div className="text-left mb-10">
            <h1 className="text-3xl sm:text-4xl text-gray-600 dark:text-gray-400">
              Olá, {user?.name || 'Usuário'}
            </h1>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mt-2">
              O que posso pesquisar para você?
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="mt-10">
            <div className="relative p-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-500 transition-colors">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pergunte ao SmileAI..."
                className="w-full h-28 p-4 text-base border-none focus:ring-0 resize-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                disabled={isLoading}
              />
              <div className="p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFileUpload(true)}
                      className="flex items-center gap-2 rounded-lg bg-white dark:bg-gray-700 p-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      title="Anexar arquivos PDF, DOCX, TXT..."
                    >
                        <PaperclipIcon className="w-5 h-5" />
                        Anexar Arquivos
                        {attachedFiles.length > 0 && (
                          <span className="ml-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold">
                            {attachedFiles.length}
                          </span>
                        )}
                    </button>
                </div>
                 <button
                    type="submit"
                    className="w-10 h-10 flex items-center justify-center bg-gray-900 dark:bg-indigo-600 rounded-lg hover:bg-gray-800 dark:hover:bg-indigo-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors"
                    disabled={isLoading || !query.trim()}
                    aria-label="Submit search"
                 >
                    {isLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    )}
                 </button>
              </div>
            </div>
          </form>
          {error && <p className="mt-6 text-sm text-red-600 text-center">{error}</p>}

          <div className="mt-16">
            <AcademicTemplatesGallery
              onTemplateSelect={(prompt) => {
                setQuery(prompt);
              }}
            />
          </div>
        </div>
      </main>

      {/* Modal de Upload */}
      {showFileUpload && (
        <FileUploadModal
          onClose={() => setShowFileUpload(false)}
          onFilesUploaded={(files) => {
            setAttachedFiles(files);
            setShowFileUpload(false);
          }}
          allowMultiple={true}
        />
      )}
    </div>
  );
};