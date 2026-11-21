import type { Config } from "@netlify/functions";

// Fast Bible text: fetches a chapter from the Free Use Bible API (bible.helloao.org, AO Lab)
// and returns it in the app's simple format. Responses are cached at Netlify's edge.
const USFM = ["GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL",
  "MAT","MRK","LUK","JHN","ACT","ROM","1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS","1PE","2PE","1JN","2JN","3JN","JUD","REV"];
const IDS: Record<string, string[]> = { BSB: ["BSB"], WEB: ["ENGWEBP", "eng_web"], KJV: ["eng_kjv", "KJV"] };

function text(parts: any[]): string {
  return (parts || []).map((p) => (typeof p === "string" ? p : p && typeof p.text === "string" ? p.text : "")).join(" ")
    .replace(/\s+/g, " ").replace(/\s([,.;:!?’”)])/g, "$1").trim();
}

export default async (req: Request) => {
  const u = new URL(req.url);
  const tr = (u.searchParams.get("tr") || "BSB").toUpperCase();
  const b = Number(u.searchParams.get("b")), c = Number(u.searchParams.get("c"));
  if (!IDS[tr] || !(b >= 0 && b < 66) || !(c >= 1 && c <= 150)) return Response.json({ error: "bad_request" }, { status: 400 });

  for (const id of IDS[tr]) {
    try {
      const r = await fetch(`https://bible.helloao.org/api/${id}/${USFM[b]}/${c}.json`);
      if (!r.ok) continue;
      const data: any = await r.json();
      const verses: { n: number; t: string; h?: string }[] = [];
      let heading = "";
      for (const item of data?.chapter?.content || []) {
        if (item.type === "heading") heading = (item.content || []).join(" ").trim();
        else if (item.type === "verse") {
          const t = text(item.content);
          if (!t) continue;
          const v: { n: number; t: string; h?: string } = { n: Number(item.number), t };
          if (heading) { v.h = heading; heading = ""; }
          verses.push(v);
        }
      }
      if (!verses.length) continue;
      return Response.json({ verses, source: "Free Use Bible API" }, {
        headers: {
          "Cache-Control": "public, max-age=604800",
          "Netlify-CDN-Cache-Control": "public, durable, s-maxage=31536000",
        },
      });
    } catch (e) {
      console.error("bible fetch failed", id, e);
    }
  }
  return Response.json({ error: "not_found" }, { status: 404 });
};

export const config: Config = { path: "/api/bible", method: "GET" };
