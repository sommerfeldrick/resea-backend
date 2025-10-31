# 🚀 Plano de Expansão: 15 Fontes Acadêmicas

## Objetivo
Tornar o Resea o **maior agregador acadêmico do Brasil** com 15 APIs gratuitas cobrindo **500M+ artigos**.

## Fontes Atuais (7)
1. ✅ OpenAlex - 240M trabalhos
2. ✅ Semantic Scholar - 200M artigos
3. ✅ arXiv - 2.4M preprints STEM
4. ✅ CORE - 139M artigos OA
5. ✅ DOAJ - 11M artigos de 21K periódicos
6. ✅ PubMed - 36M artigos biomédicos
7. ✅ Google Scholar - Scraping (backup)

**Total Atual: ~628M artigos únicos**

---

## Novas Fontes a Implementar (8)

### 8. Europe PMC 🆕
- **Cobertura:** 8.1M artigos texto completo + 42M resumos
- **Área:** Ciências da vida, biomedicina
- **URL Base:** `https://www.ebi.ac.uk/europepmc/webservices/rest`
- **Autenticação:** Nenhuma
- **Rate Limit:** ~10 req/s
- **Formato:** JSON/XML
- **Diferencial:** XML JATS estruturado, anotações de entidades (genes, proteínas)

**Endpoint:**
```
GET /search?query={query}&format=json&resultType=core&pageSize=100
```

**Campos importantes:**
- `fullTextUrlList` - URLs para HTML/PDF
- `hasTextMinedTerms` - Entidades extraídas
- `isOpenAccess` - Status OA

---

### 9. PLOS 🆕
- **Cobertura:** 300K artigos 100% OA
- **Área:** Biologia, medicina
- **URL Base:** `https://api.plos.org`
- **Autenticação:** Nenhuma
- **Rate Limit:** 300/hora, 7200/dia
- **Formato:** JSON (Solr)
- **Diferencial:** XML JATS completo, busca texto completo

**Endpoint:**
```
GET /search?q={query}&rows=100&fl=id,title,author,abstract,publication_date
```

**Recursos:**
- Busca em título, abstract, corpo completo
- Métricas de nível de artigo (ALMs)
- 100% disponibilidade texto completo

---

### 10. bioRxiv/medRxiv 🆕
- **Cobertura:** 200K+ preprints ciências da vida
- **Área:** Biologia (bioRxiv), Medicina (medRxiv)
- **URL Base:** `https://api.biorxiv.org`
- **Autenticação:** Nenhuma
- **Rate Limit:** Não especificado
- **Formato:** JSON/XML
- **Diferencial:** Preprints pré-publicação, rastreamento de versões

**Endpoint:**
```
GET /details/biorxiv/2020-01-01/2020-12-31/0/json
```

**Recursos:**
- Múltiplas versões de preprints
- Status de publicação em periódicos
- PDFs disponíveis

---

### 11. Unpaywall 🆕
- **Cobertura:** 46M links OA
- **Área:** Multidisciplinar
- **URL Base:** `https://api.unpaywall.org/v2`
- **Autenticação:** Email obrigatório
- **Rate Limit:** 100K/dia
- **Formato:** JSON
- **Diferencial:** Especializado em encontrar versões OA de DOIs conhecidos

**Endpoint:**
```
GET /{doi}?email=your@email.com
```

**Campos importantes:**
- `is_oa` - Status OA
- `best_oa_location` - Melhor link OA
- `oa_status` - Tipo (gold/green/hybrid/bronze)

---

### 12. OpenAIRE 🆕
- **Cobertura:** 150M produtos de pesquisa
- **Área:** Multidisciplinar (foco Europa)
- **URL Base:** `https://api.openaire.eu/graph`
- **Autenticação:** Nenhuma
- **Rate Limit:** 15 req/s
- **Formato:** JSON/XML
- **Diferencial:** Pesquisa financiada EU, datasets vinculados

**Endpoint:**
```
GET /researchProducts?search={query}&size=100
```

**Recursos:**
- Vinculação publicações-datasets-software
- Informações de financiamento EU
- 60% conteúdo OA

---

### 13. BASE 🆕 (Opcional - requer aprovação)
- **Cobertura:** 300M documentos (60% OA)
- **Área:** Multidisciplinar
- **URL Base:** `https://api.base-search.net`
- **Autenticação:** IP whitelist + aprovação
- **Rate Limit:** Não especificado
- **Formato:** XML (Dublin Core)
- **Diferencial:** Maior agregador de repositórios institucionais

**Nota:** Implementar apenas se conseguirmos aprovação

---

### 14. DataCite 🆕
- **Cobertura:** 45M DOIs de datasets
- **Área:** Datasets de pesquisa
- **URL Base:** `https://api.datacite.org`
- **Autenticação:** Nenhuma
- **Rate Limit:** Não especificado
- **Formato:** JSON
- **Diferencial:** Especializado em dados de pesquisa, não artigos

**Endpoint:**
```
GET /dois?query={query}&page[size]=100
```

**Uso:** Complementar papers com datasets relacionados

---

### 15. OpenCitations 🆕
- **Cobertura:** 1.4B citações
- **Área:** Análise de citações
- **URL Base:** `https://opencitations.net/index/api/v1`
- **Autenticação:** Nenhuma
- **Rate Limit:** Não especificado
- **Formato:** JSON/CSV/RDF
- **Diferencial:** Rede de citações, não texto completo

**Endpoint:**
```
GET /citations/{doi}
```

**Uso:** Enriquecer papers com dados de citação

---

## Prioridades de Implementação

### 🔴 PRIORIDADE ALTA (implementar agora)
1. **Europe PMC** - 8.1M artigos biomédicos com XML estruturado
2. **PLOS** - 300K artigos 100% OA com busca texto completo
3. **bioRxiv/medRxiv** - Preprints importantes para ciências da vida
4. **Unpaywall** - Essencial para encontrar PDFs OA

### 🟡 PRIORIDADE MÉDIA (implementar depois)
5. **OpenAIRE** - Pesquisa EU com datasets vinculados
6. **DataCite** - Datasets complementares

### 🟢 PRIORIDADE BAIXA (opcional)
7. **BASE** - Requer aprovação, CORE já cobre repositórios
8. **OpenCitations** - Apenas citações, não adiciona papers

---

## Arquitetura da Implementação

### Modificações no `academicSearchService.ts`

```typescript
export class AcademicSearchService {
  private usageStats = {
    // Existentes
    openAlex: 0,
    semanticScholar: 0,
    arxiv: 0,
    core: 0,
    doaj: 0,
    pubmed: 0,
    googleScholar: 0,
    crossref: 0,
    // NOVOS
    europePmc: 0,
    plos: 0,
    biorxiv: 0,
    medrxiv: 0,
    unpaywall: 0,
    openaire: 0,
    datacite: 0,
    opencitations: 0
  };

  async searchAll(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    const results = await Promise.allSettled([
      // Existentes
      this.searchOpenAlex(query, options),
      this.searchSemanticScholar(query, options),
      this.searchArxiv(query, options),
      this.searchCORE(query, options),
      this.searchDOAJ(query, options),
      this.searchPubMed(query, options),
      // NOVOS - PRIORIDADE ALTA
      this.searchEuropePMC(query, options),
      this.searchPLOS(query, options),
      this.searchBioRxiv(query, options),
      this.searchMedRxiv(query, options),
      // NOVOS - PRIORIDADE MÉDIA
      this.searchOpenAIRE(query, options),
      // Google Scholar como backup
      this.searchGoogleScholar(query, options)
    ]);

    // ... resto da lógica
  }
}
```

### Unpaywall - Caso Especial

Unpaywall funciona **por DOI**, não por query. Usaremos para enriquecer papers que já temos:

```typescript
async enrichWithUnpaywall(papers: AcademicPaper[]): Promise<AcademicPaper[]> {
  const enriched = await Promise.all(
    papers.map(async (paper) => {
      if (!paper.doi) return paper;

      try {
        const oaInfo = await this.getUnpaywallInfo(paper.doi);
        if (oaInfo.is_oa && oaInfo.best_oa_location) {
          paper.pdfUrl = oaInfo.best_oa_location.url_for_pdf || paper.pdfUrl;
          paper.isOpenAccess = true;
        }
      } catch (error) {
        // Silently fail, paper unchanged
      }

      return paper;
    })
  );

  return enriched;
}
```

---

## Estimativa de Performance

### Tempo de Resposta
- **Atual (7 fontes):** ~5-8 segundos
- **Com 11 fontes:** ~6-10 segundos (Promise.allSettled paralelo)
- **Com Unpaywall enrichment:** +2-3 segundos

### Cobertura Total Estimada
- **Artigos únicos:** ~780M (vs 628M atual)
- **Aumento:** +24% de cobertura
- **Papers por busca:** 50-150 (vs 30-50 atual)

### Rate Limits Combinados
```
OpenAlex: sem limite (polite pool)
Semantic Scholar: 1 req/s
arXiv: 1 req/3s
CORE: 10 req/10s
DOAJ: 2 req/s
PubMed: 10 req/s (com key)
Europe PMC: 10 req/s
PLOS: 300/hora
bioRxiv: não especificado
Unpaywall: 100K/dia
OpenAIRE: 15 req/s
```

**Total teórico:** ~40 req/s agregado

---

## Testes Recomendados

### 1. Teste de Cobertura por Área
```
Query: "machine learning"
Esperado: OpenAlex, Semantic Scholar, arXiv principais

Query: "covid-19"
Esperado: PubMed, Europe PMC, bioRxiv/medRxiv principais

Query: "climate change"
Esperado: OpenAlex, CORE, OpenAIRE principais
```

### 2. Teste de Deduplicação
- Verificar que mesmo paper de múltiplas fontes aparece 1x
- Baseado em DOI > Título normalizado

### 3. Teste de Performance
- Medir tempo de resposta com 11 fontes paralelas
- Verificar timeout handling
- Monitorar memory usage

---

## Próximos Passos

1. ✅ Implementar Europe PMC
2. ✅ Implementar PLOS
3. ✅ Implementar bioRxiv/medRxiv
4. ✅ Implementar Unpaywall enrichment
5. ✅ Testar build
6. ✅ Commit e push
7. 🔄 Monitorar logs de produção
8. 📊 Analisar métricas de uso por fonte

---

## Variáveis de Ambiente Necessárias

```bash
# Já existem
SEMANTIC_SCHOLAR_KEY=optional
CORE_API_KEY=optional
PUBMED_API_KEY=recommended

# Nenhuma nova necessária! Todas as novas APIs são gratuitas sem key
```

---

**Status:** 📋 Planejamento completo
**Próximo:** 🚀 Implementação das 4 fontes prioritárias
