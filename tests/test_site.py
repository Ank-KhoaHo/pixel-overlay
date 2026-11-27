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
    """The file an address on this site is made from; None for another site. The guide's pages
    are built from guide/*.md, and its front page from guide/README.md."""
    base = _address()
    if not address.startswith(base):
        return None
    rest = address[len(base):].split("#", 1)[0].split("?", 1)[0]
    if rest.startswith("guide/"):
        return _guide_source(rest[len("guide/"):])
    return SITE / (rest if rest and not rest.endswith("/") else rest + "index.html")


def _guide_source(rest: str) -> Path:
    """The Markdown page a guide address is built from: `` and `index.html` -> README.md,
    `compare` and `compare.html` -> compare.md."""
    name = rest.removesuffix(".html")
    return ROOT / "guide" / ("README.md" if name in ("", "index") else name + ".md")


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


# ---------------------------------------------------------------- the guide

GUIDE = ROOT / "guide"
WORKFLOW = ROOT / ".github" / "workflows" / "pages.yml"
# Pages of the guide that are not rows of its table: the table itself, and the changelog.
NOT_IN_TABLE = {"README.md", "changelog.md"}
# The same shape the guide's config reads its sidebar with (guide/.vitepress/config.ts).
_ROW_RE = re.compile(r"^\| \[([^\]]+)\]\(([\w-]+)\.md\) \|", re.MULTILINE)


def _guide_pages() -> list[Path]:
    pages = sorted(GUIDE.glob("*.md"))
    assert len(pages) >= 8, f"guide/ has {len(pages)} pages: the checks would be vacuous"
    return pages


def _guide_address(page: Path) -> str:
    return _address() + "guide/" + ("" if page.name == "README.md" else page.stem)


def _page_problems(on_disk: set[str], in_table: list[str]) -> list[str]:
    problems = [f"{page} is not in the table of guide/README.md, so the guide's sidebar leaves it out"
                for page in sorted(on_disk - set(in_table))]
    problems += [f"the table names {page}, and there is no such page" for page in in_table if page not in on_disk]
    problems += [f"the table names {page} twice" for page in sorted({p for p in in_table if in_table.count(p) > 1})]
    return problems


def test_a_page_left_out_of_the_table_or_named_but_missing_is_found():
    assert _page_problems({"a.md", "b.md"}, ["a.md", "b.md"]) == []
    assert _page_problems({"a.md", "b.md"}, ["a.md"]) == [
        "b.md is not in the table of guide/README.md, so the guide's sidebar leaves it out"
    ]
    assert _page_problems({"a.md"}, ["a.md", "c.md"]) == ["the table names c.md, and there is no such page"]
    assert _page_problems({"a.md"}, ["a.md", "a.md"]) == ["the table names a.md twice"]


def test_every_page_of_the_guide_is_in_its_sidebar_once():
    in_table = [f"{name}.md" for _, name in _ROW_RE.findall((GUIDE / "README.md").read_text(encoding="utf-8"))]
    on_disk = {page.name for page in _guide_pages()} - NOT_IN_TABLE
    assert len(in_table) >= 6, f"only {len(in_table)} rows were read from the table: the check is vacuous"
    assert _page_problems(on_disk, in_table) == []


def test_every_guide_page_is_in_the_sitemap_and_in_the_text_for_language_models():
    space = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    listed = {(entry.findtext("s:loc", namespaces=space) or "").strip()
              for entry in ElementTree.parse(SITE / "sitemap.xml").getroot()}
    llms = set(_LINK_RE.findall((SITE / "llms.txt").read_text(encoding="utf-8")))
    for page in _guide_pages():
        address = _guide_address(page)
        assert address in listed, f"sitemap.xml does not list guide/{page.name} as {address}"
        assert address in llms, f"llms.txt does not link guide/{page.name} as {address}"


def test_the_changelog_page_starts_at_the_first_block_of_the_changelog():
    page = (GUIDE / "changelog.md").read_text(encoding="utf-8")
    found = re.findall(r"<!--@include: \.\./CHANGELOG\.md\{(\d+),\}-->", page)
    assert len(found) == 1, "guide/changelog.md must include CHANGELOG.md once, from a line number on"
    lines = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8").splitlines()
    first = next(i for i, line in enumerate(lines, start=1) if line.startswith("## "))
    assert int(found[0]) == first, (
        f"the page includes CHANGELOG.md from line {found[0]}, and its first block starts on line {first}: "
        "the intro above it is for the maintainer, and a block below it would be cut"
    )


class _Links(HTMLParser):
    """Collects every address a page names (href and src)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.addresses: list[str] = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for key in ("href", "src", "srcset"):
            if values.get(key):
                self.addresses.append(values[key].split(" ", 1)[0])


def _links(path: Path) -> _Links:
    links = _Links()
    links.feed(path.read_text(encoding="utf-8"))
    return links


def test_every_link_between_pages_of_the_site_reaches_a_file():
    """The project page links into the guide, and the guide's pages link to each other and to the
    project page's pictures. The guide's build finds a dead link between its own pages; it never
    reads the project page, nor a link as GitHub follows it."""
    checked = 0
    for page in sorted(SITE.rglob("*.html")):
        for address in _links(page).addresses:
            if address.startswith(("https:", "http:", "mailto:", "#", "data:")):
                target = _file_for(address) if address.startswith("https:") else None
            elif address.startswith("guide/"):
                target = _guide_source(address.split("#", 1)[0][len("guide/"):])
            else:
                rest = address.split("#", 1)[0].split("?", 1)[0]
                target = (page.parent / rest).resolve()
                if address.endswith("/") or target.is_dir():
                    target = target / "index.html"
            if target is not None:
                checked += 1
                assert target.is_file(), f"{page.relative_to(SITE)} links to {address}, and there is no file for it"
    for page in _guide_pages():
        for address in _LINK_RE.findall(page.read_text(encoding="utf-8")):
            if address.startswith(("https:", "http:", "mailto:", "#")):
                target = _file_for(address) if address.startswith("https:") else None
            else:
                target = (GUIDE / address.split("#", 1)[0]).resolve()
            if target is not None:
                checked += 1
                assert target.is_file(), f"guide/{page.name} links to {address}, and there is no file for it"
    assert checked > 20, f"only {checked} links were checked"


def test_the_project_page_and_the_readme_link_the_guide():
    assert "guide/" in _links(SITE / "index.html").addresses, "the project page does not link the guide"
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert _address() + "guide/" in readme, "the README does not link the guide"


def test_the_pages_workflow_publishes_the_guide_the_build_writes():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "run: npm run docs:build" in text, "the Pages workflow does not build the guide"
    assert "cp -R site/. _site/" in text and "cp -R guide/.vitepress/dist/. _site/guide/" in text, (
        "the Pages workflow does not put the project page and the built guide together"
    )
    assert re.search(r"^          path: _site$", text, re.M), "the Pages workflow publishes another folder"
    assert re.search(r'^    paths: \[.*"guide/\*\*".*\]$', text, re.M), "a change to the guide alone would not publish it"
    ignored = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert "guide/.vitepress/dist/" in ignored, "the built guide is never committed"
