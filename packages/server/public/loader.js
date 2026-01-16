/**
 * Bifrost CMS - Client-Side Loader
 *
 * This script enables inline content editing on any website.
 * Include it with: <script src="YOUR_BIFROST_URL/loader.js" data-site="YOUR_API_KEY"></script>
 */
(function() {
  'use strict';

  // Get configuration from script tag (handle both static and dynamic loading)
  const scriptTag = document.currentScript || document.querySelector('script[data-site]');
  const apiKey = scriptTag?.getAttribute('data-site');
  const baseUrl = scriptTag?.src?.replace('/loader.js', '') || window.location.origin;
  const apiUrl = scriptTag?.getAttribute('data-api') || baseUrl + '/api';

  if (!apiKey) {
    console.error('[Bifrost] Missing data-site attribute with API key');
    return;
  }

  // Check if edit mode is enabled via URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const editModeEnabled = urlParams.get('edit') === 'true';

  console.log('[Bifrost] Edit mode enabled:', editModeEnabled);

  // State
  let siteId = null;
  let isAuthenticated = false;
  let authToken = null;
  let schema = null;
  let content = {};
  let collections = {};
  let editMode = false;
  let currentEditor = null;
  let currentCollectionModal = null;

  // Styles
  const styles = `
    .bifrost-toolbar {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .bifrost-btn {
      padding: 12px 24px;
      border-radius: 50px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .bifrost-btn-primary {
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      color: white;
    }
    .bifrost-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
    }
    .bifrost-btn-success {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
    }
    .bifrost-btn-danger {
      background: #ef4444;
      color: white;
      padding: 8px 16px;
      margin-right: 8px;
    }
    .bifrost-login-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .bifrost-login-box {
      background: #1f2937;
      padding: 32px;
      border-radius: 16px;
      width: 100%;
      max-width: 400px;
      color: white;
    }
    .bifrost-login-box h2 {
      margin: 0 0 24px 0;
      font-size: 24px;
      text-align: center;
    }
    .bifrost-login-box input {
      width: 100%;
      padding: 12px 16px;
      margin-bottom: 16px;
      border: 1px solid #374151;
      border-radius: 8px;
      background: #111827;
      color: white;
      font-size: 14px;
      box-sizing: border-box;
    }
    .bifrost-login-box input:focus {
      outline: none;
      border-color: #8b5cf6;
    }
    .bifrost-login-box button[type="submit"] {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .bifrost-login-box .error {
      color: #ef4444;
      font-size: 14px;
      margin-bottom: 16px;
      text-align: center;
    }
    .bifrost-login-box .close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 24px;
      cursor: pointer;
    }
    .bifrost-editable {
      position: relative;
      transition: outline 0.2s;
    }
    .bifrost-edit-mode .bifrost-editable:hover {
      outline: 2px dashed #8b5cf6 !important;
      outline-offset: 4px;
      cursor: pointer;
    }
    .bifrost-editable.editing {
      outline: 2px solid #22c55e !important;
      outline-offset: 4px;
    }
    .bifrost-editor-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100001;
    }
    .bifrost-editor {
      background: #1f2937;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      padding: 16px;
      min-width: 300px;
      max-width: 500px;
      width: 90%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
    }
    .bifrost-editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .bifrost-editor-title {
      font-weight: 600;
      font-size: 14px;
      color: #d1d5db;
    }
    .bifrost-editor-close {
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .bifrost-editor textarea,
    .bifrost-editor input[type="text"] {
      width: 100%;
      padding: 12px;
      border: 1px solid #374151;
      border-radius: 8px;
      background: #111827;
      color: white;
      font-size: 14px;
      resize: vertical;
      min-height: 80px;
      box-sizing: border-box;
    }
    .bifrost-editor input[type="text"] {
      min-height: auto;
    }
    .bifrost-editor-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
    .bifrost-editor-actions button {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .bifrost-editor-actions .cancel {
      background: #374151;
      color: white;
    }
    .bifrost-editor-actions .save {
      background: #22c55e;
      color: white;
    }
    /* Image upload styles */
    .bifrost-image-upload {
      border: 2px dashed #374151;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .bifrost-image-upload:hover {
      border-color: #8b5cf6;
    }
    .bifrost-image-upload.dragover {
      border-color: #22c55e;
      background: rgba(34, 197, 94, 0.1);
    }
    .bifrost-image-upload input[type="file"] {
      display: none;
    }
    .bifrost-image-preview {
      max-width: 100%;
      max-height: 200px;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .bifrost-image-upload-text {
      color: #9ca3af;
      font-size: 14px;
    }
    .bifrost-uploading {
      color: #8b5cf6;
    }
    /* Rich text toolbar */
    .bifrost-richtext-toolbar {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
      padding: 8px;
      background: #111827;
      border-radius: 8px 8px 0 0;
      border: 1px solid #374151;
      border-bottom: none;
    }
    .bifrost-richtext-toolbar button {
      padding: 6px 10px;
      background: transparent;
      border: 1px solid #374151;
      border-radius: 4px;
      color: #d1d5db;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    }
    .bifrost-richtext-toolbar button:hover {
      background: #374151;
    }
    .bifrost-richtext-toolbar button.active {
      background: #8b5cf6;
      border-color: #8b5cf6;
    }
    .bifrost-richtext-editor {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      border: 1px solid #374151;
      border-radius: 0 0 8px 8px;
      background: #111827;
      color: white;
      font-size: 14px;
      overflow-y: auto;
      box-sizing: border-box;
    }
    .bifrost-richtext-editor:focus {
      outline: none;
      border-color: #8b5cf6;
    }
    .bifrost-editor-actions .save {
      background: #22c55e;
      color: white;
    }
    .bifrost-toast {
      position: fixed;
      bottom: 80px;
      right: 20px;
      padding: 12px 24px;
      border-radius: 8px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 100002;
      animation: bifrost-slide-in 0.3s ease;
    }
    .bifrost-toast.success { background: #22c55e; }
    .bifrost-toast.error { background: #ef4444; }
    @keyframes bifrost-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    /* Collection editor styles */
    .bifrost-collection-container {
      position: relative;
    }
    .bifrost-edit-mode .bifrost-collection-container:hover {
      outline: 2px dashed #f59e0b !important;
      outline-offset: 4px;
    }
    .bifrost-collection-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .bifrost-collection-box {
      background: #1f2937;
      padding: 24px;
      border-radius: 16px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      color: white;
    }
    .bifrost-collection-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .bifrost-collection-header h2 {
      margin: 0;
      font-size: 20px;
    }
    .bifrost-collection-item {
      background: #374151;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      cursor: grab;
    }
    .bifrost-collection-item:hover {
      background: #4b5563;
    }
    .bifrost-collection-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .bifrost-collection-item-title {
      font-weight: 600;
    }
    .bifrost-collection-item-actions button {
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 14px;
    }
    .bifrost-collection-item-actions button:hover {
      color: white;
    }
    .bifrost-collection-item-actions .delete:hover {
      color: #ef4444;
    }
    .bifrost-collection-add {
      width: 100%;
      padding: 12px;
      background: transparent;
      border: 2px dashed #374151;
      border-radius: 8px;
      color: #9ca3af;
      cursor: pointer;
      font-size: 14px;
      margin-top: 12px;
    }
    .bifrost-collection-add:hover {
      border-color: #8b5cf6;
      color: white;
    }
    .bifrost-item-form {
      background: #374151;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .bifrost-item-form label {
      display: block;
      font-size: 12px;
      color: #9ca3af;
      margin-bottom: 4px;
    }
    .bifrost-item-form input,
    .bifrost-item-form textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #4b5563;
      border-radius: 6px;
      background: #1f2937;
      color: white;
      font-size: 14px;
      margin-bottom: 12px;
      box-sizing: border-box;
    }
    .bifrost-item-form textarea {
      min-height: 80px;
      resize: vertical;
    }
    .bifrost-item-form-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .bifrost-item-form-actions button {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      font-size: 13px;
      cursor: pointer;
    }
  `;

  // Inject styles
  function injectStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Toast notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `bifrost-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // API calls (public - uses API key)
  async function publicApi(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    };

    const response = await fetch(`${apiUrl}/public${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data.data;
  }

  // API calls (client - uses JWT token)
  async function clientApi(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${apiUrl}/client${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data.data;
  }

  // Auth API call
  async function authApi(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${apiUrl}/auth${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data.data;
  }

  // Load site info
  async function loadSiteInfo() {
    try {
      const data = await publicApi('/site');
      siteId = data.id;
      schema = data.schema;
      console.log('[Bifrost] Site loaded:', data.name);
    } catch (error) {
      console.error('[Bifrost] Failed to load site info:', error);
    }
  }

  // Load content from API
  async function loadContent() {
    try {
      const data = await publicApi('/content');
      content = data || {};
      applyContent();
    } catch (error) {
      console.error('[Bifrost] Failed to load content:', error);
    }
  }

  // Apply content to DOM
  function applyContent() {
    document.querySelectorAll('[data-bifrost]').forEach(el => {
      const fieldKey = el.getAttribute('data-bifrost');
      if (content[fieldKey] !== undefined) {
        const fieldSchema = schema?.fields?.[fieldKey] || {};
        const fieldType = fieldSchema.type || detectFieldType(el);

        if (fieldType === 'image') {
          el.src = content[fieldKey];
        } else if (fieldType === 'richtext') {
          el.innerHTML = content[fieldKey];
        } else {
          el.textContent = content[fieldKey];
        }
      }
      el.classList.add('bifrost-editable');
    });
  }

  // Login modal
  function showLoginModal() {
    const modal = document.createElement('div');
    modal.className = 'bifrost-login-modal';
    modal.innerHTML = `
      <div class="bifrost-login-box" style="position: relative;">
        <button class="close-btn" type="button">&times;</button>
        <h2>Connexion Bifrost</h2>
        <div class="error" style="display: none;"></div>
        <form>
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Mot de passe" required />
          <button type="submit">Se connecter</button>
        </form>
      </div>
    `;

    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = () => modal.remove();

    const form = modal.querySelector('form');
    const errorDiv = modal.querySelector('.error');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = form.email.value;
      const password = form.password.value;

      try {
        const data = await authApi('/client/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, siteId }),
        });

        authToken = data.token;
        isAuthenticated = true;
        localStorage.setItem('bifrost_token_' + siteId, authToken);
        modal.remove();
        enableEditMode();
        showToast('Connecte !');
      } catch (error) {
        errorDiv.textContent = error.message || 'Identifiants incorrects';
        errorDiv.style.display = 'block';
      }
    };

    document.body.appendChild(modal);
    modal.querySelector('input[name="email"]').focus();
  }

  // Enable edit mode
  function enableEditMode() {
    editMode = true;
    document.body.classList.add('bifrost-edit-mode');

    document.querySelectorAll('.bifrost-editable').forEach(el => {
      el.addEventListener('click', handleElementClick);
    });

    // Setup collection containers
    setupCollectionContainers();

    updateToolbar();
  }

  // Disable edit mode
  function disableEditMode() {
    editMode = false;
    document.body.classList.remove('bifrost-edit-mode');

    document.querySelectorAll('.bifrost-editable').forEach(el => {
      el.removeEventListener('click', handleElementClick);
    });

    // Remove collection click handlers
    document.querySelectorAll('[data-bifrost-collection]').forEach(container => {
      container.removeEventListener('click', handleCollectionClick);
    });

    closeEditor();
    closeCollectionModal();
    updateToolbar();
  }

  // Handle element click in edit mode
  function handleElementClick(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.currentTarget;
    const fieldKey = el.getAttribute('data-bifrost');

    openEditor(el, fieldKey);
  }

  // Open inline editor
  function openEditor(el, fieldKey) {
    closeEditor();

    const fieldSchema = schema?.fields?.[fieldKey] || {};
    const fieldType = fieldSchema.type || detectFieldType(el);
    const fieldLabel = fieldSchema.label || fieldKey;
    const currentValue = content[fieldKey] ?? (fieldType === 'image' ? el.src : el.innerHTML);

    el.classList.add('editing');

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'bifrost-editor-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) closeEditor();
    };

    const editor = document.createElement('div');
    editor.className = 'bifrost-editor';

    let editorContent = '';

    if (fieldType === 'image') {
      editorContent = createImageEditor(currentValue);
    } else if (fieldType === 'richtext') {
      editorContent = createRichTextEditor(currentValue);
    } else if (fieldType === 'textarea') {
      editorContent = `<textarea>${escapeHtml(currentValue)}</textarea>`;
    } else {
      editorContent = `<input type="text" value="${escapeHtml(currentValue)}" />`;
    }

    editor.innerHTML = `
      <div class="bifrost-editor-header">
        <span class="bifrost-editor-title">${escapeHtml(fieldLabel)}</span>
        <button class="bifrost-editor-close">&times;</button>
      </div>
      ${editorContent}
      <div class="bifrost-editor-actions">
        <button class="cancel">Annuler</button>
        <button class="save">Enregistrer</button>
      </div>
    `;

    editor.querySelector('.bifrost-editor-close').onclick = closeEditor;
    editor.querySelector('.cancel').onclick = closeEditor;
    editor.querySelector('.save').onclick = () => saveField(el, fieldKey, editor, fieldType);

    // Setup field-specific handlers
    if (fieldType === 'image') {
      setupImageUpload(editor);
    } else if (fieldType === 'richtext') {
      setupRichTextToolbar(editor);
    } else {
      const input = editor.querySelector('textarea, input');
      input.onkeydown = (e) => {
        if (e.key === 'Escape') closeEditor();
        if (e.key === 'Enter' && !e.shiftKey && fieldType === 'text') {
          e.preventDefault();
          saveField(el, fieldKey, editor, fieldType);
        }
      };
    }

    overlay.appendChild(editor);
    document.body.appendChild(overlay);

    // Focus appropriate element
    const focusEl = editor.querySelector('textarea, input, .bifrost-richtext-editor');
    if (focusEl) {
      focusEl.focus();
      if (focusEl.select) focusEl.select();
    }

    currentEditor = { overlay, editor, element: el, fieldType };
  }

  // Detect field type from element
  function detectFieldType(el) {
    if (el.tagName === 'IMG') return 'image';
    if (el.tagName === 'P' || el.tagName === 'DIV') return 'textarea';
    return 'text';
  }

  // Create image editor HTML
  function createImageEditor(currentValue) {
    const hasImage = currentValue && currentValue !== 'undefined';
    return `
      <div class="bifrost-image-upload" id="bifrost-dropzone">
        ${hasImage ? `<img src="${escapeHtml(currentValue)}" class="bifrost-image-preview" />` : ''}
        <p class="bifrost-image-upload-text">
          ${hasImage ? 'Cliquez ou glissez pour changer' : 'Cliquez ou glissez une image'}
        </p>
        <input type="file" accept="image/*" id="bifrost-file-input" />
        <input type="hidden" id="bifrost-image-url" value="${hasImage ? escapeHtml(currentValue) : ''}" />
      </div>
    `;
  }

  // Create rich text editor HTML
  function createRichTextEditor(currentValue) {
    return `
      <div class="bifrost-richtext-toolbar">
        <button type="button" data-command="bold" title="Gras"><b>G</b></button>
        <button type="button" data-command="italic" title="Italique"><i>I</i></button>
        <button type="button" data-command="underline" title="Souligne"><u>S</u></button>
        <button type="button" data-command="createLink" title="Lien">🔗</button>
        <button type="button" data-command="removeFormat" title="Supprimer formatage">✕</button>
      </div>
      <div class="bifrost-richtext-editor" contenteditable="true">${currentValue}</div>
    `;
  }

  // Setup image upload handlers
  function setupImageUpload(editor) {
    const dropzone = editor.querySelector('#bifrost-dropzone');
    const fileInput = editor.querySelector('#bifrost-file-input');
    const urlInput = editor.querySelector('#bifrost-image-url');

    dropzone.onclick = () => fileInput.click();

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    };

    dropzone.ondragleave = () => {
      dropzone.classList.remove('dragover');
    };

    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        uploadImage(file, dropzone, urlInput);
      }
    };

    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (file) {
        uploadImage(file, dropzone, urlInput);
      }
    };
  }

  // Upload image to server
  async function uploadImage(file, dropzone, urlInput) {
    const textEl = dropzone.querySelector('.bifrost-image-upload-text');
    textEl.textContent = 'Upload en cours...';
    textEl.classList.add('bifrost-uploading');

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${apiUrl}/client/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Upload failed');
      }

      const imageUrl = data.data.url;
      urlInput.value = imageUrl;

      // Update preview
      let preview = dropzone.querySelector('.bifrost-image-preview');
      if (!preview) {
        preview = document.createElement('img');
        preview.className = 'bifrost-image-preview';
        dropzone.insertBefore(preview, textEl);
      }
      preview.src = imageUrl;

      textEl.textContent = 'Cliquez ou glissez pour changer';
      textEl.classList.remove('bifrost-uploading');
      showToast('Image uploadee !');
    } catch (error) {
      textEl.textContent = 'Erreur - Reessayez';
      textEl.classList.remove('bifrost-uploading');
      showToast(error.message || 'Erreur upload', 'error');
    }
  }

  // Setup rich text toolbar
  function setupRichTextToolbar(editor) {
    const toolbar = editor.querySelector('.bifrost-richtext-toolbar');
    const editorDiv = editor.querySelector('.bifrost-richtext-editor');

    toolbar.querySelectorAll('button').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const command = btn.dataset.command;

        if (command === 'createLink') {
          const url = prompt('URL du lien:');
          if (url) {
            document.execCommand(command, false, url);
          }
        } else {
          document.execCommand(command, false, null);
        }

        editorDiv.focus();
      };
    });

    editorDiv.onkeydown = (e) => {
      if (e.key === 'Escape') closeEditor();
    };
  }

  // ==================== COLLECTIONS ====================

  // Load collections
  async function loadCollections() {
    try {
      const data = await clientApi('/collections');
      collections = data || {};
    } catch (error) {
      console.log('[Bifrost] No collections or not authenticated');
    }
  }

  // Setup collection containers
  function setupCollectionContainers() {
    document.querySelectorAll('[data-bifrost-collection]').forEach(container => {
      container.classList.add('bifrost-collection-container');
      container.addEventListener('click', handleCollectionClick);
    });
  }

  // Handle collection container click
  function handleCollectionClick(e) {
    if (!editMode) return;

    // Don't trigger if clicking on an editable element inside
    if (e.target.closest('[data-bifrost]')) return;

    e.preventDefault();
    e.stopPropagation();

    const container = e.currentTarget;
    const collectionType = container.getAttribute('data-bifrost-collection');

    openCollectionModal(collectionType, container);
  }

  // Open collection editor modal
  async function openCollectionModal(collectionType, container) {
    closeCollectionModal();

    // Load collection items
    let items = [];
    try {
      items = await clientApi(`/collections/${collectionType}`);
    } catch (error) {
      showToast('Erreur chargement collection', 'error');
      return;
    }

    const collectionSchema = schema?.collections?.[collectionType] || {};
    const collectionLabel = collectionSchema.label || collectionType;
    const fields = collectionSchema.fields || {};

    const modal = document.createElement('div');
    modal.className = 'bifrost-collection-modal';
    modal.innerHTML = `
      <div class="bifrost-collection-box">
        <div class="bifrost-collection-header">
          <h2>${escapeHtml(collectionLabel)}</h2>
          <button class="bifrost-editor-close">&times;</button>
        </div>
        <div class="bifrost-collection-items"></div>
        <button class="bifrost-collection-add">+ Ajouter un element</button>
      </div>
    `;

    const itemsContainer = modal.querySelector('.bifrost-collection-items');

    // Render items
    function renderItems() {
      itemsContainer.innerHTML = '';
      items.forEach((item, index) => {
        const itemEl = createCollectionItemElement(item, fields, collectionType, () => {
          items = items.filter(i => i.id !== item.id);
          renderItems();
          renderCollectionInDOM(collectionType, items, container);
        }, (updatedItem) => {
          items[index] = updatedItem;
          renderItems();
          renderCollectionInDOM(collectionType, items, container);
        });
        itemsContainer.appendChild(itemEl);
      });
    }

    renderItems();

    // Close button
    modal.querySelector('.bifrost-editor-close').onclick = closeCollectionModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeCollectionModal();
    };

    // Add button
    modal.querySelector('.bifrost-collection-add').onclick = () => {
      showCollectionItemForm(itemsContainer, fields, collectionType, null, (newItem) => {
        items.push(newItem);
        renderItems();
        renderCollectionInDOM(collectionType, items, container);
      });
    };

    document.body.appendChild(modal);
    currentCollectionModal = modal;
  }

  // Create collection item element
  function createCollectionItemElement(item, fields, collectionType, onDelete, onUpdate) {
    const el = document.createElement('div');
    el.className = 'bifrost-collection-item';

    // Get first text field for title
    const firstField = Object.keys(fields)[0];
    const title = item.data?.[firstField] || item.id;

    el.innerHTML = `
      <div class="bifrost-collection-item-header">
        <span class="bifrost-collection-item-title">${escapeHtml(String(title).slice(0, 50))}</span>
        <div class="bifrost-collection-item-actions">
          <button class="edit">Modifier</button>
          <button class="delete">Supprimer</button>
        </div>
      </div>
    `;

    el.querySelector('.edit').onclick = (e) => {
      e.stopPropagation();
      const parent = el.parentElement;
      const itemForm = showCollectionItemForm(parent, fields, collectionType, item, onUpdate, el);
    };

    el.querySelector('.delete').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Supprimer cet element ?')) return;

      try {
        await clientApi(`/collections/${collectionType}/${item.id}`, {
          method: 'DELETE',
        });
        showToast('Element supprime');
        onDelete();
      } catch (error) {
        showToast(error.message || 'Erreur', 'error');
      }
    };

    return el;
  }

  // Show collection item form (create or edit)
  function showCollectionItemForm(container, fields, collectionType, existingItem, onSave, replaceEl = null) {
    // Remove any existing form
    container.querySelectorAll('.bifrost-item-form').forEach(f => f.remove());

    const form = document.createElement('div');
    form.className = 'bifrost-item-form';

    let fieldsHtml = '';
    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
      const value = existingItem?.data?.[fieldKey] || '';
      const label = fieldDef.label || fieldKey;
      const type = fieldDef.type || 'text';

      if (type === 'textarea') {
        fieldsHtml += `
          <label>${escapeHtml(label)}</label>
          <textarea name="${escapeHtml(fieldKey)}">${escapeHtml(value)}</textarea>
        `;
      } else {
        fieldsHtml += `
          <label>${escapeHtml(label)}</label>
          <input type="text" name="${escapeHtml(fieldKey)}" value="${escapeHtml(value)}" />
        `;
      }
    }

    form.innerHTML = `
      ${fieldsHtml}
      <div class="bifrost-item-form-actions">
        <button class="cancel" style="background: #374151; color: white;">Annuler</button>
        <button class="save" style="background: #22c55e; color: white;">
          ${existingItem ? 'Modifier' : 'Creer'}
        </button>
      </div>
    `;

    form.querySelector('.cancel').onclick = () => form.remove();

    form.querySelector('.save').onclick = async () => {
      const data = {};
      for (const fieldKey of Object.keys(fields)) {
        const input = form.querySelector(`[name="${fieldKey}"]`);
        if (input) {
          data[fieldKey] = input.value;
        }
      }

      try {
        let result;
        if (existingItem) {
          result = await clientApi(`/collections/${collectionType}/${existingItem.id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
          });
          showToast('Element modifie');
        } else {
          result = await clientApi(`/collections/${collectionType}`, {
            method: 'POST',
            body: JSON.stringify(data),
          });
          showToast('Element cree');
        }
        form.remove();
        onSave(result);
      } catch (error) {
        showToast(error.message || 'Erreur', 'error');
      }
    };

    if (replaceEl) {
      replaceEl.style.display = 'none';
      replaceEl.after(form);
      form.addEventListener('transitionend', () => {
        replaceEl.style.display = '';
      }, { once: true });
    } else {
      container.insertBefore(form, container.firstChild);
    }

    // Focus first input
    const firstInput = form.querySelector('input, textarea');
    if (firstInput) firstInput.focus();

    return form;
  }

  // Render collection items in DOM using template
  function renderCollectionInDOM(collectionType, items, container) {
    const templateId = container.getAttribute('data-bifrost-template');
    const template = document.getElementById(templateId);

    if (!template) return;

    // Remove all non-template children
    Array.from(container.children).forEach(child => {
      if (child.tagName !== 'TEMPLATE') {
        child.remove();
      }
    });

    // Add items using template
    items.forEach(item => {
      const clone = template.content.cloneNode(true);

      // Fill in data-field elements
      clone.querySelectorAll('[data-field]').forEach(el => {
        const fieldKey = el.getAttribute('data-field');
        if (item.data?.[fieldKey] !== undefined) {
          el.textContent = item.data[fieldKey];
        }
      });

      container.appendChild(clone);
    });
  }

  // Close collection modal
  function closeCollectionModal() {
    if (currentCollectionModal) {
      currentCollectionModal.remove();
      currentCollectionModal = null;
    }
  }

  // ==================== END COLLECTIONS ====================

  // Close editor
  function closeEditor() {
    if (currentEditor) {
      currentEditor.overlay.remove();
      currentEditor.element.classList.remove('editing');
      currentEditor = null;
    }
  }

  // Save field
  async function saveField(el, fieldKey, editor, fieldType) {
    let newValue;

    if (fieldType === 'image') {
      newValue = editor.querySelector('#bifrost-image-url').value;
    } else if (fieldType === 'richtext') {
      newValue = editor.querySelector('.bifrost-richtext-editor').innerHTML;
    } else {
      const input = editor.querySelector('textarea, input[type="text"]');
      newValue = input.value;
    }

    try {
      await clientApi('/content', {
        method: 'PUT',
        body: JSON.stringify({
          [fieldKey]: newValue
        }),
      });

      content[fieldKey] = newValue;

      // Update DOM based on field type
      if (fieldType === 'image') {
        el.src = newValue;
      } else if (fieldType === 'richtext') {
        el.innerHTML = newValue;
      } else {
        el.textContent = newValue;
      }

      closeEditor();
      showToast('Enregistre !');
    } catch (error) {
      showToast(error.message || 'Erreur', 'error');
    }
  }

  // Escape HTML
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Logout
  function logout() {
    authToken = null;
    isAuthenticated = false;
    localStorage.removeItem('bifrost_token_' + siteId);
    disableEditMode();
    showToast('Deconnecte');
  }

  // Create toolbar
  function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'bifrost-toolbar';
    toolbar.id = 'bifrost-toolbar';
    document.body.appendChild(toolbar);
    updateToolbar();
  }

  // Update toolbar
  function updateToolbar() {
    const toolbar = document.getElementById('bifrost-toolbar');
    if (!toolbar) return;

    // Only show toolbar if edit mode is enabled via URL (?edit=true) or user is authenticated
    if (!editModeEnabled && !isAuthenticated) {
      toolbar.style.display = 'none';
      return;
    }
    toolbar.style.display = 'block';

    if (!isAuthenticated) {
      toolbar.innerHTML = `
        <button class="bifrost-btn bifrost-btn-primary" id="bifrost-login">
          Editer
        </button>
      `;
      document.getElementById('bifrost-login').onclick = showLoginModal;
    } else if (editMode) {
      toolbar.innerHTML = `
        <button class="bifrost-btn bifrost-btn-danger" id="bifrost-logout">
          Deconnexion
        </button>
        <button class="bifrost-btn bifrost-btn-success" id="bifrost-done">
          Terminer
        </button>
      `;
      document.getElementById('bifrost-logout').onclick = logout;
      document.getElementById('bifrost-done').onclick = disableEditMode;
    } else {
      toolbar.innerHTML = `
        <button class="bifrost-btn bifrost-btn-primary" id="bifrost-edit">
          Mode edition
        </button>
      `;
      document.getElementById('bifrost-edit').onclick = enableEditMode;
    }
  }

  // Check for existing token
  function checkExistingAuth() {
    if (!siteId) return;
    const token = localStorage.getItem('bifrost_token_' + siteId);
    if (token) {
      authToken = token;
      isAuthenticated = true;
    }
  }

  // Initialize
  async function init() {
    injectStyles();
    await loadSiteInfo();
    checkExistingAuth();
    await loadContent();
    createToolbar();
    console.log('[Bifrost] Ready - ' + document.querySelectorAll('[data-bifrost]').length + ' editable elements found');
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
