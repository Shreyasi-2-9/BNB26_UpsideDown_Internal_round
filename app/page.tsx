"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type RecorderEvent = {
  type: string;
  model?: string;
  status: string;
  message: string;
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recorderEvents, setRecorderEvents] = useState<RecorderEvent[]>([]);

  const runTask = async () => {
    if (!prompt.trim() || running) return;

    const userMessage = prompt.trim();

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setPrompt("");
    setRunning(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      // Update Flight Recorder with backend events
      if (data.events) {
        setRecorderEvents(data.events);
      }

      // Add AI response
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);

      // Record frontend error
      setRecorderEvents((prev) => [
        ...prev,
        {
          type: "error",
          status: "error",
          message: "BlackBox request failed",
        },
      ]);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, BlackBox could not process your request. Please check the API connection.",
        },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const modelCount = recorderEvents.filter(
    (event) => event.type === "model"
  ).length;

  const errorCount = recorderEvents.filter(
    (event) => event.status === "error"
  ).length;

  const actionCount = recorderEvents.filter(
    (event) => event.type === "action"
  ).length;

  return (
    <main className="blackbox">
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">B</div>

          <div>
            <h2>BLACKBOX</h2>
            <span>AI AGENT</span>
          </div>
        </div>

        <button
          className="new-task"
          onClick={() => {
            setPrompt("");
            setMessages([]);
            setRecorderEvents([]);
          }}
        >
          ＋ New Task
        </button>

        <nav>
          <div className="nav-item active">
            ⌂ <span>Chat</span>
          </div>

          <div className="nav-item">
            ◈ <span>Tasks</span>
          </div>

          <div className="nav-item">
            ◉ <span>Flight Recorder</span>
          </div>

          <div className="nav-item">
            ◷ <span>History</span>
          </div>

          <div className="nav-item">
            ⬡ <span>Connected Apps</span>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="nav-item">
            ⚙ <span>Settings</span>
          </div>

          <div className="profile">
            <div className="avatar">A</div>

            <div>
              <strong>Admin</strong>
              <small>Local Agent</small>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <section className="main-area">
        <header className="topbar">
          <div>
            <span className="status-dot"></span>
            Agent Online
          </div>

          <div className="top-actions">
            <span>GPT • Claude • Gemini</span>
            <button>⚙</button>
          </div>
        </header>

        <div className="hero">
          {/* AI ORB */}
          <div className={`orb ${running ? "thinking" : ""}`}>
            <div className="orb-ring ring-one"></div>
            <div className="orb-ring ring-two"></div>

            <div className="orb-core">
              <span>✦</span>
            </div>
          </div>

          <h1>Tell BlackBox what you want to do.</h1>

          <p className="subtitle">
            Ask anything, give a command, or let your agent handle the task.
          </p>

          {/* CHAT MESSAGES */}
          {messages.length > 0 && (
            <div className="messages">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message ${
                    message.role === "user"
                      ? "user-message"
                      : "ai-message"
                  }`}
                >
                  <span>
                    {message.role === "user" ? "You" : "BlackBox"}
                  </span>

                  <p>{message.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* EXAMPLE COMMANDS */}
          {messages.length === 0 && (
            <div className="examples">
              <button
                onClick={() =>
                  setPrompt("Research the best laptops under ₹80,000")
                }
              >
                Research laptops under ₹80,000
              </button>

              <button
                onClick={() =>
                  setPrompt("Open Chrome and search for AI hackathons")
                }
              >
                Open Chrome & search AI hackathons
              </button>

              <button
                onClick={() => setPrompt("Summarize my PDF")}
              >
                Summarize my PDF
              </button>

              <button
                onClick={() =>
                  setPrompt("Book 2 movie tickets for 8:30 PM")
                }
              >
                Book 2 movie tickets
              </button>
            </div>
          )}

          {/* PROMPT */}
          <div className="prompt-wrapper">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  runTask();
                }
              }}
              placeholder="Ask anything or tell BlackBox what to do..."
              rows={1}
            />

            <div className="prompt-actions">
              <button>＋</button>

              <button>🎙</button>

              <button
                className="execute"
                onClick={runTask}
                disabled={!prompt.trim() || running}
              >
                {running ? "Running..." : "➤"}
              </button>
            </div>
          </div>

          {/* EXECUTION STATUS */}
          {running && (
            <div className="execution">
              <div className="execution-title">
                <span className="loader"></span>
                BlackBox is executing
              </div>

              <div className="steps">
                <span className="done">
                  ✓ Understand request
                </span>

                <span className="done">
                  ✓ Planning
                </span>

                <span className="active-step">
                  ● Executing
                </span>

                <span>
                  ○ Recording
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FLIGHT RECORDER */}
     {/* FLIGHT RECORDER */}
<aside className="recorder">
  <div className="recorder-header">
    <div>
      <h3>FLIGHT RECORDER</h3>
      <span>Live execution trace</span>
    </div>

    <div className="live">
      LIVE
    </div>
  </div>

  <div className="timeline">
    {recorderEvents.length === 0 ? (
      <div className="empty-recorder">
        <div className="empty-icon">◌</div>

        <p>Waiting for task...</p>

        <small>
          BlackBox execution events will appear here
        </small>
      </div>
    ) : (
      recorderEvents.map((event, index) => {
        const isSuccess =
          event.status === "success";

        const isError =
          event.status === "error";

        const isPartial =
          event.status === "partial";

        const isVerification =
          event.type === "verification";

        return (
          <div
            key={index}
            className={`event ${
              isSuccess
                ? "success"
                : isError
                ? "error-event"
                : isPartial
                ? "partial-event"
                : "active-event"
            }`}
          >
            <div className="event-line">
              <div className="event-dot">
                {isSuccess
                  ? "✓"
                  : isError
                  ? "!"
                  : isPartial
                  ? "◐"
                  : isVerification
                  ? "◈"
                  : "●"}
              </div>

              {index <
                recorderEvents.length - 1 && (
                <div className="event-connector" />
              )}
            </div>

            <div className="event-content">
              <strong>
                {event.message}
              </strong>

              {event.model && (
                <small>
                  Model: {event.model}
                </small>
              )}

              {!event.model && (
                <small>
                  {event.type === "verification"
                    ? "Verification Engine"
                    : event.type === "request"
                    ? "BlackBox Core"
                    : event.type === "final"
                    ? "Output"
                    : event.status}
                </small>
              )}
            </div>
          </div>
        );
      })
    )}
  </div>

  <div className="recorder-footer">
    <div>
      <span>Models</span>
      <strong>
        {modelCount}
      </strong>
    </div>

    <div>
      <span>Actions</span>
      <strong>
        {actionCount}
      </strong>
    </div>

    <div>
      <span>Errors</span>
      <strong>
        {errorCount}
      </strong>
    </div>
  </div>
</aside>
    </main>
  );
}