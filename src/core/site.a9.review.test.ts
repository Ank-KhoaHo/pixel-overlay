// Claude's review tests for ticket A9 (local files). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { isKeepable, needsFileAccessHelp, siteOf } from './site';

describe('siteOf', () => {
  it('is the origin for web pages', () => {
    expect(siteOf('https://a.test/x/y?z#w')).toBe('https://a.test');
    expect(siteOf('http://localhost:3000/pricing')).toBe('http://localhost:3000');
  });

  it("is the file's folder for local files", () => {
    expect(siteOf('file:///C:/proj/dist/index.html')).toBe('file:///C:/proj/dist/');
    expect(siteOf('file:///home/me/site/about/index.html')).toBe('file:///home/me/site/about/');
  });

  it('a folder URL is its own site', () => {
    expect(siteOf('file:///C:/proj/dist/')).toBe('file:///C:/proj/dist/');
  });

  it('drops the query and hash, and keeps the encoding', () => {
    expect(siteOf('file:///C:/p/a.html?x=1#top')).toBe('file:///C:/p/');
    // A query or hash may hold slashes; they must never become part of the folder.
    expect(siteOf('file:///C:/p/a.html?next=/q/r')).toBe('file:///C:/p/');
    expect(siteOf('file:///C:/p/a.html#/route/x')).toBe('file:///C:/p/');
    expect(siteOf('file:///C:/My%20Site/index.html')).toBe('file:///C:/My%20Site/');
  });

  it('two files in one folder share a site; another folder does not', () => {
    expect(siteOf('file:///C:/p/a.html')).toBe(siteOf('file:///C:/p/b.html'));
    expect(siteOf('file:///C:/p/a.html')).not.toBe(siteOf('file:///C:/q/a.html'));
  });

  it('is null for pages Pixel Veil cannot use', () => {
    expect(siteOf('chrome://extensions/')).toBeNull();
    expect(siteOf('about:blank')).toBeNull();
    expect(siteOf('not a url')).toBeNull();
  });
});

describe('isKeepable', () => {
  it('web sites can be kept; local files cannot', () => {
    expect(isKeepable('https://a.test')).toBe(true);
    expect(isKeepable('http://localhost:3000')).toBe(true);
    expect(isKeepable('file:///C:/p/')).toBe(false);
  });
});

describe('needsFileAccessHelp', () => {
  it('only for a local file while file access is off', () => {
    expect(needsFileAccessHelp('file:///C:/p/a.html', false)).toBe(true);
    expect(needsFileAccessHelp('file:///C:/p/a.html', true)).toBe(false);
    expect(needsFileAccessHelp('https://a.test/', false)).toBe(false);
    expect(needsFileAccessHelp(undefined, false)).toBe(false);
  });
});
