"use client";

import { useState, ChangeEvent, useEffect } from "react"; // Import useEffect
import ReactMarkdown from 'react-markdown';

export default function Home() {
  const [textInput, setTextInput] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState<string>('Copy Notes');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  // ESLint disable for unused variable as it's primarily for internal state tracking
  const [processedText, setProcessedText] = useState<string>(""); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [generatedNotes, setGeneratedNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeInput, setActiveInput] = useState<'text' | 'audio' | 'pdf'>('text');

  // New state variables for API keys and prompts
  const [groqApiKey, setGroqApiKey] = useState<string>("");
  const [mistralApiKey, setMistralApiKey] = useState<string>("");
  const [selectedPrompt, setSelectedPrompt] = useState<string>("default"); // 'default', 'summary', 'flashcards', 'custom', plus new prompts
  const [customPrompt, setCustomPrompt] = useState<string>("");

  const predefinedPrompts: { [key: string]: string } = {
    default: "Please process the following text and generate relevant notes or summaries in markdown:",
    summary: "Summarize the following text concisely in markdown:",
    flashcards: "Generate flashcard questions and answers from the following text in markdown format (Q: A:):",
    keywords: "Extract the most important keywords and concepts from the following text, presented as a comma-separated list:",
    summary_bullet: "Summarize the following text using bullet points, highlighting the key information:",
    detailed_explanation: "Provide a detailed explanation of the key topics discussed in the following text:",
  };

  // Load API keys from localStorage on component mount
  useEffect(() => {
    const savedGroqKey = localStorage.getItem('groqApiKey');
    const savedMistralKey = localStorage.getItem('mistralApiKey');
    if (savedGroqKey) {
      setGroqApiKey(savedGroqKey);
    }
    if (savedMistralKey) {
      setMistralApiKey(savedMistralKey);
    }
  }, []); // Empty dependency array ensures this runs only once on mount


  const handleAudioFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setTextInput(""); // Clear other inputs
      setPdfFile(null);
      setProcessedText("");
      setGeneratedNotes("");
      setError(null);
      setActiveInput('audio');
    }
  };

  const handlePdfFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setTextInput(""); // Clear other inputs
      setAudioFile(null);
      setProcessedText("");
      setGeneratedNotes("");
      setError(null);
      setActiveInput('pdf');
    } else if (file) {
        setError("Please select a valid PDF file.");
        event.target.value = ""; // Reset file input
    }
  };

  const handleTextInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setTextInput(event.target.value);
    setAudioFile(null); // Clear other inputs
    setPdfFile(null);
    setProcessedText("");
    setGeneratedNotes("");
    setError(null);
    setActiveInput('text');
  };

  const handlePromptChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedPrompt(event.target.value);
  };

   // Save API keys to localStorage when they change
   const handleGroqApiKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
       setGroqApiKey(event.target.value);
       localStorage.setItem('groqApiKey', event.target.value);
   };

   const handleMistralApiKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
       setMistralApiKey(event.target.value);
       localStorage.setItem('mistralApiKey', event.target.value);
   };


  const processInput = async () => {
    setIsLoading(true);
    setError(null);
    setProcessedText(""); // Clear previous processed text
    setGeneratedNotes(""); // Clear previous notes

    let textToSubmit = textInput;
    const promptToSend = selectedPrompt === 'custom' ? customPrompt : predefinedPrompts[selectedPrompt];

    // Validate API keys
     if (activeInput === 'audio' && !groqApiKey.trim()) {
         setError("Please enter your Groq API Key for audio transcription.");
         setIsLoading(false);
         return;
     }
     if (!mistralApiKey.trim()) {
         setError("Please enter your Mistral API Key for note generation.");
         setIsLoading(false);
         return;
     }
     if (selectedPrompt === 'custom' && !customPrompt.trim()) {
         setError("Please enter your custom prompt.");
         setIsLoading(false);
         return;
     }


    try {
      if (activeInput === 'audio' && audioFile) {
        console.log("Processing audio file...");
        const formData = new FormData();
        formData.append("audio", audioFile);
        formData.append("groqApiKey", groqApiKey.trim()); // Send Groq API key

        const response = await fetch("/api/transcribe-audio", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        textToSubmit = data.transcript;
        setProcessedText(textToSubmit); // Display transcript
        console.log("Audio processed successfully.");

      } else if (activeInput === 'pdf' && pdfFile) {
        console.log("Processing PDF file...");
        const formData = new FormData();
        formData.append("pdf", pdfFile);
        // PDF processing doesn't need an API key directly on the frontend side here
        // It will use the text extracted to generate notes later.

        const response = await fetch("/api/process-pdf", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        textToSubmit = data.text;
        setProcessedText(textToSubmit); // Display extracted text
        console.log("PDF processed successfully.");
      } else if (activeInput === 'text') {
         console.log("Using direct text input.");
         setProcessedText(textInput); // Display the input text itself
      }


      if (!textToSubmit && (activeInput as string) !== 'text') {
          console.log("No text derived from input to generate notes from.");
          setIsLoading(false);
          if (activeInput !== 'text') setError("Could not extract text from the uploaded file.");
          return; // Don't proceed if no text was generated/input
      }

       // Ensure textToSubmit has a value before calling generate notes
       if (textToSubmit === null || textToSubmit === undefined) {
           console.error("textToSubmit is null or undefined before generating notes");
           throw new Error("Internal error: Text processing failed unexpectedly.");
       }

      // Now generate notes with the processed text (or original text)
      console.log("Generating notes...");
      const notesResponse = await fetch("/api/generate-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textToProcess: textToSubmit,
          mistralApiKey: mistralApiKey.trim(), // Send Mistral API key
          prompt: promptToSend, // Send the selected/custom prompt
        }),
      });

      if (!notesResponse.ok) {
        const errorData = await notesResponse.json();
        throw new Error(errorData.error || `Note generation failed! status: ${notesResponse.status}`);
      }

      const notesData = await notesResponse.json();
      setGeneratedNotes(notesData.notes);
      console.log("Notes generated successfully.");

    } catch (err: unknown) { // Use unknown instead of any
      console.error("Processing error:", err);
      // Use type assertion for properties common in errors
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
            AI Note Generator
          </h1>
          <p className="text-slate-400 text-lg">
            Transform text, audio, or PDF into structured notes using AI
          </p>
        </div>

        {/* API Key Inputs */}
         <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 space-y-4">
             <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 1a4 4 0 00-4 4v2a4 4 0 00-4 4v2a4 4 0 004 4h8a4 4 0 004-4v-2a4 4 0 00-4-4V5a4 4 0 00-4-4zm3 8V5a3 3 0 10-6 0v4a2 2 0 00-2 2v2a2 2 0 002 2h8a2 2 0 002-2v-2a2 2 0 00-2-2h-1z" clipRule="evenodd" />
                </svg>
                 API Keys
             </h2>
             <input
                 type="password"
                 value={groqApiKey}
                 onChange={handleGroqApiKeyChange} // Use the new handler
                 placeholder="Enter your Groq API Key (for Audio)"
                 className="w-full px-4 py-3 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 bg-slate-900 text-slate-200 placeholder-slate-500"
                 disabled={isLoading}
             />
             <input
                 type="password"
                 value={mistralApiKey}
                 onChange={handleMistralApiKeyChange} // Use the new handler
                 placeholder="Enter your Mistral API Key (for Notes)"
                 className="w-full px-4 py-3 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 bg-slate-900 text-slate-200 placeholder-slate-500"
                 disabled={isLoading}
             />
         </div>

        {/* Prompt Selection */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 space-y-4">
           <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
               Prompt Settings
           </h2>
           <div className="flex items-center gap-4">
               <label htmlFor="prompt-select" className="text-slate-300">Choose Prompt:</label>
               <select
                   id="prompt-select"
                   value={selectedPrompt}
                   onChange={handlePromptChange}
                   className="px-4 py-3 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 bg-slate-900 text-slate-200"
                   disabled={isLoading}
               >
                   <option value="default">Default Notes</option>
                   <option value="summary">Concise Summary</option>
                   <option value="flashcards">Flashcards (Q: A:)</option>
                   {/* Added new prompt options */}
                   <option value="keywords">Extract Keywords</option>
                   <option value="summary_bullet">Summarize in Bullet Points</option>
                   <option value="detailed_explanation">Detailed Explanation</option>
                   <option value="custom">Custom Prompt</option>
               </select>
           </div>
           {selectedPrompt === 'custom' && (
                <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Enter your custom prompt here..."
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 bg-slate-900 text-slate-200 placeholder-slate-500 mt-2"
                    disabled={isLoading}
                />
           )}
        </div>


        {/* Input Sections */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Text Input Card */}
          <div className={`bg-slate-800 rounded-xl p-6 shadow-xl transition-all duration-200 border border-slate-700 ${activeInput === 'text' ? 'ring-2 ring-blue-500' : ''}`}>
            <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              Text Input
            </h2>
            <textarea
              value={textInput}
              onChange={handleTextInputChange}
              placeholder="Paste your text here..."
              rows={6}
              className="w-full px-4 py-3 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 bg-slate-900 text-slate-200 placeholder-slate-500"
              disabled={isLoading}
            />
          </div>

          {/* Audio Input Card */}
          <div className={`bg-slate-800 rounded-xl p-6 shadow-xl transition-all duration-200 border border-slate-700 ${activeInput === 'audio' ? 'ring-2 ring-blue-500' : ''}`}>
            <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Audio Input
            </h2>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer hover:border-slate-600 transition-colors duration-150 bg-slate-900">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm text-slate-400 text-center">
                  {audioFile ? (
                    <span className="text-blue-400 font-medium">{audioFile.name}</span>
                  ) : (
                    <>
                      <span className="font-medium">Click to upload audio</span><br />
                      <span className="text-xs">(MP3, WAV, etc.)</span>
                    </>
                  )}
                </p>
              </div>
              <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleAudioFileChange}
                className="hidden"
                disabled={isLoading}
              />
            </label>
          </div>

          {/* PDF Input Card */}
          <div className={`bg-slate-800 rounded-xl p-6 shadow-xl transition-all duration-200 border border-slate-700 ${activeInput === 'pdf' ? 'ring-2 ring-blue-500' : ''}`}>
            <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              PDF Input
            </h2>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer hover:border-slate-600 transition-colors duration-150 bg-slate-900">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-slate-400 text-center">
                  {pdfFile ? (
                    <span className="text-blue-400 font-medium">{pdfFile.name}</span>
                  ) : (
                    <>
                      <span className="font-medium">Click to upload PDF</span><br />
                      <span className="text-xs">(Max 10MB)</span>
                    </>
                  )}
                </p>
              </div>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handlePdfFileChange}
                className="hidden"
                disabled={isLoading}
              />
            </label>
          </div>
        </div>

        {/* Process Button */}
        <div className="flex justify-center">
          <button
            onClick={processInput}
            disabled={
              isLoading ||
              (activeInput === 'text' && !textInput.trim()) ||
              (activeInput === 'audio' && !audioFile) ||
              (activeInput === 'pdf' && !pdfFile) ||
              !mistralApiKey.trim() || // Disable if Mistral key is empty
              (activeInput === 'audio' && !groqApiKey.trim()) || // Disable if audio and Groq key is empty
              (selectedPrompt === 'custom' && !customPrompt.trim()) // Disable if custom prompt selected but empty
            }
            className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center gap-3 ${
              isLoading ||
              (activeInput === 'text' && !textInput.trim()) ||
              (activeInput === 'audio' && !audioFile) ||
              (activeInput === 'pdf' && !pdfFile) ||
              !mistralApiKey.trim() ||
              (activeInput === 'audio' && !groqApiKey.trim()) ||
              (selectedPrompt === 'custom' && !customPrompt.trim())
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-slate-900 shadow-lg hover:shadow-xl'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-6 w-6 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Generate Notes
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Error:</span> {error}
            </div>
          </div>
        )}

        {generatedNotes && (
          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-200">Generated Notes</h3>
                 <button
                    onClick={handleCopyNotes}
                    className="ml-4 bg-gradient-to-r from-cyan-400 to-blue-500 py-1 px-3 text-black rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out text-sm"
                    disabled={copyStatus === 'Copied!'}
                >
                    {copyStatus}
                </button>
            </div>
            <ReactMarkdown
              components={{
                p: (props) => <p className="text-slate-200 mb-4 leading-relaxed" {...props} />,
                h1: (props) => <h1 className="text-4xl font-bold text-blue-400 mb-6" {...props} />,
                h2: (props) => <h2 className="text-3xl font-semibold text-blue-300 mb-4" {...props} />,
                h3: (props) => <h3 className="text-2xl font-medium text-blue-200 mb-3" {...props} />,
                h4: (props) => <h4 className="text-xl font-medium text-blue-100 mb-2" {...props} />,
                h5: (props) => <h5 className="text-lg font-medium text-blue-100 mb-2" {...props} />,
                h6: (props) => <h6 className="text-base font-medium text-blue-100 mb-2" {...props} />,
                ul: (props) => <ul className="list-disc list-inside text-slate-200 mb-4 pl-4" {...props} />,
                ol: (props) => <ol className="list-decimal list-inside text-slate-200 mb-4 pl-4" {...props} />,
                li: (props) => <li className="text-slate-200" {...props} />,
                blockquote: (props) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-slate-300 mb-4 bg-slate-800 p-4 rounded" {...props} />,
                code: (props) => <code className="bg-slate-800 text-blue-400 px-2 py-1 rounded" {...props} />,
                pre: (props) => <pre className="bg-slate-800 text-blue-400 p-4 rounded mb-4 overflow-x-auto" {...props} />,
                a: (props) => <a className="text-blue-400 hover:underline" {...props} />,
                table: (props) => <table className="min-w-full divide-y divide-slate-700 mb-4" {...props} />,
                th: (props) => <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider" {...props} />,
                td: (props) => <td className="px-6 py-4 whitespace-nowrap text-slate-200" {...props} />,
              }}
            >
              {generatedNotes}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </main>
  );

  async function handleCopyNotes() {
    try {
      await navigator.clipboard.writeText(generatedNotes);
      setCopyStatus('Copied!');
      setTimeout(() => {
        setCopyStatus('Copy Notes');
      }, 2000); // Reset text after 2 seconds
    } catch (err: unknown) { // Use unknown instead of any
      console.error('Failed to copy notes:', err);
      setCopyStatus('Failed to copy');
       setTimeout(() => {
        setCopyStatus('Copy Notes');
      }, 2000); // Reset text after 2 seconds
    }
  }
}