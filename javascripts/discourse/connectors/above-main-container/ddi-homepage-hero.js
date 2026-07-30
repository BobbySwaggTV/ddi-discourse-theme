import { getOwner } from "@ember/owner";
import { isExcludedRoute } from "../../lib/ddi-route-guard";
import { buildArchiveStatistics } from "../../lib/ddi-archive-statistics";

// Static organizational content for Mission Briefing (v1.2) — no fetch, no
// parsing. All six official divisions, same slugs/names/order as
// lib/ddi-department.js's own DEPARTMENTS array and
// docs/ddi-archive-information-architecture.md's category table — none
// invented, none renamed. Kept inline rather than in lib/ since this data
// has exactly one consumer and isn't a pure function of anything —
// extracting it would be a new file for no reuse benefit.
// `role` is new in v1.2.1 — a short "Primary Function" label distinct from
// the longer `description` below it, the same static-content-only addition
// icon/description already were. No new field changes what a pillar links
// to or how it's gated.
const MISSION_PILLARS = [
  {
    slug: "executive-command",
    name: "Executive Command",
    icon: "★",
    role: "Strategic Leadership",
    description:
      "Strategic leadership, corporate governance, and long-term organizational direction.",
  },
  {
    slug: "fleet-security",
    name: "Fleet Security",
    icon: "⚓",
    role: "Defense & Protection",
    description:
      "Protection of personnel, fleets, infrastructure, and operational assets.",
  },
  {
    slug: "commerce-industry-manufacturing",
    name: "Commerce, Industry & Manufacturing",
    icon: "⚙",
    role: "Industrial Production",
    description:
      "Industrial production, logistics, mining, refining, manufacturing, and economic growth.",
  },
  {
    slug: "exploration-survey",
    name: "Exploration & Survey",
    icon: "✦",
    role: "Frontier Discovery",
    description:
      "Discovery of new systems, resources, navigation routes, and strategic opportunities.",
  },
  {
    slug: "contract-support-services",
    name: "Contract Support Services",
    icon: "⚖",
    role: "Mission Coordination",
    description:
      "Mission coordination, logistics support, operational planning, and contracted services.",
  },
  {
    slug: "public-affairs",
    name: "Public Affairs",
    icon: "✉",
    role: "Community & Outreach",
    description:
      "Recruitment, communications, community relations, branding, and organizational outreach.",
  },
];

const MISSION_OBJECTIVES = [
  "Protect DDI personnel and assets",
  "Expand industrial capability",
  "Support exploration initiatives",
  "Maintain operational readiness",
  "Strengthen logistics and coordination",
  "Foster a professional community",
];

export default {
  shouldRender() {
    // Mirrors ddi-browse-archive.js's own two-setting shouldRender() shape:
    // mount if either section is on, let each section gate itself
    // independently inside setupComponent/the template.
    return Boolean(
      settings.ddi_homepage_hero_enabled ||
        settings.ddi_mission_briefing_enabled
    );
  },

  setupComponent(args, component) {
    const owner = getOwner(component);
    const router = owner.lookup("service:router");

    if (isExcludedRoute(router.currentRouteName)) {
      component.setProperties({ isVisible: false });
      return;
    }

    const categoryContext = owner.lookup("service:ddi-category-context");

    // Scoped to the archive-wide landing experience specifically, not
    // every discovery route Browse Archive/Intelligence Dashboard also
    // render on. A specific division already has its own immersive
    // per-category header (Division Header, Division Command Center Phase
    // 3) and the /categories index already has Division Cards — a second,
    // generic hero/briefing on top of either would compete with content
    // that already fills the same "orient the visitor" role there. Reuses
    // isCategoriesIndexRoute()/getCurrentCategory() unmodified rather than
    // a new route check. Mission Briefing shares this exact guard rather
    // than getting its own, since it's homepage-only orientation content
    // for the same reason the Hero is.
    if (
      categoryContext.isCategoriesIndexRoute() ||
      categoryContext.getCurrentCategory()
    ) {
      component.setProperties({ isVisible: false });
      return;
    }

    // Confidence caveat (same class as Composer's creatingTopic/
    // editingPost for Document Author Assistant, Post's toggleBookmark
    // feature-detection for Document Actions): logo_url is a long-standing
    // Discourse site setting, but this is the first time this theme has
    // looked up service:site-settings at all, so it's unconfirmed against
    // a live instance. Absent/falsy just hides the logo element — no
    // broken image, no crash.
    const siteSettings = owner.lookup("service:site-settings");
    const site = owner.lookup("service:site");

    // Division pages aren't guaranteed to exist yet (categories are
    // admin-provisioned, per docs/ddi-archive-information-architecture.md
    // — the theme never creates them). Same reuse Division Cards/Command
    // Palette already make of site.categories to build a real /c/{slug}/
    // {id} URL; a pillar whose category isn't provisioned yet falls back
    // to /categories rather than linking to a 404.
    const pillars = MISSION_PILLARS.map((pillar) => {
      const category = (site.categories || []).find(
        (candidate) => candidate.slug === pillar.slug
      );

      return {
        ...pillar,
        url: category
          ? `/c/${category.slug}/${category.id}`
          : "/categories",
      };
    });

    component.setProperties({
      isVisible: true,

      showHero: Boolean(settings.ddi_homepage_hero_enabled),
      logoUrl: siteSettings?.logo_url || null,
      backgroundImageUrl: settings.ddi_hero_background_image || null,
      subtitle: settings.ddi_hero_subtitle || null,
      // Command Palette's own "Browse Archive" entry uses this identical
      // gate — if neither underlying view is enabled, Browse Archive
      // itself never renders, so scrolling to it would be a dead action.
      showBrowseArchiveButton: Boolean(
        settings.ddi_timeline_view_enabled ||
          settings.ddi_intelligence_index_enabled
      ),
      stats: null,

      // Scroll-anchor, not navigation — the exact same
      // document.getElementById(id)?.scrollIntoView() technique Document
      // Actions and Command Palette already use for the identical target,
      // #ddi-browse-archive (see ddi-browse-archive.hbs's own outer id).
      scrollToArchive: () => {
        document
          .getElementById("ddi-browse-archive")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      },

      showMissionBriefing: Boolean(settings.ddi_mission_briefing_enabled),
      pillars,
      objectives: MISSION_OBJECTIVES,
    });

    // No department filter — this connector only ever renders on the true
    // archive-wide homepage (see the route guard above), the same
    // unscoped call Intelligence Dashboard already makes there. Warmed by
    // the same session cache (see services/ddi-intelligence-index.js) —
    // whichever of the two connectors resolves first pays the real cost,
    // the other reuses its result. Mission Briefing does not call this —
    // it has no statistics of its own, by design (see ARCHITECTURE.md).
    owner
      .lookup("service:ddi-intelligence-index")
      .getIndex()
      .then((documents) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        const statistics = buildArchiveStatistics(documents, 1);

        component.setProperties({
          stats: {
            totalDocuments: statistics.totalDocuments,
            departmentCount: statistics.departments.length,
            classificationCount: statistics.classifications.length,
          },
        });
      });
  },
};
