import ScrollExpandMedia from "@/components/ui/scroll-expansion-hero";
import { BentoDemo } from "@/components/ui/bento-demo";
import AfterHeroCards from "@/components/home/AfterHeroCards";
import AnimatedSeparator from "@/components/home/AnimatedSeparator";
import AboutUsSection from "@/components/ui/about-us-section";
import path from "path";
import { promises as fs } from "fs";

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

export default async function Home() {
  const aboutImg = await pickGalleryImage();
  return (
    <div className="min-h-screen">
      {/* Removed floating top-left logo to avoid duplication with navbar brand */}

      <ScrollExpandMedia
        mediaType="image"
        mediaSrc="/front.jpeg"
        bgImageSrc="/bg.webp"
        title="swamiye saranam ayyappa"
        date=""
        leftQrSrc="/Pooja_Booking-1024.jpeg"
        rightQrSrc="/Annadanam_Booking-1024.jpeg"
        qrAltLeft="Pooja Booking QR"
        qrAltRight="Annadanam Booking QR"
      />

      {/* Compact cards after hero */}
      <AfterHeroCards />

      {/* Animated separator before features */}
      <AnimatedSeparator />

      {/* Features section */}
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <BentoDemo />
        </div>
      </section>

      {/* About Us section */}
      <AboutUsSection imageSrc={aboutImg} ctaBgColor="#0b0b0b" ctaButtonColor="#D4AF37" ctaTextColor="#FFFFFF" />
    </div>
  );
}
