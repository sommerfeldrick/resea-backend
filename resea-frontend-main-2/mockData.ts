import type { CompletedResearch } from './types';

export const mockHistory: CompletedResearch[] = [
    {
        id: 'hist-1',
        query: 'implantes hexágono externo...',
        taskPlan: {
            taskTitle: 'Revisão de Literatura: Aplicações de Implantes de Hexágono Externo',
            taskDescription: { type: 'Revisão Acadêmica', style: 'Científico', audience: 'Estudantes de Odontologia', wordCount: '5000' },
            executionPlan: { 
                thinking: ["Definir escopo", "Estruturar capítulos"], 
                research: ["Buscar artigos sobre biomecânica", "Pesquisar estudos de caso clínicos"], 
                writing: ["Escrever introdução", "Desenvolver capítulos", "Concluir"] 
            }
        },
        mindMapData: {
            nodes: [
                { id: '1', type: 'input', data: { label: 'Implantes Hexágono Externo' }, position: { x: 250, y: 25 } },
                { id: '2', data: { label: 'Biomecânica' }, position: { x: 100, y: 125 } },
                { id: '3', data: { label: 'Estudos de Caso' }, position: { x: 400, y: 125 } }
            ],
            edges: [
                { id: 'e1-2', source: '1', target: '2', animated: true },
                { id: 'e1-3', source: '1', target: '3', animated: true }
            ],
        },
        researchResults: [
            {
                query: "Buscar artigos sobre biomecânica",
                summary: "A biomecânica dos implantes de hexágono externo é crucial para o sucesso a longo prazo, com foco na distribuição de estresse.",
                sources: [
                    { uri: '#', title: 'Análise Biomecânica de Implantes Dentários', authors: 'Silva, J. et al.', year: 2022, sourceProvider: 'Semantic Scholar' }
                ]
            }
        ],
        outline: '## Esboço\n\n1. Introdução\n2. Biomecânica dos Implantes\n3. Conclusão',
        writtenContent: `# Revisão de Literatura: Aplicações de Implantes de Hexágono Externo\n\n## 1. Introdução\n\nEste documento explora as aplicações... A pesquisa mostra resultados significativos [CITE:FONTE_1] (SILVA et al., 2022).\n\n## Referências\n\nSILVA, J. et al. **Análise Biomecânica de Implantes Dentários**. Disponível em: <#>. Acesso em: 10/10/2024.`
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
