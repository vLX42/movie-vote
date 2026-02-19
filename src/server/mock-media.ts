export function isMockMode(): boolean {
  return process.env.MOCK_MEDIA === "true";
}

const MOCK_MOVIES_RAW = [
  {
    id: "jellyfin:mock-001",
    title: "The Godfather",
    year: 1972,
    runtimeMinutes: 175,
    synopsis: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
    posterUrl: null,
    source: "jellyfin",
    jellyfinId: "mock-001",
    tmdbId: "238",
    status: "in_library",
  },
  {
    id: "jellyfin:mock-002",
    title: "The Shawshank Redemption",
    year: 1994,
    runtimeMinutes: 142,
    synopsis: "Two imprisoned men bond over a number of years, finding solace and redemption through acts of common decency.",
    posterUrl: null,
    source: "jellyfin",
    jellyfinId: "mock-002",
    tmdbId: "278",
    status: "in_library",
  },
  {
    id: "jellyfin:mock-003",
    title: "The Dark Knight",
    year: 2008,
    runtimeMinutes: 152,
    synopsis: "When the menace known as the Joker wreaks havoc and chaos on Gotham City, Batman must accept one of the greatest psychological and physical tests.",
    posterUrl: null,
    source: "jellyfin",
    jellyfinId: "mock-003",
    tmdbId: "155",
    status: "in_library",
  },
  {
    id: "jellyfin:mock-004",
    title: "Pulp Fiction",
    year: 1994,
    runtimeMinutes: 154,
    synopsis: "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    posterUrl: null,
    source: "jellyfin",
    jellyfinId: "mock-004",
    tmdbId: "680",
    status: "in_library",
  },
  {
    id: "jellyfin:mock-005",
    title: "Inception",
    year: 2010,
    runtimeMinutes: 148,
    synopsis: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a CEO.",
    posterUrl: null,
    source: "jellyfin",
    jellyfinId: "mock-005",
    tmdbId: "27205",
    status: "in_library",
  },
  {
    id: "jellyfin:mock-006",
    title: "The Matrix",
    year: 1999,
    runtimeMinutes: 136,
    synopsis: "A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.",
    posterUrl: null,
    source: "jellyfin",
    jellyfinId: "mock-006",
    tmdbId: "603",
    status: "in_library",
  },
  {
    id: "jellyfin:mock-007",
    title: "Interstellar",
    year: 2014,
    runtimeMinutes: 169,
    synopsis: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    posterUrl: null,
    source: "jellyfin",
    jellyfinId: "mock-007",
    tmdbId: "157336",
    status: "in_library",
  },
  {
    id: "tmdb:mock-008",
    title: "Cinema Paradiso",
    year: 1988,
    runtimeMinutes: 155,
    synopsis: "A filmmaker recalls his childhood memories of falling in love with film and a close relationship with a cinema projectionist.",
    posterUrl: null,
    source: "jellyseerr",
    jellyfinId: null,
    tmdbId: "11216",
    status: "nominated_only",
  },
  {
    id: "tmdb:mock-009",
    title: "Parasite",
    year: 2019,
    runtimeMinutes: 132,
    synopsis: "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
    posterUrl: null,
    source: "jellyseerr",
    jellyfinId: null,
    tmdbId: "496243",
    status: "requested",
  },
  {
    id: "tmdb:mock-010",
    title: "Spirited Away",
    year: 2001,
    runtimeMinutes: 125,
    synopsis: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.",
    posterUrl: null,
    source: "jellyseerr",
    jellyfinId: null,
    tmdbId: "129",
    status: "nominated_only",
  },
];

export function filterMockMovies(query: string) {
  const q = query.toLowerCase();
  return MOCK_MOVIES_RAW.filter(
    (m) => m.title.toLowerCase().includes(q) || String(m.year).includes(q)
  );
}

export function getMockRecentMovies() {
  return MOCK_MOVIES_RAW.filter((m) => m.source === "jellyfin");
}
