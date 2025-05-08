import Groq from "groq-sdk";
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('audio') as File | null;
    // Get the Groq API key from the form data
    const groqApiKey = formData.get('groqApiKey') as string | null;


    if (!file) {
      return NextResponse.json({ error: 'Missing audio file in request data' }, { status: 400 });
    }

    // Use the API key from the request body
    if (!groqApiKey) {
      return NextResponse.json({ error: 'Missing Groq API Key in request data' }, { status: 400 });
    }

    const groq = new Groq({ apiKey: groqApiKey });

    // Convert the File blob to a Buffer
    const audioBuffer = Buffer.from(await file.arrayBuffer());

    try {
      const audioFile = new File([audioBuffer], file.name, { type: file.type });

      const transcription = await groq.audio.transcriptions.create({
        file: audioFile, // Pass the File object
        model: "whisper-large-v3",
      });
      return NextResponse.json({ transcript: transcription.text });
    } catch (groqError) {
        console.error('Groq API Error:', groqError);
        const errorMessage = groqError instanceof Error ? groqError.message : 'Groq API request failed';
        // Attempt to get status code from Groq error if available, otherwise default to 500
        const errorStatus = (groqError as any)?.status || 500;
        return NextResponse.json({ error: 'Failed to transcribe audio via Groq API', details: errorMessage }, { status: errorStatus });
    }

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}