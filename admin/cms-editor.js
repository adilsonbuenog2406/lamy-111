(function () {
  "use strict";

  const pageDataEl = document.getElementById("cms-page-data");
  const titleInput = document.getElementById("page-title");
  const slugInput = document.getElementById("page-slug");
  const pathInput = document.getElementById("page-path");
  const saveButton = document.getElementById("save-page");
  const publishButton = document.getElementById("publish-page");
  const previewButton = document.getElementById("preview-page");
  const deleteArticleButton = document.getElementById("delete-article");
  const saveState = document.getElementById("save-state");

  if (!pageDataEl || !window.grapesjs) return;

  let page = JSON.parse(pageDataEl.textContent);
  let hasUnsavedChanges = false;

  const blockCss = `/* cms-blocks */
.cms-section{padding:72px 20px;background:#fff;color:#10131c}
.cms-section--soft{background:#f4f6fa}
.cms-container{width:min(1120px,100%);margin:0 auto}
.cms-hero{padding:96px 20px;background:#081f4f;color:#fff}
.cms-hero__inner{width:min(1120px,100%);margin:0 auto;display:grid;gap:24px}
.cms-eyebrow{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#f2a55c}
.cms-title{margin:0;font-size:clamp(36px,6vw,68px);line-height:1.02;font-weight:800;letter-spacing:0}
.cms-heading{margin:0 0 16px;font-size:clamp(28px,4vw,44px);line-height:1.12;font-weight:800;letter-spacing:0;color:inherit}
.cms-text{margin:0 0 18px;font-size:18px;line-height:1.7;color:inherit;max-width:760px}
.cms-button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;border-radius:6px;padding:0 22px;background:#f28c28;color:#081f4f;font-weight:800;text-decoration:none}
.cms-button--dark{background:#081f4f;color:#fff}
.cms-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.cms-card{padding:24px;border:1px solid #dce2ec;border-radius:8px;background:#fff}
.cms-card h3{margin:0 0 10px;font-size:22px;line-height:1.2}
.cms-card p{margin:0;color:#4b5565;line-height:1.6}
.cms-image{width:100%;border-radius:8px;object-fit:cover}
.cms-faq{display:grid;gap:12px}
.cms-faq details{padding:18px 20px;border:1px solid #dce2ec;border-radius:8px;background:#fff}
.cms-faq summary{font-weight:800;cursor:pointer}
.cms-cta{padding:56px 20px;background:#f28c28;color:#081f4f;text-align:center}
.cms-cta .cms-text{margin-left:auto;margin-right:auto}
.cms-footer{padding:40px 20px;background:#07142e;color:#fff}
.cms-footer__inner{width:min(1120px,100%);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.cms-footer p{margin:0;color:#c8d1e2}
@media (max-width:760px){.cms-section{padding:48px 18px}.cms-hero{padding:72px 18px}.cms-grid{grid-template-columns:1fr}.cms-footer__inner{display:grid}.cms-button{width:100%}}`;

  function ensureBlockCss(css) {
    const value = String(css || "");
    const fallbackCss = ".nav__logo-text{display:none!important}";
    const withFallback = value.includes(".nav__logo-text{display:none!important}")
      ? value
      : `${fallbackCss}\n${value}`;
    return withFallback.includes("/* cms-blocks */") ? withFallback : `${blockCss}\n${withFallback}`;
  }

  function normalizeHtml(html) {
    const value = String(html || "").trim();
    if (!/<\/?(html|head|body)[\s>]/i.test(value)) return value;

    const doc = new DOMParser().parseFromString(value, "text/html");
    return doc.body.innerHTML.trim();
  }

  function isEmptyProjectData(projectData) {
    if (!projectData || typeof projectData !== "object") return true;
    const pages = projectData.pages;
    if (!Array.isArray(pages) || !pages.length) return true;

    return pages.every((pageItem) => {
      const frames = pageItem?.frames;
      if (!Array.isArray(frames) || !frames.length) return true;
      return frames.every((frame) => {
        const component = frame?.component;
        if (!component || typeof component !== "object") return true;
        const children = component.components;
        if (Array.isArray(children)) return children.length === 0;
        if (children && typeof children === "object") {
          return Object.keys(children).length === 0;
        }
        return !children;
      });
    });
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value || "");
    return element.innerHTML;
  }

  function setState(message, type) {
    saveState.textContent = message;
    saveState.dataset.type = type || "idle";
  }

  function setDirty(isDirty) {
    hasUnsavedChanges = Boolean(isDirty);
    publishButton.setAttribute("aria-disabled", hasUnsavedChanges ? "true" : "false");
    previewButton.setAttribute("aria-disabled", hasUnsavedChanges ? "true" : "false");
    if (hasUnsavedChanges) setState("Alterações não salvas", "dirty");
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo de imagem."));
      reader.readAsDataURL(file);
    });
  }

  async function loadMediaLibrary(editor) {
    try {
      const response = await fetch("/admin/api/media", {
        headers: { Accept: "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Não foi possível carregar a biblioteca de imagens.");
      }
      const assets = Array.isArray(data.assets) ? data.assets : [];
      editor.AssetManager.clear();
      if (assets.length) editor.AssetManager.add(assets);
    } catch (error) {
      console.error(error);
      setState(error.message || "Falha ao carregar imagens.", "error");
    }
  }

  function applyImageSrc(component, src) {
    if (!component || !src) return;
    // GrapesJS Image exports via model.get('src') (getAttrToHTML/getSrcResult).
    // Updating only attributes changes the canvas visually but keeps the old src on save/publish.
    if (typeof component.set === "function") {
      component.set("src", src);
    } else {
      component.addAttributes({ src });
    }
    setDirty(true);
  }

  async function uploadMediaFile(editor, file) {
    const dataUrl = await fileToBase64(file);
    const response = await fetch("/admin/api/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        data: dataUrl,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Não foi possível enviar a imagem.");
    }
    const asset = payload.asset;
    if (asset?.src) {
      editor.AssetManager.add(asset);
      const selected = editor.getSelected();
      if (isImageComponent(selected)) {
        applyImageSrc(selected, asset.src);
      }
      return asset;
    }
    throw new Error("Resposta de upload inválida.");
  }

  function isImageComponent(component) {
    if (!component) return false;
    if (typeof component.is === "function" && component.is("image")) return true;
    return String(component.get("type") || "").toLowerCase() === "image";
  }

  function openImagePicker(editor, component) {
    const target = component || editor.getSelected();
    if (!isImageComponent(target)) return;
    editor.AssetManager.open({
      types: ["image"],
      select(asset, complete) {
        const src =
          typeof asset?.getSrc === "function"
            ? asset.getSrc()
            : asset?.get?.("src") || asset?.src;
        if (src) applyImageSrc(target, src);
        if (complete) editor.AssetManager.close();
      },
    });
  }

  function ensureImageToolbar(editor, component) {
    if (!isImageComponent(component)) return;
    const toolbar = Array.isArray(component.get("toolbar")) ? component.get("toolbar").slice() : [];
    const exists = toolbar.some((item) => item && item.command === "cms-replace-image");
    if (exists) return;

    toolbar.unshift({
      attributes: {
        class: "gjs-toolbar-item cms-toolbar-replace-image",
        title: "Trocar imagem",
      },
      label: '<span class="cms-toolbar-replace-image__label">Trocar imagem</span>',
      command: "cms-replace-image",
    });
    component.set("toolbar", toolbar);
  }

  function addBlocks(editor) {
    const blocks = editor.BlockManager;

    blocks.add("cms-hero", {
      label: "Hero",
      category: "CMS",
      content: `<section class="cms-hero">
  <div class="cms-hero__inner">
    <div class="cms-eyebrow">Lamy Advogados</div>
    <h1 class="cms-title">Título principal da página</h1>
    <p class="cms-text">Use este espaço para apresentar a proposta principal com clareza e foco.</p>
    <a class="cms-button" href="#">Chamada para ação</a>
  </div>
</section>`,
    });

    blocks.add("cms-section", {
      label: "Section",
      category: "CMS",
      content: `<section class="cms-section">
  <div class="cms-container">
    <h2 class="cms-heading">Título da seção</h2>
    <p class="cms-text">Texto de apoio para explicar esta área da página.</p>
  </div>
</section>`,
    });

    blocks.add("cms-container", {
      label: "Container",
      category: "CMS",
      content: '<div class="cms-container"></div>',
    });

    blocks.add("cms-headline", {
      label: "Headline",
      category: "CMS",
      content: '<h2 class="cms-heading">Nova headline</h2>',
    });

    blocks.add("cms-text", {
      label: "Texto",
      category: "CMS",
      content: '<p class="cms-text">Edite este texto diretamente no editor visual.</p>',
    });

    blocks.add("cms-image", {
      label: "Imagem",
      category: "CMS",
      content:
        '<img class="cms-image" src="/assets/site-home/CAPA ARTIGO 01.jpg" alt="Imagem da página" loading="lazy">',
    });

    blocks.add("cms-button", {
      label: "Botão",
      category: "CMS",
      content: '<a class="cms-button cms-button--dark" href="#">Texto do botão</a>',
    });

    blocks.add("cms-cards", {
      label: "Cards",
      category: "CMS",
      content: `<section class="cms-section cms-section--soft">
  <div class="cms-container">
    <h2 class="cms-heading">Cards de conteúdo</h2>
    <div class="cms-grid">
      <article class="cms-card"><h3>Card 1</h3><p>Descrição curta do primeiro item.</p></article>
      <article class="cms-card"><h3>Card 2</h3><p>Descrição curta do segundo item.</p></article>
      <article class="cms-card"><h3>Card 3</h3><p>Descrição curta do terceiro item.</p></article>
    </div>
  </div>
</section>`,
    });

    blocks.add("cms-faq", {
      label: "FAQ",
      category: "CMS",
      content: `<section class="cms-section">
  <div class="cms-container">
    <h2 class="cms-heading">Perguntas frequentes</h2>
    <div class="cms-faq">
      <details open><summary>Primeira pergunta</summary><p class="cms-text">Resposta objetiva para a pergunta.</p></details>
      <details><summary>Segunda pergunta</summary><p class="cms-text">Resposta objetiva para a pergunta.</p></details>
      <details><summary>Terceira pergunta</summary><p class="cms-text">Resposta objetiva para a pergunta.</p></details>
    </div>
  </div>
</section>`,
    });

    blocks.add("cms-cta", {
      label: "CTA",
      category: "CMS",
      content: `<section class="cms-cta">
  <div class="cms-container">
    <h2 class="cms-heading">Pronto para avançar?</h2>
    <p class="cms-text">Inclua uma chamada final clara para orientar o próximo passo.</p>
    <a class="cms-button cms-button--dark" href="#">Falar com especialista</a>
  </div>
</section>`,
    });

    blocks.add("cms-footer", {
      label: "Footer",
      category: "CMS",
      content: `<footer class="cms-footer">
  <div class="cms-footer__inner">
    <strong>Lamy Advogados</strong>
    <p>© 2026. Todos os direitos reservados.</p>
  </div>
</footer>`,
    });
  }

  const editor = grapesjs.init({
    container: "#gjs",
    height: "100%",
    fromElement: false,
    storageManager: false,
    plugins: ["grapesjs-preset-webpage"],
    pluginsOpts: {
      "grapesjs-preset-webpage": {},
    },
    canvas: {
      styles: [
        "https://fonts.googleapis.com/css2?family=Stack+Sans+Headline:wght@400;500;600;700&family=Stack+Sans+Text:wght@700&display=swap",
      ],
    },
    selectorManager: { componentFirst: true },
    deviceManager: {
      devices: [
        { name: "Desktop", width: "" },
        { name: "Tablet", width: "768px" },
        { name: "Mobile", width: "375px" },
      ],
    },
    assetManager: {
      autoAdd: true,
      multiUpload: false,
      showUrlInput: false,
      upload: false,
      noAssets: "Nenhuma imagem na biblioteca. Arraste um arquivo ou use o botão de upload.",
      uploadFile: async (event) => {
        try {
          const files = event?.dataTransfer?.files || event?.target?.files || [];
          if (!files.length) return;
          setState("Enviando imagem...", "busy");
          for (const file of Array.from(files)) {
            await uploadMediaFile(editor, file);
          }
          setState("Imagem pronta para uso", "saved");
        } catch (error) {
          setState(error.message || "Falha no upload da imagem.", "error");
        }
      },
    },
  });

  addBlocks(editor);

  editor.Commands.add("cms-replace-image", {
    run(ed) {
      openImagePicker(ed, ed.getSelected());
    },
  });

  editor.on("component:selected", (component) => {
    ensureImageToolbar(editor, component);
  });

  editor.on("asset:open", () => {
    loadMediaLibrary(editor);
  });

  if (page.project_data && !isEmptyProjectData(page.project_data)) {
    editor.loadProjectData(page.project_data);
    editor.setStyle(ensureBlockCss(editor.getCss() || page.css));
  } else {
    const initialHtml =
      normalizeHtml(page.html) ||
      `<section class="cms-hero">
  <div class="cms-hero__inner">
    <div class="cms-eyebrow">Nova página</div>
    <h1 class="cms-title">${escapeHtml(page.title || "Título da página")}</h1>
    <p class="cms-text">Comece editando este conteúdo ou arraste novos blocos para a página.</p>
    <a class="cms-button" href="#">Chamada para ação</a>
  </div>
</section>`;

    editor.setComponents(normalizeHtml(initialHtml));
    editor.setStyle(ensureBlockCss(page.css));
  }

  loadMediaLibrary(editor);

  requestAnimationFrame(() => {
    editor.refresh();
    editor.on("update", () => setDirty(true));
    titleInput.addEventListener("input", () => setDirty(true));
    slugInput.addEventListener("input", () => setDirty(true));
  });

  async function saveDraft() {
    setState("Salvando rascunho...", "busy");

    const response = await fetch(`/admin/api/pages/${page.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        title: titleInput.value,
        slug: page.is_article ? page.slug : slugInput.value,
        project_data: editor.getProjectData(),
        html: normalizeHtml(editor.getHtml()),
        css: ensureBlockCss(editor.getCss()),
        js: editor.getJs(),
      }),
    });

    const raw = await response.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(
        response.ok
          ? "Resposta inválida do servidor ao salvar."
          : raw.trim() || "Não foi possível salvar a página."
      );
    }
    if (!response.ok) {
      throw new Error((data && data.error) || "Não foi possível salvar a página.");
    }

    page = data;
    titleInput.value = page.title;
    slugInput.value = page.slug;
    if (pathInput && page.path) pathInput.value = page.path;
    setDirty(false);
    setState(
      page.status === "published" || page.is_published
        ? "Salvo · ainda não publicado"
        : "Rascunho salvo",
      "saved"
    );
    return page;
  }

  saveButton.addEventListener("click", async () => {
    try {
      await saveDraft();
    } catch (error) {
      setState(error.message, "error");
    }
  });

  publishButton.addEventListener("click", async () => {
    try {
      if (hasUnsavedChanges) {
        throw new Error("Salve o rascunho antes de publicar.");
      }

      setState("Publicando rascunho salvo...", "busy");
      const response = await fetch(`/admin/api/pages/${page.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Não foi possível publicar a página.");
      }

      page = data;
      setState("Publicado", "saved");
    } catch (error) {
      setState(error.message, "error");
    }
  });

  previewButton.addEventListener("click", async () => {
    try {
      if (hasUnsavedChanges) {
        throw new Error("Salve o rascunho antes de abrir o Preview.");
      }
      window.open(`/admin/cms/pages/${page.id}/preview`, "_blank", "noopener");
    } catch (error) {
      setState(error.message, "error");
    }
  });

  if (deleteArticleButton) {
    deleteArticleButton.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Tem certeza que deseja excluir este artigo? Esta ação removerá o artigo da listagem de Artigos e Notícias e deixará sua página indisponível."
      );
      if (!confirmed) return;

      try {
        setState("Excluindo artigo...", "busy");
        deleteArticleButton.disabled = true;
        const response = await fetch(`/admin/api/articles/${page.id}`, {
          method: "DELETE",
          headers: { Accept: "application/json" },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Não foi possível excluir o artigo.");
        }
        window.location.href = "/admin/cms/pages";
      } catch (error) {
        deleteArticleButton.disabled = false;
        setState(error.message, "error");
      }
    });
  }
})();
