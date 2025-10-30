import React, { useState } from 'react';
import { AcademicTemplatesGallery } from './AcademicTemplatesGallery';
import { DocumentEditor } from './DocumentEditor';
import { generateResearchContent } from '../services/apiService';
import { creditService } from '../services/creditService';

interface ContentGenerationFlowProps {
  onBack?: () => void;
}

type FlowState = 'selecting' | 'generating' | 'editing';

export const ContentGenerationFlow: React.FC<ContentGenerationFlowProps> = ({ onBack }) => {
  const [flowState, setFlowState] = useState<FlowState>('selecting');
  const [generatedContent, setGeneratedContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const handleTemplateSelect = async (prompt: string) => {
    setIsGenerating(true);
    setError(null);
    setFlowState('generating');
    setProgress('🔍 Fazendo scraping de fontes acadêmicas...');

    try {
      // Extrai título do prompt se possível
      const titleMatch = prompt.match(/(?:título|title|tema|topic):\s*([^\n]+)/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Documento Acadêmico';
      setDocumentTitle(title);

      setProgress('🤖 Gerando conteúdo com IA...');

      // Gera o conteúdo
      const result = await generateResearchContent(prompt);

      setGeneratedContent(result.content);
      setWordCount(result.wordCount);
      setProgress('✅ Conteúdo gerado com sucesso!');

      // Atualiza créditos
      await creditService.fetchCredits();

      // Aguarda 1s e mostra editor
      setTimeout(() => {
        setFlowState('editing');
        setIsGenerating(false);
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Erro ao gerar conteúdo');
      setIsGenerating(false);
      setFlowState('selecting');
      console.error('Error generating content:', err);
    }
  };

  const handleFinalize = async (result: { wordCount: number; remaining: number }) => {
    // Volta para seleção após finalizar
    setFlowState('selecting');
    setGeneratedContent('');
    setDocumentTitle('');
    setWordCount(0);

    // Atualiza créditos
    await creditService.fetchCredits();
  };

  const handleCancel = () => {
    setFlowState('selecting');
    setGeneratedContent('');
    setDocumentTitle('');
    setWordCount(0);
    setIsGenerating(false);
  };

  if (flowState === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          {/* Spinner animado */}
          <div className="flex justify-center mb-6">
            <div className="relative w-20 h-20">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 dark:border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Gerando seu documento...
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {progress}
          </p>

          <div className="space-y-3 text-left">
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-2xl">🔍</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Scraping Inteligente</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Coletando dados de Google Scholar, PubMed e Wikipedia
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">IA Multi-Modelo</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Usando Groq, Ollama ou OpenAI com fallback automático
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-2xl">✨</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Conteúdo Acadêmico</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Gerando texto estruturado e bem fundamentado
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              ❌ {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (flowState === 'editing') {
    return (
      <DocumentEditor
        initialContent={generatedContent}
        initialTitle={documentTitle}
        wordCount={wordCount}
        onFinalize={handleFinalize}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <AcademicTemplatesGallery onTemplateSelect={handleTemplateSelect} />
    </div>
  );
};
