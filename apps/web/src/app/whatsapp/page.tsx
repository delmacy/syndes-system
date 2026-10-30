import { auth, signIn } from "@/auth";
import { WhatsAppWorkspace } from "@/modules/whatsapp/whatsapp-workspace";

export default async function WhatsAppPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="login-card">
        <p className="eyebrow">Syndes · WhatsApp</p>
        <h1>Conexão WhatsApp</h1>
        <p>Entre com sua conta corporativa para gerenciar o canal.</p>
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
    <WhatsAppWorkspace
      user={{ name: session.user.name, email: session.user.email }}
    />
  );
}
