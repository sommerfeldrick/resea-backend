/**
 * LaTeX Source Parser (arXiv)
 * Parses LaTeX source files from arXiv
 */

import { BaseParser } from './base.parser';
import type { ParserOutput, ContentSection } from '../../types/content.types';
import * as tar from 'tar';
import * as zlib from 'zlib';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

const gunzip = promisify(zlib.gunzip);

export class LaTeXParser extends BaseParser {
  async parse(content: Buffer | string): Promise<ParserOutput> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    // Extract .tar.gz
    const extracted = await this.extractTarGz(buffer);

    // Find main .tex file
    const mainTexFile = this.findMainTexFile(extracted.files);

    if (!mainTexFile) {
      throw new Error('No main .tex file found');
    }

    const texContent = mainTexFile.content;

    return {
      metadata: this.extractMetadata(texContent),
      fullContent: {
        abstract: this.extractAbstract(texContent),
        sections: this.extractSections(texContent),
        references: [],
      },
      format: 'latex-source',
      quality: 8,
      extractionDate: new Date(),
    };
  }

  /**
   * Extract tar.gz
   */
  private async extractTarGz(buffer: Buffer): Promise<{
    files: Array<{ name: string; content: string }>;
    figures: string[];
  }> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'latex-'));

    try {
      // Decompress
      const decompressed = await gunzip(buffer);

      // Write decompressed to temp file
      const tarPath = path.join(tempDir, 'archive.tar');
      await fs.writeFile(tarPath, decompressed);

      // Extract tar
      await tar.extract({
        cwd: tempDir,
        file: tarPath,
      });

      // Read files
      const files: Array<{ name: string; content: string }> = [];
      const figures: string[] = [];

      const readDir = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await readDir(fullPath);
          } else if (entry.isFile()) {
            if (entry.name.endsWith('.tex')) {
              const content = await fs.readFile(fullPath, 'utf-8');
              files.push({ name: entry.name, content });
            } else if (/\.(png|jpg|jpeg|pdf|eps)$/i.test(entry.name)) {
              figures.push(entry.name);
            }
          }
        }
      };

      await readDir(tempDir);

      return { files, figures };
    } finally {
      // Clean temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Find main .tex file
   */
  private findMainTexFile(
    files: Array<{ name: string; content: string }>
  ): { name: string; content: string } | null {
    // Look for \documentclass (indicates main file)
    for (const file of files) {
      if (file.content.includes('\\documentclass')) {
        return file;
      }
    }

    // Fallback: longest .tex file
    return files.sort((a, b) => b.content.length - a.content.length)[0] || null;
  }

  /**
   * Extract metadata
   */
  private extractMetadata(tex: string): any {
    return {
      titulo: this.extractCommand(tex, 'title'),
      autores: this.extractAuthors(tex),
      ano: new Date().getFullYear(), // arXiv = recent
      keywords: this.extractCommand(tex, 'keywords')
        ?.split(',')
        .map(k => k.trim()),
    };
  }

  /**
   * Extract abstract
   */
  private extractAbstract(tex: string): ContentSection | undefined {
    const abstractText = this.extractEnvironment(tex, 'abstract');

    if (!abstractText) return undefined;

    const cleaned = this.stripLatexCommands(abstractText);

    return {
      text: this.cleanText(cleaned),
      wordCount: this.countWords(cleaned),
    };
  }

  /**
   * Extract sections
   */
  private extractSections(tex: string): ContentSection[] {
    const sections: ContentSection[] = [];

    // Regex for \section, \subsection, etc.
    const sectionRegex =
      /\\(sub)*(section|chapter)\{([^}]+)\}([\s\S]*?)(?=\\(sub)*(section|chapter)|\\bibliography|\\end\{document\}|$)/g;

    let match;
    while ((match = sectionRegex.exec(tex)) !== null) {
      const level = match[1] ? 'subsection' : 'section';
      const heading = match[3];
      const rawContent = match[4];

      const content = this.stripLatexCommands(rawContent);

      if (content.trim().length > 100) {
        sections.push({
          heading: heading.trim(),
          text: this.cleanText(content),
          wordCount: this.countWords(content),
        });
      }
    }

    return sections;
  }

  /**
   * Extract LaTeX command
   */
  private extractCommand(tex: string, command: string): string {
    const regex = new RegExp(`\\\\${command}\\{([^}]+)\\}`, 'i');
    const match = tex.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Extract LaTeX environment
   */
  private extractEnvironment(tex: string, env: string): string {
    const regex = new RegExp(
      `\\\\begin\\{${env}\\}([\\s\\S]*?)\\\\end\\{${env}\\}`,
      'i'
    );
    const match = tex.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Extract authors
   */
  private extractAuthors(tex: string): string[] {
    const authorText = this.extractCommand(tex, 'author');

    if (!authorText) return [];

    // Separate by \and or ,
    return authorText
      .split(/\\and|,/)
      .map(a => this.stripLatexCommands(a).trim())
      .filter(a => a.length > 0);
  }

  /**
   * Remove LaTeX commands
   */
  private stripLatexCommands(text: string): string {
    return (
      text
        // Remove comments
        .replace(/%.*$/gm, '')
        // Remove \command{...}
        .replace(/\\[a-zA-Z]+\*?\{([^}]*)\}/g, '$1')
        // Remove \command
        .replace(/\\[a-zA-Z]+\*?/g, '')
        // Replace math delimiters
        .replace(/\$\$?([^\$]+)\$\$?/g, '[EQUATION]')
        // Remove environments
        .replace(/\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, '')
        // Remove special characters
        .replace(/[{}~^_]/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
}
