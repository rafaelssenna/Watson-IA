/**
 * Shared formatters used across screens
 */

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return "Agora";
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Ontem";
  if (days < 7) {
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    return weekDays[date.getDay()];
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatDayLabel(dateStr: string): string {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const date = new Date(dateStr + "T12:00:00");
  const day = days[date.getDay()];
  const num = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day} ${num}/${month}`;
}
