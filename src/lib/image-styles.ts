/** Image generation presets, shared by the page (UI) and the API (whitelist). */

export const IMAGE_STYLES = [
  { id: "auto", label: "تلقائي", add: "" },
  { id: "photo", label: "صورة واقعية", add: "ultra realistic photograph, natural lighting, sharp focus, 50mm lens, high detail" },
  { id: "cinema", label: "سينمائي", add: "cinematic still, dramatic lighting, shallow depth of field, film grain, color graded" },
  { id: "3d", label: "ثلاثي الأبعاد", add: "polished 3D render, soft studio lighting, smooth materials, octane render look" },
  { id: "anime", label: "أنمي", add: "high quality anime illustration, clean line art, vibrant colors, detailed background" },
  { id: "logo", label: "شعار", add: "minimal vector logo, flat design, bold shapes, centered on a clean background, no text errors" },
  { id: "product", label: "منتج للإعلان", add: "commercial product photography, clean studio backdrop, soft shadows, premium advertising look" },
  { id: "art", label: "رسم فني", add: "digital painting, rich brush strokes, expressive color palette, concept art" },
  { id: "dz", label: "طابع جزائري", add: "inspired by Algerian culture and architecture, warm Mediterranean light, authentic details" },
] as const;

export type ImageStyleId = (typeof IMAGE_STYLES)[number]["id"];

export const IMAGE_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export type ImageRatio = (typeof IMAGE_RATIOS)[number];

export function styleAdd(id: unknown): string {
  return IMAGE_STYLES.find((s) => s.id === id)?.add ?? "";
}
export function isRatio(v: unknown): v is ImageRatio {
  return typeof v === "string" && (IMAGE_RATIOS as readonly string[]).includes(v);
}
