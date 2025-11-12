import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../config/logger.js';
import { Readable } from 'stream';

interface UploadResult {
  key: string;
  url: string;
  size: number;
}

interface DownloadResult {
  stream: Readable;
  contentType: string;
  size: number;
}

/**
 * Storage Service - Cloudflare R2 (S3-compatible)
 *
 * Suporta:
 * - Cloudflare R2 (via S3 API)
 * - AWS S3
 * - Qualquer storage S3-compatible
 */
export class StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private isEnabled: boolean;

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET || '';
    this.isEnabled = this.bucket !== '' && process.env.R2_ENABLED === 'true';

    if (this.isEnabled) {
      this.initializeClient();
    } else {
      logger.info('📦 R2/S3 storage disabled - documents will be stored in PostgreSQL');
    }
  }

  private initializeClient(): void {
    try {
      // Verifica se todas as credenciais necessárias estão presentes
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

      if (!accountId && !process.env.AWS_REGION) {
        throw new Error('R2_ACCOUNT_ID or AWS_REGION is required');
      }

      if (!accessKeyId || !secretAccessKey) {
        throw new Error('Access credentials are required');
      }

      // Cloudflare R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
      // AWS S3 endpoint format: regional (us-east-1, etc)
      const endpoint = accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : undefined;

      const region = process.env.R2_REGION || process.env.AWS_REGION || 'auto';

      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        // R2 requer forcePathStyle = true
        forcePathStyle: !!accountId
      });

      logger.info(`✅ Storage client initialized: ${accountId ? 'Cloudflare R2' : 'AWS S3'} (bucket: ${this.bucket})`);
    } catch (error) {
      logger.error('Failed to initialize storage client:', error);
      this.s3Client = null;
      this.isEnabled = false;
    }
  }

  /**
   * Verifica se o storage está habilitado e configurado
   */
  isAvailable(): boolean {
    return this.isEnabled && this.s3Client !== null;
  }

  /**
   * Upload de documento para R2/S3
   * @param userId ID do usuário (para organizar em pastas)
   * @param documentId ID do documento
   * @param content Conteúdo do documento (Buffer ou string)
   * @param contentType MIME type (ex: application/pdf, text/html)
   * @param fileExtension Extensão do arquivo (ex: pdf, html, docx)
   */
  async uploadDocument(
    userId: string,
    documentId: string,
    content: Buffer | string,
    contentType: string = 'text/html',
    fileExtension: string = 'html'
  ): Promise<UploadResult> {
    if (!this.isAvailable()) {
      throw new Error('Storage service is not available');
    }

    try {
      const key = `documents/${userId}/${documentId}.${fileExtension}`;
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          userId,
          documentId,
          uploadedAt: new Date().toISOString()
        }
      });

      await this.s3Client!.send(command);

      const url = this.getPublicUrl(key);

      logger.info(`Document uploaded successfully: ${key} (${buffer.length} bytes)`);

      return {
        key,
        url,
        size: buffer.length
      };
    } catch (error) {
      logger.error('Failed to upload document:', error);
      throw new Error('Failed to upload document to storage');
    }
  }

  /**
   * Download de documento do R2/S3
   */
  async downloadDocument(key: string): Promise<DownloadResult> {
    if (!this.isAvailable()) {
      throw new Error('Storage service is not available');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const response = await this.s3Client!.send(command);

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType || 'application/octet-stream',
        size: response.ContentLength || 0
      };
    } catch (error) {
      logger.error(`Failed to download document ${key}:`, error);
      throw new Error('Failed to download document from storage');
    }
  }

  /**
   * Gera URL assinada para download seguro (válida por 1 hora)
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Storage service is not available');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const url = await getSignedUrl(this.s3Client!, command, { expiresIn });

      logger.debug(`Generated signed URL for ${key} (expires in ${expiresIn}s)`);

      return url;
    } catch (error) {
      logger.error(`Failed to generate signed URL for ${key}:`, error);
      throw new Error('Failed to generate download URL');
    }
  }

  /**
   * Deleta documento do R2/S3
   */
  async deleteDocument(key: string): Promise<void> {
    if (!this.isAvailable()) {
      logger.warn('Storage service not available, skipping delete');
      return;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.s3Client!.send(command);

      logger.info(`Document deleted successfully: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete document ${key}:`, error);
      throw new Error('Failed to delete document from storage');
    }
  }

  /**
   * Verifica se documento existe no R2/S3
   */
  async documentExists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.s3Client!.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      logger.error(`Failed to check document existence ${key}:`, error);
      return false;
    }
  }

  /**
   * Retorna URL pública do documento (se o bucket for público)
   * Para R2: https://<bucket>.<account_id>.r2.cloudflarestorage.com/<key>
   * Para S3: https://<bucket>.s3.<region>.amazonaws.com/<key>
   */
  private getPublicUrl(key: string): string {
    const accountId = process.env.R2_ACCOUNT_ID;
    const region = process.env.AWS_REGION || 'us-east-1';
    const publicDomain = process.env.R2_PUBLIC_DOMAIN; // Custom domain opcional

    if (publicDomain) {
      return `${publicDomain}/${key}`;
    }

    if (accountId) {
      // Cloudflare R2
      return `https://${this.bucket}.${accountId}.r2.cloudflarestorage.com/${key}`;
    } else {
      // AWS S3
      return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
    }
  }

  /**
   * Retorna estatísticas de uso do storage (tamanho total, quantidade de arquivos)
   * Nota: R2 não tem API nativa para listar todos os objetos de forma eficiente,
   * então usamos dados do PostgreSQL
   */
  async getUsageStats(userId: string): Promise<{ totalSize: number; fileCount: number }> {
    // Esta função será implementada no documentHistoryService
    // que tem acesso ao PostgreSQL
    return { totalSize: 0, fileCount: 0 };
  }
}

// Singleton instance
export const storageService = new StorageService();
