"""Lector mínimo del formato ESF (cabecera CB AB) de las partidas guardadas de Total War: WARHAMMER III.

Formato (deducido leyendo los archivos):
- Bytes 12-16: posición de las tablas (nombres de nodo, cadenas UTF-16 y ASCII indexadas).
- Nodo: byte con bit 0x80; nombre = ((b & 1) << 8) | siguiente byte; versión = (b >> 1) & 0xf.
  Con bit 0x40 es un bloque: tamaño (varint), número de registros (varint) y cada registro con su tamaño.
  El tamaño del bloque cuenta desde después del número de registros.
- Varint: 7 bits por byte, el más significativo primero, bit alto = sigue.
- Valores: 0x01-0x10 de tamaño fijo, 0x12-0x1d compactos, 0x4x arreglos, 0x52-0x5d arreglos compactos.
- La partida real va en COMPRESSED_DATA (LZMA "alone"; propiedades y tamaño en COMPRESSED_DATA_INFO).
"""
import struct, sys

class R:
    def __init__(self, d, names, strs_u, strs_a):
        self.d, self.names, self.su, self.sa = d, names, strs_u, strs_a

def read_tables(d, off):
    p = off
    n = struct.unpack_from('<H', d, p)[0]; p += 2
    names = []
    for _ in range(n):
        l = struct.unpack_from('<H', d, p)[0]; p += 2
        names.append(d[p:p+l].decode('latin1')); p += l
    # utf16 strings: count, then (len, chars utf16, index u32)
    su = {}
    cnt = struct.unpack_from('<I', d, p)[0]; p += 4
    for _ in range(cnt):
        l = struct.unpack_from('<I', d, p)[0]; p += 4
        s = d[p:p+2*l].decode('utf-16-le'); p += 2*l
        idx = struct.unpack_from('<I', d, p)[0]; p += 4
        su[idx] = s
    sa = {}
    cnt = struct.unpack_from('<I', d, p)[0]; p += 4
    for _ in range(cnt):
        l = struct.unpack_from('<I', d, p)[0]; p += 4
        s = d[p:p+l].decode('latin1'); p += l
        idx = struct.unpack_from('<I', d, p)[0]; p += 4
        sa[idx] = s
    return names, su, sa

def varint(d, p):
    v = 0
    while True:
        b = d[p]; p += 1
        v = (v << 7) | (b & 0x7f)
        if not b & 0x80: return v, p


# ---- nodos ----
# Tamaño fijo de valores simples por código (ABCA)
FIX = {0x01: 1, 0x02: 1, 0x03: 2, 0x04: 4, 0x05: 8, 0x06: 1, 0x07: 2, 0x08: 4, 0x09: 8, 0x0a: 4, 0x0b: 8,
       0x0c: 8, 0x0d: 12, 0x0e: 4, 0x0f: 4, 0x10: 2,
       0x12: 0, 0x13: 0, 0x14: 0, 0x15: 0, 0x16: 1, 0x17: 2, 0x18: 3, 0x19: 0, 0x1a: 1, 0x1b: 2, 0x1c: 3, 0x1d: 0, 0x21: 4, 0x23: 1, 0x24: 2, 0x25: 4}

def val(d, p, t, r):
    n = FIX[t]
    b = d[p:p+n]
    if t == 0x01: v = b[0] != 0
    elif t in (0x12,): v = True
    elif t in (0x13,): v = False
    elif t in (0x14, 0x19, 0x1d): v = 0
    elif t == 0x15: v = 1
    elif t in (0x16, 0x17, 0x18): v = int.from_bytes(b, 'big')
    elif t in (0x1a, 0x1b, 0x1c): v = int.from_bytes(b, 'big', signed=True)
    elif t == 0x02: v = struct.unpack('<b', b)[0]
    elif t == 0x03: v = struct.unpack('<h', b)[0]
    elif t == 0x04: v = struct.unpack('<i', b)[0]
    elif t == 0x05: v = struct.unpack('<q', b)[0]
    elif t == 0x06: v = b[0]
    elif t == 0x07: v = struct.unpack('<H', b)[0]
    elif t == 0x08: v = struct.unpack('<I', b)[0]
    elif t == 0x09: v = struct.unpack('<Q', b)[0]
    elif t == 0x0a: v = struct.unpack('<f', b)[0]
    elif t == 0x0b: v = struct.unpack('<d', b)[0]
    elif t == 0x0c: v = struct.unpack('<2f', b)
    elif t == 0x0d: v = struct.unpack('<3f', b)
    elif t == 0x0e: v = r.su.get(struct.unpack('<I', b)[0], '?')
    elif t == 0x0f: v = r.sa.get(struct.unpack('<I', b)[0], '?')
    elif t == 0x10: v = struct.unpack('<H', b)[0]
    elif t in (0x21, 0x23, 0x24): v = ('x%x' % t, int.from_bytes(b, 'little'))
    elif t == 0x25: v = ('x25', struct.unpack('<I', b)[0])
    else: raise ValueError(hex(t))
    return v, p + n

ARR = {0x41: ('?', 1), 0x42: ('b', 1), 0x43: ('h', 2), 0x44: ('i', 4), 0x45: ('q', 8), 0x46: ('B', 1), 0x47: ('H', 2),
       0x48: ('I', 4), 0x49: ('Q', 8), 0x4a: ('f', 4), 0x4b: ('d', 8), 0x4c: ('2f', 8), 0x4d: ('3f', 12),
       0x4e: ('su', 4), 0x4f: ('sa', 4), 0x50: ('H', 2)}

class Node:
    __slots__ = ('name', 'ver', 'kids', 'vals')
    def __init__(s, name, ver): s.name, s.ver, s.kids, s.vals = name, ver, [], []

def parse(d, p, end, r, depth=0, items=None):
    """Lee nodos de [p, end): devuelve lista de (valor | Node)."""
    out = []
    while p < end:
        t = d[p]; p += 1
        if t & 0x80:
            if t & 0x20:  # info larga
                info = int.from_bytes(d[p-1:p+3], 'big'); p += 3
                ver = (info >> 21) & 0xff  # guess
                name = info & 0xffff
            else:
                b1 = d[p]; p += 1
                ver = (t >> 1) & 0xf
                name = ((t & 1) << 8) | b1
            nm = r.names[name] if name < len(r.names) else f'#{name}'
            if t & 0x40:  # bloque: lista de registros
                size, p = varint(d, p)
                cnt, p = varint(d, p)
                e = p + size
                n = Node(nm, ver)
                for _ in range(cnt):
                    sz, p = varint(d, p)
                    it = Node(nm + '[]', ver); it.kids = parse(d, p, p + sz, r, depth + 1); n.kids.append(it); p += sz
                p = e
                out.append(n)
            else:
                size, p = varint(d, p)
                n = Node(nm, ver); n.kids = parse(d, p, p + size, r, depth + 1); p += size
                out.append(n)
        elif t in FIX:
            v, p = val(d, p, t, r); out.append(v)
        elif 0x52 <= t <= 0x5d:
            size, p = varint(d, p); raw = d[p:p+size]; p += size
            w = FIX[t - 0x40]
            if w == 0: out.append(('arr', []))
            else:
                sg = t >= 0x5a
                out.append(('arr', [int.from_bytes(raw[i:i+w], 'big', signed=sg) for i in range(0, size, w)]))
        elif t in ARR:
            size, p = varint(d, p)
            fmt, w = ARR[t]
            raw = d[p:p+size]; p += size
            if fmt in ('su', 'sa'):
                tab = r.su if fmt == 'su' else r.sa
                out.append(('arr', [tab.get(x, '?') for x in struct.unpack(f'<{size//4}I', raw)]))
            elif fmt == 'B':
                out.append(('bytes', raw))
            else:
                k = size // w
                out.append(('arr', list(struct.unpack('<' + fmt * k if len(fmt) == 1 else '<' + fmt[1] * (k * int(fmt[0])), raw))))
        else:
            raise ValueError(f'tipo {t:#x} en {p-1}')
    return out

def load(d):
    off = struct.unpack_from('<I', d, 12)[0]
    names, su, sa = read_tables(d, off)
    r = R(d, names, su, sa)
    # Raíz: 4 bytes de info (registro, nombre 0) y tamaño
    size, p = varint(d, 20)
    root = Node(names[0], 0); root.kids = parse(d, p, p + size, r)
    return [root]

def show(nodes, depth=0, maxd=3, maxk=8):
    for x in nodes[:maxk] if depth else nodes:
        if isinstance(x, Node):
            print('  ' * depth + f'{x.name} v{x.ver} ({len(x.kids)})')
            if depth < maxd: show(x.kids, depth + 1, maxd, maxk)
        else:
            s = repr(x if not (isinstance(x, tuple) and x[0] == 'bytes') else ('bytes', len(x[1])))
            print('  ' * depth + s[:120])
