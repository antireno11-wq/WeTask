import { revalidateTag } from "next/cache";

export const CACHE_TAGS = {
  catalog: "marketplace:catalog",
  services: "marketplace:services"
} as const;

export function invalidateMarketplaceCatalog() {
  revalidateTag(CACHE_TAGS.catalog);
  revalidateTag(CACHE_TAGS.services);
}
