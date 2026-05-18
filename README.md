# llablab

> Voice-first multimodal trading engine — transcribe, analyze, ensemble vote, execute.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────┐
│  🎙️ Voice   │ ──→ │  👁️ Chart   │ ──→ │  🤖 Ensemble │ ──→ │  ⚡ Kraken │
│  Speechmatics│     │  Gemini     │     │  Featherless │     │  CLI      │
└─────────────┘     └──────────────┘     └──────────────┘     └───────────┘
```

- **Frontend**: React 19 + Vite 6 — iOS Liquid Glass UI with dark/light mode
- **Backend**: FastAPI (Python 3.11+) — transcription, chart analysis, ensemble consensus, order execution
- **Services**: Speechmatics (STT), Gemini Vision (chart classification), Featherless (LLM swarm), Kraken (trading)

## Quick Start

```bash
# Backend
cd backend
pip install -r ../requirements.txt
python main.py          # runs on :8000

# Frontend
cd frontend
npm install
npm run dev             # runs on :3000, proxies /api → :8000
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Upload voice file |
| `2` | Upload chart image |
| `Enter` | Execute pipeline |
| `Esc` | Clear / reset |
| `G` | Toggle guide |
| `D` | Toggle dark mode |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service status (which API keys are valid) |
| `POST` | `/transcribe` | Upload audio → returns transcript |
| `POST` | `/analyze-chart` | Upload chart → returns regime analysis |
| `POST` | `/execute-pipeline` | Transcript + analysis → consensus + order |

## Pipeline Flow

1. **Transcribe** — Speechmatics ASM converts voice command to text
2. **Analyze** — Gemini Vision classifies chart regime (Bullish/Bearish/Range-bound)
3. **Ensemble** — 3 LLMs vote on signal (BUY/SELL/HOLD) via Featherless
4. **Execute** — Kraken CLI fires the order

## Environment

Copy `.env.example` to `.env` and fill in your API keys:

```
SPEECHMATICS_API_KEY=
FEATHERLESS_API_KEY=
GEMINI_API_KEY=
```

Services without valid keys gracefully fall back to sandbox simulation.

## Docker

```bash
docker build -t voxregime-oracle .
docker run -p 8501:8501 --env-file .env voxregime-oracle
```
