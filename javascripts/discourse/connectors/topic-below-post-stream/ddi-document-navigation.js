import { getOwner } from "@ember/owner";

export default {
  setupComponent(args, component) {
    component.setProperties({
      isLoading: true,
      department: null,
      previous: null,
      next: null,
      recent: [],
    });

    getOwner(component)
      .lookup("service:ddi-archive-navigation")
      .getNavigation(args.model)
      .then((navigation) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        component.setProperties({
          isLoading: false,
          department: navigation.department,
          previous: navigation.previous,
          next: navigation.next,
          recent: navigation.recent,
        });
      });
  },
};
