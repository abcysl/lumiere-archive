// Admin client — talks to /api/login, /api/me, /api/content, /api/upload.
// Manages edit mode, inline editing, image uploads, and save flow.
(function () {
  let isAdmin = false;
  let dirty = false;
  let pending = null;          // working copy of content while editing
  let opts = { onContentChange: null, getContent: null };

  // ——————————————— DOM refs ———————————————
  let loginModal, loginPw, loginErr, loginSubmit, loginCancel;
  let adminBar, saveBtn, logoutBtn, saveStatus, adminTrigger;
  let toastEl;

  // ——————————————— Utilities ———————————————
  function deepClone(o) {
    return typeof structuredClone === 'function'
      ? structuredClone(o)
      : JSON.parse(JSON.stringify(o));
  }

  function toast(msg, isErr) {
    if (!toastEl) toastEl = document.getElementById('toast');
    if (!toastEl) { (isErr ? console.error : console.log)(msg); return; }
    toastEl.textContent = msg;
    toastEl.classList.toggle('err', !!isErr);
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  function setStatus(text) {
    if (saveStatus) saveStatus.textContent = text || '';
  }

  function setDirty(v) {
    dirty = !!v;
    if (saveBtn) {
      saveBtn.disabled = !dirty;
      saveBtn.style.opacity = dirty ? '1' : '0.5';
    }
    setStatus(dirty ? 'Unsaved changes' : '');
  }

  // ——————————————— Image upload + compression ———————————————
  async function compressImage(file, maxWidth = 1800, quality = 0.86) {
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
  }

  async function uploadFile(file, baseName) {
    const dataUrl = await compressImage(file);
    const name = (baseName || (file.name || 'image').replace(/\.[^.]+$/, ''))
      .replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    const resp = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, dataUrl }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `upload failed (${resp.status})`);
    }
    const { url } = await resp.json();
    return url;
  }

  // ——————————————— Login flow ———————————————
  function openLoginModal() {
    if (!loginModal) return;
    loginErr.textContent = '';
    loginPw.value = '';
    loginModal.classList.add('open');
    setTimeout(() => loginPw.focus(), 50);
  }
  function closeLoginModal() {
    loginModal.classList.remove('open');
  }

  async function attemptLogin() {
    loginErr.textContent = '';
    const pw = loginPw.value;
    if (!pw) { loginErr.textContent = 'Enter the password'; return; }
    loginSubmit.disabled = true;
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        loginErr.textContent = err.error || 'Login failed';
        return;
      }
      isAdmin = true;
      document.body.classList.add('is-admin');
      closeLoginModal();
      toast('Signed in');
      applyEditableState();
    } catch (err) {
      loginErr.textContent = String(err && err.message || err);
    } finally {
      loginSubmit.disabled = false;
    }
  }

  async function logout() {
    if (dirty && !confirm('You have unsaved changes. Log out anyway?')) return;
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {}
    isAdmin = false;
    document.body.classList.remove('is-admin');
    setDirty(false);
    pending = null;
    toast('Signed out');
    // Reload to reset all editable state cleanly
    setTimeout(() => location.reload(), 400);
  }

  // ——————————————— Edit mode wiring ———————————————
  function startEditing() {
    if (!isAdmin) return;
    const content = opts.getContent ? opts.getContent() : null;
    if (!content) return;
    pending = deepClone(content);
    // Mark every [data-editable] as contentEditable
    document.querySelectorAll('[data-editable]').forEach((el) => {
      el.setAttribute('contenteditable', 'plaintext-only');
      el.spellcheck = false;
    });
  }

  function applyEditableState() {
    if (isAdmin) startEditing();
  }

  function captureEdits() {
    if (!pending) return;
    const p = pending.profile;
    const taglineEl = document.querySelector('[data-editable="tagline"]');
    if (taglineEl) p.tagline = taglineEl.innerText.trim();
    const bioEls = document.querySelectorAll('[data-editable="bio-para"]');
    if (bioEls.length) p.bio = Array.from(bioEls).map((el) => el.innerText.trim()).filter(Boolean);
    document.querySelectorAll('[data-editable="stat-num"]').forEach((el) => {
      const i = +el.dataset.idx; if (p.stats[i]) p.stats[i].num = el.innerText.trim();
    });
    document.querySelectorAll('[data-editable="stat-lbl"]').forEach((el) => {
      const i = +el.dataset.idx; if (p.stats[i]) p.stats[i].lbl = el.innerText.trim();
    });
    document.querySelectorAll('[data-editable="career-yr"]').forEach((el) => {
      const i = +el.dataset.idx; if (pending.career[i]) pending.career[i].year = el.innerText.trim();
    });
    document.querySelectorAll('[data-editable="career-ttl"]').forEach((el) => {
      const i = +el.dataset.idx; if (pending.career[i]) pending.career[i].title = el.innerText.trim();
    });
    document.querySelectorAll('[data-editable="career-pl"]').forEach((el) => {
      const i = +el.dataset.idx; if (pending.career[i]) pending.career[i].place = el.innerText.trim();
    });
    // Album page edits
    const albumTitleEl = document.querySelector('[data-editable="album-title"]');
    if (albumTitleEl && typeof window.__ALBUM_ID === 'number') {
      const a = pending.albums[window.__ALBUM_ID];
      if (a) a.title = albumTitleEl.innerText.trim();
    }
    const albumDescEl = document.querySelector('[data-editable="album-desc"]');
    if (albumDescEl && typeof window.__ALBUM_ID === 'number') {
      const a = pending.albums[window.__ALBUM_ID];
      if (a) a.description = albumDescEl.innerText.trim();
    }
    const albumChEl = document.querySelector('[data-editable="album-chapter"]');
    if (albumChEl && typeof window.__ALBUM_ID === 'number') {
      const a = pending.albums[window.__ALBUM_ID];
      if (a) a.chapter = albumChEl.innerText.trim();
    }
  }

  async function save() {
    if (!isAdmin) return;
    if (!pending) {
      const cur = opts.getContent && opts.getContent();
      if (cur) pending = deepClone(cur);
    }
    captureEdits();
    setStatus('Saving…');
    saveBtn.disabled = true;
    try {
      const r = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(pending),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `save failed (${r.status})`);
      }
      const saved = await r.json();
      pending = deepClone(saved);
      if (opts.onContentChange) opts.onContentChange(saved);
      setDirty(false);
      toast('Saved');
    } catch (err) {
      console.error(err);
      toast('Save failed: ' + (err.message || err), true);
      setStatus('Save failed');
      saveBtn.disabled = false;
    }
  }

  // ——————————————— Mutations to pending content ———————————————
  function ensurePending() {
    if (!pending) {
      const cur = opts.getContent && opts.getContent();
      if (cur) pending = deepClone(cur);
    }
    return pending;
  }

  function mutate(fn) {
    const p = ensurePending();
    if (!p) return;
    captureEdits();
    fn(p);
    setDirty(true);
    if (opts.onContentChange) opts.onContentChange(p);
  }

  async function setProfileImage(file) {
    try {
      setStatus('Uploading photo…');
      const url = await uploadFile(file, 'profile');
      mutate((p) => { p.profile.image = url; });
      setStatus('Unsaved changes');
      toast('Photo replaced — click Save');
    } catch (err) {
      toast('Upload failed: ' + (err.message || err), true);
      setStatus('Unsaved changes');
    }
  }

  async function setAlbumCover(albumId, file) {
    try {
      setStatus('Uploading cover…');
      const url = await uploadFile(file, `cover-${albumId}`);
      mutate((p) => { if (p.albums[albumId]) p.albums[albumId].cover = url; });
      setStatus('Unsaved changes');
      toast('Cover replaced — click Save');
    } catch (err) {
      toast('Upload failed: ' + (err.message || err), true);
    }
  }

  async function addPhotos(albumId, files) {
    const fileArr = Array.from(files || []);
    if (!fileArr.length) return;
    try {
      setStatus(`Uploading ${fileArr.length} photo(s)…`);
      const urls = [];
      for (const f of fileArr) {
        const url = await uploadFile(f, (f.name || 'photo').replace(/\.[^.]+$/, ''));
        const caption = (f.name || 'Untitled').replace(/\.[^.]+$/, '');
        urls.push({ url, caption });
      }
      mutate((p) => {
        if (!p.albums[albumId]) return;
        p.albums[albumId].photos = (p.albums[albumId].photos || []).concat(urls);
      });
      setStatus('Unsaved changes');
      toast(`Added ${urls.length} photo(s) — click Save`);
    } catch (err) {
      toast('Upload failed: ' + (err.message || err), true);
    }
  }

  function removePhoto(albumId, photoIdx) {
    if (!confirm('Remove this photo?')) return;
    mutate((p) => {
      if (!p.albums[albumId] || !p.albums[albumId].photos) return;
      p.albums[albumId].photos.splice(photoIdx, 1);
    });
  }

  function addCareerEntry() {
    mutate((p) => {
      p.career = p.career || [];
      p.career.unshift({ year: new Date().getFullYear().toString(), title: 'New entry', place: '' });
    });
  }

  function removeCareerEntry(idx) {
    if (!confirm('Remove this entry?')) return;
    mutate((p) => {
      if (p.career && p.career[idx] !== undefined) p.career.splice(idx, 1);
    });
  }

  // ——————————————— Init ———————————————
  async function init(options) {
    opts = Object.assign({}, opts, options || {});

    loginModal   = document.getElementById('loginModal');
    loginPw      = document.getElementById('loginPw');
    loginErr     = document.getElementById('loginErr');
    loginSubmit  = document.getElementById('loginSubmit');
    loginCancel  = document.getElementById('loginCancel');
    adminBar     = document.getElementById('adminBar');
    saveBtn      = document.getElementById('saveAllBtn');
    logoutBtn    = document.getElementById('logoutBtn');
    saveStatus   = document.getElementById('saveStatus');
    adminTrigger = document.getElementById('adminTrigger');
    toastEl      = document.getElementById('toast');

    // Wire login modal
    if (loginSubmit) loginSubmit.addEventListener('click', attemptLogin);
    if (loginCancel) loginCancel.addEventListener('click', closeLoginModal);
    if (loginPw) loginPw.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attemptLogin();
      if (e.key === 'Escape') closeLoginModal();
    });
    if (loginModal) loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeLoginModal();
    });

    // Wire admin bar
    if (saveBtn) saveBtn.addEventListener('click', save);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Footer "·" or Ctrl+Shift+L opens login
    if (adminTrigger) adminTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      if (isAdmin) return;
      openLoginModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'L' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        if (!isAdmin) openLoginModal();
      }
    });

    // Delegated handlers (work on dynamically rendered content)
    document.addEventListener('click', (e) => {
      if (!isAdmin) return;
      const replaceBtn = e.target.closest('[data-edit]');
      if (replaceBtn) {
        e.preventDefault();
        const which = replaceBtn.dataset.edit;
        if (which === 'profile-image') {
          pickFile('image/*', false).then((files) => files && files[0] && setProfileImage(files[0]));
        } else if (which === 'album-cover') {
          const id = +replaceBtn.dataset.albumId;
          pickFile('image/*', false).then((files) => files && files[0] && setAlbumCover(id, files[0]));
        }
        return;
      }
      const addPhotosBtn = e.target.closest('[data-add-photos]');
      if (addPhotosBtn) {
        e.preventDefault();
        const id = +addPhotosBtn.dataset.addPhotos;
        pickFile('image/*', true).then((files) => files && addPhotos(id, files));
        return;
      }
      const delPhotoBtn = e.target.closest('[data-del-photo]');
      if (delPhotoBtn) {
        e.preventDefault();
        const albumId = +delPhotoBtn.dataset.albumId;
        const photoIdx = +delPhotoBtn.dataset.delPhoto;
        removePhoto(albumId, photoIdx);
        return;
      }
      const delCareerBtn = e.target.closest('[data-del-career]');
      if (delCareerBtn) {
        e.preventDefault();
        removeCareerEntry(+delCareerBtn.dataset.delCareer);
        return;
      }
      if (e.target.id === 'addCareerBtn') {
        e.preventDefault();
        addCareerEntry();
      }
    });

    // Mark dirty on edits
    document.addEventListener('input', (e) => {
      if (!isAdmin) return;
      if (e.target.matches('[data-editable]')) {
        if (!dirty) setDirty(true);
      }
    });

    // Warn on unload if dirty
    window.addEventListener('beforeunload', (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; return ''; }
    });

    // Check session
    try {
      const r = await fetch('/api/me', { cache: 'no-store' });
      const j = await r.json();
      if (j.admin) {
        isAdmin = true;
        document.body.classList.add('is-admin');
      }
    } catch {}
  }

  function pickFile(accept, multiple) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept || ''; if (multiple) inp.multiple = true;
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.addEventListener('change', () => {
        const fs = inp.files;
        document.body.removeChild(inp);
        resolve(fs);
      });
      inp.click();
    });
  }

  // Public API
  window.Admin = {
    init,
    applyEditableState,
    isAdmin: () => isAdmin,
    toast,
    pickFile,
    uploadFile,
    setProfileImage,
    setAlbumCover,
    addPhotos,
    removePhoto,
    save,
    logout,
  };
})();
