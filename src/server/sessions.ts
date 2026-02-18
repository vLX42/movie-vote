import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestUrl } from "@tanstack/react-start/server";
import { eq, and, count, sql } from "drizzle-orm";
import { db } from "../db";
import { sessions, movies, voters, votes } from "../db/schema";

export type Movie = {
  id: string;
  sessionId: string;
  title: string;
  year: number | null;
  runtimeMinutes: number | null;
  synopsis: string | null;
  posterUrl: string | null;
  source: string;
  jellyfinId: string | null;
  tmdbId: string | null;
  jellyseerrRequestId: string | null;
  status: string;
  nominatedBy: string | null;
  createdAt: string;
  voteCount: number;
  myVotes: number;
};

export type SessionData = {
  session: {
    id: string;
    slug: string;
    name: string;
    status: string;
    votesPerVoter: number;
    allowJellyseerrRequests: boolean;
    expiresAt: string | null;
    winnerMovieId: string | null;
  };
  voter: {
    id: string;
    displayName: string | null;
    votesUsed: number;
    votesRemaining: number;
    inviteSlotsRemaining: number;
    inviteUrl: string | null;
  };
  movies: Movie[];
};

export const getSession = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<SessionData> => {
    const voterId = getCookie("movienightapp_voter");
    if (!voterId) {
      throw new Error("UNAUTHORIZED");
    }

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.slug, slug))
      .get();

    if (!session) {
      throw new Error("NOT_FOUND");
    }

    const voter = await db
      .select()
      .from(voters)
      .where(and(eq(voters.id, voterId), eq(voters.sessionId, session.id)))
      .get();

    if (!voter) {
      throw new Error("UNAUTHORIZED");
    }

    // Get movies with vote counts
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
        myVotes: sql<number>`(SELECT COUNT(*) FROM votes WHERE movie_id = ${movies.id} AND voter_id = ${voterId})`,
      })
      .from(movies)
      .where(eq(movies.sessionId, session.id))
      .orderBy(sql`(SELECT COUNT(*) FROM votes WHERE movie_id = ${movies.id}) DESC`, movies.createdAt);

    const totalVotesUsed = await db
      .select({ cnt: count() })
      .from(votes)
      .where(and(eq(votes.sessionId, session.id), eq(votes.voterId, voterId)))
      .get();

    const votesUsed = totalVotesUsed?.cnt ?? 0;

    const url = getRequestUrl();
    const baseUrl = `${url.protocol}//${url.host}`;
    const inviteUrl = voter.inviteCode ? `${baseUrl}/join/${voter.inviteCode}` : null;

    return {
      session: {
        id: session.id,
        slug: session.slug,
        name: session.name,
        status: session.status,
        votesPerVoter: session.votesPerVoter,
        allowJellyseerrRequests: !!session.allowJellyseerrRequests,
        expiresAt: session.expiresAt,
        winnerMovieId: session.winnerMovieId,
      },
      voter: {
        id: voter.id,
        displayName: voter.displayName,
        votesUsed,
        votesRemaining: session.votesPerVoter - votesUsed,
        inviteSlotsRemaining: voter.inviteSlotsRemaining,
        inviteUrl,
      },
      movies: movieRows as Movie[],
    };
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .inputValidator((displayName: string) => displayName)
  .handler(async ({ data: displayName }) => {
    const voterId = getCookie("movienightapp_voter");
    if (!voterId) throw new Error("UNAUTHORIZED");

    await db
      .update(voters)
      .set({ displayName })
      .where(eq(voters.id, voterId));

    return { success: true };
  });
