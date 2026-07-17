import { nanoid } from "nanoid";

import { InputProps } from "@/components/ui/chatbot/types";
import { useEffect, useRef } from "react";

export function ChatInput({ input, setInput, dispatch }: InputProps) {
  const handleSend = () => {
    const content = input.trim();

    if (!content) return;

    dispatch({
      type: "SEND_MESSAGE",
      payload: { id: nanoid(), role: "user", content },
    });

    setInput("");

    setTimeout(() => {
      dispatch({
        type: "SEND_MESSAGE",
        payload: { id: nanoid(), role: "bot", content: "cmmmmmm" },
      });
    }, 2500);
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [input]);

  return (
    <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-2 px-4 py-2">
      <div className="bg-grey-ink/10 flex w-full items-center justify-between gap-x-2 rounded-lg px-4">
        <svg
          className="group size-6 shrink-0 cursor-pointer"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M15.7285 3.88396C17.1629 2.44407 19.2609 2.41383 20.4224 3.57981C21.586 4.74798 21.5547 6.85922 20.1194 8.30009L17.6956 10.7333C17.4033 11.0268 17.4042 11.5017 17.6976 11.794C17.9911 12.0863 18.466 12.0854 18.7583 11.7919L21.1821 9.35869C23.0934 7.43998 23.3334 4.37665 21.4851 2.5212C19.6346 0.663551 16.5781 0.905664 14.6658 2.82536L9.81817 7.69182C7.90688 9.61053 7.66692 12.6739 9.51519 14.5293C9.80751 14.8228 10.2824 14.8237 10.5758 14.5314C10.8693 14.2391 10.8702 13.7642 10.5779 13.4707C9.41425 12.3026 9.44559 10.1913 10.8809 8.75042L15.7285 3.88396Z"
            className="fill-grey-ink group-hover:fill-accent-ink"
          />
          <path
            d="M14.4851 9.47074C14.1928 9.17728 13.7179 9.17636 13.4244 9.46868C13.131 9.76101 13.1301 10.2359 13.4224 10.5293C14.586 11.6975 14.5547 13.8087 13.1194 15.2496L8.27178 20.1161C6.83745 21.556 4.73937 21.5863 3.57791 20.4203C2.41424 19.2521 2.44559 17.1408 3.88089 15.6999L6.30473 13.2667C6.59706 12.9732 6.59614 12.4984 6.30268 12.206C6.00922 11.9137 5.53434 11.9146 5.24202 12.2081L2.81818 14.6413C0.906876 16.5601 0.666916 19.6234 2.51519 21.4789C4.36567 23.3365 7.42221 23.0944 9.33449 21.1747L14.1821 16.3082C16.0934 14.3895 16.3334 11.3262 14.4851 9.47074Z"
            className="fill-grey-ink group-hover:fill-accent-ink"
          />
        </svg>

        <textarea
          ref={textareaRef}
          placeholder="Hỏi về bệnh tim..."
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

        <svg
          viewBox="-5 0 32 32"
          className="group size-8 cursor-pointer fill-none"
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
          className={`${input.trim() ? "bg-accent-ink" : "bg-grey-ink"} flex size-8 shrink-0 transform-[scale] cursor-pointer items-center justify-center rounded-md duration-200 hover:scale-110 active:scale-90`}
        >
          <svg viewBox="0 0 24 24" className="size-3/4 fill-none">
            <path
              d="M20.33 3.66996C20.1408 3.48213 19.9035 3.35008 19.6442 3.28833C19.3849 3.22659 19.1135 3.23753 18.86 3.31996L4.23 8.19996C3.95867 8.28593 3.71891 8.45039 3.54099 8.67255C3.36307 8.89471 3.25498 9.16462 3.23037 9.44818C3.20576 9.73174 3.26573 10.0162 3.40271 10.2657C3.5397 10.5152 3.74754 10.7185 4 10.85L10.07 13.85L13.07 19.94C13.1906 20.1783 13.3751 20.3785 13.6029 20.518C13.8307 20.6575 14.0929 20.7309 14.36 20.73H14.46C14.7461 20.7089 15.0192 20.6023 15.2439 20.4239C15.4686 20.2456 15.6345 20.0038 15.72 19.73L20.67 5.13996C20.7584 4.88789 20.7734 4.6159 20.7132 4.35565C20.653 4.09541 20.5201 3.85762 20.33 3.66996ZM4.85 9.57996L17.62 5.31996L10.53 12.41L4.85 9.57996ZM14.43 19.15L11.59 13.47L18.68 6.37996L14.43 19.15Z"
              className="fill-white-ink"
            />
          </svg>
        </button>
      </div>

      <span className="text-grey-ink text-sm">
        Bệnh viện Tim Hà Nội ·{" "}
        <a href="/" className="text-accent-ink hover:underline">
          Điều khoản dịch vụ
        </a>
      </span>
    </div>
  );
}
