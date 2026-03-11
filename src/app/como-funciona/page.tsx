import { MarketNav } from "@/components/market-nav";

const serviceShowcase = [
  {
    title: "Limpieza",
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
    text: "Limpieza por hora, profunda o recurrente con profesionales verificados."
  },
  {
    title: "Maestro",
    image: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80",
    text: "Reparaciones y mantenciones del hogar con agenda clara y precio visible."
  },
  {
    title: "Clases",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80",
    text: "Clases de apoyo y aprendizaje a domicilio según tu disponibilidad."
  }
];

export default function ComoFuncionaPage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>Como funciona WeTask</h2>
          <p>WeTask conecta personas que necesitan ayuda en casa con profesionales listos para atender por hora.</p>
        </div>
        <div className="we-info-grid">
          <div>
            <h3>1. Eliges un servicio</h3>
            <p>Seleccionas la categoria que necesitas y escribes tu direccion.</p>
          </div>
          <div>
            <h3>2. Comparas profesionales</h3>
            <p>Ves perfiles, valoraciones, precios y disponibilidad real.</p>
          </div>
          <div>
            <h3>3. Reservas en linea</h3>
            <p>Confirmas fecha y hora con pago protegido hasta terminar el servicio.</p>
          </div>
          <div>
            <h3>4. Evalúas el resultado</h3>
            <p>Calificas al profesional y ayudas a mantener la calidad de la plataforma.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Servicios principales</h2>
          <p>Estas son las categorias activas del MVP.</p>
        </div>
        <div className="home-service-grid compact-service-grid">
          {serviceShowcase.map((item) => (
            <article key={item.title} className="home-service-card">
              <div className="service-photo" style={{ backgroundImage: `url(${item.image})` }} aria-hidden />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
