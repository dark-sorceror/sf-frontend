"use client";

import { useState } from "react";
import { MapPinPlus, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { controlClasses } from "@/components/ui/Field";
import { ADDRESS_FIELDS, ADDRESSES_INPUT_NAME } from "@/lib/contacts/schema";
import {
  ADDRESS_TYPES,
  type Address,
  type AddressErrors,
  type AddressInput,
} from "@/lib/contacts/types";

function blankAddress(): AddressInput {
  return {
    type: "Home",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  };
}

/**
 * Narrow a stored address to what create and replace accept. Two things happen
 * here, both deliberate: the server-assigned `id` is dropped, because
 * `AddressCreate` has no such field and the payload must not carry one; and
 * nulls become empty strings, because these bind to controlled inputs. The
 * schema turns the blanks back into nulls on the way out.
 */
function toInput(address: Partial<Address>): AddressInput {
  return {
    type: address.type ?? "Home",
    address: address.address ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postal_code: address.postal_code ?? "",
    country: address.country ?? "",
  };
}

/**
 * Messages arrive keyed by the position each address held when it was
 * submitted, so removing an earlier entry would otherwise leave them pointing
 * at the wrong rows. Shift them to match the collection that remains.
 */
function rebaseErrors(
  errors: AddressErrors | undefined,
  removed: number,
): AddressErrors | undefined {
  if (!errors) return errors;
  const next: AddressErrors = {};
  for (const [key, entry] of Object.entries(errors)) {
    const at = Number(key);
    if (at === removed) continue;
    next[at > removed ? at - 1 : at] = entry;
  }
  return next;
}

/** Seed from the JSON the form was given; anything unusable starts empty. */
function parseInitial(raw: string): AddressInput[] {
  if (!raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(toInput) : [];
  } catch {
    return [];
  }
}

/**
 * The dynamic addresses section of the contact form.
 *
 * Unlike the scalar fields, which stay uncontrolled and are read straight off
 * the DOM, the collection lives in React state and is submitted as JSON in one
 * hidden input. That keeps a variable-length structure out of `FormData`'s flat
 * key space, and — because the state is seeded from the contact the form was
 * opened with — an edit that never touches this section still submits every
 * address the contact already had, which the full-replacement `PUT` requires.
 */
export default function AddressListEditor({
  defaultValue = "",
  error,
  errors,
}: {
  defaultValue?: string;
  /** A problem with the collection itself, rather than one entry. */
  error?: string;
  errors?: AddressErrors;
}) {
  const [addresses, setAddresses] = useState(() => parseInitial(defaultValue));
  const [positionErrors, setPositionErrors] = useState(errors);
  const [errorsSeen, setErrorsSeen] = useState(errors);

  // Each submit delivers a fresh map, keyed by the positions it was given, and
  // supersedes whatever the last one left behind. Adjusting during render is
  // React's documented alternative to syncing props into state in an effect.
  if (errorsSeen !== errors) {
    setErrorsSeen(errors);
    setPositionErrors(errors);
  }

  function update(index: number, patch: Partial<AddressInput>) {
    setAddresses((current) =>
      current.map((address, i) => (i === index ? { ...address, ...patch } : address)),
    );
  }

  function removeAt(index: number) {
    setAddresses((current) => current.filter((_, i) => i !== index));
    setPositionErrors((current) => rebaseErrors(current, index));
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={ADDRESSES_INPUT_NAME}
        value={JSON.stringify(addresses)}
        readOnly
      />

      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No addresses yet.
        </p>
      ) : null}

      {addresses.map((address, index) => {
        const entryErrors = positionErrors?.[index];
        const typeId = `address-${index}-type`;

        return (
          <fieldset
            key={index}
            className="space-y-4 rounded-lg border border-border bg-card/50 p-4"
          >
            <legend className="sr-only">Address {index + 1}</legend>

            <div className="flex items-end justify-between gap-3">
              <div>
                <label
                  htmlFor={typeId}
                  className="mb-1.5 block text-[13px] font-medium text-foreground"
                >
                  Type
                </label>
                <select
                  id={typeId}
                  value={address.type}
                  onChange={(event) =>
                    update(index, {
                      type: event.target.value as AddressInput["type"],
                    })
                  }
                  aria-invalid={entryErrors?.type ? true : undefined}
                  className={`${controlClasses(Boolean(entryErrors?.type))} w-auto pr-8`}
                >
                  {ADDRESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={`Remove address ${index + 1}`}
                className={buttonClasses("ghost", "sm")}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Remove address
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {ADDRESS_FIELDS.map((field) => {
                const id = `address-${index}-${field.name}`;
                const errorId = `${id}-error`;
                const error = entryErrors?.[field.name];

                return (
                  <div
                    key={field.name}
                    className={field.wide ? "sm:col-span-2" : undefined}
                  >
                    <label
                      htmlFor={id}
                      className="mb-1.5 block text-[13px] font-medium text-foreground"
                    >
                      {field.label}
                      {field.required ? (
                        <span className="ml-1 text-destructive" aria-hidden="true">
                          *
                        </span>
                      ) : (
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                          optional
                        </span>
                      )}
                    </label>

                    <input
                      id={id}
                      type="text"
                      value={address[field.name] ?? ""}
                      onChange={(event) =>
                        update(index, { [field.name]: event.target.value })
                      }
                      maxLength={field.maxLength}
                      placeholder={field.placeholder}
                      autoComplete={field.autoComplete}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? errorId : undefined}
                      className={controlClasses(Boolean(error))}
                    />

                    {error ? (
                      <p
                        id={errorId}
                        role="alert"
                        className="mt-1.5 text-[13px] text-destructive"
                      >
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <button
        type="button"
        onClick={() => setAddresses((current) => [...current, blankAddress()])}
        className={buttonClasses("secondary", "sm")}
      >
        <MapPinPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Add address
      </button>
    </div>
  );
}
