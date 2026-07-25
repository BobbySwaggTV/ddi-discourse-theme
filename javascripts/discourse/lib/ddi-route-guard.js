const EXCLUDED_ROUTE_PREFIXES = ["topic.", "admin"];

export function isExcludedRoute(routeName) {
  return EXCLUDED_ROUTE_PREFIXES.some((prefix) =>
    routeName?.startsWith(prefix)
  );
}
