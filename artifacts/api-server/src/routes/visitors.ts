import { Router, type IRouter } from "express";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, visitorsTable } from "@workspace/db";
import {
  CreateVisitorBody,
  CreateVisitorResponse,
  DeleteVisitorParams,
  GetVisitorSummaryResponse,
  ListVisitorsQueryParams,
  ListVisitorsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/visitors", async (req, res): Promise<void> => {
  const parsedQuery = ListVisitorsQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    req.log.warn({ errors: parsedQuery.error.message }, "Invalid visitor search");
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  const search = parsedQuery.data.search.trim().slice(0, 100);
  const visitors = search
    ? await db
        .select()
        .from(visitorsTable)
        .where(
          or(
            ilike(visitorsTable.name, `%${search}%`),
            ilike(visitorsTable.phone, `%${search}%`),
            ilike(visitorsTable.personToMeet, `%${search}%`),
            ilike(visitorsTable.purpose, `%${search}%`),
          ),
        )
        .orderBy(desc(visitorsTable.checkedInAt))
    : await db
        .select()
        .from(visitorsTable)
        .orderBy(desc(visitorsTable.checkedInAt));

  res.json(ListVisitorsResponse.parse(visitors));
});

router.post("/visitors", async (req, res): Promise<void> => {
  // Normalize user-entered whitespace before validation/storage.
  const normalizedBody =
    req.body && typeof req.body === "object"
      ? Object.fromEntries(
          Object.entries(req.body).map(([key, value]) => [
            key,
            typeof value === "string" ? value.trim() : value,
          ]),
        )
      : req.body;

  const parsedBody = CreateVisitorBody.safeParse(normalizedBody);
  if (!parsedBody.success) {
    req.log.warn({ errors: parsedBody.error.message }, "Invalid visitor details");
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const [visitor] = await db
    .insert(visitorsTable)
    .values(parsedBody.data)
    .returning();

  res.status(201).json(CreateVisitorResponse.parse(visitor));
});

router.delete("/visitors/:id", async (req, res): Promise<void> => {
  const parsedParams = DeleteVisitorParams.safeParse(req.params);
  if (!parsedParams.success) {
    req.log.warn({ errors: parsedParams.error.message }, "Invalid visitor id");
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }

  const [deletedVisitor] = await db
    .delete(visitorsTable)
    .where(eq(visitorsTable.id, parsedParams.data.id))
    .returning({ id: visitorsTable.id });

  if (!deletedVisitor) {
    res.status(404).json({ error: "Visitor not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/visitors/summary", async (_req, res): Promise<void> => {
  const [summary] = await db
    .select({
      total: sql<number>`count(*)`,
      today: sql<number>`count(*) filter (where ${visitorsTable.checkedInAt} >= current_date)`,
      latestCheckIn: sql<Date | null>`max(${visitorsTable.checkedInAt})`,
    })
    .from(visitorsTable);

  res.json(
    GetVisitorSummaryResponse.parse({
      total: Number(summary?.total ?? 0),
      today: Number(summary?.today ?? 0),
      latestCheckIn: summary?.latestCheckIn ?? null,
    }),
  );
});

export default router;