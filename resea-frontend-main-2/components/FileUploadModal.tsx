import React, { useState, useCallback } from 'react';
import { fileUploadService } from '../services/fileUploadService';
import type { UploadedFile } from '../types/templates';

interface FileUploadModalProps {
  onClose: () => void;
  onFilesUploaded: (files: UploadedFile[]) => void;
  onFileSelected?: (file: UploadedFile) => void;
  allowMultiple?: boolean;
}

interface UploadingFileInfo {
  name: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  onClose,
  onFilesUploaded,
  onFileSelected,
  allowMultiple = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFileInfo>>(new Map());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Type assertion necessário - FileList não é array nativo
    const files = Array.from(e.dataTransfer.files) as File[];
    await handleFiles(files);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Type assertion necessário - FileList não é array nativo
      const files = Array.from(e.target.files) as File[];
      await handleFiles(files);
    }
  }, []);

  const handleFiles = async (files: File[]) => {
    const filesToUpload = allowMultiple ? files : files.slice(0, 1);

    for (const file of filesToUpload) {
      // Validar arquivo
      const validation = fileUploadService.validateFile(file);
      if (!validation.valid) {
        const fileId = `temp-${Date.now()}-${file.name}`;
        setUploadingFiles(prev => new Map(prev).set(fileId, {
          name: file.name,
          progress: 0,
          status: 'error',
          error: validation.error
        }));
        continue;
      }

      // Iniciar upload
      const fileId = `temp-${Date.now()}-${file.name}`;
      setUploadingFiles(prev => new Map(prev).set(fileId, {
        name: file.name,
        progress: 0,
        status: 'uploading'
      }));

      try {
        const uploadedFile = await fileUploadService.uploadFile(
          file,
          (progress) => {
            setUploadingFiles(prev => {
              const newMap = new Map<string, UploadingFileInfo>(prev);
              const existing = newMap.get(fileId);
              if (existing) {
                newMap.set(fileId, {
                  name: existing.name,
                  progress,
                  status: existing.status,
                  error: existing.error
                });
              }
              return newMap;
            });
          }
        );

        // Upload concluído
        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          newMap.set(fileId, {
            name: file.name,
            progress: 100,
            status: 'done'
          });
          return newMap;
        });

        // Processar arquivo
        setIsProcessing(true);
        await fileUploadService.processFile(uploadedFile.id);
        setIsProcessing(false);

        setUploadedFiles(prev => [...prev, uploadedFile]);
      } catch (error) {
        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          newMap.set(fileId, {
            name: file.name,
            progress: 0,
            status: 'error',
            error: error instanceof Error ? error.message : 'Erro ao fazer upload'
          });
          return newMap;
        });
      }
    }
  };

  const handleDone = () => {
    onFilesUploaded(uploadedFiles);
    onClose();
  };

  const uploadArray = Array.from(uploadingFiles.values()) as UploadingFileInfo[];
  const hasUploads = uploadArray.length > 0;
  const allDone = hasUploads && uploadArray.every(f => f.status === 'done' || f.status === 'error');

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Enviar Arquivos</h2>
            <p className="text-sm text-gray-600 mt-1">
              PDF, DOCX, DOC, TXT ou CSV (máx. 50MB)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drop Zone */}
        <div className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-lg font-medium text-gray-700 mb-2">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Suporta: PDF, DOCX, DOC, TXT, CSV
            </p>
            <label className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors">
              Selecionar Arquivo{allowMultiple ? 's' : ''}
              <input
                type="file"
                multiple={allowMultiple}
                accept=".pdf,.docx,.doc,.txt,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* Upload Progress */}
          {hasUploads && (
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-gray-900">
                {isProcessing ? 'Processando arquivos...' : 'Arquivos'}
              </h3>
              {uploadArray.map((file, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {file.status === 'done' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : file.status === 'error' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="animate-spin h-5 w-5 text-indigo-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      <span className="text-sm font-medium text-gray-900 truncate">{file.name}</span>
                    </div>
                    <span className="text-sm text-gray-500 flex-shrink-0 ml-2">
                      {file.status === 'done'
                        ? 'Concluído'
                        : file.status === 'error'
                        ? 'Erro'
                        : `${Math.round(file.progress)}%`}
                    </span>
                  </div>
                  {file.status === 'uploading' && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      ></div>
                    </div>
                  )}
                  {file.error && (
                    <p className="text-sm text-red-600 mt-2">{file.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleDone}
            disabled={!allDone || uploadedFiles.length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Concluir ({uploadedFiles.length})
          </button>
        </div>
      </div>
    </div>
  );
};
