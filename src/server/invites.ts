import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { inviteCodes, voters, sessions } from "../db/schema";


type ClaimInviteInput = { code: string; fingerprint?: string };

export const claimInvite = createServerFn({ method: "POST" })
  .inputValidator((input: ClaimInviteInput) => input)
  .handler(async ({ data }) => {
    const { code, fingerprint = null } = data;
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

    // Check if visitor already joined this session — do this BEFORE the "used" check
    // so revisiting your own join link works even after the code is consumed.
    const existingVoterId = getCookie("movienightapp_voter");
    if (existingVoterId) {
      const existingVoter = await db
        .select()
        .from(voters)
        .where(and(eq(voters.id, existingVoterId), eq(voters.sessionId, invite.sessionId)))
        .get();

      if (existingVoter) {
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
          },
        };
      }
    }

    if (invite.status === "used") {
      throw new Error("ALREADY_USED:This spot was already claimed.");
    }

    if (invite.status === "revoked") {
      throw new Error("REVOKED:This invite link has been revoked.");
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

    // Create voter and mark invite as used
    await db.insert(voters).values({
      id: voterId,
      sessionId: invite.sessionId,
      displayName: null,
      invitedBy: invite.createdByVoterId || null,
      inviteDepth,
      inviteCode: null,
      inviteSlotsRemaining: invite.guestInviteSlots,
      fingerprint,
    });

    await db
      .update(inviteCodes)
      .set({ status: "used", usedByVoterId: voterId, usedAt: new Date().toISOString() })
      .where(eq(inviteCodes.code, code));

    // Set voter cookie
    setCookie("movienightapp_voter", voterId, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // app is served over plain HTTP on local network
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });

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
      },
    };
  });
