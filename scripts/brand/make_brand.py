"""
Generates SocialSpace's icons from the SVG mark below, using headless Chrome to rasterise
and Pillow to resize / pack. Run from the repo root:  python scripts/brand/make_brand.py
Needs: Google Chrome, Pillow. Output paths: app/icon.svg, app/favicon.ico, app/apple-icon.png,
public/icon-192x192.png, public/icon-512x512.png, public/icon-maskable-512x512.png.
"""
import os, shutil, subprocess, sys, tempfile
from PIL import Image

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
INK, PAPER, TOMATO, TEAL = "#231F1A", "#F4EDE0", "#E4572E", "#2F7F79"

# Two people (you in tomato, your friend in teal) sitting either side of a small table, in a 64x64 box.
MARK = f"""
  <rect x="21" y="38" width="22" height="6" rx="2" fill="{INK}"/>
  <rect x="25" y="44" width="5" height="12" fill="{INK}"/>
  <rect x="34" y="44" width="5" height="12" fill="{INK}"/>
  <rect x="7" y="31" width="19" height="25" rx="9" fill="{TOMATO}" stroke="{INK}" stroke-width="3.2"/>
  <circle cx="16.5" cy="20" r="8.5" fill="#FFFDF7" stroke="{INK}" stroke-width="3.2"/>
  <rect x="38" y="31" width="19" height="25" rx="9" fill="{TEAL}" stroke="{INK}" stroke-width="3.2"/>
  <circle cx="47.5" cy="20" r="8.5" fill="#FFFDF7" stroke="{INK}" stroke-width="3.2"/>
"""

def framed():  # rounded paper tile with an ink border: favicon and "any" icons
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>SocialSpace</title>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="{PAPER}" stroke="{INK}" stroke-width="3.5"/>{MARK}</svg>
"""

def full_bleed(scale):  # paper everywhere, mark centred at `scale` of the canvas: apple-touch and maskable
    s = 64 * scale
    o = (64 - s) / 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="{PAPER}"/>
  <svg x="{o}" y="{o}" width="{s}" height="{s}" viewBox="0 0 64 64">{MARK}</svg></svg>
"""

def render(svg, px, out, transparent=True):
    with tempfile.TemporaryDirectory() as d:
        html = os.path.join(d, "r.html")
        sized = svg.replace("<svg ", '<svg width="%d" height="%d" ' % (px, px), 1)
        open(html, "w", encoding="utf8").write(
            "<!doctype html><body style='margin:0;background:transparent'>" + sized)
        shot = os.path.join(d, "s.png")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--default-background-color=00000000", f"--screenshot={shot}", f"--window-size={px},{px}",
                        "file:///" + html.replace("\\", "/")], check=True, capture_output=True, timeout=90)
        im = Image.open(shot).convert("RGBA")
        if im.size != (px, px):
            im = im.crop((0, 0, px, px))
        im.save(out)
        return im


S = 'stroke="#231F1A" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"'
TAN, MUSTARD, SURFACE = "#D9B382", "#E0A526", "#FFFDF7"

def chair(color):
    return f"""<rect x="12" y="116" width="9" height="30" rx="2" fill="{TAN}" {S}/><rect x="64" y="116" width="9" height="30" rx="2" fill="{TAN}" {S}/>
<rect x="8" y="40" width="11" height="80" rx="3" fill="{TAN}" {S}/><rect x="8" y="106" width="68" height="12" rx="3" fill="{TAN}" {S}/>
<rect x="26" y="60" width="42" height="48" rx="16" fill="{color}" {S}/><circle cx="47" cy="38" r="17" fill="{SURFACE}" {S}/>
<circle cx="42" cy="37" r="2" fill="{INK}" stroke="none"/><circle cx="53" cy="37" r="2" fill="{INK}" stroke="none"/><path d="M42 45q5.5 4 11 0" fill="none" {S} stroke-width="2.2"/>"""

def scene():
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 300" width="620" height="357">
<path d="M260 0v44" {S}/><path d="M222 86q0-42 38-42t38 42z" fill="{MUSTARD}" {S}/>
<svg x="118" y="112" width="76" height="76" viewBox="0 0 64 64"><rect x="14" y="9" width="37" height="47" rx="3" fill="{SURFACE}" {S}/><rect x="14" y="9" width="37" height="9" rx="3" fill="{MUSTARD}" {S}/><path d="M21 28h23M21 36h23M21 44h14" {S} stroke-width="2.5"/></svg>
<svg x="198" y="110" width="76" height="76" viewBox="0 0 64 64"><rect x="8" y="13" width="48" height="40" rx="3" fill="{TAN}" {S}/><rect x="14" y="19" width="36" height="28" rx="2" fill="{SURFACE}" {S} stroke-width="2.5"/><path d="M19 40q6-15 12-3t13-6" fill="none" stroke="{TOMATO}" stroke-width="3.5" stroke-linecap="round"/><circle cx="42" cy="27" r="3.5" fill="{TEAL}"/></svg>
<svg x="278" y="108" width="80" height="80" viewBox="0 0 64 64"><path d="M22 18l10-9 10 9" fill="none" {S} stroke-width="2.5"/><rect x="7" y="18" width="50" height="35" rx="5" fill="{TEAL}" {S}/><rect x="12" y="23" width="31" height="25" rx="3" fill="{SURFACE}" {S} stroke-width="2.5"/><circle cx="50" cy="29" r="2.5" fill="{SURFACE}"/><circle cx="50" cy="39" r="2.5" fill="{SURFACE}"/><path d="M16 53v4M48 53v4" {S}/></svg>
<svg x="364" y="114" width="72" height="72" viewBox="0 0 64 64"><rect x="9" y="36" width="46" height="19" rx="5" fill="{TOMATO}" {S}/><circle cx="32" cy="45.5" r="5" fill="{SURFACE}" {S} stroke-width="2.5"/><rect x="10" y="19" width="44" height="12" rx="6" fill="{INK}" {S}/><path d="M17 31v5M47 31v5" {S}/></svg>
<rect x="92" y="180" width="336" height="22" rx="5" fill="{TAN}" {S}/><rect x="116" y="202" width="14" height="82" rx="2" fill="{TAN}" {S}/><rect x="390" y="202" width="14" height="82" rx="2" fill="{TAN}" {S}/>
<path d="M20 292h480" {S} stroke-width="2.5"/>
<svg x="4" y="138" width="92" height="150" viewBox="0 0 92 150">{chair(TOMATO)}</svg>
<g transform="translate(516 0) scale(-1 1)"><svg x="4" y="138" width="92" height="150" viewBox="0 0 92 150">{chair(TEAL)}</svg></g>
</svg>"""

def og(out):
    mark = framed().replace("<svg ", '<svg width="104" height="104" ', 1)
    html = f"""<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500&family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,700,100,1;1,9..144,600,100,1&display=swap">
<style>
 html,body{{margin:0;width:1200px;height:630px;background:{PAPER};overflow:hidden}}
 .wrap{{position:relative;width:1200px;height:630px;border:0}}
 .brand{{position:absolute;left:72px;top:96px;display:flex;align-items:center;gap:26px}}
 .word{{font-family:'Fraunces',Georgia,serif;font-weight:700;font-size:92px;letter-spacing:-1px;color:{INK};font-variation-settings:'SOFT' 100,'WONK' 1}}
 .tag{{position:absolute;left:72px;top:262px;font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:600;font-size:72px;line-height:1.1;color:{INK};font-variation-settings:'SOFT' 100,'WONK' 1}}
 .tag b{{color:#B8401E;font-weight:600}}
 .sub{{position:absolute;left:76px;top:470px;font-family:'DM Sans',system-ui,sans-serif;font-size:32px;color:#6B6257;line-height:1.35}}
 .scene{{position:absolute;left:545px;top:200px}}
 .bar{{position:absolute;left:0;right:0;bottom:0;height:18px;background:{INK}}}
</style>
<div class="wrap">
 <div class="brand">{mark}<span class="word">SocialSpace</span></div>
 <div class="tag">A <b>table</b><br>for two</div>
 <div class="sub">Talk, chat, draw and<br>watch together.</div>
 <div class="scene">{scene()}</div>
 <div class="bar"></div>
</div>"""
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, "og.html")
        open(f, "w", encoding="utf8").write(html)
        shot = os.path.join(d, "og.png")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--virtual-time-budget=8000", f"--screenshot={shot}", "--window-size=1200,630",
                        "file:///" + f.replace("\\", "/")], check=True, capture_output=True, timeout=120)
        im = Image.open(shot).convert("RGB")
        im = im.crop((0, 0, 1200, 630))
        im.save(out, optimize=True)

def main():
    app, pub = os.path.join(ROOT, "app"), os.path.join(ROOT, "public")
    open(os.path.join(app, "icon.svg"), "w", encoding="utf8").write(framed())
    big = render(framed(), 1024, os.path.join(tempfile.gettempdir(), "ss_big.png"))
    print("corner alpha (expect 0):", big.getpixel((2, 2))[3])
    for px in (192, 512):
        big.resize((px, px), Image.LANCZOS).save(os.path.join(pub, f"icon-{px}x{px}.png"))
    full = render(full_bleed(0.80), 1024, os.path.join(tempfile.gettempdir(), "ss_full.png")).convert("RGB")
    full.resize((180, 180), Image.LANCZOS).save(os.path.join(app, "apple-icon.png"))
    mask = render(full_bleed(0.58), 1024, os.path.join(tempfile.gettempdir(), "ss_mask.png")).convert("RGB")
    mask.resize((512, 512), Image.LANCZOS).save(os.path.join(pub, "icon-maskable-512x512.png"))
    # favicon.ico: 16 / 32 / 48, RGBA
    sizes = [16, 32, 48]
    imgs = [big.resize((s, s), Image.LANCZOS) for s in sizes]
    imgs[-1].save(os.path.join(app, "favicon.ico"), format="ICO", sizes=[(s, s) for s in sizes], append_images=imgs[:-1])
    og(os.path.join(app, "opengraph-image.png"))
    shutil.copyfile(os.path.join(app, "opengraph-image.png"), os.path.join(app, "twitter-image.png"))
    print("done")

if __name__ == "__main__":
    sys.exit(main())
