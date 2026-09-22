# Jackie's Whimsical Collection — self-hosted site

A small, self-contained website for Jackie's art portfolio, built to run on a
Raspberry Pi. It includes a simple password-protected editor at `/admin` so
Jackie can update text, add/remove pieces, and upload photos herself — no
code required. Each piece can hold as many photos as she wants (with manual
&lsaquo;/&rsaquo; controls to reorder them and choose the cover photo), and
clicking a piece on the live site opens its own page showing every photo for
it. There's also a blog-style **Field Notes** section (at `/field-notes`) for
progress updates with writing and photos, and the homepage automatically
shows the most recent post along with its first photo. The featured hero
photo and Jackie's own "Meet the Artist" photo both enlarge when clicked,
and there's an optional YouTube icon under "Inquiries."

This guide is for whoever sets up and maintains the Pi (Philip). A separate,
much shorter guide for Jackie — just "how do I change something on the
site" — is in `JACKIE-GUIDE.md`.

---

## What's in this folder

```
server.js              the whole website (routes, saving logic)
data/content.json       all the editable text + the list of pieces — this IS your content
public/                 stylesheet, fonts config, and uploaded photos live here
views/                  page templates (only touch these if you want to change the design)
views/piece.ejs         the page shown when someone clicks a piece — shows all its photos
views/field-notes.ejs   the full Field Notes blog feed page
scripts/generate-placeholders.js   (optional) regenerates the starter placeholder images
deploy/jackies-collection.service  a systemd service file, so the site restarts on its own
.env.example            copy this to .env and fill in your own password/secret
```

`data/content.json` and everything under `public/uploads/` are the only two
things that hold real content. Back those two up from time to time (copy them
somewhere else — a USB drive, cloud folder, whatever's easy) so a dead SD card
never means losing Jackie's work and words.

---

## 1. One-time setup on the Raspberry Pi

**Requirements:** Raspberry Pi OS (or any Linux), Node.js 18 or newer.

Check if Node is already installed:

```bash
node -v
```

If that fails or shows a version older than 18, install a current Node.js
(this uses NodeSource's setup script, one of the simplest ways to get a
recent Node on a Pi):

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Copy this project onto the Pi.** Easiest ways: `scp` the whole folder over
from your computer, or plug in a USB drive and copy it, or `git clone` if you
put it in a repo of your own. This project lives at `/mnt/PI_Projects/jackies-collection`.

**Install dependencies** (run this from inside the project folder on the Pi):

```bash
cd /mnt/PI_Projects/jackies-collection
npm install
```

**Set your admin password and secret.** Copy the example environment file
and edit it:

```bash
cp .env.example .env
nano .env
```

Change `ADMIN_PASSWORD` to whatever password Jackie will use to log into
`/admin`, and change `SESSION_SECRET` to any long random string (the comment
in that file shows a one-line command to generate one). Save and exit
(`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

**Test it:**

```bash
npm start
```

You should see:

```
Jackie's Whimsical Collection is running at http://localhost:3000
Editor: http://localhost:3000/admin
```

From another device on the same Wi-Fi, visit `http://<the-pi's-local-ip>:3000`
(find the Pi's IP with `hostname -I` on the Pi itself). If the homepage loads
and `/admin` asks for a password, everything's working. Stop the test run
with `Ctrl+C` before moving on.

---

## 2. Keep it running permanently (systemd)

Right now the site only runs while that terminal window is open. To have it
start automatically on boot and restart itself if it ever crashes, use the
included systemd service file.

```bash
sudo cp deploy/jackies-collection.service /etc/systemd/system/
sudo nano /etc/systemd/system/jackies-collection.service
```

Double check the `WorkingDirectory`, `EnvironmentFile`, and `User` lines
match where you actually put the project and which Linux user owns it. This
project's service file is set to `User=cowgillp` — change that if you're
running it as a different user (many newer Raspberry Pi OS installs don't
have a `pi` user at all, so `User=pi` will fail with a `217/USER` error;
`ls /home` shows you the real username if you're not sure).

Since `/mnt/PI_Projects` is a separate mount rather than that user's own
home folder, one thing is worth checking if the service fails to start
(`sudo systemctl status jackies-collection` will show why): the user it
runs as needs read/write access to `/mnt/PI_Projects/jackies-collection` —
not just read — since `public/uploads/` and `data/content.json` get written
to whenever Jackie saves changes. If it fails with a permissions error,
`sudo chown -R cowgillp:cowgillp /mnt/PI_Projects/jackies-collection` will
fix it.

(The service file already includes `RequiresMountsFor=/mnt/PI_Projects`,
so it won't try to start before that drive is actually mounted on boot.)

Then enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable jackies-collection
sudo systemctl start jackies-collection
```

Check it's running:

```bash
sudo systemctl status jackies-collection
```

From now on, `sudo systemctl restart jackies-collection` restarts it (for
example after you change the design files), and it'll come back on its own
after a power cut or reboot.

---

## 3. Putting it on the real internet with a domain

Since this is running on a Pi at home rather than on paid hosting, the
simplest and safest way to make it reachable at a real web address — without
opening ports on your router or exposing your home IP address — is a free
**Cloudflare Tunnel**. It also gives you HTTPS (the padlock) automatically.

1. **Get a domain.** Buy one from any registrar — Cloudflare's own
   registrar, Namecheap, and Porkbun are all reasonable, inexpensive
   options. (See the domain name ideas at the bottom of this file.)
2. **Add your domain to Cloudflare** (free plan is fine) and switch your
   domain's nameservers to the ones Cloudflare gives you — your registrar's
   dashboard has a place to do this.
3. **Install `cloudflared` on the Pi:**
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
   sudo dpkg -i cloudflared.deb
   ```
   (Use `cloudflared-linux-arm.deb` instead if you're on a 32-bit Raspberry
   Pi OS — check with `uname -m`: `aarch64` = arm64, `armv7l` = arm.)
4. **Log in and create the tunnel:**
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create jackies-collection
   cloudflared tunnel route dns jackies-collection yourdomain.com
   ```
5. **Point the tunnel at your site.** Create `/etc/cloudflared/config.yml`:
   ```yaml
   tunnel: jackies-collection
   credentials-file: /home/cowgillp/.cloudflared/<the-uuid-shown-above>.json
   ingress:
     - hostname: yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
6. **Run it as a service too**, so it also survives reboots:
   ```bash
   sudo cloudflared service install
   sudo systemctl enable cloudflared
   sudo systemctl start cloudflared
   ```

After DNS propagates (usually minutes, sometimes up to a day), `https://yourdomain.com`
will load the site — securely, without ever forwarding a port on your router.

*(There are other ways to do this — traditional port-forwarding with a
Dynamic DNS service, or a reverse proxy like Caddy for automatic HTTPS — but
Cloudflare Tunnel is the option that keeps your home network the least
exposed, which matters more on a residential internet connection.)*

---

## 4. A few domain name ideas

Since the site's name is **"Jackie's Whimsical Collection,"** here are some
starting points — check availability at whatever registrar you use
(Cloudflare Registrar, Namecheap, and Porkbun all have an instant search):

- `jackieswhimsicalcollection.com` — the literal, exact-match option
- `whimsicalcollection.studio` or `.art` — shorter, and `.studio`/`.art` read
  well for an artist's site
- `jackieswhimsy.com`
- `gildedspecimen.com` — pulls from the cabinet/specimen visual language in
  the design
- `lunaandthread.com` — nods to the moths and the embroidery together
- `menagerieofwonders.com` — pulled straight from the homepage headline

If the exact `.com` you want is taken, `.studio`, `.art`, and `.gallery` are
all legitimate, artist-appropriate alternatives worth checking first before
compromising on the name itself.

---

## 5. Updating the design later

If you (or I) want to change how the site looks, the templates are in
`views/*.ejs` and the styling is all in one file: `public/css/style.css`.
None of Jackie's content lives in those files — it's all pulled from
`data/content.json` — so design changes are safe to make without touching or
losing any of her text or photos.

After any change to the code, redeploy by copying the updated files onto the
Pi and running:

```bash
sudo systemctl restart jackies-collection
```

---

## 6. Updating the code on your already-running Pi

If your site is already live and you're just picking up a newer version of
this project (for example, to get the unlimited-photos-per-piece feature,
the Field Notes blog, photo reordering, the "Meet the Artist" photo, or the
YouTube link), you only need to replace the **code** files — never
touch `data/content.json` or `public/uploads/` on the Pi. Those two hold
everything Jackie has already written and uploaded, and the app is built to
carry that content forward automatically even when the code underneath it
changes.

1. **Copy over only these, overwriting what's already there:**
   ```
   server.js
   views/            (the whole folder)
   public/css/style.css
   package.json
   ```
   Leave `data/content.json` and `public/uploads/` on the Pi exactly as they
   are — don't copy the versions from this new zip over them.

2. **Reinstall dependencies**, in case any changed (safe to run even if
   nothing did):
   ```bash
   cd /mnt/PI_Projects/jackies-collection
   npm install
   ```

3. **Restart the site:**
   ```bash
   sudo systemctl restart jackies-collection
   ```

That's it. The first time it loads after an update like this, the app
automatically upgrades Jackie's existing content to fit any new format
behind the scenes — nothing she's already written or uploaded gets lost or
needs to be re-entered.
