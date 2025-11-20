# EasyGrader AI 🎓

**A secure, customizable, AI-powered grading assistant for teachers, TAs, and self-learners.**

EasyGrader AI allows you to bulk-grade assignments (PDFs, text files, Jupyter Notebooks) using Google's Gemini models. It is designed with a **"Bring Your Own Key" (BYOK)** architecture, ensuring your data and API keys never leave your device.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Built with Gemini](https://img.shields.io/badge/Built%20with-Gemini-blue)

## 🚀 Key Features

*   **🔒 Secure BYOK Architecture**: Your API key is stored locally in your browser. We never see it, and we never store your student data.
*   **⚙️ Fully Customizable Policies**: Define your own grading persona. Choose between strict syntax checking for code or conceptual leniency for essays.
*   **⚡ Batch Processing**: Grade dozens of assignments in parallel.
*   **📄 Multi-Format Support**: Works with PDFs, Python Notebooks (`.ipynb`), and plain text files.
*   **📊 Instant Feedback**: Generates detailed score breakdowns and specific, constructive feedback for every student.

---

## 🚦 Getting Started (Onboarding)

### 1. Get your Gemini API Key
To use this app, you need a free API key from Google.
1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Log in with your Google Account.
3.  Click **"Create API Key"**.
4.  Copy the key string (it starts with `AIza...`).

### 2. Launch the App
Open `index.html` in your browser (or visit the live demo link if hosted).

### 3. Configure Your Assistant
1.  **Enter API Key**: Paste your key when prompted. It is saved to your browser's LocalStorage.
2.  **Choose a Template**: Select a grading style (Writing, Coding, or Math) or write your own custom instructions.
3.  **Upload Files**:
    *   **Assignment Spec**: The original homework instructions.
    *   **Rubric**: How you want it graded.
    *   **Student Files**: The actual work to grade.
4.  **Run Grading**: Click "Grade" and watch the results stream in.

---

## 📝 Customizable Grading Policies

EasyGrader allows you to inject a "System Instruction" that controls the AI's behavior. We provide three starter templates:

### 📝 English / Writing
*   **Philosophy**: Focuses on clear arguments and evidence over minor grammar mistakes.
*   **Tone**: "Constructive Editor" — helpful, encouraging, but precise.

### 💻 Programming / Coding
*   **Philosophy**: Prioritizes conceptual understanding. Does not deduct for minor syntax errors if the logic is sound, unless the code fails to run entirely.
*   **Tone**: "Senior Engineer Code Review" — objective and technical.

### ➗ Math / Logic
*   **Philosophy**: Logic > Arithmetic. Awards partial credit for correct process even if the final number is slightly off.
*   **Tone**: "Math Tutor" — pinpoints exactly where the proof went wrong.

*You can edit these templates directly in the app before grading.*

---

## 🛡️ Privacy Notice

We take privacy seriously. Because this is a client-side application:

1.  **No Server Storage**: Your API key, grading rubrics, and student files are processed entirely in your browser memory.
2.  **Direct Connection**: When you click "Grade", your browser sends the text directly to Google's Gemini API. It does not pass through our servers.
3.  **Data Persistence**: Your API key and custom policy are saved in your browser's `LocalStorage` for convenience. You can clear this at any time by clearing your browser cache.

---

## ❓ FAQ

**Q: Is my API key safe?**
A: Yes. It is never sent to the app developer. It resides in your browser's local storage and is only used to sign requests to Google.

**Q: Why did the model give this score?**
A: LLMs are probabilistic. While Gemini 2.5 is highly capable, it may occasionally hallucinate or miss details. Always review grades before finalizing them. You can adjust the "Policy" to be stricter or more lenient to guide the model.

**Q: What does it cost?**
A: The app itself is free. Google's Gemini API has a generous free tier. If you exceed the free tier limits, you pay Google directly based on your usage.

**Q: What if I don't have a Google account?**
A: You will need a Google account to generate the Gemini API key.

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
