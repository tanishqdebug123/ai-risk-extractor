import os
import json
from typing import List, Optional

import faiss
import numpy as np
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# Simple config
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
INDEX_PATH = "faiss.index"
TEXTS_PATH = "texts.json"

app = FastAPI(title="AI Risk Extractor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load embedding model once
embed_model = SentenceTransformer(EMBED_MODEL_NAME)

# In-memory storage for chunks
texts: List[str] = []

# FAISS index (inner product on normalized vectors == cosine similarity)
index = None


def load_state_if_exists():
    global index, texts
    if os.path.exists(TEXTS_PATH):
        with open(TEXTS_PATH, "r", encoding="utf-8") as f:
            texts.extend(json.load(f))
    if os.path.exists(INDEX_PATH):
        index_loaded = faiss.read_index(INDEX_PATH)
        # basic sanity: only assign if there is something
        if index_loaded.ntotal > 0:
            globals()["index"] = index_loaded


def save_state():
    if index is not None and index.ntotal > 0:
        faiss.write_index(index, INDEX_PATH)
    with open(TEXTS_PATH, "w", encoding="utf-8") as f:
        json.dump(texts, f, ensure_ascii=False, indent=2)


load_state_if_exists()


class UploadRequest(BaseModel):
    title: Optional[str] = None
    content: str


class AnalyzeRequest(BaseModel):
    query: str


class AnalyzeResponse(BaseModel):
    risks: List[str]
    checklist: List[str]
    used_chunks: List[str]


def embed_texts(chunks: List[str]) -> np.ndarray:
    embs = embed_model.encode(chunks, convert_to_numpy=True, normalize_embeddings=True)
    return embs.astype("float32")


def add_document_to_index(content: str) -> int:
    global index, texts
    # very simple paragraph-based splitter
    parts: List[str] = []
    chunk_size = 600
    current: List[str] = []

    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        current.append(line)
        if sum(len(x) for x in current) > chunk_size:
            parts.append(" ".join(current))
            current = []
    if current:
        parts.append(" ".join(current))

    if not parts:
        return 0

    embs = embed_texts(parts)
    if index is None:
        dim = embs.shape[1]
        index = faiss.IndexFlatIP(dim)

    index.add(embs)
    texts.extend(parts)
    save_state()
    return len(parts)


def call_llm(prompt: str) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    resp = requests.post(OLLAMA_URL, json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", "").strip()


def parse_llm_output(output: str):
    risks: List[str] = []
    checklist: List[str] = []

    section = None
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        upper = line.upper()
        if "RISKS" in upper:
            section = "risk"
            continue
        if "CHECKLIST" in upper or "ACTIONS" in upper:
            section = "checklist"
            continue
        if line.startswith(("-", "*")):
            line = line[1:].strip()
        if section == "risk":
            risks.append(line)
        elif section == "checklist":
            checklist.append(line)
    return risks, checklist


@app.post("/upload")
def upload_doc(req: UploadRequest):
    added = add_document_to_index(req.content)
    return {"status": "ok", "chunks_added": added}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    if index is None or len(texts) == 0:
        return AnalyzeResponse(risks=[], checklist=[], used_chunks=[])

    q_emb = embed_texts([req.query])
    scores, idxs = index.search(q_emb, k=min(5, len(texts)))
    indices = idxs[0]
    used_chunks = [texts[i] for i in indices if i >= 0]

    context = "\n\n".join(used_chunks)
    prompt = f"""
    You are a careful compliance and risk assistant.

    I will give you some context text and a user query.
    1. Read the context.
    2. List concrete RISKS as bullet points.
    3. List an actionable CHECKLIST of steps.

    Format your answer like:

    RISKS:
    - ...

    CHECKLIST:
    - ...

    Context:
    {context}

    Query: {req.query}

    Answer:
    """

    raw = call_llm(prompt)
    risks, checklist = parse_llm_output(raw)
    return AnalyzeResponse(risks=risks, checklist=checklist, used_chunks=used_chunks)
