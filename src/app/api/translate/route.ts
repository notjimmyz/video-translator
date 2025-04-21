import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    // Generate unique filename
    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.name);
    const fileName = `${uniqueId}${fileExtension}`;
    const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
    const outputPath = path.join(process.cwd(), 'public', 'uploads', `translated_${fileName}`);

    // Create uploads directory if it doesn't exist
    await mkdir(path.join(process.cwd(), 'public', 'uploads'), { recursive: true });

    // Convert File to Buffer and save locally
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Process video using native FFmpeg
    await execAsync(`ffmpeg -i "${filePath}" -c copy "${outputPath}"`);

    return NextResponse.json({
      success: true,
      message: 'Video processing completed',
      data: {
        originalFileName: file.name,
        storedFileName: fileName,
        targetLanguage,
        status: 'completed',
        filePath: `/uploads/${fileName}`,
        translatedFilePath: `/uploads/translated_${fileName}`,
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