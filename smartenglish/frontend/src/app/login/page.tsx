import Link from "next/link";
import { Suspense } from "react";

import LoginClient from "./ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<main>Đang tải…</main>}>
      <LoginClient />
      <nav style={{ marginTop: "1rem" }}>
        <Link href="/">← Home</Link>
      </nav>
    </Suspense>
  );
}
