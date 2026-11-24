"""Builds index.html from index.src.html, merging in the Missions Hub (../missions-site/index.html):
The Need's charts go into the Stats section, the NoPlaceLeft tools into Tools, and the books, sermons,
films and prayer into Resources. Family and Contact Us are left out. The Hub's styles are scoped to
.hub so they never touch the rest of the page, recoloured to the site palette (red only for the 10/40
Window and the unreached), and the six class names it shares with the design kit are renamed.

    python3 build-page.py        # after editing index.src.html or the Hub
"""
import pathlib, re

HERE = pathlib.Path(__file__).parent
hub = (HERE.parent / 'missions-site' / 'index.html').read_text()
page = (HERE / 'index.src.html').read_text()

def band_body(band_id):
    i = hub.index(f'<section id="{band_id}"'); i = hub.index('<div class="wrap body">', i) + len('<div class="wrap body">')
    j = hub.index('</div></section>', i)
    return hub[i:j]

css = hub[hub.index('<style>') + 7: hub.index('</style>')]
symbols = hub[hub.index('<svg width="0" height="0"'): hub.index('</svg>', hub.index('<svg width="0" height="0"')) + 6]
js = hub[hub.index('<script>\n// image path helper') + 8:]
js = js[:js.index('</script>')]
cut_a = js.index('(function(){\n  const panels=')
cut_c = js.index('(function(){', js.index('bioClose'))
js = js[:cut_a] + js[cut_c:]
js = js[:js.index("fill('familyGrid'")]
js = js.replace("`<h3>${g[0]}</h3>", "`<h4 class=\"hub-group\">${g[0]}</h4>")
# only ask for covers that exist (the rest go straight to their titled placeholder), and size every image
have = sorted(p.stem for p in (HERE / 'img' / 'covers').glob('*.jpg'))
js = js.replace("const cover=o.cover?", "const cover=o.cover&&HAVE_COVER.has(o.cover)?", 1)
js = 'const HAVE_COVER=new Set(' + repr(have).replace("'", '"') + ');\n' + js
js = js.replace('<img loading="lazy" src="${I(\'img/covers/\'+o.cover+\'.jpg\')}"', '<img loading="lazy" width="180" height="270" src="${I(\'img/covers/\'+o.cover+\'.jpg\')}"')
js = js.replace('<img loading="lazy" src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="">', '<img loading="lazy" width="480" height="360" src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="">')

bodies = {k: band_body(k) for k in ('stats', 'tools', 'books', 'sermons', 'media', 'prayer')}
bodies['prayer'] = bodies['prayer'].replace('<h3 style="margin-top:0">Unreached of the Day</h3>', '<h4 class="hub-group" style="margin-top:0">Unreached of the Day</h4>').replace('<h3>More ways to pray</h3>', '<h4 class="hub-group">More ways to pray</h4>')

# ---- rename the classes the Hub shares with the design kit
RENAME = {'card': 'h-card', 'grid': 'h-grid', 'tile': 'h-tile', 'dot': 'h-dot'}
def rename_attr(m):
    q, val = m.group(1), m.group(2)
    return 'class=' + q + re.sub(r'(?<![\w$-])(card|grid|tile|dot)(?![\w-])', lambda t: RENAME[t.group(1)], val) + q
def rename_markup(t):
    return re.sub(r'class=(\\?["\'])(.*?)\1', rename_attr, t)
js = rename_markup(js)
bodies = {k: rename_markup(v) for k, v in bodies.items()}
css = re.sub(r'\.(card|grid|tile|dot)(?![\w-])', lambda t: '.' + RENAME[t.group(1)], css)

# ---- palette
COLORS = {
    '#3987e5': '#6fa8dc', '#d95926': '#ff301a', '#199e70': '#1cb47f',
    '#b7d3f6': '#cfe0f5', '#6da7ec': '#6fa8dc', '#2a78d6': '#2f5fa8',
    '#2b4659': '#22325c', '#9a5b3c': '#5a2a2a', '#e0792b': '#a3301f', '#f2b134': '#d8301c', '#fff0a8': '#ff301a',
    '#14202b': '#111f45', '#2a3946': '#22325c', '#98a4ae': '#9fb0cf', '#c3c2b7': '#cdd6e8', '#f0efec': '#f2f2f2',
    '#0e1b25': '#0b1634', '#0e2231': '#0b1634', '#0b1620': '#0b1634', '#35566e': '#2a3d6b', '#f0a37f': '#ff8a7a',
    '#2f4352': '#2a3d6b', '#3b4b59': '#2a3d6b', '#2f4b60': '#2a3d6b', '#ffd98a': '#f3d9a4', '#ffb98a': '#f3d9a4',
}
def recolor(t):
    for a, b in COLORS.items(): t = re.sub(re.escape(a), b, t, flags=re.I)
    return t
css, js = recolor(css), recolor(js)
bodies = {k: recolor(v) for k, v in bodies.items()}
bodies['tools'] = bodies['tools'].replace('id="toolGrid"', 'id="toolGrid" data-more="4" data-more-noun="tools"')
bodies['books'] = bodies['books'].replace('<div id="bookGroups">', '<div id="bookGroups" data-more="2" data-more-noun="books">')
bodies['sermons'] = bodies['sermons'].replace('<div id="sermonGroups">', '<div id="sermonGroups" data-more="2" data-more-noun="sermons">')
bodies['media'] = bodies['media'].replace('<div id="mediaGroups">', '<div id="mediaGroups" data-more="2" data-more-cards="4" data-more-noun="videos and films">')
js = re.sub(r"const DARKTXT=c=>[^;]+;", "const DARKTXT=c=>c==='#ff301a'||c==='#cfe0f5'||c==='#6fa8dc'||c==='#1cb47f';", js)

# ---- scope every Hub rule to .hub (drop the parts that only served the Hub's own page)
DROP = re.compile(r'^(:root|\*|html|body|a|img|\.wrap|header\.top|\.hero|\.btn|\.band|\.banner|\.b-contact|\.b-family|\.team|\.person|\.general|dialog|footer|\.kicker|\.lead)\b')
KEEP_GLOBAL = re.compile(r'^\.vz-tip\b')
def scope_rules(text):
    out, i = [], 0
    while i < len(text):
        j = text.find('{', i)
        if j < 0: break
        head = text[i:j].strip()
        if head.startswith('@media') or head.startswith('@supports'):
            depth, k = 1, j + 1
            while depth: depth += {'{': 1, '}': -1}.get(text[k], 0); k += 1
            inner = scope_rules(text[j + 1:k - 1])
            if inner.strip(): out.append(f'{head}{{{inner}}}')
            i = k; continue
        if head.startswith('@keyframes'):
            depth, k = 1, j + 1
            while depth: depth += {'{': 1, '}': -1}.get(text[k], 0); k += 1
            out.append(text[i:k]); i = k; continue
        k = text.index('}', j)
        body = text[j + 1:k]
        sels = [s.strip() for s in re.sub(r'/\*.*?\*/', '', head, flags=re.S).split(',') if s.strip()]
        keep = []
        for s in sels:
            if KEEP_GLOBAL.match(s): keep.append(s)
            elif DROP.match(s): continue
            else: keep.append('.hub ' + s)
        if keep: out.append(', '.join(keep) + '{' + body + '}')
        i = k + 1
    return '\n'.join(out)
scoped = scope_rules(re.sub(r'/\*.*?\*/', '', css, flags=re.S))

theme = """
/* ---- the Hub inside the Seen & Heard page ---- */
.more__btn { margin-top: var(--s-6); }
.hub .h-card { border-radius: var(--r-lg); }
.hub .h-card .body { padding: var(--s-5) var(--s-5) var(--s-5); }
.hub .h-card h4 { font: 500 var(--t-card)/1.3 var(--font-text); letter-spacing: -.01em; margin: 0 0 var(--s-1); }
.hub .h-card p { font-size: 15px; line-height: 1.55; }
.hub .h-card .by { font-size: 14px; }
.hub .tag { text-transform: none; letter-spacing: 0; font: 500 var(--t-label)/1.2 var(--font-text); margin-bottom: var(--s-2); }
.hub .h-card .links a { font-weight: 500; font-size: 15px; }
.hub .vz-panel { border-radius: var(--r-lg); padding: clamp(18px, 2.4vw, 28px); }
.hub .vz-title { font: 500 var(--t-card)/1.3 var(--font-text); letter-spacing: -.01em; }
.hub .vz-h { font: var(--display-weight) 30px/1.15 var(--font-display) !important; letter-spacing: var(--display-tracking); margin: var(--s-9) 0 var(--s-2) !important; }
.hub .vz-hero b { font-weight: 400; letter-spacing: var(--display-tracking-xl); }
.hub .media, .hub .icon-panel, .hub .cover { border-radius: 0; }
.hub .h-grid { gap: var(--s-5); }
@media (max-width: 639px) {
  .hub .h-grid.books { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-3); }
  .hub .h-grid.books .h-card .body { padding: var(--s-3); }
  .hub .h-grid.books .h-card h4 { font-size: 16px; }
  .hub .h-grid.books .h-card p { font-size: 14px; }
  .hub .h-grid.books .btn-amz { font-size: 14px; padding: 0 10px; }
}
.hub { font-size: 16px; line-height: 1.6; }
.hub h3 { font-size: 20px; margin: 40px 0 14px; }
.hub .hub-group { font: 500 19px/1.3 var(--font-text); letter-spacing: var(--display-tracking); margin: var(--s-8) 0 var(--s-5); padding: 0; border: 0; }
.hub .note { font-size: 14px; opacity: .8; margin-top: 12px; }
.hub .note a { color: var(--accent); }
/* The Need, on the navy band */
.hub-band.b-stats { --vz-surface: #111f45; --vz-ink: #f2f2f2; --vz-ink2: #cdd6e8; --vz-muted: #9fb0cf; --vz-grid: #22325c;
  background: #0b1634; color: #f2f2f2; border-radius: var(--r-lg); padding: clamp(24px, 4vw, 56px); }
.hub .vz-panel { border-color: rgba(255,255,255,.08); }
.hub .vz-hero b { font-family: var(--font-display); font-weight: 400; color: #fff; }
.hub .vz-hero b:first-child { color: #ff6a55; }
.hub .vz-h { font-family: var(--font-display); font-weight: 400; }
.hub .callout { background: #1cb47f; color: #06231a; }
.hub .people svg { fill: #2a3d6b; }
.hub .people svg.on { fill: #ff301a; }
.hub .vz-hero div { border-left-color: rgba(255,255,255,.15); }
/* tools, on the page's dark ground */
.hub .hub-band.b-tools { background: none; color: inherit; }
.hub-band.b-tools .h-card { background: #161b2b; color: #f2f2f2; border: 1px solid rgba(255,255,255,.08); box-shadow: none; }
.hub-band.b-tools .h-card .by, .hub-band.b-tools .h-card p { color: #cdd6e8; }
.hub-band.b-tools .tag { color: #8fc1ff; }
.hub-band.b-tools .h-card .links a { color: #3fd29c; }
.hub-band.b-tools .icon-panel { background: linear-gradient(135deg, #0b1634, #123d52); }
/* resources, in the same dark card style as the tools */
.hub-band.b-res .h-card { background: #161b2b; color: #f2f2f2; border: 1px solid rgba(255,255,255,.08); box-shadow: none; }
.hub-band.b-res .h-card .by, .hub-band.b-res .h-card p { color: #cdd6e8; }
.hub-band.b-res .tag { color: #8fc1ff; }
.hub-band.b-res .h-card .links a { color: #3fd29c; }
.hub-band.b-res .btn-amz { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; background: transparent; color: #f2f2f2; border: 1px solid rgba(255,255,255,.24); text-decoration: none; font-weight: 500; font-size: 15px; padding: 0 16px; border-radius: 999px; }
.hub-band.b-res .btn-amz:hover { background: #1cb47f; color: #06231a; border-color: #1cb47f; }
.hub-band.b-res .cover { background: #1f2638; }
.hub-band.b-res .cover .ph { background: linear-gradient(160deg, #13265a, #0b1634); }
.hub-band.b-res .icon-panel { background: linear-gradient(135deg, #0b1634, #123d52); }
.hub-band.b-res .b-sermons-in .h-card { border-top: 1px solid rgba(255,255,255,.08); }
.hub-band.b-res .uotd { border: 1px solid rgba(255,255,255,.1); box-shadow: none; border-radius: var(--r-lg); }
.hub-band.b-res .uotd-head { background: #161b2b; border-bottom-color: rgba(255,255,255,.08); }
.hub-band.b-res .uotd-head strong { color: #f2f2f2; }
.hub-band.b-res .uotd-head a { color: #3fd29c !important; }
.hub-band.b-res .uotd-note { background: #161b2b; color: #9fb0cf; border-top-color: rgba(255,255,255,.08); }
.hub-band.b-res .uotd-note a { color: #3fd29c !important; }
.hub-band.b-res .media .play span { background: rgba(0,0,0,.6); }
.hub .media:hover .play span { background: #1cb47f; }
"""

def panel_at(t, start):
    """the whole <div class="vz-panel"> that begins at start (balanced divs)"""
    depth, i = 0, start
    for m in re.finditer(r'<div\b|</div>', t[start:]):
        depth += 1 if m.group(0) == '<div' else -1
        if depth == 0: return t[start:start + m.end()]
    raise ValueError('unbalanced')
st = bodies['stats']
h3s = [m.start() for m in re.finditer(r'<h3 class="vz-h"', st)]
imb_h3 = st.index('The imbalance')
imb_start = st.index('<div class="vz-panel', imb_h3)
imb_panel = panel_at(st, imb_start)
st = st[:imb_start] + st[imb_start + len(imb_panel):]
h3s = [m.start() for m in re.finditer(r'<h3 class="vz-h"', st)]
open_part, rest_part = st[:h3s[1]], st[h3s[1]:]
n_charts = len(re.findall(r'class="vz-title"', bodies['stats']))
stats_body = (open_part + imb_panel +
              f'<div class="more__rest" id="more-charts" hidden>{rest_part}</div>'
              f'<button class="btn btn--secondary more__btn" type="button" data-more-for="more-charts" data-more-close="Show fewer charts">See all {n_charts} charts</button>')
bodies['stats'] = stats_body
stats_html = f'<div class="hub" id="need"><div class="hub-band b-stats">{symbols}{bodies["stats"]}</div></div>'
tools_html = ('<div class="hub"><div class="hub-band b-tools"><h3 class="hub-h" id="noplaceleft">Tools from NoPlaceLeft</h3>'
              '<p class="hub-intro">Simple tools anyone can learn and teach. Tap a video to watch it here.</p>'
              + bodies['tools'] + '</div></div>')
res_html = ('<div class="hub"><div class="hub-band b-res">'
            '<h3 class="hub-h" id="books">Books</h3><p class="hub-intro">Each book links to Amazon so you can pick up a copy.</p>' + bodies['books'] +
            '<div class="b-sermons-in"><h3 class="hub-h" id="sermons">Sermons</h3><p class="hub-intro">Messages on God\'s heart for the nations.</p>' + bodies['sermons'] + '</div>'
            '<h3 class="hub-h" id="films">Videos and films</h3><p class="hub-intro">Tap a thumbnail to play it on this page.</p>' + bodies['media'] +
            '<h3 class="hub-h" id="prayer">Pray for the nations</h3><p class="hub-intro">Prayer is where missions begins.</p>' + bodies['prayer'] +
            '</div></div>')

out = (page.replace('<!--HUB:css-->', f'<style>{scoped}\n{theme}</style>')
           .replace('<!--HUB:stats-->', stats_html)
           .replace('<!--HUB:tools-->', tools_html)
           .replace('<!--HUB:resources-->', res_html)
           .replace('<!--HUB:js-->', '<script>/* the Hub script runs on every page; parts whose section is on another page get a detached stand-in */\n'
                     '(function (document) {' + js + '\n})(new Proxy(window.document, { get(t, k) { if (k === "getElementById") return id => t.getElementById(id) || t.createElement("div"); const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } }));</script>'))
assert '<!--HUB:' not in out
# version stamps on the page's own files, so a change is never hidden behind a cached copy
import hashlib
def stamp(m):
    f = HERE / m.group(2)
    v = hashlib.sha1(f.read_bytes()).hexdigest()[:8] if f.exists() else '0'
    return f'{m.group(1)}{m.group(2)}?v={v}"'
out = re.sub(r'((?:src|href)=")(art/[\w.-]+\.(?:js|css))"', stamp, out)
# ---- one source, four pages: each keeps its own sections, its own title and an h1 of its own
PAGES = {
    'index': dict(file='index.html', keep=['hero'], h1=None,
                  title='Seen &amp; Heard: an evangelism app for everyday believers',
                  desc='Learn a simple way to share the gospel, plan how it spreads where you live, and pray for the people groups who have not heard.'),
    'globe': dict(file='globe.html', keep=['window'], h1='window',
                  title='The 10/40 globe: Seen &amp; Heard',
                  desc='Explore every country by the share of its people in unreached groups, then meet the people groups of any country in the 10/40 Window.'),
    'need': dict(file='need.html', keep=['stats'], h1='stats',
                 title='The need in numbers: Seen &amp; Heard',
                 desc='Where the 3.6 billion people in unreached people groups live, and where missionaries and giving go, in charts from Joshua Project data.'),
    'tools': dict(file='tools.html', keep=['tools'], h1='tools',
                  title='Tools for sharing the gospel: Seen &amp; Heard',
                  desc='Simple tools to share the gospel and plan its spread where you live, from the Seen &amp; Heard app and NoPlaceLeft.'),
    'resources': dict(file='resources.html', keep=['resources'], h1='resources',
                      title='Missions resources: Seen &amp; Heard',
                      desc='Videos, books, sermons, films and ways to pray for the nations, in one library.'),
}
main_open = out.index('<main id="top">') + len('<main id="top">')
main_close = out.index('</main>')
inner = out[main_open:main_close]
blocks = {}
for m in re.finditer(r'\n  <section\b[^>]*?(?:class="([^"]*)")?[^>]*?(?:id="([^"]*)")?[^>]*>', inner):
    pass
# split the main into its top-level sections (they open and close at two spaces of indent)
starts = [m.start() for m in re.finditer(r'\n  <section\b', inner)]
for k, st in enumerate(starts):
    end = inner.index('\n  </section>', st) + len('\n  </section>')
    tag = inner[st:inner.index('>', st) + 1]
    m_id = re.search(r'id="([^"]+)"', tag); m_cls = re.search(r'class="([^"]+)"', tag)
    key = m_id.group(1) if m_id else ('hero' if m_cls and 'hero' in m_cls.group(1) else f'sec{k}')
    blocks[key] = inner[st:end]
missing = [k for P in PAGES.values() for k in P['keep'] if k not in blocks]
assert not missing, missing
for name, P in PAGES.items():
    page = out[:main_open] + ''.join('\n' + blocks[k].lstrip('\n') + '\n' for k in P['keep']) + out[main_close:]
    page = re.sub(r'<title>.*?</title>', f'<title>{P["title"]}</title>', page, count=1)
    page = page.replace('<link rel="canonical" href="https://jtliner925.github.io/seen-and-heard/">', f'<link rel="canonical" href="https://jtliner925.github.io/seen-and-heard/{"" if name == "index" else P["file"]}">')
    page = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda m: m.group(1) + P['desc'] + m.group(2), page, count=1)
    page = re.sub(r'(<meta property="og:title" content=")[^"]*(")', lambda m: m.group(1) + P['title'] + m.group(2), page, count=1)
    # the current page in the nav
    page = page.replace(f'data-page="{name}">', f'data-page="{name}" aria-current="page">', 1) if name != 'index' else page
    if P['h1']:
        sec = blocks[P['h1']]
        h = re.search(r'<h2\b([^>]*)>(.*?)</h2>', sec, re.S)
        page = page.replace(h.group(0), f'<h1{h.group(1)}>{h.group(2)}</h1>', 1)
        page = re.sub(r'<link rel="modulepreload" href="assets/moments/[^"]*">\n?', '', page)
    # each page loads only the art it shows: the dot map on the landing page, the 3D globe on the globe page
    if 'window' not in P['keep']:
        page = re.sub(r'<script type="importmap">.*?</script>\n?', '', page, flags=re.S)
        page = re.sub(r'<script type="module" src="art/globe\.js[^"]*"></script>\n?', '', page)
    if 'hero' not in P['keep']:
        page = re.sub(r'<script src="art/(?:hero|mustard-seed|reveal)\.js[^"]*" defer></script>\n?', '', page)
    if 'hero' not in P['keep'] and 'window' not in P['keep']:
        page = re.sub(r'<script src="art/land\.js[^"]*" defer></script>\n?', '', page)
    (HERE / P['file']).write_text(page)
    print('wrote', P['file'], len(page), 'bytes')
