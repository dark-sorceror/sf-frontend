import {
  CONTACT_FIELDS,
  MAX_PHOTO_DATA_URL_LENGTH,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";

function values(overrides: Record<string, string> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
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
      values({ first_name: "a".repeat(101), postal_code: "9".repeat(21) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      postal_code: "Postal code must be 20 characters or fewer",
    });
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
      CONTACT_FIELDS.map((field) => field.name).sort(),
    );
  });
});
