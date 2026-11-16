// Base de datos SQLite (módulo node:sqlite, sin dependencias nativas).
// Modelo relacional: usuarios, perfiles, partidas, jugadores por partida,
// historial de ELO, compras, recuperación de contraseña y auditoría.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { levelFromXp } from '../src/shared/balance';
import { newProfile, normalizeProfile, type Profile } from '../src/shared/profile';

export interface UserRow {
  id: number;
  username: string;
  email: string;
  pass_hash: string;
  role: 'player' | 'admin';
  banned: number;
  created_at: number;
  last_login: number | null;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash   TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  banned      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  last_login  INTEGER
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT    NOT NULL,
  elo         INTEGER NOT NULL DEFAULT 1000,
  elo_peak    INTEGER NOT NULL DEFAULT 1000,
  xp          INTEGER NOT NULL DEFAULT 0,
  level       INTEGER NOT NULL DEFAULT 1,
  coins       INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_elo ON profiles(elo DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_peak ON profiles(elo_peak DESC);

CREATE TABLE IF NOT EXISTS matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code   TEXT,
  mode        TEXT    NOT NULL,
  map         TEXT    NOT NULL,
  winner      INTEGER NOT NULL,
  duration    REAL    NOT NULL,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_matches_end ON matches(ended_at);

CREATE TABLE IF NOT EXISTS match_players (
  match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  bot         INTEGER NOT NULL,
  team        INTEGER NOT NULL,
  cls         TEXT    NOT NULL,
  result      TEXT    NOT NULL,
  kills       INTEGER NOT NULL DEFAULT 0,
  deaths      INTEGER NOT NULL DEFAULT 0,
  assists     INTEGER NOT NULL DEFAULT 0,
  caps        INTEGER NOT NULL DEFAULT 0,
  returns     INTEGER NOT NULL DEFAULT 0,
  dmg         INTEGER NOT NULL DEFAULT 0,
  points      INTEGER NOT NULL DEFAULT 0,
  elo_before  INTEGER,
  elo_after   INTEGER,
  xp          INTEGER,
  coins       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_mp_user ON match_players(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_match ON match_players(match_id);

CREATE TABLE IF NOT EXISTS elo_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta       INTEGER NOT NULL,
  elo_after   INTEGER NOT NULL,
  at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_elo_log ON elo_log(at, user_id);

CREATE TABLE IF NOT EXISTS purchases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item        TEXT    NOT NULL,
  price       INTEGER NOT NULL,
  at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires     INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  user_id     INTEGER,
  action      TEXT    NOT NULL,
  detail      TEXT,
  ip          TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
`;

export class Db {
  readonly db: DatabaseSync;
  private txDepth = 0;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  /** Ejecuta un bloque dentro de una transacción atómica (admite anidamiento con savepoints). */
  tx<T>(fn: () => T): T {
    const depth = this.txDepth++;
    const sp = `sp_${depth}`;
    if (depth === 0) this.db.exec('BEGIN IMMEDIATE');
    else this.db.exec(`SAVEPOINT ${sp}`);
    try {
      const res = fn();
      if (depth === 0) this.db.exec('COMMIT');
      else this.db.exec(`RELEASE SAVEPOINT ${sp}`);
      this.txDepth--;
      return res;
    } catch (err) {
      this.txDepth--;
      try {
        if (depth === 0) this.db.exec('ROLLBACK');
        else this.db.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
      } catch {
        // ignorar fallo de rollback si la conexión ya se cerró
      }
      throw err;
    }
  }

  // --- usuarios -------------------------------------------------------------

  createUser(username: string, email: string, passHash: string, role: 'player' | 'admin' = 'player'): UserRow {
    return this.tx(() => {
      const now = Date.now();
      const r = this.db.prepare('INSERT INTO users (username, email, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(username, email, passHash, role, now);
      const id = Number(r.lastInsertRowid);
      const profile = newProfile(username);
      this.saveProfile(id, profile);
      return this.userById(id)!;
    });
  }

  userById(id: number): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  userByName(username: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  }

  userByEmail(email: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  }

  touchLogin(id: number) {
    this.db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), id);
  }

  setPassword(id: number, hash: string) {
    this.db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hash, id);
  }

  setBanned(id: number, banned: boolean) {
    this.db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, id);
  }

  setRole(id: number, role: 'player' | 'admin') {
    this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  }

  // --- perfiles --------------------------------------------------------------

  getProfile(userId: number): Profile {
    const row = this.db.prepare('SELECT data FROM profiles WHERE user_id = ?').get(userId) as { data: string } | undefined;
    if (!row) {
      const u = this.userById(userId);
      const p = newProfile(u?.username ?? 'Jugador');
      this.saveProfile(userId, p);
      return p;
    }
    return normalizeProfile(JSON.parse(row.data));
  }

  saveProfile(userId: number, p: Profile) {
    const lv = levelFromXp(p.xp).level;
    this.db
      .prepare(
        `INSERT INTO profiles (user_id, data, elo, elo_peak, xp, level, coins, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, elo = excluded.elo, elo_peak = excluded.elo_peak, xp = excluded.xp,
         level = excluded.level, coins = excluded.coins, updated_at = excluded.updated_at`,
      )
      .run(userId, JSON.stringify(p), p.elo, p.eloPeak, p.xp, lv, p.coins, Date.now());
  }

  // --- partidas --------------------------------------------------------------

  insertMatch(m: { room: string; mode: string; map: string; winner: number; duration: number; started: number }): number {
    const r = this.db
      .prepare('INSERT INTO matches (room_code, mode, map, winner, duration, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(m.room, m.mode, m.map, m.winner, m.duration, m.started, Date.now());
    return Number(r.lastInsertRowid);
  }

  insertMatchPlayer(matchId: number, p: {
    userId: number | null;
    name: string;
    bot: boolean;
    team: number;
    cls: string;
    result: string;
    kills: number;
    deaths: number;
    assists: number;
    caps: number;
    returns: number;
    dmg: number;
    points: number;
    eloBefore: number | null;
    eloAfter: number | null;
    xp: number | null;
    coins: number | null;
  }) {
    this.db
      .prepare(
        `INSERT INTO match_players (match_id, user_id, name, bot, team, cls, result, kills, deaths, assists, caps, returns, dmg, points, elo_before, elo_after, xp, coins)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(matchId, p.userId, p.name, p.bot ? 1 : 0, p.team, p.cls, p.result, p.kills, p.deaths, p.assists, p.caps, p.returns, p.dmg, p.points, p.eloBefore, p.eloAfter, p.xp, p.coins);
  }

  logElo(userId: number, delta: number, after: number) {
    this.db.prepare('INSERT INTO elo_log (user_id, delta, elo_after, at) VALUES (?, ?, ?, ?)').run(userId, delta, after, Date.now());
  }

  logPurchase(userId: number, item: string, price: number) {
    this.db.prepare('INSERT INTO purchases (user_id, item, price, at) VALUES (?, ?, ?, ?)').run(userId, item, price, Date.now());
  }

  history(userId: number, limit = 30) {
    return this.db
      .prepare(
        `SELECT m.id, m.mode, m.map, m.winner, m.duration, m.ended_at, mp.team, mp.cls, mp.result, mp.kills, mp.deaths, mp.assists, mp.caps, mp.points, mp.elo_before, mp.elo_after
         FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.user_id = ? ORDER BY m.ended_at DESC LIMIT ?`,
      )
      .all(userId, limit);
  }

  // --- ranking ---------------------------------------------------------------

  ranking(type: 'global' | 'semanal' | 'historico', limit = 50) {
    if (type === 'semanal') {
      const since = weekStart();
      return this.db
        .prepare(
          `SELECT u.username AS name, p.elo AS elo, p.level AS level, SUM(l.delta) AS value
           FROM elo_log l JOIN users u ON u.id = l.user_id JOIN profiles p ON p.user_id = u.id
           WHERE l.at >= ? AND u.banned = 0 GROUP BY u.id ORDER BY value DESC LIMIT ?`,
        )
        .all(since, limit) as { name: string; elo: number; level: number; value: number }[];
    }
    const col = type === 'historico' ? 'p.elo_peak' : 'p.elo';
    return this.db
      .prepare(
        `SELECT u.username AS name, p.elo AS elo, p.level AS level, ${col} AS value,
          (SELECT COUNT(*) FROM match_players mp WHERE mp.user_id = u.id) AS matches
         FROM profiles p JOIN users u ON u.id = p.user_id
         WHERE u.banned = 0 AND EXISTS (SELECT 1 FROM match_players mp WHERE mp.user_id = u.id)
         ORDER BY value DESC LIMIT ?`,
      )
      .all(limit) as { name: string; elo: number; level: number; value: number; matches: number }[];
  }

  // --- recuperación de contraseña -------------------------------------------

  addReset(tokenHash: string, userId: number, expires: number) {
    this.db.prepare('INSERT INTO password_resets (token_hash, user_id, expires) VALUES (?, ?, ?)').run(tokenHash, userId, expires);
  }

  useReset(tokenHash: string): number | null {
    const row = this.db.prepare('SELECT user_id, expires, used FROM password_resets WHERE token_hash = ?').get(tokenHash) as
      | { user_id: number; expires: number; used: number }
      | undefined;
    if (!row || row.used || row.expires < Date.now()) return null;
    this.db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(tokenHash);
    return row.user_id;
  }

  // --- auditoría y administración --------------------------------------------

  audit(action: string, userId: number | null, detail: string, ip: string) {
    this.db.prepare('INSERT INTO audit_log (at, user_id, action, detail, ip) VALUES (?, ?, ?, ?, ?)').run(Date.now(), userId, action, detail.slice(0, 500), ip);
  }

  adminUsers(q: string) {
    const like = `%${q}%`;
    return this.db
      .prepare(
        `SELECT u.id, u.username, u.email, u.role, u.banned, u.created_at, p.elo, p.level,
          (SELECT COUNT(*) FROM match_players mp WHERE mp.user_id = u.id) AS matches
         FROM users u LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.username LIKE ? OR u.email LIKE ? ORDER BY u.id DESC LIMIT 200`,
      )
      .all(like, like);
  }

  adminMatches() {
    return this.db
      .prepare(
        `SELECT m.id, m.mode, m.map, m.winner, m.duration, m.ended_at,
          (SELECT GROUP_CONCAT(mp.name || CASE WHEN mp.bot THEN ' (IA)' ELSE '' END, ', ') FROM match_players mp WHERE mp.match_id = m.id) AS players
         FROM matches m ORDER BY m.ended_at DESC LIMIT 100`,
      )
      .all();
  }

  adminStats() {
    const one = <T>(sql: string, ...args: (string | number)[]) => this.db.prepare(sql).get(...args) as T;
    const all = <T>(sql: string, ...args: (string | number)[]) => this.db.prepare(sql).all(...args) as T[];
    const since = Date.now() - 7 * 86400000;
    return {
      users: one<{ n: number }>('SELECT COUNT(*) AS n FROM users').n,
      matches: one<{ n: number }>('SELECT COUNT(*) AS n FROM matches').n,
      byMode: all<{ mode: string; n: number }>('SELECT mode, COUNT(*) AS n FROM matches GROUP BY mode ORDER BY n DESC'),
      byMap: all<{ map: string; n: number }>('SELECT map, COUNT(*) AS n FROM matches GROUP BY map ORDER BY n DESC'),
      byClass: all<{ cls: string; n: number; wins: number }>(
        `SELECT cls, COUNT(*) AS n, SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins FROM match_players GROUP BY cls ORDER BY n DESC`,
      ),
      last7: all<{ day: string; n: number }>(
        `SELECT strftime('%Y-%m-%d', ended_at / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM matches WHERE ended_at >= ? GROUP BY day ORDER BY day`,
        since,
      ),
    };
  }
}

export function weekStart(t = Date.now()): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}
