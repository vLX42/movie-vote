import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { votes, movies, voters, sessions } from "../db/schema";

type VoteInput = { slug: string; movieId: string };

export const castVote = createServerFn({ method: "POST" })
  .inputValidator((input: VoteInput) => input)
  .handler(async ({ data }) => {
    const voterId = getCookie("movienightapp_voter");
    if (!voterId) throw new Error("UNAUTHORIZED");

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.slug, data.slug))
      .get();

    if (!session) throw new Error("NOT_FOUND");
    if (session.status !== "open") throw new Error("Session is closed");

    const voter = await db
      .select()
      .from(voters)
      .where(and(eq(voters.id, voterId), eq(voters.sessionId, session.id)))
      .get();

    if (!voter) throw new Error("UNAUTHORIZED");

    const movie = await db
      .select()
      .from(movies)
      .where(and(eq(movies.id, data.movieId), eq(movies.sessionId, session.id)))
      .get();

    if (!movie) throw new Error("Movie not found");

    // Use .all() + .length instead of count() — count() via sqlite-proxy returns wrong values
    const userVotes = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.sessionId, session.id), eq(votes.voterId, voterId)));

    if (userVotes.length >= session.votesPerVoter) {
      throw new Error(`You have used all ${session.votesPerVoter} votes`);
    }

    // Enforce max 1 vote per movie per voter
    const existingMovieVote = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.voterId, voterId)))
      .limit(1)
      .get();

    if (existingMovieVote) {
      throw new Error("You have already voted for this movie");
    }

    await db.insert(votes).values({
      id: crypto.randomUUID(),
      sessionId: session.id,
      voterId,
      movieId: data.movieId,
    });

    const newTotal = userVotes.length + 1;

    // Fetch post-insert counts via .all() + .length
    const movieVoteRows = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.sessionId, session.id)));

    const myMovieVoteRows = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.voterId, voterId)));

    return {
      success: true,
      votesUsed: newTotal,
      votesRemaining: session.votesPerVoter - newTotal,
      movie: {
        id: data.movieId,
        voteCount: movieVoteRows.length,
        myVotes: myMovieVoteRows.length,
      },
    };
  });

export const retractVote = createServerFn({ method: "POST" })
  .inputValidator((input: VoteInput) => input)
  .handler(async ({ data }) => {
    const voterId = getCookie("movienightapp_voter");
    if (!voterId) throw new Error("UNAUTHORIZED");

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.slug, data.slug))
      .get();

    if (!session) throw new Error("NOT_FOUND");
    if (session.status !== "open") throw new Error("Session is closed");

    // Find vote for this movie by this voter
    const vote = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.movieId, data.movieId),
          eq(votes.voterId, voterId),
          eq(votes.sessionId, session.id),
        )
      )
      .limit(1)
      .get();

    if (!vote) throw new Error("No vote to retract");

    await db.delete(votes).where(eq(votes.id, vote.id));

    // Fetch post-delete counts via .all() + .length
    const userVotes = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.sessionId, session.id), eq(votes.voterId, voterId)));

    const movieVoteRows = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.sessionId, session.id)));

    const myMovieVoteRows = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.voterId, voterId)));

    return {
      success: true,
      votesUsed: userVotes.length,
      votesRemaining: session.votesPerVoter - userVotes.length,
      movie: {
        id: data.movieId,
        voteCount: movieVoteRows.length,
        myVotes: myMovieVoteRows.length,
      },
    };
  });
