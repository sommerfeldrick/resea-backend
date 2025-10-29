import { MilvusClient, DataType } from '@zilliz/milvus-sdk-node';
import { createHash } from 'crypto';

// Configuration for Milvus connection
const milvusHost = 'localhost'; // Change to your Milvus host
const milvusPort = 19530; // Default port
const collectionName = 'papers';

class VectorSearchService {
    private client: MilvusClient;

    constructor() {
        this.client = new MilvusClient(milvusHost, milvusPort);
    }

    async generateEmbeddings(text: string): Promise<number[]> {
        // Placeholder for an actual embedding generation logic (e.g., using a model)
        const hash = createHash('sha256').update(text).digest('hex');
        return Array.from(hash).map(c => c.charCodeAt(0) / 255);
    }

    async indexPaper(id: string, text: string): Promise<void> {
        const embeddings = await this.generateEmbeddings(text);
        const data = {
            id: id,
            vector: embeddings
        };
        await this.client.insert(collectionName, [data]);
    }

    async search(queryText: string, topK: number): Promise<any[]> {
        const queryEmbeddings = await this.generateEmbeddings(queryText);
        const results = await this.client.search(collectionName, {
            vector: queryEmbeddings,
            topK: topK,
            params: { nprobe: 10 }
        });
        return results;
    }

    async calculateSimilarity(vectorA: number[], vectorB: number[]): Promise<number> {
        // Simple cosine similarity calculation
        const dotProduct = vectorA.reduce((sum, val, index) => sum + val * vectorB[index], 0);
        const normA = Math.sqrt(vectorA.reduce((sum, val) => sum + val * val, 0));
        const normB = Math.sqrt(vectorB.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (normA * normB);
    }
}

export default VectorSearchService;
