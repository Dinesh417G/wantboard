import "server-only";
import { cookies } from "next/headers";
import type { Db, Party } from "./types";
import { DEMO_BUYER_ID } from "./seed";

export const VIEWER_COOKIE = "clinch_as";

/** Demo identity: which person you are browsing as. Real auth would replace this. */
export async function viewerId(): Promise<string> {
  return (await cookies()).get(VIEWER_COOKIE)?.value ?? DEMO_BUYER_ID;
}

export function viewerIn(db: Db, id: string): Party {
  return db.parties.find((p) => p.id === id) ?? db.parties.find((p) => p.id === DEMO_BUYER_ID)!;
}
