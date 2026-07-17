import { BaseChatProps, ChatActionProps } from "@/components/ui/chatbot/types";

export const BaseChat: BaseChatProps = {
  messages: [
    {
      id: "1",
      role: "bot",
      content: "Xin chào, bạn đang có câu hỏi gì không?",
    },
  ],
  isTyping: false,
};

export function ChatAction(
  base: BaseChatProps,
  action: ChatActionProps,
): BaseChatProps {
  switch (action.type) {
    case "SEND_MESSAGE":
      return { ...base, messages: [...base.messages, action.payload] };
  }
}
