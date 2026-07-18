import { BaseChatProps, ChatActionProps } from "@/components/ui/chatbot/types";

export const BaseChat: BaseChatProps = {
  chats: [
    {
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
    },
  ],
  activeChatId: "1",
};

export function ChatAction(
  base: BaseChatProps,
  action: ChatActionProps,
): BaseChatProps {
  switch (action.type) {
    case "SEND_MESSAGE":
      return {
        ...base,
        chats: base.chats.map((chat) => {
          return chat.id === base.activeChatId
            ? { ...chat, messages: [...chat.messages, action.payload] }
            : chat;
        }),
      };

    case "CREATE_CHAT":
      return { ...base, chats: [...base.chats, action.payload] };

    case "DELETE_CHAT":
      return {
        ...base,
        chats: base.chats.filter((chat) => chat.id !== action.payload),
      };

    case "SELECT_CHAT":
      return {
        ...base,
        activeChatId: action.payload,
      };
  }
}
