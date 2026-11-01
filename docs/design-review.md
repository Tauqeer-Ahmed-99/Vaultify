# Vaultify design review

## Summary

Reviewed and improved the complete Expo/React Native interface using `apple-design` and `apple-design-diwu`: authentication, private and group accounts, transactions, invitations, profiles, member management, navigation, forms, alerts, loading, and errors. The design’s job is to make balances and shared-ledger ownership easy to understand at a glance.

The existing purple theme is preserved at the user’s request: background gradient `#0f0c29 → #302b63 → #24243e`, violet accents `#a78bfa` and `#7c3aed`, and the existing eight ledger colors. The work changes hierarchy, component behavior, and legibility. It does not introduce a different color scheme or an appearance switch.

This is a source review with lint, TypeScript, and native bundle verification. Native rendering, gesture feel, screen-reader output, and maximum accessibility text sizes still need inspection on devices. A “perfect” device experience cannot be established from source or a successful bundle alone.

## Decisions

- Keep the ledger as the visual anchor: account names, tabular currency, explicit **To Receive / To Send / Settled**, and a narrow ledger-color accent. Remove decorative full-card gradients and repeated promotional copy while keeping the background gradient and palette.
- Put **Accounts** and **Sharing** in native tabs. Keep account detail and member screens inside the Accounts stack so the tab bar and native back navigation remain available.
- Use system fonts: 17-point body, 14-point supporting text, 19–24-point headings, and 36-point summary amounts. Money uses tabular numerals. Compact layouts and larger text stack amount columns; rows and buttons grow with their content.
- Use 48-point minimum buttons, visible focus borders, descriptive accessibility labels, native date pickers, and concise inline validation.
- Present short editing tasks in a native iOS page sheet, with platform back/cancel handling and keyboard-safe scrolling. Android uses a full-screen modal. Destructive confirmations are separate from forms.
- Keep the creator’s summary control to one row and a switch. Members see only the chosen inclusion state. Transaction ownership and Firebase rules are preserved.
- Use immediate press feedback. Keep navigation and modal motion native; Reduce Motion disables custom modal slides and stack animations. Avoid decorative springs, looping motion, and simulated glass. Content surfaces are opaque; no custom blur needs a transparency fallback.

Compact layout:

```text
Accounts                         New Account
Total Assets
₹ amount                       To Receive
Search accounts
Your Ledgers                          Select
Account name
Personal / Group
₹ balance                      To Send
                         Accounts | Sharing
```

On wider windows, name and amount share a row within a centered 720-point content column. The same controls remain available at every width. This is a ledger-specific layout: financial alignment and ownership carry the hierarchy; generic dashboard tiles and extra status decorations were deliberately removed.

## Findings addressed

### Critical: readability and accessible controls

Low-opacity labels and small controls were replaced with consistent text roles, scalable layouts, and 48-point touch targets. Amounts have an explicit direction label, so color alone never conveys whether money is to receive or send. Truncation is limited to secondary account descriptions at standard text sizes.

References: `accessibility.md › Vision`, “Support larger text sizes”; `accessibility.md › Mobility`, “Offer sufficiently sized controls”; `typography.md › Supporting Dynamic Type`, “Make sure your app’s layout adapts to all font sizes.”

Measured WCAG contrast ratios for the final tokens:

| Role | Foreground / background | Ratio |
| --- | --- | --- |
| Primary text on cards | `#ffffff / #1a1a2e` | 17.06:1 |
| Body on the lightest background-gradient stop | `#d1cde2 / #302b63` | 8.20:1 |
| Supporting text on that gradient stop | `#b9b4d2 / #302b63` | 6.37:1 |
| Violet actions on cards | `#a78bfa / #1a1a2e` | 6.27:1 |
| Primary button text | `#ffffff / #7c3aed` | 5.70:1 |
| Input boundary | `#88809d / #15122f` | 4.85:1 |

These are calculated color-pair ratios, not measurements from a device screenshot.

### High: discoverability and navigation

Account and transaction editing no longer depend on discovering a long press. A visible **Select** action provides batch editing/deletion, and an owned transaction can be tapped to edit it. Long press remains an optional shortcut. Native tabs make Sharing discoverable without an overflow menu. Native safe-area handling keeps action bars above system and tab controls.

References: `accessibility.md › Mobility`, “Offer alternatives to gestures”; `tab-bars.md › Best practices`, “Use a tab bar to support navigation, not to provide actions.”

### High: forms and recovery

All forms use shared field, button, date, and sheet components. Sign-in errors and password-reset success appear in their own task, rather than competing alerts. Failed saves preserve entered values. Destructive actions have specific confirmation labels and a Cancel action. Routine sign-out has a progress state and error handling.

References: `entering-data.md › Best practices`, “Dynamically validate field values”; `sheets.md › Best practices`, “Display only one sheet at a time from the main interface”; `buttons.md › Best practices`, “Always include a press state for a custom button.”

### Medium: restraint and consistency

Shared primitives replace per-screen styling and repeated explanatory paragraphs. Invitation history is disclosed on demand. All controls use the same typography, spacing, radii, pending states, and failure treatment. The existing dark theme is an explicit user constraint; automatic light appearance was not introduced.

References: `layout.md › Visual hierarchy`, “Use progressive disclosure to make layouts cleaner and easier to interact with”; `motion.md › Best practices`, “Make motion optional.”

## Validation and remaining checks

Project-wide lint and strict TypeScript checks pass. Android and iOS production bundle exports pass. No tests were added, per the user’s instruction. No Firebase permissions or database schema changed in this design pass.

An EAS device build remains necessary to assess native sheet dismissal, tab-bar insets, TalkBack/VoiceOver reading order, keyboard behavior, and the largest accessibility text sizes. Web has the native-tabs fallback; native mobile was the primary review target. The project’s original dark appearance is retained intentionally.
