import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-6-luna",
      input: [
        {
          role: "system",
          content:
            "You are BlackBox AI, a helpful general-purpose AI agent. Answer clearly and concisely. For device actions, explain what action would be performed rather than pretending it was actually performed.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    return NextResponse.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "BlackBox could not process the request." },
      { status: 500 }
    );
  }
}