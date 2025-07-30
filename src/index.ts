import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Initialize Google Generative AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY is not defined in the .env file.");
  process.exit(1); // Exit the process if the API key is missing
}

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Pet Care AI API is running!" });
});

// AI Chat endpoint (Streaming Response)
app.post("/ai-chat", async (req: Request, res: Response) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required in the request body." });
  }

  // Set headers for streaming
  res.setHeader("Content-Type", "text/plain"); // Or 'application/json' if you send JSON chunks
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Connection", "keep-alive");

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    // Prepare the content for the AI model
    const contents = [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ];
    // Define the configuration for the AI model
    const config = {
      thinkingConfig: {
        thinkingBudget: 0,
      },
      systemInstruction: [
        {
          text: `you are a pet care vet assistant. based on the symtomms and other description you need figure out what kind of illness the pet has and suggest what to do.`,
        },
      ],
    };

    const model = "gemini-2.5-flash";
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });
    
    for await (const chunk of response) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }

    // End the response stream
    res.end();
  } catch (error) {
    console.error("Error generating AI response:", error);
    // If an error occurs during streaming, we might have already sent headers.
    // Try to send an error message and end the response.
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to get AI response. Please try again later." });
    } else {
      res.end("\n--- Error: Failed to get AI response. Please try again later. ---\n");
    }
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
