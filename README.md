# Lumière Archive

A personal photographic portfolio — static site, no build step.

## Stack
- Vanilla HTML / CSS / JavaScript
- Hosted on Vercel as a static site

## Files
- `index.html` — landing page with 3D carousel hero, archive grid, about, contact
- `album.html` — chapter detail view with masonry gallery + lightbox (`?id=N`)
- `albums.js` — chapter data (titles, descriptions, photos)
- `admin.js` — local-only prototype admin (hidden by default, `display:none` on the toggle button)

## Editing content
Edit `albums.js` directly to add, remove, or update chapters.
Each chapter has the shape:

```js
{
  title: 'Chapter Title',
  description: 'Short paragraph...',
  chapter: 'Chapter One',
  photos: [
    ['https://image-url', 'Caption'],
    // ...
  ],
}
```

Push to `main` to redeploy via Vercel.

## Local preview
Just open `index.html` in a browser, or:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## License
Personal use.
