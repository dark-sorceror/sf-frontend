import React from "react";
import { render, screen } from "@testing-library/react";
import ContactAddresses from "@/components/contacts/ContactAddresses";
import { makeAddress } from "../mocks/handlers";

const HOME = makeAddress();
const WORK = makeAddress({
  id: 2,
  type: "Work",
  address: "1 Hacker Way",
  city: "Menlo Park",
  postal_code: "94025",
});
const OTHER = makeAddress({ id: 3, type: "Other", address: "9 Beach Rd" });

describe("ContactAddresses", () => {
  it("says so when the contact has none", () => {
    render(<ContactAddresses addresses={[]} />);
    expect(screen.getByText("No addresses yet.")).toBeInTheDocument();
  });

  it("renders every address under a heading naming its type", () => {
    render(<ContactAddresses addresses={[HOME, WORK]} />);

    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work" })).toBeInTheDocument();
    expect(screen.getByText("1 Market St")).toBeInTheDocument();
    expect(screen.getByText("San Francisco, CA 94105")).toBeInTheDocument();
    expect(screen.getByText("1 Hacker Way")).toBeInTheDocument();
    expect(screen.getByText("Menlo Park, CA 94025")).toBeInTheDocument();
  });

  it("groups addresses that share a type under one heading", () => {
    render(
      <ContactAddresses
        addresses={[HOME, makeAddress({ id: 4, address: "2 Market St" })]}
      />,
    );

    expect(screen.getAllByRole("heading", { name: "Home" })).toHaveLength(1);
    expect(screen.getByText("1 Market St")).toBeInTheDocument();
    expect(screen.getByText("2 Market St")).toBeInTheDocument();
  });

  it("always orders the groups Home, Work, Other", () => {
    render(<ContactAddresses addresses={[OTHER, WORK, HOME]} />);

    expect(
      screen.getAllByRole("heading").map((heading) => heading.textContent),
    ).toEqual(["Home", "Work", "Other"]);
  });
});
