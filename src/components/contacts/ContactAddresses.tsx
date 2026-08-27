import { addressLines } from "@/lib/contacts/format";
import { ADDRESS_TYPES, type Address } from "@/lib/contacts/types";

/**
 * A contact's addresses on the detail page, grouped by type so the same kind
 * of address reads as one block. Types with nothing in them are skipped.
 */
export default function ContactAddresses({
  addresses,
}: {
  addresses: Address[];
}) {
  if (addresses.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground/70">
        No addresses yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-hairline">
      {ADDRESS_TYPES.map((type) => {
        const group = addresses.filter((address) => address.type === type);
        if (group.length === 0) return null;

        return (
          <section key={type} className="px-4 py-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {type}
            </h3>

            <ul className="mt-1.5 space-y-3">
              {group.map((address) => {
                const lines = addressLines(address);

                return (
                  <li key={address.id} className="text-sm text-foreground">
                    {lines.length ? (
                      <address className="not-italic">
                        {lines.map((line, lineIndex) => (
                          <span key={lineIndex} className="block break-words">
                            {line}
                          </span>
                        ))}
                      </address>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
