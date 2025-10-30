import { RedisClient } from 'redis';
import { EmbeddingService } from './embeddingService'; // Hypothetical service for embeddings

class SmartCache {
    private localCache: Map<string, any>;
    private redisClient: RedisClient;
    private embeddingService: EmbeddingService;

    constructor(redisClient: RedisClient, embeddingService: EmbeddingService) {
        this.localCache = new Map();
        this.redisClient = redisClient;
        this.embeddingService = embeddingService;
    }

    // Local memory cache methods
    setLocalCache(key: string, value: any, ttl: number) {
        this.localCache.set(key, { value, expiry: Date.now() + ttl * 1000 });
    }

    getLocalCache(key: string) {
        const cached = this.localCache.get(key);
        if (cached && Date.now() < cached.expiry) {
            return cached.value;
        }
        this.localCache.delete(key);
        return null;
    }

    // Redis distributed cache methods
    async setRedisCache(key: string, value: any, ttl: number) {
        await this.redisClient.setex(key, ttl, JSON.stringify(value));
    }

    async getRedisCache(key: string) {
        const data = await this.redisClient.get(key);
        return data ? JSON.parse(data) : null;
    }

    // Semantic cache using embeddings
    async cacheWithEmbedding(key: string, data: any) {
        const embedding = await this.embeddingService.createEmbedding(data);
        this.setLocalCache(key, embedding, 3600); // 1 hour TTL
        await this.setRedisCache(key, embedding, 3600);
    }

    // Intelligent TTL calculation
    calculateTTL(data: any): number {
        // Implement logic to calculate TTL based on data characteristics
        return 3600; // Default to 1 hour for simplicity
    }

    // PDF cache methods
    async cachePDF(key: string, pdfData: Buffer) {
        const ttl = this.calculateTTL(pdfData);
        await this.setRedisCache(key, pdfData, ttl);
    }
    
    // Embedding cache methods
    async cacheEmbedding(key: string, embedding: any) {
        const ttl = this.calculateTTL(embedding);
        await this.setRedisCache(key, embedding, ttl);
    }
}

export default SmartCache;