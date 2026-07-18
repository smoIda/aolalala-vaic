import { createPortal } from "react-dom";
import { ChatInput } from "./chat-input";
import { ChatMaximizedProps } from "./types";
import { Chatbox } from "./chat-box";
import { useToggle } from "@/hooks/useToggle";
import { nanoid } from "nanoid";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/utils/date-formatter";

export function ChatMaximized({
  onClose,
  state,
  input,
  setInput,
  dispatch,
}: ChatMaximizedProps) {
  const { isDarkTheme, setIsDarkTheme } = useToggle();
  const [search, setSearch] = useState("");

  const currentChat = state.chats.find(
    (chat) => chat.id === state.activeChatId,
  );

  const filteredChats = useMemo(() => {
    return state.chats.filter((chat) => {
      return chat.title.toLowerCase().includes(search.toLowerCase());
    });
  }, [state.chats, search]);

  return createPortal(
    <div className="bg-white-ink text-ink fixed inset-0 z-9999 flex items-start">
      <aside className="flex h-full w-75 shrink-0 flex-col items-start gap-y-10 bg-[#f9fafb] px-2 py-4">
        <div className="flex items-center justify-center gap-x-4 px-2">
          <svg
            viewBox="0 0 48 48"
            className="bg-accent-ink size-12 rounded-full fill-none p-3"
          >
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

          <div>
            <h2 className="text-ink text-xl font-bold">CardioAI</h2>
            <p className="text-grey-ink font-semibold">Trợ lý ảo bệnh viện</p>
          </div>
        </div>

        <div className="flex w-full flex-col items-start justify-center gap-y-4 px-2">
          <button
            onClick={() =>
              dispatch({
                type: "CREATE_CHAT",
                payload: {
                  id: nanoid(),
                  title: "Testwwwwweaweaweaweaweaweawea abc",
                  messages: [],
                },
              })
            }
            className="bg-accent-ink inline-flex w-full cursor-pointer items-center gap-x-2 rounded-xl px-5 py-3"
          >
            <svg viewBox="0 0 24 24" className="size-6 fill-none">
              <path
                d="M7 5C5.34315 5 4 6.34315 4 8V16C4 17.6569 5.34315 19 7 19H17C18.6569 19 20 17.6569 20 16V12.5C20 11.9477 20.4477 11.5 21 11.5C21.5523 11.5 22 11.9477 22 12.5V16C22 18.7614 19.7614 21 17 21H7C4.23858 21 2 18.7614 2 16V8C2 5.23858 4.23858 3 7 3H10.5C11.0523 3 11.5 3.44772 11.5 4C11.5 4.55228 11.0523 5 10.5 5H7Z"
                className="fill-white-ink"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18.8431 3.58579C18.0621 2.80474 16.7957 2.80474 16.0147 3.58579L11.6806 7.91992L11.0148 11.9455C10.8917 12.6897 11.537 13.3342 12.281 13.21L16.3011 12.5394L20.6347 8.20582C21.4158 7.42477 21.4158 6.15844 20.6347 5.37739L18.8431 3.58579ZM13.1933 11.0302L13.5489 8.87995L17.4289 5L19.2205 6.7916L15.34 10.6721L13.1933 11.0302Z"
                className="fill-white-ink"
              />
            </svg>

            <span className="text-white-ink font-bold">New Conversation</span>
          </button>

          <div className="bg-white-ink w-full rounded-xl px-5 py-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="outline-none"
            />
          </div>
        </div>

        <div className="flex h-full w-full flex-col items-start justify-center gap-y-2">
          <span className="text-grey-ink ml-2 text-sm font-bold">GẦN ĐÂY</span>

          <ul className="custom-scroll flex h-full w-full flex-col gap-y-1 overflow-y-auto px-2">
            {filteredChats.map((chat) => {
              return (
                <li
                  key={chat.id}
                  className={`flex w-full rounded-full px-4 py-2 ${currentChat?.id === chat.id && "bg-accent-ink/20 border-accent-ink-soft/40 border"}`}
                >
                  <button
                    onClick={() =>
                      dispatch({ type: "SELECT_CHAT", payload: chat.id })
                    }
                    className="flex w-full cursor-pointer flex-col items-start truncate"
                  >
                    <p
                      className={`font-medium ${currentChat?.id === chat.id && "text-accent-ink"}`}
                    >
                      {chat.title}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <main className="flex size-full flex-col items-center justify-center">
        <header className="flex w-full items-center justify-end gap-x-4 border-b border-b-[#f9fafb] px-6 py-4">
          <button onClick={() => setIsDarkTheme(!isDarkTheme)}>dark</button>
          <button
            onClick={onClose}
            className="flex size-4 cursor-pointer items-center justify-center transition-[scale] hover:scale-120 active:scale-90"
          >
            <svg className="size-full fill-none" viewBox="0 0 24 24">
              <path
                d="M4 14H10M10 14V20M10 14L3 21M20 10H14M14 10V4M14 10L21 3"
                className="stroke-ink"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </header>

        <span className="text-grey-ink mt-2 text-sm">
          CardioAI may produce inaccurate information. Always consult a licensed
          medical professional for health decisions.
        </span>

        <Chatbox {...state} />

        <ChatInput input={input} setInput={setInput} dispatch={dispatch} />
      </main>
    </div>,
    document.body,
  );
}
