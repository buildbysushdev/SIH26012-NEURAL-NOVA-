import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  sendGroqCopilotMessage,
  PRIMARY_MODEL,
} from "../../services/groqChatbot";
import type {
  ChatMessage,
  CopilotContext,
} from "../../services/groqChatbot";

interface AuditAssistantChatbotProps {
  variant: "officer" | "super_admin";
  currentPage?: string;
  selectedWorkId?: string;
}

export default function AuditAssistantChatbot({
  variant,
  currentPage,
  selectedWorkId,
}: AuditAssistantChatbotProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const STORAGE_KEY_BTN = "mplads_copilot_btn_pos";
  const STORAGE_KEY_WIN = "mplads_copilot_win_pos";

  // Free-hanging position state for button
  const [btnPos, setBtnPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number; moved: boolean } | null>(null);
  const isDragging = useRef(false);

  // Free-hanging position state for open chat window
  const [winPos, setWinPos] = useState<{ x: number; y: number } | null>(null);
  const winDragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      let restoredBtn: { x: number; y: number } | null = null;
      try {
        const saved = localStorage.getItem(STORAGE_KEY_BTN);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            restoredBtn = {
              x: Math.max(8, Math.min(window.innerWidth - 220, parsed.x)),
              y: Math.max(8, Math.min(window.innerHeight - 60, parsed.y)),
            };
          }
        }
      } catch (_) {}

      if (restoredBtn) {
        setBtnPos(restoredBtn);
      } else {
        setBtnPos({
          x: Math.max(16, window.innerWidth - 240),
          y: Math.max(16, window.innerHeight - 80),
        });
      }

      try {
        const savedWin = localStorage.getItem(STORAGE_KEY_WIN);
        if (savedWin) {
          const parsed = JSON.parse(savedWin);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            setWinPos({
              x: Math.max(8, Math.min(window.innerWidth - 380, parsed.x)),
              y: Math.max(8, Math.min(window.innerHeight - 200, parsed.y)),
            });
          }
        }
      } catch (_) {}
    }
  }, []);

  const handleBtnPointerDown = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const curX = rect ? rect.left : (btnPos?.x ?? (window.innerWidth - 240));
    const curY = rect ? rect.top : (btnPos?.y ?? (window.innerHeight - 80));
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: curX,
      initY: curY,
      moved: false,
    };
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleBtnPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.moved = true;
    }
    const w = containerRef.current?.offsetWidth || 220;
    const h = containerRef.current?.offsetHeight || 48;
    const rawX = dragRef.current.initX + dx;
    const rawY = dragRef.current.initY + dy;
    const newX = Math.max(8, Math.min(window.innerWidth - w - 8, rawX));
    const newY = Math.max(8, Math.min(window.innerHeight - h - 8, rawY));
    setBtnPos({ x: newX, y: newY });
  };

  const handleBtnPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);

    if (dragRef.current?.moved && btnPos) {
      const w = containerRef.current?.offsetWidth || 220;
      const h = containerRef.current?.offsetHeight || 48;
      let finalX = btnPos.x;
      let finalY = btnPos.y;

      // Smart edge snapping if dragged near screen boundary (within 28px)
      if (finalX < 28) finalX = 8;
      else if (finalX > window.innerWidth - w - 28) finalX = window.innerWidth - w - 8;
      if (finalY < 28) finalY = 8;
      else if (finalY > window.innerHeight - h - 28) finalY = window.innerHeight - h - 8;

      setBtnPos({ x: finalX, y: finalY });
      try {
        localStorage.setItem(STORAGE_KEY_BTN, JSON.stringify({ x: finalX, y: finalY }));
      } catch (_) {}
    }
  };

  const handleBtnClick = () => {
    if (dragRef.current?.moved) {
      dragRef.current.moved = false;
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleWinPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const curX = winPos?.x ?? Math.max(12, window.innerWidth - 460);
    const curY = winPos?.y ?? Math.max(12, window.innerHeight - 620);
    winDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: curX,
      initY: curY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleWinPointerMove = (e: React.PointerEvent) => {
    if (!winDragRef.current) return;
    const dx = e.clientX - winDragRef.current.startX;
    const dy = e.clientY - winDragRef.current.startY;
    const newX = Math.max(8, Math.min(window.innerWidth - 380, winDragRef.current.initX + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - 200, winDragRef.current.initY + dy));
    setWinPos({ x: newX, y: newY });
  };

  const handleWinPointerUp = (e: React.PointerEvent) => {
    winDragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (winPos) {
      try {
        localStorage.setItem(STORAGE_KEY_WIN, JSON.stringify(winPos));
      } catch (_) {}
    }
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome-1",
      role: "assistant",
      content: `### 🇮🇳 Namaste ${
        variant === "super_admin" ? "Super Administrator" : "Auditing Officer"
      }

I am your **MoSPI MPLADS Intelligence Copilot** — AI decision-support advisory for MPLADS audit and risk governance.

I can help you:
- **Analyze database patterns** across the projects currently available in the live MPLADS registry.
- **Diagnose cost anomalies** & NLP duplicate risks.
- **Provide statutory inspection suggestions** as per DISHA guidelines.

*Notice: I operate in **Strict Read-Only Mode**. I analyze and advise without making any modifications to the database or backend.*`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      modelUsed: "mplads-advisory",
      latencyMs: 0,
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  const officerChips = [
    "What are the top delay factors in my district?",
    "Explain the cost anomaly Z-score threshold",
    "How to verify duplicate work allegations on-ground?",
    "Checklist for projects with >180 days delay",
  ];

  const adminChips = [
    "Analyze nationwide works expenditure trends from the live registry",
    "Which sectors show highest cost outlier concentration?",
    "Recommend audit strategy for works >₹1 Crore",
    "How to address unspent balance accumulation?",
  ];

  const suggestionChips = variant === "super_admin" ? adminChips : officerChips;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const context: CopilotContext = {
      role: variant,
      userName: user?.name,
      district: (user as any)?.district || (variant === "officer" ? "Pune" : undefined),
      state: (user as any)?.state || (variant === "officer" ? "Maharashtra" : "India"),
      currentPage: currentPage || "Dashboard",
      selectedWorkId,
    };

    try {
      const historyForApi = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const res = await sendGroqCopilotMessage(historyForApi, query, context);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        latencyMs: res.latencyMs,
        modelUsed: res.model,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content:
          "⚠️ Communication error with the advisory service. Please check network connectivity or try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: `### 🇮🇳 Chat session cleared.\nReady to analyze MPLADS project records and provide statutory advice.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        modelUsed: "openai/gpt-oss-120b",
      },
    ]);
  };

  const formatMarkdown = (content: string) => {
    // Quick, clean formatting for markdown headers, bold, bullet points
    return content.split("\n").map((line, idx) => {
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className="font-semibold text-gray-900 dark:text-gray-100 text-sm mt-2 mb-1">
            {line.replace("### ", "")}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={idx} className="font-bold text-gray-900 dark:text-gray-100 text-sm mt-3 mb-1">
            {line.replace("## ", "")}
          </h3>
        );
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const text = line.substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-0.5">
            <span dangerouslySetInnerHTML={{ __html: renderBold(text) }} />
          </li>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <div key={idx} className="ml-4 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-0.5">
            <span dangerouslySetInnerHTML={{ __html: renderBold(line) }} />
          </div>
        );
      }
      if (line.trim() === "---") {
        return <hr key={idx} className="my-2 border-gray-200 dark:border-gray-700" />;
      }
      if (!line.trim()) {
        return <div key={idx} className="h-1" />;
      }
      return (
        <p key={idx} className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-1">
          <span dangerouslySetInnerHTML={{ __html: renderBold(line) }} />
        </p>
      );
    });
  };

  const renderBold = (str: string) => {
    // Replace **text** with <strong>text</strong> and ₹... with highlighted badge
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900 dark:text-white font-semibold">$1</strong>')
      .replace(/(₹[\d,]+(?:\.\d+)?(?:\s*(?:Cr|Lakhs?|Crores?))?)/g, '<span class="font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1 py-0.5 rounded">$1</span>');
  };

  return (
    <>
      {/* ==================== Free-Hanging Draggable Trigger Button ==================== */}
      <div
        ref={containerRef}
        style={
          btnPos
            ? { left: `${btnPos.x}px`, top: `${btnPos.y}px` }
            : { right: "24px", bottom: "24px" }
        }
        className="fixed z-[70] flex items-center gap-2 select-none touch-none shadow-2xl transition-shadow"
      >
        {!isOpen && (
          <div className="hidden sm:flex items-center gap-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>AI advisory service</span>
          </div>
        )}
        <div
          onPointerDown={handleBtnPointerDown}
          onPointerMove={handleBtnPointerMove}
          onPointerUp={handleBtnPointerUp}
          onClick={handleBtnClick}
          aria-label="Toggle AI Audit Assistant"
          className="relative group flex items-center gap-2 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-full shadow-2xl hover:shadow-indigo-500/25 hover:scale-105 active:scale-95 transition-all duration-150 border border-indigo-400/40 cursor-grab active:cursor-grabbing"
          title="Drag anywhere along layout edges or screen to reposition"
        >
          <span className="text-gray-400 group-hover:text-amber-300 text-xs px-0.5 font-bold" title="Drag Handle">⠿</span>
          <div className="relative">
            <svg
              className="w-5 h-5 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
              <rect x="3" y="8" width="18" height="12" rx="2" />
              <circle cx="9" cy="13" r="1" fill="currentColor" />
              <circle cx="15" cy="13" r="1" fill="currentColor" />
              <path d="M9 17h6" />
            </svg>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 border border-indigo-900 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 border border-indigo-900 rounded-full"></span>
          </div>
          <span className="hidden sm:inline font-semibold text-xs tracking-wide">
            {variant === "super_admin" ? "MoSPI AI Copilot" : "Audit AI Copilot"}
          </span>
        </div>
      </div>

      {/* ==================== Free-Hanging Draggable Chat Window ==================== */}
      {isOpen && (
        <div
          style={
            winPos
              ? { left: `${winPos.x}px`, top: `${winPos.y}px` }
              : btnPos
              ? {
                  left: `${Math.max(10, Math.min(window.innerWidth - 450, btnPos.x > window.innerWidth / 2 ? btnPos.x - 220 : btnPos.x))}px`,
                  top: `${Math.max(10, Math.min(window.innerHeight - 600, btnPos.y > window.innerHeight / 2 ? btnPos.y - 590 : btnPos.y + 60))}px`,
                }
              : { right: "20px", bottom: "80px" }
          }
          className="fixed z-[70] w-[94vw] sm:w-[440px] h-[580px] max-h-[84vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Tricolor Accent Header Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-white to-green-600"></div>

          {/* Draggable Header */}
          <div
            onPointerDown={handleWinPointerDown}
            onPointerMove={handleWinPointerMove}
            onPointerUp={handleWinPointerUp}
            className="px-4 py-3 bg-[#0f172a] text-white flex items-center justify-between border-b border-gray-800 cursor-grab active:cursor-grabbing select-none"
            title="Drag header to move chat window"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-amber-400">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm tracking-tight text-white">
                    {variant === "super_admin" ? "MoSPI Central AI Copilot" : "MPLADS District Copilot"}
                  </h3>
                  <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.2 rounded">
                    Read-Only Advisory
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Read-Only Database Analytics & Statutory Advisory
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                title="Reset conversation"
                className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Strict Read-Only Security Guardrail Banner */}
          <div className="px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>
              <strong>Read-Only Advisory:</strong> AI operates strictly for analysis & policy suggestions. Zero database write permissions.
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc] dark:bg-gray-950">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-indigo-900 border border-indigo-400/30 flex items-center justify-center text-amber-400 flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold">🏛️</span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div>{formatMarkdown(msg.content)}</div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  <div
                    className={`mt-1.5 flex items-center justify-between gap-2 text-[10px] ${
                      msg.role === "user" ? "text-blue-100" : "text-gray-400"
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {msg.latencyMs !== undefined && (
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        ⚡ {msg.latencyMs}ms
                      </span>
                    )}
                  </div>
                </div>

                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {user?.name ? user.name[0].toUpperCase() : "U"}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-full bg-indigo-900 border border-indigo-400/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <span className="text-xs font-bold">🏛️</span>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-xs text-gray-500 font-medium ml-1">Analyzing database records...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 overflow-x-auto flex gap-1.5 no-scrollbar">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip)}
                disabled={isLoading}
                className="whitespace-nowrap flex-shrink-0 text-[11px] font-medium bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:border-indigo-400 rounded-full px-2.5 py-1 transition-all"
              >
                💡 {chip}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
            <div className="relative flex items-center">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask about project anomalies, delays, DISHA rules..."
                className="w-full resize-none pr-10 pl-3 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition-colors"
                title="Send message"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400 px-1">
              <span>Press <strong>Enter</strong> to send · Shift+Enter for new line</span>
              <span>Model: {PRIMARY_MODEL}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
