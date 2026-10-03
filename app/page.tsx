"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const runTask = async () => {
    if (!prompt.trim() || running) return;

    const userMessage = prompt.trim();

    // Add user message
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
      <aside className="recorder">
        <div className="recorder-header">
          <div>
            <h3>FLIGHT RECORDER</h3>

            <span>Live execution trace</span>
          </div>

          <div className="live">LIVE</div>
        </div>

        <div className="timeline">
          <div className="event success">
            <div className="event-dot">✓</div>

            <div>
              <strong>Request understood</strong>
              <small>Ready</small>
            </div>
          </div>

          <div className="event success">
            <div className="event-dot">✓</div>

            <div>
              <strong>Planning execution</strong>
              <small>Ready</small>
            </div>
          </div>

          <div className="event success">
            <div className="event-dot">✓</div>

            <div>
              <strong>AI verification</strong>
              <small>Ready</small>
            </div>
          </div>

          <div className="event active-event">
            <div className="event-dot">●</div>

            <div>
              <strong>
                {running ? "Executing task" : "Waiting for task"}
              </strong>

              <small>
                {running ? "Running..." : "Ready"}
              </small>
            </div>
          </div>
        </div>

        <div className="recorder-footer">
          <div>
            <span>Models</span>
            <strong>1</strong>
          </div>

          <div>
            <span>Actions</span>
            <strong>0</strong>
          </div>

          <div>
            <span>Errors</span>
            <strong>0</strong>
          </div>
        </div>
      </aside>
    </main>
  );
}