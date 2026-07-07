import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Retired 2026-06-15: claude-sonnet-4-20250514 (caused the 502s).
// claude-sonnet-5 is the drop-in replacement per Anthropic's migration guide.
const ANTHROPIC_MODEL = "claude-sonnet-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // The Layering Lab is a signed-in feature; without this check the
    // function is an open relay against the Anthropic API key.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) {
      return jsonResponse({ error: "Sign in to use the Layering Lab." }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return jsonResponse({ error: "Sign in to use the Layering Lab." }, 401);
    }

    const { fragrance, vibe, userCollection = [] } = await req.json();

    if (!fragrance || !vibe) {
      return jsonResponse({ error: "fragrance and vibe are required" }, 400);
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return jsonResponse({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const prompt = `You are a fragrance layering expert. Given a base fragrance and a desired vibe, recommend a complete layering stack.

BASE FRAGRANCE:
Name: ${fragrance.name} by ${fragrance.brand}
Accords: ${(fragrance.accords || []).join(", ")}
Top Notes: ${(fragrance.notes_top || []).join(", ")}
Heart Notes: ${(fragrance.notes_heart || []).join(", ")}
Base Notes: ${(fragrance.notes_base || []).join(", ")}
Longevity: ${fragrance.longevity || "Unknown"}
Sillage: ${fragrance.sillage || "Unknown"}

DESIRED VIBE: ${vibe}

${userCollection.length > 0 ? `USER'S COLLECTION (suggest from these if possible): ${userCollection.join(", ")}` : ""}

IMPORTANT: Vary your recommendations. Do not default to the same layering fragrance repeatedly. If the user's collection contains multiple fragrances that could work as a top layer, rotate between them. Avoid recommending the same fragrance (e.g. Black Opium) as the top layer for different base fragrances unless it is genuinely the only strong match. Surprise the user with unexpected but harmonious pairings — that's what makes layering exciting. If recommending from outside their collection, draw from a wide range of brands and fragrance families.

Respond with ONLY a valid JSON object (no markdown, no backticks, no preamble) in this exact format:
{
  "bodyPrep": {
    "product": "Name of a specific body cream, oil, or lotion",
    "brand": "Brand name",
    "application": "Where and how to apply it (e.g. pulse points, décolletage)",
    "notes": "Key scent notes in this product"
  },
  "layeringFragrance": {
    "name": "Name of a fragrance to layer on top (prefer from user's collection if available)",
    "brand": "Brand name",
    "sprayCount": "How many sprays (e.g. '1-2 sprays')",
    "application": "Where to spray (e.g. 'wrists and behind ears')",
    "fromCollection": true or false
  },
  "technique": "Brief description of the layering technique — what order to apply, how long to wait between layers",
  "whyItWorks": "2-3 sentences explaining why these specific scents complement each other at a molecular/accord level and create the desired vibe",
  "resultingVibe": "A short poetic 1-sentence description of what the final layered scent evokes",
  "proBonusTip": "One extra tip to enhance the layering"
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        // Sonnet 5 runs adaptive thinking when this is omitted; a simple
        // JSON generation doesn't need it and the latency isn't worth it.
        thinking: { type: "disabled" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return jsonResponse(
        { error: `Anthropic API error: ${response.status}`, details: errText },
        502,
      );
    }

    const data = await response.json();
    const textContent =
      data.content?.find((b: { type: string }) => b.type === "text")?.text || "";

    // Try to parse the JSON from Claude's response
    let recommendation;
    try {
      recommendation = JSON.parse(textContent);
    } catch {
      // Try to extract JSON between first { and last }
      const start = textContent.indexOf("{");
      const end = textContent.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        try {
          recommendation = JSON.parse(textContent.substring(start, end + 1));
        } catch {
          return jsonResponse(
            { error: "Failed to parse Claude response as JSON", raw: textContent },
            500,
          );
        }
      } else {
        return jsonResponse(
          { error: "No JSON found in Claude response", raw: textContent },
          500,
        );
      }
    }

    return jsonResponse(recommendation);
  } catch (e: any) {
    return jsonResponse({ error: e.message }, 500);
  }
});
