// Prototype admin module — client-side only, no real security.
// Replace with real auth + backend storage before production use.
(function () {
  const STORAGE_KEY  = 'lumiere_album_overrides_v1';
  const SESSION_KEY  = 'lumiere_admin';
  const PASSWORD     = 'admin1234';   // ← change here

  const Admin = {
    // ——————————————— session ———————————————
    isLoggedIn() { return sessionStorage.getItem(SESSION_KEY) === 'true'; },
    login(pw)    {
      if (pw === PASSWORD) { sessionStorage.setItem(SESSION_KEY, 'true'); return true; }
      return false;
    },
    logout()     { sessionStorage.removeItem(SESSION_KEY); },

    // ——————————————— data store ———————————————
    _read()  { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } },
    _write(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); },

    getAlbumPhotos(id) {
      const defaults = ((window.ALBUMS || [])[id] || {}).photos || [];
      const store = this._read();
      const override = store[id];
      return (override && Array.isArray(override.photos)) ? override.photos : defaults;
    },
    _setAlbumPhotos(id, photos) {
      const store = this._read();
      store[id] = { photos };
      this._write(store);
    },
    addPhoto(id, src, caption) {
      const current = this.getAlbumPhotos(id).slice();
      current.push([src, caption || 'Untitled']);
      this._setAlbumPhotos(id, current);
    },
    removePhoto(id, photoIndex) {
      const current = this.getAlbumPhotos(id).slice();
      current.splice(photoIndex, 1);
      this._setAlbumPhotos(id, current);
    },
    resetAlbum(id) {
      const store = this._read();
      delete store[id];
      this._write(store);
    },

    getAlbumCover(id) {
      const store = this._read();
      return (store[id] && store[id].cover) ? store[id].cover : null;
    },
    setAlbumCover(id, dataUrl) {
      const store = this._read();
      if (!store[id]) store[id] = {};
      store[id].cover = dataUrl;
      this._write(store);
    },
    clearAlbumCover(id) {
      const store = this._read();
      if (store[id]) {
        delete store[id].cover;
        if (Object.keys(store[id]).length === 0) delete store[id];
        this._write(store);
      }
    },

    // ——————————————— image utils ———————————————
    async compressImage(file, maxWidth = 1600, quality = 0.85) {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', quality);
    },

    // ——————————————— UI wiring ———————————————
    mountAuthButton() {
      const btn = document.getElementById('adminToggle');
      if (!btn) return;
      const applyClass = () => {
        if (this.isLoggedIn()) document.body.classList.add('is-admin');
        else document.body.classList.remove('is-admin');
      };
      const refreshLabel = () => {
        btn.textContent = this.isLoggedIn() ? 'Admin · Log out' : 'Log in';
      };
      applyClass();
      refreshLabel();

      btn.addEventListener('click', () => {
        if (this.isLoggedIn()) {
          if (confirm('Log out of admin?')) {
            this.logout();
            location.reload();
          }
        } else {
          const pw = prompt('Admin password');
          if (pw === null) return;
          if (this.login(pw)) location.reload();
          else alert('Incorrect password');
        }
      });
    },
  };

  window.Admin = Admin;
})();
