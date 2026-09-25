import { ImageResponse } from "next/og";
import { StarIcon } from "./star-icon";

const sizes = [192, 512];

export function generateImageMetadata() {
  return sizes.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<StarIcon size={size} />, {
    width: size,
    height: size,
  });
}
