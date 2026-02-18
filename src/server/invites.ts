import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, getRequestURL } from "@tanstack/react-start/server";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { inviteCodes, voters, sessions } from "../db/schema";
import { generateInviteCode } from "../lib/inviteCodes";

export const claimInvite = createServerFn({ method: "POST" })
  .inputValidator((code: string) => code)
  .handler(async ({ data: code }) => {
    const invite = await db
      .select({
        code: inviteCodes.code,
        status: inviteCodes.status,
        sessionId: inviteCodes.sessionId,
        createdByVoterId: inviteCodes.createdByVoterId,
        sessionSlug: sessions.slug,
        sessionName: sessions.name,
        sessionStatus: sessions.status,
        votesPerVoter: sessions.votesPerVoter,
        guestInviteSlots: sessions.guestInviteSlots,
        maxInviteDepth: sessions.maxInviteDepth,
        allowJellyseerrRequests: sessions.allowJellyseerrRequests,
      })
      .from(inviteCodes)
      .innerJoin(sessions, eq(inviteCodes.sessionId, sessions.id))
      .where(eq(inviteCodes.code, code))
      .get();

    if (!invite) {
      throw new Error("INVALID:This invite link is not valid.");
    }

    if (invite.sessionStatus !== "open") {
      throw new Error(`SESSION_CLOSED:${invite.sessionName}:${invite.sessionSlug}`);
    }

    if (invite.status === "used") {
      throw new Error("ALREADY_USED:This spot was already claimed.");
    }

    if (invite.status === "revoked") {
      throw new Error("REVOKED:This invite link has been revoked.");
    }

    // Check if visitor already joined this session
    const existingVoterId = getCookie("movienightapp_voter");
    if (existingVoterId) {
      const existingVoter = await db
        .select()
        .from(voters)
        .where(and(eq(voters.id, existingVoterId), eq(voters.sessionId, invite.sessionId)))
        .get();

      if (existingVoter) {
        const url = getRequestURL();
        const baseUrl = `${url.protocol}//${url.host}`;
        const inviteUrl = existingVoter.inviteCode
          ? `${baseUrl}/join/${existingVoter.inviteCode}`
          : null;

        return {
          success: true,
          alreadyJoined: true,
          session: {
            slug: invite.sessionSlug,
            name: invite.sessionName,
            votesPerVoter: invite.votesPerVoter,
            allowJellyseerrRequests: !!invite.allowJellyseerrRequests,
          },
          voter: {
            id: existingVoter.id,
            displayName: existingVoter.displayName,
            inviteSlotsRemaining: existingVoter.inviteSlotsRemaining,
            inviteUrl,
          },
        };
      }
    }

    // Determine invite depth
    let inviteDepth = 0;
    if (invite.createdByVoterId) {
      const inviter = await db
        .select({ inviteDepth: voters.inviteDepth })
        .from(voters)
        .where(eq(voters.id, invite.createdByVoterId))
        .get();
      if (inviter) {
        inviteDepth = inviter.inviteDepth + 1;
      }
    }

    if (invite.maxInviteDepth !== null && inviteDepth > invite.maxInviteDepth) {
      throw new Error("DEPTH_EXCEEDED:This session has reached its maximum invite depth.");
    }

    const voterId = crypto.randomUUID();
    const voterInviteCode = invite.guestInviteSlots > 0 ? generateInviteCode() : null;

    // Create voter and mark invite as used
    await db.insert(voters).values({
      id: voterId,
      sessionId: invite.sessionId,
      displayName: null,
      invitedBy: invite.createdByVoterId || null,
      inviteDepth,
      inviteCode: voterInviteCode,
      inviteSlotsRemaining: invite.guestInviteSlots,
    });

    await db
      .update(inviteCodes)
      .set({ status: "used", usedByVoterId: voterId, usedAt: new Date().toISOString() })
      .where(eq(inviteCodes.code, code));

    if (voterInviteCode) {
      await db.insert(inviteCodes).values({
        code: voterInviteCode,
        sessionId: invite.sessionId,
        createdByVoterId: voterId,
        status: "unused",
      });
    }

    // Set voter cookie
    setCookie("movienightapp_voter", voterId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });

    const url = getRequestURL();
    const baseUrl = `${url.protocol}//${url.host}`;
    const inviteUrl = voterInviteCode ? `${baseUrl}/join/${voterInviteCode}` : null;

    return {
      success: true,
      alreadyJoined: false,
      session: {
        slug: invite.sessionSlug,
        name: invite.sessionName,
        votesPerVoter: invite.votesPerVoter,
        allowJellyseerrRequests: !!invite.allowJellyseerrRequests,
      },
      voter: {
        id: voterId,
        displayName: null,
        inviteSlotsRemaining: invite.guestInviteSlots,
        inviteUrl,
      },
    };
  });
