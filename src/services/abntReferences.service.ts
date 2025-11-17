/**
 * ABNT References Service
 *
 * Formats academic references according to ABNT (NBR 6023:2018) standards
 * Generates complete reference lists for academic documents
 */

import { logger } from '../config/logger.js';
import type { FlowEnrichedArticle } from '../types/index.js';

interface FormattedReference {
  id: string;
  formattedText: string;
  authors: string;
  year: number;
  title: string;
  source?: string;
  doi?: string;
}

class ABNTReferencesService {
  /**
   * Format a single article to ABNT reference format
   *
   * ABNT NBR 6023:2018 format:
   * SOBRENOME, Nome. Título do artigo. Nome do Periódico, Local, v. X, n. Y, p. XX-YY, ano. DOI: xxx
   */
  formatReference(article: FlowEnrichedArticle): FormattedReference {
    try {
      // 1. Format authors (SOBRENOME, Nome et al.)
      const authorsFormatted = this.formatAuthors(article.authors);

      // 2. Format title (bold)
      const title = article.title.trim();

      // 3. Extract source/journal info from metadata or source
      const sourceInfo = this.extractSourceInfo(article);

      // 4. Year
      const year = article.year || new Date().getFullYear();

      // 5. DOI
      const doiPart = article.doi ? `. DOI: ${article.doi}` : '';

      // 6. URL fallback se não tiver DOI
      const urlPart =
        !article.doi && article.url
          ? `. Disponível em: ${article.url}`
          : '';

      // Build complete reference
      const formattedText = `${authorsFormatted}. **${title}**. ${sourceInfo}, ${year}${doiPart}${urlPart}`;

      return {
        id: article.id,
        formattedText: formattedText.trim(),
        authors: authorsFormatted,
        year,
        title,
        source: sourceInfo,
        doi: article.doi
      };
    } catch (error: any) {
      logger.warn('Failed to format reference', {
        articleId: article.id,
        error: error.message
      });

      // Fallback simples
      return {
        id: article.id,
        formattedText: `${article.authors.join('; ')}. **${article.title}**. ${article.source}, ${article.year || 'n.d.'}.`,
        authors: article.authors.join('; '),
        year: article.year || 0,
        title: article.title,
        source: article.source
      };
    }
  }

  /**
   * Format authors according to ABNT
   * First author: SOBRENOME, Nome
   * Others: Nome SOBRENOME
   * More than 3: et al.
   */
  private formatAuthors(authors: string[]): string {
    if (!authors || authors.length === 0) {
      return 'AUTOR NÃO ESPECIFICADO';
    }

    // Limitar a 3 autores
    const displayAuthors = authors.slice(0, 3);

    const formatted = displayAuthors.map((author, index) => {
      // Parse author name (assume "FirstName LastName" or "LastName, FirstName")
      const parts = author.includes(',')
        ? author.split(',').map((p) => p.trim())
        : author.trim().split(' ');

      if (parts.length < 2) {
        return author.toUpperCase();
      }

      // First author: LASTNAME, Firstname
      if (index === 0) {
        if (author.includes(',')) {
          // Already in "LastName, FirstName" format
          const [lastName, firstName] = parts;
          return `${lastName.toUpperCase()}, ${firstName}`;
        } else {
          // "FirstName ... LastName" format
          const lastName = parts[parts.length - 1];
          const firstName = parts.slice(0, -1).join(' ');
          return `${lastName.toUpperCase()}, ${firstName}`;
        }
      }

      // Other authors: Firstname LASTNAME
      if (author.includes(',')) {
        const [lastName, firstName] = parts;
        return `${firstName} ${lastName.toUpperCase()}`;
      } else {
        const lastName = parts[parts.length - 1];
        const firstName = parts.slice(0, -1).join(' ');
        return `${firstName} ${lastName.toUpperCase()}`;
      }
    });

    // Add "et al." if more than 3 authors
    if (authors.length > 3) {
      formatted.push('et al');
    }

    return formatted.join('; ');
  }

  /**
   * Extract source information (journal name, volume, pages, etc.)
   */
  private extractSourceInfo(article: FlowEnrichedArticle): string {
    // Try to extract from metadata if available
    const metadata = (article as any).metadata || {};

    // Check for journal information
    const journal = metadata.journal || metadata.container_title || article.source;

    // Volume and issue
    const volume = metadata.volume ? `v. ${metadata.volume}` : '';
    const issue = metadata.issue ? `n. ${metadata.issue}` : '';
    const pages = metadata.pages ? `p. ${metadata.pages}` : '';

    // Build source string
    const parts = [journal, volume, issue, pages].filter(Boolean);

    if (parts.length === 0) {
      return `*${article.source}*`;
    }

    return `*${parts.join(', ')}*`;
  }

  /**
   * Generate complete references list from articles
   * Returns formatted markdown with proper ABNT citation list
   */
  generateReferencesList(
    articles: FlowEnrichedArticle[],
    options?: {
      title?: string;
      sortBy?: 'author' | 'year' | 'citation';
    }
  ): string {
    const { title = 'REFERÊNCIAS', sortBy = 'author' } = options || {};

    if (!articles || articles.length === 0) {
      return `## ${title}\n\nNenhuma referência disponível.`;
    }

    // Format all references
    const references = articles.map((article) =>
      this.formatReference(article)
    );

    // Sort references
    const sorted = this.sortReferences(references, sortBy);

    // Build markdown list
    const referencesList = sorted
      .map((ref, index) => `${index + 1}. ${ref.formattedText}`)
      .join('\n\n');

    return `## ${title}\n\n${referencesList}`;
  }

  /**
   * Sort references according to ABNT rules
   */
  private sortReferences(
    references: FormattedReference[],
    sortBy: 'author' | 'year' | 'citation'
  ): FormattedReference[] {
    return references.sort((a, b) => {
      switch (sortBy) {
        case 'author':
          // ABNT default: alphabetical by first author's last name
          return a.authors.localeCompare(b.authors, 'pt-BR');

        case 'year':
          // Most recent first
          return b.year - a.year;

        case 'citation':
          // This would need citation count from articles
          // For now, fallback to author sort
          return a.authors.localeCompare(b.authors, 'pt-BR');

        default:
          return 0;
      }
    });
  }

  /**
   * Extract cited articles from generated content
   * Looks for [CITE:FONTE_X] patterns
   */
  extractCitedArticles(
    generatedContent: string,
    allArticles: FlowEnrichedArticle[]
  ): FlowEnrichedArticle[] {
    // Find all [CITE:FONTE_X] patterns
    const citationPattern = /\[CITE:FONTE_(\d+)\]/g;
    const matches = generatedContent.matchAll(citationPattern);

    const citedIndices = new Set<number>();
    for (const match of matches) {
      const index = parseInt(match[1], 10) - 1; // FONTE_1 → index 0
      if (index >= 0 && index < allArticles.length) {
        citedIndices.add(index);
      }
    }

    // Return only cited articles
    return Array.from(citedIndices)
      .sort((a, b) => a - b)
      .map((index) => allArticles[index]);
  }

  /**
   * Generate in-text citation in ABNT format
   * Example: (SILVA et al., 2023)
   */
  generateInTextCitation(article: FlowEnrichedArticle): string {
    const firstAuthor = article.authors[0] || 'AUTOR';
    const lastName = firstAuthor.includes(',')
      ? firstAuthor.split(',')[0].trim().toUpperCase()
      : firstAuthor.split(' ').slice(-1)[0].toUpperCase();

    const etAl = article.authors.length > 2 ? ' et al.' : '';
    const year = article.year || 'n.d.';

    return `(${lastName}${etAl}, ${year})`;
  }

  /**
   * Replace [CITE:FONTE_X] with proper ABNT in-text citations
   */
  replaceCitationsWithABNT(
    content: string,
    articles: FlowEnrichedArticle[]
  ): string {
    let result = content;

    // Replace each [CITE:FONTE_X] with ABNT citation
    const citationPattern = /\[CITE:FONTE_(\d+)\]/g;

    result = result.replace(citationPattern, (match, indexStr) => {
      const index = parseInt(indexStr, 10) - 1;

      if (index >= 0 && index < articles.length) {
        const article = articles[index];
        return this.generateInTextCitation(article);
      }

      return match; // Keep original if index invalid
    });

    return result;
  }

  /**
   * Generate complete document with references
   */
  appendReferencesToDocument(
    content: string,
    articles: FlowEnrichedArticle[]
  ): string {
    // 1. Replace citations with ABNT format
    const contentWithCitations = this.replaceCitationsWithABNT(
      content,
      articles
    );

    // 2. Extract only cited articles
    const citedArticles = this.extractCitedArticles(content, articles);

    // 3. Generate references list
    const referencesList = this.generateReferencesList(citedArticles);

    // 4. Append to document
    return `${contentWithCitations}\n\n---\n\n${referencesList}`;
  }
}

export const abntReferencesService = new ABNTReferencesService();
