import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import Groq from "groq-sdk";
import 'dotenv/config';
import path from "path";
import { fileURLToPath } from "url";
import { CloudClient } from 'chromadb';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromaOptions: any = {};
if (process.env.CHROMA_TENANT) {
  chromaOptions.tenant = process.env.CHROMA_TENANT;
}
if (process.env.CHROMA_DATABASE) {
  chromaOptions.database = process.env.CHROMA_DATABASE;
}
const chromaClient = new CloudClient(chromaOptions);

let supabaseClient: any = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}
const localHistory: any[] = [];

let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

async function embedText(text: string) {
  try {
    if (!process.env.NVIDIA_API_KEY) {
      throw new Error("NVIDIA_API_KEY environment variable is required");
    }
    
    const response = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        input: [text],
        model: "nvidia/nv-embedqa-e5-v5",
        input_type: "query",
        encoding_format: "float",
        truncate: "END"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error: any) {
    throw new Error(error.message || "Embedding generation failed");
  }
}

function chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
    chunks.push(text.substring(i, Math.min(i + chunkSize, text.length)));
  }
  return chunks;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || "dummy", 
  });

  // API Route for upload and assessment
  app.post("/api/assess", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: "GROQ_API_KEY not configured. Please add it to your environment variables." });
      }

      console.log(`Processing file: ${req.file.originalname}`);

      // Extract text based on file type
      let textContent = "";
      if (req.file.mimetype === "application/pdf") {
        const pdfData = await pdf(req.file.buffer);
        textContent = pdfData.text;
      } else if (req.file.mimetype === "text/plain") {
        textContent = req.file.buffer.toString("utf8");
      } else {
        return res.status(400).json({ error: "Unsupported file type. Only PDF and TXT are supported." });
      }

      if (textContent.length > 50000) {
        textContent = textContent.substring(0, 50000); // Truncate to avoid context window limits
      }

      console.log(`Extracted text length: ${textContent.length} chars`);

      const systemPrompt = `You are an expert AI Risk and Compliance Assessor. 
You are analyzing AI system documentation against major AI compliance frameworks. Treat the AI as a socio-technical system embedded in legal, institutional, and societal contexts—not merely a technical deployment.

Focus your analysis on:
1. NIST AI RMF (Govern, Map, Measure, Manage)
2. EU AI Act (Risk Categories, Transparency)
3. UNESCO's 10 Core Principles for Human-Centered AI (e.g. Proportionality, Privacy, Human Oversight)
4. Australian Government AI Impact Assessment Framework (12-section impact assessments)

Analyze the provided documentation and generate a comprehensive assessment report in structured JSON format exactly matching this schema:
{
  "docSummary": "A brief 2-3 sentence summary of the AI system based on the docs",
  "overallComplianceScore": 85, // 0-100 indicating relative compliance
  "frameworkAssessments": [
    {
      "framework": "e.g., NIST AI RMF",
      "complianceLevel": "High | Medium | Low",
      "findings": ["Specific finding 1", "Specific finding 2"],
      "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"]
    }
  ],
  "identifiedRisks": [
    {
      "riskType": "e.g., Bias & Fairness, Data Privacy, Transparency",
      "severity": "Critical | High | Medium | Low",
      "description": "Clear description of the risk based on the documentation",
      "mitigation": "Detailed, specific, and actionable mitigation strategy leveraging the AI's analytical capabilities. Expand beyond generic advice with concrete steps relevant to the risk type and the analyzed documentation."
    }
  ]
}

Ensure the output is ONLY valid JSON.`;

      const response = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please assess the following AI documentation:\n\n${textContent}` }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      let responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("Empty response from Groq");
      }

      // Cleanup Markdown formatting from JSON output
      responseText = responseText.replace(/^```json\n/, "").replace(/\n```$/, "");
      
      const jsonResponse = JSON.parse(responseText);
      
      let collectionName = `doc_${uuidv4().replace(/-/g, '_')}`;
      try {
        const collection = await chromaClient.getOrCreateCollection({ name: collectionName });
        const chunks = chunkText(textContent, 1500, 200);
        
        const embeddings = [];
        const ids = [];
        const metadatas = [];
        const documents = [];
        
        for(let i=0; i< chunks.length; i++){
           const vector = await embedText(chunks[i]);
           embeddings.push(vector);
           ids.push(`chunk_${i}`);
           documents.push(chunks[i]);
           metadatas.push({ index: i });
        }
        
        const standardRegulations = [
          "REGULATION FRAMEWORK - NIST AI RMF: Focuses on Govern, Map, Measure, and Manage functions for analyzing AI risks.",
          "REGULATION FRAMEWORK - EU AI Act: Classifies AI by risk (Unacceptable, High, Limited, Minimal). High risk requires strict compliance, conformity assessments, logging, and human oversight.",
          "REGULATION FRAMEWORK - Australian Government AI Impact Assessment Framework: Requires extensive documentation on data, bias, human oversight, and safety across 12 criteria.",
          "REGULATION FRAMEWORK - UNESCO AI Ethics: Focuses on Proportionality, Privacy, Transparency, Explainability, and Fairness."
        ];

        const additionalChunks = [
          ...standardRegulations,
          `Assessment Report Summary and Compliance Ratio/Score: ${JSON.stringify(jsonResponse)}`
        ];

        for (let i = 0; i < additionalChunks.length; i++) {
          const text = additionalChunks[i];
          const vector = await embedText(text);
          embeddings.push(vector);
          ids.push(`aux_${i}`);
          documents.push(text);
          metadatas.push({ index: chunks.length + i, type: 'auxiliary' });
        }
        
        await collection.add({ ids, embeddings, metadatas, documents });
        jsonResponse.collectionName = collectionName;
      } catch (err: any) {
         console.warn(`Chroma DB insertion failed. Vector search features will be unavailable. (${err.message})`);
      }

      const historyRecord = {
        file_name: req.file.originalname,
        report: jsonResponse,
        collection_name: jsonResponse.collectionName || null,
        created_at: new Date().toISOString()
      };

      try {
        if (supabaseClient) {
          await supabaseClient.from('assessments').insert([{
            file_name: historyRecord.file_name,
            report: historyRecord.report,
            collection_name: historyRecord.collection_name
          }]);
        } else {
          localHistory.unshift(historyRecord);
        }
      } catch (err: any) {
        console.warn(`Supabase insertion failed: ${err.message}. Saving locally.`);
        localHistory.unshift(historyRecord);
      }
      
      res.json(jsonResponse);
    } catch (error: any) {
      console.error("Assessment Error:", error);
      res.status(500).json({ error: error.message || "Failed to process assessment" });
    }
  });

  // History Endpoint
  app.get("/api/history", async (req, res) => {
    try {
      if (!supabaseClient) {
        return res.json(localHistory);
      }
      const { data, error } = await supabaseClient.from("assessments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error("Fetch history error:", err);
      let errorMsg = err.message || "An error occurred while fetching history.";
      
      // Fallback to local history if Supabase fails (e.g. invalid URL)
      if (errorMsg.includes("Failed to fetch") || errorMsg.includes("network")) {
         console.warn("Database connection failed. Falling back to local history.");
         return res.json(localHistory);
      }

      res.status(500).json({ error: errorMsg });
    }
  });

  // Chat/RAG Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { query, collectionName } = req.body;
      if (!query || !collectionName) {
         return res.status(400).json({ error: "Query and collectionName are required." });
      }

      let contextText = "";
      try {
        const collection = await chromaClient.getCollection({ name: collectionName });
        const queryEmbedding = await embedText(query);
        const results = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: 3
        });
        
        if (results.documents && results.documents.length > 0) {
           // results.documents is string[][]
           const flatDocs = results.documents[0] as string[];
           contextText = flatDocs.join("\n\n---\n\n");
        }
      } catch (err) {
        console.warn("Chroma query failed", err);
      }

      const systemPrompt = `You are an AI Compliance Assistant answering questions about a document and its compliance assessment. Use the following context to answer the user's question. The context includes actual text chunks, the core regulations, and the generated assessment report (which contains the compliance ratio/score). If the answer is not in the context, you can say you don't know based on the document, but feel free to provide general knowledge if relevant.

Context:
${contextText}`;

      const response = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
      });

      res.json({ answer: response.choices[0]?.message?.content || "No response generated." });
    } catch (err: any) {
      console.error("Chat Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Error handler
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error("API Error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0" as any, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
