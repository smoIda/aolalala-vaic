"use client";

import { useReducer, useState } from "react";

import Image from "next/image";

import { ChatInput } from "@/components/ui/chatbot/chat-input";
import { BaseChat, ChatAction } from "@/components/ui/chatbot/constants";

import { useToggle } from "@/hooks/useToggle";

export function Chatbot() {
  const { isChatbotOpen, setIsChatbotOpen } = useToggle();
  const [input, setInput] = useState("");
  const [state, dispatch] = useReducer(ChatAction, BaseChat);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const className =
    "size-6 bg-accent-ink-soft rounded-md hover:scale-105 transition-[scale] active:scale-95 flex justify-center items-center cursor-pointer";

  return (
    <div className="z-50 px-2">
      <div
        className={`bg-white-ink ${isMinimized ? "h-16" : "h-150"} fixed right-1/2 bottom-25 flex w-11/12 max-w-105 min-w-75 translate-x-1/2 flex-col items-center overflow-hidden rounded-md shadow-[-5px_10px_40px_-20px_rgba(37,99,235)] sm:right-8 sm:bottom-25 sm:translate-x-0 ${isChatbotOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-10 opacity-0 select-none"} transition-[translate,opacity]`}
      >
        <div className="bg-accent-ink flex w-full shrink-0 items-center justify-between px-4 py-2">
          <div className="relative flex items-center justify-center gap-x-4">
            <div className="bg-accent-ink-soft relative size-12 rounded-md">
              <Image src="/chatbot.png" fill alt="chatbot" />
            </div>

            <div>
              <h2 className="text-white-ink font-medium">CardioAI</h2>
              <p className="text-white-ink/70 xs:flex hidden items-center justify-center gap-x-2 text-sm">
                <span className="size-1.5 rounded-full bg-green-400" />
                Bệnh viện Tim Hà Nội
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-x-1">
            <button
              className={className}
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <svg className="size-3/4" viewBox="0 0 24 24" fill="none">
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
              onClick={() => setIsMaximized(!isMaximized)}
            >
              <svg className="size-3/4" viewBox="0 0 24 24" fill="none">
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
              <svg className="size-3/4" viewBox="0 0 24 24" fill="none">
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

        <div className="flex custom-scroll w-full flex-col gap-y-6 overflow-x-hidden px-4 py-4">
          {state.messages.map((msg) => {
            return (
              <div
                key={msg.id}
                className={`${msg.role === "user" ? "bg-accent-ink text-white-ink ml-auto rounded-br-md" : "mr-auto rounded-bl-md"} max-w-70 rounded-2xl px-4 py-2 wrap-break-word shadow-[0_4px_24px_rgba(155,163,176,0.4)]`}
              >
                {msg.content}
              </div>
            );
          })}
        </div>

        <ChatInput input={input} setInput={setInput} dispatch={dispatch} />
      </div>

      <button
        onClick={() => setIsChatbotOpen(!isChatbotOpen)}
        className="from-accent-ink to-accent-ink/40 fixed right-8 bottom-8 size-15 cursor-pointer rounded-full bg-linear-to-br shadow-[-5px_10px_30px_-5px_rgba(37,99,235)] transition-[scale] active:scale-90"
      >
        <Image src="/chatbot.png" fill alt="chatbot" />

        {!isChatbotOpen && (
          <span className="bg-alert-ink text-white-ink border-white-ink absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 text-xs font-bold">
            1
          </span>
        )}
      </button>
    </div>
  );
}
