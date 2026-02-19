import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { eq, and, count } from "drizzle-orm";
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

    const totalVotes = await db
      .select({ cnt: count() })
      .from(votes)
      .where(and(eq(votes.sessionId, session.id), eq(votes.voterId, voterId)))
      .get();

    if ((totalVotes?.cnt ?? 0) >= session.votesPerVoter) {
      throw new Error(`You have used all ${session.votesPerVoter} votes`);
    }

    // Enforce max 1 vote per movie per voter
    const existingMovieVote = await db
      .select({ cnt: count() })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.voterId, voterId)))
      .get();

    if ((existingMovieVote?.cnt ?? 0) >= 1) {
      throw new Error("You have already voted for this movie");
    }

    await db.insert(votes).values({
      id: crypto.randomUUID(),
      sessionId: session.id,
      voterId,
      movieId: data.movieId,
    });

    const newTotal = (totalVotes?.cnt ?? 0) + 1;
    const movieVotes = await db
      .select({ cnt: count() })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.sessionId, session.id)))
      .get();

    const myMovieVotes = await db
      .select({ cnt: count() })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.voterId, voterId)))
      .get();

    return {
      success: true,
      votesUsed: newTotal,
      votesRemaining: session.votesPerVoter - newTotal,
      movie: {
        id: data.movieId,
        voteCount: movieVotes?.cnt ?? 0,
        myVotes: myMovieVotes?.cnt ?? 0,
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

    // Find most recent vote for this movie by this voter
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

    const totalVotes = await db
      .select({ cnt: count() })
      .from(votes)
      .where(and(eq(votes.sessionId, session.id), eq(votes.voterId, voterId)))
      .get();

    const movieVotes = await db
      .select({ cnt: count() })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.sessionId, session.id)))
      .get();

    const myMovieVotes = await db
      .select({ cnt: count() })
      .from(votes)
      .where(and(eq(votes.movieId, data.movieId), eq(votes.voterId, voterId)))
      .get();

    const cnt = totalVotes?.cnt ?? 0;

    return {
      success: true,
      votesUsed: cnt,
      votesRemaining: session.votesPerVoter - cnt,
      movie: {
        id: data.movieId,
        voteCount: movieVotes?.cnt ?? 0,
        myVotes: myMovieVotes?.cnt ?? 0,
      },
    };
  });
