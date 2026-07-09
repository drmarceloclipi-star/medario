const form = document.querySelector(".search-panel");
const queryInput = document.querySelector('input[name="especialidade"]');
const locationInput = document.querySelector('input[name="local"]');
const feedback = document.querySelector("#search-feedback");
const searchShell = document.querySelector(".chat-search");
const suggestionToggle = document.querySelector(".suggestion-toggle");
const suggestions = document.querySelector("#especialidades");
const suggestionButtons = document.querySelectorAll(".quick-actions button[data-query]");

suggestionToggle?.addEventListener("click", () => {
  const isOpen = suggestionToggle.getAttribute("aria-expanded") === "true";
  suggestionToggle.setAttribute("aria-expanded", String(!isOpen));
  suggestions.hidden = isOpen;
  searchShell?.classList.toggle("has-suggestions", !isOpen);
  feedback.textContent = isOpen ? "Sugestões recolhidas." : "Escolha uma sugestão ou continue digitando.";
  feedback.classList.toggle("is-active", !isOpen);
});

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    queryInput.value = button.dataset.query || "";
    queryInput.focus();
    feedback.textContent = `Sugestão pronta: ${queryInput.value}. Ajuste se quiser e busque médicos.`;
    feedback.classList.add("is-active");
    suggestionToggle?.setAttribute("aria-expanded", "false");
    if (suggestions) suggestions.hidden = true;
    searchShell?.classList.remove("has-suggestions");
  });
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = queryInput.value.trim() || "especialistas";
  const location = locationInput.value.trim() || "Joinville";

  feedback.textContent = `Protótipo MVP: busca preparada para ${query} em ${location}. A próxima etapa liga este campo à página de resultados.`;
  feedback.classList.add("is-active");

  document.querySelector(".conversation-card")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "center"
  });
});
