# Launch announcement

Future turns your ChatGPT history and project files into a private, cited assistant memory. It runs locally, supports Ollama and OpenAI-compatible providers, and shows you exactly what context leaves your machine before an external call.

The first early release can import Markdown, text, and ChatGPT exports; retrieve across documents, reviewed memory, and prior events; show source ranges and ranking details; redact the complete external prompt; and record an explicit approval or denial.

Try the offline demo:

```powershell
git clone https://github.com/pranavdhawann/singularity.git
cd singularity
corepack pnpm install --frozen-lockfile
corepack pnpm demo
```

This is an early technical release, not a finished consumer app. Feedback on installation, first import, citation inspection, and the approval experience is especially useful.
