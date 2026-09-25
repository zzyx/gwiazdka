import {
  Backpack,
  Bed,
  BookOpen,
  BrushCleaning,
  Cat,
  Dog,
  Pencil,
  Piano,
  Shirt,
  ShowerHead,
  Sprout,
  Toothbrush,
  ToyBrick,
  Trash2,
  Utensils,
  Volleyball,
  type LucideIcon,
} from "lucide-react";

// The child's screens draw a Task's icon as a line icon. The keys match lib/task-icons.ts.
const ICONS: Record<string, LucideIcon> = {
  tooth: Toothbrush,
  backpack: Backpack,
  book: BookOpen,
  music: Piano,
  bed: Bed,
  pencil: Pencil,
  cat: Cat,
  dog: Dog,
  shower: ShowerHead,
  shirt: Shirt,
  plate: Utensils,
  broom: BrushCleaning,
  plant: Sprout,
  ball: Volleyball,
  toys: ToyBrick,
  trash: Trash2,
};

export const hasLineIcon = (icon: string) => icon in ICONS;

// An icon with no line version (e.g. an emoji saved as the icon) is shown as it is.
export function TaskIcon({ icon, className = "" }: { icon: string; className?: string }) {
  const Icon = ICONS[icon];
  return Icon ? (
    <Icon className={className} strokeWidth={1.8} aria-hidden />
  ) : (
    <span className={`leading-none ${className}`} aria-hidden>
      {icon}
    </span>
  );
}
