export type Kind = "color" | "dimension";
export type Token = { name: string; type: Kind; value: string };
export type Pair = {
  name: string;
  foreground: string;
  background: string;
  usage: "normal" | "large";
};
export type Theme = {
  version: 1;
  title: string;
  tokens: Token[];
  pairs: Pair[];
};
const namePattern = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;
const aliasPattern = /^\{([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*)\}$/;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 100;

export function parse(raw: unknown): Theme {
  if (!object(raw) || raw.version !== 1 || !text(raw.title))
    throw new Error("Expected a version 1 theme with a name.");
  if (
    !Array.isArray(raw.tokens) ||
    raw.tokens.length < 1 ||
    raw.tokens.length > 100
  )
    throw new Error("Use 1–100 tokens.");
  const names = new Set<string>();
  const tokens: Token[] = raw.tokens.map((t) => {
    if (
      !object(t) ||
      !text(t.name) ||
      !namePattern.test(t.name) ||
      names.has(t.name)
    )
      throw new Error(
        "Token names must be unique lowercase dotted names, such as color.ink.",
      );
    if ((t.type !== "color" && t.type !== "dimension") || !text(t.value))
      throw new Error(`Invalid type or value for ${t.name}.`);
    names.add(t.name);
    return { name: t.name, type: t.type, value: t.value.trim() };
  });
  if (!Array.isArray(raw.pairs) || raw.pairs.length > 30)
    throw new Error("Use at most 30 contrast pairs.");
  const pairs: Pair[] = raw.pairs.map((p) => {
    if (
      !object(p) ||
      !text(p.name) ||
      !text(p.foreground) ||
      !text(p.background) ||
      !["normal", "large"].includes(String(p.usage))
    )
      throw new Error("Invalid contrast pair.");
    return {
      name: p.name,
      foreground: p.foreground,
      background: p.background,
      usage: p.usage as Pair["usage"],
    };
  });
  return { version: 1, title: raw.title.trim(), tokens, pairs };
}

export function hex(value: string): string {
  if (/^#[0-9a-f]{3}$/i.test(value))
    return (
      "#" +
      [...value.slice(1)]
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error("Colors must be opaque #RGB or #RRGGBB hex values.");
  return value.toLowerCase();
}
export function luminance(value: string): number {
  const c = hex(value).slice(1);
  const channels = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function analyze(raw: unknown) {
  const theme = parse(raw);
  const tokens = new Map(theme.tokens.map((t) => [t.name, t]));
  const resolved: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  function resolve(name: string, stack: string[] = []): string {
    if (resolved[name] !== undefined) return resolved[name]!;
    const token = tokens.get(name);
    if (!token) throw new Error(`Unknown token: ${name}.`);
    if (stack.includes(name))
      throw new Error(`Circular reference: ${[...stack, name].join(" → ")}.`);
    const match = aliasPattern.exec(token.value);
    let value: string;
    if (match) {
      const other = tokens.get(match[1]!);
      if (!other) throw new Error(`Unknown reference in ${name}: ${match[1]}.`);
      if (other.type !== token.type)
        throw new Error(`Reference type mismatch in ${name}.`);
      value = resolve(other.name, [...stack, name]);
    } else if (token.type === "color") {
      value = hex(token.value);
    } else {
      if (
        !/^(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,2})?px$/.test(token.value) ||
        parseFloat(token.value) > 128
      )
        throw new Error(`Dimension ${name} must be between 0px and 128px.`);
      value = token.value;
    }
    resolved[name] = value;
    return value;
  }
  for (const token of theme.tokens) resolve(token.name);
  const checks = theme.pairs.map((pair) => {
    if (
      tokens.get(pair.foreground)?.type !== "color" ||
      tokens.get(pair.background)?.type !== "color"
    )
      throw new Error(
        `Contrast pair ${pair.name} must reference two color tokens.`,
      );
    const ratio = contrast(
      resolved[pair.foreground]!,
      resolved[pair.background]!,
    );
    const threshold = pair.usage === "large" ? 3 : 4.5;
    return {
      ...pair,
      ratio,
      threshold,
      pass: ratio >= threshold,
      aaa: ratio >= (pair.usage === "large" ? 4.5 : 7),
    };
  });
  return { theme, resolved, checks };
}
export function css(raw: unknown): string {
  const a = analyze(raw);
  return (
    ":root {\n" +
    a.theme.tokens
      .map((t) => `  --${t.name.replaceAll(".", "-")}: ${a.resolved[t.name]};`)
      .join("\n") +
    "\n}\n"
  );
}
export function compare(before: unknown, after: unknown) {
  const a = analyze(before),
    b = analyze(after);
  const x = new Map(a.theme.tokens.map((t) => [t.name, t])),
    y = new Map(b.theme.tokens.map((t) => [t.name, t]));
  return [...new Set([...x.keys(), ...y.keys()])].sort().flatMap((name) => {
    const old = x.get(name),
      next = y.get(name);
    const status = !old
      ? "added"
      : !next
        ? "removed"
        : JSON.stringify(old) !== JSON.stringify(next) ||
            a.resolved[name] !== b.resolved[name]
          ? "changed"
          : "unchanged";
    return status === "unchanged"
      ? []
      : [
          {
            name,
            status,
            before: old ?? null,
            after: next ?? null,
            resolvedBefore: a.resolved[name] ?? null,
            resolvedAfter: b.resolved[name] ?? null,
          },
        ];
  });
}
