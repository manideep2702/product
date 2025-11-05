import path from "path";
import { promises as fs } from "fs";
import AboutUsSection from "@/components/ui/about-us-section";

async function pickGalleryImage(): Promise<string | undefined> {
  const dir = path.join(process.cwd(), "gallery");
  const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
  try {
    const files = await fs.readdir(dir);
    const pick = files.find((f) => exts.has(path.extname(f).toLowerCase()));
    return pick ? `/gallery/${encodeURIComponent(pick)}` : undefined;
  } catch {
    return undefined;
  }
}

export default async function AboutPage() {
  const img = await pickGalleryImage();
  return <AboutUsSection imageSrc={img} ctaBgColor="#0b0b0b" ctaButtonColor="#D4AF37" ctaTextColor="#FFFFFF" />;
}
