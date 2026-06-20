# Firebase Admin Architecture Plan - VitaNusa AI

This is a planning document only. It does not add Firebase code, does not deploy anything, and does not modify the public website.

## 1. Current State Summary

VitaNusa AI is currently a static website.

- Public pages are static HTML, CSS, and JavaScript.
- Articles are stored as HTML files in `articles/`.
- Comics are stored as static folders with panel images in `komik/`.
- Media, images, and PDFs are stored in the repository.
- No `firebase.json` exists yet.
- No `.firebaserc` exists yet.
- No `firestore.rules` exists yet.
- No `firestore.indexes.json` exists yet.
- No Firebase SDK is used yet.
- No `admin/` dashboard exists yet.

## 2. Target Architecture

The future system should use:

- Firebase Auth for admin login.
- Cloud Firestore for content data.
- Firebase Storage for uploaded images, PDFs, banners, and files.
- A static public website that reads only published data.
- An admin dashboard that manages content safely.

Target flow:

```txt
Admin Login -> Firebase Auth -> Admin Dashboard -> Firestore + Storage -> Published Public Content
```

The public website should keep working with static fallback content during migration.

## 3. Admin Dashboard Modules

Recommended admin modules:

- Dashboard
- Articles
- Comics
- Media / Files
- Products
- FAQ
- Site Settings
- Logout

## 4. Firestore Collections

### `admins`

Recommended fields:

```js
{
  uid: "Firebase Auth UID",
  email: "admin@example.com",
  displayName: "Admin Name",
  role: "owner | editor",
  status: "active | disabled",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastLoginAt: Timestamp
}
```

### `articles`

Recommended fields:

```js
{
  title: "Article title",
  slug: "article-slug",
  status: "draft | published | archived",
  category: "Edukasi Konsumen",
  summary: "Short summary",
  contentHtml: "<p>Article content</p>",
  bannerUrl: "Storage or static URL",
  pdfUrl: "Storage or static URL",
  readTime: "10-12 menit",
  tags: ["tag"],
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt: Timestamp
}
```

### `comics`

Recommended fields:

```js
{
  title: "Comic title",
  slug: "comic-slug",
  status: "draft | published | archived",
  summary: "Comic summary",
  coverUrl: "Cover image URL",
  totalPanels: 30,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt: Timestamp
}
```

Comic panel subcollection:

```txt
comics/{comicId}/panels/{panelId}
```

Panel fields:

```js
{
  number: 1,
  imageUrl: "Panel image URL",
  alt: "Panel alt text",
  caption: "Optional caption"
}
```

### `products`

Recommended fields:

```js
{
  name: "Product name",
  slug: "product-slug",
  status: "draft | published | archived",
  summary: "Verified catalog summary",
  description: "Verified product data only",
  imageUrl: "Product image URL",
  composition: "Only if verified",
  usage: "Only if verified",
  bpomNumber: "Only if verified",
  halalInfo: "Only if verified",
  safetyNote: "Safety note",
  disclaimer: "Not medical advice",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt: Timestamp
}
```

### `faqs`

Recommended fields:

```js
{
  question: "Question",
  answer: "Answer",
  category: "FAQ Amanah",
  order: 1,
  status: "draft | published | archived",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt: Timestamp
}
```

### `siteSettings`

Recommended document: `siteSettings/public`

```js
{
  siteName: "VitaNusa AI",
  tagline: "Sahabat edukasi sehat",
  defaultDisclaimer: "Informasi bersifat edukatif dan tidak menggantikan tenaga kesehatan profesional.",
  instagramStatus: "proses",
  tiktokStatus: "proses",
  updatedAt: Timestamp
}
```

Do not store secrets, API keys, service account keys, passwords, private keys, or tokens in Firestore.

### `mediaIndex`

Recommended fields:

```js
{
  fileName: "file-name.png",
  fileType: "image | pdf | document",
  storagePath: "articles/file-name.png",
  downloadUrl: "Storage URL",
  alt: "Alt text",
  caption: "Optional caption",
  linkedModule: "articles | comics | products | documents | banners",
  linkedId: "Optional related ID",
  status: "active | archived",
  uploadedBy: "admin uid",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 5. Firebase Storage Folders

Suggested Storage folders:

```txt
articles/
comics/
products/
documents/
banners/
```

Usage:

- `articles/` for article banners and inline images.
- `comics/` for comic covers and panel images.
- `products/` for product catalog images.
- `documents/` for PDFs.
- `banners/` for homepage, article, and comic banners.

## 6. Article Admin Schema

Required article admin fields:

- title
- slug
- status
- category
- summary
- contentHtml
- bannerUrl
- pdfUrl
- readTime
- tags
- createdAt
- updatedAt
- publishedAt

Validation rules:

- `title` is required.
- `slug` is required and unique.
- `status` must be `draft`, `published`, or `archived`.
- `summary` must not contain exaggerated health claims.
- `contentHtml` should be sanitized or restricted to safe markup.
- Article 3 should not be migrated first because it is long and sensitive.

## 7. Comic Admin Schema

Required comic admin fields:

- title
- slug
- status
- summary
- coverUrl
- totalPanels
- panels subcollection

Panel fields:

- number
- imageUrl
- alt
- caption

Before publishing, `totalPanels` should match the number of active panel records.

## 8. Security Rules Concept

Security concept:

- Public can read only published content.
- Only admins can write.
- Admin access is checked by `admins/{uid}`.
- Never use `allow read, write: if true`.
- Never expose secrets in client-side code.

Concept example:

```js
function isAdmin() {
  return request.auth != null
    && exists(/databases/$(database)/documents/admins/$(request.auth.uid))
    && get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.status == "active";
}

match /articles/{id} {
  allow read: if resource.data.status == "published" || isAdmin();
  allow create, update, delete: if isAdmin();
}
```

This is only a concept and must be reviewed before deployment.

## 9. Migration Strategy

Use hybrid migration:

1. Keep the existing static website working.
2. Add Firebase beside the existing website.
3. Start admin with new content only.
4. Do not migrate Article 3 first.
5. Add public Firestore reads with static fallback.
6. Migrate old articles only after admin is stable.
7. Migrate comics after article flow is stable.
8. Move media and PDFs gradually.

## 10. Health Content Safety Rules

Admin content must follow VitaNusa AI's amanah principles:

- No "pasti sembuh".
- No "100% aman".
- No fake testimonials.
- No cure claims.
- No fake before/after proof.
- Do not remove disclaimers.
- Do not replace medical advice.
- Do not suggest stopping doctor medicine.
- Keep the tone educational, honest, warm, and amanah.
- Product claims must be based only on verified data.

## 11. Implementation Roadmap

### Phase 1: Firebase Foundation

Add Firebase project files only:

- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`

Do not change public pages yet.

### Phase 2: Admin Skeleton

Create the `admin/` folder and basic layout only.

### Phase 3: Auth Login

Add Firebase Auth login, admin check, and logout.

### Phase 4: Article CRUD

Build article create, edit, draft, publish, archive flow.

### Phase 5: Public Article List from Firestore with Fallback

Let public article index read Firestore while keeping static fallback.

### Phase 6: Comic CRUD

Build comic metadata and panel management.

### Phase 7: Media Manager

Add Storage upload and media indexing.

### Phase 8: Security Review

Review Firestore rules, Storage rules, Auth, and admin-only writes.

### Phase 9: Optional Firebase Hosting

Consider Firebase Hosting only after admin and rules are stable.

## 12. Files That Must Not Be Touched During Early Phases

Do not touch:

```txt
documents/*.pdf
images/*
articles/*.html
komik/*
WhatsApp/email
product images
article 3 content
```

Extra caution:

```txt
index.html
style.css
assets/js/modules/vitacheck.js
documents/index.html
documents/documents-style.css
documents/documents-main.js
```

## 13. First Safe Step

The safest first implementation step after this plan is a small Firebase foundation commit only. Do not add the admin dashboard and Firebase foundation in the same commit.

Recommended first implementation files:

```txt
firebase.json
.firebaserc
firestore.rules
firestore.indexes.json
storage.rules
```

## 14. Final Note

This plan is intentionally conservative. VitaNusa AI is an educational health project. The admin system should make publishing easier without weakening safety, honesty, disclaimers, or the amanah tone.
