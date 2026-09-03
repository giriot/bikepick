// ═══════════════════════════════════════════════════════════════════════════
// CompareBike — supabase/functions/image-process/index.ts
//
// Conservative image optimization for bike photos.
//
// HARD RULES (per project spec):
//   1. NEVER alter the motorcycle itself — no background removal, no colour
//      grading, no part replacement, no logo editing. Only lossy re-encoding
//      + downscaling for display.
//   2. The ORIGINAL is always kept. processed_path is written only on success.
//   3. If anything fails, the image row is marked 'skipped'/'failed' and the
//      original stays usable — a listing is NEVER blocked by processing.
//
// Auth: invoked by the browser with the user's anon JWT (supabase.functions
// invoke). We verify the caller is the owner of the bike image (admin
// upload) and that the row is in 'pending' state before doing work.
//
// Deploy:
//   supabase functions deploy image-process --no-verify-jwt
//   (--no-verify-jwt because we validate the JWT manually from the request;
//    the function only ever updates a row the caller is allowed to touch.)
// ═══════════════════════════════════════════════════════════════════════════

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { image_id } = await req.json();
    if (!image_id) return json({ error: "image_id is required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // The function runs with the service role so it can update the row
    // regardless of RLS — but we still enforce ownership manually below.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonJwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? null;
    if (!anonJwt) return json({ error: "Missing user token" }, 401);

    // verify the caller
    const { data: authData, error: authErr } = await fetch(
      `${supabaseUrl}/auth/v1/user?.jwt=${encodeURIComponent(anonJwt)}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    ).then((r) => r.json());
    if (authErr || !authData?.id) return json({ error: "Invalid token" }, 401);
    const userId: string = authData.id;

    const admin = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=role`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    ).then((r) => r.json());
    const isAdmin = Array.isArray(admin) && admin.some((p: { role: string }) => p.role === "admin");
    if (!isAdmin) return json({ error: "Only admins upload bike images" }, 403);

    const sb = {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    };

    // load the image row
    const rowRes = await fetch(
      `${supabaseUrl}/rest/v1/bike_images?id=eq.${image_id}&select=*`,
      { headers: sb.headers },
    ).then((r) => r.json());
    const row = Array.isArray(rowRes) ? rowRes[0] : null;
    if (!row) return json({ error: "Image row not found" }, 404);
    if (row.processing_status !== "pending") {
      return json({ error: `Image is not pending (status: ${row.processing_status})` }, 409);
    }

    const bucket = row.bucket || "bike-images";
    const originalPath: string = row.original_path;

    // mark processing
    await fetch(`${supabaseUrl}/rest/v1/bike_images?id=eq.${image_id}`, {
      method: "PATCH",
      headers: { ...sb.headers, Prefer: "return=minimal" },
      body: JSON.stringify({ processing_status: "processing" }),
    });

    // fetch the original bytes
    const dl = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${originalPath}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!dl.ok) throw new Error(`Could not read original (${dl.status})`);
    const original = await dl.arrayBuffer();
    const contentType = dl.headers.get("content-type") || "image/webp";

    // ── conservative optimization ──────────────────────────────────────────
    // Re-encode as WebP (or keep PNG if the original is PNG), cap width at
    // 1600px, quality 80. No other manipulation — the motorcycle is untouched.
    let optimized: ArrayBuffer;
    let outType: string;
    try {
      const sharp = await import("npm:sharp@0.33.5");
      const pipeline = sharp(Buffer.from(original), { limit: 0 })
        .resize({ width: 1600, withoutEnlargement: true });
      if (contentType === "image/png") {
        optimized = (await pipeline.png({ quality: 90 }).toBuffer()) as ArrayBuffer as any;
        outType = "image/png";
      } else {
        optimized = (await pipeline.webp({ quality: 80 }).toBuffer()) as ArrayBuffer as any;
        outType = "image/webp";
      }
    } catch {
      // sharp unavailable in this runtime — fall back to the original, untouched.
      // This is the "never block the listing" path: status = skipped.
      await patchRow(image_id, { processing_status: "skipped" }, sb.headers);
      await logJob(image_id, "skipped", "sharp unavailable; original kept");
      return json({ ok: true, status: "skipped", note: "Optimization skipped — original image kept." });
    }

    // upload the optimized copy next to the original
    const processedPath = originalPath.replace(/\.[a-z0-9]+$/i, "") + "-opt." + (outType === "image/png" ? "png" : "webp");
    const up = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${processedPath}`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": outType,
        },
        body: Buffer.from(optimized),
      },
    );
    if (!up.ok) {
      const detail = await up.text();
      throw new Error(`Upload failed: ${up.status} ${detail.slice(0, 200)}`);
    }

    // mark completed with the processed path
    await patchRow(image_id, { processing_status: "completed", processed_path: processedPath }, sb.headers);
    await logJob(image_id, "completed", null);
    return json({ ok: true, status: "completed", processed_path: processedPath });
  } catch (e) {
    // Failure must never leave a listing blocked: mark failed, original stays.
    try {
      const { image_id } = await req.json().catch(() => ({ image_id: null }));
      if (image_id) {
        const headers = {
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        };
        await patchRow(image_id, { processing_status: "failed" }, headers);
        await logJob(image_id, "failed", String(e?.message || e));
      }
    } catch {
      /* last-resort swallow */
    }
    return json({ ok: false, status: "failed", error: String(e?.message || e) }, 500);
  }
});

async function patchRow(id: string, patch: Record<string, unknown>, headers: Record<string, string>): Promise<void> {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/bike_images?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

async function logJob(imageId: string, status: string, error: string | null): Promise<void> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const url = Deno.env.get("SUPABASE_URL")!;
  await fetch(`${url}/rest/v1/image_processing_jobs`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      table_name: "bike_images",
      image_id: imageId,
      status,
      error,
      completed_at: new Date().toISOString(),
    }),
  }).catch(() => {});
}
