import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { TaskPlan, MindMapData, ResearchResult, CompletedResearch, AcademicSource } from '../types';
import { generateMindMap, performResearchStep, generateOutline, generateContentStream } from '../services/apiService';
import ReactFlow, * as Reactflow from 'reactflow';

// Função simples para renderizar markdown básico com sanitização
const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const renderMarkdown = (text: string): string => {
  if (!text) return '';
  
  // Processar linha por linha para headers corretos
  const lines = text.split('\n');
  const processedLines = lines.map(line => {
    // Headers devem estar no início da linha
    if (line.startsWith('### ')) {
      return `<h3>${escapeHtml(line.substring(4))}</h3>`;
    } else if (line.startsWith('## ')) {
      return `<h2>${escapeHtml(line.substring(3))}</h2>`;
    } else if (line.startsWith('# ')) {
      return `<h1>${escapeHtml(line.substring(2))}</h1>`;
    }
    // Processar negrito e itálico com escape
    return escapeHtml(line)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  });
  
  return processedLines.join('<br />');
};

type ResearchPageProps = {
  initialData?: CompletedResearch;
  taskPlan?: TaskPlan;
  query?: string;
  onResearchComplete?: (data: Omit<CompletedResearch, 'id' | 'query'>) => void;
};

type ResearchPhase = 'thinking' | 'research' | 'outlining' | 'writing' | 'done';
type ActiveTab = 'document' | 'outline' | 'research' | 'mindmap';


const CitationPopup: React.FC<{ text: string, source: AcademicSource }> = ({ text, source }) => {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<number | null>(null);

    const handleMouseEnter = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(true);
    };

    const handleMouseLeave = () => {
        timerRef.current = window.setTimeout(() => {
            setVisible(false);
        }, 200); // Delay allows moving mouse into popup
    };

    return (
        <span 
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <span className="text-indigo-600 font-semibold cursor-pointer hover:underline">
                ({text})
            </span>
            {visible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10">
                    <p className="font-bold truncate">{source.title}</p>
                    {source.authors && <p className="mt-1"><strong>Autores:</strong> {source.authors}</p>}
                    {source.year && <p><strong>Ano:</strong> {source.year}</p>}
                    <p><strong>Fonte:</strong> {source.sourceProvider}</p>
                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mt-2 block">Ver fonte</a>
                </div>
            )}
        </span>
    );
};

// Component to parse and render content with citations
const ParsedContent: React.FC<{ content: string, sources: AcademicSource[] }> = React.memo(({ content, sources }) => {
    const parts = useMemo(() => {
        if (!content) return [];
        
        const citationRegex = /\[CITE:FONTE_(\d+)\]\s*\(([^)]+)\)/g;
        const resultParts = [];
        let lastIndex = 0;
        let match;

        while ((match = citationRegex.exec(content)) !== null) {
            // Text before citation
            if (match.index > lastIndex) {
                resultParts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
            }

            // Citation
            const sourceIndex = parseInt(match[1], 10) - 1;
            const citationText = match[2];
            const source = sources[sourceIndex];
            resultParts.push({ type: 'citation', source, text: citationText });
            
            lastIndex = citationRegex.lastIndex;
        }

        // Remaining text
        if (lastIndex < content.length) {
            resultParts.push({ type: 'text', content: content.substring(lastIndex) });
        }

        return resultParts;
    }, [content, sources]);

    return (
        <>
            {parts.map((part, index) => {
                if (part.type === 'citation' && part.source) {
                    return <CitationPopup key={index} text={part.text} source={part.source} />;
                }
                if (part.type === 'text') {
                    return <span key={index} dangerouslySetInnerHTML={{ __html: renderMarkdown(part.content) }} />;
                }
                // Fallback for invalid citation
                return <span key={index}>({part.text || 'citação inválida'})</span>;
            })}
        </>
    );
});


const StatusIndicator: React.FC<{ message: string; isDone: boolean }> = ({ message, isDone }) => (
    <div className={`flex items-center gap-2 text-sm mb-4 ${isDone ? 'text-green-600' : 'text-gray-500'}`}>
        {isDone ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        ) : (
            <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        )}
        <span>{message}</span>
    </div>
);

const TabButton: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>
        {label}
    </button>
);

export const ResearchPage: React.FC<ResearchPageProps> = ({ initialData, taskPlan, query, onResearchComplete }) => {
    const [currentPhase, setCurrentPhase] = useState<ResearchPhase>('thinking');
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [activeTab, setActiveTab] = useState<ActiveTab>('mindmap');
    
    const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
    const [researchResults, setResearchResults] = useState<ResearchResult[]>([]);
    const [outline, setOutline] = useState('');
    const [writtenContent, setWrittenContent] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const contentEndRef = useRef<HTMLDivElement>(null);
    const mainContentRef = useRef<HTMLElement>(null);
    const pageTaskPlan = initialData?.taskPlan || taskPlan;

    useEffect(() => {
        const runProcess = async () => {
            if (!pageTaskPlan || !onResearchComplete || !query) return; // Don't run if loading from history or no callback/query

            // Phase 1: Thinking & Mind Map
            setCurrentPhase('thinking');
            const mapData = await generateMindMap(pageTaskPlan);
            setMindMapData(mapData);
            setActiveTab('mindmap');

            // Phase 2: Research
            setCurrentPhase('research');
            setActiveTab('research');
            const results: ResearchResult[] = [];
            for (const [index, step] of pageTaskPlan.executionPlan.research.entries()) {
                setCurrentStepIndex(index);
                const result = await performResearchStep(step, query);
                const newResult = { query: step, ...result };
                results.push(newResult);
                setResearchResults(prev => [...prev, newResult]);
            }
            setResearchResults(results);
            
            // Phase 3: Outlining
            setCurrentPhase('outlining');
            setActiveTab('outline');
            const generatedOutline = await generateOutline(pageTaskPlan, results);
            setOutline(generatedOutline);

            // Phase 4: Writing
            setCurrentPhase('writing');
            setActiveTab('document');
            const stream = generateContentStream(pageTaskPlan, results);
            let content = '';
            for await (const chunk of stream) {
                content += chunk;
                setWrittenContent(content);
            }
            
            setCurrentPhase('done');
            onResearchComplete({ taskPlan: pageTaskPlan, mindMapData: mapData, researchResults: results, outline: generatedOutline, writtenContent: content });
        };

        if (initialData) {
            setMindMapData(initialData.mindMapData);
            setResearchResults(initialData.researchResults);
            setOutline(initialData.outline);
            setWrittenContent(initialData.writtenContent);
            setCurrentPhase('done');
            setActiveTab('document');
        } else {
            runProcess();
        }
    }, [initialData, pageTaskPlan, query, onResearchComplete]);
    
    useEffect(() => {
        const mainEl = mainContentRef.current;
        if (activeTab === 'document' && mainEl) {
          const isScrolledToBottom = mainEl.scrollHeight - mainEl.scrollTop <= mainEl.clientHeight + 150;
          if (isScrolledToBottom) {
            contentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        }
    }, [writtenContent, activeTab]);

    const getStatusMessage = () => {
        if (!pageTaskPlan) return "Carregando...";
        switch (currentPhase) {
            case 'thinking': return 'Raciocínio... Gerando mapa mental.';
            case 'research': return `Pesquisando artigos... Passo ${currentStepIndex + 1}/${pageTaskPlan.executionPlan.research.length}`;
            case 'outlining': return 'Estruturando... Criando o esboço do documento.';
            case 'writing': return 'Escrevendo... Compilando o documento final.';
            case 'done': return initialData ? 'Pesquisa carregada do histórico.' : 'Processo concluído!';
            default: return '';
        }
    };
    
    const handleShare = () => {
        if (!pageTaskPlan) return;
        setIsSharing(true);
        navigator.clipboard.writeText(`Confira esta pesquisa sobre "${pageTaskPlan.taskTitle}" gerada pelo Resea.AI!`);
        setTimeout(() => setIsSharing(false), 2000);
    };

  const renderActiveTabContent = () => {
    switch (activeTab) {
        case 'document':
            return writtenContent ? (
                <div className="mt-6 prose prose-indigo max-w-none p-6 border rounded-lg bg-white">
                    <ParsedContent content={writtenContent} sources={researchResults.flatMap(r => r.sources)} />
                </div>
            ) : <div className="mt-6 text-center text-gray-500">O documento final aparecerá aqui...</div>;
        case 'outline':
            return outline ? (
                 <div className="mt-6 prose prose-indigo max-w-none p-6 border rounded-lg bg-white" dangerouslySetInnerHTML={{ __html: renderMarkdown(outline) }} />
            ) : <div className="mt-6 text-center text-gray-500">O esboço do documento aparecerá aqui...</div>;
        case 'research':
            return researchResults.length > 0 ? (
                <div className="mt-6 space-y-4">
                     {researchResults.map((result, i) => (
                         <div key={i} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                             <h3 className="font-semibold text-indigo-700">{result.query}</h3>
                             <div className="text-sm text-gray-700 mt-2 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(result.summary) }}/>
                             <div className="mt-3 space-y-2">
                                 {result.sources.map((source, j) => (
                                     <div key={j} className="text-xs p-2 border-l-2 border-indigo-200 bg-white rounded-r-md">
                                         <a href={source.uri} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline block truncate">{source.title}</a>
                                         <div className="text-gray-500 mt-1 space-y-0.5">
                                            {source.authors && <p><strong>Autores:</strong> {source.authors}</p>}
                                            {source.year && <p><strong>Ano:</strong> {source.year}</p>}
                                            <p><strong>Fonte:</strong> {source.sourceProvider}</p>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     ))}
                </div>
            ) : <div className="mt-6 text-center text-gray-500">Os resultados da pesquisa aparecerão aqui...</div>;
        case 'mindmap':
            return mindMapData ? (
                 <div className="mt-6 h-[500px] w-full border rounded-lg bg-white">
                    <Reactflow.ReactFlowProvider>
                        <ReactFlow nodes={mindMapData.nodes} edges={mindMapData.edges} fitView>
                            <Reactflow.Controls showInteractive={false} />
                            <Reactflow.MiniMap />
                            <Reactflow.Background />
                        </ReactFlow>
                    </Reactflow.ReactFlowProvider>
                </div>
            ) : <div className="mt-6 text-center text-gray-500">O mapa mental aparecerá aqui...</div>;
        default: return null;
    }
  }
  
  if (!pageTaskPlan && !initialData) {
      return <div className="flex-1 flex items-center justify-center">Carregando plano de pesquisa...</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center flex-shrink-0">
        <h1 className="text-sm font-medium text-gray-700 truncate pr-4">{pageTaskPlan?.taskTitle}</h1>
        <div>
          <button 
            disabled
            title="Funcionalidade em breve"
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
          >
            Atualizar
          </button>
          <button 
            onClick={handleShare}
            className="ml-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-28"
          >
            {isSharing ? 'Copiado!' : 'Compartilhar'}
          </button>
        </div>
      </header>

      <main ref={mainContentRef} className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
            <StatusIndicator message={getStatusMessage()} isDone={currentPhase === 'done'}/>
            
            <div className="border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <TabButton label="Mapa Mental" isActive={activeTab === 'mindmap'} onClick={() => setActiveTab('mindmap')} />
                    <TabButton label="Pesquisa" isActive={activeTab === 'research'} onClick={() => setActiveTab('research')} />
                    <TabButton label="Esboço" isActive={activeTab === 'outline'} onClick={() => setActiveTab('outline')} />
                    <TabButton label="Documento Final" isActive={activeTab === 'document'} onClick={() => setActiveTab('document')} />
                </div>
            </div>

            {renderActiveTabContent()}

            <div ref={contentEndRef} />
        </div>
      </main>
    </div>
  );
};