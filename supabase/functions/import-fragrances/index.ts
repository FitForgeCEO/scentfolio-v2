import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand, apiKey, limit = 50 } = await req.json();

    if (!brand || !apiKey) {
      return new Response(
        JSON.stringify({ error: "brand and apiKey are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Fragella API
    const apiUrl = `https://api.fragella.com/api/v1/brands/${encodeURIComponent(brand)}?limit=${limit}`;

    let apiRes: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      apiRes = await fetch(apiUrl, {
        headers: { "x-api-key": apiKey },
      });
      if (apiRes.status === 429) {
        const waitSecs = Math.pow(2, attempt + 1) * 15; // 30s, 60s, 120s
        await new Promise(r => setTimeout(r, waitSecs * 1000));
        continue;
      }
      break;
    }

    if (!apiRes || !apiRes.ok) {
      const errText = apiRes ? await apiRes.text() : "No response";
      return new Response(
        JSON.stringify({ error: `Fragella API error: ${apiRes?.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fragrances = await apiRes.json();
    const items = Array.isArray(fragrances) ? fragrances : fragrances.data ?? [];

    // Create Supabase admin client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const f of items) {
      try {
        const imageUrl = f["Image URL"] || null;
        const record = {
          name: f["Name"],
          brand: f["Brand"] || brand,
          year_released: f["Year"] ? parseInt(f["Year"], 10) : null,
          concentration: f["OilType"] || null,
          gender: f["Gender"] || null,
          image_url: imageUrl,
          image_url_transparent: imageUrl ? imageUrl.replace(".jpg", ".webp") : null,
          rating: f["rating"] ? parseFloat(f["rating"]) : null,
          longevity: f["Longevity"] ? parseFloat(f["Longevity"]) : null,
          sillage: f["Sillage"] ? parseFloat(f["Sillage"]) : null,
          popularity: f["Popularity"] ? String(f["Popularity"]) : null,
          price_value: f["Price Value"] || null,
          country: f["Country"] || null,
          price: f["Price"] ? String(f["Price"]) : null,
          notes_top: f["Notes"]?.["Top"]?.map((n: any) => n.name) ?? [],
          notes_heart: f["Notes"]?.["Middle"]?.map((n: any) => n.name) ?? [],
          notes_base: f["Notes"]?.["Base"]?.map((n: any) => n.name) ?? [],
          general_notes: f["General Notes"] ?? [],
          accords: f["Main Accords"] ?? [],
          main_accords_percentage: f["Main Accords Percentage"] ?? {},
          season_ranking: f["Season Ranking"] ?? [],
          occasion_ranking: f["Occasion Ranking"] ?? [],
          is_approved: true,
        };

        // Check if exists
        const { data: existing } = await supabase
          .from("fragrances")
          .select("id")
          .eq("name", record.name)
          .eq("brand", record.brand)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("fragrances")
            .update(record)
            .eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase
            .from("fragrances")
            .insert(record);
          if (error) throw error;
          inserted++;
        }
      } catch (e: any) {
        errors.push(`${f["Name"] || "unknown"}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        brand,
        total_from_api: items.length,
        inserted,
        updated,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
