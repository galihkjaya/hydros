"use client";

/**
 * Client-side image downscaling.
 *
 * Runs before upload so the vision request stays small: a 12 MP phone photo
 * carries no more usable visual information about water colour or turbidity
 * than a 1280 px one, and shrinking it here keeps us inside serverless body
 * limits and model token budgets.
 */

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;

export type PreparedImage = {
  /** JPEG data URL, ready to send to the server. */
  dataUrl: string;
  width: number;
  height: number;
  /** Approximate byte size of the encoded image. */
  bytes: number;
};

/**
 * Decodes, downscales to fit MAX_EDGE, and re-encodes as JPEG.
 * Rejects if the file cannot be decoded as an image.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file could not be read as an image.");
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable in this browser.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const base64Length = dataUrl.length - (dataUrl.indexOf(",") + 1);

  return {
    dataUrl,
    width,
    height,
    // base64 encodes 3 bytes per 4 characters.
    bytes: Math.round((base64Length * 3) / 4),
  };
}
