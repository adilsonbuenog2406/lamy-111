(function () {
  "use strict";

  const pageDataEl = document.getElementById("cms-page-data");
  const titleInput = document.getElementById("page-title");
  const slugInput = document.getElementById("page-slug");
  const saveButton = document.getElementById("save-page");
  const publishButton = document.getElementById("publish-page");
  const previewButton = document.getElementById("preview-page");
  const saveState = document.getElementById("save-state");

  if (!pageDataEl || !window.grapesjs) return;

  let page = JSON.parse(pageDataEl.textContent);

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

  function setState(message, type) {
    saveState.textContent = message;
    saveState.dataset.type = type || "idle";
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
        '<img class="cms-image" src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80" alt="Imagem da página" loading="lazy">',
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
    selectorManager: { componentFirst: true },
    deviceManager: {
      devices: [
        { name: "Desktop", width: "" },
        { name: "Tablet", width: "768px" },
        { name: "Mobile", width: "375px" },
      ],
    },
  });

  addBlocks(editor);

  if (page.project_data) {
    editor.loadProjectData(page.project_data);
    editor.setStyle(ensureBlockCss(editor.getCss()));
  } else {
    const initialHtml =
      normalizeHtml(page.html) ||
      `<section class="cms-hero">
  <div class="cms-hero__inner">
    <div class="cms-eyebrow">Nova página</div>
    <h1 class="cms-title">${page.title || "Título da página"}</h1>
    <p class="cms-text">Comece editando este conteúdo ou arraste novos blocos para a página.</p>
    <a class="cms-button" href="#">Chamada para ação</a>
  </div>
</section>`;

    editor.setComponents(normalizeHtml(initialHtml));
    editor.setStyle(ensureBlockCss(page.css));
  }

  requestAnimationFrame(() => {
    editor.refresh();
  });

  async function persistPage(options) {
    const publish = Boolean(options && options.publish);
    const silent = Boolean(options && options.silent);
    const endpoint = publish
      ? `/admin/api/pages/${page.id}/publish`
      : `/admin/api/pages/${page.id}`;
    const method = publish ? "POST" : "PUT";

    if (!silent) setState(publish ? "Publicando..." : "Salvando...", "busy");

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleInput.value,
        slug: slugInput.value,
        project_data: editor.getProjectData(),
        html: normalizeHtml(editor.getHtml()),
        css: ensureBlockCss(editor.getCss()),
        js: editor.getJs(),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Não foi possível salvar a página.");
    }

    page = data;
    titleInput.value = page.title;
    slugInput.value = page.slug;
    setState(publish ? "Publicado" : "Salvo", "saved");
    return page;
  }

  saveButton.addEventListener("click", async () => {
    try {
      await persistPage();
    } catch (error) {
      setState(error.message, "error");
    }
  });

  publishButton.addEventListener("click", async () => {
    try {
      await persistPage({ publish: true });
    } catch (error) {
      setState(error.message, "error");
    }
  });

  previewButton.addEventListener("click", async () => {
    try {
      await persistPage({ silent: true });
      window.open(`/admin/cms/pages/${page.id}/preview`, "_blank", "noopener");
    } catch (error) {
      setState(error.message, "error");
    }
  });
})();
