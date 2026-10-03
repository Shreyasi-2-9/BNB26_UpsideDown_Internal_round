import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function askGemini(message: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await gemini.models.generateContent({
        model: "gemini-3.8-flash",
        contents: message,
      });

      return result.text || "Gemini returned no response.";
    } catch (error) {
      console.error(`Gemini attempt ${attempt} failed:`, error);

      if (attempt === 3) {
        return "Gemini temporarily unavailable after 3 attempts.";
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * attempt)
      );
    }
  }

  return "Gemini unavailable.";
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const [openaiResult, geminiAnswer] = await Promise.all([
      openai.responses.create({
        model: "gpt-6-luna",
        input: [
          {
            role: "system",
            content:
              "You are BlackBox AI. Answer clearly and accurately.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),

      askGemini(message),
    ]);

    const openaiAnswer = openaiResult.output_text;

    const finalAnswer = `
BLACKBOX VERIFICATION

GPT:
${openaiAnswer}

GEMINI:
${geminiAnswer}
`;

    return NextResponse.json({
      reply: finalAnswer,
      models: {
        openai: openaiAnswer,
        gemini: geminiAnswer,
      },
    });
  } catch (error) {
    console.error("BlackBox API Error:", error);

    return NextResponse.json(
      {
        error: "BlackBox could not process the request.",
      },
      { status: 500 }
    );
  }
}
