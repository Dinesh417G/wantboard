"use client";

import { US_STATES } from "@/lib/domain/location";
import { Field, Input, Select } from "@/components/ui";

export type AddressValue = { line1?: string; line2?: string; city?: string; state?: string; zip?: string };

/** US address inputs. Field names are addr_line1, addr_line2, addr_city, addr_state, addr_zip; read them with readAddress(). */
export function AddressFields({ value, street = true, required = false }: { value?: AddressValue; street?: boolean; required?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      {street && (
        <>
          <div className="sm:col-span-4">
            <Field label="Street address">
              <Input name="addr_line1" defaultValue={value?.line1} required={required} maxLength={100} autoComplete="address-line1" placeholder="123 Main St" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Apt, suite">
              <Input name="addr_line2" defaultValue={value?.line2} maxLength={100} autoComplete="address-line2" placeholder="optional" />
            </Field>
          </div>
        </>
      )}
      <div className="sm:col-span-3">
        <Field label="City">
          <Input name="addr_city" defaultValue={value?.city} required={required} maxLength={60} autoComplete="address-level2" />
        </Field>
      </div>
      <div className="sm:col-span-1">
        <Field label="State">
          <Select name="addr_state" defaultValue={value?.state ?? ""} required={required} autoComplete="address-level1">
            <option value="">—</option>
            {Object.keys(US_STATES).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="ZIP">
          <Input name="addr_zip" defaultValue={value?.zip} required={required} inputMode="numeric" maxLength={10} autoComplete="postal-code" className="num" />
        </Field>
      </div>
    </div>
  );
}

export function readAddress(fd: FormData) {
  const g = (k: string) => String(fd.get(`addr_${k}`) ?? "");
  return { line1: g("line1"), line2: g("line2"), city: g("city"), state: g("state"), zip: g("zip") };
}
