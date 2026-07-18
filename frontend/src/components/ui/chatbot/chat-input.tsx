import { nanoid } from "nanoid";

import { InputProps } from "@/components/ui/chatbot/types";
import { useEffect, useRef } from "react";
import { sendChat } from "@/lib/api/sendChat";

const fixedPrompts = [
  "Schedule an appointment",
  "Lower blood pressure naturally",
  "Explain my cholesterol report",
  "Clinics near my location",
];

export function ChatInput({ input, setInput, dispatch, state }: InputProps) {
  const generateTitle = (content: string) => {
    return content.length > 40 ? content.slice(0, 40) + "..." : content;
  };

  const handleSend = async () => {
    const content = input.trim();

    if (!content) return;

    const currentChat = state.chats.find(
      (chat) => chat.id === state.activeChatId,
    );

    if (!currentChat) return;

    const isFirstPrompt = currentChat?.messages.length === 0;

    dispatch({
      type: "SEND_MESSAGE",
      payload: {
        id: nanoid(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      },
    });

    if (isFirstPrompt)
      dispatch({
        type: "UPDATE_CHAT",
        payload: { id: currentChat.id, title: generateTitle(content) },
      });

    setInput("");

    try {
      const data = await sendChat(content, currentChat.sessionId);

      if (!currentChat.sessionId) {
        dispatch({
          type: "UPDATE_CHAT",
          payload: {
            id: currentChat.id,
            sessionId: data.session.id,
          },
        });
      }

      dispatch({
        type: "SEND_MESSAGE",
        payload: {
          id: nanoid(),
          role: "bot",
          content: data.response,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [input]);

  return (
    <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-y-2 px-4 py-2">
      <div className="no-scroll flex w-full items-start gap-x-2 overflow-x-auto">
        {fixedPrompts.map((prompt, index) => {
          return (
            <button
              key={index}
              onClick={() => {
                input = prompt;
                handleSend();
              }}
              className="border-grey-ink/40 text-grey-ink/80 hover:text-accent-ink hover:border-accent-ink cursor-pointer rounded-full border px-2 py-1 text-sm text-nowrap"
            >
              {prompt}
            </button>
          );
        })}
      </div>

      <div className="bg-grey-ink/10 flex w-full items-center justify-between rounded-2xl px-4">
        <textarea
          ref={textareaRef}
          placeholder="Ask about symptoms,..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          className="placeholder:text-grey-ink h-auto max-h-40 w-full resize-none overflow-y-auto rounded-lg py-4 outline-none"
        />

        <div className="flex items-center justify-center gap-x-2">
          <svg
            viewBox="-5 0 32 32"
            className="group size-5 cursor-pointer fill-none"
          >
            <path
              transform="translate(-105.000000, -307.000000)"
              className="fill-grey-ink group-hover:fill-accent-ink"
              d="M111,314 C111,311.238 113.239,309 116,309 C118.761,309 121,311.238 121,314 L121,324 C121,326.762 118.761,329 116,329 C113.239,329 111,326.762 111,324 L111,314 L111,314 Z M116,331 C119.866,331 123,327.866 123,324 L123,314 C123,310.134 119.866,307 116,307 C112.134,307 109,310.134 109,314 L109,324 C109,327.866 112.134,331 116,331 L116,331 Z M127,326 L125,326 C124.089,330.007 120.282,333 116,333 C111.718,333 107.911,330.007 107,326 L105,326 C105.883,330.799 110.063,334.51 115,334.955 L115,337 L114,337 C113.448,337 113,337.448 113,338 C113,338.553 113.448,339 114,339 L118,339 C118.552,339 119,338.553 119,338 C119,337.448 118.552,337 118,337 L117,337 L117,334.955 C121.937,334.51 126.117,330.799 127,326 L127,326 Z"
            />
          </svg>

          <button
            aria-label="send"
            onClick={handleSend}
            className={`${input.trim() ? "opacity-100" : "opacity-50"} bg-accent-ink flex size-8 shrink-0 transform-[scale] cursor-pointer items-center justify-center gap-x-2 rounded-full duration-200 hover:scale-110 active:scale-90`}
          >
            <svg viewBox="0 0 24 24" className="size-5 fill-none">
              <path
                d="M20.33 3.66996C20.1408 3.48213 19.9035 3.35008 19.6442 3.28833C19.3849 3.22659 19.1135 3.23753 18.86 3.31996L4.23 8.19996C3.95867 8.28593 3.71891 8.45039 3.54099 8.67255C3.36307 8.89471 3.25498 9.16462 3.23037 9.44818C3.20576 9.73174 3.26573 10.0162 3.40271 10.2657C3.5397 10.5152 3.74754 10.7185 4 10.85L10.07 13.85L13.07 19.94C13.1906 20.1783 13.3751 20.3785 13.6029 20.518C13.8307 20.6575 14.0929 20.7309 14.36 20.73H14.46C14.7461 20.7089 15.0192 20.6023 15.2439 20.4239C15.4686 20.2456 15.6345 20.0038 15.72 19.73L20.67 5.13996C20.7584 4.88789 20.7734 4.6159 20.7132 4.35565C20.653 4.09541 20.5201 3.85762 20.33 3.66996ZM4.85 9.57996L17.62 5.31996L10.53 12.41L4.85 9.57996ZM14.43 19.15L11.59 13.47L18.68 6.37996L14.43 19.15Z"
                className="fill-white-ink"
              />
            </svg>
          </button>
        </div>
      </div>

      <span className="text-grey-ink text-sm">
        Bệnh viện Tim Hà Nội ·{" "}
        <button className="text-accent-ink cursor-pointer hover:underline">
          Điều khoản dịch vụ
        </button>
      </span>
    </div>
  );
}
