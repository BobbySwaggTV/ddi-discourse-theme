import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0", () => {
  // No-op entry point, kept for structural symmetry with the
  // `javascripts/discourse/` tree — layout is built via the connectors/
  // api-initializers under that directory (see ARCHITECTURE.md), not here.
  // `ddi-dossier-refresh.js` is the one exception that does runtime DOM
  // injection, scoped to the topic page's dossier header fields only.
});