import { getClassification } from "../../lib/ddi-classification";

export default {
  setupComponent(args, component) {
    const {
      classification,
      className: classificationClass,
      message,
    } = getClassification(args.model);

    component.setProperties({
      classification,
      classificationClass,
      message,
    });
  },
};