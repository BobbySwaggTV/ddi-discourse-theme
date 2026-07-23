export default {
  setupComponent(args, component) {
    const topic = args.model;

    component.setProperties({
      replies: topic.reply_count ?? 0,
      views: topic.views ?? 0,
      category: topic.category?.name ?? "Uncategorized",
    });
  },
};