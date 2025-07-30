import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import express, { Request, Response } from "express";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY is not defined in the .env file.");
  process.exit(1);
}

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Pet Care AI API is running!" });
});

// AI Chat endpoint (Streaming Response)
app.post("/ai-chat", async (req: Request, res: Response) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const config = {
      thinkingConfig: { thinkingBudget: 0 },
      systemInstruction: [
        {
          text:
            "You are a pet-care vet assistant. Based on the symptoms and other description, " +
            "figure out what illness the pet has and suggest what to do.",
        },
      ],
    };

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      config,
      contents,
    });

    for await (const chunk of response) {
      if (!chunk.text) continue;
      res.write(`data: ${chunk.text}\n\n`);
    }

    res.write(`event: done\ndata: [DONE]\n\n`);
    res.end();
  } catch (err) {
    console.error("Streaming error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "AI generation failed." });
    }
    res.write(`event: error\ndata: Failed to generate response.\n\n`);
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
