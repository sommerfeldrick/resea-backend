/**
 * Filtro de relevância para papers acadêmicos
 * Garante que apenas papers relevantes ao tema sejam usados
 */

interface AcademicPaper {
  title: string;
  abstract?: string;
  authors: string[];
  year?: number;
}

/**
 * Calcula score de relevância entre query e paper (0-1)
 */
export function calculateRelevanceScore(query: string, paper: AcademicPaper): number {
  const queryTerms = extractKeyTerms(query);
  const paperText = `${paper.title} ${paper.abstract || ''}`.toLowerCase();

  let score = 0;
  let matchedTerms = 0;

  for (const term of queryTerms) {
    if (paperText.includes(term.toLowerCase())) {
      matchedTerms++;

      // Peso maior se termo aparece no título
      if (paper.title.toLowerCase().includes(term.toLowerCase())) {
        score += 2;
      } else {
        score += 1;
      }
    }
  }

  // Normaliza score (0-1)
  const maxScore = queryTerms.length * 2;
  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Extrai termos-chave relevantes da query
 */
function extractKeyTerms(query: string): string[] {
  // Remove stopwords comuns em português e inglês
  const stopwords = new Set([
    'a', 'o', 'e', 'de', 'da', 'do', 'em', 'na', 'no', 'para', 'com',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'
  ]);

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopwords.has(term));
}

/**
 * Filtra papers por relevância mínima
 */
export function filterRelevantPapers<T extends AcademicPaper>(
  papers: T[],
  query: string,
  minScore: number = 0.3
): T[] {
  return papers
    .map(paper => ({
      paper,
      score: calculateRelevanceScore(query, paper)
    }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map(({ paper }) => paper);
}

/**
 * Verifica se um paper é relevante para a query
 */
export function isRelevant(query: string, paper: AcademicPaper, minScore: number = 0.3): boolean {
  return calculateRelevanceScore(query, paper) >= minScore;
}
