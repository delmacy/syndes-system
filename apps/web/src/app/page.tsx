import { auth, signIn } from "@/auth";

/** Minimal auth shell only — no CRM or platform-admin product UI. */
export default async function AuthShellPage() {
  const session = await auth();

  return (
    <main>
      <h1>Syndes</h1>
      {session?.user ? (
        <>
          <p>
            Sessão autenticada no servidor. Tokens OAuth não são expostos ao
            browser.
          </p>
          <form action="/api/auth/keycloak-logout" method="post">
            <button type="submit">Sair (SSO)</button>
          </form>
        </>
      ) : (
        <>
          <p>Acesse sua conta corporativa.</p>
          <form
            action={async () => {
              "use server";
              await signIn("keycloak");
            }}
          >
            <button type="submit">Entrar com SSO</button>
          </form>
        </>
      )}
    </main>
  );
}
