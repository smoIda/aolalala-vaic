export type InputProps = {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  dispatch: React.Dispatch<ChatActionProps>;
};

export type MessageProps = {
  id: string;
  role: "user" | "bot";
  content: string;
};

export type BaseChatProps = {
  messages: MessageProps[];
  isTyping: boolean;
};

export type ChatActionProps = {
  type: "SEND_MESSAGE";
  payload: MessageProps;
};
