require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-please';
const SESSION_SECRET = process.env.SESSION_SECRET || 'please-change-this-secret-too';

const CONTENT_PATH = path.join(__dirname, 'data', 'content.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// --- helpers -----------------------------------------------------------

function readContent() {
  const content = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));

  // Migrate older entries that only had a single "image" string to the
  // current "images" array format, so nothing already saved gets lost.
  content.gallery = (content.gallery || []).map((piece) => {
    if (!Array.isArray(piece.images)) {
      piece.images = piece.image ? [piece.image] : [];
    }
    delete piece.image;
    return piece;
  });

  // Migrate the old single pinned-note Field Notes format to the new
  // blog-style list of posts, so an already-written note is kept as the
  // first post rather than lost.
  if (!content.fieldNotes) content.fieldNotes = {};
  if (!Array.isArray(content.fieldNotes.posts)) {
    const legacyText = content.fieldNotes.pinnedText;
    content.fieldNotes.posts = legacyText
      ? [
          {
            id: 'field-note-1',
            title: content.fieldNotes.pinnedLabel || 'Field Note',
            date: new Date().toISOString().slice(0, 10),
            body: legacyText,
            images: [],
          },
        ]
      : [];
    if (!content.fieldNotes.pinnedLabel) content.fieldNotes.pinnedLabel = 'Latest Field Note';
  }
  delete content.fieldNotes.pinnedText;

  return content;
}

function sortedFieldNotePosts(posts) {
  return [...(posts || [])].sort((a, b) => {
    const ta = Date.parse(a.date) || 0;
    const tb = Date.parse(b.date) || 0;
    return tb - ta;
  });
}

function writeContent(content) {
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2), 'utf8');
}

function slugify(text, fallback) {
  const s = String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

// --- app setup -----------------------------------------------------------

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }, // 30 days
  })
);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const base = slugify(path.basename(file.originalname, ext), 'photo');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${base}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file, no limit on file count
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

// --- public site -----------------------------------------------------------

app.get('/', (req, res) => {
  const content = readContent();
  const categories = [...new Set(content.gallery.map((p) => p.category))];
  const activeCategory = req.query.cat || null;
  const pieces = activeCategory
    ? content.gallery.filter((p) => p.category === activeCategory)
    : content.gallery;
  const latestPost = sortedFieldNotePosts(content.fieldNotes.posts)[0] || null;

  res.render('index', { content, categories, activeCategory, pieces, latestPost });
});

app.get('/piece/:id', (req, res) => {
  const content = readContent();
  const piece = content.gallery.find((p) => p.id === req.params.id);
  if (!piece) return res.status(404).send('That piece could not be found.');
  res.render('piece', { content, piece });
});

app.get('/field-notes', (req, res) => {
  const content = readContent();
  const posts = sortedFieldNotePosts(content.fieldNotes.posts);
  res.render('field-notes', { content, posts });
});

// --- admin: auth -----------------------------------------------------------

app.get('/admin/login', (req, res) => {
  const content = readContent();
  res.render('admin/login', { content, error: null });
});

app.post('/admin/login', (req, res) => {
  const content = readContent();
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { content, error: 'That password is not correct. Try again.' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// --- admin: dashboard -----------------------------------------------------------

app.get('/admin', requireAuth, (req, res) => {
  const content = readContent();
  res.render('admin/dashboard', { content, saved: req.query.saved === '1' });
});

app.post('/admin/save', requireAuth, upload.any(), (req, res, next) => {
  try {
    const content = readContent();
    const body = req.body;

    // Group uploaded files by field name — a piece's "add more photos"
    // input can carry several files under the same field name.
    const filesByField = {};
    (req.files || []).forEach((f) => {
      (filesByField[f.fieldname] = filesByField[f.fieldname] || []).push(f);
    });
    const firstFile = (fieldname) => (filesByField[fieldname] || [])[0];

    // Site + hero + about + field notes + contact + footer
    content.site.title = body.site_title || content.site.title;

    content.hero.eyebrow = body.hero_eyebrow ?? content.hero.eyebrow;
    content.hero.headingLine1 = body.hero_heading_1 ?? content.hero.headingLine1;
    content.hero.headingLine2 = body.hero_heading_2 ?? content.hero.headingLine2;
    content.hero.paragraph = body.hero_paragraph ?? content.hero.paragraph;
    content.hero.cta = body.hero_cta ?? content.hero.cta;
    content.hero.specimenLabel = body.hero_specimen_label ?? content.hero.specimenLabel;
    const heroFile = firstFile('hero_specimen_image');
    if (heroFile) {
      content.hero.specimenImage = '/uploads/' + heroFile.filename;
    }

    content.about.heading = body.about_heading ?? content.about.heading;
    content.about.bio = body.about_bio ?? content.about.bio;
    const aboutFile = firstFile('about_photo');
    if (aboutFile) {
      content.about.photo = '/uploads/' + aboutFile.filename;
    }

    content.fieldNotes.pinnedLabel = body.fieldnotes_label ?? content.fieldNotes.pinnedLabel;

    content.contact.email = body.contact_email ?? content.contact.email;
    content.contact.instagram = body.contact_instagram ?? content.contact.instagram;
    content.contact.youtube = (body.contact_youtube ?? content.contact.youtube ?? '').trim();

    content.footer.copyright = body.footer_copyright ?? content.footer.copyright;

    // Gallery pieces: scan for indices the form sent.
    const MAX_ROWS = 500;
    const MAX_IMAGES_PER_PIECE = 200;
    const newGallery = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      const title = body[`piece_title_${i}`];
      if (title === undefined) continue; // this index was never rendered/added

      const deleted = body[`piece_delete_${i}`] === 'true';
      if (deleted) continue;

      const trimmedTitle = String(title).trim();
      if (!trimmedTitle) continue; // skip fully empty rows

      const category = (body[`piece_category_${i}`] || '').trim();
      const year = (body[`piece_year_${i}`] || '').trim();
      const existingId = (body[`piece_id_${i}`] || '').trim();
      const id = existingId || slugify(trimmedTitle, `piece-${Date.now()}-${i}`);

      // Existing photos: keep the ones that weren't individually removed.
      const images = [];
      for (let j = 0; j < MAX_IMAGES_PER_PIECE; j++) {
        const current = body[`piece_image_current_${i}_${j}`];
        if (current === undefined) continue;
        const removedThisOne = body[`piece_image_current_delete_${i}_${j}`] === 'true';
        if (!removedThisOne && current) images.push(current);
      }

      // Newly uploaded photos for this piece get appended after the kept ones.
      (filesByField[`piece_new_images_${i}`] || []).forEach((f) => {
        images.push('/uploads/' + f.filename);
      });

      newGallery.push({ id, title: trimmedTitle, category, year, images });
    }
    content.gallery = newGallery;

    // Field Notes posts: same scan-based pattern as the gallery above.
    const MAX_POSTS = 500;
    const MAX_IMAGES_PER_POST = 200;
    const newPosts = [];
    for (let i = 0; i < MAX_POSTS; i++) {
      const title = body[`fieldnote_title_${i}`];
      if (title === undefined) continue; // this index was never rendered/added

      const deleted = body[`fieldnote_delete_${i}`] === 'true';
      if (deleted) continue;

      const trimmedTitle = String(title).trim();
      const postBody = (body[`fieldnote_body_${i}`] || '').trim();
      if (!trimmedTitle && !postBody) continue; // skip fully empty rows

      const date = (body[`fieldnote_date_${i}`] || '').trim();
      const existingId = (body[`fieldnote_id_${i}`] || '').trim();
      const id = existingId || slugify(trimmedTitle, `field-note-${Date.now()}-${i}`);

      const images = [];
      for (let j = 0; j < MAX_IMAGES_PER_POST; j++) {
        const current = body[`fieldnote_image_current_${i}_${j}`];
        if (current === undefined) continue;
        const removedThisOne = body[`fieldnote_image_current_delete_${i}_${j}`] === 'true';
        if (!removedThisOne && current) images.push(current);
      }

      (filesByField[`fieldnote_new_images_${i}`] || []).forEach((f) => {
        images.push('/uploads/' + f.filename);
      });

      newPosts.push({ id, title: trimmedTitle, date, body: postBody, images });
    }
    content.fieldNotes.posts = newPosts;

    writeContent(content);
    res.redirect('/admin?saved=1');
  } catch (err) {
    next(err);
  }
});

// --- error handling -----------------------------------------------------------

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong saving your changes. Please try again — nothing was lost.');
});

app.listen(PORT, () => {
  console.log(`Jackie's Whimsical Collection is running at http://localhost:${PORT}`);
  console.log(`Editor: http://localhost:${PORT}/admin`);
});
