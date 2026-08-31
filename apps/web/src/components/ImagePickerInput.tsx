import { useId, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageMimeType } from '@gigaflow/shared';

export interface ImagePickerInputProps {
  accept: string;
  maxBase64Length: number;
  onPicked: (base64: string, mimeType: ImageMimeType) => void;
  onError: (msgKey: string) => void;
  className?: string;
}

const IMAGE_MIME_TYPES: readonly string[] = Object.values(ImageMimeType);

function isImageMimeType(value: string): value is ImageMimeType {
  return IMAGE_MIME_TYPES.includes(value);
}

/** Strips the `data:<mime>;base64,` prefix off a FileReader data URL. */
function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

/**
 * A file input (styled as a ≥44px label/button) that reads the picked file
 * as base64 client-side, validates its mime type and size, and surfaces the
 * result via `onPicked`/`onError` — no upload happens here. Shows a preview
 * `<img>` once a valid image has been picked.
 */
export function ImagePickerInput({
  accept,
  maxBase64Length,
  onPicked,
  onError,
  className = '',
}: ImagePickerInputProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file to fire another change event.
    event.target.value = '';
    if (!file) return;

    if (!isImageMimeType(file.type)) {
      onError('inbody.errBadType');
      return;
    }
    const mimeType = file.type;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        onError('inbody.errBadType');
        return;
      }
      const base64 = stripDataUrlPrefix(result);
      if (base64.length > maxBase64Length) {
        onError('inbody.errTooLarge');
        return;
      }
      setPreviewSrc(result);
      onPicked(base64, mimeType);
    };
    reader.onerror = () => {
      onError('inbody.errBadType');
    };
    reader.readAsDataURL(file);
  }

  const classes = ['flex flex-col gap-2', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <label
        htmlFor={inputId}
        className={[
          'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-4',
          'rounded-[10px] bg-accent font-medium text-white',
        ].join(' ')}
      >
        {t('inbody.uploadLabel')}
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={t('inbody.uploadLabel')}
        onChange={handleChange}
      />
      {previewSrc ? (
        <img
          src={previewSrc}
          alt={t('inbody.previewAlt')}
          className="max-h-48 rounded-[10px] border border-border-subtle object-contain"
        />
      ) : null}
    </div>
  );
}
