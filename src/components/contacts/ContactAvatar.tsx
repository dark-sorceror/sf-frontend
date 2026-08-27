import type { CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

/** Outer dimensions, shared by both branches so a row never changes height. */
const SIZES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
} as const;

const TEXT_SIZES = {
  sm: "text-[11px]",
  md: "text-sm",
  lg: "text-lg",
} as const;

/**
 * The contact's photo when there is one, otherwise an initials bubble tinted
 * with a hue derived from their email. Decorative either way: every caller
 * renders the name right next to it.
 */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: Pick<Contact, "first_name" | "last_name" | "email" | "photo">;
  size?: keyof typeof SIZES;
}) {
  if (contact.photo) {
    // The photo is a base64 data URL carried in the record itself, so there is
    // no remote asset for next/image to fetch, cache, or resize.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={contact.photo}
        alt=""
        aria-hidden="true"
        className={`inline-block shrink-0 select-none rounded-full object-cover ${SIZES[size]}`}
      />
    );
  }

  const style = {
    "--avatar-hue": avatarHue(contact.email),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-semibold ${SIZES[size]} ${TEXT_SIZES[size]}`}
    >
      {initials(contact)}
    </span>
  );
}
