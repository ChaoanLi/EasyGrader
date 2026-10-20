# EasyGrader AI — Intelligent Multi-Model Homework & Assignment Evaluation Studio

[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Express 5](https://img.shields.io/badge/Express-5-black.svg)](https://expressjs.com/)
[![DeepSeek-V3 / R1](https://img.shields.io/badge/DeepSeek-V3%20%7C%20R1-007ACC.svg)](https://deepseek.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o%20%7C%20o3--mini-412991.svg)](https://openai.com/)
[![Anthropic Claude](https://img.shields.io/badge/Claude-3.5%20Sonnet-D97706.svg)](https://anthropic.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini-3.8%20Flash-4285F4.svg)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Live Demo**: [EasyGrader Studio Preview](https://ais-pre-ydvisyhlsh4wfeqe2otxxb-711601100267.us-east1.run.app)

**EasyGrader AI** is a full-stack web application designed for educators, teaching assistants, and students. It automates objective rubric-based grading across diverse formats—including **PDFs**, **Jupyter Notebooks (`.ipynb`)**, **Python source code (`.py`)**, and **Markdown/Text files**—powered by built-in **DeepSeek-V3 & DeepSeek-R1** alongside modular multi-model interfaces for **ChatGPT (GPT-4o, o3-mini)**, **Anthropic Claude (3.5 Sonnet, 3.5 Haiku)**, and **Google Gemini (3.8 Flash)**.

---

## Key Features

- **Multi-Model LLM Orchestration**:
  - **DeepSeek (Default / Built-in)**: `deepseek-chat` (V3) for fast structured evaluation, and `deepseek-reasoner` (R1) with deep reasoning for mathematical & algorithmic proofs.
  - **OpenAI / ChatGPT**: `gpt-4o-mini`, `gpt-4o`, and `o3-mini` reasoning engines.
  - **Anthropic Claude**: `claude-3-5-sonnet` (nuanced grading & literary evaluation) and `claude-3-5-haiku`.
  - **Google Gemini**: `gemini-3.8-flash` with sub-second grading and automatic fallback.
  - **Secure BYOK & Server Key Architecture**: Seamlessly switch between built-in server keys or client-provided keys.
- **Multi-Format Client-Side Parsing**:
  - In-browser PDF extraction using `pdfjs-dist`.
  - Jupyter Notebook cell and output extraction (`.ipynb`).
  - Source code and raw text ingestion with zero server storage.
- **Batch Processing & Resilient Queueing**:
  - Batching pipeline with exponential backoff and rate-limit mitigation.
- **Configurable Evaluation Policies**:
  - Built-in pedagogical templates: **Programming / Coding Review**, **English / Essay Writing**, and **Math / Logic Proofs**.
  - Custom system prompt overrides for lenient vs. strict scoring philosophies.
- **Structured Analytics & Gradebook Export**:
  - Strict JSON schema enforcement ensuring every submission receives a total score and itemized deduction/praise breakdown.
  - 1-click CSV export formatted for Canvas, Google Classroom, and Excel.

---

## System Architecture

```text
[ Browser Client (React 19 + TypeScript + Vite) ]
   ├── PDF.js & Notebook Parsers (Local text extraction)
   ├── Model & Policy Customization UI
   └── Batch Queue Dispatcher
              │
              │  POST /api/grade
              ▼
[ Backend API Gateway (Express 5 + Node.js) ]
   ├── API Key Safeguards & Header Proxying
   ├── Schema Validation & Prompt Assembly
   ├── Gemini Engine (gemini-3.8-flash + automatic fallback)
   └── DeepSeek Engine (deepseek-chat / deepseek-reasoner)
              │
              ▼
[ Structured JSON Result ] ──► [ UI Breakdown & CSV Export ]
```

---

## Quick Start (Local Development)

### 1. Clone & Install
```bash
git clone https://github.com/ChaoanLi/EasyGrader.git
cd EasyGrader
npm install
```

### 2. Configure an API key

The server reads API keys from its process environment. For the default DeepSeek engine, set a key in your terminal before starting the server:

```sh
export DEEPSEEK_API_KEY='replace-with-your-key'
```

You can also supply a provider key through the application. The server supports `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY`.

The repository includes an `.env.example` template, but `server.ts` does not load dotenv files itself. Creating an `.env` file alone does not populate the server environment.

### 3. Run the development server

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Data flow

Files are parsed in the browser. Extracted submission text, assignment instructions, and rubrics are sent to `/api/grade`, then forwarded to the selected model provider. Provider keys entered in the interface are stored in browser `localStorage` and sent to the backend for grading requests. This is not an entirely on-device workflow.

---

## Deployment Guide (Recommended for Portfolio)

To showcase this project permanently for job applications, choose any of these free or low-cost hosting platforms:

### Option 1: Render (Recommended • Free & Direct Git Sync)
1. Push your repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) -> **New Web Service**.
3. Connect your GitHub repository.
4. Set the following build and start settings:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
5. In **Environment Variables**, add:
   - `DEEPSEEK_API_KEY`: your DeepSeek API key (Default built-in engine)
   - `NODE_ENV`: `production`
6. Render gives you an instant `https://easygrader.onrender.com` URL with free SSL.

### Option 2: Railway or Zeabur
1. Create a project on [Railway.app](https://railway.app).
2. Deploy from GitHub Repo.
3. Add `DEEPSEEK_API_KEY` in the Variables tab.
4. Railway automatically detects `npm run build` and `npm run start`.

### Option 3: Google Cloud Run
In Google AI Studio, open the top-right menu and select **Deploy to Cloud Run** for zero-configuration Google Cloud deployment.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
