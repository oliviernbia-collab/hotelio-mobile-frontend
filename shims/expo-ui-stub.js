'use strict';

// Stub for @expo/ui/jetpack-compose and @expo/ui/* subpaths.
// Metro redirects all @expo/ui/* imports here so that native Android Compose
// components don't crash when the native module is unavailable (e.g. Expo Go,
// iOS, or unsupported device). All components render null.

// Chainable placeholder returned by EnterTransition / ExitTransition methods.
const chainable = {};
['plus', 'scaleIn', 'scaleOut', 'expandIn', 'shrinkOut'].forEach(function (m) {
  chainable[m] = function () { return chainable; };
});

// Null-rendering React component stub.
function NullComp() { return null; }

// Component with named sub-components (e.g. DropdownMenu.Trigger).
function withSubs(subs) {
  function C() { return null; }
  Object.assign(C, subs);
  return C;
}

// No-op modifier — returns null so arrays like [fillMaxHeight()] don't throw.
function modifier() { return null; }

module.exports = {
  // ---------- Components ----------
  AnimatedVisibility: NullComp,
  IconButton: NullComp,
  Icon: NullComp,
  Host: NullComp,
  Box: NullComp,
  HorizontalFloatingToolbar: NullComp,
  RNHostView: NullComp,
  HorizontalDivider: NullComp,
  Text: NullComp,

  DropdownMenu: withSubs({
    Trigger: NullComp,
    Items: NullComp,
  }),

  DropdownMenuItem: withSubs({
    Text: NullComp,
    LeadingIcon: NullComp,
    TrailingIcon: NullComp,
  }),

  // ---------- Transition objects ----------
  EnterTransition: chainable,
  ExitTransition: chainable,

  // ---------- Modifiers (also covers @expo/ui/jetpack-compose/modifiers) ----------
  fillMaxWidth: modifier,
  fillMaxHeight: modifier,
  padding: modifier,
  imePadding: modifier,
  height: modifier,
  width: modifier,
  background: modifier,
};
