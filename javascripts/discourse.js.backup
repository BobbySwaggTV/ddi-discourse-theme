(function () {
	function getPath() {
		var path = window.location.pathname || "/";
		return path.replace(/\/+$/, "") || "/";
	}

	function isCommandHomepage() {
		var path = getPath();
		return path === "/" || path === "/categories";
	}

	function classifyCategory(title) {
		var normalized = (title || "").toLowerCase();

		if (/corporate|policy|announcement|charter/.test(normalized)) {
			return {
				section: "corporate-command",
				sectionTitle: "Corporate Command",
				sectionDescription:
					"Organization information, policies, and executive announcements.",
				classification: "Corporate Access",
				code: "CC",
				status: "Public Briefing",
			};
		}

		if (/operation|mission|event|update|intel|brief/.test(normalized)) {
			return {
				section: "operations-center",
				sectionTitle: "Operations Center",
				sectionDescription:
					"Events, operational updates, and mission communications.",
				classification: "Operational Access",
				code: "OPS",
				status: "Active Feed",
			};
		}

		if (/training|academy|certification|learning|development/.test(normalized)) {
			return {
				section: "training-command",
				sectionTitle: "Training Command",
				sectionDescription:
					"Training resources, qualification tracks, and personnel development.",
				classification: "Personnel Training",
				code: "TC",
				status: "Open Tracks",
			};
		}

		if (/leadership|executive|command staff|officer/.test(normalized)) {
			return {
				section: "leadership-center",
				sectionTitle: "Leadership Center",
				sectionDescription:
					"Leadership resources and internal command communication.",
				classification: "Command Authority",
				code: "LC",
				status: "Restricted Briefing",
			};
		}

		if (
			/commerce|industry|manufacturing|fleet security|exploration|survey|contract support|cim|fs|e&s|css/.test(
				normalized
			)
		) {
			var code = "DIV";
			if (/commerce|industry|manufacturing|cim/.test(normalized)) code = "CIM";
			if (/fleet security|\bfs\b/.test(normalized)) code = "FS";
			if (/exploration|survey|e&s/.test(normalized)) code = "E&S";
			if (/contract support|css/.test(normalized)) code = "CSS";

			return {
				section: "division-headquarters",
				sectionTitle: "Division Headquarters",
				sectionDescription:
					"Division command nodes for industrial, security, exploration, and support operations.",
				classification: "Division Access",
				code: code,
				status: "Operational",
			};
		}

		return {
			section: "operations-center",
			sectionTitle: "Operations Center",
			sectionDescription: "Events, operational updates, and mission communications.",
			classification: "Operational Access",
			code: "OPS",
			status: "Active Feed",
		};
	}

	function extractCategories() {
		var cards = [];
		var seen = {};

		var selectors = [
			".category-box",
			".category-list .category",
			".category-list-item",
			".categories-list .category",
		];

		var nodes = document.querySelectorAll(selectors.join(","));
		nodes.forEach(function (node) {
			var titleLink =
				node.querySelector(".category-title-link") ||
				node.querySelector("h3 a") ||
				node.querySelector("a.category-link") ||
				node.querySelector("a[href*='/c/']");

			if (!titleLink) return;

			var href = titleLink.getAttribute("href") || "";
			var title = (titleLink.textContent || "").trim();
			if (!title || !href || seen[href]) return;
			seen[href] = true;

			var descriptionNode =
				node.querySelector(".category-description") ||
				node.querySelector(".category-desc") ||
				node.querySelector(".description");

			var description = descriptionNode
				? (descriptionNode.textContent || "").trim()
				: "DDI command information channel.";

			var meta = classifyCategory(title);
			cards.push({
				href: href,
				title: title,
				description: description,
				section: meta.section,
				sectionTitle: meta.sectionTitle,
				sectionDescription: meta.sectionDescription,
				classification: meta.classification,
				code: meta.code,
				status: meta.status,
			});
		});

		return cards;
	}

	function buildCardHTML(card) {
		return (
			"<article class='ddi-dashboard-card'>" +
			"<p class='ddi-dashboard-card__classification'>" +
			card.classification +
			"</p>" +
			"<p class='ddi-dashboard-card__code'>" +
			card.code +
			"</p>" +
			"<h3 class='ddi-dashboard-card__title'><a href='" +
			card.href +
			"'>" +
			card.title +
			"</a></h3>" +
			"<p class='ddi-dashboard-card__description'>" +
			card.description +
			"</p>" +
			"<p class='ddi-dashboard-card__status'><span></span>" +
			card.status +
			"</p>" +
			"</article>"
		);
	}

	function renderHomepageDashboard() {
		var existing = document.querySelector(".ddi-dashboard-homepage");
		var defaults = document.querySelectorAll(
			".categories-and-latest, .category-list, .category-boxes, .categories-list"
		);

		if (!isCommandHomepage()) {
			if (existing) existing.remove();
			defaults.forEach(function (el) {
				el.classList.remove("ddi-default-homepage-hidden");
			});
			return;
		}

		var categories = extractCategories();
		if (!categories.length) return;

		defaults.forEach(function (el) {
			el.classList.add("ddi-default-homepage-hidden");
		});

		if (existing) existing.remove();

		var sectionOrder = [
			"corporate-command",
			"operations-center",
			"training-command",
			"division-headquarters",
			"leadership-center",
		];

		var grouped = {
			"corporate-command": [],
			"operations-center": [],
			"training-command": [],
			"division-headquarters": [],
			"leadership-center": [],
		};

		categories.forEach(function (card) {
			if (!grouped[card.section]) grouped[card.section] = [];
			grouped[card.section].push(card);
		});

		var html = "<section class='ddi-dashboard-homepage' aria-label='DDI Command Network Homepage'>";

		sectionOrder.forEach(function (sectionKey) {
			var cards = grouped[sectionKey] || [];
			if (!cards.length) return;

			var first = cards[0];
			html +=
				"<section class='ddi-dashboard-section ddi-dashboard-section--" +
				sectionKey +
				"'>" +
				"<header class='ddi-dashboard-section__header'>" +
				"<h2>" +
				first.sectionTitle +
				"</h2>" +
				"<p>" +
				first.sectionDescription +
				"</p>" +
				"</header>" +
				"<div class='ddi-dashboard-section__grid'>";

			cards.forEach(function (card) {
				html += buildCardHTML(card);
			});

			html += "</div></section>";
		});

		html += "</section>";

		var outlet = document.querySelector("#main-outlet");
		if (!outlet) return;
		outlet.insertAdjacentHTML("afterbegin", html);
	}

	function decorateSidebar() {
		var sidebar =
			document.querySelector(".sidebar-wrapper") ||
			document.querySelector(".sidebar-container") ||
			document.querySelector(".sidebar-region");

		if (!sidebar) return;

		if (!sidebar.querySelector(".ddi-sidebar-header")) {
			sidebar.insertAdjacentHTML(
				"afterbegin",
				"<section class='ddi-sidebar-header'>" +
					"<p class='ddi-sidebar-header__label'>DDI Command Network</p>" +
					"<p class='ddi-sidebar-header__meta'>Authorized Personnel Access</p>" +
					"<p class='ddi-sidebar-header__status'><span></span>Condition Green</p>" +
					"</section>"
			);
		}
	}

	function ensureFooter() {
		var existing = document.querySelector(".ddi-command-footer");
		if (existing) return;

		document.body.insertAdjacentHTML(
			"beforeend",
			"<footer class='ddi-command-footer' aria-label='DDI corporate footer'>" +
				"<p>Dagger Defense Corporation</p>" +
				"<p>Command Network</p>" +
				"<p>Strength Through Precision</p>" +
				"</footer>"
		);
	}

	function runInterfaceRender() {
		renderHomepageDashboard();
		decorateSidebar();
		ensureFooter();
	}

	if (window.require) {
		var pluginApi = window.require("discourse/lib/plugin-api");
		if (pluginApi && pluginApi.withPluginApi) {
			pluginApi.withPluginApi("0.8.7", function (api) {
				api.onPageChange(function () {
					runInterfaceRender();
				});

				setTimeout(runInterfaceRender, 0);
			});
			return;
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", runInterfaceRender);
	} else {
		runInterfaceRender();
	}
})();
