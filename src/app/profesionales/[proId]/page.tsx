"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LegacyProfessionalDetailRedirectPage() {
  const router = useRouter();
  const params = useParams<{ proId: string }>();

  useEffect(() => {
    router.replace(`/pro/${params.proId}`);
  }, [params.proId, router]);

  return null;
}
