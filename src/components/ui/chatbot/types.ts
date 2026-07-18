export type InputProps = {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  dispatch: React.Dispatch<ChatActionProps>;
};

export type ChatMaximizedProps = InputProps & {
  onClose: () => void;
  state: BaseChatProps;
};

export type MessageProps = {
  id: string;
  role: "user" | "bot";
  content: string;

  isStreaming?: boolean;
  createdAt: string;
};

export type ChatProps = {
  id: string;
  title: string;
  isStreaming?: boolean;
  messages: MessageProps[];
};

export type BaseChatProps = {
  chats: ChatProps[];
  activeChatId: string;
};

export type ChatActionProps =
  | {
      type: "SEND_MESSAGE";
      payload: MessageProps;
    }
  | { type: "CREATE_CHAT"; payload: ChatProps }
  | { type: "DELETE_CHAT"; payload: string }
  | { type: "SELECT_CHAT"; payload: string };
