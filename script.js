const form = document.querySelector(".search-panel");
const queryInput = document.querySelector('input[name="especialidade"]');
const locationInput = document.querySelector('input[name="local"]');
const feedback = document.querySelector("#search-feedback");
const searchShell = document.querySelector(".chat-search");

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = queryInput.value.trim() || "especialistas";
  const location = locationInput?.value.trim() || "Joinville";

  feedback.textContent = `Protótipo MVP: busca preparada para ${query} em ${location}. A próxima etapa liga este campo à página de resultados.`;
  feedback.classList.add("is-active");

  document.querySelector(".conversation-card")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "center"
  });
});
