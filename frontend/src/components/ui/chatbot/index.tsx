"use client";

import { useEffect, useReducer, useState } from "react";

import { ChatInput } from "@/components/ui/chatbot/chat-input";
import { BaseChat, ChatAction } from "@/components/ui/chatbot/constants";

import { useToggle } from "@/hooks/useToggle";
import { ChatMaximized } from "./chat-maximized";
import { Chatbox } from "./chat-box";

const className =
  "size-7.5 bg-accent-ink-soft rounded-lg hover:scale-105 transition-[scale] active:scale-95 flex justify-center items-center cursor-pointer";

const DEFAULT_CHAT = {
  id: "1",
  title: "New conversation",

  isStreaming: false,

  messages: [
    {
      id: "1",
      role: "bot",
      content:
        "Xin chào, tôi là trợ lý ảo tại Bệnh viện Tim Hà Nội, tôi có thể giúp gì cho bạn?",
      createdAt: new Date().toISOString(),
    },
  ],
};

const init = () => {
  if (typeof window === "undefined") {
    return {
      chats: [DEFAULT_CHAT],
      activeChatId: DEFAULT_CHAT.id,
    };
  }

  try {
    const saved = localStorage.getItem("CHAT_HISTORY");

    if (!saved) {
      return {
        chats: [DEFAULT_CHAT],
        activeChatId: DEFAULT_CHAT.id,
      };
    }

    const chats = JSON.parse(saved);

    if (!Array.isArray(chats) || chats.length === 0) {
      return {
        chats: [DEFAULT_CHAT],
        activeChatId: DEFAULT_CHAT.id,
      };
    }

    return {
      chats,
      activeChatId: chats[0]?.id ?? DEFAULT_CHAT.id,
    };
  } catch {
    return {
      chats: [DEFAULT_CHAT],
      activeChatId: DEFAULT_CHAT.id,
    };
  }
};

export function Chatbot() {
  const { isChatbotOpen, setIsChatbotOpen, setIsDarkTheme } = useToggle();
  const [input, setInput] = useState("");
  const [state, dispatch] = useReducer(ChatAction, BaseChat, init);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(
    () => localStorage.setItem("CHAT_HISTORY", JSON.stringify(state.chats)),
    [state.chats],
  );

  return (
    <div className="relative z-60 px-2">
      {isMaximized ? (
        <ChatMaximized
          input={input}
          setInput={setInput}
          dispatch={dispatch}
          onClose={() => {
            setIsDarkTheme(false);
            setIsMaximized(false);
          }}
          state={state}
        />
      ) : (
        <>
          <div
            className={`bg-white-ink ${isMinimized ? "h-16" : "h-130"} fixed right-1/2 bottom-25 flex w-11/12 max-w-100 min-w-75 translate-x-1/2 flex-col items-center overflow-hidden rounded-xl shadow-[-5px_10px_40px_-20px_rgba(37,99,235)] sm:right-8 sm:bottom-25 sm:translate-x-0 ${isChatbotOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-10 opacity-0 select-none"} transition-[translate,opacity]`}
          >
            <div className="bg-accent-ink flex w-full shrink-0 items-center justify-between px-4 py-2">
              <div className="relative flex items-center justify-center gap-x-3">
                <div className="bg-accent-ink-soft relative flex size-12 items-center justify-center rounded-full">
                  <svg viewBox="0 0 48 48" className="size-1/2 fill-none">
                    <path
                      d="M11 32L18 23L24 32L30 23L35 31H44"
                      className="stroke-white-ink"
                      strokeWidth="2"
                      strokeMiterlimit="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    <path
                      d="M44 19C44 12.9249 39.0751 8 33 8C29.2797 8 25.9907 9.8469 24 12.6738C22.0093 9.8469 18.7203 8 15 8C8.92487 8 4 12.9249 4 19C4 30 17 40 24 42.3262C25.1936 41.9295 26.5616 41.3098 28.0099 40.5"
                      className="stroke-white-ink"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <h2 className="text-white-ink font-medium">HeartCare</h2>
                  <p className="text-white-ink/70 xs:flex hidden items-center justify-center gap-x-2 text-sm">
                    Care Assistant
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-x-1">
                <button
                  className={className}
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  <svg className="size-1/2" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 12L18 12"
                      className="stroke-white-ink"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button
                  className={className}
                  onClick={() => {
                    setIsMinimized(false);
                    setIsMaximized(!isMaximized);
                  }}
                >
                  <svg className="size-1/2" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21 9V3H15"
                      className="stroke-white-ink"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M3 15V21H9"
                      className="stroke-white-ink"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 3L13.5 10.5"
                      className="stroke-white-ink"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10.5 13.5L3 21"
                      className="stroke-white-ink"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button
                  className={className}
                  onClick={() => setIsChatbotOpen(false)}
                >
                  <svg className="size-1/2" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 18L12 12M12 12L6 6M12 12L18 6M12 12L6 18"
                      className="stroke-white-ink"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <Chatbox {...state} />

            <ChatInput
              input={input}
              setInput={setInput}
              dispatch={dispatch}
              state={state}
            />
          </div>

          <button
            onClick={() => setIsChatbotOpen(!isChatbotOpen)}
            className="from-accent-ink to-accent-ink/40 fixed right-8 bottom-8 flex size-15 cursor-pointer items-center justify-center rounded-full bg-linear-to-br transition-[scale] active:scale-90"
          >
            <svg viewBox="0 0 48 48" className="size-3/5 fill-none">
              <path
                d="M11 32L18 23L24 32L30 23L35 31H44"
                className="stroke-white-ink"
                strokeWidth="2"
                strokeMiterlimit="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d="M44 19C44 12.9249 39.0751 8 33 8C29.2797 8 25.9907 9.8469 24 12.6738C22.0093 9.8469 18.7203 8 15 8C8.92487 8 4 12.9249 4 19C4 30 17 40 24 42.3262C25.1936 41.9295 26.5616 41.3098 28.0099 40.5"
                className="stroke-white-ink"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>

            {!isChatbotOpen && (
              <span className="bg-alert-ink text-white-ink border-white-ink absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 text-xs font-bold">
                1
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
}
