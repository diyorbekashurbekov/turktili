import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Issues short-lived tokens so an admin's browser uploads authorised book audio straight
 * to the private Vercel Blob store. Needed on Vercel: request bodies to functions are
 * capped at 4.5 MB, while book audio can be up to 30 MB. The asset is registered afterwards
 * with the "audio-register" admin action.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAdmin(await currentUser())) throw new Error("forbidden");
        if (!/^audio\/[\w.-]+\.(mp3|m4a|ogg|wav)$/i.test(pathname)) throw new Error("bad path");
        return {
          allowedContentTypes: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/wav", "audio/x-wav", "audio/wave"],
          maximumSizeInBytes: 30 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "upload failed";
    return Response.json({ error: msg }, { status: msg === "forbidden" ? 403 : 400 });
  }
}
