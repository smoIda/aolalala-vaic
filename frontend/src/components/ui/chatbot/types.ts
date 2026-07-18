export type InputProps = {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  dispatch: React.Dispatch<ChatActionProps>;
  state: BaseChatProps;
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
  sessionId?: string;
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
  | {
      type: "UPDATE_CHAT";
      payload: {
        id: string;
      } & Partial<Pick<ChatProps, "title" | "sessionId" | "isStreaming">>;
    }
  | { type: "DELETE_CHAT"; payload: string }
  | { type: "SELECT_CHAT"; payload: string }
  | { type: "SET_STREAMING"; payload: { id: string; isStreaming: boolean } };
