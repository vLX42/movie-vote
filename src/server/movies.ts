import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { eq, and, or } from "drizzle-orm";
import { db } from "../db";
import { movies, voters, sessions, votes } from "../db/schema";

type NominateInput = {
  slug: string;
  title: string;
  year?: number | null;
  runtimeMinutes?: number | null;
  synopsis?: string | null;
  posterUrl?: string | null;
  source: string;
  jellyfinId?: string | null;
  tmdbId?: string | null;
  status?: string;
};

export const nominateMovie = createServerFn({ method: "POST" })
  .inputValidator((input: NominateInput) => input)
  .handler(async ({ data }) => {
    const voterId = getCookie("movienightapp_voter");
    if (!voterId) throw new Error("UNAUTHORIZED");

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.slug, data.slug))
      .get();

    if (!session) throw new Error("NOT_FOUND");
    if (session.status !== "open") throw new Error("Session is not open");

    const voter = await db
      .select()
      .from(voters)
      .where(and(eq(voters.id, voterId), eq(voters.sessionId, session.id)))
      .get();

    if (!voter) throw new Error("UNAUTHORIZED");

    // Check for duplicate
    const existing = await db
      .select({ id: movies.id })
      .from(movies)
      .where(
        and(
          eq(movies.sessionId, session.id),
          or(
            data.jellyfinId ? eq(movies.jellyfinId, data.jellyfinId) : undefined,
            data.tmdbId ? eq(movies.tmdbId, data.tmdbId) : undefined,
          )
        )
      )
      .get();

    if (existing) {
      throw new Error(`DUPLICATE:${existing.id}`);
    }

    const movieId = crypto.randomUUID();
    await db.insert(movies).values({
      id: movieId,
      sessionId: session.id,
      title: data.title,
      year: data.year ?? null,
      runtimeMinutes: data.runtimeMinutes ?? null,
      synopsis: data.synopsis ?? null,
      posterUrl: data.posterUrl ?? null,
      source: data.source,
      jellyfinId: data.jellyfinId ?? null,
      tmdbId: data.tmdbId ?? null,
      status: data.status ?? "in_library",
      nominatedBy: voterId,
    });

    return { success: true, movieId };
  });

export const removeMovie = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; movieId: string }) => input)
  .handler(async ({ data }) => {
    const voterId = getCookie("movienightapp_voter");
    if (!voterId) throw new Error("UNAUTHORIZED");

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.slug, data.slug))
      .get();

    if (!session) throw new Error("NOT_FOUND");
    if (session.status !== "open") throw new Error("Session is not open");

    const movie = await db
      .select()
      .from(movies)
      .where(and(eq(movies.id, data.movieId), eq(movies.sessionId, session.id)))
      .get();

    if (!movie) throw new Error("NOT_FOUND");
    if (movie.nominatedBy !== voterId) throw new Error("UNAUTHORIZED");

    // Delete votes first (no FK cascade in schema)
    await db.delete(votes).where(eq(votes.movieId, data.movieId));
    await db.delete(movies).where(eq(movies.id, data.movieId));

    return { success: true };
  });

type RequestInput = {
  slug: string;
  title: string;
  year?: number | null;
  runtimeMinutes?: number | null;
  synopsis?: string | null;
  posterUrl?: string | null;
  tmdbId: string;
};

export const requestMovie = createServerFn({ method: "POST" })
  .inputValidator((input: RequestInput) => input)
  .handler(async ({ data }) => {
    const voterId = getCookie("movienightapp_voter");
    if (!voterId) throw new Error("UNAUTHORIZED");

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.slug, data.slug))
      .get();

    if (!session) throw new Error("NOT_FOUND");
    if (session.status !== "open") throw new Error("Session is not open");
    if (!session.allowJellyseerrRequests) throw new Error("Requests disabled");

    const voter = await db
      .select()
      .from(voters)
      .where(and(eq(voters.id, voterId), eq(voters.sessionId, session.id)))
      .get();

    if (!voter) throw new Error("UNAUTHORIZED");

    const existing = await db
      .select({ id: movies.id })
      .from(movies)
      .where(and(eq(movies.sessionId, session.id), eq(movies.tmdbId, data.tmdbId)))
      .get();

    if (existing) throw new Error(`DUPLICATE:${existing.id}`);

    // Submit Jellyseerr request
    let jellyseerrRequestId: string | null = null;
    const jellyseerrUrl = process.env.JELLYSEERR_URL;
    const jellyseerrKey = process.env.JELLYSEERR_API_KEY;

    if (jellyseerrUrl && jellyseerrKey) {
      try {
        const response = await fetch(`${jellyseerrUrl}/api/v1/request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": jellyseerrKey,
          },
          body: JSON.stringify({ mediaType: "movie", mediaId: parseInt(data.tmdbId) }),
        });
        if (response.ok) {
          const resData = await response.json() as { id?: number };
          jellyseerrRequestId = String(resData.id ?? "");
        }
      } catch (err) {
        console.error("Jellyseerr request failed:", err);
      }
    }

    const movieId = crypto.randomUUID();
    await db.insert(movies).values({
      id: movieId,
      sessionId: session.id,
      title: data.title,
      year: data.year ?? null,
      runtimeMinutes: data.runtimeMinutes ?? null,
      synopsis: data.synopsis ?? null,
      posterUrl: data.posterUrl ?? null,
      source: "jellyseerr",
      tmdbId: data.tmdbId,
      jellyseerrRequestId,
      status: "requested",
      nominatedBy: voterId,
    });

    return { success: true, movieId };
  });
