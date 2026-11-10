"""Saca los ejércitos de campo del jugador de una partida guardada (.save) de WH3.

Uso: python3 -I backend/scripts/partidas/leer_partida.py <partida.save> <salida.json>
Luego: node backend/scripts/partidas/a_planner.cjs <carpeta_json> frontend/public/partidas

Notas:
- Los ejércitos con general de tipo "colonel" son guarniciones de asentamientos: no se exportan.
- Por personaje: subtipo, rango, habilidades con su nivel, objetos/seguidores y rasgos.
- Por unidad: clave, modelos (o vida) actuales y máximos, experiencia y rango (0-9).
"""
import sys, os, struct, lzma, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import esf
sys.setrecursionlimit(100000)

def ch(n, name): return [k for k in n.kids if isinstance(k, esf.Node) and k.name == name]
def path(n, *names):
    for nm in names: n = ch(n, nm)[0]
    return n
def scal(n): return [x for x in n.kids if not isinstance(x, esf.Node)]

AGENTS = ('general', 'wizard', 'dignitary', 'runesmith', 'champion', 'engineer', 'spy', 'colonel')

def main(src, dst):
    d = open(src, 'rb').read()
    outer = esf.load(d)[0]
    hdr = ch(outer, 'SAVE_GAME_HEADER')[0]
    player = [x for x in hdr.kids if isinstance(x, str)][0]
    turn = scal(ch(hdr, 'DATE')[0])[0]
    cd = ch(outer, 'COMPRESSED_DATA')[0]
    data, info = cd.kids[0][1], cd.kids[1]
    raw = lzma.LZMADecompressor(format=lzma.FORMAT_ALONE).decompress(info.kids[1][1] + struct.pack('<Q', info.kids[0]) + data)
    del d, outer, data
    root = esf.load(raw)[0]; del raw
    env = path(root, 'CAMPAIGN_ENV')
    difficulty = next((x for x in env.kids if isinstance(x, str) and x in ('EASY', 'NORMAL', 'HARD', 'VERY_HARD', 'LEGENDARY')), None)
    world = path(env, 'CAMPAIGN_MODEL', 'WORLD')
    fa = None
    for f in path(world, 'FACTION_ARRAY').kids:
        x = ch(f, 'FACTION')[0]
        if player in [k for k in x.kids if isinstance(k, str)][:3]: fa = x; break
    if fa is None: raise SystemExit(f'No encontré la facción {player}')
    fms = {}
    for fm in ch(path(world, 'FAMILY_TREE'), 'FAMILY_MEMBER'):
        sc = scal(fm); cdl = ch(fm, 'CHARACTER_DETAILS')
        if cdl and sc and sc[0] not in fms: fms[sc[0]] = cdl[0]
    def details(fid):
        c = fms.get(fid)
        if c is None: return {}
        strs = [x for x in c.kids if isinstance(x, str)]
        sk = ch(c, 'CAMPAIGN_SKILLS')[0]; sks = scal(sk)
        skills = [list(it.kids) for it in ch(sk, 'CAMPAIGN_SKILLS_BLOCK')[0].kids]
        items = [a.kids[1] for a in ch(ch(c, 'ANCILLARY_MANAGER')[0], 'ANCILLARY')]
        tr = ch(c, 'TRAITS'); tr = ch(tr[0], 'TRAIT') if tr else []
        traits = [scal(it)[0] for it in tr[0].kids] if tr else []
        agent = next((s for s in strs if s in AGENTS), None)
        return {'agent': agent, 'subtype': strs[strs.index(agent) + 1] if agent else None, 'innate': sks[0],
                'rank': sks[4] if len(sks) > 4 else None, 'skills': skills, 'items': items, 'traits': traits}
    chars = {}
    for it in ch(fa, 'CHARACTER_ARRAY')[0].kids:
        sc = scal(it.kids[0])
        chars[sc[0]] = {'id': sc[0], 'fm': sc[2], 'type': sc[1], 'army': sc[3], 'embedded': sc[5]}
    armies = []
    for a in ch(fa, 'ARMY_ARRAY')[0].kids:
        mf = ch(a, 'MILITARY_FORCE')[0]
        aid, gid = mf.kids[0], mf.kids[1]
        gen = chars.get(gid)
        if not gen or gen['type'] != 'general': continue  # "colonel" = guarnición
        units = []
        for it in path(mf, 'UNIT_CONTAINER', 'UNITS_ARRAY').kids:
            u = it.kids[0]; sc = scal(u)
            units.append({'key': ch(u, 'UNIT_RECORD_KEY')[0].kids[0], 'hp': sc[1], 'max': sc[2], 'xp': sc[4], 'rank': sc[5]})
        heroes = [{**h, **details(h['fm'])} for h in chars.values() if h['embedded'] == aid and h['type'] != 'general']
        armies.append({'army': aid, 'general': {**gen, **details(gen['fm'])}, 'heroes': heroes, 'units': units})
    json.dump({'meta': {'player': player, 'turn': turn, 'difficulty': difficulty, 'save': os.path.basename(src)}, 'armies': armies},
              open(dst, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    for o in armies:
        g = o['general']
        print(g.get('subtype'), 'rango', g.get('rank'), '·', len(o['units']), 'unidades ·', [h.get('subtype') for h in o['heroes']])

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
