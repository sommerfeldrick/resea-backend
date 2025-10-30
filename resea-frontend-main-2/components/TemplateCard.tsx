import React, { useState } from 'react';
import type { AcademicTemplate } from '../data/academicTemplates';
import { templateService } from '../services/templateService';

interface TemplateCardProps {
  template: AcademicTemplate;
  isFavorite: boolean;
  usageCount?: number;
  onSelect: () => void;
  onFavoriteToggle: () => void;
  showPreview?: boolean;
}

// Mapeamento de ícones elegantes em SVG
const getTemplateIcon = (emoji: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    '📝': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    '🔍': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    '🎯': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    '📚': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    '🔬': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    '⚗️': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
    '📊': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    '📈': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    '💡': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    '🎓': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
    '✍️': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    '🗂️': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
    '🧩': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>,
    '🔗': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    '🌐': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    '🏁': <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>,
  };

  return iconMap[emoji] || <span className="text-2xl text-gray-600">{emoji}</span>;
};

// Renderizar componentes de ícone - versão atualizada para usar componentes React
const getTemplateIconComponent = (icon: React.FC<{ className?: string }>) => {
  const Icon = icon;
  return <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />;
};

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isFavorite,
  usageCount = 0,
  onSelect,
  onFavoriteToggle,
  showPreview = false
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  return (
    <>
    <div className="group relative text-left bg-white/90 dark:bg-slate-800/80 backdrop-blur-xl border border-gray-100/50 dark:border-slate-700/50 rounded-2xl shadow-sm hover:shadow-2xl hover:border-indigo-200/50 dark:hover:border-indigo-500/30 transition-all duration-500 overflow-hidden hover:-translate-y-2">
      <button onClick={onSelect} className="w-full text-left">
        {/* Gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Header com ícone e badges */}
        <div className="p-5 pb-4 bg-gradient-to-br from-indigo-50/50 via-transparent to-transparent dark:from-indigo-950/20 dark:via-transparent dark:to-transparent border-b border-gray-100/30 dark:border-slate-700/30">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100/80 to-purple-100/80 dark:from-indigo-900/40 dark:to-purple-900/40 shadow-md shadow-indigo-200/50 dark:shadow-indigo-950/50 ring-1 ring-indigo-200/50 dark:ring-indigo-500/20 group-hover:shadow-lg group-hover:shadow-indigo-300/50 transition-all duration-300">
              {getTemplateIconComponent(template.icon)}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm rounded-lg shadow-sm ring-1 ring-gray-200/50 dark:ring-slate-600/50 text-xs hover:bg-white/100 dark:hover:bg-slate-700/70 transition-all duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">{template.popularityScore}%</span>
              </div>
              {usageCount > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-indigo-600/90 to-purple-600/90 dark:from-indigo-500/80 dark:to-purple-500/80 rounded-lg shadow-md shadow-indigo-500/30 dark:shadow-indigo-950/50 text-xs backdrop-blur-sm"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-bold text-white">{usageCount}x</span>
                  {showTooltip && (
                    <div className="absolute right-0 top-full mt-2 px-3 py-2 bg-gray-900/95 dark:bg-slate-950 text-white text-xs rounded-lg whitespace-nowrap z-20 shadow-xl backdrop-blur-sm border border-gray-700/50">
                      Você já usou este template
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug line-clamp-2">
            {template.title}
          </h3>
        </div>

        {/* Corpo do card */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 line-clamp-2">{template.description}</p>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100/60 dark:bg-slate-700/40 text-gray-700 dark:text-gray-300 text-xs font-medium ring-1 ring-gray-200/50 dark:ring-slate-600/30 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {template.estimatedTime} min
            </span>
            <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ring-1 transition-all duration-200 ${
              template.difficulty === 'beginner' 
                ? 'bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-emerald-200/50 dark:ring-emerald-700/30' 
                : template.difficulty === 'intermediate'
                ? 'bg-amber-100/60 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-amber-200/50 dark:ring-amber-700/30'
                : 'bg-rose-100/60 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 ring-rose-200/50 dark:ring-rose-700/30'
            }`}>
              {template.difficulty === 'beginner' ? 'Fácil' : template.difficulty === 'intermediate' ? 'Médio' : 'Avançado'}
            </span>
          </div>
        </div>

        {showPreview && (
          <div className="px-5 pb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPreviewModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600/10 to-purple-600/10 dark:from-indigo-500/20 dark:to-purple-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg ring-1 ring-indigo-200/50 dark:ring-indigo-500/30 hover:from-indigo-600/20 hover:to-purple-600/20 hover:ring-indigo-300/50 dark:hover:ring-indigo-500/50 transition-all duration-300 hover:-translate-y-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver exemplo
            </button>
          </div>
        )}
      </button>
    </div>

    {/* Modal de Preview */}
    {showPreviewModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={() => setShowPreviewModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-indigo-50 to-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-md">
                  {getTemplateIconComponent(template.icon)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{template.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Campos Necessários:</h4>
                <div className="space-y-2">
                  {template.requiredFields.map((field, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-indigo-600 mt-1">•</span>
                      <div>
                        <span className="font-medium text-gray-700">{field.label}</span>
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                        {field.placeholder && (
                          <p className="text-sm text-gray-500 mt-0.5">{field.placeholder}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Template do Prompt:</h4>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {template.promptTemplate}
                  </pre>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>~{template.estimatedTime} minutos</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  template.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                  template.difficulty === 'intermediate' ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-700'
                }`}>
                  {template.difficulty === 'beginner' ? 'Iniciante' : template.difficulty === 'intermediate' ? 'Intermediário' : 'Avançado'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={() => setShowPreviewModal(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors font-medium"
            >
              Fechar
            </button>
            <button
              onClick={() => {
                setShowPreviewModal(false);
                onSelect();
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
            >
              Usar este Template
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
