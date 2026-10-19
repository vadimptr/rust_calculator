export type IconKind = 'items' | 'ui' | 'build';

export type IconManifest = Record<IconKind, readonly string[]>;

const KINDS: readonly IconKind[] = ['items', 'ui', 'build'];

export function splitIconRef(ref: string): { kind: IconKind; name: string } {
  const i = ref.indexOf('/');
  const prefix = i < 0 ? '' : ref.slice(0, i);
  if ((KINDS as readonly string[]).includes(prefix)) {
    return { kind: prefix as IconKind, name: ref.slice(i + 1) };
  }
  return { kind: 'items', name: ref };
}

export function iconUrl(ref: string): string {
  const { kind, name } = splitIconRef(ref);
  return `/icons/${kind}/${name}.webp`;
}

export function hasIcon(manifest: IconManifest, ref: string): boolean {
  const { kind, name } = splitIconRef(ref);
  return manifest[kind].includes(name);
}
