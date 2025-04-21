'use client';

import { useState } from 'react';
import VideoUploader from '@/components/VideoUploader';
import LanguageSelector, { Language } from '@/components/LanguageSelector';
import axios from 'axios';

interface TranslationResponse {
  success: boolean;
  message: string;
  data: {
    originalFileName: string;
    storedFileName: string;
    targetLanguage: string;
    status: string;
    filePath: string;
    translatedFilePath: string;
  };
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>({
    id: '1',
    name: 'English',
    code: 'en',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<TranslationResponse['data'] | null>(null);

  const handleVideoSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
    setUploadedVideo(null);
  };

  const handleTranslate = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('targetLanguage', selectedLanguage.code);

    try {
      const response = await axios.post<TranslationResponse>('/api/translate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Translation response:', response.data);
      setUploadedVideo(response.data.data);
    } catch (error) {
      console.error('Error translating video:', error);
      setError('Failed to translate video. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-24">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Video Language Translator
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Translate Chinese short-form videos while preserving the speaker's tone
          </p>
        </div>

        <div className="space-y-4">
          <VideoUploader onVideoSelect={handleVideoSelect} />
          
          <div className="w-full max-w-xs mx-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Language
            </label>
            <LanguageSelector
              selected={selectedLanguage}
              onChange={setSelectedLanguage}
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleTranslate}
              disabled={!selectedFile || isProcessing}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                !selectedFile || isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Translate Video'}
            </button>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>

        {uploadedVideo && (
          <div className="mt-8 space-y-8">
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Original Video</h2>
              <div className="aspect-video w-full">
                <video
                  src={uploadedVideo.filePath}
                  controls
                  className="w-full h-full rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Translated Video</h2>
              <div className="aspect-video w-full">
                <video
                  src={uploadedVideo.translatedFilePath}
                  controls
                  className="w-full h-full rounded-lg"
                />
              </div>
              <div className="text-sm text-gray-500">
                <p>Status: {uploadedVideo.status}</p>
                <p>Target Language: {selectedLanguage.name}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
