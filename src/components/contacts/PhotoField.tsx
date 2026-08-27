"use client";

import { useState, type ChangeEvent } from "react";
import { Trash2, User } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_KB,
  PHOTO_MIME_TYPES,
} from "@/lib/contacts/schema";

const ACCEPT = PHOTO_MIME_TYPES.join(",");

const FILE_INPUT =
  "block w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-secondary-foreground file:transition-colors hover:file:bg-secondary/70";

/**
 * Photo picker for the contact form.
 *
 * The value that gets submitted lives in React state behind a hidden input, not
 * in the file input — so an edit that never opens the picker still posts the
 * photo the form was seeded with. That is what keeps the API's full-replacement
 * `PUT` from clearing the photo when someone only changes their phone number.
 * Clearing it is deliberate: the Remove button, and nothing else.
 */
export default function PhotoField({
  id,
  name,
  defaultValue = "",
  describedBy,
  invalid = false,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  const [photo, setPhoto] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const errorId = `${id}-file-error`;

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the control so the same file can be chosen again after a rejection.
    event.target.value = "";
    if (!file) return;

    if (!(PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`That image is larger than ${MAX_PHOTO_KB} KB. Choose a smaller one.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(typeof reader.result === "string" ? reader.result : "");
      setError(null);
    };
    reader.onerror = () => setError("That image could not be read.");
    reader.readAsDataURL(file);
  }

  const describedByIds =
    [describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex items-start gap-4">
      <input type="hidden" name={name} value={photo} readOnly />

      {photo ? (
        // A base64 data URL: nothing for next/image to fetch or optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt="Selected photo"
          className="h-16 w-16 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/60"
        >
          <User className="h-6 w-6" strokeWidth={1.5} />
        </span>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        <input
          id={id}
          type="file"
          accept={ACCEPT}
          onChange={pick}
          aria-invalid={invalid || error ? true : undefined}
          aria-describedby={describedByIds}
          className={FILE_INPUT}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[12px] text-muted-foreground">
            JPEG, PNG, or WebP · up to {MAX_PHOTO_KB} KB
          </p>
          {photo ? (
            <button
              type="button"
              onClick={() => {
                setPhoto("");
                setError(null);
              }}
              className={buttonClasses("ghost", "sm")}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Remove photo
            </button>
          ) : null}
        </div>

        {error ? (
          <p id={errorId} role="alert" className="text-[13px] text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
