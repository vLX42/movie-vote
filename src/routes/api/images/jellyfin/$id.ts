import { createAPIFileRoute } from "@tanstack/react-start/api";

export const APIRoute = createAPIFileRoute("/api/images/jellyfin/$id")({
  GET: async ({ params }) => {
    const jellyfinUrl = process.env.JELLYFIN_URL;
    const jellyfinKey = process.env.JELLYFIN_API_KEY;

    if (!jellyfinUrl || !jellyfinKey) {
      return new Response("Jellyfin not configured", { status: 503 });
    }

    try {
      const url = `${jellyfinUrl}/Items/${params.id}/Images/Primary?api_key=${jellyfinKey}&maxWidth=400&quality=90`;
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
