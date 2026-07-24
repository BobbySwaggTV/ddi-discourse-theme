import { getClassification } from "../../lib/ddi-classification";

export default {
  setupComponent(args, component) {
const classification = getClassification(args.model);

component.setProperties({
      classification: classification.classification,
      classificationClass: classification.className,
      message: classification.message,
    });
  },
};