(function () {
  "use strict";

  /* Mobile nav */
  const navToggle = document.querySelector(".nav__toggle");
  const navLinks = document.querySelector(".nav__links");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      navToggle.classList.toggle("is-open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("is-open");
        navToggle.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Active nav link on scroll (home page only) */
  const sections = document.querySelectorAll("section[id]");
  const navLinkEls = document.querySelectorAll(".nav__link");

  if (sections.length) {
    function updateActiveNav() {
      const scrollY = window.scrollY + 120;
      let current = "";

      sections.forEach((section) => {
        if (section.offsetTop <= scrollY) {
          current = section.getAttribute("id");
        }
      });

      navLinkEls.forEach((link) => {
        const href = link.getAttribute("href");
        link.classList.toggle("nav__link--active", href === `#${current}`);
      });
    }

    window.addEventListener("scroll", updateActiveNav, { passive: true });
  }

  /* Smooth scroll for anchor links */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const targetId = anchor.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* Team carousel */
  const carousel = document.getElementById("team-carousel");
  const prevBtn = document.getElementById("team-prev");
  const nextBtn = document.getElementById("team-next");

  if (carousel && prevBtn && nextBtn) {
    const scrollAmount = 368;

    prevBtn.addEventListener("click", () => {
      carousel.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
      carousel.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
  }

  /* Team card — collapsed bio with SAIBA MAIS */
  const teamCards = document.querySelectorAll(".team-card");

  teamCards.forEach((card) => {
    const bio = card.querySelector(".team-card__bio");
    const toggle = card.querySelector(".team-card__toggle");
    if (!bio || !toggle) return;

    const checkOverflow = () => {
      if (card.classList.contains("is-expanded")) return;
      card.classList.toggle("has-overflow", bio.scrollHeight > bio.clientHeight + 1);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);

    toggle.addEventListener("click", () => {
      const expanded = card.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", String(expanded));
      if (!expanded) checkOverflow();
    });
  });

  /* FAQ — only one open at a time */
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) {
        faqItems.forEach((other) => {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  /* Contact form validation */
  const form = document.getElementById("contact-form");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      let valid = true;
      const fields = form.querySelectorAll(".form-input[required]");

      fields.forEach((field) => {
        field.classList.remove("form-input--error");
        const existing = field.parentElement.querySelector(".form-error");
        if (existing) existing.remove();

        if (!field.value.trim()) {
          valid = false;
          field.classList.add("form-input--error");
          const err = document.createElement("p");
          err.className = "form-error";
          err.textContent = "Este campo é obrigatório.";
          field.parentElement.appendChild(err);
        } else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
          valid = false;
          field.classList.add("form-input--error");
          const err = document.createElement("p");
          err.className = "form-error";
          err.textContent = "Informe um e-mail válido.";
          field.parentElement.appendChild(err);
        }
      });

      const contactConsent = form.querySelector('[name="contactConsent"]');
      if (contactConsent && !contactConsent.checked) {
        valid = false;
        alert("É necessário autorizar o contato para enviar o formulário.");
      }

      if (valid) {
        alert("Formulário enviado com sucesso! Entraremos em contato em breve.");
        form.reset();
      }
    });
  }

  /* Placeholder images for missing assets */
  const photoFallbacks = {
    "lucas.jpg": "#000A4A",
    "matheus.jpg": "#070235",
    "bruno.jpg": "#4259F0",
    "helena.jpg": "#47464F",
    "isabelle.jpg": "#000A4A",
  };

  document.querySelectorAll(
    ".team-card__photo, .article-card__image, .artigos-card__image, .artigos-featured__image, .artigos-featured__avatar, .artigo-detail__hero-img, .artigo-detail__avatar"
  ).forEach((img) => {
    img.addEventListener("error", function onError() {
      const src = this.getAttribute("src") || "";
      const filename = src.split("/").pop();
      const color = photoFallbacks[filename] || "#000A4A";
      const label = this.alt || "Foto";

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="336" height="352"><rect fill="${color}" width="100%" height="100%"/><text fill="#F4F4F4" font-family="sans-serif" font-size="24" font-weight="600" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;

      this.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      this.removeEventListener("error", onError);
    });
  });

  /* Hero video — force muted autoplay (Safari / delayed buffer) */
  const heroVideo = document.querySelector(".hero__video");
  if (heroVideo) {
    const ensureHeroAutoplay = () => {
      heroVideo.muted = true;
      heroVideo.defaultMuted = true;
      heroVideo.setAttribute("muted", "");
      heroVideo.playsInline = true;
      const attempt = heroVideo.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => {});
      }
    };

    ensureHeroAutoplay();
    heroVideo.addEventListener("loadeddata", ensureHeroAutoplay, { once: true });
    heroVideo.addEventListener("canplay", ensureHeroAutoplay, { once: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && heroVideo.paused) ensureHeroAutoplay();
    });
  }

  // #region agent log
  (function debugHeroPerf() {
    const ENDPOINT = "http://127.0.0.1:7356/ingest/30b1e897-e730-403a-921a-cfb8f842ec31";
    const SESSION = "b4d0d7";
    const RUN = "post-fix";

    function agentLog(hypothesisId, location, message, data) {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION },
        body: JSON.stringify({
          sessionId: SESSION,
          runId: RUN,
          hypothesisId,
          location,
          message,
          data: data || {},
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }

    const video = document.querySelector(".hero__video");
    if (!video) {
      agentLog("B", "main.js:debugHeroPerf", "hero video missing", {});
      return;
    }

    const videoSnapshot = () => ({
      paused: video.paused,
      muted: video.muted,
      autoplay: video.autoplay,
      playsInline: video.playsInline,
      loop: video.loop,
      preload: video.preload,
      readyState: video.readyState,
      networkState: video.networkState,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : null,
      errorCode: video.error ? video.error.code : null,
      src: video.currentSrc || video.querySelector("source")?.src || null,
      poster: video.getAttribute("poster"),
      hasAutoplayAttr: video.hasAttribute("autoplay"),
      hasMutedAttr: video.hasAttribute("muted"),
      hasPlaysinlineAttr: video.hasAttribute("playsinline"),
    });

    agentLog("B", "main.js:hero-init", "hero video initial state", videoSnapshot());

    ["loadedmetadata", "canplay", "canplaythrough", "playing", "pause", "stalled", "waiting", "error"].forEach((evt) => {
      video.addEventListener(evt, () => {
        agentLog("A,B", `main.js:hero-${evt}`, `hero video event: ${evt}`, videoSnapshot());
      });
    });

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.then === "function") {
      playAttempt
        .then(() => agentLog("B", "main.js:hero-play-ok", "video.play() resolved", videoSnapshot()))
        .catch((err) =>
          agentLog("B", "main.js:hero-play-fail", "video.play() rejected", {
            ...videoSnapshot(),
            errorName: err && err.name,
            errorMessage: err && err.message,
          })
        );
    }

    window.addEventListener("load", () => {
      const nav = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      const videoRes = resources.find((r) => /lamy-video\.mp4/i.test(r.name));
      const heavy = resources
        .filter((r) => (r.transferSize || r.encodedBodySize || 0) > 200000)
        .map((r) => ({
          name: r.name.split("/").pop(),
          transferKB: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024),
          durationMs: Math.round(r.duration),
          initiatorType: r.initiatorType,
        }))
        .sort((a, b) => b.transferKB - a.transferKB)
        .slice(0, 12);

      agentLog("A,D", "main.js:hero-resources", "heavy resources and video timing", {
        videoTransferKB: videoRes
          ? Math.round((videoRes.transferSize || videoRes.encodedBodySize || 0) / 1024)
          : null,
        videoDurationMs: videoRes ? Math.round(videoRes.duration) : null,
        videoStartMs: videoRes ? Math.round(videoRes.startTime) : null,
        ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
        heavy,
        videoAfterLoad: videoSnapshot(),
      });

      agentLog("C", "main.js:hero-poster-check", "poster/preload attributes", {
        poster: video.getAttribute("poster"),
        preloadAttr: video.getAttribute("preload"),
        preloadProp: video.preload,
      });
    });
  })();
  // #endregion
})();
