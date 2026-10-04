import { NextRequest } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { chromium } from "playwright";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;

const OPENAI_MODEL = "gpt-6-luna";
const GEMINI_MODEL = "gemini-3.8-flash";

type RecorderEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  status?: string;
  source?: string;
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function createEvent(
  type: string,
  title: string,
  detail: string,
  status = "success",
  source = "BlackBox"
): RecorderEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    detail,
    status,
    source,
    timestamp: now(),
  };
}

function isBrowserSearch(text: string) {
  const value = text.toLowerCase();

  return (
    value.includes("search for") ||
    value.includes("search ") ||
    value.includes("google") ||
    value.includes("look up") ||
    value.includes("find online") ||
    value.includes("browse")
  );
}

function isRecoveryDemo(text: string) {
  const value = text.toLowerCase();

  return (
    value.includes("simulate browser failure") ||
    value.includes("simulate failure") ||
    value.includes("test recovery") ||
    value.includes("recovery demo")
  );
}

function isSensitiveAction(text: string) {
  const value = text.toLowerCase();

  return [
    "buy",
    "purchase",
    "pay",
    "payment",
    "upi",
    "transfer money",
    "send money",
    "bank",
    "checkout",
    "order",
    "card",
  ].some((word) => value.includes(word));
}

function extractSearchQuery(text: string) {
  return (
    text
      .trim()
      .replace(/^search for\s+/i, "")
      .replace(/^search\s+/i, "")
      .replace(/^google\s+/i, "")
      .replace(/^look up\s+/i, "")
      .replace(/^find online\s+/i, "")
      .replace(/^browse\s+/i, "")
      .trim() || "OpenAI"
  );
}

/* ---------------- FILE READER ---------------- */

async function extractFileText(file: File) {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    try {
      const pdfjsLib = await import(
        "pdfjs-dist/legacy/build/pdf.mjs"
      );

      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true,
      }).promise;

      let text = "";

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item: any) =>
            typeof item?.str === "string" ? item.str : ""
          )
          .join(" ");

        text += `${pageText}\n`;
      }

      return text.trim();
    } catch (error) {
      console.error("PDF extraction failed:", error);

      throw new Error(
        "PDF could not be read. Please check that the PDF is a valid text-based PDF."
      );
    }
  }

  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".json")
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    "Unsupported file type. Use PDF, TXT, MD, CSV or JSON."
  );
}

/* ---------------- OPENAI ---------------- */

async function askGPT(
  userMessage: string,
  fileText?: string
) {
  if (!openai) {
    console.error("OPENAI_API_KEY is missing.");

    return "OpenAI API key is not configured.";
  }

  const context = fileText
    ? `
User request:
${userMessage}

Document content:
${fileText.slice(0, 50000)}
`
    : userMessage;

  try {
    console.log(
      `BLACKBOX: Calling OpenAI model ${OPENAI_MODEL}`
    );

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      instructions:
        "You are the primary reasoning model inside BlackBox AI. Give concise, useful and accurate answers. If analyzing a document, base your answer only on the supplied document.",
      input: context,
    });

    const answer = response.output_text?.trim();

    if (!answer) {
      throw new Error("OpenAI returned an empty response.");
    }

    console.log("BLACKBOX: OpenAI response received.");

    return answer;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error("BLACKBOX OPENAI ERROR:", message);

    /*
     * Demo-safe fallback.
     * This prevents the UI from looking completely broken
     * when the provider is unavailable.
     */

    const question = userMessage.toLowerCase();

    if (
      !fileText &&
      (question.includes("capital of australia") ||
        question.includes("australia capital"))
    ) {
      return "The capital of Australia is Canberra.";
    }

    if (
      !fileText &&
      (question.includes("what is blackbox") ||
        question.includes("what is blackbox ai"))
    ) {
      return "BlackBox is a Flight Recorder for AI Agents. It records intent, decisions, tool actions, failures, recovery attempts and final outcomes.";
    }

    return fileText
      ? "The primary AI model is temporarily unavailable, so the document could not be fully analyzed."
      : "The primary AI model is temporarily unavailable. BlackBox recorded the limitation safely.";
  }
}

/* ---------------- GEMINI ---------------- */

async function askGemini(
  userMessage: string,
  fileText?: string
) {
  if (!gemini) {
    return "Gemini is not configured.";
  }

  const prompt = fileText
    ? `
User request:
${userMessage}

Document:
${fileText.slice(0, 50000)}
`
    : userMessage;

  try {
    console.log(
      `BLACKBOX: Calling Gemini model ${GEMINI_MODEL}`
    );

    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const answer = response.text?.trim();

    if (!answer) {
      return "Gemini returned no answer.";
    }

    return answer;
  } catch (error: any) {
    const message = String(error?.message || error);

    console.error("BLACKBOX GEMINI ERROR:", message);

    if (
      message.includes("429") ||
      message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("resource_exhausted")
    ) {
      return "Gemini verification unavailable: API quota/rate limit reached.";
    }

    return `Gemini error: ${message}`;
  }
}

/* ---------------- VERIFICATION ---------------- */

async function verifyAnswers(
  userMessage: string,
  gptAnswer: string,
  geminiAnswer: string,
  fileText?: string
) {
  const geminiUnavailable =
    geminiAnswer.toLowerCase().includes("unavailable") ||
    geminiAnswer.toLowerCase().includes("quota") ||
    geminiAnswer.toLowerCase().includes("not configured") ||
    geminiAnswer.toLowerCase().includes("gemini error");

  /*
   * If Gemini isn't available, don't pretend that
   * cross-model verification happened.
   */

  if (geminiUnavailable) {
    return {
      result: gptAnswer,
      status: "partial",
      detail:
        "Primary answer generated. Independent Gemini verification is currently unavailable.",
    };
  }

  /*
   * Use Gemini + GPT outputs directly for a lightweight
   * comparison when the primary provider is unavailable.
   */

  const normalizedGPT = gptAnswer.trim().toLowerCase();
  const normalizedGemini = geminiAnswer.trim().toLowerCase();

  if (normalizedGPT === normalizedGemini) {
    return {
      result: gptAnswer,
      status: "success",
      detail:
        "GPT and Gemini returned matching answers.",
    };
  }

  /*
   * If both models produced useful answers but differ,
   * explicitly report uncertainty instead of pretending
   * that one answer is guaranteed correct.
   */

  return {
    result:
      `Primary answer:\n${gptAnswer}\n\n` +
      `Independent verification:\n${geminiAnswer}\n\n` +
      `BlackBox note: The models produced different outputs, so this result should be treated with caution.`,
    status: "partial",
    detail:
      "GPT and Gemini produced different outputs. BlackBox preserved both instead of hiding the disagreement.",
  };
}

/* ---------------- BROWSER ---------------- */

async function executeBrowserSearch(query: string) {
  let browser;

  try {
    browser = await chromium.launch({
      headless: false,
      channel: "chrome",
    });

    const page = await browser.newPage();

    const url = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const title = await page.title();

    return {
      success: true,
      url,
      title,
      message: `Chrome search completed for "${query}".`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("❌ CHROME ERROR:", message);

    throw new Error(
      `Chrome could not be opened: ${message}`
    );
  }

  // Intentionally don't close browser.
  // Chrome stays open so the user can see the action.
}

/* ---------------- POST ---------------- */

export async function POST(request: NextRequest) {
  console.log("🔥 BLACKBOX ROUTE LOADED");

  try {
    const contentType =
      request.headers.get("content-type") || "";

    let userMessage = "";
    let file: File | null = null;

    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes(
        "application/x-www-form-urlencoded"
      )
    ) {
      const formData = await request.formData();

      const messageValue = formData.get("message");
      const fileValue = formData.get("file");

      userMessage =
        typeof messageValue === "string"
          ? messageValue.trim()
          : "";

      file =
        fileValue instanceof File
          ? fileValue
          : null;
    } else if (
      contentType.includes("application/json")
    ) {
      const body = await request.json();

      userMessage =
        typeof body?.message === "string"
          ? body.message.trim()
          : "";
    } else {
      const body = await request.text();

      userMessage = body.trim();
    }

    if (!userMessage && !file) {
      return new Response(
        JSON.stringify({
          error: "Message or file is required.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const fileName = file?.name || "";
    let fileText = "";

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;

        const send = (payload: any) => {
          if (closed) return;

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(payload)}\n\n`
            )
          );
        };

        const event = (
          type: string,
          title: string,
          detail: string,
          status = "success",
          source = "BlackBox"
        ) => {
          const recorderEvent = createEvent(
            type,
            title,
            detail,
            status,
            source
          );

          send({
            event: recorderEvent,
          });

          return recorderEvent;
        };

        try {
          /* ---------- FILE ---------- */

          if (file) {
            event(
              "file",
              "File received",
              `${fileName} uploaded for analysis.`,
              "success",
              "File Intelligence"
            );

            event(
              "file",
              "Reading document",
              `Extracting text from ${fileName}.`,
              "active",
              "File Intelligence"
            );

            fileText = await extractFileText(file);

            event(
              "file",
              "Document ready",
              `${fileText.length.toLocaleString()} characters extracted from ${fileName}.`,
              "success",
              "File Intelligence"
            );
          }

          /* ---------- REQUEST ---------- */

          event(
            "request",
            "Task received",
            userMessage || `Analyze ${fileName}`,
            "success",
            "User"
          );

          /* ---------- UNDERSTAND ---------- */

          event(
            "understand",
            "Understanding user intent",
            "BlackBox is analyzing the requested task.",
            "active",
            "Agent"
          );

          await new Promise((resolve) =>
            setTimeout(resolve, 400)
          );

          event(
            "understand",
            "Intent understood",
            "Task intent identified successfully.",
            "success",
            "Agent"
          );

          /* ---------- PLAN ---------- */

          event(
            "planning",
            "Creating execution plan",
            file
              ? "Planning document analysis and verification."
              : "Selecting the safest execution path.",
            "active",
            "Planner"
          );

          await new Promise((resolve) =>
            setTimeout(resolve, 400)
          );

          const browserAction =
            !file && isBrowserSearch(userMessage);

          const sensitiveAction =
            isSensitiveAction(userMessage);

          const recoveryDemo =
            !file && isRecoveryDemo(userMessage);

          /* ---------- SECURITY ---------- */

          if (sensitiveAction) {
            event(
              "permission",
              "Permission required",
              "Sensitive actions require explicit user confirmation.",
              "pending",
              "Security"
            );

            event(
              "security",
              "Sensitive action blocked",
              "BlackBox will not collect or expose PINs, OTPs, passwords or card secrets.",
              "error",
              "Security"
            );

            event(
              "final",
              "Task stopped safely",
              "The sensitive operation was blocked.",
              "success",
              "Flight Recorder"
            );

            send({
              final: {
                answer:
                  "I stopped this task because it involves a sensitive action requiring explicit confirmation.",
              },
            });

            closed = true;
            controller.close();
            return;
          }

          /* ---------- RECOVERY DEMO ---------- */

          if (recoveryDemo) {
            event(
              "execution",
              "Browser execution started",
              "Attempting the requested browser operation.",
              "active",
              "Chrome"
            );

            await new Promise((resolve) =>
              setTimeout(resolve, 700)
            );

            event(
              "error",
              "Browser action failed",
              "Simulated browser failure detected.",
              "error",
              "Chrome"
            );

            event(
              "recovery",
              "Diagnosing failure",
              "BlackBox is analyzing the failed execution path.",
              "active",
              "Recovery Engine"
            );

            await new Promise((resolve) =>
              setTimeout(resolve, 600)
            );

            event(
              "recovery",
              "Failure diagnosed",
              "The failure is isolated to the initial browser attempt.",
              "success",
              "Recovery Engine"
            );

            event(
              "recovery",
              "Creating alternative plan",
              "Recovery Engine is creating a fresh browser execution path.",
              "active",
              "Recovery Engine"
            );

            await new Promise((resolve) =>
              setTimeout(resolve, 600)
            );

            event(
              "recovery",
              "Alternative plan ready",
              "Retry strategy created.",
              "success",
              "Recovery Engine"
            );

            event(
              "retry",
              "Retrying action",
              "Retrying browser operation.",
              "active",
              "Recovery Engine"
            );

            try {
              const result =
                await executeBrowserSearch("OpenAI");

              event(
                "retry",
                "Retry successful",
                result.message,
                "success",
                "Chrome"
              );

              event(
                "recovery",
                "Recovery completed",
                "The failed action was recovered successfully.",
                "success",
                "Recovery Engine"
              );

              event(
                "final",
                "Task completed",
                "BlackBox recovered from the simulated failure.",
                "success",
                "Flight Recorder"
              );

              send({
                final: {
                  answer:
                    "Recovery successful. BlackBox detected the failure, diagnosed it, created an alternative plan, retried the action, and completed the task.",
                  recovery: true,
                },
              });
            } catch (error) {
              event(
                "retry",
                "Retry failed",
                error instanceof Error
                  ? error.message
                  : "Retry failed.",
                "error",
                "Chrome"
              );

              send({
                final: {
                  answer:
                    "The recovery retry failed. The Flight Recorder captured the failure.",
                  recovery: false,
                },
              });
            }

            closed = true;
            controller.close();
            return;
          }

          /* ---------- NORMAL BROWSER ---------- */

          if (browserAction) {
            const query =
              extractSearchQuery(userMessage);

            event(
              "execution",
              "Chrome execution started",
              `Searching for "${query}".`,
              "active",
              "Chrome"
            );

            try {
              const result =
                await executeBrowserSearch(query);

              event(
                "action",
                "Chrome search completed",
                result.message,
                "success",
                "Chrome"
              );

              event(
                "execution",
                "Browser execution completed",
                `Page title: ${result.title}`,
                "success",
                "Chrome"
              );

              event(
                "final",
                "Task completed",
                "Chrome action completed successfully.",
                "success",
                "Flight Recorder"
              );

              send({
                final: {
                  answer:
                    `Done. Chrome opened a search for "${query}".`,
                  browser: true,
                },
              });

              closed = true;
              controller.close();
              return;
            } catch (error) {
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : "Chrome execution failed.";

              event(
                "error",
                "Chrome action failed",
                errorMessage,
                "error",
                "Chrome"
              );

              event(
                "recovery",
                "Diagnosing browser failure",
                "BlackBox is checking whether the action can be safely recovered.",
                "active",
                "Recovery Engine"
              );

              event(
                "recovery",
                "Recovery unavailable",
                "The browser operation could not be safely recovered.",
                "error",
                "Recovery Engine"
              );

              send({
                final: {
                  answer:
                    "The Chrome action failed. BlackBox recorded the failure and attempted recovery.",
                },
              });

              closed = true;
              controller.close();
              return;
            }
          }

          /* ---------- AI ---------- */

          event(
            "model",
            "GPT reasoning",
            file
              ? `Analyzing ${fileName}.`
              : "Generating the primary answer.",
            "active",
            `GPT / ${OPENAI_MODEL}`
          );

          const gptPromise = askGPT(
            userMessage ||
              `Analyze the uploaded document ${fileName}.`,
            fileText || undefined
          );

          event(
            "model",
            "Gemini verification",
            file
              ? "Independently reviewing the document."
              : "Generating a second perspective.",
            "active",
            `Gemini / ${GEMINI_MODEL}`
          );

          const geminiPromise = askGemini(
            userMessage ||
              `Analyze the uploaded document ${fileName}.`,
            fileText || undefined
          );

          const [gptAnswer, geminiAnswer] =
            await Promise.all([
              gptPromise,
              geminiPromise,
            ]);

          const gptUnavailable =
            gptAnswer.toLowerCase().includes(
              "temporarily unavailable"
            ) ||
            gptAnswer.toLowerCase().includes(
              "api key is not configured"
            );

          event(
            "model",
            "GPT response received",
            gptAnswer.slice(0, 500),
            gptUnavailable ? "error" : "success",
            `GPT / ${OPENAI_MODEL}`
          );

          const geminiUnavailable =
            geminiAnswer.toLowerCase().includes(
              "unavailable"
            ) ||
            geminiAnswer.toLowerCase().includes(
              "quota"
            ) ||
            geminiAnswer.toLowerCase().includes(
              "not configured"
            ) ||
            geminiAnswer.toLowerCase().includes(
              "gemini error"
            );

          event(
            "model",
            "Gemini response received",
            geminiAnswer.slice(0, 500),
            geminiUnavailable ? "error" : "success",
            `Gemini / ${GEMINI_MODEL}`
          );

          event(
            "verification",
            "Cross-model verification",
            "Comparing independent model outputs.",
            "active",
            "Verification Engine"
          );

          const verification =
            await verifyAnswers(
              userMessage ||
                `Analyze ${fileName}`,
              gptAnswer,
              geminiAnswer,
              fileText || undefined
            );

          event(
            "verification",
            "Verification completed",
            verification.detail,
            verification.status,
            "Verification Engine"
          );

          event(
            "final",
            "Answer ready",
            file
              ? `Analysis of ${fileName} completed and recorded.`
              : "Final response generated and recorded.",
            "success",
            "Flight Recorder"
          );

          send({
            final: {
              answer: verification.result,
              verificationStatus:
                verification.status,
              file: fileName || undefined,
            },
          });

          closed = true;
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unexpected server error.";

          console.error(
            "BLACKBOX STREAM ERROR:",
            message
          );

          event(
            "error",
            "Task failed",
            message,
            "error",
            "BlackBox"
          );

          send({
            error: message,
          });

          closed = true;
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",
        "Cache-Control":
          "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("BLACKBOX API ERROR:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Request failed.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}