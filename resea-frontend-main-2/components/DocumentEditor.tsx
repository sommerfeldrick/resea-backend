import React, { useState, useEffect } from 'react';
import { finalizeDocument } from '../services/apiService';
import { creditService } from '../services/creditService';

interface DocumentEditorProps {
  initialContent: string;
  initialTitle?: string;
  wordCount: number;
  onFinalize?: (result: { wordCount: number; remaining: number }) => void;
  onCancel?: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  initialContent,
  initialTitle = 'Documento sem título',
  wordCount: initialWordCount,
  onFinalize,
  onCancel
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [wordCount, setWordCount] = useState(initialWordCount);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Atualiza contagem de palavras quando o conteúdo muda
  useEffect(() => {
    const words = content.trim().split(/\s+/).filter(w => w.length > 0).length;
    setWordCount(words);
  }, [content]);

  const handleFinalize = async () => {
    if (!content.trim()) {
      setError('O documento não pode estar vazio');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await finalizeDocument(content, title);

      // Atualiza créditos no cache local
      await creditService.fetchCredits();

      if (onFinalize) {
        onFinalize({
          wordCount: result.wordCount,
          remaining: result.remaining
        });
      }

      alert(`✅ ${result.message}\n\n` +
            `📝 Palavras: ${result.wordCount}\n` +
            `💰 Créditos restantes: ${result.remaining.toLocaleString('pt-BR')} palavras`);

    } catch (err: any) {
      setError(err.message || 'Erro ao finalizar documento');
      console.error('Error finalizing document:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-white flex-1"
            placeholder="Título do documento"
          />
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{wordCount.toLocaleString('pt-BR')} palavras</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showPreview
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {showPreview ? '✏️ Editar' : '👁️ Visualizar'}
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              📥 Exportar
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleFinalize}
              disabled={isProcessing || !content.trim()}
              className="px-6 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? '⏳ Finalizando...' : '✅ Finalizar e Descontar Créditos'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {showPreview ? (
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div
              className="prose prose-lg dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br>') }}
            />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full px-6 py-8 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 resize-none outline-none font-mono text-sm leading-relaxed"
            placeholder="Edite seu documento aqui..."
            spellCheck={false}
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          💡 <strong>Importante:</strong> Os créditos só serão descontados quando você clicar em "Finalizar".
          Você pode editar livremente o documento antes de finalizar.
        </p>
      </div>
    </div>
  );
};
