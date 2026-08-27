import React from "react";
import { render, screen } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

describe("ContactAvatar", () => {
  it("falls back to initials when the contact has no photo", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: null })} />,
    );

    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the photo as a circular image, at the same size as the bubble", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} size="sm" />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", PHOTO);
    expect(image).toHaveClass("rounded-full", "object-cover", "h-8", "w-8");
    expect(screen.queryByText("AL")).toBeNull();
  });
});
