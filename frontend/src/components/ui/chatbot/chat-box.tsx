import { formatDate } from "@/lib/utils/date-formatter";
import { BaseChatProps } from "./types";
import { useEffect, useRef } from "react";
import { formatText } from "@/lib/utils/text-formatter";

export function Chatbox(state: BaseChatProps) {
  const chatboxRef = useRef<HTMLDivElement | null>(null);

  const currentChat = state.chats.find(
    (chat) => chat.id === state.activeChatId,
  );

  useEffect(() => {
    chatboxRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages]);

  return (
    <div className="custom-scroll flex h-full w-full flex-col gap-y-6 overflow-x-hidden p-4">
      {currentChat?.messages.map((message) => {
        return (
          <div
            key={message.id}
            className={`flex items-end gap-x-2 ${message.role === "user" && "flex-row-reverse"}`}
          >
            {message.role === "user" ? (
              <div className="flex size-8 items-center justify-center rounded-full bg-pink-800">
                <span className="font-bold text-white">JD</span>
              </div>
            ) : (
              <div className="bg-accent-ink flex size-8 items-center justify-center rounded-full">
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
            )}

            <div className="flex flex-col items-start gap-y-1">
              <div
                key={message.id}
                className={`${message.role === "user" ? "bg-accent-ink text-white-ink ml-auto rounded-br-md" : "mr-auto rounded-bl-md"} max-w-70 rounded-2xl px-4 py-2 wrap-break-word shadow-[0_4px_24px_rgba(155,163,176,0.4)]`}
              >
                {formatText(message.content)}
              </div>

              <span
                className={`text-grey-ink text-sm ${message.role === "user" && "ml-auto"}`}
              >
                {formatDate(message.createdAt)}
              </span>
            </div>
          </div>
        );
      })}

      {currentChat?.isStreaming && (
        <div className="mr-auto flex items-center gap-x-2">
          <div className="bg-accent-ink flex size-8 items-center justify-center rounded-full">
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

          <div className="bg-white-ink flex items-center justify-center gap-x-1 rounded-2xl rounded-bl-md p-4 shadow-[0_4px_24px_rgba(155,163,176,0.4)]">
            {Array.from({ length: 3 }).map((_, index) => {
              return (
                <span
                  key={index}
                  style={{ animationDelay: `${index * 150}ms` }}
                  className="bg-grey-ink animate-chatbot-bounce size-1 rounded-full"
                />
              );
            })}
          </div>
        </div>
      )}

      <span ref={chatboxRef} aria-hidden="true" />
    </div>
  );
}
