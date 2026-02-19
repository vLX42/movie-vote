import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("open"),
  votesPerVoter: integer("votes_per_voter").notNull().default(5),
  maxInviteDepth: integer("max_invite_depth"),
  guestInviteSlots: integer("guest_invite_slots").notNull().default(1),
  allowJellyseerrRequests: integer("allow_jellyseerr_requests").notNull().default(1),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  winnerMovieId: text("winner_movie_id"),
});

export const movies = sqliteTable("movies", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  title: text("title").notNull(),
  year: integer("year"),
  runtimeMinutes: integer("runtime_minutes"),
  synopsis: text("synopsis"),
  posterUrl: text("poster_url"),
  source: text("source").notNull(),
  jellyfinId: text("jellyfin_id"),
  tmdbId: text("tmdb_id"),
  jellyseerrRequestId: text("jellyseerr_request_id"),
  status: text("status").notNull().default("in_library"),
  nominatedBy: text("nominated_by"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const voters = sqliteTable("voters", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  displayName: text("display_name"),
  invitedBy: text("invited_by"),
  inviteDepth: integer("invite_depth").notNull().default(0),
  inviteCode: text("invite_code").unique(),
  inviteSlotsRemaining: integer("invite_slots_remaining").notNull().default(1),
  joinedAt: text("joined_at").notNull().default(sql`(datetime('now'))`),
  fingerprint: text("fingerprint"),
});

export const inviteCodes = sqliteTable("invite_codes", {
  code: text("code").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  createdByVoterId: text("created_by_voter_id"),
  usedByVoterId: text("used_by_voter_id"),
  status: text("status").notNull().default("unused"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  usedAt: text("used_at"),
});

export const votes = sqliteTable("votes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  voterId: text("voter_id").notNull().references(() => voters.id),
  movieId: text("movie_id").notNull().references(() => movies.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
