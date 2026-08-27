import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "@/components/contacts/ContactForm";
import { makeAddress, makeContact } from "../mocks/handlers";
import type { FormState } from "@/lib/contacts/types";

function renderForm(action: jest.Mock, contact?: ReturnType<typeof makeContact>) {
  return render(
    <ContactForm
      action={action as never}
      contact={contact}
      submitLabel="Create contact"
      cancelHref="/contacts"
    />,
  );
}

const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

function imageFile(type: string, bytes = 8, name = "ada") {
  return new File([new Uint8Array(bytes)], name, { type });
}

function stagedAddresses(container: HTMLElement): unknown {
  return JSON.parse(
    container.querySelector<HTMLInputElement>('input[name="addresses"]')!.value,
  );
}

function submittedAddresses(formData: FormData): unknown {
  return JSON.parse(String(formData.get("addresses")));
}

function stagedPhoto(container: HTMLElement): string {
  return container.querySelector<HTMLInputElement>('input[name="photo"]')!.value;
}

async function submit(action: jest.Mock): Promise<FormData> {
  await userEvent.click(screen.getByRole("button", { name: /create contact/i }));
  await waitFor(() => expect(action).toHaveBeenCalled());
  return action.mock.calls[0][1];
}

describe("ContactForm", () => {
  it("renders every editable field", () => {
    renderForm(jest.fn());

    expect(screen.getByLabelText(/first name/i)).toBeRequired();
    expect(screen.getByLabelText(/last name/i)).toBeRequired();
    expect(screen.getByLabelText(/^email/i)).toBeRequired();
    expect(screen.getByLabelText(/phone/i)).not.toBeRequired();
    expect(screen.getByLabelText(/notes/i).tagName).toBe("TEXTAREA");
  });

  it("prefills from an existing contact", () => {
    renderForm(jest.fn(), makeContact());

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
    expect(screen.getByLabelText(/^email/i)).toHaveValue("ada@example.com");
    // Nulls become empty inputs rather than the string "null".
    expect(screen.getByLabelText(/notes/i)).toHaveValue("");
  });

  it("submits the entered values to the action", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action);

    await userEvent.type(screen.getByLabelText(/first name/i), "Grace");
    await userEvent.type(screen.getByLabelText(/last name/i), "Hopper");
    await userEvent.type(screen.getByLabelText(/^email/i), "grace@example.com");
    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    expect(formData.get("first_name")).toBe("Grace");
    expect(formData.get("email")).toBe("grace@example.com");
  });

  it("shows the summary and the per-field errors the action returns", async () => {
    const action = jest.fn(
      async (): Promise<FormState> => ({
        status: "error",
        message: "That email address is already taken.",
        fieldErrors: { email: "This email is already in use." },
        values: { first_name: "Grace" },
      }),
    );
    renderForm(action);

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((node) => node.textContent)).toEqual(
      expect.arrayContaining([
        "That email address is already taken.",
        "This email is already in use.",
      ]),
    );
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("links back out without submitting", () => {
    renderForm(jest.fn());
    expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute(
      "href",
      "/contacts",
    );
  });
});

describe("ContactForm photo", () => {
  const noop = () => jest.fn(async (): Promise<FormState> => ({ status: "idle" }));

  it.each([
    ["image/jpeg", "data:image/jpeg;base64,AAAAAAAAAAA="],
    ["image/png", "data:image/png;base64,AAAAAAAAAAA="],
    ["image/webp", "data:image/webp;base64,AAAAAAAAAAA="],
  ])("previews a %s photo and stages it for submission", async (type, dataUrl) => {
    const { container } = renderForm(noop());

    await userEvent.upload(screen.getByLabelText(/photo/i), imageFile(type));

    expect(await screen.findByAltText("Selected photo")).toHaveAttribute(
      "src",
      dataUrl,
    );
    await waitFor(() => expect(stagedPhoto(container)).toBe(dataUrl));
  });

  it("rejects a format the API does not accept", async () => {
    const { container } = renderForm(noop());

    // `userEvent.upload` honours the input's `accept`, so a direct change event
    // is the only way to reach the component's own guard.
    fireEvent.change(screen.getByLabelText(/photo/i), {
      target: { files: [imageFile("image/gif")] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a JPEG, PNG, or WebP image.",
    );
    expect(stagedPhoto(container)).toBe("");
  });

  it("rejects a file over the size limit before reading it", async () => {
    const { container } = renderForm(noop());

    await userEvent.upload(
      screen.getByLabelText(/photo/i),
      imageFile("image/png", 600 * 1024),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That image is larger than 500 KB. Choose a smaller one.",
    );
    expect(stagedPhoto(container)).toBe("");
    expect(screen.queryByAltText("Selected photo")).toBeNull();
  });

  it("shows the photo a contact already has", () => {
    const { container } = renderForm(noop(), makeContact({ photo: PHOTO }));

    expect(screen.getByAltText("Selected photo")).toHaveAttribute("src", PHOTO);
    expect(stagedPhoto(container)).toBe(PHOTO);
  });

  it("keeps that photo when an unrelated field is edited", async () => {
    const action = noop();
    renderForm(action, makeContact({ photo: PHOTO }));

    await userEvent.type(screen.getByLabelText(/phone/i), "9");

    // The picker was never opened, so the full-replacement PUT must still carry
    // the photo the form was seeded with.
    expect((await submit(action)).get("photo")).toBe(PHOTO);
  });

  it("submits an empty photo only once Remove is used", async () => {
    const action = noop();
    renderForm(action, makeContact({ photo: PHOTO }));

    await userEvent.click(screen.getByRole("button", { name: /remove photo/i }));

    expect(screen.queryByAltText("Selected photo")).toBeNull();
    expect((await submit(action)).get("photo")).toBe("");
  });
});

describe("ContactForm photo reads", () => {
  const noop = () => jest.fn(async (): Promise<FormState> => ({ status: "idle" }));

  // Reads finish on their own schedule in a browser, so drive them by hand:
  // whichever read the component honours is the point of these tests.
  const pending: { finish: (result: string) => void }[] = [];
  const RealFileReader = globalThis.FileReader;

  beforeEach(() => {
    pending.length = 0;
    class ControlledFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        pending.push({
          finish: (result: string) => {
            this.result = result;
            this.onload?.();
          },
        });
      }
    }
    globalThis.FileReader = ControlledFileReader as unknown as typeof FileReader;
  });

  afterEach(() => {
    globalThis.FileReader = RealFileReader;
  });

  it("keeps the newest selection when an earlier read finishes last", async () => {
    const { container } = renderForm(noop());
    const picker = screen.getByLabelText(/photo/i);

    await userEvent.upload(picker, imageFile("image/png", 8, "first.png"));
    await userEvent.upload(picker, imageFile("image/png", 8, "second.png"));
    expect(pending).toHaveLength(2);

    act(() => pending[1].finish("data:image/png;base64,SECOND="));
    act(() => pending[0].finish("data:image/png;base64,FIRST="));

    expect(stagedPhoto(container)).toBe("data:image/png;base64,SECOND=");
  });

  it("does not let an in-flight read undo Remove", async () => {
    const { container } = renderForm(noop(), makeContact({ photo: PHOTO }));

    await userEvent.upload(screen.getByLabelText(/photo/i), imageFile("image/png"));
    await userEvent.click(screen.getByRole("button", { name: /remove photo/i }));

    act(() => pending[0].finish("data:image/png;base64,LATE="));

    expect(stagedPhoto(container)).toBe("");
  });
});

describe("ContactForm addresses", () => {
  const noop = () => jest.fn(async (): Promise<FormState> => ({ status: "idle" }));

  const HOME = makeAddress();
  const WORK = makeAddress({
    id: 2,
    type: "Work",
    address: "1 Hacker Way",
    city: "Menlo Park",
    postal_code: "94025",
  });

  /** What the editor stages for a stored address: the server id dropped. */
  const asInput = (address: typeof HOME) => ({
    type: address.type,
    address: address.address,
    city: address.city,
    state: address.state,
    postal_code: address.postal_code,
    country: address.country,
  });

  const addAddress = () =>
    userEvent.click(screen.getByRole("button", { name: /add address/i }));

  it("starts a new contact with no addresses", () => {
    const { container } = renderForm(noop());

    expect(screen.getByText("No addresses yet.")).toBeInTheDocument();
    expect(stagedAddresses(container)).toEqual([]);
  });

  it("adds an address editor on demand", async () => {
    const { container } = renderForm(noop());

    await addAddress();

    expect(screen.getByLabelText(/^type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
    expect(stagedAddresses(container)).toHaveLength(1);
  });

  it("offers Home, Work, and Other", async () => {
    renderForm(noop());
    await addAddress();

    const select = screen.getByLabelText(/^type$/i);
    expect(
      Array.from(select.querySelectorAll("option")).map((o) => o.value),
    ).toEqual(["Home", "Work", "Other"]);

    await userEvent.selectOptions(select, "Work");
    expect(select).toHaveValue("Work");
  });

  it("keeps several addresses independent of each other", async () => {
    const { container } = renderForm(noop());
    await addAddress();
    await addAddress();

    const streets = screen.getAllByLabelText(/street address/i);
    await userEvent.type(streets[0], "1 Market St");
    await userEvent.type(streets[1], "1 Hacker Way");
    await userEvent.selectOptions(screen.getAllByLabelText(/^type$/i)[1], "Work");

    expect(stagedAddresses(container)).toEqual([
      expect.objectContaining({ type: "Home", address: "1 Market St" }),
      expect.objectContaining({ type: "Work", address: "1 Hacker Way" }),
    ]);
  });

  it("removes only the address asked for", async () => {
    const { container } = renderForm(noop(), makeContact({ addresses: [HOME, WORK] }));

    await userEvent.click(screen.getByRole("button", { name: "Remove address 1" }));

    expect(stagedAddresses(container)).toEqual([asInput(WORK)]);
    expect(screen.getAllByLabelText(/street address/i)).toHaveLength(1);
  });

  it("prefills the addresses a contact already has", () => {
    const { container } = renderForm(noop(), makeContact({ addresses: [HOME, WORK] }));

    const streets = screen.getAllByLabelText(/street address/i);
    expect(streets[0]).toHaveValue("1 Market St");
    expect(streets[1]).toHaveValue("1 Hacker Way");
    expect(screen.getAllByLabelText(/^type$/i)[1]).toHaveValue("Work");
    expect(stagedAddresses(container)).toEqual([asInput(HOME), asInput(WORK)]);
  });

  it("keeps every address and the photo when an unrelated field is edited", async () => {
    const action = noop();
    renderForm(action, makeContact({ addresses: [HOME, WORK], photo: PHOTO }));

    await userEvent.type(screen.getByLabelText(/phone/i), "9");

    const formData = await submit(action);
    expect(submittedAddresses(formData)).toEqual([asInput(HOME), asInput(WORK)]);
    expect(formData.get("photo")).toBe(PHOTO);
  });

  it("never sends a stored address's server id back to the API", async () => {
    const action = noop();
    renderForm(action, makeContact({ addresses: [HOME, WORK] }));

    await userEvent.type(screen.getByLabelText(/phone/i), "9");

    const submitted = submittedAddresses(await submit(action)) as unknown[];
    expect(submitted).toHaveLength(2);
    for (const entry of submitted) {
      expect(entry).not.toHaveProperty("id");
    }
  });

  it("keeps a validation message on its own entry after an earlier one goes", async () => {
    const action = jest.fn(
      async (): Promise<FormState> => ({
        status: "error",
        message: "Please fix the highlighted fields.",
        addressErrors: { 1: { postal_code: "Postal code must be 20 characters or fewer" } },
        values: { addresses: JSON.stringify([asInput(HOME), asInput(WORK)]) },
      }),
    );
    renderForm(action, makeContact({ addresses: [HOME, WORK] }));

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));
    await waitFor(() => expect(action).toHaveBeenCalled());

    // The message belongs to the second entry.
    let postals = await screen.findAllByLabelText(/postal code/i);
    expect(postals[0]).not.toHaveAttribute("aria-invalid");
    expect(postals[1]).toHaveAttribute("aria-invalid", "true");

    await userEvent.click(screen.getByRole("button", { name: "Remove address 1" }));

    // It must follow that entry up to position 0, not stay on a stale index.
    postals = screen.getAllByLabelText(/postal code/i);
    expect(postals).toHaveLength(1);
    expect(postals[0]).toHaveAttribute("aria-invalid", "true");
  });

  it("drops a removed address from the submitted payload", async () => {
    const action = noop();
    renderForm(action, makeContact({ addresses: [HOME, WORK] }));

    await userEvent.click(screen.getByRole("button", { name: "Remove address 1" }));

    expect(submittedAddresses(await submit(action))).toEqual([asInput(WORK)]);
  });

  it("submits an empty array once every address is removed", async () => {
    const action = noop();
    renderForm(action, makeContact({ addresses: [HOME, WORK] }));

    await userEvent.click(screen.getByRole("button", { name: "Remove address 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove address 1" }));

    expect(screen.getByText("No addresses yet.")).toBeInTheDocument();
    expect(submittedAddresses(await submit(action))).toEqual([]);
  });

  it("attaches a validation message to the entry it belongs to", async () => {
    const action = jest.fn(
      async (): Promise<FormState> => ({
        status: "error",
        message: "Please fix the highlighted fields.",
        addressErrors: { 1: { address: "Street address is required" } },
        values: { addresses: JSON.stringify([HOME, WORK]) },
      }),
    );
    renderForm(action, makeContact({ addresses: [HOME, WORK] }));

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));
    await waitFor(() => expect(action).toHaveBeenCalled());

    const streets = await screen.findAllByLabelText(/street address/i);
    expect(streets[1]).toHaveAttribute("aria-invalid", "true");
    expect(streets[0]).not.toHaveAttribute("aria-invalid");
    expect(
      (await screen.findAllByRole("alert")).map((node) => node.textContent),
    ).toEqual(expect.arrayContaining(["Street address is required"]));
  });
});
