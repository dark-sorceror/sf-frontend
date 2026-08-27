/**
 * Types mirroring the Contacts API OpenAPI 3.1 document (`GET /openapi.json`).
 * Field names stay snake_case so payloads map 1:1 onto the wire format.
 */

/** The address types the API accepts. Ordered as the detail page groups them. */
export const ADDRESS_TYPES = ["Home", "Work", "Other"] as const;

export type AddressType = (typeof ADDRESS_TYPES)[number];

/**
 * `AddressCreate` — what create and replace send. Only `type` is required, and
 * there is no `id`: the server assigns those, and never accepts them back.
 */
export interface AddressInput {
  type: AddressType;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

/** `AddressRead` — a stored address, always carrying its server-assigned id. */
export interface Address extends AddressInput {
  id: number;
}

/** `ContactRead` — a stored contact, as returned by every contact endpoint. */
export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  notes: string | null;
  /** Base64 data URL (JPEG/PNG/WebP), or `null` to fall back to initials. */
  photo: string | null;
  /** Every address the contact has; an empty array is normal. */
  addresses: Address[];
  created_at: string;
  updated_at: string;
  full_name: string;
}

/** Every editable field, i.e. `ContactCreate` / `ContactReplace`. */
export type ContactInput = Omit<
  Contact,
  "id" | "created_at" | "updated_at" | "full_name" | "addresses"
> & {
  /** `AddressCreate` has no `id`, so a stored address's id is never sent back. */
  addresses: AddressInput[];
};

/** `ContactPage` — one page of contacts plus the totals needed to paginate. */
export interface ContactPage {
  items: Contact[];
  total: number;
  limit: number;
  offset: number;
}

/** `HealthResponse` — result of the liveness probe. */
export interface HealthResponse {
  status: string;
  database: string;
  contacts: number;
}

/** Sort fields the API's allow-list accepts. */
export const SORT_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "company",
  "created_at",
  "updated_at",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

/** Bounds the API enforces on `limit`. */
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 200;
export const DEFAULT_PER_PAGE = 25;
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Result of a server action, consumed by `useActionState` in the forms.
 * Lives here (not in the `"use server"` module) so client components can import
 * the type without pulling server code into the browser bundle.
 */
export type AddressErrors = Record<
  number,
  Partial<Record<keyof AddressInput, string>>
>;

export type FormState = {
  status: "idle" | "error";
  /** Message shown above the form; used for API-level failures. */
  message?: string;
  /** Per-field messages keyed by input name. */
  fieldErrors?: Partial<Record<keyof ContactInput, string>>;
  /** Messages for one address in the collection, keyed by its position. */
  addressErrors?: AddressErrors;
  /**
   * Echo of the submitted values so the form survives a failed round trip.
   * `addresses` is the JSON the editor put in its hidden input, not an array.
   */
  values?: Partial<Record<keyof ContactInput, string>>;
};

export const EMPTY_FORM_STATE: FormState = { status: "idle" };
