/**
 * Serviço de Upload de Arquivos
 */

import { authService } from './authService';
import type { UploadedFile } from '../types/templates';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class FileUploadService {
  /**
   * Upload de arquivo com progress tracking
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.data);
        } else {
          reject(new Error('Upload falhou'));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Erro de rede durante upload'));
      });

      // Send request
      const token = authService.getToken();
      xhr.open('POST', `${API_BASE_URL}/api/files/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  }

  /**
   * Upload múltiplo de arquivos
   */
  async uploadMultipleFiles(
    files: File[],
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<UploadedFile[]> {
    const uploads: Promise<UploadedFile>[] = files.map((file, index) =>
      this.uploadFile(file, (progress) => {
        if (onProgress) onProgress(index, progress);
      })
    );

    return Promise.all(uploads);
  }

  /**
   * Obter arquivo por ID
   */
  async getFile(fileId: string): Promise<UploadedFile> {
    return authService.apiRequest<UploadedFile>(`/api/files/${fileId}`);
  }

  /**
   * Listar arquivos do usuário
   */
  async listFiles(params?: {
    limit?: number;
    offset?: number;
    status?: UploadedFile['status'];
  }): Promise<{ files: UploadedFile[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.status) queryParams.append('status', params.status);

    return authService.apiRequest<{ files: UploadedFile[]; total: number }>(
      `/api/files?${queryParams.toString()}`
    );
  }

  /**
   * Deletar arquivo
   */
  async deleteFile(fileId: string): Promise<void> {
    return authService.apiRequest<void>(`/api/files/${fileId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Processar arquivo (extrair texto, metadata)
   */
  async processFile(fileId: string): Promise<UploadedFile> {
    return authService.apiRequest<UploadedFile>(
      `/api/files/${fileId}/process`,
      {
        method: 'POST'
      }
    );
  }

  /**
   * Verificar se tipo de arquivo é suportado
   */
  isSupportedFileType(file: File): boolean {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'text/plain',
      'text/csv'
    ];

    return supportedTypes.includes(file.type);
  }

  /**
   * Validar arquivo antes de upload
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB

    if (!this.isSupportedFileType(file)) {
      return {
        valid: false,
        error: 'Tipo de arquivo não suportado. Use PDF, DOCX, DOC, TXT ou CSV.'
      };
    }

    if (file.size > MAX_SIZE) {
      return {
        valid: false,
        error: 'Arquivo muito grande. Tamanho máximo: 50MB.'
      };
    }

    return { valid: true };
  }

  /**
   * Usar arquivo em uma pesquisa
   */
  async useFileInResearch(fileId: string, query: string): Promise<any> {
    return authService.apiRequest<any>('/api/research/with-file', {
      method: 'POST',
      body: JSON.stringify({ fileId, query })
    });
  }
}

export const fileUploadService = new FileUploadService();
