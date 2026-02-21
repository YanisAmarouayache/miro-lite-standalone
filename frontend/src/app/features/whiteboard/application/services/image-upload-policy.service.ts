import { Injectable } from "@angular/core";

export enum ImageValidationErrorCode {
  INVALID_TYPE = "INVALID_TYPE",
  TOO_LARGE = "TOO_LARGE",
}

export interface ImageValidationError {
  code: ImageValidationErrorCode;
  params?: Record<string, number | string>;
}

export interface ImageValidationResult {
  valid: boolean;
  error: ImageValidationError | null;
}

export const IMAGE_READ_ERROR_CODE = "WHITEBOARD_IMAGE_READ_FAILED";

@Injectable({ providedIn: "root" })
export class ImageUploadPolicyService {
  static readonly MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;
  static readonly BYTES_PER_MB = 1024 * 1024;

  validate(file: File): ImageValidationResult {
    if (!file.type || !file.type.startsWith("image/")) {
      return {
        valid: false,
        error: { code: ImageValidationErrorCode.INVALID_TYPE },
      };
    }

    if (file.size > ImageUploadPolicyService.MAX_IMAGE_SIZE_BYTES) {
      return {
        valid: false,
        error: {
          code: ImageValidationErrorCode.TOO_LARGE,
          params: {
            maxSizeMb:
              ImageUploadPolicyService.MAX_IMAGE_SIZE_BYTES /
              ImageUploadPolicyService.BYTES_PER_MB,
          },
        },
      };
    }

    return { valid: true, error: null };
  }

  readAsDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      const rejectWithReadError = () =>
        reject(new Error(IMAGE_READ_ERROR_CODE));

      reader.onload = () => {
        const src = reader.result;
        if (typeof src !== "string") {
          rejectWithReadError();
          return;
        }
        resolve(src);
      };

      reader.onerror = rejectWithReadError;

      reader.readAsDataURL(file);
    });
  }
}
