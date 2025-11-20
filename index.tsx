/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.mjs`;

// --- CONSTANTS & TEMPLATES ---

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 2000;
const COOL_DOWN_DELAY_MS = 10000;

const TEMPLATES = {
  coding: `### GRADING PHILOSOPHY: Conceptual Understanding > Syntactic Perfection
- **Dataset Leniency:** Do NOT deduct points for different filenames if data loads correctly.
- **Data Loading:** Only deduct if structure is incorrect.
- **Effort Points:** Award effort points if logic is visible but syntax fails, unless the rubric forbids it.
- **Strict Deductions:** Deduct for conceptual errors (e.g., using mean instead of median for skewed data).

### FEEDBACK STYLE
- Be specific: "Misclassified 'origin' as quantitative; affects summary stats."
- Be neutral and educational.
- Provide a fix for every deduction.`,

  writing: `### GRADING PHILOSOPHY: Argument & Evidence > Grammar
- **Thesis:** The thesis must be clear and arguable.
- **Evidence:** Deduct points if claims are unsupported by text/sources.
- **Structure:** Paragraphs must have topic sentences.
- **Grammar:** Do not deduct for minor typos unless readability is compromised.

### FEEDBACK STYLE
- Tone: Constructive Editor.
- Format: "Weak topic sentence in Para 2 -> obscure main point. Fix: Explicitly state the argument."`,

  math: `### GRADING PHILOSOPHY: Logic > Arithmetic
- **Process:** Award majority points for correct logical steps/proof structure.
- **Arithmetic:** Minor calculation errors get small deductions (e.g., -0.5), provided the logic remains sound.
- **Notation:** Mathematical notation must be precise.
- **Proof:** "Show your work" is mandatory.

### FEEDBACK STYLE
- Pinpoint the exact step where logic broke.
- Differentiate between "Calculation Error" and "Conceptual Error".`
};

const DEFAULT_POLICY = TEMPLATES.coding;

// --- TYPES ---

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    total_score: { type: Type.STRING },
    breakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          feedback: { type: Type.STRING },
        },
        required: ['feedback']
      }
    }
  },
  required: ['total_score', 'breakdown'],
};

interface FeedbackBreakdown {
  feedback: string;
}

interface GradingResult {
  filename: string;
  total_score: string;
  breakdown: FeedbackBreakdown[];
}

interface GradingError {
  status: 'error';
  filename: string;
  error: string;
}

// --- COMPONENTS ---

function LandingPage({ onNext }: { onNext: () => void }) {
  return (
    <div className="wizard-step fade-in">
      <header className="hero">
        <h1>EasyGrader AI</h1>
        <p className="subtitle">Secure, Private, Customizable Grading Assistant</p>
      </header>

      <div className="value-props">
        <div className="card">
          <h3>🔒 Bring Your Own Key</h3>
          <p>Your API key is stored locally on your device. It is never sent to our servers. You maintain full control and privacy.</p>
        </div>
        <div className="card">
          <h3>⚙️ Fully Customizable</h3>
          <p>Define your own grading personality. Strict syntax checking or conceptual leniency? It's up to you.</p>
        </div>
        <div className="card">
          <h3>🚀 Fast & Batch Ready</h3>
          <p>Grade dozens of PDFs, Notebooks, or text files in parallel using the power of Gemini 2.5.</p>
        </div>
      </div>

      <div className="privacy-notice">
        <h4>Privacy Notice</h4>
        <ul>
          <li><strong>No Data Collection:</strong> We do not store your student data or rubrics.</li>
          <li><strong>Client-Side Processing:</strong> All file reading and request orchestration happens in your browser.</li>
          <li><strong>Direct Connection:</strong> Your browser connects directly to Google's API.</li>
        </ul>
      </div>

      <div className="actions">
        <button className="primary-btn big-btn" onClick={onNext}>Get Started</button>
      </div>

      <div className="faq-section">
        <h3>Freqently Asked Questions</h3>
        <details>
          <summary>Is my API key safe?</summary>
          <p>Yes. We use your browser's LocalStorage. The key is strictly used to authenticate requests to Google from <em>your</em> machine.</p>
        </details>
        <details>
          <summary>What models are supported?</summary>
          <p>We optimize for <strong>Gemini 2.5 Flash</strong> for speed and cost-efficiency.</p>
        </details>
        <details>
          <summary>Who is this for?</summary>
          <p>Teachers, TAs, and self-learners who want objective feedback on assignments based on specific rubrics.</p>
        </details>
      </div>
    </div>
  );
}

function ApiKeyStep({ onNext, apiKey, setApiKey }: { onNext: () => void, apiKey: string, setApiKey: (k: string) => void }) {
  const handleSave = () => {
    if (apiKey.trim().length > 10) {
      localStorage.setItem('easygrader_api_key', apiKey);
      onNext();
    } else {
      alert("Please enter a valid API Key.");
    }
  };

  return (
    <div className="wizard-step fade-in">
      <h2>Step 1: Connect Gemini</h2>
      <p>To use the grading engine, you need a Google Gemini API Key.</p>

      <div className="input-group">
        <label htmlFor="api-key">Enter your Gemini API Key</label>
        <input 
          type="password" 
          id="api-key" 
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIzaSy..."
        />
        <small>Key is saved to your browser's LocalStorage.</small>
      </div>

      <div className="info-box">
        <h4>How to get a key:</h4>
        <ol>
          <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.</li>
          <li>Log in with your Google account.</li>
          <li>Click <strong>Create API Key</strong>.</li>
          <li>Copy the key string and paste it above.</li>
        </ol>
        <p style={{fontSize: '0.9rem', marginTop: '0.5rem'}}><em>Note: The key is free for most use cases.</em></p>
      </div>

      <div className="actions">
        <button className="primary-btn" onClick={handleSave}>Save & Continue</button>
      </div>
    </div>
  );
}

function PolicyStep({ onNext, policy, setPolicy }: { onNext: () => void, policy: string, setPolicy: (p: string) => void }) {
  const applyTemplate = (type: 'writing' | 'coding' | 'math') => {
    setPolicy(TEMPLATES[type]);
  };

  const handleNext = () => {
    localStorage.setItem('easygrader_policy', policy);
    onNext();
  }

  return (
    <div className="wizard-step fade-in">
      <h2>Step 2: Customize Grading Policy</h2>
      <p>Tell the AI how to behave. Select a template or write your own rules.</p>

      <div className="template-buttons">
        <button className="outline-btn" onClick={() => applyTemplate('writing')}>📝 English/Writing</button>
        <button className="outline-btn" onClick={() => applyTemplate('coding')}>💻 Programming</button>
        <button className="outline-btn" onClick={() => applyTemplate('math')}>➗ Math/Logic</button>
      </div>

      <div className="input-group">
        <label htmlFor="policy-editor">Grading Logic & Tone</label>
        <textarea 
          id="policy-editor"
          className="policy-editor"
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
        />
      </div>

      <div className="actions">
        <button className="primary-btn" onClick={handleNext}>Save & Start Grading</button>
      </div>
    </div>
  );
}

function GraderView({ apiKey, policy, onBack }: { apiKey: string, policy: string, onBack: () => void }) {
  const [rubric, setRubric] = useState<File | null>(null);
  const [assignmentSpec, setAssignmentSpec] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<GradingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          if (file.type === 'application/pdf') {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            if (!arrayBuffer) return reject(new Error('Failed to read PDF file.'));
            
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let content = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              content += textContent.items.map((item: any) => item.str).join(' ');
              content += '\n\n';
            }
            resolve(content);
          } else { 
            const text = event.target?.result as string;
            if (file.name.endsWith('.ipynb')) {
              const notebook = JSON.parse(text);
              const content = notebook.cells
                .map((cell: any) => cell.source.join(''))
                .join('\n\n');
              resolve(content);
            } else {
              resolve(text);
            }
          }
        } catch (e) {
          reject(new Error(`Failed to parse file ${file.name}: ${(e as Error).message}`));
        }
      };
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}.`));

      if (file.type === 'application/pdf') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleGrade = async () => {
    if (!assignmentSpec || !rubric || files.length === 0) {
      setError('Please provide the original assignment, a rubric, and at least one student submission.');
      return;
    }
    setIsLoading(true);
    setIsDone(false);
    setError(null);
    setResults([]);
    setProgress(0);
    setStatusMessage(null);

    // Initialize AI client dynamically with user key
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const gradeFileWithRetry = async (
      file: File,
      rubricContent: string,
      assignmentSpecContent: string,
      maxRetries = 5
    ) => {
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          const assignmentContent = await readFileContent(file);
          const promptParts = [
            "You are an expert, impartial teaching assistant. Your task is to grade a student's work.",
            "### USER DEFINED GRADING POLICY & TONE ###",
            policy, // <--- INJECT CUSTOM POLICY HERE
            "\n### INSTRUCTIONS ###",
            "1. Reference the 'ORIGINAL ASSIGNMENT' for total points.",
            "2. Apply the 'GRADING RUBRIC' strictly.",
            "3. Output ONLY the specified JSON.",
            "4. Breakdowns should be specific (referencing exact errors).",
            "\n---",
            `### ORIGINAL ASSIGNMENT ###\n${assignmentSpecContent}`,
            "\n---",
            `### GRADING RUBRIC ###\n${rubricContent}`,
            "\n---",
            `### STUDENT SUBMISSION: "${file.name}" ###\n${assignmentContent}`,
            "\n---",
            "Grade the submission now."
          ];
          
          const fullPrompt = promptParts.join('\n');

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: responseSchema,
              systemInstruction: "You are a teaching assistant. Follow the user's grading policy and output valid JSON only.",
            }
          });

          const parsedResult = JSON.parse(response.text);
          return { status: 'success' as const, data: { filename: file.name, ...parsedResult } };

        } catch (e: any) {
          attempt++;
          const isRetryable = e.message && (e.message.includes('503') || e.message.includes('429'));
          
          if (isRetryable && attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            return {
              status: 'error' as const,
              filename: file.name,
              error: `Failed after ${attempt} attempts. Last error: ${e.message}`,
            };
          }
        }
      }
      return { status: 'error' as const, filename: file.name, error: `Failed after ${maxRetries} attempts.` };
    };

    try {
      const [rubricContent, assignmentSpecContent] = await Promise.all([
        readFileContent(rubric),
        readFileContent(assignmentSpec),
      ]);
      
      const allFailedFiles: GradingError[] = [];

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(file => gradeFileWithRetry(file, rubricContent, assignmentSpecContent));
        const gradedBatchResults = await Promise.all(batchPromises);

        const successfulGraded = gradedBatchResults
            .filter(r => r.status === 'success')
            .map(r => r.data as GradingResult);
        
        const failedGraded = gradedBatchResults
            .filter(r => r.status === 'error') as GradingError[];

        if (successfulGraded.length > 0) {
            setResults(prevResults => [...prevResults, ...successfulGraded]);
        }
        if (failedGraded.length > 0) {
            allFailedFiles.push(...failedGraded);
        }
        
        setProgress(prevProgress => prevProgress + batch.length);

        if (i + BATCH_SIZE < files.length) {
             // Simple delay logic
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
        }
      }

      if (allFailedFiles.length > 0) {
        const errorSummary = allFailedFiles.map(f => `- ${f.filename}: ${f.error}`).join('\n');
        setError(`Grading completed, but some files failed:\n${errorSummary}`);
      }
      
      setIsDone(true);

    } catch (e: any) {
        setError(`A critical error occurred: ${e.message || 'Unknown error.'}. Grading has been stopped.`);
    } finally {
        setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    const headers = ['filename', 'total_score', 'feedback_breakdown'];
    const csvContent = [
      headers.join(','),
      ...results.map(row => {
        const filename = `"${row.filename.replace(/"/g, '""')}"`;
        const score = `"${row.total_score.replace(/"/g, '""')}"`;
        const feedback = `"${(row.breakdown || []).map(item => item.feedback).join('; ').replace(/"/g, '""')}"`;
        return [filename, score, feedback].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'grading_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grader-container fade-in">
      <div className="header-row">
        <h2>Assignment Grading Studio</h2>
        <button className="secondary-btn" onClick={onBack}>⚙️ Settings</button>
      </div>

      <div className="upload-grid">
        <div className="input-section card">
          <label htmlFor="assignment-spec-file">1. Original Assignment</label>
          <input
            type="file"
            id="assignment-spec-file"
            onChange={(e) => e.target.files && setAssignmentSpec(e.target.files[0])}
            accept=".ipynb,.pdf,.txt,text/plain,application/pdf"
          />
          {assignmentSpec && <span className="file-tag">{assignmentSpec.name}</span>}
        </div>

        <div className="input-section card">
          <label htmlFor="rubric-file">2. Grading Rubric</label>
          <input
            type="file"
            id="rubric-file"
            onChange={(e) => e.target.files && setRubric(e.target.files[0])}
            accept=".ipynb,.pdf,.txt,text/plain,application/pdf"
          />
          {rubric && <span className="file-tag">{rubric.name}</span>}
        </div>

        <div className="input-section card full-width">
          <label htmlFor="files">3. Student Submissions</label>
          <input
            type="file"
            id="files"
            multiple
            onChange={(e) => e.target.files && setFiles(Array.from(e.target.files))}
            accept=".ipynb,.pdf,.txt,text/plain,application/pdf"
          />
          {files.length > 0 && (
            <div className="file-mini-list">
              {files.length} files selected
            </div>
          )}
        </div>
      </div>

      <div className="action-bar">
        <button 
          className="primary-btn big-btn"
          onClick={handleGrade} 
          disabled={isLoading || !assignmentSpec || !rubric || files.length === 0}
        >
          {isLoading ? `Grading ${progress} of ${files.length}...` : `Grade ${files.length} Assignment(s)`}
        </button>
      </div>

      {isLoading && <div className="loader"></div>}
      {statusMessage && <p className="status-message">{statusMessage}</p>}
      {error && <div className="error">{error}</div>}

      {isDone && results.length > 0 && (
        <div className="success-banner fade-in" style={{
          backgroundColor: '#e6f4ea', 
          color: '#137333', 
          padding: '1rem', 
          borderRadius: '8px', 
          textAlign: 'center',
          marginTop: '1rem'
        }}>
          🎉 Grading Complete! Review the results below or download the CSV.
        </div>
      )}

      {results.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h3>Results</h3>
            <button onClick={downloadCSV} className="outline-btn">Download CSV</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Score</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={index}>
                  <td>{result.filename}</td>
                  <td>{result.total_score}</td>
                  <td>
                    {result.breakdown && result.breakdown.length > 0 ? (
                      <ul className="feedback-breakdown">
                        {result.breakdown.map((item, i) => (
                          <li key={i}>{item.feedback}</li>
                        ))}
                      </ul>
                    ) : <span className="perfect-score">Perfect Score</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function App() {
  const [view, setView] = useState<'landing' | 'apiKey' | 'policy' | 'grader'>('landing');
  const [apiKey, setApiKey] = useState('');
  const [policy, setPolicy] = useState(DEFAULT_POLICY);

  useEffect(() => {
    const storedKey = localStorage.getItem('easygrader_api_key');
    const storedPolicy = localStorage.getItem('easygrader_policy');
    if (storedKey) setApiKey(storedKey);
    if (storedPolicy) setPolicy(storedPolicy);
  }, []);

  // Simple router logic
  switch (view) {
    case 'landing':
      return <LandingPage onNext={() => setView(apiKey ? 'policy' : 'apiKey')} />;
    case 'apiKey':
      return <ApiKeyStep apiKey={apiKey} setApiKey={setApiKey} onNext={() => setView('policy')} />;
    case 'policy':
      return <PolicyStep policy={policy} setPolicy={setPolicy} onNext={() => setView('grader')} />;
    case 'grader':
      return <GraderView apiKey={apiKey} policy={policy} onBack={() => setView('policy')} />;
    default:
      return <LandingPage onNext={() => setView('apiKey')} />;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);