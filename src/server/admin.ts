import { createServerFn } from "@tanstack/react-start";
import { eq, sql, and } from "drizzle-orm";
import { db } from "../db";
import { sessions, movies, voters, votes, inviteCodes } from "../db/schema";
import { generateInviteCode } from "../lib/inviteCodes";
import { getRequestUrl } from "@tanstack/react-start/server";

function requireAdmin(secret: string) {
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    throw new Error("UNAUTHORIZED");
  }
}

export const adminListSessions = createServerFn({ method: "POST" })
  .inputValidator((secret: string) => secret)
  .handler(async ({ data: secret }) => {
    requireAdmin(secret);

    const rows = await db
      .select({
        id: sessions.id,
        slug: sessions.slug,
        name: sessions.name,
        status: sessions.status,
        votesPerVoter: sessions.votesPerVoter,
        maxInviteDepth: sessions.maxInviteDepth,
        guestInviteSlots: sessions.guestInviteSlots,
        allowJellyseerrRequests: sessions.allowJellyseerrRequests,
        expiresAt: sessions.expiresAt,
        createdAt: sessions.createdAt,
        winnerMovieId: sessions.winnerMovieId,
        voterCount: sql<number>`(SELECT COUNT(*) FROM voters WHERE session_id = ${sessions.id})`,
        movieCount: sql<number>`(SELECT COUNT(*) FROM movies WHERE session_id = ${sessions.id})`,
        totalVotes: sql<number>`(SELECT COUNT(*) FROM votes WHERE session_id = ${sessions.id})`,
      })
      .from(sessions)
      .orderBy(sql`${sessions.createdAt} DESC`);

    return { sessions: rows };
  });

type CreateSessionInput = {
  secret: string;
  name: string;
  slug: string;
  votesPerVoter?: number;
  rootInviteCodes?: number;
  guestInviteSlots?: number;
  maxInviteDepth?: number | null;
  allowJellyseerrRequests?: boolean;
  expiresAt?: string | null;
};

export const adminCreateSession = createServerFn({ method: "POST" })
  .inputValidator((input: CreateSessionInput) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const { name, slug, votesPerVoter = 5,
      guestInviteSlots = 1, maxInviteDepth = null,
      allowJellyseerrRequests = true, expiresAt = null } = data;

    if (!name || !slug) throw new Error("name and slug are required");
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("slug must be lowercase alphanumeric with hyphens only");

    const existing = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.slug, slug)).get();
    if (existing) throw new Error("A session with this slug already exists");

    const sessionId = crypto.randomUUID();

    await db.insert(sessions).values({
      id: sessionId,
      slug,
      name,
      status: "open",
      votesPerVoter,
      maxInviteDepth: maxInviteDepth ?? null,
      guestInviteSlots,
      allowJellyseerrRequests: allowJellyseerrRequests ? 1 : 0,
      expiresAt: expiresAt ?? null,
    });

    const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

    return { session };
  });

export const adminGetSession = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; id: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const session = await db.select().from(sessions).where(eq(sessions.id, data.id)).get();
    if (!session) throw new Error("NOT_FOUND");

    const movieRows = await db
      .select({
        id: movies.id,
        sessionId: movies.sessionId,
        title: movies.title,
        year: movies.year,
        runtimeMinutes: movies.runtimeMinutes,
        synopsis: movies.synopsis,
        posterUrl: movies.posterUrl,
        source: movies.source,
        jellyfinId: movies.jellyfinId,
        tmdbId: movies.tmdbId,
        jellyseerrRequestId: movies.jellyseerrRequestId,
        status: movies.status,
        nominatedBy: movies.nominatedBy,
        createdAt: movies.createdAt,
        voteCount: sql<number>`(SELECT COUNT(*) FROM votes WHERE movie_id = ${movies.id})`,
      })
      .from(movies)
      .where(eq(movies.sessionId, session.id))
      .orderBy(sql`(SELECT COUNT(*) FROM votes WHERE movie_id = ${movies.id}) DESC`);

    const voterRows = await db
      .select({
        id: voters.id,
        sessionId: voters.sessionId,
        displayName: voters.displayName,
        invitedBy: voters.invitedBy,
        inviteDepth: voters.inviteDepth,
        inviteCode: voters.inviteCode,
        inviteSlotsRemaining: voters.inviteSlotsRemaining,
        joinedAt: voters.joinedAt,
        fingerprint: voters.fingerprint,
        voteCount: sql<number>`(SELECT COUNT(*) FROM votes WHERE voter_id = ${voters.id})`,
      })
      .from(voters)
      .where(eq(voters.sessionId, session.id))
      .orderBy(voters.joinedAt);

    const codeRows = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.sessionId, session.id))
      .orderBy(inviteCodes.createdAt);

    return { session, movies: movieRows, voters: voterRows, codes: codeRows };
  });

export const adminCloseSession = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; id: string; winnerMovieId?: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const session = await db.select().from(sessions).where(eq(sessions.id, data.id)).get();
    if (!session) throw new Error("NOT_FOUND");

    let winner = data.winnerMovieId;
    if (!winner) {
      // Use JS-based counting to avoid count() issues with sqlite-proxy
      const allVotes = await db
        .select({ movieId: votes.movieId })
        .from(votes)
        .where(eq(votes.sessionId, session.id));
      const voteCounts: Record<string, number> = {};
      for (const v of allVotes) {
        voteCounts[v.movieId] = (voteCounts[v.movieId] ?? 0) + 1;
      }
      winner = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    }

    await db
      .update(sessions)
      .set({ status: "closed", winnerMovieId: winner ?? null })
      .where(eq(sessions.id, data.id));

    const updated = await db.select().from(sessions).where(eq(sessions.id, data.id)).get();
    return { session: updated };
  });

export const adminGetTree = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; id: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const session = await db.select().from(sessions).where(eq(sessions.id, data.id)).get();
    if (!session) throw new Error("NOT_FOUND");

    const voterRows = await db
      .select({
        id: voters.id,
        displayName: voters.displayName,
        invitedBy: voters.invitedBy,
        inviteDepth: voters.inviteDepth,
        inviteSlotsRemaining: voters.inviteSlotsRemaining,
        joinedAt: voters.joinedAt,
        fingerprint: voters.fingerprint,
        voteCount: sql<number>`(SELECT COUNT(*) FROM votes WHERE voter_id = ${voters.id})`,
      })
      .from(voters)
      .where(eq(voters.sessionId, session.id));

    const codeRows = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.sessionId, session.id));

    type TreeNode = {
      id: string;
      displayName: string;
      inviteDepth: number;
      voteCount: number;
      inviteSlotsRemaining: number;
      joinedAt: string;
      fingerprint: string | null;
      codes: { code: string; status: string }[];
      children: TreeNode[];
    };

    function buildTree(parentId: string | null): TreeNode[] {
      return voterRows
        .filter((v) => v.invitedBy === parentId)
        .map((voter) => {
          const voterCodes = codeRows
            .filter((c) => c.createdByVoterId === voter.id)
            .map((c) => ({ code: c.code, status: c.status }));
          return {
            id: voter.id,
            displayName: voter.displayName || `Guest #${voter.id.slice(0, 6)}`,
            inviteDepth: voter.inviteDepth,
            voteCount: voter.voteCount,
            inviteSlotsRemaining: voter.inviteSlotsRemaining,
            joinedAt: voter.joinedAt,
            fingerprint: voter.fingerprint ?? null,
            codes: voterCodes,
            children: buildTree(voter.id),
          };
        });
    }

    const tree = buildTree(null);
    const rootCodes = codeRows
      .filter((c) => !c.createdByVoterId)
      .map((c) => ({ code: c.code, status: c.status, usedByVoterId: c.usedByVoterId }));

    return {
      session: { id: session.id, name: session.name, slug: session.slug },
      rootCodes,
      tree,
    };
  });

export const adminAdjustInviteSlots = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; voterId: string; inviteSlotsRemaining: number }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const voter = await db.select().from(voters).where(eq(voters.id, data.voterId)).get();
    if (!voter) throw new Error("NOT_FOUND");

    const slots = Math.max(0, data.inviteSlotsRemaining);

    let inviteCode = voter.inviteCode;
    if (slots > 0 && !inviteCode) {
      inviteCode = generateInviteCode();
      await db.insert(inviteCodes).values({
        code: inviteCode,
        sessionId: voter.sessionId,
        createdByVoterId: voter.id,
        status: "unused",
      });
    }

    await db
      .update(voters)
      .set({ inviteSlotsRemaining: slots, inviteCode })
      .where(eq(voters.id, data.voterId));

    return { success: true, inviteSlotsRemaining: slots, inviteCode };
  });

export const adminRevokeCode = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; code: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const invite = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, data.code))
      .get();

    if (!invite) throw new Error("NOT_FOUND");
    if (invite.status === "used") throw new Error("Code already used");

    await db
      .update(inviteCodes)
      .set({ status: "revoked" })
      .where(eq(inviteCodes.code, data.code));

    return { success: true };
  });

export const adminReopenCode = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; code: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const invite = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, data.code))
      .get();

    if (!invite) throw new Error("NOT_FOUND");

    await db
      .update(inviteCodes)
      .set({ status: "unused", usedByVoterId: null, usedAt: null })
      .where(eq(inviteCodes.code, data.code));

    return { success: true };
  });

export const adminDeleteCode = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; code: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const invite = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, data.code))
      .get();

    if (!invite) throw new Error("NOT_FOUND");

    // If the code was used, remove the voter and their votes
    if (invite.usedByVoterId) {
      await db.delete(votes).where(eq(votes.voterId, invite.usedByVoterId));
      await db.delete(voters).where(eq(voters.id, invite.usedByVoterId));
    }

    await db.delete(inviteCodes).where(eq(inviteCodes.code, data.code));

    return { success: true };
  });

export const adminClearVotes = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; sessionId: string; voterId?: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    if (data.voterId) {
      await db.delete(votes).where(
        and(eq(votes.sessionId, data.sessionId), eq(votes.voterId, data.voterId))
      );
    } else {
      await db.delete(votes).where(eq(votes.sessionId, data.sessionId));
    }

    return { success: true };
  });

export const adminRemoveVoter = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; voterId: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const voter = await db.select().from(voters).where(eq(voters.id, data.voterId)).get();
    if (!voter) throw new Error("NOT_FOUND");

    await db.delete(voters).where(eq(voters.id, data.voterId));
    return { success: true };
  });

export const adminDeleteSession = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; id: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const session = await db.select().from(sessions).where(eq(sessions.id, data.id)).get();
    if (!session) throw new Error("NOT_FOUND");

    // Manual cascade (no FK CASCADE in schema): votes → invite_codes → voters → movies → sessions
    await db.delete(votes).where(eq(votes.sessionId, data.id));
    await db.delete(inviteCodes).where(eq(inviteCodes.sessionId, data.id));
    await db.delete(voters).where(eq(voters.sessionId, data.id));
    await db.delete(movies).where(eq(movies.sessionId, data.id));
    await db.delete(sessions).where(eq(sessions.id, data.id));

    return { success: true };
  });

export const adminGenerateCodes = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string; sessionId: string; count: number; label: string }) => input)
  .handler(async ({ data }) => {
    requireAdmin(data.secret);

    const label = data.label.trim();
    if (!label) throw new Error("A name for the invite code is required");

    const session = await db.select().from(sessions).where(eq(sessions.id, data.sessionId)).get();
    if (!session) throw new Error("NOT_FOUND");

    const codeCount = Math.max(1, Math.min(20, data.count));
    const codes: string[] = [];

    for (let i = 0; i < codeCount; i++) {
      const code = generateInviteCode();
      await db.insert(inviteCodes).values({
        code,
        sessionId: session.id,
        createdByVoterId: null,
        status: "unused",
        label,
      });
      codes.push(code);
    }

    const url = getRequestUrl();
    const baseUrl = `${url.protocol}//${url.host}`;

    return {
      codes: codes.map((c) => ({ code: c, url: `${baseUrl}/join/${c}` })),
    };
  });
