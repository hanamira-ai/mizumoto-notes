/**
 * Image Compression Utility using standard HTML5 Canvas API
 *
 * Compresses uploaded images to a maximum width of 1200px (preserving aspect ratio)
 * and encodes to JPEG at 80% quality (or preserves original if smaller/SVG).
 */

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

export async function compressImage(file: File | Blob): Promise<Blob> {
  // If it's already an SVG, keep it intact
  if (file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;

      // Scale down if width exceeds max width
      if (targetWidth > MAX_WIDTH) {
        const ratio = MAX_WIDTH / targetWidth;
        targetWidth = MAX_WIDTH;
        targetHeight = Math.round(targetHeight * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to original file
        resolve(file);
        return;
      }

      // Draw white background in case of PNG with transparency converting to JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Render image with smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
}
