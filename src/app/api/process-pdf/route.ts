import { NextRequest, NextResponse } from 'next/server';
import pdf from '@cyber2024/pdf-parse-fixed';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing pdf file in request data' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
         return NextResponse.json({ error: 'Invalid file type. Please upload a PDF.' }, { status: 400 });
    }

    // Convert the File blob to a Buffer
    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    // Parse the PDF buffer
    let data;
    try {
        data = await pdf(pdfBuffer);
        console.log('Parsed PDF data:', data);
    } catch (parseError) {
        if (parseError instanceof Error) {
            console.error('Error parsing PDF:', parseError);
            return NextResponse.json({ error: 'Failed to parse PDF file', details: parseError.message }, { status: 500 });
        } else {
            console.error('Unknown error parsing PDF:', parseError);
            return NextResponse.json({ error: 'Failed to parse PDF file', details: 'Unknown error' }, { status: 500 });
        }
    }

    // Ensure data.text is defined before returning
    if (!data || !data.text) {
        console.error('No text extracted from PDF');
        return NextResponse.json({ error: 'No text could be extracted from the PDF file' }, { status: 500 });
    }

    // Return the extracted text
    return NextResponse.json({ text: data.text });

  } catch (error) {
    console.error('Error processing PDF:', error);
    // Provide more specific error feedback if possible
    if (error instanceof Error && error.message.includes('Invalid PDF')) {
        return NextResponse.json({ error: 'Invalid or corrupted PDF file.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to process PDF file' }, { status: 500 });
  }
}
