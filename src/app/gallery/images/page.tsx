import path from "path";
import { promises as fs } from "fs";
import ImagesMasonry from "@/components/gallery/ImagesMasonry";

// Static-export friendly: read at build time

const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

async function getImages() {
  const dir = path.join(process.cwd(), "gallery");
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => exts.has(path.extname(f).toLowerCase()));
  } catch {
    return [] as string[];
  }
}

export default async function ImagesGalleryPage() {
  const images = await getImages();

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 pt-24 md:pt-28 pb-16">
        <h1 className="text-[32px] font-semibold mb-10 md:mb-12 text-center">Images</h1>
        {images.length === 0 ? (
          <p className="text-sm text-white/70 text-center">No images found in the gallery folder.</p>
        ) : (
          <ImagesMasonry images={images} />
        )}
      </div>
    </main>
  );
}
