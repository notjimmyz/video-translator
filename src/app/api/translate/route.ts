import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import axios from 'axios';

const execAsync = promisify(exec);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Google Cloud API endpoints
const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const SPEECH_TO_TEXT_URL = 'https://speech.googleapis.com/v1/speech:recognize';
const TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';
const TEXT_TO_SPEECH_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

async function extractAudio(videoPath: string, audioPath: string) {
  await execAsync(`ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`);
}

async function transcribeAudio(audioPath: string): Promise<string> {
  const audioContent = await readFile(audioPath);
  const base64Audio = audioContent.toString('base64');

  const response = await axios.post(
    `${SPEECH_TO_TEXT_URL}?key=${GOOGLE_CLOUD_API_KEY}`,
    {
      audio: {
        content: base64Audio,
      },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'zh-CN',
      },
    }
  );

  return response.data.results?.[0]?.alternatives?.[0]?.transcript || '';
}

async function translateText(text: string, targetLanguage: string): Promise<string> {
  const response = await axios.post(
    `${TRANSLATE_URL}?key=${GOOGLE_CLOUD_API_KEY}`,
    {
      q: text,
      source: 'zh-CN',
      target: targetLanguage,
      format: 'text',
    }
  );

  return response.data.data.translations[0].translatedText;
}

async function generateSpeech(text: string, languageCode: string, outputPath: string) {
  const response = await axios.post(
    `${TEXT_TO_SPEECH_URL}?key=${GOOGLE_CLOUD_API_KEY}`,
    {
      input: { text },
      voice: { languageCode },
      audioConfig: { audioEncoding: 'LINEAR16' },
    }
  );

  if (response.data.audioContent) {
    const audioBuffer = Buffer.from(response.data.audioContent, 'base64');
    await writeFile(outputPath, audioBuffer);
  }
}

async function mergeAudioWithVideo(videoPath: string, audioPath: string, outputPath: string) {
  await execAsync(`ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 "${outputPath}"`);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const targetLanguage = formData.get('targetLanguage') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'No target language specified' },
        { status: 400 }
      );
    }

    // Generate unique filenames
    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.name);
    const fileName = `${uniqueId}${fileExtension}`;
    const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
    const audioPath = path.join(process.cwd(), 'public', 'uploads', `${uniqueId}.wav`);
    const translatedAudioPath = path.join(process.cwd(), 'public', 'uploads', `${uniqueId}_translated.wav`);
    const outputPath = path.join(process.cwd(), 'public', 'uploads', `translated_${fileName}`);

    // Create uploads directory if it doesn't exist
    await mkdir(path.join(process.cwd(), 'public', 'uploads'), { recursive: true });

    // Save uploaded video
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Step 1: Extract audio
    await extractAudio(filePath, audioPath);

    // Step 2: Transcribe audio
    const transcription = await transcribeAudio(audioPath);

    // Step 3: Translate text
    const translatedText = await translateText(transcription, targetLanguage);

    // Step 4: Generate speech
    await generateSpeech(translatedText, targetLanguage, translatedAudioPath);

    // Step 5: Merge audio with video
    await mergeAudioWithVideo(filePath, translatedAudioPath, outputPath);

    // Clean up temporary files
    await unlink(audioPath);
    await unlink(translatedAudioPath);

    return NextResponse.json({
      success: true,
      message: 'Video translation completed',
      data: {
        originalFileName: file.name,
        storedFileName: fileName,
        targetLanguage,
        status: 'completed',
        filePath: `/uploads/${fileName}`,
        translatedFilePath: `/uploads/translated_${fileName}`,
        transcription,
        translatedText,
      },
    });
  } catch (error) {
    console.error('Error processing video:', error);
    return NextResponse.json(
      { error: 'Error processing video' },
      { status: 500 }
    );
  }
} 