// Publishing. For now "draft" mode only: every alert ends up in a GitHub issue with its images, reel and captions ready to post by hand.
// Instagram, Facebook and X will be switched on here once their keys are stored as repository secrets (META_*, X_*).
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const MODE = process.env.META_PAGE_TOKEN || process.env.X_API_KEY ? "auto" : "brouillon";

export function brouillon(e, d, txt, fichiers, sortie) {
  const lignes = [
    `**M${d.mag.toFixed(1)}** · ${d.lieu} · ${new Date(d.temps).toISOString().replace("T", " ").slice(0, 16)} UTC · [USGS](${d.url}) · [Live Atlas](${txt.lien})`,
    "",
    `Networks: ${e.reseaux.join(", ")}.`,
    "",
    ...(e.reseaux.includes("x") ? ["### X", "```", txt.legendes.x, "```", ""] : []),
    ...(e.reseaux.includes("instagram") || e.reseaux.includes("reel") ? ["### Instagram", "```", txt.legendes.instagram, "```", ""] : []),
    ...(e.reseaux.includes("facebook") || e.reseaux.includes("reel") ? ["### Facebook", "```", txt.legendes.facebook, "```", ""] : []),
    ...(e.reseaux.includes("reel") ? ["### Narration", "```", txt.narration.trim(), "```", ""] : []),
  ];
  writeFileSync(join(sortie, "issue.md"), lignes.join("\n"));
  writeFileSync(join(sortie, "reseaux.txt"), e.reseaux.join(","));
  writeFileSync(join(sortie, "titre.txt"), `${txt.legendes.x.split("\n")[0]} (${e.reseaux.join(", ")})`);
  return Object.fromEntries(e.reseaux.map((r) => [r, "brouillon"]));
}
