/**
 * Export Service - Export research documents to various formats
 */

import type { CompletedResearch } from '../types';

/**
 * Convert Markdown to plain text (remove formatting)
 */
function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
    .replace(/`(.+?)`/g, '$1') // Remove code
    .replace(/^\s*[-*+]\s/gm, '• ') // Convert lists
    .trim();
}

/**
 * Export research as Markdown file
 */
export function exportAsMarkdown(research: CompletedResearch): void {
  const content = `# ${research.taskPlan.taskTitle}

**Query:** ${research.query}

---

## 📋 Plano de Execução

### Descrição da Tarefa
- **Tipo:** ${research.taskPlan.taskDescription.type}
- **Estilo:** ${research.taskPlan.taskDescription.style}
- **Público:** ${research.taskPlan.taskDescription.audience}
- **Palavras:** ${research.taskPlan.taskDescription.wordCount}

### Fases
**Pensamento:**
${research.taskPlan.executionPlan.thinking.map((t, i) => `${i + 1}. ${t}`).join('\n')}

**Pesquisa:**
${research.taskPlan.executionPlan.research.map((r, i) => `${i + 1}. ${r}`).join('\n')}

**Redação:**
${research.taskPlan.executionPlan.writing.map((w, i) => `${i + 1}. ${w}`).join('\n')}

---

## 🔬 Resultados da Pesquisa

${research.researchResults
  .map(
    (result) => `### ${result.query}

${result.summary}

**Fontes:**
${result.sources
  .map(
    (source, i) =>
      `${i + 1}. **${source.title}**
   - Autores: ${source.authors || 'N/A'}
   - Ano: ${source.year || 'N/A'}
   - ${source.citationCount ? `Citações: ${source.citationCount}` : ''}
   - Link: ${source.uri}`
  )
  .join('\n\n')}`
  )
  .join('\n\n---\n\n')}

---

## 📝 Esboço

${research.outline}

---

## 📄 Documento Final

${research.writtenContent}

---

*Gerado por Resea AI Research Assistant em ${new Date().toLocaleDateString('pt-BR')}*
`;

  downloadFile(content, `${slugify(research.taskPlan.taskTitle)}.md`, 'text/markdown');
}

/**
 * Export research as plain text
 */
export function exportAsText(research: CompletedResearch): void {
  const content = markdownToPlainText(`# ${research.taskPlan.taskTitle}

Query: ${research.query}

${research.writtenContent}
`);

  downloadFile(content, `${slugify(research.taskPlan.taskTitle)}.txt`, 'text/plain');
}

/**
 * Export research as JSON
 */
export function exportAsJSON(research: CompletedResearch): void {
  const content = JSON.stringify(research, null, 2);
  downloadFile(
    content,
    `${slugify(research.taskPlan.taskTitle)}.json`,
    'application/json'
  );
}

/**
 * Export research as HTML
 */
export function exportAsHTML(research: CompletedResearch): void {
  const htmlContent = markdownToHTML(research.writtenContent);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${research.taskPlan.taskTitle}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 24px; text-align: center; margin-bottom: 40px; }
    h2 { font-size: 20px; margin-top: 30px; }
    h3 { font-size: 18px; margin-top: 20px; }
    p { text-align: justify; margin-bottom: 15px; }
    .metadata {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
    }
    .metadata strong { color: #666; }
    .citation { color: #0066cc; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="metadata">
    <strong>Tipo:</strong> ${research.taskPlan.taskDescription.type}<br>
    <strong>Estilo:</strong> ${research.taskPlan.taskDescription.style}<br>
    <strong>Público:</strong> ${research.taskPlan.taskDescription.audience}<br>
    <strong>Gerado em:</strong> ${new Date().toLocaleDateString('pt-BR')}
  </div>

  ${htmlContent}

  <hr>
  <footer style="margin-top: 40px; text-align: center; font-size: 0.9em; color: #666;">
    <p>Gerado por Resea AI Research Assistant</p>
  </footer>
</body>
</html>`;

  downloadFile(html, `${slugify(research.taskPlan.taskTitle)}.html`, 'text/html');
}

/**
 * Basic Markdown to HTML converter
 */
function markdownToHTML(markdown: string): string {
  return markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[CITE:(\w+)\]\s*\((.+?)\)/g, '<span class="citation">[$2]</span>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/<p><h/g, '<h')
    .replace(/<\/h(\d)><\/p>/g, '</h$1>');
}

/**
 * Export only references section
 */
export function exportReferences(research: CompletedResearch): void {
  // Extract references section from written content
  const referencesMatch = research.writtenContent.match(
    /##\s*Referências([\s\S]+)/i
  );

  const references = referencesMatch
    ? referencesMatch[1].trim()
    : 'Nenhuma referência encontrada.';

  const content = `# Referências - ${research.taskPlan.taskTitle}

${references}

---

*Total de fontes: ${research.researchResults.reduce((acc, r) => acc + r.sources.length, 0)}*
*Gerado em: ${new Date().toLocaleDateString('pt-BR')}*
`;

  downloadFile(
    content,
    `referencias_${slugify(research.taskPlan.taskTitle)}.md`,
    'text/markdown'
  );
}

/**
 * Copy document to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    console.log('✅ Copied to clipboard');
  } catch (error) {
    console.error('❌ Failed to copy to clipboard', error);
    // Fallback method
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Download file helper
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('✅ File downloaded', { filename });
}

/**
 * Convert string to URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

/**
 * Print document
 */
export function printDocument(research: CompletedResearch): void {
  const htmlContent = markdownToHTML(research.writtenContent);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para imprimir o documento.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${research.taskPlan.taskTitle}</title>
      <style>
        @page { margin: 2cm; }
        body {
          font-family: 'Times New Roman', serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000;
        }
        h1 { font-size: 18pt; text-align: center; page-break-after: avoid; }
        h2 { font-size: 14pt; page-break-after: avoid; }
        h3 { font-size: 12pt; page-break-after: avoid; }
        p { text-align: justify; }
        .citation { font-size: 10pt; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

/**
 * Get export options
 */
export const exportOptions = [
  { label: 'Markdown (.md)', action: exportAsMarkdown },
  { label: 'HTML (.html)', action: exportAsHTML },
  { label: 'Texto (.txt)', action: exportAsText },
  { label: 'JSON (.json)', action: exportAsJSON },
  { label: 'Apenas Referências', action: exportReferences }
];
