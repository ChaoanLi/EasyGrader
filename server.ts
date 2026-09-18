import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured or is a placeholder. Please configure your API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const gradingResponseSchema = {
  type: Type.OBJECT,
  properties: {
    total_score: { 
      type: Type.STRING,
      description: 'The overall grade or score achieved (e.g., "92/100" or "A-").',
    },
    breakdown: {
      type: Type.ARRAY,
      description: 'List of specific feedback points detailing deductions, praises, or corrections.',
      items: {
        type: Type.OBJECT,
        properties: {
          feedback: { type: Type.STRING, description: 'Specific feedback message.' },
        },
        required: ['feedback'],
      },
    },
  },
  required: ['total_score', 'breakdown'],
};

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '25mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'PLACEHOLDER_API_KEY');
    res.json({
      status: 'ok',
      defaultEngine: 'deepseek-chat',
      hasBuiltinDeepSeek: hasDeepSeek,
      supportedEngines: ['deepseek', 'openai', 'anthropic', 'gemini'],
    });
  });

  async function gradeWithDeepSeek(options: {
    apiKey: string;
    model: string;
    systemInstruction: string;
    fullPrompt: string;
  }) {
    const isReasoner = options.model.includes('reasoner');
    const systemContent = `${options.systemInstruction}\n\nIMPORTANT: You must output a valid JSON object strictly matching this schema:\n{\n  "total_score": "string representing overall score (e.g. 92/100)",\n  "breakdown": [\n    {"feedback": "specific feedback comment"}\n  ]\n}\nOutput valid JSON only.`;

    const body: any = {
      model: options.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: options.fullPrompt },
      ],
    };

    if (!isReasoner) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('DeepSeek did not return a valid JSON response.');
    }
    return JSON.parse(jsonMatch[0]);
  }

  async function gradeWithOpenAI(options: {
    apiKey: string;
    model: string;
    systemInstruction: string;
    fullPrompt: string;
  }) {
    const isReasoningModel = options.model.startsWith('o1') || options.model.startsWith('o3');
    const systemContent = `${options.systemInstruction}\n\nIMPORTANT: You must output a valid JSON object strictly matching this schema:\n{\n  "total_score": "string representing overall score (e.g. 92/100)",\n  "breakdown": [\n    {"feedback": "specific feedback comment"}\n  ]\n}\nOutput valid JSON only.`;

    const messages = isReasoningModel
      ? [{ role: 'user', content: `${systemContent}\n\n${options.fullPrompt}` }]
      : [
          { role: 'system', content: systemContent },
          { role: 'user', content: options.fullPrompt },
        ];

    const body: any = {
      model: options.model || 'gpt-4o-mini',
      messages,
    };

    if (!isReasoningModel) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('ChatGPT/OpenAI did not return a valid JSON response.');
    }
    return JSON.parse(jsonMatch[0]);
  }

  async function gradeWithClaude(options: {
    apiKey: string;
    model: string;
    systemInstruction: string;
    fullPrompt: string;
  }) {
    const systemContent = `${options.systemInstruction}\n\nIMPORTANT: You must evaluate the student submission and output ONLY a valid JSON object strictly matching this schema:\n{\n  "total_score": "string representing overall score (e.g. 92/100)",\n  "breakdown": [\n    {"feedback": "specific feedback comment"}\n  ]\n}\nOutput valid raw JSON only. Do not include introductory text.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemContent,
        messages: [
          { role: 'user', content: options.fullPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude/Anthropic API (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    const content = data.content?.[0]?.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Claude did not return a valid JSON response.');
    }
    return JSON.parse(jsonMatch[0]);
  }

  // Grade single assignment submission
  app.post('/api/grade', async (req, res) => {
    try {
      const {
        filename,
        submissionContent,
        rubricContent,
        assignmentSpecContent,
        policy,
        provider,
        model = 'deepseek-chat',
        apiKey: clientApiKey,
      } = req.body;

      if (!filename || !submissionContent || !rubricContent || !assignmentSpecContent) {
        return res.status(400).json({
          error: 'Missing required fields: filename, submissionContent, rubricContent, assignmentSpecContent are required.',
        });
      }

      const promptParts = [
        "You are an expert, impartial teaching assistant and grading evaluator. Your task is to evaluate a student's submission.",
        "### EVALUATION POLICY & TONE ###",
        policy || "Evaluate conceptual understanding, correctness, and adherence to rubric specifications. Provide constructive feedback.",
        "\n### INSTRUCTIONS ###",
        "1. Reference the 'ORIGINAL ASSIGNMENT' for total points and assignment objectives.",
        "2. Apply the 'GRADING RUBRIC' strictly and objectively.",
        "3. Output ONLY the specified JSON matching the required schema.",
        "4. Feedback points should be specific, identifying exact areas of success, errors, or deductions with actionable suggestions.",
        "\n---",
        `### ORIGINAL ASSIGNMENT ###\n${assignmentSpecContent}`,
        "\n---",
        `### GRADING RUBRIC ###\n${rubricContent}`,
        "\n---",
        `### STUDENT SUBMISSION: "${filename}" ###\n${submissionContent}`,
        "\n---",
        "Grade the student submission now and output the structured JSON.",
      ];

      const fullPrompt = promptParts.join('\n');
      const modelStr = String(model || 'deepseek-chat').toLowerCase();
      const providerStr = String(provider || '').toLowerCase();

      const isClaude = providerStr === 'anthropic' || providerStr === 'claude' || modelStr.startsWith('claude');
      const isOpenAI = providerStr === 'openai' || providerStr === 'chatgpt' || modelStr.startsWith('gpt') || modelStr.startsWith('o1') || modelStr.startsWith('o3');
      const isGemini = providerStr === 'gemini' || modelStr.startsWith('gemini');
      const isDeepSeek = providerStr === 'deepseek' || modelStr.startsWith('deepseek') || (!isClaude && !isOpenAI && !isGemini);

      let parsedResult: any = null;

      if (isDeepSeek) {
        const deepseekKey = clientApiKey || process.env.DEEPSEEK_API_KEY;
        if (!deepseekKey) {
          return res.status(400).json({
            error: 'DeepSeek API key is not configured. Please set DEEPSEEK_API_KEY in your environment or enter your key in the AI Engine settings.',
          });
        }
        parsedResult = await gradeWithDeepSeek({
          apiKey: deepseekKey,
          model: model || 'deepseek-chat',
          systemInstruction: 'You are a professional teaching assistant and grading evaluator.',
          fullPrompt,
        });
      } else if (isOpenAI) {
        const openaiKey = clientApiKey || process.env.OPENAI_API_KEY;
        if (!openaiKey) {
          return res.status(400).json({
            error: 'OpenAI API key required. Please click "API Keys" and enter your OpenAI/ChatGPT API key.',
          });
        }
        parsedResult = await gradeWithOpenAI({
          apiKey: openaiKey,
          model: model || 'gpt-4o-mini',
          systemInstruction: 'You are a professional teaching assistant and grading evaluator.',
          fullPrompt,
        });
      } else if (isClaude) {
        const claudeKey = clientApiKey || process.env.ANTHROPIC_API_KEY;
        if (!claudeKey) {
          return res.status(400).json({
            error: 'Anthropic API key required. Please click "API Keys" and enter your Claude API key.',
          });
        }
        parsedResult = await gradeWithClaude({
          apiKey: claudeKey,
          model: model || 'claude-3-5-sonnet-20241022',
          systemInstruction: 'You are a professional teaching assistant and grading evaluator.',
          fullPrompt,
        });
      } else {
        const geminiKey = clientApiKey || process.env.GEMINI_API_KEY;
        if (!geminiKey || geminiKey === 'PLACEHOLDER_API_KEY') {
          return res.status(400).json({
            error: 'Gemini API key required. Please click "API Keys" and enter your Google Gemini API key.',
          });
        }
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const candidateModels = [model || 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
        let lastErr: any = null;

        for (const modelName of candidateModels) {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const response = await ai.models.generateContent({
                model: modelName,
                contents: fullPrompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: gradingResponseSchema,
                  systemInstruction: "You are a professional teaching assistant. Strictly follow the grading policy and output valid JSON conforming to the schema.",
                },
              });

              if (response.text) {
                parsedResult = JSON.parse(response.text);
                break;
              }
            } catch (err: any) {
              lastErr = err;
              const msg = String(err?.message || '');
              const isDemandOrRate = msg.includes('503') || msg.includes('429') || msg.includes('demand');
              if (isDemandOrRate) {
                await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
              } else {
                break;
              }
            }
          }
          if (parsedResult) break;
        }

        if (!parsedResult) {
          throw lastErr || new Error('Could not evaluate submission with Gemini after multiple attempts.');
        }
      }
      res.json({
        filename,
        total_score: parsedResult.total_score || 'N/A',
        breakdown: Array.isArray(parsedResult.breakdown) ? parsedResult.breakdown : [],
      });
    } catch (err: any) {
      console.error('Error during grading:', err);
      const errorMessage = err?.message || 'Grading evaluation encountered an unknown error.';
      res.status(500).json({
        error: errorMessage,
      });
    }
  });

  // Vite middleware for dev / static for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const template = await fs.promises.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
