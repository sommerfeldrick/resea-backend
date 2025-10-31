# 📄 Extração de Texto Completo - Resea AI

## 🎯 Visão Geral

Sistema de extração de texto completo de artigos acadêmicos usando **GROBID** como motor principal, com fallback para **pdf-parse** quando GROBID não estiver disponível.

### ✨ Características

- ✅ **Extração completa**: Seções, figuras, tabelas, equações, referências
- ✅ **Multi-estratégia**: GROBID (primário) → pdf-parse (fallback)
- ✅ **Open Access**: Integração com Unpaywall API
- ✅ **Processamento em lote**: Múltiplos papers com controle de concorrência
- ✅ **Suporte a múltiplas fontes**: arXiv, Semantic Scholar, CORE, etc

---

## 🚀 Quick Start

### 1. Iniciar GROBID e Redis

```bash
# Subir containers
docker-compose up -d

# Verificar status
docker-compose ps

# Verificar logs do GROBID
docker logs grobid-service
```

**Aguarde ~60 segundos** para o GROBID inicializar completamente.

### 2. Configurar Variáveis de Ambiente

Adicione ao `.env`:

```env
# GROBID Service
GROBID_URL=http://localhost:8070

# Unpaywall API (para descobrir PDFs Open Access)
UNPAYWALL_EMAIL=seu-email@exemplo.com
```

### 3. Testar o Serviço

```bash
# Verificar saúde do serviço
curl http://localhost:3000/api/fulltext/health

# Exemplo de resposta:
# {
#   "status": "healthy",
#   "grobid": {
#     "url": "http://localhost:8070",
#     "available": true,
#     "message": "GROBID is alive"
#   }
# }
```

---

## 📡 API Endpoints

### 1. Extrair Texto de Um Paper

**POST** `/api/fulltext/extract`

```bash
curl -X POST http://localhost:3000/api/fulltext/extract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "paper": {
      "title": "Attention Is All You Need",
      "doi": "10.48550/arXiv.1706.03762",
      "url": "https://arxiv.org/abs/1706.03762",
      "source": "arxiv",
      "authors": ["Vaswani", "Shazeer"],
      "year": 2017,
      "abstract": "The dominant sequence transduction models..."
    },
    "config": {
      "method": "auto",
      "enableOCR": false,
      "enableNLP": false,
      "generateEmbeddings": false
    }
  }'
```

**Resposta de Sucesso:**

```json
{
  "success": true,
  "paper": {
    "id": "...",
    "title": "Attention Is All You Need",
    "authors": ["Vaswani", "Shazeer"],
    "fullText": {
      "sections": [
        {
          "title": "Abstract",
          "content": "The dominant sequence transduction models...",
          "level": 1
        },
        {
          "title": "1. Introduction",
          "content": "Recurrent neural networks...",
          "level": 1
        }
      ],
      "rawText": "Abstract\nThe dominant sequence transduction...",
      "figures": [],
      "tables": [],
      "references": []
    },
    "extraction": {
      "extractedAt": "2024-10-31T12:00:00.000Z",
      "extractionMethod": "grobid",
      "pdfUrl": "https://arxiv.org/pdf/1706.03762.pdf",
      "pageCount": 15,
      "confidence": 0.9
    }
  },
  "metadata": {
    "extractedAt": "2024-10-31T12:00:00.000Z",
    "extractionMethod": "grobid",
    "confidence": 0.9
  }
}
```

### 2. Extrair Texto em Lote

**POST** `/api/fulltext/extract-batch`

```bash
curl -X POST http://localhost:3000/api/fulltext/extract-batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "papers": [
      {
        "title": "Paper 1",
        "url": "https://arxiv.org/abs/1706.03762",
        "source": "arxiv"
      },
      {
        "title": "Paper 2",
        "doi": "10.1234/example",
        "source": "semantic-scholar"
      }
    ],
    "config": {
      "method": "auto"
    },
    "concurrency": 3
  }'
```

**Resposta:**

```json
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "success": true,
      "paper": { ... },
      "metadata": { ... }
    },
    {
      "success": true,
      "paper": { ... },
      "metadata": { ... }
    }
  ]
}
```

### 3. Verificar Status do Serviço

**GET** `/api/fulltext/health`

```bash
curl http://localhost:3000/api/fulltext/health
```

---

## 🔧 Configuração Avançada

### Opções de Extração

```typescript
interface ExtractionConfig {
  method: 'grobid' | 'pdf-parse' | 'auto'; // 'auto' tenta GROBID primeiro
  enableOCR: boolean;                       // OCR para figuras (futuro)
  enableNLP: boolean;                       // Enriquecimento NLP (futuro)
  generateEmbeddings: boolean;              // Gerar embeddings (futuro)
  maxPdfSize?: number;                      // Tamanho máximo em bytes
  timeout?: number;                         // Timeout em ms
}
```

### Estratégias de Extração

1. **GROBID** (Primária - Confiança: 90%)
   - Melhor qualidade estrutural
   - Extrai seções, referências, figuras
   - Requer serviço Docker rodando

2. **pdf-parse** (Fallback - Confiança: 70%)
   - Extração mais simples
   - Funciona sem dependências externas
   - Usa heurísticas para identificar seções

3. **OCR** (Futuro)
   - Para papers escaneados
   - Usando Tesseract

### Fontes de PDF Suportadas

1. **URL Direta**: Se `paper.url` termina em `.pdf`
2. **arXiv**: Converte automaticamente para `https://arxiv.org/pdf/{id}.pdf`
3. **Unpaywall**: Busca versões Open Access via DOI
4. **Semantic Scholar**: Usa API para encontrar PDF

---

## 📊 Estrutura de Dados

### FullPaper Interface

```typescript
interface FullPaper {
  // Metadados básicos
  id: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  url: string;
  doi?: string;
  source: string;
  
  // Conteúdo completo extraído
  fullText?: {
    sections: PaperSection[];
    figures?: PaperFigure[];
    tables?: PaperTable[];
    equations?: PaperEquation[];
    references?: PaperReference[];
    rawText?: string;
  };
  
  // Metadados da extração
  extraction?: {
    extractedAt: Date;
    extractionMethod: 'grobid' | 'pdf-parse' | 'ocr' | 'hybrid';
    pdfUrl?: string;
    pageCount?: number;
    confidence?: number; // 0-1
  };
}
```

---

## 🐛 Troubleshooting

### GROBID não está respondendo

```bash
# Verificar se container está rodando
docker ps | grep grobid

# Reiniciar GROBID
docker-compose restart grobid

# Ver logs
docker logs grobid-service --tail 100

# Testar manualmente
curl http://localhost:8070/api/isalive
```

### PDF não encontrado

- Verifique se o paper tem DOI ou URL válida
- Configure `UNPAYWALL_EMAIL` para melhorar descoberta de PDFs
- Alguns papers podem não ter versão Open Access disponível

### Extração falhou

- Sistema usa fallback automático: GROBID → pdf-parse
- Verifique logs do servidor para detalhes
- PDFs muito grandes (>50MB) são rejeitados por padrão

### Performance

```bash
# Monitorar uso de memória do GROBID
docker stats grobid-service

# Ajustar memória se necessário
# Edite docker-compose.yml:
environment:
  - GROBID_OPTS=-Xmx8G  # Aumenta para 8GB
```

---

## 🔜 Próximos Passos

### Fase 1 (Implementado) ✅
- [x] Extração com GROBID
- [x] Fallback pdf-parse
- [x] Descoberta de PDF (Unpaywall, arXiv, Semantic Scholar)
- [x] Processamento em lote
- [x] Health check endpoint

### Fase 2 (Próximo)
- [ ] Cache Redis para resultados
- [ ] Enriquecimento NLP (entidades, keywords)
- [ ] Geração de embeddings
- [ ] OCR para figuras

### Fase 3 (Futuro)
- [ ] Busca híbrida (Vector + BM25)
- [ ] Reranker com cross-encoder
- [ ] Circuit breakers
- [ ] Métricas Prometheus

---

## 📚 Recursos

- **GROBID Docs**: https://grobid.readthedocs.io/
- **Unpaywall API**: https://unpaywall.org/products/api
- **pdf-parse**: https://www.npmjs.com/package/pdf-parse

---

## 🤝 Contribuindo

Se encontrar problemas ou tiver sugestões:

1. Abra uma issue no repositório
2. Descreva o problema com exemplos
3. Inclua logs relevantes

---

**Desenvolvido com ❤️ para pesquisadores acadêmicos**
