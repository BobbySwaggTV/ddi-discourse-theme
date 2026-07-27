// Shared accessibility/keyboard layer for every DDI dialog (Integrity
// Dashboard, System Status, Reading Lists, Favorites, Command Palette).
// Framework-agnostic on purpose: it only ever touches the dialog's own DOM
// element, so it works identically whether the dialog is a classic Ember
// connector component (wired via {{did-insert}}/{{did-update}}/
// {{will-destroy}}) or hand-built DOM (the Command Palette/Favorites
// panels in ddi-command-palette.js).
//
// createModal(element, options) sets static aria attributes immediately and
// returns { activate, deactivate, destroy }. The caller decides *when* the
// dialog is actually open/closed (each dialog already owns that state) and
// just calls activate()/deactivate() to turn the accessibility behavior on
// and off in step with it.
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function focusableElements(element) {
  return [...element.querySelectorAll(FOCUSABLE_SELECTOR)];
}

// Ref-counted so N simultaneously-active dialogs don't fight over restoring
// the page's original overflow value when fewer than all of them close.
// (Today's dialogs are all siblings a user opens one at a time, but the
// counter makes that an actual guarantee rather than an accident.)
let scrollLockCount = 0;
let savedBodyOverflow = null;

function lockScroll() {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  scrollLockCount++;
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);

  if (scrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow || "";
    savedBodyOverflow = null;
  }
}

export function createModal(element, options = {}) {
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "true");

  if (options.labelledBy) {
    element.setAttribute("aria-labelledby", options.labelledBy);
  } else if (options.label) {
    element.setAttribute("aria-label", options.label);
  }

  if (options.describedBy) {
    element.setAttribute("aria-describedby", options.describedBy);
  }

  // Fallback focus target when nothing inside is focusable — never added to
  // the tab order itself (-1), only ever focused programmatically.
  if (!element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "-1");
  }

  let active = false;
  let lastFocusedElement = null;

  // Escape/Tab are handled at the document level rather than on the dialog
  // element itself so they fire regardless of which descendant currently
  // has focus. Only one dialog is ever meant to be open at a time in this
  // theme (every "open" action closes any sibling dialog first) — if that
  // ever stops being true, two active listeners would both react to one
  // Escape press, which is a reasonable degradation, not a leak.
  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      options.onClose?.();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = focusableElements(element);

    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function activate() {
    if (active) {
      return;
    }

    active = true;
    lastFocusedElement = document.activeElement;
    lockScroll();
    document.addEventListener("keydown", onKeydown, true);

    const initialFocus =
      (typeof options.initialFocus === "function"
        ? options.initialFocus()
        : options.initialFocus) ||
      focusableElements(element)[0] ||
      element;

    initialFocus?.focus?.();
  }

  function deactivate() {
    if (!active) {
      return;
    }

    active = false;
    unlockScroll();
    document.removeEventListener("keydown", onKeydown, true);
    lastFocusedElement?.focus?.();
    lastFocusedElement = null;
  }

  function destroy() {
    deactivate();
  }

  return { activate, deactivate, destroy };
}
