import "server-only";
import { redirect } from "next/navigation";
import type { Db, Party } from "./types";
import { sessionPartyId } from "./auth";

export const GUEST_ID = "guest";

/** Not signed in: can browse, cannot act. */
export const GUEST: Party = {
  id: GUEST_ID,
  name: "Guest",
  handle: "",
  city: "",
  role: "buyer",
  paypalEmail: "",
  categories: [],
  bio: "",
  joinedAt: new Date(0).toISOString(),
};

export async function viewerId(): Promise<string> {
  return (await sessionPartyId()) ?? GUEST_ID;
}

export function viewerIn(db: Db, id: string): Party {
  return db.parties.find((p) => p.id === id) ?? GUEST;
}

/** For pages that need an account: send guests to sign in, then back here. */
export async function requireViewer(db: Db, next: string): Promise<Party> {
  const me = viewerIn(db, await viewerId());
  if (me.id === GUEST_ID) redirect(`/login?next=${encodeURIComponent(next)}`);
  return me;
}
