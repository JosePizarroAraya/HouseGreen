// Paso 52b: categorías de HouseGreen para los tipos de propiedad.
// El sitio de remates usa más de 20 nombres y varios significan lo mismo ("sitio", "lote" y "terreno";
// "casa" y "vivienda"). Aquí se agrupan en 8 categorías que sí son distintas para quien invierte.
// Este archivo es el único lugar donde se define esa agrupación: lo usan el dibujo de las
// propiedades sin foto y el filtro por tipo del catálogo (paso 72).

export type CategoriaTipo =
  | "departamento"
  | "casa"
  | "terreno"
  | "parcela"
  | "comercial"
  | "bodega"
  | "derechos"
  | "otro";

export function categoriaDeTipo(tipo: string): CategoriaTipo {
  const texto = tipo.toLowerCase();
  const contiene = (palabras: string[]) => palabras.some((palabra) => texto.includes(palabra));

  // El orden importa: "parcela con casa" debe quedar como parcela, no como casa
  if (contiene(["derecho", "usufructo", "nuda propiedad"])) return "derechos";
  if (contiene(["parcela", "predio", "fundo", "hijuela", "agrícola", "agricola"])) return "parcela";
  if (contiene(["casa", "vivienda"])) return "casa";
  if (contiene(["departamento"])) return "departamento";
  if (contiene(["oficina", "local"])) return "comercial";
  if (contiene(["bodega", "estacionamiento"])) return "bodega";
  if (contiene(["sitio", "lote", "terreno"])) return "terreno";
  return "otro"; // "inmueble", "propiedad" y cualquier nombre nuevo
}

// Paso 72: las categorías en el orden en que aparecen en el filtro del catálogo, con su nombre para mostrar
export const CATEGORIAS: { valor: CategoriaTipo; nombre: string }[] = [
  { valor: "departamento", nombre: "Departamentos" },
  { valor: "casa", nombre: "Casas" },
  { valor: "terreno", nombre: "Terrenos y sitios" },
  { valor: "parcela", nombre: "Parcelas y predios" },
  { valor: "comercial", nombre: "Oficinas y locales" },
  { valor: "bodega", nombre: "Bodegas y estacionamientos" },
  { valor: "derechos", nombre: "Derechos sobre una propiedad" },
  { valor: "otro", nombre: "Otros" },
];