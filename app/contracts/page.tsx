import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { ContractsHome, type Sheet } from "../parent/contracts-home";

const SHEETS: Sheet[] = ["create", "edit", "close", "pay", "paid"];
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// The parent's Contracts page; everyone else goes back home.
export default async function ContractsPage({ searchParams }: PageProps<"/contracts">) {
  const viewer = await getViewer();
  if (viewer.kind !== "parent") redirect("/");
  const params = await searchParams;
  const sheet = one(params.sheet) as Sheet | undefined;
  return (
    <ContractsHome
      childId={one(params.child)}
      sheet={sheet && SHEETS.includes(sheet) ? sheet : undefined}
      paidContractId={one(params.contract)}
    />
  );
}
