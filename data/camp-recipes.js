document.addEventListener("DOMContentLoaded", async () => {
  const recipesGrid = document.getElementById("recipesGrid");
  const modal = document.getElementById("recipeModal");
  const backdrop = document.getElementById("recipeModalBackdrop");
  const closeBtn = document.getElementById("closeRecipeModal");

  const modalImage = document.getElementById("recipeModalImage");
  const modalTitle = document.getElementById("recipeModalTitle");
  const modalSubtitle = document.getElementById("recipeModalSubtitle");
  const modalDescription = document.getElementById("recipeModalDescription");
  const modalMetaTime = document.getElementById("recipeModalTime");
  const modalMetaServes = document.getElementById("recipeModalServes");
  const modalMetaDifficulty = document.getElementById("recipeModalDifficulty");
  const modalIngredients = document.getElementById("recipeModalIngredients");
  const modalSteps = document.getElementById("recipeModalSteps");
  const modalServing = document.getElementById("recipeModalServing");
  const modalTips = document.getElementById("recipeModalTips");

  if (!recipesGrid) return;

  let recipes = [];

  function escapeHtml(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getCampData() {
    try {
      return JSON.parse(localStorage.getItem("campData")) || {};
    } catch (error) {
      return {};
    }
  }

  function getRecipeImage(recipe) {
    if (recipe?.image && recipe.image.trim() !== "") {
      return recipe.image;
    }
    return "assets/recipes/default-recipe.jpg";
  }

  function buildList(items = [], emptyText = "—") {
    if (!Array.isArray(items) || items.length === 0) {
      return `<li>${escapeHtml(emptyText)}</li>`;
    }
    return items.map(item => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function normalizeLocalRecipes(localRecipes) {
    if (Array.isArray(localRecipes) && localRecipes.length > 0) {
      return localRecipes
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .map(name => ({
          title: name,
          subtitle: "Camp Recipe",
          description: "Added from your camp builder.",
          time: "Camp Favorite",
          serves: "—",
          difficulty: "—",
          image: "assets/recipes/default-recipe.jpg",
          ingredients: ["Add ingredients in data/recipes.json for full recipe details."],
          steps: ["Add cooking steps in data/recipes.json for full recipe details."],
          serving: ["Serve it your camp’s way."],
          tips: ["Use data/recipes.json to expand this into a full recipe card."]
        }));
    }

    return [
      {
        title: "Slow Cooker BBQ Venison Backstrap",
        subtitle: "Camp Recipe",
        description: "Tender, shredded BBQ venison that is perfect for sandwiches after a long day in the woods.",
        time: "6–8 hours",
        serves: "4–6",
        difficulty: "Easy",
        image: "assets/recipes/default-recipe.jpg",
        ingredients: [
          "1–2 lbs venison backstrap",
          "1 cup BBQ sauce",
          "1/2–1 cup beef broth",
          "1 sliced onion",
          "1 tbsp garlic",
          "1 tbsp Worcestershire",
          "Salt and pepper"
        ],
        steps: [
          "Season the venison.",
          "Place all ingredients in the slow cooker.",
          "Cook on low for 6–8 hours.",
          "Shred and stir in extra sauce."
        ],
        serving: [
          "Serve on toasted buns",
          "Add coleslaw or pickles"
        ],
        tips: [
          "Low and slow keeps venison tender."
        ]
      }
    ];
  }

  function buildRecipeCard(recipe) {
    const card = document.createElement("button");
    card.className = "recipe-card";
    card.type = "button";
    card.setAttribute("aria-label", `Open recipe for ${recipe.title || "camp recipe"}`);

    const imageSrc = getRecipeImage(recipe);

    card.innerHTML = `
      <div class="recipe-card-image-wrap">
        <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(recipe.title || "Camp recipe")}" class="recipe-card-image">
        <span class="recipe-card-badge">recipe</span>
      </div>

      <div class="recipe-card-body">
        <h3 class="recipe-card-title">${escapeHtml(recipe.title || "Untitled Recipe")}</h3>
        <p class="recipe-card-description">${escapeHtml(recipe.description || "No description added yet.")}</p>

        <div class="recipe-card-meta">
          <span><strong>Time:</strong> ${escapeHtml(recipe.time || "—")}</span>
          <span><strong>Serves:</strong> ${escapeHtml(recipe.serves || "—")}</span>
          <span><strong>Difficulty:</strong> ${escapeHtml(recipe.difficulty || "—")}</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => openModal(recipe));
    return card;
  }

  function renderRecipes() {
    recipesGrid.innerHTML = "";

    if (!Array.isArray(recipes) || recipes.length === 0) {
      recipesGrid.innerHTML = `
        <div class="recipe-empty-state">
          <p>No camp recipes added yet.</p>
          <p>Add recipes in the builder or in <code>data/recipes.json</code>.</p>
        </div>
      `;
      return;
    }

    recipes.forEach(recipe => {
      recipesGrid.appendChild(buildRecipeCard(recipe));
    });
  }

  function openModal(recipe) {
    if (!modal || !backdrop) return;

    modalImage.src = getRecipeImage(recipe);
    modalImage.alt = recipe.title ? `${recipe.title} recipe image` : "Camp recipe image";

    modalTitle.textContent = recipe.title || "Untitled Recipe";
    modalSubtitle.textContent = recipe.subtitle || "Camp Recipe";
    modalDescription.textContent = recipe.description || "No description added yet.";
    modalMetaTime.textContent = recipe.time || "—";
    modalMetaServes.textContent = recipe.serves || "—";
    modalMetaDifficulty.textContent = recipe.difficulty || "—";

    modalIngredients.innerHTML = buildList(recipe.ingredients, "No ingredients added yet.");
    modalSteps.innerHTML = buildList(recipe.steps, "No method added yet.");
    modalServing.innerHTML = buildList(recipe.serving, "No serving ideas added yet.");
    modalTips.innerHTML = buildList(recipe.tips, "No camp tips added yet.");

    modal.classList.add("open");
    backdrop.classList.add("open");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    if (!modal || !backdrop) return;
    modal.classList.remove("open");
    backdrop.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  closeBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("open")) {
      closeModal();
    }
  });

  async function loadRecipes() {
    const campData = getCampData();

    try {
      const response = await fetch("data/recipes.json", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const fetchedRecipes = Array.isArray(data.recipes) ? data.recipes : [];
        recipes = fetchedRecipes.length ? fetchedRecipes : normalizeLocalRecipes(campData.recipes);
      } else {
        throw new Error("recipes json missing");
      }
    } catch (error) {
      recipes = normalizeLocalRecipes(campData.recipes);
    }

    renderRecipes();
  }

  loadRecipes();
});