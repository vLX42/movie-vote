import { createAPIFileRoute } from "@tanstack/react-start/api";

export const APIRoute = createAPIFileRoute("/api/images/tmdb/$")({
  GET: async ({ params }) => {
    const imagePath = "/" + (params as any)["*"];
    const tmdbImageBase = "https://image.tmdb.org/t/p/w400";

    try {
      const url = `${tmdbImageBase}${imagePath}`;
      const response = await fetch(url);

      if (!response.ok) {
        return new Response("Image not found", { status: response.status });
      }

      return new Response(response.body, {
        headers: {
          "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      return new Response("Failed to fetch image", { status: 502 });
    }
  },
});
