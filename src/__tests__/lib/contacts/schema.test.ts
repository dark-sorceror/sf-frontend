import {
  CONTACT_FIELDS,
  MAX_PHOTO_DATA_URL_LENGTH,
  contactInputSchema,
  formDataToValues,
  parseAddressesJson,
  zodAddressErrors,
  zodFieldErrors,
} from "@/lib/contacts/schema";

function values(overrides: Record<string, unknown> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    notes: "",
    photo: "",
    ...overrides,
  };
}

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), company: "c".repeat(201) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      company: "Company must be 200 characters or fewer",
    });
  });
});

describe("contactInputSchema shape", () => {
  it("parses to exactly the fields the API defines, and nothing else", () => {
    // The five scalar address fields are gone from the contract; a leftover
    // `.default(null)` would put them back into every create/replace body.
    expect(Object.keys(contactInputSchema.parse(values())).sort()).toEqual([
      "addresses",
      "company",
      "email",
      "first_name",
      "job_title",
      "last_name",
      "notes",
      "phone",
      "photo",
    ]);
  });
});

describe("contactInputSchema photo", () => {
  const PAYLOAD = "iVBORw0KGgo=";

  it.each(["jpeg", "png", "webp"])("accepts a %s data URL", (format) => {
    const photo = `data:image/${format};base64,${PAYLOAD}`;
    expect(contactInputSchema.parse(values({ photo })).photo).toBe(photo);
  });

  it("treats a blank photo as no photo", () => {
    expect(contactInputSchema.parse(values()).photo).toBeNull();
  });

  it("rejects a format the picker does not offer", () => {
    const result = contactInputSchema.safeParse(
      values({ photo: `data:image/gif;base64,${PAYLOAD}` }),
    );

    expect(zodFieldErrors(result.error!).photo).toBe(
      "Photo must be a JPEG, PNG, or WebP image",
    );
  });

  it("rejects anything that is not a data URL", () => {
    const result = contactInputSchema.safeParse(
      values({ photo: "https://example.com/ada.png" }),
    );

    expect(zodFieldErrors(result.error!).photo).toBe(
      "Photo must be a JPEG, PNG, or WebP image",
    );
  });

  it("enforces the size cap on its own, without trusting the picker", () => {
    const result = contactInputSchema.safeParse(
      values({
        photo: `data:image/png;base64,${"A".repeat(MAX_PHOTO_DATA_URL_LENGTH)}`,
      }),
    );

    expect(zodFieldErrors(result.error!).photo).toBe(
      "Photo must be 500 KB or smaller",
    );
  });
});

describe("contactInputSchema addresses", () => {
  const ADDRESS = {
    type: "Home",
    address: "1 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: "94105",
    country: "USA",
  };

  it("treats no addresses as a valid empty collection", () => {
    expect(contactInputSchema.parse(values()).addresses).toEqual([]);
  });

  it("accepts every supported type", () => {
    const parsed = contactInputSchema.parse(
      values({
        addresses: [
          { ...ADDRESS, type: "Home" },
          { ...ADDRESS, type: "Work" },
          { ...ADDRESS, type: "Other" },
        ],
      }),
    );

    expect(parsed.addresses.map((entry) => entry.type)).toEqual([
      "Home",
      "Work",
      "Other",
    ]);
  });

  it("strips a server-assigned id rather than sending it back", () => {
    // `AddressCreate` has no `id`, so one must never reach the request body.
    const parsed = contactInputSchema.parse(
      values({ addresses: [{ ...ADDRESS, id: 7 }] }),
    );

    expect(parsed.addresses[0]).not.toHaveProperty("id");
    expect(parsed.addresses[0].type).toBe("Home");
  });

  it("accepts an address with nothing but a type, as the API does", () => {
    const parsed = contactInputSchema.parse(
      values({ addresses: [{ type: "Other" }] }),
    );

    expect(parsed.addresses[0]).toEqual({
      type: "Other",
      address: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
    });
  });

  it("rejects a type outside the enum, against the entry that has it", () => {
    const result = contactInputSchema.safeParse(
      values({ addresses: [ADDRESS, { ...ADDRESS, type: "Vacation" }] }),
    );

    expect(zodAddressErrors(result.error!)).toEqual({
      1: { type: "Choose Home, Work, or Other" },
    });
  });

  it("blanks a whitespace-only part rather than rejecting it", () => {
    const parsed = contactInputSchema.parse(
      values({ addresses: [{ ...ADDRESS, address: "   " }] }),
    );

    expect(parsed.addresses[0].address).toBeNull();
  });

  it("enforces the length limits per entry", () => {
    const result = contactInputSchema.safeParse(
      values({
        addresses: [ADDRESS, { ...ADDRESS, postal_code: "9".repeat(21) }],
      }),
    );

    expect(zodAddressErrors(result.error!)).toEqual({
      1: { postal_code: "Postal code must be 20 characters or fewer" },
    });
  });

  it("reports malformed JSON instead of silently dropping every address", () => {
    const result = contactInputSchema.safeParse(
      values({ addresses: parseAddressesJson("{not json") }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).addresses).toBeDefined();
    expect(zodAddressErrors(result.error!)).toEqual({});
  });
});

describe("parseAddressesJson", () => {
  it("turns a blank input into an empty collection", () => {
    expect(parseAddressesJson("")).toEqual([]);
  });

  it("hands malformed JSON through for the schema to reject", () => {
    expect(parseAddressesJson("{not json")).toBe("{not json");
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      [...CONTACT_FIELDS.map((field) => field.name), "addresses"].sort(),
    );
  });
});
