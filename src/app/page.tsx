const checklist = [
  "Conectar PostgreSQL de Railway en DATABASE_URL",
  "Correr prisma migrate deploy en Railway",
  "Configurar dominio y NEXT_PUBLIC_APP_URL",
  "Implementar auth (Clerk/Auth0)"
];

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">MVP Base</p>
        <h1>Servicios a domicilio para Chile</h1>
        <p className="lead">
          Base técnica lista para construir cliente, prestador y admin sobre Next.js + Prisma + Railway.
        </p>
      </section>

      <section className="card">
        <h2>Checklist inmediato</h2>
        <ul>
          {checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
