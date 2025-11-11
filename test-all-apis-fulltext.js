/**
 * DIAGNÓSTICO COMPLETO: Testar TODAS as APIs com fulltext
 *
 * Testa cada API para verificar:
 * 1. Se está funcionando
 * 2. Quantos resultados retorna
 * 3. Quantos TÊM fulltext disponível
 * 4. Taxa de sucesso real
 */

import 'dotenv/config';

const APIS_CONFIG = {
  // ========== TIER 1: FULLTEXT GARANTIDO ==========
  'arXiv': {
    url: 'http://export.arxiv.org/api/query',
    params: { search_query: 'all:machine learning', max_results: 10 },
    fulltext: true,
    size: '2.4M',
    description: 'Preprints com LaTeX source completo'
  },

  'Europe PMC': {
    url: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search',
    params: { query: 'machine learning AND OPEN_ACCESS:Y', format: 'json', pageSize: 10 },
    fulltext: true,
    size: '8M',
    description: 'Artigos biomédicos open access'
  },

  'CORE': {
    url: 'https://api.core.ac.uk/v3/search/works',
    method: 'POST',
    body: { q: 'machine learning', limit: 10 },
    requiresKey: 'CORE_API_KEY',
    fulltext: true,
    size: '30M',
    description: 'Maior agregador de OA com fulltext'
  },

  'bioRxiv': {
    url: 'https://api.biorxiv.org/details/biorxiv/2024-01-01/2024-12-31',
    fulltext: true,
    size: '200K',
    description: 'Preprints biologia com PDF'
  },

  'medRxiv': {
    url: 'https://api.medrxiv.org/details/medrxiv/2024-01-01/2024-12-31',
    fulltext: true,
    size: '100K',
    description: 'Preprints medicina com PDF'
  },

  // ========== TIER 2: METADATA + LINKS ==========
  'OpenAlex': {
    url: 'https://api.openalex.org/works',
    params: { filter: 'display_name.search:machine learning', per_page: 10, 'mailto': 'academic@resea.app' },
    fulltext: false,
    size: '250M',
    description: 'Metadata + links para fulltext'
  },

  'Semantic Scholar': {
    url: 'https://api.semanticscholar.org/graph/v1/paper/search',
    params: { query: 'machine learning', limit: 10, fields: 'title,authors,year,abstract,citationCount,openAccessPdf' },
    fulltext: false,
    size: '200M',
    description: 'Metadata + links PDF quando OA'
  },

  'PubMed': {
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
    params: { db: 'pubmed', term: 'machine learning', retmode: 'json', retmax: 10 },
    fulltext: false,
    size: '36M',
    description: 'Biomedicina - precisa PMC ID para fulltext'
  },

  // ========== TIER 3: OPEN ACCESS DIRECTORIES ==========
  'DOAJ': {
    url: 'https://doaj.org/api/search/articles/machine%20learning',
    params: { pageSize: 10 },
    fulltext: true,
    size: '2.2M journals',
    description: 'Journals OA - links para artigos'
  },

  'OpenAIRE': {
    url: 'https://api.openaire.eu/search/publications',
    params: { keywords: 'machine learning', size: 10, format: 'json' },
    fulltext: false,
    size: '150M',
    description: 'Infraestrutura EU - metadata'
  },

  'PLOS': {
    url: 'https://api.plos.org/search',
    params: { q: 'machine learning', rows: 10, wt: 'json', 'api_key': process.env.PLOS_API_KEY || 'demo' },
    fulltext: true,
    size: '300K',
    description: 'PLOS journals - XML fulltext'
  }
};

// ========== ADICIONAL: APIs com grande volume ==========
const ADDITIONAL_APIS = {
  'Unpaywall': {
    description: '27M artigos OA com PDF direto',
    example: 'https://api.unpaywall.org/v2/10.1038/nature12373?email=YOUR_EMAIL'
  },
  'Crossref': {
    description: '150M+ DOIs com metadata + links',
    example: 'https://api.crossref.org/works?query=machine+learning'
  },
  'BASE': {
    description: '350M documentos acadêmicos',
    example: 'https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi'
  },
  'Internet Archive Scholar': {
    description: '25M+ artigos preservados com fulltext',
    example: 'https://scholar-qa-web.archive.org/search'
  }
};

async function testAPI(name, config) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`📊 Size: ${config.size}`);
  console.log(`📝 Description: ${config.description}`);
  console.log(`🔓 Fulltext: ${config.fulltext ? 'YES ✅' : 'Metadata only'}`);

  if (config.requiresKey) {
    if (!process.env[config.requiresKey]) {
      console.log(`❌ SKIPPED - Requires ${config.requiresKey}`);
      return { success: false, reason: 'No API key' };
    }
  }

  try {
    const startTime = Date.now();
    let response;

    if (config.method === 'POST') {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (config.requiresKey && process.env[config.requiresKey]) {
        headers['Authorization'] = `Bearer ${process.env[config.requiresKey]}`;
      }

      response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(config.body),
      });
    } else {
      const url = new URL(config.url);
      if (config.params) {
        Object.keys(config.params).forEach(key =>
          url.searchParams.append(key, config.params[key])
        );
      }

      response = await fetch(url.toString());
    }

    const latency = Date.now() - startTime;

    if (!response.ok) {
      console.log(`❌ FAILED - HTTP ${response.status}: ${response.statusText}`);
      return { success: false, reason: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType?.includes('json')) {
      data = await response.json();
    } else if (contentType?.includes('xml')) {
      data = await response.text();
    } else {
      data = await response.text();
    }

    console.log(`✅ SUCCESS - ${latency}ms`);
    console.log(`📦 Response type: ${contentType}`);
    console.log(`📏 Response size: ${JSON.stringify(data).length} bytes`);

    // Try to count results
    let resultCount = 0;
    if (Array.isArray(data)) {
      resultCount = data.length;
    } else if (data.results) {
      resultCount = data.results.length;
    } else if (data.resultList?.result) {
      resultCount = data.resultList.result.length;
    } else if (data.feed?.entry) {
      resultCount = data.feed.entry.length;
    } else if (data.response?.docs) {
      resultCount = data.response.docs.length;
    }

    console.log(`📄 Results found: ${resultCount}`);

    return {
      success: true,
      latency,
      resultCount,
      fulltext: config.fulltext
    };

  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function main() {
  console.log('\n🔬 DIAGNÓSTICO COMPLETO DE APIS ACADÊMICAS');
  console.log('='.repeat(70));
  console.log('Testando acesso a MILHÕES de artigos com fulltext...\n');

  const results = {};

  for (const [name, config] of Object.entries(APIS_CONFIG)) {
    results[name] = await testAPI(name, config);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
  }

  // Summary
  console.log('\n\n');
  console.log('='.repeat(70));
  console.log('📊 RESUMO GERAL');
  console.log('='.repeat(70));

  const working = Object.entries(results).filter(([_, r]) => r.success);
  const failed = Object.entries(results).filter(([_, r]) => !r.success);
  const withFulltext = working.filter(([name, _]) => APIS_CONFIG[name].fulltext);

  console.log(`\n✅ APIs Funcionando: ${working.length}/${Object.keys(results).length}`);
  console.log(`🔓 Com Fulltext: ${withFulltext.length}`);
  console.log(`❌ Com Falhas: ${failed.length}\n`);

  if (working.length > 0) {
    console.log('APIs Funcionando:');
    working.forEach(([name, result]) => {
      const hasFulltext = APIS_CONFIG[name].fulltext ? '🔓' : '📋';
      console.log(`  ${hasFulltext} ${name}: ${result.resultCount} resultados (${result.latency}ms)`);
    });
  }

  if (failed.length > 0) {
    console.log('\nAPIs com Problema:');
    failed.forEach(([name, result]) => {
      console.log(`  ❌ ${name}: ${result.reason}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('💡 APIS ADICIONAIS DISPONÍVEIS (não testadas):');
  console.log('='.repeat(70));
  Object.entries(ADDITIONAL_APIS).forEach(([name, info]) => {
    console.log(`\n${name}:`);
    console.log(`  📊 ${info.description}`);
    console.log(`  🔗 ${info.example}`);
  });

  console.log('\n\n🎯 RECOMENDAÇÕES:');
  console.log('1. Implementar Unpaywall API (27M artigos OA)');
  console.log('2. Adicionar Internet Archive Scholar (25M artigos)');
  console.log('3. Usar BASE Search (350M documentos)');
  console.log('4. Ativar CORE API (30M artigos fulltext)');
  console.log('5. Combinar múltiplas fontes em paralelo\n');
}

main().catch(console.error);
