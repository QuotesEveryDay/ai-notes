import { NextRequest, NextResponse } from 'next/server';
import { Mistral } from '@mistralai/mistralai';

const MODEL_NAME = "mistral-large-latest";

export async function POST(request: NextRequest) {
  try {
    // Get textToProcess, mistralApiKey, and prompt from the request body
    const { textToProcess, mistralApiKey, prompt } = await request.json();

    if (!textToProcess) {
      return NextResponse.json({ error: 'Missing textToProcess in request body' }, { status: 400 });
    }

    // Use the API key from the request body
    if (!mistralApiKey) {
      return NextResponse.json({ error: 'Missing Mistral API Key in request body' }, { status: 400 });
    }

     // Use the prompt from the request body, or a default if none is provided
    const finalPrompt = prompt ? prompt : `Please process the following text and generate relevant notes or summaries in markdown:`;


    const client = new Mistral({ apiKey: mistralApiKey });

    const chatResponse = await client.chat.complete({
      model: MODEL_NAME,
      // Use the dynamic prompt
      messages: [{ role: 'user', content: `${finalPrompt}\n\n---\n${textToProcess}\n---` }],
    });

    if (!chatResponse.choices || chatResponse.choices.length === 0) {
      // Improved error handling for no choices
      const errorDetails = (chatResponse as any).error || 'No choices returned from Mistral API';
       // Attempt to get status code from Mistral response if available, otherwise default to 500
      const errorStatus = (chatResponse as any).status || 500;
      throw new Error(`Mistral API Error: ${errorDetails}, Status: ${errorStatus}`);
    }

    const notes = chatResponse.choices[0].message.content;

    return NextResponse.json({ notes });

  } catch (error: unknown) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
     // Attempt to extract status from the error object if it exists
    const errorStatus = (error as any)?.status || 500;
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: errorStatus });
  }
}
