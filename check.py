#!/usr/bin/env python3
"""Checks the built site in docs/ before it is published.

Run after build.py. Exits 1 and lists every problem it finds; prints OK otherwise.
"""
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'docs')
SITE = 'https://chesscoach-app.com'
import build  # the page list and URL scheme live in one place

BILINGUAL = build.BILINGUAL
ENGLISH_ONLY = build.ENGLISH_ONLY
# The App Store listing is the one place the old spelling is still the real name. The structured
# data also names it, as an alias, so search engines tie both spellings together.
ALLOWED_OLD_BRAND = ('CheesCoach: AI Chess Coach', 'CheesCoach: Ajedrez con IA')

problems = []


def fail(msg):
    problems.append(msg)


def url_of(page, lang):
    return build.abs_url(page, lang)


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs, self.alternates, self.canonical, self.lang = [], {}, None, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'html':
            self.lang = a.get('lang')
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')
        if tag == 'link' and a.get('rel') == 'alternate' and a.get('hreflang'):
            self.alternates[a['hreflang']] = a.get('href')
        for key in ('href', 'src'):
            if a.get(key):
                self.refs.append(a[key])


def check_page(path, page, lang):
    rel = os.path.relpath(path, OUT)
    if not os.path.exists(path):
        fail(f'{rel}: missing')
        return
    html = open(path, encoding='utf-8').read()
    for bad in ('data-en=', 'data-es=', '{{PLAY', '{{APPSTORE', '<!--INCLUDE', 'data-en-alt', 'data-es-alt', 'data-en-label', 'data-es-label',
                'setLang(', 'applyLang',
                'juanfranj.github.io/cheescoach', '<!--LANG-'):
        if bad in html:
            fail(f'{rel}: still contains {bad!r}')
    stripped = re.sub(r'<script type="application/ld\+json">.*?</script>', '', html, flags=re.S)
    for ok in ALLOWED_OLD_BRAND:
        stripped = stripped.replace(ok, '')
    if 'CheesCoach' in stripped:
        fail(f'{rel}: says CheesCoach outside the App Store name')

    p = Links()
    p.feed(html)
    if p.lang != lang:
        fail(f'{rel}: <html lang="{p.lang}">, expected "{lang}"')
    if p.canonical != url_of(page, lang):
        fail(f'{rel}: canonical {p.canonical}, expected {url_of(page, lang)}')
    if page in BILINGUAL:
        expected = {'en': url_of(page, 'en'), 'es': url_of(page, 'es'), 'x-default': url_of(page, 'en')}
        if p.alternates != expected:
            fail(f'{rel}: hreflang {p.alternates}, expected {expected}')
    for ref in p.refs:
        u = urlparse(ref)
        if u.scheme or ref.startswith(('#', 'mailto:', '//', 'data:')):
            continue
        target = os.path.normpath(os.path.join(os.path.dirname(path), u.path))
        if u.path.endswith('/') or u.path == '':
            target = os.path.join(target, 'index.html')
        if not os.path.exists(target):
            fail(f'{rel}: broken link {ref}')


def main():
    if not os.path.isdir(OUT):
        print('FAIL: docs/ does not exist; run build.py first')
        return 1
    for page in BILINGUAL:
        check_page(os.path.join(OUT, build.page_file(page)), page, 'en')
        check_page(os.path.join(OUT, 'es', build.page_file(page, 'es')), page, 'es')
    for page in ENGLISH_ONLY:
        check_page(os.path.join(OUT, build.page_file(page)), page, 'en')
    for extra in ('CNAME', 'robots.txt', 'sitemap.xml', '404.html', '.nojekyll'):
        if not os.path.exists(os.path.join(OUT, extra)):
            fail(f'{extra}: missing')
    if os.path.exists(os.path.join(OUT, 'CNAME')):
        if open(os.path.join(OUT, 'CNAME')).read().strip() != 'chesscoach-app.com':
            fail('CNAME: wrong domain')
    if os.path.exists(os.path.join(OUT, 'sitemap.xml')):
        locs = re.findall(r'<loc>([^<]+)</loc>', open(os.path.join(OUT, 'sitemap.xml')).read())
        want = sorted([url_of(p, l) for p in BILINGUAL for l in ('en', 'es')] +
                      [url_of(p, 'en') for p in ENGLISH_ONLY])
        if sorted(locs) != want:
            fail(f'sitemap.xml: {len(locs)} URLs, expected {len(want)}')
        alts = re.findall(r'<xhtml:link rel="alternate" hreflang="[^"]+" href="([^"]+)"/>',
                          open(os.path.join(OUT, 'sitemap.xml')).read())
        if len(alts) != 3 * 2 * len(BILINGUAL) or any(a not in want for a in alts):
            fail(f'sitemap.xml: {len(alts)} alternates, expected {3 * 2 * len(BILINGUAL)} pointing at listed URLs')
    if problems:
        print('FAIL')
        for p in problems:
            print(' -', p)
        return 1
    print(f'OK: {len(BILINGUAL) * 2 + len(ENGLISH_ONLY)} pages')
    return 0


if __name__ == '__main__':
    sys.exit(main())
