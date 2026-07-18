import { createPortal } from "react-dom";
import { ChatInput } from "./chat-input";
import { ChatMaximizedProps } from "./types";
import { Chatbox } from "./chat-box";
import { useToggle } from "@/hooks/useToggle";
import { nanoid } from "nanoid";
import { useMemo, useState } from "react";

export function ChatMaximized({
  onClose,
  state,
  input,
  setInput,
  dispatch,
}: ChatMaximizedProps) {
  const { isSidebarOpen, setIsSidebarOpen, isDarkTheme, setIsDarkTheme } =
    useToggle();
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
      <aside
        className={`border-grey-ink bg-white-ink flex h-full overflow-hidden ${isSidebarOpen ? "w-75 px-2" : "w-0"} border-r-grey-ink/40 shrink-0 flex-col items-start gap-y-10 border-r py-4`}
      >
        <div className="flex w-full items-center gap-x-4 px-2">
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
            <h2 className="text-ink text-xl font-bold">HeartCare</h2>
            <p className="text-grey-ink font-semibold">Care Assistant</p>
          </div>
        </div>

        <div className="flex w-full flex-col items-start justify-center gap-y-2 px-2">
          <button
            onClick={() => {
              const newId = nanoid();

              dispatch({
                type: "CREATE_CHAT",
                payload: {
                  id: newId,
                  title: "New chat",
                  messages: [],
                },
              });

              dispatch({ type: "SELECT_CHAT", payload: newId });
            }}
            className="bg-accent-ink inline-flex w-full cursor-pointer items-center gap-x-2 rounded-xl px-4 py-3"
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

          <div className="bg-white-ink border-grey-ink/40 flex w-full items-center justify-center gap-x-2 rounded-xl border px-4 py-2">
            <svg viewBox="0 0 24 24" className="size-4 fill-none">
              <path
                d="M15.7955 15.8111L21 21M18 10.5C18 14.6421 14.6421 18 10.5 18C6.35786 18 3 14.6421 3 10.5C3 6.35786 6.35786 3 10.5 3C14.6421 3 18 6.35786 18 10.5Z"
                className="stroke-grey-ink"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

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
                  className={`flex w-full items-center justify-between rounded-full px-4 py-2 ${currentChat?.id === chat.id && "bg-accent-ink/20 border-accent-ink-soft/40 border"}`}
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

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: "DELETE_CHAT", payload: chat.id });
                    }}
                    className="group size-5 cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" className="size-full fill-none">
                      <g
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="stroke-grey-ink group-hover:stroke-alert-ink"
                      >
                        <path d="M10 12V17" />
                        <path d="M14 12V17" />
                        <path d="M4 7H20" />
                        <path d="M6 10V18C6 19.6569 7.34315 21 9 21H15C16.6569 21 18 19.6569 18 18V10" />
                        <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z" />
                      </g>
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <main className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-center">
        <header className="border-grey-ink/40 flex w-full items-center justify-between gap-x-4 border-b px-6 py-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`flex size-5 cursor-pointer items-center justify-center transition-[scale] hover:scale-110 active:scale-90 ${isSidebarOpen ? "rotate-0" : "rotate-180"}`}
          >
            <svg
              fill="#86898f"
              viewBox="0 0 24 24"
              stroke="#86898f"
              className="size-5"
            >
              <path d="M20,24H4c-2.2,0-4-1.8-4-4V4c0-2.2,1.8-4,4-4h16c2.2,0,4,1.8,4,4v16C24,22.2,22.2,24,20,24z M4,2C2.9,2,2,2.9,2,4v16 c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V4c0-1.1-0.9-2-2-2H4z" />
              <path d="M8,24c-0.6,0-1-0.4-1-1V1c0-0.6,0.4-1,1-1s1,0.4,1,1v22C9,23.6,8.6,24,8,24z" />
              <path d="M14,13c-0.3,0-0.5-0.1-0.7-0.3c-0.4-0.4-0.4-1,0-1.4l3-3c0.4-0.4,1-0.4,1.4,0s0.4,1,0,1.4l-3,3C14.5,12.9,14.3,13,14,13z " />
              <path d="M17,16c-0.3,0-0.5-0.1-0.7-0.3l-3-3c-0.4-0.4-0.4-1,0-1.4s1-0.4,1.4,0l3,3c0.4,0.4,0.4,1,0,1.4C17.5,15.9,17.3,16,17,16z " />
            </svg>
          </button>

          <button
            className="ml-auto flex cursor-pointer items-center justify-center transition-[scale] hover:scale-110 active:scale-90"
            onClick={() => setIsDarkTheme(!isDarkTheme)}
          >
            {!isDarkTheme ? (
              <svg viewBox="0 0 24 24" className="size-5 fill-none">
                <path
                  d="M3.32031 11.6835C3.32031 16.6541 7.34975 20.6835 12.3203 20.6835C16.1075 20.6835 19.3483 18.3443 20.6768 15.032C19.6402 15.4486 18.5059 15.6834 17.3203 15.6834C12.3497 15.6834 8.32031 11.654 8.32031 6.68342C8.32031 5.50338 8.55165 4.36259 8.96453 3.32996C5.65605 4.66028 3.32031 7.89912 3.32031 11.6835Z"
                  className="stroke-grey-ink/80"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-5 fill-none">
                <g
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="stroke-grey-ink/80"
                >
                  <path d="M7.28451 10.3333C7.10026 10.8546 7 11.4156 7 12C7 14.7614 9.23858 17 12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C11.4156 7 10.8546 7.10026 10.3333 7.28451" />
                  <path d="M12 2V4" />
                  <path d="M12 20V22" />
                  <path d="M4 12L2 12" />
                  <path d="M22 12L20 12" />
                  <path d="M19.7778 4.22266L17.5558 6.25424" />
                  <path d="M4.22217 4.22266L6.44418 6.25424" />
                  <path d="M6.44434 17.5557L4.22211 19.7779" />
                  <path d="M19.7778 19.7773L17.5558 17.5551" />
                </g>
              </svg>
            )}
          </button>

          <button
            onClick={onClose}
            className="flex size-5 cursor-pointer items-center justify-center transition-[scale] hover:scale-110 active:scale-90"
          >
            <svg className="size-full fill-none" viewBox="0 0 24 24">
              <path
                d="M4 14H10M10 14V20M10 14L3 21M20 10H14M14 10V4M14 10L21 3"
                className="stroke-grey-ink/80"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </header>

        <p className="text-grey-ink mt-2 text-center text-sm">
          Always consult a licensed medical professional for health decisions.
        </p>

        {!state.chats.length && (
          <div className="absolute top-1/2 left-1/2 flex -translate-1/2 flex-col items-center justify-center">
            <h3 className="text-accent-ink text-xl font-bold">HeartCare AI</h3>
            <h3 className="text-3xl">Ready when you are!</h3>
          </div>
        )}

        <Chatbox {...state} />

        <ChatInput
          input={input}
          setInput={setInput}
          dispatch={dispatch}
          state={state}
        />
      </main>
    </div>,
    document.body,
  );
}
