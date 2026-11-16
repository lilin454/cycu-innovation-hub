import "server-only";
import { all, first } from "./db";
import { MILESTONE_KINDS, MILESTONE_SUBJECTS, type Milestone, type MilestoneKind, type MilestoneSubject } from "./milestone-types";

// 活動紀錄：創創社、幹部與社員過往的獲獎、參訪與活動成果

export type MilestoneFilters = { kind: MilestoneKind | null; subject: MilestoneSubject | null };

export function parseMilestoneFilters(sp: Record<string, string | string[] | undefined>): MilestoneFilters {
  const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").toUpperCase();
  const kind = one(sp.kind);
  const subject = one(sp.who);
  return {
    kind: (MILESTONE_KINDS as readonly string[]).includes(kind) ? (kind as MilestoneKind) : null,
    subject: (MILESTONE_SUBJECTS as readonly string[]).includes(subject) ? (subject as MilestoneSubject) : null,
  };
}

export async function listPublicMilestones(f: MilestoneFilters, limit = 200): Promise<Milestone[]> {
  const where = [`"status" = 'PUBLISHED'`];
  const params: (string | number)[] = [];
  if (f.kind) {
    where.push(`"kind" = ?`);
    params.push(f.kind);
  }
  if (f.subject) {
    where.push(`"subject" = ?`);
    params.push(f.subject);
  }
  return all<Milestone>(
    `SELECT * FROM "Milestone" WHERE ${where.join(" AND ")} ORDER BY "occurredOn" DESC, "createdAt" DESC LIMIT ?`,
    ...params,
    limit,
  );
}

export async function listAdminMilestones(): Promise<Milestone[]> {
  return all<Milestone>(`SELECT * FROM "Milestone" ORDER BY "occurredOn" DESC, "createdAt" DESC LIMIT 500`);
}

export async function getMilestone(id: string): Promise<Milestone | null> {
  if (!/^[a-z0-9]{1,40}$/i.test(id)) return null;
  return first<Milestone>(`SELECT * FROM "Milestone" WHERE "id" = ?`, id);
}
