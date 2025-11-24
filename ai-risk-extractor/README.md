# AI Risk Extractor & Compliance Checklist Generator

This project is a small end-to-end AI system that analyzes policy or SOP text, identifies key risks, and generates a practical checklist of recommended actions.
It uses a local LLM through Ollama, document embeddings through sentence-transformers, and FAISS for vector search.
A React frontend provides a simple UI for uploading text and asking questions.

# Features

1) Paste any policy / SOP / compliance document text

2) Stores content in a local FAISS vector index for fast retrieval

3) Embeds text using all-MiniLM-L6-v2

4) Uses TinyLlama (via Ollama) for offline inference

5) Extracts:

      Risks (bullet-point list)

      Checklist (action steps)
6) Simple and fast React frontend
7) Lightweight FastAPI backend