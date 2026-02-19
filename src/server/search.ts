import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { isMockMode, filterMockMovies, getMockRecentMovies } from "./mock-media";

function requireVoter() {
  const voterId = getCookie("movienightapp_voter");
  if (!voterId) throw new Error("UNAUTHORIZED");
  return voterId;
}

export const searchJellyfin = createServerFn({ method: "POST" })
  .inputValidator((q: string) => q)
  .handler(async ({ data: q }) => {
    requireVoter();

    if (!q || q.length < 2) throw new Error("Query must be at least 2 characters");

    if (isMockMode()) {
      return { results: filterMockMovies(q) };
    }

    const jellyfinUrl = process.env.JELLYFIN_URL;
    const jellyfinKey = process.env.JELLYFIN_API_KEY;

    if (!jellyfinUrl || !jellyfinKey) {
      throw new Error("Jellyfin is not configured");
    }

    const url = new URL(`${jellyfinUrl}/Items`);
    url.searchParams.set("searchTerm", q);
    url.searchParams.set("IncludeItemTypes", "Movie");
    url.searchParams.set("Recursive", "true");
    url.searchParams.set("Fields", "Overview,RunTimeTicks,ProductionYear,PrimaryImageAspectRatio,ProviderIds");
    url.searchParams.set("Limit", "20");
    url.searchParams.set("api_key", jellyfinKey);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Jellyfin returned ${response.status}`);

    const data = await response.json() as { Items?: any[] };
    const items = (data.Items ?? []).map((item: any) => ({
      id: `jellyfin:${item.Id}`,
      title: item.Name,
      year: item.ProductionYear ?? null,
      runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
      synopsis: item.Overview ?? null,
      posterUrl: `/api/images/jellyfin/${item.Id}`,
      source: "jellyfin",
      jellyfinId: item.Id,
      tmdbId: item.ProviderIds?.Tmdb ?? null,
      status: "in_library",
    }));

    return { results: items };
  });

export const searchTmdb = createServerFn({ method: "POST" })
  .inputValidator((q: string) => q)
  .handler(async ({ data: q }) => {
    requireVoter();

    if (!q || q.length < 2) throw new Error("Query must be at least 2 characters");

    if (isMockMode()) {
      return { results: filterMockMovies(q) };
    }

    const jellyseerrUrl = process.env.JELLYSEERR_URL;
    const jellyseerrKey = process.env.JELLYSEERR_API_KEY;

    if (!jellyseerrUrl || !jellyseerrKey) {
      throw new Error("Jellyseerr is not configured");
    }

    const url = new URL(`${jellyseerrUrl}/api/v1/search`);
    url.searchParams.set("query", q);
    url.searchParams.set("page", "1");
    url.searchParams.set("language", "en");

    const response = await fetch(url.toString(), {
      headers: { "X-Api-Key": jellyseerrKey },
    });

    if (!response.ok) throw new Error(`Jellyseerr returned ${response.status}`);

    const data = await response.json() as { results?: any[] };
    const results = (data.results ?? [])
      .filter((r: any) => r.mediaType === "movie")
      .map((item: any) => {
        const media = item.mediaInfo;
        let status = "nominated_only";
        if (media) {
          if (media.status === 5) status = "in_library";
          else if ([2, 3, 4].includes(media.status)) status = "requested";
        }
        const posterUrl = item.posterPath ? `/api/images/tmdb${item.posterPath}` : null;

        return {
          id: `tmdb:${item.id}`,
          title: item.title ?? item.originalTitle,
          year: item.releaseDate ? parseInt(item.releaseDate.slice(0, 4)) : null,
          runtimeMinutes: null,
          synopsis: item.overview ?? null,
          posterUrl,
          source: "jellyseerr",
          jellyfinId: null,
          tmdbId: String(item.id),
          status,
        };
      });

    return { results };
  });

export const recentlyAddedJellyfin = createServerFn({ method: "POST" })
  .handler(async () => {
    requireVoter();

    if (isMockMode()) {
      return { results: getMockRecentMovies() };
    }

    const jellyfinUrl = process.env.JELLYFIN_URL;
    const jellyfinKey = process.env.JELLYFIN_API_KEY;

    if (!jellyfinUrl || !jellyfinKey) {
      throw new Error("Jellyfin is not configured");
    }

    const url = new URL(`${jellyfinUrl}/Items`);
    url.searchParams.set("SortBy", "DateCreated");
    url.searchParams.set("SortOrder", "Descending");
    url.searchParams.set("IncludeItemTypes", "Movie");
    url.searchParams.set("Recursive", "true");
    url.searchParams.set("Fields", "Overview,RunTimeTicks,ProductionYear,PrimaryImageAspectRatio,ProviderIds");
    url.searchParams.set("Limit", "20");
    url.searchParams.set("api_key", jellyfinKey);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Jellyfin returned ${response.status}`);

    const data = await response.json() as { Items?: any[] };
    const items = (data.Items ?? []).map((item: any) => ({
      id: `jellyfin:${item.Id}`,
      title: item.Name,
      year: item.ProductionYear ?? null,
      runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
      synopsis: item.Overview ?? null,
      posterUrl: `/api/images/jellyfin/${item.Id}`,
      source: "jellyfin",
      jellyfinId: item.Id,
      tmdbId: item.ProviderIds?.Tmdb ?? null,
      status: "in_library",
    }));

    return { results: items };
  });
