import { auth, signIn } from "@/auth";
import { CoreCrmWorkspace } from "@/modules/core-crm/core-crm-workspace";

export default async function CrmPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="login-card">
        <p className="eyebrow">Syndes · Customer workspace</p>
        <h1>CRM</h1>
        <p>
          Entre com sua conta corporativa para abrir o ambiente do seu tenant.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("keycloak");
          }}
        >
          <button type="submit">Entrar com SSO</button>
        </form>
      </main>
    );
  }
  return <CoreCrmWorkspace />;
}
