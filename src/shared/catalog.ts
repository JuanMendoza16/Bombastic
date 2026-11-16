// Catálogo de cosméticos (GDD secciones 12 y 13). Compartido por el cliente y el
// servidor para que los precios se validen en el backend. Ningún ítem cambia estadísticas.
import { CLASS_IDS, type ClassId } from './types';

export type Rarity = 'comun' | 'raro' | 'epico' | 'legendario';

export const RARITY: Record<Rarity, { name: string; color: string }> = {
  comun: { name: 'Común', color: '#b8c1cc' },
  raro: { name: 'Raro', color: '#3cb4ff' },
  epico: { name: 'Épico', color: '#c46bff' },
  legendario: { name: 'Legendario', color: '#ffb13b' },
};

export interface SkinMeta {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
}

export const SKIN_META: Record<ClassId, SkinMeta[]> = {
  tanque: [
    { id: 'base', name: 'Roca Madre', rarity: 'comun', price: 0 },
    { id: 'hielo', name: 'Glaciar', rarity: 'raro', price: 250 },
    { id: 'magma', name: 'Magma', rarity: 'epico', price: 500 },
    { id: 'oro', name: 'Oro Macizo', rarity: 'legendario', price: 1000 },
  ],
  veloz: [
    { id: 'base', name: 'Chispa Azul', rarity: 'comun', price: 0 },
    { id: 'fuego', name: 'Llamarada', rarity: 'raro', price: 250 },
    { id: 'toxica', name: 'Tóxica', rarity: 'raro', price: 250 },
    { id: 'galaxia', name: 'Galaxia', rarity: 'epico', price: 500 },
  ],
  distancia: [
    { id: 'base', name: 'Jungla', rarity: 'comun', price: 0 },
    { id: 'desierto', name: 'Desierto', rarity: 'raro', price: 250 },
    { id: 'coral', name: 'Coral', rarity: 'epico', price: 500 },
    { id: 'sombra', name: 'Sombra', rarity: 'legendario', price: 1000 },
  ],
  support: [
    { id: 'base', name: 'Médica', rarity: 'comun', price: 0 },
    { id: 'neon', name: 'Rosa Neón', rarity: 'raro', price: 250 },
    { id: 'espacial', name: 'Astronauta', rarity: 'epico', price: 500 },
    { id: 'noche', name: 'Guardiana Nocturna', rarity: 'legendario', price: 1000 },
  ],
  defensor: [
    { id: 'base', name: 'Granito', rarity: 'comun', price: 0 },
    { id: 'musgo', name: 'Musgo Antiguo', rarity: 'raro', price: 250 },
    { id: 'obsidiana', name: 'Obsidiana', rarity: 'epico', price: 500 },
    { id: 'jade', name: 'Jade Imperial', rarity: 'legendario', price: 1000 },
  ],
  controlador: [
    { id: 'base', name: 'Violeta', rarity: 'comun', price: 0 },
    { id: 'esmeralda', name: 'Código Esmeralda', rarity: 'raro', price: 250 },
    { id: 'carmesi', name: 'Carmesí', rarity: 'epico', price: 500 },
    { id: 'nulo', name: 'Nulo', rarity: 'legendario', price: 1000 },
  ],
};

export interface Emote {
  id: number;
  text: string;
  color: string;
  rarity: Rarity;
  price: number;
}

export const EMOTES: Emote[] = [
  { id: 1, text: '¡GG!', color: '#ffd23f', rarity: 'comun', price: 0 },
  { id: 2, text: '¡Vamos!', color: '#3cff9a', rarity: 'comun', price: 0 },
  { id: 3, text: '¡Ayuda!', color: '#ff7a7a', rarity: 'comun', price: 0 },
  { id: 4, text: 'JAJA', color: '#ffb3dc', rarity: 'comun', price: 100 },
  { id: 5, text: '¡Bandera!', color: '#6ee7ff', rarity: 'comun', price: 100 },
  { id: 6, text: 'Uy...', color: '#c9c5d4', rarity: 'raro', price: 250 },
  { id: 7, text: '¡BOOM!', color: '#ff8a1a', rarity: 'raro', price: 250 },
  { id: 8, text: '¿Eso es todo?', color: '#c46bff', rarity: 'epico', price: 500 },
  { id: 9, text: '¡Soy leyenda!', color: '#ffb13b', rarity: 'legendario', price: 1000 },
];

export interface FxItem {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
}

export const FX_ITEMS: FxItem[] = [
  { id: 'clasico', name: 'Fuego Clásico', rarity: 'comun', price: 0 },
  { id: 'azul', name: 'Llama Azul', rarity: 'raro', price: 250 },
  { id: 'toxico', name: 'Explosión Tóxica', rarity: 'raro', price: 250 },
  { id: 'plasma', name: 'Plasma', rarity: 'epico', price: 500 },
  { id: 'sombra', name: 'Fuego Sombrío', rarity: 'epico', price: 500 },
  { id: 'dorado', name: 'Estallido Dorado', rarity: 'legendario', price: 1000 },
  { id: 'arcoiris', name: 'Arcoíris', rarity: 'legendario', price: 1000 },
];

export interface ShopItem {
  key: string; // skin:tanque:hielo | fx:azul | emote:4
  kind: 'skin' | 'fx' | 'emote';
  name: string;
  rarity: Rarity;
  price: number;
  cls?: ClassId;
  ref: string;
}

export function allShopItems(): ShopItem[] {
  const out: ShopItem[] = [];
  for (const cls of CLASS_IDS) {
    for (const s of SKIN_META[cls]) {
      if (s.price === 0) continue;
      out.push({ key: `skin:${cls}:${s.id}`, kind: 'skin', name: s.name, rarity: s.rarity, price: s.price, cls, ref: s.id });
    }
  }
  for (const f of FX_ITEMS) if (f.price > 0) out.push({ key: `fx:${f.id}`, kind: 'fx', name: f.name, rarity: f.rarity, price: f.price, ref: f.id });
  for (const e of EMOTES) if (e.price > 0) out.push({ key: `emote:${e.id}`, kind: 'emote', name: e.text, rarity: e.rarity, price: e.price, ref: String(e.id) });
  return out;
}

export function priceOf(key: string): number | null {
  const it = allShopItems().find((i) => i.key === key);
  return it ? it.price : null;
}

/** Ítems gratuitos que todos tienen desde el inicio. */
export function defaultOwned(): string[] {
  const out: string[] = [];
  for (const cls of CLASS_IDS) out.push(`skin:${cls}:base`);
  out.push('fx:clasico');
  for (const e of EMOTES) if (e.price === 0) out.push(`emote:${e.id}`);
  return out;
}

/** Recompensas por subir de nivel (además de monedas). */
export const LEVEL_REWARDS: Record<number, string> = {
  3: 'emote:4',
  5: 'fx:azul',
  7: 'skin:veloz:fuego',
  10: 'emote:6',
  12: 'skin:tanque:hielo',
  15: 'fx:toxico',
  18: 'skin:distancia:desierto',
  20: 'emote:7',
  25: 'skin:support:espacial',
  30: 'fx:plasma',
  35: 'skin:defensor:obsidiana',
  40: 'emote:8',
  45: 'skin:controlador:carmesi',
  50: 'fx:dorado',
};

export function itemName(key: string): string {
  const [kind, a, b] = key.split(':');
  if (kind === 'skin') {
    const s = SKIN_META[a as ClassId]?.find((x) => x.id === b);
    return s ? `Skin ${s.name}` : key;
  }
  if (kind === 'fx') return FX_ITEMS.find((f) => f.id === a)?.name ?? key;
  if (kind === 'emote') return `Emote "${EMOTES.find((e) => String(e.id) === a)?.text ?? a}"`;
  return key;
}

export function itemRarity(key: string): Rarity {
  const [kind, a, b] = key.split(':');
  if (kind === 'skin') return SKIN_META[a as ClassId]?.find((x) => x.id === b)?.rarity ?? 'comun';
  if (kind === 'fx') return FX_ITEMS.find((f) => f.id === a)?.rarity ?? 'comun';
  if (kind === 'emote') return EMOTES.find((e) => String(e.id) === a)?.rarity ?? 'comun';
  return 'comun';
}
