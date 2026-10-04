"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type RecorderEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  status?: string;
  source?: string;
  timestamp: string;
};

type RunStatus =
  | "idle"
  | "thinking"
  | "executing"
  | "recovering"
  | "success"
  | "error";

const eventIcon: Record<string, string> = {
  voice: "🎙",
  request: "→",
  understand: "◎",
  planning: "◇",
  permission: "!",
  security: "🔒",
  model: "✦",
  verification: "✓",
  execution: "▶",
  action: "⚡",
  error: "×",
  recovery: "↻",
  retry: "↻",
  final: "●",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [events, setEvents] = useState<RecorderEvent[]>([]);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [task, setTask] = useState("No active task");
  const [isRunning, setIsRunning] = useState(false);

  // Voice Assistant
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const voiceTranscriptRef = useRef("");
  const voiceAutoRunRef = useRef(false);

  const timelineRef = useRef<HTMLDivElement | null>(null);

  /*
   * Scroll Flight Recorder automatically
   */
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop =
        timelineRef.current.scrollHeight;
    }
  }, [events]);

  /*
   * Initialize Browser Speech Recognition
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);

      setEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-voice-support`,
          type: "voice",
          title: "Voice assistant unavailable",
          detail:
            "Speech recognition is not supported in this browser. Please use Google Chrome.",
          status: "error",
          source: "Voice Assistant",
          timestamp: new Date().toISOString(),
        },
      ]);

      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);

      setEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-voice-start`,
          type: "voice",
          title: "Voice assistant activated",
          detail:
            "BlackBox is listening for your command.",
          status: "active",
          source: "Voice Assistant",
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0]?.transcript || "";

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const combinedTranscript = (
        finalTranscript || interimTranscript
      ).trim();

      if (combinedTranscript) {
        setInput(combinedTranscript);
        voiceTranscriptRef.current =
          combinedTranscript;
      }

      if (finalTranscript.trim()) {
        setEvents((prev) => [
          ...prev,
          {
            id: `${Date.now()}-voice-command`,
            type: "voice",
            title: "Voice command captured",
            detail: finalTranscript.trim(),
            status: "success",
            source: "Speech Recognition",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    };

    recognition.onerror = (event: any) => {
      const errorType = event?.error || "unknown";

      let errorMessage =
        "Voice recognition failed.";

      if (errorType === "not-allowed") {
        errorMessage =
          "Microphone permission was denied. Allow microphone access in Chrome.";
      } else if (errorType === "no-speech") {
        errorMessage =
          "No speech was detected. Please try speaking again.";
      } else if (errorType === "audio-capture") {
        errorMessage =
          "No microphone was detected on this device.";
      } else if (errorType === "network") {
        errorMessage =
          "Speech recognition network error occurred.";
      }

      setIsListening(false);
      voiceAutoRunRef.current = false;

      setEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-voice-error`,
          type: "voice",
          title: "Voice recognition error",
          detail: errorMessage,
          status: "error",
          source: "Voice Assistant",
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    recognition.onend = () => {
      setIsListening(false);

      const transcript =
        voiceTranscriptRef.current.trim();

      const shouldRun =
        voiceAutoRunRef.current &&
        transcript.length > 0;

      voiceAutoRunRef.current = false;

      if (shouldRun) {
        setTimeout(() => {
          runTask(transcript);
        }, 250);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}

      recognitionRef.current = null;
    };
  }, []);

  /*
   * Stop any current speech
   */
  function stopSpeaking() {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }
  }

  /*
   * AI Voice Output
   */
  function speakResponse(text: string) {
    if (typeof window === "undefined") return;

    if (!("speechSynthesis" in window)) {
      return;
    }

    stopSpeaking();

    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/[`#]/g, "")
      .replace(/\n+/g, " ")
      .trim();

    if (!cleanText) return;

    const utterance =
      new SpeechSynthesisUtterance(cleanText);

    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-voice-output-start`,
          type: "voice",
          title: "Voice response started",
          detail:
            "BlackBox is speaking the final response.",
          status: "active",
          source: "Speech Synthesis",
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    utterance.onend = () => {
      setEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-voice-output-end`,
          type: "voice",
          title: "Voice response delivered",
          detail:
            "AI response was successfully delivered through voice output.",
          status: "success",
          source: "Speech Synthesis",
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    utterance.onerror = () => {
      setEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-voice-output-error`,
          type: "voice",
          title: "Voice output error",
          detail:
            "The AI response could not be spoken by the browser.",
          status: "error",
          source: "Speech Synthesis",
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    window.speechSynthesis.speak(
      utterance
    );
  }

  /*
   * Start / Stop Voice Assistant
   */
  function toggleVoiceAssistant() {
    if (!voiceSupported) {
      setEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-voice-unsupported`,
          type: "voice",
          title: "Voice assistant unavailable",
          detail:
            "Speech recognition is not supported in this browser. Please use Google Chrome.",
          status: "error",
          source: "Voice Assistant",
          timestamp: new Date().toISOString(),
        },
      ]);

      return;
    }

    if (isRunning) return;

    const recognition =
      recognitionRef.current;

    if (!recognition) {
      setEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-voice-init-error`,
          type: "voice",
          title: "Voice assistant initialization failed",
          detail:
            "Speech recognition could not be initialized.",
          status: "error",
          source: "Voice Assistant",
          timestamp: new Date().toISOString(),
        },
      ]);

      return;
    }

    /*
     * Stop listening
     */
    if (isListening) {
      voiceAutoRunRef.current = false;

      try {
        recognition.stop();
      } catch {}

      setIsListening(false);
      return;
    }

    /*
     * Start listening
     */
    stopSpeaking();

    setInput("");
    voiceTranscriptRef.current = "";
    voiceAutoRunRef.current = true;

    try {
      recognition.start();
    } catch (error) {
      console.error(
        "Could not start voice assistant:",
        error
      );

      voiceAutoRunRef.current = false;
      setIsListening(false);

      setEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-voice-start-error`,
          type: "voice",
          title: "Could not start microphone",
          detail:
            "The microphone could not be started. Try again or check Chrome microphone permissions.",
          status: "error",
          source: "Voice Assistant",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }

  const failureCount = useMemo(
    () =>
      events.filter(
        (e) => e.status === "error"
      ).length,
    [events]
  );

  const retryCount = useMemo(
    () =>
      events.filter(
        (e) => e.type === "retry"
      ).length,
    [events]
  );

  const recoveryCompleted = useMemo(
    () =>
      events.some(
        (e) =>
          e.type === "recovery" &&
          e.title
            .toLowerCase()
            .includes("completed") &&
          e.status === "success"
      ),
    [events]
  );

  const latestEvent =
    events[events.length - 1];

  function getStatusLabel() {
    switch (status) {
      case "thinking":
        return "THINKING";

      case "executing":
        return "EXECUTING";

      case "recovering":
        return "RECOVERING";

      case "success":
        return "COMPLETED";

      case "error":
        return "FAILED";

      default:
        return "READY";
    }
  }

  function getStatusClass() {
    switch (status) {
      case "thinking":
        return "status-thinking";

      case "executing":
        return "status-executing";

      case "recovering":
        return "status-recovering";

      case "success":
        return "status-success";

      case "error":
        return "status-error";

      default:
        return "status-idle";
    }
  }

  /*
   * Main BlackBox Task Runner
   */
  async function runTask(
    customInput?: string
  ) {
    const text = (
      customInput ?? input
    ).trim();

    if (!text || isRunning) return;

    stopSpeaking();

    setInput("");
    setTask(text);
    setIsRunning(true);
    setStatus("thinking");
    setEvents([]);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
      },
    ]);

    try {
      const formData =
        new FormData();

      formData.append(
        "message",
        text
      );

      const response =
        await fetch("/api/chat", {
          method: "POST",
          body: formData,
        });

      if (
        !response.ok ||
        !response.body
      ) {
        throw new Error(
          "Unable to connect to BlackBox backend."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          {
            stream: true,
          }
        );

        const chunks =
          buffer.split("\n\n");

        buffer =
          chunks.pop() || "";

        for (const chunk of chunks) {
          const line =
            chunk
              .split("\n")
              .find((item) =>
                item.startsWith(
                  "data: "
                )
              );

          if (!line) continue;

          try {
            const payload =
              JSON.parse(
                line.slice(6)
              );

            /*
             * Flight Recorder Event
             */
            if (payload.event) {
              const incoming: RecorderEvent =
                payload.event;

              setEvents((prev) => [
                ...prev,
                incoming,
              ]);

              if (
                incoming.type ===
                  "recovery" ||
                incoming.type ===
                  "retry"
              ) {
                setStatus(
                  "recovering"
                );
              } else if (
                incoming.type ===
                  "execution" ||
                incoming.type ===
                  "action"
              ) {
                if (
                  incoming.status ===
                  "active"
                ) {
                  setStatus(
                    "executing"
                  );
                }
              } else if (
                incoming.type ===
                  "model" ||
                incoming.type ===
                  "verification"
              ) {
                if (
                  incoming.status ===
                  "active"
                ) {
                  setStatus(
                    "thinking"
                  );
                }
              }

              if (
                incoming.type ===
                  "final" &&
                incoming.status ===
                  "success"
              ) {
                setStatus(
                  "success"
                );
              }

              if (
                incoming.type ===
                  "final" &&
                incoming.status ===
                  "error"
              ) {
                setStatus(
                  "error"
                );
              }
            }

            /*
             * Final AI Response
             */
            if (payload.final) {
              const answer =
                payload.final
                  .answer ||
                "Task completed.";

              setMessages(
                (prev) => [
                  ...prev,
                  {
                    role:
                      "assistant",
                    content:
                      answer,
                  },
                ]
              );

              /*
               * Speak AI response
               */
              speakResponse(
                answer
              );

              setEvents(
                (prev) => [
                  ...prev,
                  {
                    id: `${Date.now()}-voice-response`,
                    type: "voice",
                    title:
                      "BlackBox voice response",
                    detail:
                      "AI response delivered through voice output.",
                    status:
                      "success",
                    source:
                      "Voice Assistant",
                    timestamp:
                      new Date().toISOString(),
                  },
                ]
              );

              if (
                payload.final
                  .recovery
              ) {
                setStatus(
                  "success"
                );
              }
            }

            /*
             * Backend Error
             */
            if (payload.error) {
              setMessages(
                (prev) => [
                  ...prev,
                  {
                    role:
                      "assistant",
                    content:
                      payload.error,
                  },
                ]
              );

              setStatus(
                "error"
              );
            }
          } catch {
            /*
             * Ignore incomplete SSE chunks
             */
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      setMessages(
        (prev) => [
          ...prev,
          {
            role: "assistant",
            content: message,
          },
        ]
      );

      setStatus("error");

      setEvents(
        (prev) => [
          ...prev,
          {
            id: `${Date.now()}`,
            type: "error",
            title:
              "Connection error",
            detail: message,
            status: "error",
            source:
              "BlackBox",
            timestamp:
              new Date().toISOString(),
          },
        ]
      );
    } finally {
      setIsRunning(false);
    }
  }

  function formatTime(
    timestamp: string
  ) {
    try {
      return new Date(
        timestamp
      ).toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }
      );
    } catch {
      return "";
    }
  }

  return (
    <main className="app-shell">
      {/* ================= SIDEBAR ================= */}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>

          <div>
            <div className="brand-name">
              BLACKBOX
            </div>

            <div className="brand-subtitle">
              AI FLIGHT RECORDER
            </div>
          </div>
        </div>

        <button
          className="new-task"
          onClick={() => {
            stopSpeaking();

            if (isListening) {
              voiceAutoRunRef.current =
                false;

              try {
                recognitionRef.current?.stop();
              } catch {}

              setIsListening(
                false
              );
            }

            setMessages([]);
            setEvents([]);
            setTask(
              "No active task"
            );
            setStatus("idle");
            setInput("");
          }}
        >
          <span>＋</span>
          New Task
        </button>

        <nav className="nav">
          <div className="nav-item active">
            <span>⌁</span>
            Chat
          </div>

          <div className="nav-item">
            <span>▣</span>
            Tasks
          </div>

          <div className="nav-item">
            <span>◈</span>
            Flight Recorder
          </div>

          <div className="nav-item">
            <span>◷</span>
            History
          </div>

          <div className="nav-item">
            <span>⌘</span>
            Connected Apps
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-dot" />

            <div>
              <div className="system-title">
                SYSTEM ONLINE
              </div>

              <div className="system-text">
                Flight Recorder active
              </div>
            </div>
          </div>

          <div className="nav-item">
            <span>⚙</span>
            Settings
          </div>
        </div>
      </aside>

      {/* ================= CHAT AREA ================= */}

      <section className="chat-area">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              AUTONOMOUS AI CONTROL CENTER
            </div>

            <h1>
              Think. Verify. Act.{" "}
              <span>
                Record. Recover.
              </span>
            </h1>
          </div>

          <div
            className={`run-status ${getStatusClass()}`}
          >
            <span className="status-dot" />
            {getStatusLabel()}
          </div>
        </header>

        <div className="chat-content">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="orb">
                <div className="orb-core" />
                <div className="orb-ring ring-one" />
                <div className="orb-ring ring-two" />
                <div className="orb-ring ring-three" />
              </div>

              <div className="welcome-label">
                BLACKBOX AI
              </div>

              <h2>
                Your AI agent,
                <br />
                <span>
                  with a flight recorder.
                </span>
              </h2>

              <p>
                Ask questions, execute
                tasks, verify decisions,
                and watch every important
                step get recorded.
              </p>

              <div className="examples">
                <button
                  onClick={() =>
                    runTask(
                      "What is the capital of Australia?"
                    )
                  }
                >
                  <span>✦</span>
                  Ask a question
                </button>

                <button
                  onClick={() =>
                    runTask(
                      "Search for OpenAI"
                    )
                  }
                >
                  <span>⌕</span>
                  Search the web
                </button>

                <button
                  onClick={() =>
                    runTask(
                      "simulate browser failure and recover"
                    )
                  }
                >
                  <span>↻</span>
                  Test recovery
                </button>
              </div>
            </div>
          ) : (
            <div className="conversation">
              {messages.map(
                (
                  message,
                  index
                ) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`message ${
                      message.role ===
                      "user"
                        ? "message-user"
                        : "message-ai"
                    }`}
                  >
                    <div className="message-label">
                      {message.role ===
                      "user"
                        ? "YOU"
                        : "BLACKBOX AI"}
                    </div>

                    <div className="message-content">
                      {message.content}
                    </div>
                  </div>
                )
              )}

              {isRunning && (
                <div className="thinking">
                  <span />
                  <span />
                  <span />
                  BlackBox is working...
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= COMPOSER ================= */}

        <div className="composer-wrap">
          <div className="composer">
            <textarea
              value={input}
              onChange={(e) =>
                setInput(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  runTask();
                }
              }}
              placeholder={
                isListening
                  ? "🎙 Listening... speak your command"
                  : "Ask BlackBox to think, verify, or act..."
              }
              rows={1}
              disabled={isRunning}
            />

            {/* MICROPHONE BUTTON */}

            <button
              type="button"
              className={`voice-button ${
                isListening
                  ? "voice-active"
                  : ""
              }`}
              onClick={
                toggleVoiceAssistant
              }
              disabled={isRunning}
              title={
                isListening
                  ? "Stop listening"
                  : "Start voice assistant"
              }
            >
              {isListening
                ? "■"
                : "🎙"}
            </button>

            {/* SEND BUTTON */}

            <button
              className="send-button"
              onClick={() =>
                runTask()
              }
              disabled={
                !input.trim() ||
                isRunning
              }
            >
              {isRunning
                ? "..."
                : "↑"}
            </button>
          </div>

          <div className="composer-hint">
            <span>
              Enter to run
            </span>

            <span>
              🎙 Voice commands supported
            </span>

            <span>
              Sensitive actions require permission
            </span>
          </div>
        </div>
      </section>

      {/* ================= FLIGHT RECORDER ================= */}

      <aside className="recorder">
        <div className="recorder-header">
          <div>
            <div className="recorder-title">
              FLIGHT RECORDER
            </div>

            <div className="recorder-subtitle">
              EXECUTION TELEMETRY
            </div>
          </div>

          <div className="live-badge">
            <span />
            LIVE
          </div>
        </div>

        <div className="task-box">
          <div className="small-label">
            CURRENT TASK
          </div>

          <div className="task-name">
            {task}
          </div>
        </div>

        <div className="telemetry-grid">
          <div>
            <span>EVENTS</span>
            <strong>
              {events.length}
            </strong>
          </div>

          <div>
            <span>FAILURES</span>
            <strong>
              {failureCount}
            </strong>
          </div>

          <div>
            <span>RETRIES</span>
            <strong>
              {retryCount}
            </strong>
          </div>

          <div>
            <span>RECOVERED</span>
            <strong>
              {recoveryCompleted
                ? "YES"
                : "—"}
            </strong>
          </div>
        </div>

        <div className="timeline-header">
          <span>
            EXECUTION TIMELINE
          </span>

          {latestEvent && (
            <span className="latest">
              {latestEvent.type.toUpperCase()}
            </span>
          )}
        </div>

        <div
          className="timeline"
          ref={timelineRef}
        >
          {events.length === 0 ? (
            <div className="empty-recorder">
              <div className="empty-icon">
                ◈
              </div>

              <div>
                <strong>
                  Recorder standing by
                </strong>

                <p>
                  Run a task to see AI
                  decisions, actions,
                  failures and recovery.
                </p>
              </div>
            </div>
          ) : (
            events.map(
              (item) => (
                <div
                  className={`timeline-item ${
                    item.status ||
                    "success"
                  }`}
                  key={item.id}
                >
                  <div className="timeline-line">
                    <div className="event-icon">
                      {eventIcon[
                        item.type
                      ] || "•"}
                    </div>
                  </div>

                  <div className="event-body">
                    <div className="event-top">
                      <strong>
                        {item.title}
                      </strong>

                      <span>
                        {formatTime(
                          item.timestamp
                        )}
                      </span>
                    </div>

                    <p>
                      {item.detail}
                    </p>

                    <div className="event-source">
                      {item.source ||
                        "BlackBox"}
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>

        <div className="recorder-footer">
          <div className="footer-check">
            <span>✓</span>

            <div>
              <strong>
                Trace integrity
              </strong>

              <small>
                Events are being
                recorded in real time
              </small>
            </div>
          </div>

          <div className="tagline">
            BLACKBOX / OBSERVABLE AI
          </div>
        </div>
      </aside>

      {/* ================= CSS ================= */}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #050607;
          color: #f4f4f4;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        body {
          min-height: 100vh;
        }

        button,
        textarea {
          font: inherit;
        }

        button {
          border: 0;
        }

        .app-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr) 390px;
          background:
            radial-gradient(
              circle at 45% 20%,
              rgba(255, 255, 255, 0.045),
              transparent 30%
            ),
            #050607;
        }

        .sidebar {
          border-right: 1px solid #1b1e21;
          background: #080a0b;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 8px 28px;
        }

        .brand-mark {
          width: 28px;
          height: 28px;
          border: 1px solid #444;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          transform: rotate(45deg);
        }

        .brand-mark span {
          width: 3px;
          height: 13px;
          background: #fff;
          border-radius: 2px;
        }

        .brand-name {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .brand-subtitle {
          color: #666;
          font-size: 7px;
          letter-spacing: 0.18em;
          margin-top: 2px;
        }

        .new-task {
          width: 100%;
          background: #f1f1f1;
          color: #080909;
          border-radius: 9px;
          padding: 11px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          cursor: pointer;
          margin-bottom: 24px;
        }

        .new-task:hover {
          background: #fff;
        }

        .nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-item {
          color: #777;
          padding: 10px 11px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 11px;
          font-size: 13px;
          cursor: pointer;
        }

        .nav-item span {
          width: 17px;
          text-align: center;
          color: #888;
        }

        .nav-item.active {
          color: #fff;
          background: #151719;
        }

        .nav-item.active span {
          color: #fff;
        }

        .sidebar-bottom {
          margin-top: auto;
        }

        .system-card {
          display: flex;
          gap: 9px;
          align-items: center;
          padding: 12px;
          margin-bottom: 8px;
          background: #0d1011;
          border: 1px solid #191c1e;
          border-radius: 9px;
        }

        .system-dot,
        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
        }

        .system-title {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .system-text {
          font-size: 9px;
          color: #666;
          margin-top: 2px;
        }

        .chat-area {
          min-width: 0;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .topbar {
          height: 86px;
          border-bottom: 1px solid #17191b;
          padding: 19px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .eyebrow {
          color: #555;
          font-size: 8px;
          letter-spacing: 0.2em;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .topbar h1 {
          margin: 0;
          font-size: 18px;
          letter-spacing: -0.03em;
        }

        .topbar h1 span {
          color: #777;
        }

        .run-status {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border: 1px solid #202326;
          border-radius: 999px;
          font-size: 9px;
          letter-spacing: 0.1em;
          font-weight: 800;
        }

        .status-thinking .status-dot {
          animation: pulse 1s infinite;
        }

        .status-executing .status-dot {
          animation: pulse 0.8s infinite;
        }

        .status-recovering .status-dot {
          animation: pulse 0.6s infinite;
        }

        .status-success .status-dot {
          background: #fff;
        }

        .status-error .status-dot {
          background: #999;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: 0.35;
            transform: scale(0.7);
          }
        }

        .chat-content {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }

        .welcome {
          max-width: 760px;
          margin: auto;
          padding: 80px 30px 140px;
          text-align: center;
        }

        .orb {
          width: 150px;
          height: 150px;
          margin: 0 auto 35px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .orb-core {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: #f4f4f4;
          box-shadow:
            0 0 35px rgba(255, 255, 255, 0.18),
            inset 0 0 25px rgba(0, 0, 0, 0.25);
        }

        .orb-ring {
          position: absolute;
          inset: 15px;
          border: 1px solid #333;
          border-radius: 50%;
          transform: rotate(20deg);
        }

        .ring-two {
          inset: 3px 24px;
          transform: rotate(65deg);
        }

        .ring-three {
          inset: 25px 5px;
          transform: rotate(-45deg);
        }

        .welcome-label {
          color: #777;
          font-size: 9px;
          letter-spacing: 0.3em;
          font-weight: 800;
        }

        .welcome h2 {
          font-size: 42px;
          line-height: 1.03;
          letter-spacing: -0.055em;
          margin: 13px 0 15px;
        }

        .welcome h2 span {
          color: #696969;
        }

        .welcome p {
          max-width: 520px;
          margin: auto;
          color: #777;
          line-height: 1.6;
          font-size: 13px;
        }

        .examples {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 30px;
        }

        .examples button {
          color: #aaa;
          background: #0c0e0f;
          border: 1px solid #202326;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 11px;
          cursor: pointer;
        }

        .examples button:hover {
          border-color: #444;
          color: #fff;
        }

        .examples button span {
          margin-right: 6px;
        }

        .conversation {
          max-width: 850px;
          margin: 0 auto;
          padding: 35px 28px 160px;
        }

        .message {
          margin-bottom: 26px;
        }

        .message-label {
          color: #555;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.18em;
          margin-bottom: 8px;
        }

        .message-content {
          white-space: pre-wrap;
          line-height: 1.65;
          font-size: 14px;
        }

        .message-user .message-content {
          background: #111315;
          border: 1px solid #202326;
          border-radius: 10px;
          padding: 13px 15px;
        }

        .message-ai .message-content {
          color: #d2d2d2;
        }

        .thinking {
          color: #666;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .thinking span {
          width: 4px;
          height: 4px;
          background: #aaa;
          border-radius: 50%;
          animation: blink 1s infinite;
        }

        .thinking span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .thinking span:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes blink {
          0%,
          100% {
            opacity: 0.2;
          }

          50% {
            opacity: 1;
          }
        }

        .composer-wrap {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 20px 28px 18px;
          background: linear-gradient(
            transparent,
            #050607 28%
          );
        }

        .composer {
          max-width: 850px;
          margin: 0 auto;
          display: flex;
          align-items: flex-end;
          gap: 10px;
          background: #0d0f10;
          border: 1px solid #282b2e;
          border-radius: 12px;
          padding: 9px;
          box-shadow: 0 10px 50px rgba(0, 0, 0, 0.35);
        }

        .composer textarea {
          flex: 1;
          resize: none;
          border: 0;
          outline: none;
          background: transparent;
          color: #fff;
          min-height: 30px;
          max-height: 100px;
          padding: 8px 7px;
          font-size: 13px;
        }

        .composer textarea::placeholder {
          color: #555;
        }

        /* ================= VOICE BUTTON ================= */

        .voice-button {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #151719;
          color: #aaa;
          border: 1px solid #292c2f;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition:
            background 0.2s ease,
            color 0.2s ease,
            border-color 0.2s ease,
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .voice-button:hover {
          background: #1d2022;
          color: #fff;
          border-color: #444;
          transform: translateY(-1px);
        }

        .voice-button:disabled {
          opacity: 0.25;
          cursor: default;
          transform: none;
        }

        .voice-button.voice-active {
          background: #f1f1f1;
          color: #050607;
          border-color: #fff;
          animation: voicePulse 1s infinite;
        }

        @keyframes voicePulse {
          0% {
            box-shadow:
              0 0 0 0
              rgba(255, 255, 255, 0.35);
          }

          70% {
            box-shadow:
              0 0 0 9px
              rgba(255, 255, 255, 0);
          }

          100% {
            box-shadow:
              0 0 0 0
              rgba(255, 255, 255, 0);
          }
        }

        .send-button {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #eee;
          color: #080808;
          font-weight: 900;
          cursor: pointer;
        }

        .send-button:disabled {
          opacity: 0.25;
          cursor: default;
        }

        .composer-hint {
          max-width: 850px;
          margin: 8px auto 0;
          display: flex;
          justify-content: space-between;
          color: #444;
          font-size: 8px;
          letter-spacing: 0.08em;
          gap: 10px;
        }

        .recorder {
          min-height: 100vh;
          border-left: 1px solid #1b1e21;
          background: #080a0b;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .recorder-header {
          height: 86px;
          padding: 18px 20px;
          border-bottom: 1px solid #1b1e21;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .recorder-title {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .recorder-subtitle {
          color: #555;
          font-size: 7px;
          letter-spacing: 0.18em;
          margin-top: 5px;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.12em;
          color: #aaa;
        }

        .live-badge span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #fff;
          animation: pulse 1.2s infinite;
        }

        .task-box {
          margin: 15px;
          padding: 13px;
          border: 1px solid #1e2124;
          background: #0c0e0f;
          border-radius: 8px;
        }

        .small-label {
          color: #555;
          font-size: 7px;
          letter-spacing: 0.15em;
          font-weight: 900;
          margin-bottom: 7px;
        }

        .task-name {
          color: #ccc;
          font-size: 11px;
          line-height: 1.45;
          word-break: break-word;
        }

        .telemetry-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          margin: 0 15px 16px;
          border: 1px solid #1e2124;
          border-radius: 8px;
          overflow: hidden;
        }

        .telemetry-grid div {
          padding: 10px 7px;
          text-align: center;
          border-right: 1px solid #1e2124;
        }

        .telemetry-grid div:last-child {
          border-right: 0;
        }

        .telemetry-grid span {
          display: block;
          color: #4f4f4f;
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.08em;
          margin-bottom: 5px;
        }

        .telemetry-grid strong {
          font-size: 12px;
        }

        .timeline-header {
          padding: 0 18px 9px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #555;
          font-size: 7px;
          letter-spacing: 0.16em;
          font-weight: 900;
        }

        .latest {
          color: #999;
        }

        .timeline {
          flex: 1;
          overflow-y: auto;
          padding: 0 18px 15px;
          min-height: 0;
        }

        .timeline-item {
          display: flex;
          gap: 10px;
          position: relative;
          padding-bottom: 15px;
        }

        .timeline-line {
          position: relative;
          width: 20px;
          flex: 0 0 20px;
          display: flex;
          justify-content: center;
        }

        .timeline-item:not(:last-child)
          .timeline-line::after {
          content: "";
          position: absolute;
          top: 21px;
          bottom: -2px;
          width: 1px;
          background: #202326;
        }

        .event-icon {
          width: 19px;
          height: 19px;
          border: 1px solid #292c2f;
          border-radius: 50%;
          background: #0d0f10;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #888;
          font-size: 8px;
          z-index: 1;
        }

        .timeline-item.active
          .event-icon {
          color: #fff;
          animation: pulse 1s infinite;
        }

        .timeline-item.error
          .event-icon {
          color: #bbb;
          border-color: #555;
        }

        .timeline-item.success
          .event-icon {
          color: #eee;
        }

        .event-body {
          min-width: 0;
          flex: 1;
        }

        .event-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .event-top strong {
          font-size: 10px;
          color: #ddd;
          font-weight: 700;
        }

        .event-top span {
          flex: 0 0 auto;
          color: #3f3f3f;
          font-size: 7px;
        }

        .event-body p {
          margin: 4px 0 4px;
          color: #686868;
          font-size: 9px;
          line-height: 1.45;
        }

        .event-source {
          display: inline-block;
          color: #4f4f4f;
          font-size: 6px;
          border: 1px solid #1d2022;
          border-radius: 4px;
          padding: 2px 4px;
          letter-spacing: 0.05em;
        }

        .empty-recorder {
          min-height: 160px;
          border: 1px dashed #202326;
          border-radius: 8px;
          padding: 18px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          color: #555;
        }

        .empty-icon {
          color: #777;
          font-size: 18px;
        }

        .empty-recorder strong {
          color: #777;
          font-size: 10px;
        }

        .empty-recorder p {
          color: #444;
          font-size: 9px;
          line-height: 1.5;
          margin: 6px 0 0;
        }

        .recorder-footer {
          border-top: 1px solid #1b1e21;
          padding: 14px 18px;
        }

        .footer-check {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .footer-check > span {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1px solid #303336;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
        }

        .footer-check strong {
          display: block;
          font-size: 9px;
        }

        .footer-check small {
          color: #4f4f4f;
          font-size: 7px;
        }

        .tagline {
          color: #303234;
          font-size: 6px;
          letter-spacing: 0.2em;
          margin-top: 12px;
        }

        @media (max-width: 1100px) {
          .app-shell {
            grid-template-columns:
              190px
              minmax(0, 1fr);
          }

          .recorder {
            display: none;
          }
        }

        @media (max-width: 720px) {
          .app-shell {
            display: block;
          }

          .sidebar {
            display: none;
          }

          .topbar {
            padding: 15px;
          }

          .topbar h1 {
            font-size: 14px;
          }

          .welcome {
            padding: 60px 20px 120px;
          }

          .welcome h2 {
            font-size: 34px;
          }

          .composer-wrap {
            padding: 15px;
          }

          .composer-hint {
            flex-wrap: wrap;
          }

          .composer-hint span:nth-child(2) {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}