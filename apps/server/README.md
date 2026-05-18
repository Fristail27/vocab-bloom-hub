# Vocab Bloom Hub — Backend API

Backend API for **Vocab Bloom Hub**, a modular open-source platform for vocabulary data, linguistic analysis, and multilingual dictionary services.

Built with **NestJS + TypeScript**.

---

## 🚀 Overview

This service provides the core API for:

- 📖 Dictionary entries (words, meanings, senses)
- 🔎 Full-text and semantic search
- 🌐 Multilingual vocabulary support
- 🔗 Semantic relationships (synonyms, antonyms, hypernyms, etc.)
- 📊 Linguistic metadata and word statistics

It serves data to the frontend and future SDKs (Node.js / Python).

---

## 🧱 Architecture

This backend is designed as a **modular linguistic engine**.

Planned internal structure:

- Words module → word entities & CRUD
- Search module → lexical + semantic search
- Relations module → graph-based word connections
- Languages module → multilingual support
- Datasets module → import/export of lexical data

---

## ⚙️ Tech Stack

- NestJS
- TypeScript
- Node.js
- (planned) PostgreSQL / SQLite
- (planned) full-text search / indexing engine
- (optional) graph-based storage for semantic relations

---

## 📦 Project Structure

```txt
apps/server/
  src/
    modules/
      words/
      search/
      relations/
      languages/
      datasets/
    common/
    config/
    main.ts