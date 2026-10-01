// Pantalla provisoria para las secciones del admin que todavía no construimos
interface EnConstruccionProps {
  titulo: string;
  descripcion: string;
}

export function EnConstruccion({ titulo, descripcion }: EnConstruccionProps) {
  return (
    <section>
      <h1 className="admin-titulo">{titulo}</h1>
      <p className="admin-subtitulo">{descripcion}</p>
      <div className="admin-en-construccion">Esta sección se construye en los próximos pasos.</div>
    </section>
  );
}