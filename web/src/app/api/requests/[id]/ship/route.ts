import { handle, body } from "@/lib/http";
import { mutate, getRequest, log, Conflict } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { note } = await body<{ note?: string }>(req);
  return mutate((db) => {
    const r = getRequest(db, id);
    if (r.status !== "awarded") throw new Conflict("request is not awaiting shipment");
    r.status = "shipped";
    r.shipNote = typeof note === "string" ? note.trim().slice(0, 300) : "";
    log(r, `Seller marked it shipped${r.shipNote ? `: ${r.shipNote}` : ""}`);
    return { status: r.status };
  });
});
