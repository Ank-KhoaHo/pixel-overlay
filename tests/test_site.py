"""Tests of site/: the project's page says one thing, in every place that says it.

A page tells search engines and link previews what it is in five places: its canonical link,
its Open Graph tags, a JSON-LD block, `sitemap.xml` and `robots.txt`. Each is typed by hand,
and each is read by a different machine, so they drift apart without anything looking wrong
in a browser. These tests read them the way those machines do.

Nothing here opens a browser or the network. What is checked is what is in the files.
"""

import json
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
# The product's name. The page's title starts with it and says more; the structured data and
# llms.txt name the product alone.
PRODUCT = "Pixel Veil"

_BLANK_RE = re.compile(r"<[A-Z][A-Z_-]*>")
_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")


class _Head(HTMLParser):
    """Collects what a crawler reads from a page: links, meta tags, the title, JSON-LD."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.canonical: list[str] = []
        self.meta: dict[str, list[str]] = {}
        self.title = ""
        self.json_ld: list[str] = []
        self._in: str | None = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "link" and (values.get("rel") or "").lower() == "canonical":
            self.canonical.append(values.get("href") or "")
        elif tag == "meta":
            key = values.get("property") or values.get("name")
            if key:
                self.meta.setdefault(key, []).append(values.get("content") or "")
        elif tag == "title":
            self._in = "title"
        elif tag == "script" and (values.get("type") or "").lower() == "application/ld+json":
            self._in = "json"
            self.json_ld.append("")

    def handle_endtag(self, tag):
        if tag in ("title", "script"):
            self._in = None

    def handle_data(self, data):
        if self._in == "title":
            self.title += data
        elif self._in == "json":
            self.json_ld[-1] += data


def _page() -> _Head:
    head = _Head()
    head.feed((SITE / "index.html").read_text(encoding="utf-8"))
    return head


def _one(values: list[str], what: str) -> str:
    assert len(values) == 1, f"the page has {len(values)} of {what}; it needs exactly one"
    assert values[0].strip(), f"{what} is empty"
    return values[0]


def _address() -> str:
    """The page's own address, from its canonical link. Every other place must agree with it."""
    address = _one(_page().canonical, "<link rel=\"canonical\">")
    assert address.startswith("https://") and address.endswith("/"), (
        f"the canonical address {address!r} must start with https:// and end with a slash"
    )
    return address


def _file_for(address: str) -> Path | None:
    """The file in site/ that an address on this site is served from; None for another site."""
    base = _address()
    if not address.startswith(base):
        return None
    rest = address[len(base):].split("#", 1)[0].split("?", 1)[0]
    return SITE / (rest if rest and not rest.endswith("/") else rest + "index.html")


# ---------------------------------------------------------------- the page


def test_no_blank_is_left_in_any_file_of_the_site():
    """The guard that looks for blanks reads Markdown, Python and HTML. This folder also has
    plain text and XML, so every text file of it is read here."""
    # Text files only: a picture's bytes can spell `<B->` by chance (features-dark.webp does).
    text = {".html", ".txt", ".xml", ".svg", ".css", ".js", ".json", ".md"}
    files = sorted(path for path in SITE.rglob("*") if path.is_file() and path.suffix.lower() in text)
    assert files, "site/ has no text file: nothing was checked"
    left = [f"{path.relative_to(ROOT).as_posix()}: {blank}"
            for path in files
            for blank in sorted(set(_BLANK_RE.findall(path.read_text(encoding="utf-8", errors="replace"))))]
    assert left == [], f"blanks nobody filled in: {left}"


def test_the_page_has_a_title_and_a_description():
    head = _page()
    assert head.title.strip(), "the page has no <title>"
    assert head.title.strip().startswith(PRODUCT), f"the title does not start with {PRODUCT!r}"
    description = _one(head.meta.get("description", []), "<meta name=\"description\">")
    assert len(description) <= 200, f"the description has {len(description)} characters; a result shows about 160"


def test_the_link_preview_says_what_the_page_says():
    """Open Graph is what a chat or a social site shows when the address is pasted."""
    head = _page()
    assert _one(head.meta.get("og:url", []), "og:url") == _address(), "og:url is not the canonical address"
    assert _one(head.meta.get("og:title", []), "og:title") == head.title.strip(), "og:title is not the page's title"
    assert _one(head.meta.get("og:description", []), "og:description") == head.meta["description"][0], (
        "og:description is not the page's description"
    )
    assert _one(head.meta.get("og:type", []), "og:type") == "website"
    for image in head.meta.get("og:image", []):
        assert image.startswith("https://"), f"og:image {image!r} must be a full https address"
        target = _file_for(image)
        assert target is None or target.is_file(), f"og:image names {image}, and site/ has no such file"


def test_the_structured_data_parses_and_says_what_the_page_says():
    """JSON-LD is read by a parser. One quote too many and the whole block is ignored, in silence."""
    head = _page()
    block = _one(head.json_ld, "<script type=\"application/ld+json\">")
    data = json.loads(block)
    assert data.get("@context") == "https://schema.org"
    assert data.get("@type"), "the structured data has no @type"
    assert data.get("url") == _address(), "the structured data's url is not the canonical address"
    assert data.get("name") == PRODUCT, "the structured data's name is not the product's name"
    assert data.get("description") == head.meta["description"][0], (
        "the structured data's description is not the page's description"
    )


# ---------------------------------------------------------------- what crawlers are told


def test_robots_points_at_the_sitemap_and_shuts_nobody_out():
    lines = [line.strip() for line in (SITE / "robots.txt").read_text(encoding="utf-8").splitlines()]
    sitemaps = [line.split(":", 1)[1].strip() for line in lines if line.lower().startswith("sitemap:")]
    assert sitemaps == [_address() + "sitemap.xml"], f"robots.txt names {sitemaps} as the sitemap"
    shut = [line for line in lines if re.fullmatch(r"(?i)disallow:\s*/", line)]
    assert shut == [], "robots.txt forbids the whole site: the page would never be found"


def test_the_sitemap_lists_real_pages_of_this_site_with_real_dates():
    tree = ElementTree.parse(SITE / "sitemap.xml")
    space = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    entries = tree.getroot().findall("s:url", space)
    assert entries, "sitemap.xml lists no page"
    listed = []
    for entry in entries:
        address = (entry.findtext("s:loc", default="", namespaces=space) or "").strip()
        listed.append(address)
        target = _file_for(address)
        assert target is not None, f"sitemap.xml lists {address}, which is not on this site"
        assert target.is_file(), f"sitemap.xml lists {address}, and site/ has no file for it"
        changed = (entry.findtext("s:lastmod", default="", namespaces=space) or "").strip()
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", changed), f"{address}: lastmod {changed!r} is not a date"
        assert date.fromisoformat(changed) <= date.today(), f"{address}: lastmod {changed} is in the future"
    assert _address() in listed, "sitemap.xml does not list the page itself"
    assert len(listed) == len(set(listed)), "sitemap.xml lists a page twice"


def test_the_text_for_language_models_names_the_product_and_links_to_real_pages():
    """llms.txt is a plain summary for a model that reads the site. Whether any model reads
    it is not proven; what is certain is that a stale one misinforms."""
    lines = (SITE / "llms.txt").read_text(encoding="utf-8").splitlines()
    assert lines and lines[0].startswith("# ") and lines[0][2:].strip(), "llms.txt does not open with `# <the product's name>`"
    assert lines[0][2:].strip() == PRODUCT, "llms.txt names another product than the page"
    assert any(line.startswith("> ") and line[2:].strip() for line in lines), "llms.txt has no `> ` summary line"
    links = [address for line in lines for address in _LINK_RE.findall(line)]
    assert links, "llms.txt links to nothing"
    for address in links:
        assert address.startswith("https://"), f"llms.txt links to {address!r}: a full https address is needed"
        target = _file_for(address)
        assert target is None or target.is_file(), f"llms.txt links to {address}, and site/ has no file for it"
