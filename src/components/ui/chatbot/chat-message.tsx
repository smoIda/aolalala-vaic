import { MessageProps } from "@/components/ui/chatbot/types";

export function ChatMessage(msg: MessageProps) {
  return (
    <div
      className={`${msg.role === "user" ? "ml-auto" : "mr-auto"} wrap-break-word relative px-4 py-2`}
    >
      <span className="bg-white-ink absolute top-0 left-0 -z-10 size-full rounded-md" />
      <span
        className={`bg-white-ink absolute top-1/2 size-3 -translate-y-1/2 rotate-45 ${msg.role === "user" ? "-right-1.5" : "-left-1.5"}`}
      />

      {msg.content}
    </div>
  );
}
