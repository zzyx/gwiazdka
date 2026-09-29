import { CalendarDays, FileText, House, LogOut, Smartphone, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "../sign-in/actions";
import { getBoard, joinPageUrl } from "./board-data";
import { figtree } from "./font";
import { JoinCodeButton } from "./join-code-button";
import { JoinQr } from "./join-qr";

export type Section = "home" | "history" | "contracts";

const SECTIONS: [Section, string, string, LucideIcon][] = [
  ["home", "Home", "/", House],
  ["history", "History", "/history", CalendarDays],
  ["contracts", "Contracts", "/contracts", FileText],
];

// A colour per child, in the order the Board lists them.
export const CHILD_COLORS = ["#0EA5E9", "#D946EF", "#F59E0B", "#10B981", "#6366F1"];

// The parent's navigation around every page (Nav 1 of the parent home
// prototype): a sidebar on wide screens, a bottom tab bar on narrow ones.
export async function ParentShell({
  section,
  historyChildId,
  children,
}: {
  section: Section;
  // The child whose History is shown, marked in the sidebar.
  historyChildId?: string;
  children: ReactNode;
}) {
  const columns = await getBoard();
  const waiting = columns.reduce((sum, c) => sum + (c.board?.waiting ?? 0), 0);
  const joinUrl = await joinPageUrl();
  const qr = <JoinQr url={joinUrl} />;

  return (
    <div className={`${figtree.className} flex flex-1 bg-[#F6F7F9] text-[#1F2430] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]`}>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-[#E5E7EB] bg-white px-3 py-4 lg:flex">
        <span className="flex items-center gap-2 px-2 pb-3.5 text-lg font-extrabold">
          <i className="grid size-6.5 place-items-center rounded-lg bg-[#2563EB] text-sm text-white not-italic" aria-hidden>
            ★
          </i>
          Gwiazdki
        </span>
        {SECTIONS.map(([id, name, href, Icon]) => (
          <Link key={id} href={href} aria-current={section === id ? "page" : undefined} className={navItem(section === id)}>
            <Icon className="size-5 flex-none" aria-hidden />
            <span className="flex-1">{name}</span>
            {id === "home" && waiting > 0 && <Badge n={waiting} />}
          </Link>
        ))}
        <h2 className="mx-2 mt-3.5 mb-1 text-[11px] font-bold tracking-wider text-[#6B7280] uppercase">Children</h2>
        {columns.map((c, i) => (
          <Link
            key={c.id}
            href={`/history?child=${encodeURIComponent(c.id)}`}
            aria-current={section === "history" && historyChildId === c.id ? "page" : undefined}
            className={navItem(section === "history" && historyChildId === c.id)}
          >
            <Avatar name={c.name} color={CHILD_COLORS[i % CHILD_COLORS.length]} />
            <span className="flex-1 truncate">{c.name}</span>
            {!c.board ? (
              <span className="text-xs font-normal text-[#6B7280]">no Contract</span>
            ) : c.board.waiting > 0 ? (
              <span className="rounded-full bg-[#FEF3C7] px-2 text-xs font-bold text-[#92400E]" aria-label={`${c.board.waiting} waiting`}>
                {c.board.waiting}
              </span>
            ) : (
              <span className="text-xs font-normal text-[#6B7280]">{c.board.stars} ★</span>
            )}
          </Link>
        ))}
        <div className="mt-auto flex flex-col gap-0.5 border-t border-[#E5E7EB] pt-2">
          {columns.length > 0 && (
            <details className="group">
              <summary className={`${navItem(false)} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                <Smartphone className="size-5 flex-none" aria-hidden />
                <span className="flex-1">Connect a phone</span>
              </summary>
              <div className="flex flex-col gap-1.5 py-1.5 pl-10">
                {columns.map((c) => (
                  <JoinCodeButton
                    key={c.id}
                    childId={c.id}
                    name={c.name}
                    joinUrl={joinUrl}
                    qr={qr}
                    label={`${c.name}'s phone`}
                    className="self-start text-sm font-semibold text-[#2563EB] disabled:opacity-50"
                  />
                ))}
              </div>
            </details>
          )}
          <form action={signOut}>
            <button className={navItem(false)}>
              <LogOut className="size-5 flex-none" aria-hidden />
              <span className="flex-1">Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-[5] grid grid-cols-3 border-t border-[#E5E7EB] bg-white/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {SECTIONS.map(([id, name, href, Icon]) => (
          <Link
            key={id}
            href={href}
            aria-current={section === id ? "page" : undefined}
            className={`relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-bold ${section === id ? "text-[#2563EB]" : "text-[#6B7280]"}`}
          >
            <Icon className="size-5.5" aria-hidden />
            {name}
            {id === "home" && waiting > 0 && (
              <span className="absolute top-0 left-[calc(50%+6px)]">
                <Badge n={waiting} />
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// A page's title, with what waits on the Home.
export function PageHeader({ title, waiting }: { title: string; waiting?: number }) {
  return (
    <header className="flex items-center gap-3">
      <h1 className="flex-1 text-2xl font-bold">{title}</h1>
      {waiting !== undefined && (
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${waiting ? "bg-[#2563EB] text-white" : "bg-[#E5E7EB] text-[#6B7280]"}`}
        >
          {waiting} waiting
        </span>
      )}
    </header>
  );
}

export function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span className="grid size-5.5 flex-none place-items-center rounded-full text-[11px] font-extrabold text-white" style={{ background: color }} aria-hidden>
      {name[0]}
    </span>
  );
}

const navItem = (current: boolean) =>
  `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold ${current ? "bg-[#EFF6FF] text-[#1D4ED8]" : "text-[#374151] hover:bg-[#F0F1F3]"}`;

function Badge({ n }: { n: number }) {
  return (
    <span className="block min-w-4.5 rounded-full bg-[#2563EB] px-1.5 text-center text-[11px] leading-4.5 font-extrabold text-white" aria-label={`${n} waiting`}>
      {n}
    </span>
  );
}
