// Tienda (monedas por cosméticos) y Personalizar (inventario y equipamiento).
import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { CLASSES } from '../../../shared/balance';
import { EMOTES, FX_ITEMS, RARITY, allShopItems, type ShopItem } from '../../../shared/catalog';
import { CLASS_IDS, type ClassId } from '../../../shared/types';
import { audio } from '../../audio/audio';
import { SKINS } from '../../gfx/characters';
import { Sprites, portraitURL, spriteURL } from '../../gfx/sprites';
import { profiles } from '../../services/profile';
import { Backdrop, Btn, Coins, Header, Modal, RarityTag, toast } from '../common';
import { useProfile } from '../hooks';

function fxPreview(fx: string): string {
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 32;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(Sprites.flame(3, 1, 0, fx), 0, 0);
  ctx.drawImage(Sprites.flame(0, 1, 1, fx), 32, 0);
  ctx.drawImage(Sprites.flame(4, 1, 0, fx), 64, 0);
  return spriteURL(cv, 2);
}

function ItemPreview({ it }: { it: ShopItem }) {
  const bg = { '--rc': RARITY[it.rarity].color + '55' } as JSX.CSSProperties;
  if (it.kind === 'skin')
    return (
      <div class="preview" style={bg}>
        <img src={portraitURL(it.cls!, it.ref, 'idle', 0, 3)} alt="" />
      </div>
    );
  if (it.kind === 'fx')
    return (
      <div class="preview" style={bg}>
        <img src={fxPreview(it.ref)} style={{ height: '60px' }} alt="" />
      </div>
    );
  const em = EMOTES.find((e) => String(e.id) === it.ref)!;
  return (
    <div class="preview" style={bg}>
      <span class="emote-bubble" style={{ borderBottom: `5px solid ${em.color}` }}>
        {em.text}
      </span>
    </div>
  );
}

export function ShopScreen() {
  const p = useProfile();
  const [cat, setCat] = useState<'todo' | 'skin' | 'fx' | 'emote'>('todo');
  const [confirm, setConfirm] = useState<ShopItem | null>(null);
  const items = useMemo(() => allShopItems(), []);
  const featured = useMemo(() => {
    // "ofertas del día": 3 ítems según la fecha
    const day = Math.floor(Date.now() / 86400000);
    const pool = items.filter((i) => !p.owned.includes(i.key));
    return [0, 1, 2].map((k) => pool[(day * 7 + k * 13) % Math.max(1, pool.length)]).filter(Boolean);
  }, [items]);
  const list = items.filter((i) => cat === 'todo' || i.kind === cat);
  const buy = async (it: ShopItem) => {
    const r = await profiles.buy(it.key);
    if (r.ok) {
      audio.play('buy');
      toast(`¡Compraste ${it.kind === 'emote' ? 'el emote' : ''} ${it.name}!`, 'ok');
    } else toast(r.error ?? 'No se pudo comprar', 'err');
    setConfirm(null);
  };
  return (
    <div class="screen">
      <Backdrop />
      <Header title="Tienda">
        <div class="panel" style={{ padding: '8px 14px' }}>
          <Coins n={p.coins} />
        </div>
      </Header>
      <div class="screen-body">
        <p class="muted" style={{ marginTop: 0 }}>Los cosméticos no cambian estadísticas: solo el estilo. Ganá monedas jugando partidas, subiendo de nivel, completando logros y niveles del Festival.</p>
        {featured.length > 0 && (
          <>
            <h3 style={{ color: 'var(--yellow)', textShadow: '0 2px 0 var(--ink)', margin: '4px 0 10px' }}>⭐ Destacados de hoy</h3>
            <div class="cards" style={{ marginBottom: '20px' }}>
              {featured.map((it) => (
                <ShopCard key={it.key} it={it} owned={p.owned.includes(it.key)} coins={p.coins} onBuy={() => setConfirm(it)} />
              ))}
            </div>
          </>
        )}
        <div class="tabs">
          {(
            [
              ['todo', 'Todo'],
              ['skin', 'Skins'],
              ['fx', 'Explosiones'],
              ['emote', 'Emotes'],
            ] as const
          ).map(([k, n]) => (
            <Btn key={k} variant={cat === k ? 'yellow' : 'ghost'} size="small" onClick={() => setCat(k)}>
              {n}
            </Btn>
          ))}
        </div>
        <div class="cards">
          {list.map((it) => (
            <ShopCard key={it.key} it={it} owned={p.owned.includes(it.key)} coins={p.coins} onBuy={() => setConfirm(it)} />
          ))}
        </div>
      </div>
      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <div class="shop-item">
            <ItemPreview it={confirm} />
            <h3 style={{ margin: '6px 0 0' }}>{confirm.name}</h3>
            {confirm.cls && <div class="muted">Skin para {CLASSES[confirm.cls].hero}</div>}
            <RarityTag r={confirm.rarity} />
            <div style={{ margin: '10px 0' }}>
              ¿Comprar por <Coins n={confirm.price} />?
            </div>
            <div class="row">
              <Btn variant="ghost" sound="back" onClick={() => setConfirm(null)}>
                Cancelar
              </Btn>
              <Btn variant="green" disabled={p.coins < confirm.price} onClick={() => buy(confirm)}>
                Comprar
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ShopCard({ it, owned, coins, onBuy }: { it: ShopItem; owned: boolean; coins: number; onBuy: () => void }) {
  return (
    <div class="card shop-item" style={{ cursor: 'default' }}>
      <ItemPreview it={it} />
      <h4>{it.name}</h4>
      <div class="muted" style={{ fontSize: '13px' }}>
        {it.kind === 'skin' ? `Skin · ${CLASSES[it.cls!].hero}` : it.kind === 'fx' ? 'Efecto de explosión' : 'Emote'}
      </div>
      <RarityTag r={it.rarity} />
      {owned ? (
        <span class="tag" style={{ background: '#1f7a4a' }}>
          ✔ En tu colección
        </span>
      ) : (
        <Btn size="small" variant={coins >= it.price ? 'green' : 'ghost'} onClick={onBuy}>
          <i class="coin" style={{ width: '16px', height: '16px' }} /> {it.price}
        </Btn>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personalizar / inventario
// ---------------------------------------------------------------------------

export function LockerScreen() {
  const p = useProfile();
  const [cls, setCls] = useState<ClassId>(p.favorite);
  const [emoteSlot, setEmoteSlot] = useState(0);
  const equipped = p.equip.skins[cls] ?? 'base';
  const eq = async (key: string, slot?: number) => {
    const r = await profiles.equip(key, slot);
    if (r.ok) audio.play('power');
    else toast(r.error ?? 'Error', 'err');
  };
  const ownedCount = p.owned.length;
  return (
    <div class="screen">
      <Backdrop />
      <Header title="Personalizar">
        <span class="tag">
          {ownedCount} ítems en tu inventario
        </span>
      </Header>
      <div class="screen-body">
        <div class="grid layout-split-2">
          <div class="panel">
            <h3>Skins</h3>
            <div class="row wrap" style={{ gap: '6px', marginBottom: '12px' }}>
              {CLASS_IDS.map((c) => (
                <Btn key={c} size="small" variant={c === cls ? 'yellow' : 'ghost'} onClick={() => setCls(c)}>
                  {CLASSES[c].hero}
                </Btn>
              ))}
            </div>
            <div class="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 130px), 1fr))' }}>
              {SKINS[cls].map((s) => {
                const key = `skin:${cls}:${s.id}`;
                const has = p.owned.includes(key);
                return (
                  <button key={s.id} class={`card ${equipped === s.id ? 'sel' : ''} ${has ? '' : 'locked'}`} style={{ textAlign: 'center' }} onClick={() => has && eq(key)}>
                    <img src={portraitURL(cls, s.id, equipped === s.id ? 'win' : 'idle', 1, 2)} style={{ width: 'min(96px, 100%)', imageRendering: 'pixelated' }} alt="" />
                    <div style={{ fontWeight: 700 }}>{has ? s.name : `🔒 ${s.name}`}</div>
                    <RarityTag r={s.rarity} />
                    {equipped === s.id && <div class="tag" style={{ marginTop: '4px', background: '#ffd23f', color: '#1a1026' }}>Equipada</div>}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minInlineSize: 0 }}>
            <div class="panel">
              <h3>Explosión</h3>
              <div class="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))' }}>
                {FX_ITEMS.map((f) => {
                  const key = `fx:${f.id}`;
                  const has = p.owned.includes(key);
                  return (
                    <button key={f.id} class={`card ${p.equip.fx === f.id ? 'sel' : ''} ${has ? '' : 'locked'}`} style={{ textAlign: 'center' }} onClick={() => has && eq(key)}>
                      <img src={fxPreview(f.id)} style={{ width: '100%', imageRendering: 'pixelated' }} alt="" />
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{has ? f.name : `🔒 ${f.name}`}</div>
                      <RarityTag r={f.rarity} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div class="panel">
              <h3>Emotes (4 atajos: teclas 1 a 4)</h3>
              <div class="row wrap" style={{ marginBottom: '10px' }}>
                {[0, 1, 2, 3].map((i) => {
                  const em = EMOTES.find((e) => e.id === p.equip.emotes[i]);
                  return (
                    <button key={i} class={`card ${emoteSlot === i ? 'sel' : ''}`} style={{ flex: '1 1 90px', textAlign: 'center', padding: '8px' }} onClick={() => setEmoteSlot(i)}>
                      <div class="muted" style={{ fontSize: '12px' }}>Tecla {i + 1}</div>
                      <div style={{ fontFamily: 'var(--title)', fontSize: 'clamp(0.55rem, 0.5rem + 0.2vw, 0.75rem)', color: em?.color }}>{em?.text ?? '—'}</div>
                    </button>
                  );
                })}
              </div>
              <div class="row wrap" style={{ gap: '8px' }}>
                {EMOTES.map((e) => {
                  const key = `emote:${e.id}`;
                  const has = p.owned.includes(key);
                  return (
                    <button key={e.id} class={`card ${has ? '' : 'locked'}`} style={{ padding: '6px 10px' }} onClick={() => has && eq(key, emoteSlot)}>
                      <span style={{ fontFamily: 'var(--title)', color: e.color }}>{has ? e.text : `🔒 ${e.text}`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
