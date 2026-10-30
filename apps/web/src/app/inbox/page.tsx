import { auth, signIn } from "@/auth";
import { InboxWorkspace } from "@/modules/inbox/inbox-workspace";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="login-card">
        <p className="eyebrow">Syndes · Caixa de Entrada</p>
        <h1>Inbox</h1>
        <p>
          Entre com sua conta corporativa para abrir o ambiente de atendimento.
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
  return (
    <InboxWorkspace
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
    />
  );
}
