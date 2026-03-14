import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="panel home-footer-panel site-footer-panel" id="footer">
      <div className="home-footer-grid">
        <div className="home-footer-col">
          <h3>Descubre</h3>
          <div className="home-footer-links">
            <Link href="/trabaja-con-nosotros" className="home-link-item">
              Trabaja con WeTask
            </Link>
            <Link href="/servicios" className="home-link-item">
              Servicios por categoría
            </Link>
            <Link href="/como-funciona" className="home-link-item">
              Cómo funciona
            </Link>
            <Link href="/ayuda-soporte" className="home-link-item">
              Ayuda y soporte
            </Link>
          </div>
        </div>

        <div className="home-footer-col home-footer-story">
          <h3>Sobre WeTask</h3>
          <p>
            Transformamos la vida diaria, una tarea a la vez. En WeTask conectamos personas que necesitan ayuda confiable con
            profesionales cercanos listos para resolverlo rápido, bien y con seguridad.
          </p>
          <p>
            Queremos que encontrar apoyo para tu casa, tu familia o tu rutina sea simple, humano y sin fricción, para que cada
            encuentro entre cliente y profesional termine mejorando la vida de ambos.
          </p>
          <Link href="/legal" className="home-link-item">
            Términos y privacidad
          </Link>
        </div>
      </div>
    </footer>
  );
}
