import { createFileRoute } from "@tanstack/react-router";
import { isMockMode } from "../../../../server/mock-media";

export const Route = createFileRoute("/api/images/jellyfin/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const jellyfinUrl = process.env.JELLYFIN_URL;
        const jellyfinKey = process.env.JELLYFIN_API_KEY;

        if (isMockMode() || !jellyfinUrl || !jellyfinKey) {
          return new Response(null, { status: 404 });
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
    },
  },
});
