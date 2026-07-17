"use client";

import { useReducer, useState } from "react";

import { ChatInput } from "@/components/ui/chatbot/chat-input";
import { BaseChat, ChatAction } from "@/components/ui/chatbot/constants";

import { useToggle } from "@/hooks/useToggle";
import { ChatMessage } from "@/components/ui/chatbot/chat-message";

export function Chatbot() {
  const { isChatbotOpen, setIsChatbotOpen } = useToggle();
  const [input, setInput] = useState("");
  const [state, dispatch] = useReducer(ChatAction, BaseChat);

  return (
    <div className="z-50">
      <div
        className={`bg-accent-ink flex h-120 w-80 flex-col items-center gap-y-4 rounded-md px-4 py-2 md:w-100 ${isChatbotOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-10 opacity-0 select-none"} transition-[translate,opacity]`}
      >
        <span className="text-white-ink">&#91; Hỗ trợ trực tuyến &#93;</span>

        <div className="flex w-full flex-col gap-y-6">
          {state.messages.map((msg) => {
            return <ChatMessage key={msg.id} {...msg} />;
          })}
        </div>

        <div className="mt-auto w-full py-2">
          <ChatInput input={input} setInput={setInput} dispatch={dispatch} />
        </div>
      </div>

      <button
        onClick={() => setIsChatbotOpen(!isChatbotOpen)}
        className="border-accent-ink fixed bottom-4 left-1/2 -translate-x-1/2 cursor-pointer overflow-hidden border-2 px-6 py-1 text-nowrap"
      >
        <span
          style={{ clipPath: "polygon(0% 0%, 100% 0%, 0% 100%)" }}
          className="bg-accent-ink absolute top-0 -left-px size-4"
        />

        <span className="font-bold">Kool Chatbot</span>

        <span
          style={{ clipPath: "polygon(0% 0%, 100% 0%, 0% 100%)" }}
          className="bg-accent-ink absolute -right-px bottom-0 size-4 rotate-180"
        />
      </button>
    </div>
  );
}
