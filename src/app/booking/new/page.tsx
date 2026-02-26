import { redirect } from "next/navigation";

type BookingNewPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function BookingNewPage({ searchParams }: BookingNewPageProps) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string") {
      qs.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item);
    }
  }

  const target = `/reservar${qs.toString() ? `?${qs.toString()}` : ""}`;
  redirect(target);
}
