import React, { useState, useEffect, useMemo } from 'react';
import { academicTemplates, categoryInfo, AcademicTemplate } from '../data/academicTemplates';
import type { TaskPlan } from '../types';
import { templateService } from '../services/templateService';
import { TemplateCard } from './TemplateCard';
import { useTemplateFeatures } from '../hooks/useTemplateFeatures';

// Mapeamento de ícones para categorias
const getCategoryIcon = (emoji: string) => {
  const iconMap: Record<string, React.ReactElement> = {
    '📝': <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    '📚': <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    '🔬': <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    '📊': <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    '✅': <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    '📄': <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  };

  return iconMap[emoji] || <span className="text-lg">{emoji}</span>;
};

interface TemplateModalProps {
  template: AcademicTemplate;
  onClose: () => void;
  onSubmit: (filledTemplate: string, filledData: Record<string, any>) => void;
}

const TemplateModal: React.FC<TemplateModalProps> = ({ template, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const [currentTag, setCurrentTag] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Preparar dados preenchidos combinando formData e tags
    const allFilledData: Record<string, any> = { ...formData };
    Object.entries(tags).forEach(([key, value]) => {
      allFilledData[key] = value;
    });

    // Substituir placeholders no template
    let filledPrompt = template.promptTemplate;
    template.requiredFields.forEach(field => {
      const value = field.type === 'tags' ? tags[field.name]?.join(', ') : formData[field.name];
      const placeholder = `{${field.name}}`;
      filledPrompt = filledPrompt.replace(new RegExp(placeholder, 'g'), value || '');
    });

    onSubmit(filledPrompt, allFilledData);
  };

  const handleAddTag = (fieldName: string) => {
    const tag = currentTag[fieldName]?.trim();
    if (tag) {
      setTags(prev => ({
        ...prev,
        [fieldName]: [...(prev[fieldName] || []), tag]
      }));
      setCurrentTag(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  const handleRemoveTag = (fieldName: string, index: number) => {
    setTags(prev => ({
      ...prev,
      [fieldName]: prev[fieldName].filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100">
              {template.icon && React.createElement(template.icon, { className: 'w-6 h-6 text-indigo-600' })}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{template.title}</h2>
              <p className="text-sm text-gray-600">{template.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6 flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ~{template.estimatedTime} min
            </span>
            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium capitalize">
              {template.difficulty === 'beginner' ? 'Iniciante' : template.difficulty === 'intermediate' ? 'Intermediário' : 'Avançado'}
            </span>
          </div>

          <div className="space-y-4">
            {template.requiredFields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    required={field.required}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                )}

                {field.type === 'textarea' && (
                  <textarea
                    required={field.required}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                )}

                {field.type === 'select' && (
                  <select
                    required={field.required}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                )}

                {field.type === 'tags' && (
                  <div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder={field.placeholder}
                        value={currentTag[field.name] || ''}
                        onChange={(e) => setCurrentTag({ ...currentTag, [field.name]: e.target.value })}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag(field.name);
                          }
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTag(field.name)}
                        className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                      >
                        Adicionar
                      </button>
                    </div>
                    {tags[field.name]?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags[field.name].map((tag, index) => (
                          <span key={index} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(field.name, index)}
                              className="hover:text-indigo-900"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Gerar Pesquisa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AcademicTemplatesGalleryProps {
  onTemplateSelect: (prompt: string) => void;
}

export const AcademicTemplatesGallery: React.FC<AcademicTemplatesGalleryProps> = ({ onTemplateSelect }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('introducao');
  const [selectedTemplate, setSelectedTemplate] = useState<AcademicTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { favorites, usageCounts, toggleFavorite, addToHistory, isFavorite, getUsageCount } = useTemplateFeatures();

  const filteredTemplates = useMemo(() => {
    let templates = academicTemplates.filter(t => t.category === selectedCategory);

    // Filtrar por favoritos
    if (showFavoritesOnly) {
      templates = templates.filter(t => isFavorite(t.id));
    }

    // Filtrar por busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }

    return templates;
  }, [selectedCategory, showFavoritesOnly, searchQuery, favorites]);

  const categories = Object.keys(categoryInfo) as Array<keyof typeof categoryInfo>;

  return (
    <div className="w-full">
      <div className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Modelos de Escrita Acadêmica</h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Escolha um modelo pronto para iniciar sua pesquisa rapidamente</p>
        </div>
      </div>

      {/* Tabs de Categorias */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => {
          const info = categoryInfo[cat];
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold whitespace-nowrap transition-all shadow-sm ${
                isActive
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-indigo-200 dark:shadow-indigo-900 shadow-lg scale-105'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md'
              }`}
            >
              {getCategoryIcon(info.icon)}
              <span>{info.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid de Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isFavorite={isFavorite(template.id)}
            usageCount={getUsageCount(template.id)}
            onSelect={() => setSelectedTemplate(template)}
            onFavoriteToggle={() => toggleFavorite(template.id)}
            showPreview={true}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600">Nenhum template encontrado</p>
          {(searchQuery || showFavoritesOnly) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowFavoritesOnly(false);
              }}
              className="mt-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {selectedTemplate && (
        <TemplateModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onSubmit={(prompt, filledData) => {
            // Salvar no histórico
            addToHistory(selectedTemplate.id, filledData, prompt);
            // Enviar prompt
            onTemplateSelect(prompt);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
};
