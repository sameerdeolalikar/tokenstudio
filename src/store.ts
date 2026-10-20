import {
  existsSync,
  readFileSync,
  mkdirSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { analyze, type Theme } from "./core.js";
export type Revision = { revision: number; updated: string; document: Theme };
export type RecordItem = {
  id: string;
  revision: number;
  document: Theme;
  history: Revision[];
};
export class Conflict extends Error {}
export class Store {
  private records: Record<string, RecordItem>;
  constructor(private path: string) {
    this.records = existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, RecordItem>)
      : {};
    if (
      !this.records ||
      Array.isArray(this.records) ||
      typeof this.records !== "object"
    )
      throw new Error("Invalid local library.");
    for (const [id, r] of Object.entries(this.records)) {
      if (
        r.id !== id ||
        !Number.isInteger(r.revision) ||
        r.revision < 1 ||
        !Array.isArray(r.history)
      )
        throw new Error("Invalid saved theme.");
      analyze(r.document);
    }
  }
  list() {
    return Object.values(this.records)
      .map((r) => ({ id: r.id, title: r.document.title, revision: r.revision }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }
  get(id: string) {
    const r = Object.hasOwn(this.records, id) ? this.records[id] : undefined;
    if (!r) throw new Error("Theme not found.");
    return structuredClone(r);
  }
  save(raw: { id?: unknown; revision?: unknown; document?: unknown }) {
    const document = analyze(raw.document).theme;
    if (!Number.isInteger(raw.revision) || Number(raw.revision) < 0)
      throw new Error("Invalid revision.");
    let id: string;
    let history: Revision[] = [];
    if (raw.id) {
      if (typeof raw.id !== "string") throw new Error("Invalid project ID.");
      id = raw.id;
      const old = this.get(id);
      if (old.revision !== raw.revision)
        throw new Conflict(
          "This theme changed in another tab. Reopen it before saving.",
        );
      history = old.history;
    } else {
      if (raw.revision !== 0)
        throw new Error("New themes start at revision zero.");
      if (Object.keys(this.records).length >= 100)
        throw new Error("The library supports up to 100 themes.");
      id = randomUUID();
    }
    const revision = Number(raw.revision) + 1;
    const record: RecordItem = {
      id,
      revision,
      document,
      history: [
        ...history,
        { revision, updated: new Date().toISOString(), document },
      ].slice(-20),
    };
    const next = { ...this.records, [id]: record };
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = join(dirname(this.path), `.tokenstudio-${randomUUID()}.tmp`);
    let fd: number | undefined;
    try {
      fd = openSync(temp, "wx", 0o600);
      writeFileSync(fd, JSON.stringify(next, null, 2));
      fsyncSync(fd);
      closeSync(fd);
      fd = undefined;
      renameSync(temp, this.path);
    } finally {
      if (fd !== undefined) closeSync(fd);
      if (existsSync(temp)) unlinkSync(temp);
    }
    this.records = next;
    return structuredClone(record);
  }
}
