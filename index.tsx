/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Bundle the worker from the installed PDF.js version to keep both in sync.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// --- CONSTANTS & TEMPLATES ---

const BATCH_SIZE = 3;
const DELAY_BETWEEN_BATCHES_MS = 800;

const TEMPLATES = {
  coding: `### GRADING PHILOSOPHY: Conceptual Understanding > Syntactic Perfection
- **Dataset Leniency:** Do NOT deduct points for different variable/file names if logic is sound.
- **Data Loading & Structures:** Award effort points if algorithm logic is visible.
- **Strict Deductions:** Deduct for conceptual errors (e.g., O(N^2) brute force when O(N) was required, improper data types).
- **Security & Best Practices:** Flag unhandled edge cases or memory leaks.

### FEEDBACK STYLE
- Be specific: Identify exact lines or function logic.
- Be neutral, respectful, and educational.
- Provide a concrete fix or suggestion for every deduction.`,

  writing: `### GRADING PHILOSOPHY: Argument & Evidence > Minor Grammar
- **Thesis:** The thesis statement must be explicit, defensible, and articulated early.
- **Evidence:** Deduct points if claims lack textual/empirical support or citations.
- **Structure:** Paragraphs must feature strong topic sentences and logical flow.
- **Grammar & Voice:** Overlook minor typographic slips unless clarity is compromised.

### FEEDBACK STYLE
- Tone: Constructive Editorial Mentor.
- Format: "Paragraph 2 lacks evidence for claim X -> Fix: Introduce quotation or data source."`,

  math: `### GRADING PHILOSOPHY: Logical Derivation > Pure Arithmetic
- **Proof & Step Logic:** Award the majority of points for correct proof structures, lemmas, and derivations.
- **Arithmetic:** Minor computational errors should receive only small deductions (-0.5 to -1 pt) if logic is solid.
- **Notation:** Mathematical rigor and symbols must be applied accurately.
- **Show Your Work:** Full derivation is mandatory.

### FEEDBACK STYLE
- Pinpoint the exact step where mathematical reasoning faltered.
- Clearly distinguish between "Arithmetic Slip" and "Logical Fallacy".`,

  science: `### GRADING PHILOSOPHY: Scientific Method & Controlled Variables
- **Hypothesis:** Must be testable with defined independent and dependent variables.
- **Data Interpretation:** Graphs, error bars, and statistical conclusions must match the data.
- **Error Analysis:** Deduct if sources of experimental uncertainty are ignored.

### FEEDBACK STYLE
- Point out missing controls or overgeneralized conclusions.
- Highlight strengths in experimental design.`
};

const DEFAULT_POLICY = TEMPLATES.coding;

// --- TYPES ---

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

interface SubmissionItem {
  id: string;
  name: string;
  content: string;
}

// Sample assignment datasets for instant testing
const SAMPLE_DATASETS = {
  coding: {
    name: 'Python Data Structures & Search Assignment',
    spec: `# CS 102: Assignment 3 - Binary Search & Dictionary Indexing
Total Points: 100

Objectives:
1. Implement a function \`build_index(words)\` that builds a frequency dictionary (20 pts).
2. Implement \`binary_search(arr, target)\` returning the index of target in sorted array, or -1 if not found (40 pts).
3. Handle empty lists and single-element edge cases correctly (20 pts).
4. Time complexity analysis in docstring (20 pts).`,
    rubric: `### Grading Rubric (100 Points Total)
- build_index correctness: 20 pts (all words indexed, correct counts)
- binary_search algorithm: 40 pts (correct midpoint calculation, log N time, correct indices)
  - Deduct 15 pts if linear search is used instead of binary search.
  - Deduct 10 pts if off-by-one error causes infinite loop.
- Edge Case Handling: 20 pts (empty list returns -1, single element works)
- Complexity Documentation: 20 pts (O(log N) stated and justified)`,
    submissions: [
      {
        id: 'sub-1',
        name: 'student_alice_hw3.py',
        content: `def build_index(words):
    idx = {}
    for w in words:
        idx[w] = idx.get(w, 0) + 1
    return idx

def binary_search(arr, target):
    """
    Performs binary search in O(log N) time.
    arr: sorted list of comparable elements
    target: item to find
    """
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1`
      },
      {
        id: 'sub-2',
        name: 'student_bob_hw3.py',
        content: `def build_index(words):
    return {w: words.count(w) for w in set(words)}

def binary_search(arr, target):
    # Search implementation
    # Time: O(N)
    for i in range(len(arr)):
        if arr[i] == target:
            return i
    return -1`
      },
      {
        id: 'sub-3',
        name: 'student_charlie_hw3.py',
        content: `def build_index(words):
    d = {}
    for w in words:
        d[w] = 1 # Forgot to increment frequency
    return d

def binary_search(arr, target):
    low = 0
    high = len(arr)
    # Bug: low < high causes missing element when low == high
    while low < high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid
        else:
            high = mid
    return -1`
      }
    ]
  },
  writing: {
    name: 'Literature Essay on The Great Gatsby',
    spec: `# ENG 201: Critical Analysis Essay
Assignment: Analyze the symbolism of the Green Light at the end of Daisy's dock in F. Scott Fitzgerald's The Great Gatsby.
Word Count: 600 - 800 words.
Total Points: 100
Key Requirements:
- Clear, arguable thesis statement in introduction (25 pts).
- Two specific quotes or textual references with contextual analysis (35 pts).
- Coherent paragraph transitions and logical flow (25 pts).
- Tone, grammar, and MLA formatting (15 pts).`,
    rubric: `### Rubric (100 Points Total)
- Thesis (25 pts): Must interpret the green light beyond literal geography (e.g., American Dream, unattainable past).
- Evidence & Analysis (35 pts): Minimum two direct citations with in-depth close reading. Deduct 15 pts if summary replaces analysis.
- Structure & Logic (25 pts): Topic sentences for every paragraph, smooth transitions.
- Mechanics (15 pts): Formal academic voice, proper citation style.`,
    submissions: [
      {
        id: 'sub-1',
        name: 'davis_essay_gatsby.txt',
        content: `Title: The Distant Beacon: Gatsby's Green Light and the Illusion of the American Dream

In F. Scott Fitzgerald's The Great Gatsby, the green light at the end of Daisy Buchanan's dock is not merely an optical marker across the bay, but an elusive emblem of Gatsby's longing and the ultimate bankruptcy of the American Dream. Fitzgerald uses this luminous symbol to illustrate how desire flourishes in anticipation, yet inevitably dissolves when confronted by harsh temporal reality.

From Nick Carraway's initial glimpse of Gatsby reaching out toward "a single green light, minute and far away," the light represents unattainable ambition. Gatsby conflates the green light with Daisy herself, investing physical proximity with metaphysical salvation. As Nick remarks, Gatsby had "stretched out his arms toward the dark water in a curious way," emphasizing a bodily yearning across class and chronological divides.

Furthermore, when Gatsby finally reunites with Daisy, Nick observes that "the colossal significance of that light had now vanished forever." By bringing the idealized fantasy into the present, the symbol is diminished. In conclusion, the green light exposes the tragic impossibility of recapturing the past, standing as Fitzgerald's enduring critique of 1920s materialism.`
      },
      {
        id: 'sub-2',
        name: 'taylor_essay_gatsby.txt',
        content: `The Great Gatsby is a book about Jay Gatsby who loves Daisy. He lives in a big mansion in West Egg and has lavish parties every weekend. 

At the end of Daisy's dock there is a green light. Gatsby looks at it every night because he wants to see Daisy. It means he is in love and hopes they will be together again. He has lots of shirts and nice cars. 

Daisy is married to Tom Buchanan who is very wealthy and mean. In the end Gatsby dies in his pool. The book shows that having lots of money does not make you happy. The green light was nice but it did not help him get Daisy back.`
      }
    ]
  }
};

// --- HELPER FUNCTIONS ---

const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          if (!arrayBuffer) return reject(new Error('Could not read PDF data.'));

          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
            text += `[Page ${i}]\n` + pageText + '\n\n';
          }
          resolve(text.trim() || 'No readable text extracted from PDF.');
        } else {
          const text = event.target?.result as string;
          if (file.name.toLowerCase().endsWith('.ipynb')) {
            try {
              const notebook = JSON.parse(text);
              const cells = (notebook.cells || []).map((cell: any) => {
                const cellType = cell.cell_type === 'code' ? '[Code]' : '[Markdown]';
                const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
                return `${cellType}\n${source}`;
              });
              resolve(cells.join('\n\n'));
            } catch {
              resolve(text);
            }
          } else {
            resolve(text);
          }
        }
      } catch (e: any) {
        reject(new Error(`Failed to parse file "${file.name}": ${e.message}`));
      }
    };
    reader.onerror = () => reject(new Error(`Could not open "${file.name}".`));

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
};

// --- APPLICATION VIEWS ---

function LandingPage({ onStart, onOpenPolicy }: { onStart: () => void; onOpenPolicy: () => void }) {
  return (
    <div className="wizard-step fade-in">
      <header className="hero">
        <h1>EasyGrader Studio</h1>
        <p className="subtitle">Objective, transparent, and explainable homework and assignment grading</p>
      </header>

      <div className="value-props">
        <div className="card">
          <h3>Instant Batch Grading</h3>
          <p>Grade multiple student submissions in parallel with deep reasoning and rubric alignment.</p>
        </div>
        <div className="card">
          <h3>Multi-Format Support</h3>
          <p>Seamlessly accepts PDFs, Jupyter Notebooks (.ipynb), Python (.py), and plain text or Markdown files.</p>
        </div>
        <div className="card">
          <h3>Explainable Rubrics</h3>
          <p>Define custom philosophy, penalty thresholds, and feedback tones tailored to your classroom.</p>
        </div>
      </div>

      <div className="privacy-notice">
        <h4>Server-Side AI Evaluation</h4>
        <ul>
          <li><strong>Zero Client Token Exposure:</strong> API communication is safely managed through server endpoints.</li>
          <li><strong>Structured Explainability:</strong> Every deduction produces specific, actionable feedback for the student.</li>
          <li><strong>CSV Export Ready:</strong> Download classroom gradebooks directly in standard spreadsheet formats.</li>
        </ul>
      </div>

      <div className="actions" style={{ gap: '1rem' }}>
        <button id="get-started-btn" className="primary-btn big-btn" onClick={onStart}>
          Open Grading Studio
        </button>
        <button id="customize-policy-btn" className="secondary-btn" style={{ padding: '0.75rem 1.5rem', fontSize: '1.05rem' }} onClick={onOpenPolicy}>
          Customize Rubric Policy
        </button>
      </div>

      <div className="faq-section">
        <h3>Frequently Asked Questions</h3>
        <details>
          <summary>How does EasyGrader handle partial credit?</summary>
          <p>EasyGrader strictly reads your assignment specification and rubric. You can define in your policy whether conceptual effort takes precedence over minor syntax or calculation errors.</p>
        </details>
        <details>
          <summary>Can I export the grades for my LMS?</summary>
          <p>Yes. Once grading completes, you can download a consolidated CSV file containing student filenames, total scores, and feedback remarks.</p>
        </details>
        <details>
          <summary>What file types can students submit?</summary>
          <p>PDF documents, Jupyter Notebooks (.ipynb), Python code files (.py), text files (.txt), and Markdown (.md).</p>
        </details>
      </div>
    </div>
  );
}

function PolicyStep({ policy, setPolicy, onBack, onStart }: { policy: string; setPolicy: (p: string) => void; onBack: () => void; onStart: () => void }) {
  const applyTemplate = (type: keyof typeof TEMPLATES) => {
    setPolicy(TEMPLATES[type]);
  };

  const handleSave = () => {
    localStorage.setItem('easygrader_policy', policy);
    onStart();
  };

  return (
    <div className="wizard-step fade-in">
      <div className="header-row">
        <h2>Grading Policy & Feedback Style</h2>
        <button className="secondary-btn" onClick={onBack}>← Back to Home</button>
      </div>
      <p style={{ color: '#5f6368', marginBottom: '1.5rem' }}>
        Choose a preset philosophy or customize your guidelines. The AI applies these criteria when calculating deductions and drafting student comments.
      </p>

      <div className="template-buttons">
        <button id="template-coding-btn" className="outline-btn" onClick={() => applyTemplate('coding')}>Programming & Algorithms</button>
        <button id="template-writing-btn" className="outline-btn" onClick={() => applyTemplate('writing')}>Writing & Humanities</button>
        <button id="template-math-btn" className="outline-btn" onClick={() => applyTemplate('math')}>Math & Proofs</button>
        <button id="template-science-btn" className="outline-btn" onClick={() => applyTemplate('science')}>Scientific Method</button>
      </div>

      <div className="input-group">
        <label htmlFor="policy-editor" style={{ fontWeight: 600 }}>Policy Instructions for AI Evaluator</label>
        <textarea
          id="policy-editor"
          className="policy-editor"
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
          placeholder="Enter grading rules and feedback criteria..."
        />
      </div>

      <div className="actions" style={{ justifyContent: 'flex-end', gap: '1rem' }}>
        <button className="secondary-btn" onClick={() => setPolicy(DEFAULT_POLICY)}>Reset to Default</button>
        <button id="save-policy-btn" className="primary-btn" onClick={handleSave}>Save & Continue to Grader</button>
      </div>
    </div>
  );
}

function GraderView({ policy, onOpenPolicy, onBackHome }: { policy: string; onOpenPolicy: () => void; onBackHome: () => void }) {
  const [specTitle, setSpecTitle] = useState('');
  const [specContent, setSpecContent] = useState('');
  const [rubricTitle, setRubricTitle] = useState('');
  const [rubricContent, setRubricContent] = useState('');
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);

  const [results, setResults] = useState<GradingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const [hasBuiltinDeepSeek, setHasBuiltinDeepSeek] = useState<boolean>(true);

  const [selectedEngine, setSelectedEngine] = useState<string>(() => localStorage.getItem('easygrader_engine') || 'deepseek-chat');

  const [customKeys, setCustomKeys] = useState<{
    deepseek: string;
    openai: string;
    anthropic: string;
    gemini: string;
  }>({
    deepseek: localStorage.getItem('easygrader_deepseek_key') || '',
    openai: localStorage.getItem('easygrader_openai_key') || '',
    anthropic: localStorage.getItem('easygrader_anthropic_key') || '',
    gemini: localStorage.getItem('easygrader_gemini_key') || '',
  });

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  useEffect(() => {
    // Check backend health & configured providers
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.hasBuiltinDeepSeek === 'boolean') {
          setHasBuiltinDeepSeek(data.hasBuiltinDeepSeek);
        }
      })
      .catch(() => {
        // Fallback default state
      });
  }, []);

  const handleEngineChange = (engine: string) => {
    setSelectedEngine(engine);
    localStorage.setItem('easygrader_engine', engine);

    // If user switches to a non-DeepSeek model without a key, auto open the key modal
    const isOAI = engine.startsWith('gpt') || engine.startsWith('o1') || engine.startsWith('o3');
    const isAnt = engine.startsWith('claude');
    const isGem = engine.startsWith('gemini');

    if (isOAI && !customKeys.openai) {
      setIsKeyModalOpen(true);
    } else if (isAnt && !customKeys.anthropic) {
      setIsKeyModalOpen(true);
    } else if (isGem && !customKeys.gemini) {
      setIsKeyModalOpen(true);
    }
  };

  const handleKeyUpdate = (providerKey: 'deepseek' | 'openai' | 'anthropic' | 'gemini', val: string) => {
    setCustomKeys((prev) => {
      const next = { ...prev, [providerKey]: val };
      localStorage.setItem(`easygrader_${providerKey}_key`, val);
      return next;
    });
  };

  // Handle load pre-configured samples for 1-click test
  const loadSample = (type: 'coding' | 'writing') => {
    const sample = SAMPLE_DATASETS[type];
    setSpecTitle(sample.name);
    setSpecContent(sample.spec);
    setRubricTitle(`${type.toUpperCase()} Rubric`);
    setRubricContent(sample.rubric);
    setSubmissions(sample.submissions);
    setResults([]);
    setError(null);
    setIsDone(false);
    setStatusMessage(`Loaded "${sample.name}" with ${sample.submissions.length} sample submissions.`);
  };

  const handleSpecUpload = async (file: File) => {
    try {
      setSpecTitle(file.name);
      setStatusMessage(`Reading assignment spec: ${file.name}...`);
      const content = await readFileContent(file);
      setSpecContent(content);
      setStatusMessage(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRubricUpload = async (file: File) => {
    try {
      setRubricTitle(file.name);
      setStatusMessage(`Reading rubric: ${file.name}...`);
      const content = await readFileContent(file);
      setRubricContent(content);
      setStatusMessage(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmissionsUpload = async (fileList: FileList) => {
    const files = Array.from(fileList);
    setStatusMessage(`Reading ${files.length} submission(s)...`);
    const newItems: SubmissionItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const text = await readFileContent(f);
        newItems.push({
          id: `sub-${Date.now()}-${i}`,
          name: f.name,
          content: text,
        });
      } catch (e: any) {
        console.error(`Error reading ${f.name}:`, e);
      }
    }

    setSubmissions((prev) => [...prev, ...newItems]);
    setStatusMessage(null);
  };

  const removeSubmission = (id: string) => {
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleGrade = async () => {
    if (!specContent.trim()) {
      setError('Please provide the original assignment specification.');
      return;
    }
    if (!rubricContent.trim()) {
      setError('Please provide the grading rubric.');
      return;
    }
    if (submissions.length === 0) {
      setError('Please upload at least one student submission.');
      return;
    }

    setIsLoading(true);
    setIsDone(false);
    setError(null);
    setResults([]);
    setProgress(0);
    setStatusMessage('Starting assignment evaluation...');

    const allFailedFiles: GradingError[] = [];
    const collectedResults: GradingResult[] = [];

    // Helper to evaluate a single submission via server API
    const gradeSingleItem = async (sub: SubmissionItem, maxRetries = 2): Promise<GradingResult | GradingError> => {
      let attempt = 0;
      let provider = 'deepseek';
      let activeKey: string | undefined = undefined;

      if (selectedEngine.startsWith('deepseek')) {
        provider = 'deepseek';
        activeKey = customKeys.deepseek;
      } else if (selectedEngine.startsWith('gpt') || selectedEngine.startsWith('o1') || selectedEngine.startsWith('o3')) {
        provider = 'openai';
        activeKey = customKeys.openai;
      } else if (selectedEngine.startsWith('claude')) {
        provider = 'anthropic';
        activeKey = customKeys.anthropic;
      } else if (selectedEngine.startsWith('gemini')) {
        provider = 'gemini';
        activeKey = customKeys.gemini;
      }

      // Check if required BYOK key is missing
      if (provider !== 'deepseek' && !activeKey) {
        setIsKeyModalOpen(true);
        const name = provider === 'openai' ? 'OpenAI / ChatGPT' : provider === 'anthropic' ? 'Anthropic Claude' : 'Google Gemini';
        return {
          status: 'error',
          filename: sub.name,
          error: `${name} requires an API key. Please enter your API key in the settings window to evaluate this submission.`,
        };
      }

      while (attempt <= maxRetries) {
        try {
          const resp = await fetch('/api/grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: sub.name,
              submissionContent: sub.content,
              rubricContent,
              assignmentSpecContent: specContent,
              policy,
              provider,
              model: selectedEngine,
              apiKey: activeKey ? activeKey.trim() : undefined,
            }),
          });

          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || `Server returned error status ${resp.status}`);
          }

          const data = await resp.json();
          return {
            filename: data.filename || sub.name,
            total_score: data.total_score || 'N/A',
            breakdown: Array.isArray(data.breakdown) ? data.breakdown : [],
          };
        } catch (e: any) {
          attempt++;
          if (attempt <= maxRetries) {
            await new Promise((r) => setTimeout(r, 1200 * attempt));
          } else {
            return {
              status: 'error',
              filename: sub.name,
              error: e.message || 'Evaluation request failed',
            };
          }
        }
      }
      return {
        status: 'error',
        filename: sub.name,
        error: 'Max retries exceeded.',
      };
    };

    try {
      for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
        const batch = submissions.slice(i, i + BATCH_SIZE);
        setStatusMessage(`Grading files ${i + 1} to ${Math.min(i + BATCH_SIZE, submissions.length)} of ${submissions.length}...`);

        const batchPromises = batch.map((sub) => gradeSingleItem(sub));
        const batchResults = await Promise.all(batchPromises);

        for (const res of batchResults) {
          if ('status' in res && res.status === 'error') {
            allFailedFiles.push(res);
          } else {
            const success = res as GradingResult;
            collectedResults.push(success);
            setResults([...collectedResults]);
          }
        }

        setProgress(Math.min(i + batch.length, submissions.length));

        if (i + BATCH_SIZE < submissions.length) {
          await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
        }
      }

      if (allFailedFiles.length > 0) {
        const summary = allFailedFiles.map((f) => `• ${f.filename}: ${f.error}`).join('\n');
        setError(`Evaluation completed with issues:\n${summary}`);
      }

      setIsDone(true);
      setStatusMessage(null);
    } catch (e: any) {
      setError(`An unexpected error occurred during grading: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    if (results.length === 0) return;
    const headers = ['Filename', 'Total Score', 'Feedback Comments'];
    const rows = results.map((row) => {
      const fn = `"${row.filename.replace(/"/g, '""')}"`;
      const score = `"${row.total_score.replace(/"/g, '""')}"`;
      const comments = `"${(row.breakdown || []).map((b) => b.feedback).join(' | ').replace(/"/g, '""')}"`;
      return [fn, score, comments].join(',');
    });

    const csvData = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `easygrader_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grader-container fade-in">
      <div className="header-row">
        <div>
          <h2>Assignment Grading Studio</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#5f6368' }}>
            Built-in DeepSeek engine (Ready to use) • Bring your own API key for ChatGPT, Claude, or Gemini
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary-btn" onClick={() => setIsKeyModalOpen(true)}>API Keys</button>
          <button className="secondary-btn" onClick={onOpenPolicy}>Policy</button>
          <button className="secondary-btn" onClick={onBackHome}>Home</button>
        </div>
      </div>

      {/* AI Model & Engine Selector */}
      <div style={{ background: '#ffffff', border: '1px solid #dadce0', padding: '1rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span style={{ fontWeight: 600, color: '#202124', fontSize: '0.95rem' }}>AI Grading Engine:</span>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#5f6368' }}>
              DeepSeek is built-in and free to use • Or bring your own key for ChatGPT / Claude / Gemini
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={selectedEngine}
              onChange={(e) => handleEngineChange(e.target.value)}
              style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '0.9rem', background: '#fff', fontWeight: 500, color: '#3c4043', cursor: 'pointer' }}
            >
              <optgroup label="DeepSeek (Built-in • Ready)">
                <option value="deepseek-chat">DeepSeek-V3 (Built-in • Fast & Structured)</option>
                <option value="deepseek-reasoner">DeepSeek-R1 (Built-in • Deep Reasoning & Logic)</option>
              </optgroup>
              <optgroup label="OpenAI / ChatGPT (Bring Your Own Key)">
                <option value="gpt-4o-mini">GPT-4o Mini (API Key Required)</option>
                <option value="gpt-4o">GPT-4o (API Key Required)</option>
                <option value="o3-mini">o3-mini Reasoning (API Key Required)</option>
              </optgroup>
              <optgroup label="Anthropic Claude (Bring Your Own Key)">
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (API Key Required)</option>
                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (API Key Required)</option>
              </optgroup>
              <optgroup label="Google Gemini (Bring Your Own Key)">
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (API Key Required)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (API Key Required)</option>
              </optgroup>
            </select>

            {/* Status indicator tag */}
            {(() => {
              const isDS = selectedEngine.startsWith('deepseek');
              const isOAI = selectedEngine.startsWith('gpt') || selectedEngine.startsWith('o1') || selectedEngine.startsWith('o3');
              const isAnt = selectedEngine.startsWith('claude');
              const isGem = selectedEngine.startsWith('gemini');

              if (isDS) {
                return (
                  <span style={{ fontSize: '0.8rem', background: '#e6f4ea', color: '#137333', padding: '0.28rem 0.65rem', borderRadius: '12px', fontWeight: 600 }}>
                    Built-in Ready
                  </span>
                );
              }

              const hasCustom = isOAI ? customKeys.openai : isAnt ? customKeys.anthropic : customKeys.gemini;
              if (hasCustom) {
                return (
                  <button
                    type="button"
                    className="outline-btn"
                    style={{ fontSize: '0.8rem', padding: '0.28rem 0.65rem', color: '#1a73e8', borderColor: '#8ab4f8' }}
                    onClick={() => setIsKeyModalOpen(true)}
                  >
                    Personal Key Configured
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  className="outline-btn"
                  style={{ fontSize: '0.8rem', padding: '0.28rem 0.65rem', color: '#d93025', borderColor: '#f28b82', background: '#fce8e6' }}
                  onClick={() => setIsKeyModalOpen(true)}
                >
                  Enter API Key
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {/* API Key Configuration Modal */}
      {isKeyModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            maxWidth: '580px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#202124' }}>AI Model & API Key Configuration</h3>
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#5f6368' }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#5f6368', marginTop: 0, marginBottom: '1.25rem', lineHeight: '1.5' }}>
              EasyGrader comes pre-configured with <strong>built-in DeepSeek API access</strong> for instant, zero-setup grading. You can also bring your own keys for <strong>ChatGPT</strong>, <strong>Claude</strong>, or <strong>Gemini</strong>. All personal keys are stored <strong>strictly inside your local browser</strong> and are never saved to our database.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* DeepSeek (Built-in) */}
              <div style={{ background: '#f6fbf7', border: '1px solid #ceead6', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0d652d' }}>
                    DeepSeek-V3 / R1 (Built-in Default Engine)
                  </label>
                  <span style={{ fontSize: '0.78rem', background: '#34a853', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 600 }}>
                    Built-in Ready
                  </span>
                </div>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#3c4043' }}>
                  Pre-configured on the server. Ready for instant use with DeepSeek-V3 and DeepSeek-R1 reasoning models.
                </p>
                <input
                  type="password"
                  placeholder="(Optional) Enter your personal DeepSeek API key to override default quota"
                  value={customKeys.deepseek}
                  onChange={(e) => handleKeyUpdate('deepseek', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '0.85rem', background: '#fff' }}
                />
              </div>

              {/* OpenAI / ChatGPT */}
              <div style={{ border: '1px solid #dadce0', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#202124' }}>
                    OpenAI / ChatGPT (Bring Your Own Key)
                  </label>
                  {customKeys.openai ? (
                    <span style={{ fontSize: '0.78rem', color: '#137333', fontWeight: 600 }}>Saved</span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#70757a' }}>Not configured</span>
                  )}
                </div>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#5f6368' }}>
                  Supports GPT-4o Mini, GPT-4o, and o3-mini reasoning models. Enter your OpenAI API key:
                </p>
                <input
                  type="password"
                  placeholder="sk-proj-..."
                  value={customKeys.openai}
                  onChange={(e) => handleKeyUpdate('openai', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '0.85rem' }}
                />
              </div>

              {/* Anthropic Claude */}
              <div style={{ border: '1px solid #dadce0', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#202124' }}>
                    Anthropic Claude (Bring Your Own Key)
                  </label>
                  {customKeys.anthropic ? (
                    <span style={{ fontSize: '0.78rem', color: '#137333', fontWeight: 600 }}>Saved</span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#70757a' }}>Not configured</span>
                  )}
                </div>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#5f6368' }}>
                  Supports Claude 3.5 Sonnet and Claude 3.5 Haiku. Enter your Anthropic API key:
                </p>
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={customKeys.anthropic}
                  onChange={(e) => handleKeyUpdate('anthropic', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '0.85rem' }}
                />
              </div>

              {/* Google Gemini */}
              <div style={{ border: '1px solid #dadce0', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#202124' }}>
                    Google Gemini (Bring Your Own Key)
                  </label>
                  {customKeys.gemini ? (
                    <span style={{ fontSize: '0.78rem', color: '#137333', fontWeight: 600 }}>Saved</span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#70757a' }}>Not configured</span>
                  )}
                </div>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#5f6368' }}>
                  Supports Gemini 3.8 Flash and Gemini 2.5 Flash. Enter your Google Gemini API key:
                </p>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={customKeys.gemini}
                  onChange={(e) => handleKeyUpdate('gemini', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#5f6368' }}>
                All custom keys are stored in your local browser only.
              </span>
              <button
                type="button"
                className="primary-btn"
                onClick={() => setIsKeyModalOpen(false)}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Save and Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset sample loaders */}
      <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', padding: '0.85rem 1.25rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#3c4043' }}>
          Quick Demo: Load sample assignment package
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button id="load-sample-coding" className="outline-btn" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }} onClick={() => loadSample('coding')}>
            Load Python Coding Sample
          </button>
          <button id="load-sample-writing" className="outline-btn" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }} onClick={() => loadSample('writing')}>
            Load Essay Writing Sample
          </button>
        </div>
      </div>

      <div className="upload-grid">
        {/* Assignment Spec Card */}
        <div className="input-section card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="spec-upload" style={{ fontWeight: 600, color: '#202124' }}>1. Original Assignment</label>
            {specTitle && <span className="file-tag">{specTitle}</span>}
          </div>
          <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.85rem', color: '#5f6368' }}>
            Upload assignment guidelines or rubric objectives (.pdf, .ipynb, .py, .txt).
          </p>
          <input
            id="spec-upload"
            type="file"
            accept=".pdf,.ipynb,.py,.txt,.md,text/plain,application/pdf"
            onChange={(e) => e.target.files && e.target.files[0] && handleSpecUpload(e.target.files[0])}
          />
          {specContent && (
            <div style={{ marginTop: '0.5rem', maxHeight: '70px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem', color: '#5f6368', background: '#f8f9fa', padding: '0.5rem', borderRadius: '4px' }}>
              {specContent.slice(0, 200)}...
            </div>
          )}
        </div>

        {/* Rubric Card */}
        <div className="input-section card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="rubric-upload" style={{ fontWeight: 600, color: '#202124' }}>2. Grading Rubric</label>
            {rubricTitle && <span className="file-tag">{rubricTitle}</span>}
          </div>
          <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.85rem', color: '#5f6368' }}>
            Criteria, point distributions, and penalty structures (.pdf, .txt, .md).
          </p>
          <input
            id="rubric-upload"
            type="file"
            accept=".pdf,.ipynb,.py,.txt,.md,text/plain,application/pdf"
            onChange={(e) => e.target.files && e.target.files[0] && handleRubricUpload(e.target.files[0])}
          />
          {rubricContent && (
            <div style={{ marginTop: '0.5rem', maxHeight: '70px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem', color: '#5f6368', background: '#f8f9fa', padding: '0.5rem', borderRadius: '4px' }}>
              {rubricContent.slice(0, 200)}...
            </div>
          )}
        </div>

        {/* Student Submissions Card */}
        <div className="input-section card full-width">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="submissions-upload" style={{ fontWeight: 600, color: '#202124' }}>
              3. Student Submissions ({submissions.length} file{submissions.length === 1 ? '' : 's'})
            </label>
            {submissions.length > 0 && (
              <button
                className="secondary-btn"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}
                onClick={() => setSubmissions([])}
              >
                Clear All
              </button>
            )}
          </div>
          <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.85rem', color: '#5f6368' }}>
            Select one or multiple student files (.pdf, .ipynb, .py, .txt, .md).
          </p>
          <input
            id="submissions-upload"
            type="file"
            multiple
            accept=".pdf,.ipynb,.py,.txt,.md,text/plain,application/pdf"
            onChange={(e) => e.target.files && handleSubmissionsUpload(e.target.files)}
          />

          {submissions.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '120px', overflowY: 'auto' }}>
              {submissions.map((sub) => (
                <span
                  key={sub.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: '#e8f0fe',
                    color: '#1a73e8',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                  }}
                >
                  {sub.name}
                  <button
                    onClick={() => removeSubmission(sub.id)}
                    style={{ background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}
                    title="Remove file"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="action-bar">
        <button
          id="grade-btn"
          className="primary-btn big-btn"
          onClick={handleGrade}
          disabled={isLoading || !specContent || !rubricContent || submissions.length === 0}
        >
          {isLoading ? `Grading ${progress} of ${submissions.length}...` : `Grade ${submissions.length} Assignment(s)`}
        </button>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <div className="loader"></div>
          <p className="status-message">{statusMessage || 'Analyzing submissions against rubric...'}</p>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {isDone && results.length > 0 && (
        <div
          className="success-banner fade-in"
          style={{
            backgroundColor: '#e6f4ea',
            color: '#137333',
            padding: '1rem',
            borderRadius: '8px',
            textAlign: 'center',
            marginTop: '1.5rem',
            fontWeight: 500,
          }}
        >
          Grading complete! Successfully evaluated {results.length} submission{results.length === 1 ? '' : 's'}. Review scores below or export to CSV.
        </div>
      )}

      {results.length > 0 && (
        <div className="results-section fade-in">
          <div className="results-header">
            <div>
              <h3 style={{ margin: 0 }}>Grading Results & Explanations</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#5f6368' }}>
                {results.length} submission{results.length === 1 ? '' : 's'} graded
              </p>
            </div>
            <button id="download-csv-btn" onClick={downloadCSV} className="outline-btn">
              Download CSV
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Student Submission</th>
                <th style={{ width: '15%' }}>Score</th>
                <th style={{ width: '60%' }}>Detailed Feedback & Deductions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res, index) => (
                <tr key={index}>
                  <td style={{ fontWeight: 600, color: '#202124' }}>
                    {res.filename}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: '#e8f0fe',
                        color: '#1a73e8',
                      }}
                    >
                      {res.total_score}
                    </span>
                  </td>
                  <td>
                    {res.breakdown && res.breakdown.length > 0 ? (
                      <ul className="feedback-breakdown">
                        {res.breakdown.map((item, i) => (
                          <li key={i}>{item.feedback}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="perfect-score">Full marks awarded according to rubric.</span>
                    )}
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
  const [view, setView] = useState<'landing' | 'policy' | 'grader'>('landing');
  const [policy, setPolicy] = useState(DEFAULT_POLICY);

  useEffect(() => {
    const storedPolicy = localStorage.getItem('easygrader_policy');
    if (storedPolicy) setPolicy(storedPolicy);
  }, []);

  switch (view) {
    case 'landing':
      return (
        <LandingPage
          onStart={() => setView('grader')}
          onOpenPolicy={() => setView('policy')}
        />
      );
    case 'policy':
      return (
        <PolicyStep
          policy={policy}
          setPolicy={setPolicy}
          onBack={() => setView('landing')}
          onStart={() => setView('grader')}
        />
      );
    case 'grader':
      return (
        <GraderView
          policy={policy}
          onOpenPolicy={() => setView('policy')}
          onBackHome={() => setView('landing')}
        />
      );
    default:
      return (
        <LandingPage
          onStart={() => setView('grader')}
          onOpenPolicy={() => setView('policy')}
        />
      );
  }
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
