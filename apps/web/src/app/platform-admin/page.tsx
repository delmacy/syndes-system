import { auth, signInPlatformAdmin } from "@/auth";
import { PlatformAdmin } from "@/modules/platform-admin/platform-admin";

export default async function PlatformAdminPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="login-card">
        <p className="eyebrow">Syndes · Control Plane</p>
        <h1>Platform Admin</h1>
        <p>
          Entre com sua conta corporativa. A autenticação solicita MFA para esta
          área.
        </p>
        <form action={signInPlatformAdmin}>
          <button type="submit">Entrar com MFA</button>
        </form>
      </main>
    );
  }
  return <PlatformAdmin />;
}
