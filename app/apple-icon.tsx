import { ImageResponse } from "next/og";
import { StarIcon } from "./star-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<StarIcon size={size.width} />, size);
}
