import spacy from 'spacy';
import { PDFExtract } from 'pdf.js-extract';
import { SentimentAnalyzer } from 'sentiment';
import { TfIdf } from 'natural';

class NLPService {
  private nlpModel: any;
  private sentimentAnalyzer: SentimentAnalyzer;

  constructor() {
    this.nlpModel = spacy.load('pt_core_news_sm'); // Load Portuguese model
    this.sentimentAnalyzer = new SentimentAnalyzer('Portuguese');
  }

  async extractEntities(text: string) {
    const doc = await this.nlpModel(text);
    return doc.ents.map((ent: any) => ({ text: ent.text, label: ent.label }));
  }

  analyzeSentiment(text: string) {
    return this.sentimentAnalyzer.getSentiment(text);
  }

  extractKeywords(text: string): string[] {
    const tfidf = new TfIdf();
    tfidf.addDocument(text);
    return tfidf.listTerms(0).map(term => term.term);
  }

  async summarizeText(text: string): Promise<string> {
    // Implement extractive summarization logic here
    // This could involve ranking sentences based on their importance
    return text; // Placeholder
  }

  async extractSectionsFromPDF(filePath: string): Promise<string[]> {
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extract(filePath);
    return data.pages.map(page => page.content.map(item => item.str).join(" "));
  }
}

export default NLPService;