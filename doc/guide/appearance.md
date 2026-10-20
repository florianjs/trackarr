# Appearance

**Admin Panel → Appearance** changes the look of the whole site without touching code. Every change is previewed live, for you only, until you click **Save**, except images: they are public as soon as they are uploaded.

## Theme

- **Presets**: Trackarr, Midnight, Forest, Sunset, Monochrome and High contrast. Each one sets both the light and the dark theme.
- **Colours**: adjust any of the 15 colours of the light and dark themes (backgrounds, borders, text, buttons, and the meaningful colours: accent/freeleech, upload, download, errors). Picking a preset clears the colours set by hand.
- **Corners**: from square to round, for buttons, fields and cards.

Members still choose light, dark or system in their menu.

## Typography

Pick the font of the body text, of the headings and of numbers and code. Fonts are bundled with Trackarr (the Content Security Policy only allows fonts from the site itself):

| Text           | Fonts                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Body, headings | IBM Plex Sans, Inter, Space Grotesk, Nunito, Source Serif 4, system    |
| Numbers, code  | IBM Plex Mono, JetBrains Mono, system monospace                        |

## Images

| Slot                | Where                                              |
| ------------------- | -------------------------------------------------- |
| Login page picture  | Split and Background login designs                 |
| Home banner         | Top of the member dashboard                        |

PNG, JPEG or WebP, 8 MB max. Images are saved as soon as they are uploaded and stored in the database, like logos. The logo and favicon stay in **Branding**.

## Login page

Four designs for the sign-in and sign-up pages, with a live preview:

- **Centered**: logo and form in the middle (default)
- **Split**: picture on the left, form on the right
- **Background**: full-page picture behind a translucent card
- **Minimal**: plain, left-aligned, without the logo tile

Without a picture, Split and Background use the accent colour.

## Texts

Replace any text of the interface, language by language: search a key or a text, type your version, save. An empty field restores the shipped text.

- Keep the words between braces, such as `{name}`: they are replaced by values.
- Plural forms are separated by ` | `, like in the original text.
- Texts are shown as plain text, never as HTML.

Overrides are kept across updates. A text that changes in a new release keeps your version until you reset it.
