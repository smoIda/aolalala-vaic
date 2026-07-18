import ReactMarkdown from "react-markdown";

export function formatText(content: string) {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}
