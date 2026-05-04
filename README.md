# AI Risk Compliance Tracker

## Abstract
The AI Risk Compliance Tracker is a full-stack web application designed to evaluate AI system documentation against major global AI regulations. It processes uploaded documents, leverages advanced Large Language Models (LLMs) to generate an automated compliance score with a detailed assessment report, and features an embedded Document Q&A Assistant utilizing Retrieval-Augmented Generation (RAG) for deep conversational interrogation of the documentation.

## Introduction
### Why was this built?
With the rapid integration of AI across mission-critical industries, global regulatory frameworks are evolving and tightening. Organizations face the growing challenge of ensuring their AI systems comply with overlapping, rigorous standards. 

This project streamlines the regulatory compliance process by automating document analysis. Rather than compliance officers having to manually parse dozens of pages of AI system documentation, they can upload the system's files, quickly identify major legal and technical risks, review specialized mitigation strategies, and directly chat with the document using an advanced Vector Database and LLM architecture.

## Architecture
The application runs on a modern, robust architecture leveraging real-time inference endpoints:

- **Frontend**: React and Vite, beautifully styled with Tailwind CSS and utilizing `framer-motion` for fluid component transitions.
- **Backend & Middleware**: Express (Node.js) server structured with Vite middleware for optimal full-stack development and routing handling.
- **Text Extraction**: Uses `multer` for memory buffering and `pdf-parse` for stripping textual content from PDFs.
- **AI/LLM Inference**: Groq SDK interfaces with `llama-3.3-70b-versatile` for blazing-fast inference, instruction-following, and contextual text digestion.
- **Embeddings**: Uses the NVIDIA API (`nvidia/nv-embedqa-e5-v5`) for sophisticated semantic encoding of document chunks.
- **Vector Search (RAG)**: ChromaDB manages the in-memory or cloud vector database storage, rapidly retrieving nearest-neighbor chunks when navigating the Q&A Assistant.
- **Database Persistence**: Supabase (PostgreSQL) is utilized to maintain long-term assessment history data. The system features a built-in fallback to an local memory array if Supabase is left unconfigured.

### How it Works
1. **Upload & Extraction**: A user uploads a PDF or TXT file detailing their AI architecture. The Node backend intercepts the buffer and extracts the readable text.
2. **Assessment Generation**: The extracted text is injected into Groq's Llama 3.3 model alongside a highly engineered system prompt. This prompt mandates the AI to act as an auditor assessing the text against the **NIST AI RMF**, **EU AI Act**, **UNESCO's Core Principles**, and the **Australian Government AI Impact Framework**. The result guarantees structured JSON populated with holistic findings.
3. **Chunking & Vector Injection**: The extracted text is broken into 1000-character chunks with a 100-character overlap. Each chunk is passed to the NVIDIA Embedding API to generate dense float vectors, which are then upserted into an isolated ChromaDB collection. Additional 'auxiliary' insights (the actual compliance score, the JSON object, and rule mappings) are also embedded to feed future contexts.
4. **Retrieval-Augmented Generation (RAG) Q&A**: When a user inputs a question in the Document Q&A Assistant, their prompt is embedded via the NVIDIA API. The query embedding pulls the top 3 semantically identical chunks from the document's Chroma collection. These chunks are supplied dynamically back to the Groq LLM to synthesize an accurate, fully-contextualized answer rooted entirely in the provided documentation.

## User Guide
### Prerequisites
- Node.js (v18+)
- A Groq API Key
- An NVIDIA API Key

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Check the `.env.example` file and create your root `.env` variable:
   ```env
   GROQ_API_KEY="your-groq-key"
   NVIDIA_API_KEY="your-nvidia-key"
   # Optional: CHROMA_TENANT, CHROMA_DATABASE, SUPABASE_URL, SUPABASE_ANON_KEY
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Usage Workflow
1. Navigate to the local host interface (`http://localhost:3000`).
2. Upload your AI system documentation (PDF or Text Document) on the landing page securely.
3. Review the **Overall Compliance Score**, deep-dive into the specialized framework findings, and examine the **Identified Risks** equipped with highly actionable mitigation strategies.
4. Use the **Document Q&A Assistant** sliding panel to ask conversational, pointed questions about your uploaded document's exact compliance standing, limitations, and findings (e.g., "What are the identified data privacy vulnerabilities found in this report?").
5. Access your historical audits systematically through the "Assessment History" tab on the Navbar.

## Implementation Details
- **Token Optimization & NVIDIA Embeddings**: The semantic chunking formula (`Math.min(i + chunkSize, text.length)`) has been aggressively truncated to guarantee optimal safety limits across the `nv-embedqa-e5-v5` model boundary constraint sizes. 
- **Tailored Mitigation Mapping**: Groq is tightly scoped to avoid rendering generic, superficial mitigation advice. It leverages its full analytical scale strictly within the given document to produce actionable architecture overhauls for resolving security and bias faults. 
- **JSON Schema Strictness**: The LLM prompt enforces stringified parsing using `response_format: { type: "json_object" }` alongside markdown-trimming techniques, solidifying data flow safely into the standard React context states without application-breaking UI errors.
