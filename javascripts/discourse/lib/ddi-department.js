export const DEPARTMENTS = Object.freeze([
  "executive-command",
  "fleet-security",
  "commerce-industry-manufacturing",
  "exploration-survey",
  "contract-support-services",
  "public-affairs",
]);

export function isValidDepartment(slug) {
  return DEPARTMENTS.includes(slug);
}
