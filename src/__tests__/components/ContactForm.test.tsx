import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "@/components/contacts/ContactForm";
import { makeContact } from "../mocks/handlers";
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
    expect(screen.getByLabelText(/street address/i)).toHaveValue("");
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
