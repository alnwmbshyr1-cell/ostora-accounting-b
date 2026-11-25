const MAX_IMAGE_DATA_URL_LEN = 240000;

export function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const tryEncode = (maxSide: number, quality: number): string => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', quality);
        };

        const attempts: [number, number][] = [
          [320, 0.78],
          [280, 0.65],
          [240, 0.55],
          [180, 0.45],
        ];
        let result = tryEncode(320, 0.78);
        for (const [side, q] of attempts) {
          result = tryEncode(side, q);
          if (result.length <= MAX_IMAGE_DATA_URL_LEN) break;
        }
        resolve(result);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
