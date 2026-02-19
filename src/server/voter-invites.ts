import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestUrl } from "@tanstack/react-start/server";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { inviteCodes, voters } from "../db/schema";
import { generateInviteCode } from "../lib/inviteCodes";

export const createVoterInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { label?: string }) => input)
  .handler(async ({ data }) => {
    const voterId = getCookie("movienightapp_voter");
    if (!voterId) throw new Error("UNAUTHORIZED");

    const voter = await db.select().from(voters).where(eq(voters.id, voterId)).get();
    if (!voter) throw new Error("UNAUTHORIZED");

    // Count codes already created by this voter
    const existing = await db
      .select({ code: inviteCodes.code })
      .from(inviteCodes)
      .where(eq(inviteCodes.createdByVoterId, voterId));

    if (existing.length >= voter.inviteSlotsRemaining) {
      throw new Error("No invite slots remaining");
    }

    const code = generateInviteCode();
    const label = data.label?.trim() || null;

    await db.insert(inviteCodes).values({
      code,
      sessionId: voter.sessionId,
      createdByVoterId: voterId,
      status: "unused",
      label,
    });

    const url = getRequestUrl();
    const baseUrl = `${url.protocol}//${url.host}`;
    return { code, url: `${baseUrl}/join/${code}`, label };
  });

export const setInviteCodeLabel = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; label: string }) => input)
  .handler(async ({ data }) => {
    const voterId = getCookie("movienightapp_voter");
    if (!voterId) throw new Error("UNAUTHORIZED");

    // Verify this voter owns the code
    const invite = await db
      .select({ code: inviteCodes.code })
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, data.code), eq(inviteCodes.createdByVoterId, voterId)))
      .get();

    if (!invite) throw new Error("NOT_FOUND");

    await db
      .update(inviteCodes)
      .set({ label: data.label.trim() || null })
      .where(eq(inviteCodes.code, data.code));

    return { success: true };
  });
