import { getOwner } from "@ember/owner";
import { verifyDocumentIntegrity } from "../../lib/ddi-integrity";

export default {
  shouldRender() {
    return settings.ddi_debug_mode_enabled;
  },

  setupComponent(args, component) {
    const metadata = getOwner(component)
      .lookup("service:ddi-document-metadata")
      .getMetadata(args.model);

    if (!metadata) {
      return;
    }

    const checks = verifyDocumentIntegrity(metadata);

    component.setProperties({
      checks,
      warnings: checks.filter((check) => check.status === "WARN"),
    });
  },
};
