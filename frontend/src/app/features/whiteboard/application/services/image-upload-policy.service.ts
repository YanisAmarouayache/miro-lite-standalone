import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ImageUploadPolicyService {
  static readonly MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;

  validate(file: File): string | null {
    if (!file.type.startsWith("image/")) {
      return "Invalid file type. Please upload an image.";
    }
    if (file.size > ImageUploadPolicyService.MAX_IMAGE_SIZE_BYTES) {
      return (
        "Image too large. Maximum supported size is " +
        ImageUploadPolicyService.MAX_IMAGE_SIZE_BYTES / (1024 * 1024) +
        " MB."
      );
    }
    return null;
  }

  readAsDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result;
        if (typeof src !== "string") {
          reject(new Error("Failed to read image file."));
          return;
        }
        resolve(src);
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  }
}
