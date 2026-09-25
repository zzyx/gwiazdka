// A Task's icon is stored as a short name; the screens show it as an emoji.
// An icon that is already an emoji (or unknown) is shown as it is.
const ICONS: Record<string, string> = {
  tooth: "🪥",
  backpack: "🎒",
  book: "📚",
  music: "🎹",
  bed: "🛏️",
  pencil: "✏️",
  cat: "🐱",
  dog: "🐶",
  shower: "🚿",
  shirt: "👕",
  plate: "🍽️",
  broom: "🧹",
  plant: "🪴",
  ball: "⚽",
  toys: "🧸",
  trash: "🗑️",
};

// The icons the parent picks from when adding a Task.
export const TASK_ICONS = Object.keys(ICONS);

export function taskEmoji(icon: string): string {
  return ICONS[icon] ?? icon;
}
