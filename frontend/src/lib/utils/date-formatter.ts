export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  const differenceInDays =
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (differenceInDays < 7) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}