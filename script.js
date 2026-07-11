/* ============================================================
   Medário — Firebase integration & auth-aware UX
   Uses Firebase compat SDK (loaded in index.html <head>).
   ============================================================ */

(function () {
  "use strict";

  if (typeof firebase === "undefined") return;

  /* ---------- Firebase config ---------- */
  const firebaseConfig = {
    apiKey: "AIzaSyCSs8I4hCFH1RiPVli2MriLXRugMz9xjgI",
    authDomain: "medario-doctor.firebaseapp.com",
    projectId: "medario-doctor",
    storageBucket: "medario-doctor.firebasestorage.app",
    messagingSenderId: "702082375310",
    appId: "1:702082375310:web:1b9ab93a77d6aaa6db73df",
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  /* ---------- Module state ---------- */
  let currentUser = null; // firebase.User
  let userProfile = null; // Firestore users/{uid} doc data
  let affinity = {}; // specialty -> score map from userProfile.affinity

  /* ---------- DOM refs ---------- */
  const navCta = document.querySelector(".nav-cta");
  const navUser = document.getElementById("nav-user");
  const userAvatarBtn = document.getElementById("user-avatar-btn");
  const userAvatarInitial = document.getElementById("user-avatar-initial");
  const userDropdown = document.getElementById("user-dropdown");
  const signOutBtn = document.getElementById("sign-out-btn");

  const modal = document.getElementById("bifurcation-modal");
  const modalStep1 = document.getElementById("modal-step-1");
  const modalStep2 = document.getElementById("modal-step-2");
  const modalLogin = document.getElementById("modal-login");
  const modalCloseBtn = document.getElementById("modal-close");

  const btnPaciente = document.getElementById("btn-paciente");
  const btnMedico = document.getElementById("btn-medico");

  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const switchToLogin = document.getElementById("switch-to-login");
  const switchToRegister = document.getElementById("switch-to-register");
  const modalMessages = document.querySelectorAll(".modal-message");

  const consentBanner = document.getElementById("consent-banner");
  const consentAccept = consentBanner?.querySelector(".consent-accept");
  const consentDecline = consentBanner?.querySelector(".consent-decline");

  const form = document.querySelector(".search-panel");
  const queryInput = document.querySelector('input[name="especialidade"]');
  const locationInput = document.querySelector('input[name="local"]');
  const feedback = document.querySelector("#search-feedback");
  const resultList = document.querySelector(".result-list");

  const toast = document.getElementById("toast");

  /* ============================================================
     A. Auth state listener
     ============================================================ */
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      // logged in — show avatar, hide Começar
      if (navUser) navUser.hidden = false;
      if (navCta) navCta.hidden = true;
      const initial = (user.displayName || user.email || "U").charAt(0).toUpperCase();
      if (userAvatarInitial) userAvatarInitial.textContent = initial;

      // load Firestore profile
      try {
        const snap = await db.collection("users").doc(user.uid).get();
        userProfile = snap.exists ? snap.data() : null;
        affinity = (userProfile && userProfile.affinity) || {};
      } catch (e) {
        console.warn("Medário: could not load user profile", e);
        userProfile = null;
        affinity = {};
      }
    } else {
      // logged out — show Começar, hide avatar
      if (navUser) navUser.hidden = true;
      if (navCta) navCta.hidden = false;
      userProfile = null;
      affinity = {};
      consentShownForSearch = false;
    }
  });

  /* ============================================================
     B. Bifurcation modal — open / close / steps
     ============================================================ */
  function openModal() {
    if (!modal) return;
    lastFocusedBeforeModal = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    showModalStep("step-1");
    clearModalMessage();
    const focusable = modal.querySelectorAll("button, input, a[href], select, textarea");
    if (focusable.length) focusable[0].focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    showModalStep("step-1");
    clearModalMessage();
    if (registerForm) registerForm.reset();
    if (loginForm) loginForm.reset();
    if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
  }

  function showModalStep(step) {
    // step: "step-1" | "step-2" | "login"
    [modalStep1, modalStep2, modalLogin].forEach((el) => {
      if (!el) return;
      el.hidden = true;
    });
    if (step === "step-1" && modalStep1) modalStep1.hidden = false;
    if (step === "step-2" && modalStep2) modalStep2.hidden = false;
    if (step === "login" && modalLogin) modalLogin.hidden = false;
  }

  function setModalMessage(text, isError) {
    modalMessages.forEach((message) => {
      message.textContent = text || "";
      message.hidden = !text;
      message.dataset.error = isError ? "true" : "false";
    });
  }

  function clearModalMessage() {
    setModalMessage("", false);
  }

  /* Começar button: if logged in -> go to patient page; if logged out -> open modal */
  navCta?.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentUser) {
      window.location.href = "medicos/joinville.html";
    } else {
      openModal();
    }
  });

  /* Modal close (X button, overlay click, Escape) */
  modalCloseBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hidden) closeModal();
  });

  // Focus trap inside modal (Tab cycles focusable elements)
  modal?.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !modal.hidden) {
      const focusable = modal.querySelectorAll("button:not([disabled]), input:not([disabled]), a[href], select, textarea");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* Step 1 buttons */
  btnMedico?.addEventListener("click", () => {
    window.location.href = "sou-medico.html";
  });

  btnPaciente?.addEventListener("click", () => {
    showModalStep("step-2");
  });

  /* Switch between register and login */
  switchToLogin?.addEventListener("click", (e) => {
    e.preventDefault();
    showModalStep("login");
    clearModalMessage();
  });

  switchToRegister?.addEventListener("click", (e) => {
    e.preventDefault();
    showModalStep("step-2");
    clearModalMessage();
  });

  /* ============================================================
     C. Registration form submit
     ============================================================ */
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearModalMessage();

    const email = registerForm.email.value.trim();
    const password = registerForm.senha.value;
    const cidadeBairro = registerForm["cidade-bairro"].value.trim();
    const convenio = registerForm.convenio.value;
    const tipoAtendimento = registerForm["tipo-atendimento"].value;
    const idioma = registerForm.idioma.value;
    const acessibilidade = registerForm.acessibilidade.checked;

    if (!email || !password) {
      setModalMessage("Preencha e-mail e senha.", true);
      return;
    }
    if (password.length < 6) {
      setModalMessage("A senha deve ter ao menos 6 caracteres.", true);
      return;
    }

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const uid = cred.user.uid;

      // optional display name = email prefix
      await cred.user.updateProfile({ displayName: email.split("@")[0] });

      // create Firestore user doc
      try {
        await db.collection("users").doc(uid).set({
          email: email,
          cidade: cidadeBairro || null,
          convenio: convenio || null,
          tipo_atendimento: tipoAtendimento || null,
          idioma: idioma || "Português",
          acessibilidade: !!acessibilidade,
          consent_preferences: false,
          consent_at: null,
          created_at: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (firestoreErr) {
        console.error("Medário: Firestore user doc creation failed", firestoreErr);
        try {
          await cred.user.delete();
        } catch (delErr) {
          console.error("Medário: failed to delete orphan auth user", delErr);
        }
        setModalMessage("Ocorreu um erro ao criar sua conta. Tente novamente.", true);
        return;
      }

      closeModal();
      showToast("Conta criada com sucesso! Bem-vindo ao Medário.");
    } catch (err) {
      const msg = friendlyAuthError(err);
      setModalMessage(msg, true);
    }
  });

  /* ============================================================
     D. Login form submit
     ============================================================ */
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearModalMessage();

    const email = loginForm.email.value.trim();
    const password = loginForm.senha.value;

    if (!email || !password) {
      setModalMessage("Preencha e-mail e senha.", true);
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, password);
      closeModal();
      showToast("Login realizado com sucesso!");
    } catch (err) {
      setModalMessage(friendlyAuthError(err), true);
    }
  });

  /* ============================================================
     E. User dropdown menu
     ============================================================ */
  userAvatarBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!userDropdown) return;
    const isOpen = userDropdown.hidden;
    userDropdown.hidden = !isOpen;
    userAvatarBtn.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (e) => {
    if (!userDropdown || userDropdown.hidden) return;
    if (!navUser?.contains(e.target)) {
      userDropdown.hidden = true;
      userAvatarBtn?.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && userDropdown && !userDropdown.hidden) {
      userDropdown.hidden = true;
      userAvatarBtn?.setAttribute("aria-expanded", "false");
    }
  });

  signOutBtn?.addEventListener("click", async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.warn("Medário: sign out failed", err);
    }
    if (userDropdown) userDropdown.hidden = true;
  });

  /* ============================================================
     F. Consent banner
     ============================================================ */
  let consentShownForSearch = false;
  let lastFocusedBeforeModal = null;

  function maybeShowConsentBanner() {
    if (!currentUser) return;
    const consent = userProfile ? userProfile.consent_preferences : undefined;
    if (consent === true || consent === false) return; // already chose
    if (consentBanner && consentBanner.hidden) consentBanner.hidden = false;
  }

  consentAccept?.addEventListener("click", async () => {
    if (!currentUser) return;
    try {
      await db.collection("users").doc(currentUser.uid).update({
        consent_preferences: true,
        consent_at: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (userProfile) {
        userProfile.consent_preferences = true;
        userProfile.consent_at = new Date();
      }
    } catch (e) {
      console.warn("Medário: consent update failed", e);
    }
    if (consentBanner) consentBanner.hidden = true;
  });

  consentDecline?.addEventListener("click", async () => {
    if (!currentUser) return;
    try {
      await db.collection("users").doc(currentUser.uid).update({
        consent_preferences: false,
        consent_at: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (userProfile) {
        userProfile.consent_preferences = false;
        userProfile.consent_at = new Date();
      }
    } catch (e) {
      console.warn("Medário: consent update failed", e);
    }
    if (consentBanner) consentBanner.hidden = true;
  });

  /* ============================================================
     G. Search form — auth-aware + re-ranking by affinity
     ============================================================ */
  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = queryInput.value.trim() || "especialistas";
    const location = (locationInput?.value.trim()) || "Joinville";

    feedback.textContent =
      `Protótipo MVP: busca preparada para ${query} em ${location}. A próxima etapa liga este campo à página de resultados.`;
    feedback.classList.add("is-active");

    // Consent banner check (only once per search session)
    if (!consentShownForSearch) {
      maybeShowConsentBanner();
      consentShownForSearch = true;
    }

    // Re-rank result cards by affinity if user has consented
    if (currentUser && userProfile && userProfile.consent_preferences === true) {
      rerankResultsByAffinity();
    }

    document.querySelector(".conversation-card")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
  });

  function rerankResultsByAffinity() {
    if (!resultList) return;
    const cards = Array.from(resultList.querySelectorAll(".doctor-result"));
    if (!cards.length) return;
    if (!Object.keys(affinity).length) return;

    // Determine each card's specialty text (first <p> inside .doctor-info)
    cards.forEach((card) => {
      const infoP = card.querySelector(".doctor-info p");
      let score = 0;
      if (infoP) {
        // Normalize specialty text to lowercase for robust matching
        const text = infoP.textContent.toLowerCase();
        for (const [specialty, val] of Object.entries(affinity)) {
          if (text.includes(specialty.toLowerCase())) {
            score = Math.max(score, Number(val) || 0);
          }
        }
      }
      card._affinityScore = score;
    });

    // Sort descending by affinity score (sponsored cards stay as-is visually but reorder)
    cards.sort((a, b) => (b._affinityScore || 0) - (a._affinityScore || 0));

    // Re-append in new order
    cards.forEach((card) => resultList.appendChild(card));
  }

  /* ============================================================
     H. Toast helper
     ============================================================ */
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove("is-visible");
    }, 4000);
  }

  /* ============================================================
     I. Friendly Firebase auth error messages
     ============================================================ */
  function friendlyAuthError(err) {
    const code = err && err.code ? err.code : "";
    switch (code) {
      case "auth/email-already-in-use":
        return "Este e-mail já está cadastrado. Tente entrar.";
      case "auth/invalid-email":
        return "E-mail inválido. Verifique o endereço digitado.";
      case "auth/weak-password":
        return "Senha muito fraca. Use ao menos 6 caracteres.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "E-mail ou senha incorretos.";
      case "auth/too-many-requests":
        return "Muitas tentativas. Tente novamente em alguns minutos.";
      case "auth/network-request-failed":
        return "Falha de conexão. Verifique sua internet.";
      default:
        console.error("Medário: unhandled auth error", err);
        return "Ocorreu um erro. Tente novamente.";
    }
  }

  /* ============================================================
     J. Nav toggle (hamburger) — keep existing functionality
     ============================================================ */
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  const closeNav = () => {
    if (!navToggle || !navLinks) return;
    navLinks.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Abrir menu");
  };

  navToggle?.addEventListener("click", () => {
    if (!navLinks) return;
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
  });

  navLinks?.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeNav();
  });

  document.addEventListener("click", (event) => {
    if (!navLinks?.classList.contains("is-open")) return;
    if (!navLinks.contains(event.target) && !navToggle?.contains(event.target)) closeNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navLinks?.classList.contains("is-open")) {
      closeNav();
      navToggle?.focus();
    }
  });
})();
