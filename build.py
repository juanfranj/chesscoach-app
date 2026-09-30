#!/usr/bin/env python3
"""Builds the static site in docs/ from the bilingual sources in src/.

The pages in src/ are written once, with every translatable element carrying
data-en / data-es (and data-en-alt / data-en-label for alt and aria-label).
Google indexes one language per URL, so instead of swapping text with
JavaScript this writes two plain HTML pages per source page:

    docs/<page>.html      English (x-default)
    docs/es/<page>.html   Spanish

Each one gets its own <title>, description, canonical, hreflang alternates
and Open Graph tags, and the EN/ES toggle becomes a pair of links.
Standard library only. Run it, then check.py, then commit docs/.
"""
import html
import json
import os
import re
import shutil
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'docs')
SITE = 'https://chesscoach-app.com'
DOMAIN = 'chesscoach-app.com'
LANG_KEY = 'cheescoach-lang'   # where a visitor's EN/ES choice is kept, per origin
OG_IMAGE = SITE + '/images/og-card.jpg'

# (title, description) per page and language.
META = {
    'index': {
        'en': ('Chess Coach: AI chess coach app that explains your mistakes',
               'Play, then find out what went wrong: the engine on your phone calculates and an AI coach '
               'explains it. Openings, endgames and calculation training.'),
        'es': ('Chess Coach: entrenador de ajedrez con IA que analiza tus partidas',
               'Juega y descubre qué falló: el motor de tu móvil calcula y un coach con IA te lo explica. '
               'Aperturas, finales y cálculo en iPhone y Android.'),
    },
    'api-setup': {
        'en': ('Set up an AI provider — Chess Coach',
               'Which AI provider to connect to Chess Coach, what it costs per analysis, and how to get an API key.'),
        'es': ('Configura un proveedor de IA — Chess Coach',
               'Qué proveedor de IA conectar a Chess Coach, cuánto cuesta cada análisis y cómo conseguir una API key.'),
    },
    'openai-setup': {
        'en': ('OpenAI API key setup — Chess Coach',
               'Step-by-step guide to create an OpenAI API key and use it in Chess Coach.'),
        'es': ('Cómo crear una API key de OpenAI — Chess Coach',
               'Guía paso a paso para crear una API key de OpenAI y usarla en Chess Coach.'),
    },
    'deepseek-setup': {
        'en': ('DeepSeek API key setup — Chess Coach',
               'Step-by-step guide to create a DeepSeek API key, add funds and use it in Chess Coach.'),
        'es': ('Cómo crear una API key de DeepSeek — Chess Coach',
               'Guía paso a paso para crear una API key de DeepSeek, añadir saldo y usarla en Chess Coach.'),
    },
    'gemini-setup': {
        'en': ('Google Gemini API key setup — Chess Coach',
               'Step-by-step guide to create a Google Gemini API key and use it in Chess Coach.'),
        'es': ('Cómo crear una API key de Google Gemini — Chess Coach',
               'Guía paso a paso para crear una API key de Google Gemini y usarla en Chess Coach.'),
    },
    'claude-setup': {
        'en': ('Anthropic Claude API key setup — Chess Coach',
               'Step-by-step guide to create an Anthropic Claude API key and use it in Chess Coach.'),
        'es': ('Cómo crear una API key de Anthropic Claude — Chess Coach',
               'Guía paso a paso para crear una API key de Anthropic Claude y usarla en Chess Coach.'),
    },
    'qwen-setup': {
        'en': ('Qwen API key setup — Chess Coach',
               'Step-by-step guide to create a Qwen API key in Alibaba Cloud Model Studio and use it in Chess Coach.'),
        'es': ('Cómo crear una API key de Qwen — Chess Coach',
               'Guía paso a paso para crear una API key de Qwen en Alibaba Cloud Model Studio y usarla en Chess Coach.'),
    },
    'privacy-policy': {
        'en': ('Privacy policy — Chess Coach',
               'How Chess Coach handles your data: what stays on your device, what is sent and why, and how to '
               'delete your account.'),
        'es': ('Política de privacidad — Chess Coach',
               'Cómo trata Chess Coach tus datos: qué se queda en tu dispositivo, qué se envía y por qué, y cómo '
               'borrar tu cuenta.'),
    },
    'ai-chess-coach': {
        'slug': {'es': 'analizar-partidas-de-ajedrez'},
        'en': ('AI chess coach app: find out what went wrong | Chess Coach',
               'Analyse your chess games with the engine on your phone and an AI coach that explains every '
               'mistake in plain words, for your rating. iPhone, iPad and Android.'),
        'es': ('Analizar partidas de ajedrez con IA: qué falló y por qué',
               'Analiza tus partidas con el motor de tu móvil y un coach con IA que te explica cada error en '
               'palabras claras y para tu nivel. iPhone, iPad y Android.'),
    },
    'chess-opening-trainer': {
        'slug': {'es': 'entrenador-de-aperturas'},
        'en': ('Chess opening trainer app with spaced repetition | Chess Coach',
               'Learn chess openings with spaced repetition, then play the same lines against Maia, a rival '
               'that moves like a club player. The Italian Game is free.'),
        'es': ('App para aprender aperturas de ajedrez con repetición espaciada',
               'Aprende aperturas con repetición espaciada y juega esas líneas contra Maia, un rival que juega '
               'como un jugador de club. La Italiana es gratis.'),
    },
    'woodpecker-method': {
        'slug': {'es': 'metodo-pajaro-carpintero'},
        'en': ('The Woodpecker method: how to do it, and an app for it',
               'The Woodpecker method explained: the set, the seven cycles from 28 days to one, and an app that '
               'runs them for you with two sets of 150 positions.'),
        'es': ('Método del pájaro carpintero en ajedrez: qué es y cómo hacerlo',
               'El método del pájaro carpintero explicado: el set, los siete ciclos de 28 días a uno y una app '
               'que los lleva por ti con dos sets de 150 posiciones.'),
    },
    'essential-chess-endgames': {
        'slug': {'es': 'finales-de-ajedrez'},
        'en': ('Essential chess endgames: the 100 to know and how to practise',
               'The 100 essential chess endgames by family: king and pawn, rook, queen, bishop and knight. '
               'Which win, which draw, and how to practise them.'),
        'es': ('Finales de ajedrez que hay que saber: los 100 básicos',
               'Los 100 finales básicos de ajedrez por familias: rey y peones, torre, dama, alfil y caballo. '
               'Cuáles ganan, cuáles son tablas y cómo practicarlos.'),
    },
    'open-source': {
        'en': ('Open source and corresponding source — Chess Coach',
               'Open-source licences and the GPLv3 corresponding-source offer for the chess engines distributed '
               'with Chess Coach.'),
    },
}
BILINGUAL = [p for p in META if 'es' in META[p]]
ENGLISH_ONLY = [p for p in META if 'es' not in META[p]]
ASSETS = ['css', 'js', 'images', 'app_icon_chesscoach.png']
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


def page_file(page, lang='en'):
    """The published file name. A page can have its own Spanish slug (META[page]['slug']['es']),
    because the words in a URL are words people search for."""
    return META[page].get('slug', {}).get(lang, page) + '.html'


def abs_url(page, lang):
    path = '' if page == 'index' else page_file(page, lang)
    return f'{SITE}/{"es/" if lang == "es" else ""}{path}'


def rel_link(page, from_lang, to_lang):
    """Relative link from a page in one language to the same page in another."""
    name = '' if page == 'index' else page_file(page, to_lang)
    if from_lang == to_lang:
        return name or './'
    return ('es/' + name) if to_lang == 'es' else ('../' + name)


class Translatables(HTMLParser):
    """Finds the source ranges of every element that carries data-en."""

    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.line_starts = [0]
        for m in re.finditer('\n', text):
            self.line_starts.append(m.end())
        self.stack = []      # (tag, is_translatable, start, start_tag_end, attrs)
        self.found = []      # (start, start_tag_end, content_end, attrs)

    def abs_pos(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self.abs_pos()
        end = start + len(self.get_starttag_text())
        a = dict(attrs)
        if tag in VOID:
            return
        self.stack.append((tag, 'data-en' in a, start, end, a))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        pos = self.abs_pos()
        while self.stack:
            t, translatable, start, end, a = self.stack.pop()
            if t == tag:
                if translatable:
                    self.found.append((start, end, pos, a))
                return
            if translatable:
                # Implicitly closed (<li> or <p> without its end tag): its text would stay in English.
                raise ValueError(f'<{t}> with data-en at offset {start} is never closed')
        raise ValueError(f'unmatched </{tag}> at offset {pos}')


def translate(text, lang, name):
    """Puts each data-en element's text in `lang`, like the old applyLang did."""
    parser = Translatables(text)
    parser.feed(text)
    parser.close()
    if parser.stack and any(t[1] for t in parser.stack):
        raise ValueError(f'{name}: a data-en element is never closed')
    found = sorted(parser.found)
    for (s1, _, e1, _), (s2, _, _, _) in zip(found, found[1:]):
        if s2 < e1:
            raise ValueError(f'{name}: nested data-en elements at offset {s2}')
    out, last = [], 0
    for start, tag_end, content_end, attrs in found:
        value = attrs.get('data-' + lang)
        if value is None:
            raise ValueError(f'{name}: element at {start} has no data-{lang}')
        out.append(text[last:start])
        out.append(rebuild_tag(text[start:tag_end], lang))
        out.append(value)
        last = content_end
    out.append(text[last:])
    text = ''.join(out)

    def fix_tag(m):
        return rebuild_tag(m.group(0), lang)

    # Tags left with data-*: images (alt) and landmarks (aria-label). Their values hold no < or >.
    return re.sub(r'<[a-zA-Z][^<>]*\sdata-(?:en|es)[^<>]*>', fix_tag, text)


ATTR = re.compile(r'\s+([^\s=>/]+)(?:\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+))?')


def rebuild_tag(tag, lang):
    """Rewrites one start tag: applies data-<lang>-alt/-label and drops every data-en*/data-es*.

    Quote-aware, because data-en values can contain markup such as <strong>."""
    m = re.match(r'<([a-zA-Z][\w-]*)', tag)
    name, rest = m.group(1), tag[m.end():]
    closing = '/>' if rest.rstrip().endswith('/>') else '>'
    attrs = [(a.group(1), a.group(2)) for a in ATTR.finditer(rest)]
    values = dict(attrs)
    swaps = {'alt': values.get(f'data-{lang}-alt'), 'aria-label': values.get(f'data-{lang}-label')}
    kept, seen = [], set()
    for key, val in attrs:
        if re.match(r'data-(?:en|es)(?:-alt|-label)?$', key):
            continue
        if key in swaps and swaps[key] is not None:
            val = swaps[key]
        seen.add(key)
        kept.append(key if val is None else f'{key}={val}')
    for key, val in swaps.items():
        if val is not None and key not in seen:
            kept.append(f'{key}={val}')
    return '<' + name + ''.join(' ' + k for k in kept) + closing


def rewrite_relative(text):
    """In es/, point bilingual pages at their Spanish file and everything else one level up."""
    spanish = {page_file(p): page_file(p, 'es') for p in BILINGUAL}

    def fix(m):
        attr, value = m.group(1), m.group(2)
        if re.match(r'^(?:[a-z]+:|#|/|//)', value):
            return m.group(0)
        path = re.split(r'[#?]', value)[0]
        if path in spanish:
            return f'{attr}="{spanish[path]}{value[len(path):]}"'
        return f'{attr}="../{value}"'

    return re.sub(r'\b(href|src)="([^"]*)"', fix, text)


def head_block(page, lang):
    title, desc = META[page][lang]
    e = lambda s: html.escape(s, quote=True)
    lines = [
        f'<title>{e(title)}</title>',
        f'<meta name="description" content="{e(desc)}">',
        f'<link rel="canonical" href="{abs_url(page, lang)}">',
    ]
    if page in BILINGUAL:
        lines += [
            f'<link rel="alternate" hreflang="en" href="{abs_url(page, "en")}">',
            f'<link rel="alternate" hreflang="es" href="{abs_url(page, "es")}">',
            f'<link rel="alternate" hreflang="x-default" href="{abs_url(page, "en")}">',
        ]
    lines += [
        f'<meta property="og:site_name" content="Chess Coach">',
        f'<meta property="og:type" content="{"website" if page == "index" else "article"}">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(desc)}">',
        f'<meta property="og:url" content="{abs_url(page, lang)}">',
        f'<meta property="og:image" content="{OG_IMAGE}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:locale" content="{"es_ES" if lang == "es" else "en_GB"}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{e(title)}">',
        f'<meta name="twitter:description" content="{e(desc)}">',
        f'<meta name="twitter:image" content="{OG_IMAGE}">',
    ]
    if page in BILINGUAL:
        lines.append(f'<meta property="og:locale:alternate" content="{"en_GB" if lang == "es" else "es_ES"}">')
    if lang == 'en' and page in BILINGUAL:
        # A Spanish reader who arrives on an English URL (an old link, the app) lands on Spanish,
        # unless they picked English on this site. Googlebot crawls without Accept-Language, so it
        # stays on the English page and reaches the Spanish one through hreflang.
        # The one exception is the visitor who just tapped EN on the Spanish page and could not store
        # the choice (storage blocked): the referrer tells us, so they are not sent straight back.
        es = rel_link(page, 'en', 'es')
        lines.append(
            '<script>(function(){var s=null;try{s=localStorage.getItem("' + LANG_KEY + '")}catch(e){}'
            'var es="' + es + '",back=(document.referrer||"").split("#")[0]===new URL(es,location.href).href;'
            'if(s==="es"||(s===null&&!back&&/^es\\b/i.test(navigator.language||"")))'
            '{location.replace(es+location.search+location.hash)}})();</script>')
    if page == 'index':
        lines.append('<script type="application/ld+json">' + json.dumps(structured_data(lang), ensure_ascii=False) + '</script>')
    return '\n    '.join(lines)


def structured_data(lang):
    # WebSite is what gives the result its site name. A MobileApplication block was left out on
    # purpose: Google only accepts it with store ratings, and those are not on this page.
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'Chess Coach',
        'alternateName': ['CheesCoach', 'Chess Coach AI'],
        'url': SITE + '/',
        'inLanguage': 'es' if lang == 'es' else 'en',
    }


def toggle(page, lang):
    def link(to):
        cur = ' class="active" aria-current="page"' if to == lang else ''
        return (f'<a href="{rel_link(page, lang, to)}" hreflang="{to}" lang="{to}" '
                f'data-lang-link="{to}"{cur}>{to.upper()}</a>')
    label = 'Idioma' if lang == 'es' else 'Language'
    return f'<div class="lang-toggle" role="group" aria-label="{label}">{link("en")}{link("es")}</div>'


REMEMBER_CHOICE = (
    '<script>document.querySelectorAll("[data-lang-link]").forEach(function(a){'
    'var k=function(){try{localStorage.setItem("' + LANG_KEY + '",a.getAttribute("data-lang-link"))}catch(e){}};'
    'a.addEventListener("click",k);a.addEventListener("auxclick",k)});</script>')


PLAY_LINK = 'https://play.google.com/store/apps/details?id=com.app.cheescoach'
APP_STORE_LINK = 'https://apps.apple.com/app/id6790447113'
APP_STORE_PROVIDER = '129140502'   # pt, from App Store Connect's campaign link generator


def tag_play_links(text, page, lang):
    """Tags the store buttons so each console can tell the website's installs apart.

    Play reads an install referrer as UTM (utm_campaign web_<page>_<lang>); App Store Connect
    reads pt + ct (ct web_<page>_<lang>_hero, max 40 characters) in the format its generator uses."""
    name = 'home' if page == 'index' else page.replace('-', '_')
    campaign = f'web_{name}_{lang}'
    referrer = ('utm_source%3Dchesscoach-app.com%26utm_medium%3Dwebsite'
                f'%26utm_campaign%3D{campaign}%26utm_content%3Dhero')
    text = text.replace(f'href="{PLAY_LINK}"', f'href="{PLAY_LINK}&amp;referrer={referrer}"')
    apple = (f'https://apps.apple.com/app/apple-store/id6790447113?pt={APP_STORE_PROVIDER}'
             f'&amp;ct={campaign}_hero&amp;mt=8')
    return text.replace(f'href="{APP_STORE_LINK}"', f'href="{apple}"')


def include_partials(text):
    """<!--INCLUDE:nav--> pastes src/partials/nav.html: pieces several pages share."""
    return re.sub(r'<!--INCLUDE:([a-z0-9-]+)-->',
                  lambda m: open(os.path.join(SRC, 'partials', m.group(1) + '.html'), encoding='utf-8').read(),
                  text)


def store_links(text, page, lang):
    """{{PLAY:slot}} and {{APPSTORE:slot}} become store links tagged with web_<page>_<lang>[_slot],
    the convention the ASO work reads in Play Console and App Store Connect."""
    name = 'home' if page == 'index' else page.replace('-', '_')
    campaign = f'web_{name}_{lang}'

    def play(m):
        return (f'{PLAY_LINK}&amp;referrer=utm_source%3Dchesscoach-app.com%26utm_medium%3Dwebsite'
                f'%26utm_campaign%3D{campaign}%26utm_content%3D{m.group(1)}')

    def apple(m):
        return (f'https://apps.apple.com/app/apple-store/id6790447113?pt={APP_STORE_PROVIDER}'
                f'&amp;ct={campaign}_{m.group(1)}&amp;mt=8')

    text = re.sub(r'\{\{PLAY:([a-z]+)\}\}', play, text)
    return re.sub(r'\{\{APPSTORE:([a-z]+)\}\}', apple, text)


def faq_schema(text):
    """FAQPage from the page's own <details class="faq-item"> blocks, so the two never disagree."""
    items = re.findall(r'<details class="faq-item"[^>]*>\s*<summary[^>]*>(.*?)</summary>(.*?)</details>', text, re.S)
    if not items:
        return ''
    clean = lambda h: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h))).strip()
    data = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': clean(q), 'acceptedAnswer': {'@type': 'Answer', 'text': clean(a)}}
        for q, a in items]}
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + '</script>'


def build_page(page, lang):
    name = page_file(page)
    text = include_partials(open(os.path.join(SRC, name), encoding='utf-8').read())
    text = store_links(text, page, lang)
    text = translate(text, lang, name) if 'data-en=' in text else text
    text = re.sub(r'<html lang="[^"]*"', f'<html lang="{lang}"', text, count=1)
    # Drop the old head metadata; head_block writes a complete, consistent set.
    text = re.sub(r'\s*<title>.*?</title>', '', text, count=1, flags=re.S)
    text = re.sub(r'\s*<meta\s+(?:name|property)="(?:description|og:[^"]*|twitter:[^"]*)"[^>]*>', '', text)
    text = re.sub(r'\s*<link rel="(?:canonical|alternate)"[^>]*>', '', text)
    if lang == 'es':
        text = rewrite_relative(text)
    text = re.sub(r'(<meta name="viewport"[^>]*>)', lambda m: m.group(1) + '\n    ' + head_block(page, lang), text, count=1)
    if '<!--LANG-TOGGLE-->' in text:
        text = text.replace('<!--LANG-TOGGLE-->', toggle(page, lang))
        text = text.replace('</body>', REMEMBER_CHOICE + '\n</body>', 1)
    text = text.replace('https://juanfranj.github.io/cheescoach/', SITE + '/')
    text = tag_play_links(text, page, lang)
    faq = faq_schema(text)
    if faq:
        text = text.replace('</head>', '    ' + faq + '\n</head>', 1)
    dest = os.path.join(OUT, 'es', page_file(page, 'es')) if lang == 'es' else os.path.join(OUT, name)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest, 'w', encoding='utf-8').write(text)


def sitemap():
    ns = ('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
          'xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    rows = []
    for page in BILINGUAL:
        alts = ''.join(
            f'\n    <xhtml:link rel="alternate" hreflang="{h}" href="{abs_url(page, l)}"/>'
            for h, l in (('en', 'en'), ('es', 'es'), ('x-default', 'en')))
        for lang in ('en', 'es'):
            rows.append(f'  <url>\n    <loc>{abs_url(page, lang)}</loc>{alts}\n  </url>')
    for page in ENGLISH_ONLY:
        rows.append(f'  <url>\n    <loc>{abs_url(page, "en")}</loc>\n  </url>')
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset {ns}>\n' + '\n'.join(rows) + '\n</urlset>\n'


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for page in BILINGUAL:
        for lang in ('en', 'es'):
            build_page(page, lang)
    for page in ENGLISH_ONLY:
        build_page(page, 'en')
    for item in ASSETS:
        s, d = os.path.join(SRC, item), os.path.join(OUT, item)
        shutil.copytree(s, d, ignore=shutil.ignore_patterns('.DS_Store')) if os.path.isdir(s) else shutil.copy2(s, d)
    for extra in ('404.html', 'robots.txt', '.nojekyll'):
        shutil.copy2(os.path.join(SRC, extra), os.path.join(OUT, extra))
    open(os.path.join(OUT, 'CNAME'), 'w').write(DOMAIN + '\n')
    open(os.path.join(OUT, 'sitemap.xml'), 'w').write(sitemap())
    print(f'built {len(BILINGUAL) * 2 + len(ENGLISH_ONLY)} pages into docs/')


if __name__ == '__main__':
    main()
