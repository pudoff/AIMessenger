# Design System Strategy: The Lucid Flow

## 1. Overview & Creative North Star
This design system is anchored by a Creative North Star we call **"The Lucid Flow."** 

In a world of cluttered productivity tools, this system rejects the "boxed-in" aesthetic of traditional SaaS. Instead of rigid grids and heavy outlines, we embrace a high-end editorial feel characterized by **Tonal Layering** and **Expansive White Space**. We move beyond the generic by using intentional asymmetry—such as oversized display typography paired with whisper-quiet utility labels—to create a signature visual rhythm. The interface should feel less like a software "dashboard" and more like a premium, focused workspace where thoughts can breathe.

---

## 2. Color Strategy & Tonal Architecture
The palette is built on a foundation of sophisticated coolness, using deep indigos and crisp whites to establish authority and focus.

### The "No-Line" Rule
To achieve a premium editorial look, **1px solid borders are prohibited for sectioning.** Boundaries must be defined solely through background color shifts.
*   **Base Layout:** Use `surface` (#f8f9ff) for the main application background.
*   **Sidebars/Navigation:** Use `surface-container-low` (#eff4ff) to create a subtle, non-linear distinction.
*   **Content Areas:** Use `surface-container-lowest` (#ffffff) for active chat areas to pull focus.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of fine paper. 
1.  **Level 0 (Foundation):** `surface`
2.  **Level 1 (Recessed):** `surface-container-low` (e.g., Search bars, inactive panels)
3.  **Level 2 (Elevated):** `surface-container-highest` (e.g., Active message bubbles)

### The "Glass & Gradient" Rule
For floating elements like "New Message" popovers or context menus, use **Glassmorphism**. Apply the `surface_variant` token with a 60-80% opacity and a `24px` backdrop-blur. 
*   **Signature Texture:** Primary CTAs should utilize a subtle linear gradient from `primary` (#3525cd) to `primary_container` (#4f46e5) at a 135-degree angle. This adds a "soul" to the action that flat hex codes cannot replicate.

---

## 3. Typography: The Editorial Scale
We use **Inter** not just for legibility, but as a structural element. 

*   **Display (lg/md):** Use for empty states or onboarding. These should be set with tight letter-spacing (-0.02em) to feel like a high-fashion magazine.
*   **Headline & Title:** These are your navigational anchors. `title-lg` should be used for chat headers to provide an authoritative sense of place.
*   **Body (md/sm):** The workhorse. All chat messages use `body-md`. 
*   **Labels (md/sm):** These are the "metadata." Use `label-md` in all-caps with +0.05em tracking for category tags (e.g., TASK, QUESTION) to distinguish them from conversational text.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often a crutch for poor layout. In this system, we prioritize **Tonal Depth**.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. This creates a "soft lift" that is felt rather than seen.
*   **Ambient Shadows:** If an element must float (e.g., a modal), use a shadow with a blur radius of `40px` and a 4% opacity. The shadow color must be a tinted version of `on-surface` (#0b1c30), never pure black.
*   **The Ghost Border Fallback:** If accessibility requires a container edge, use a "Ghost Border": the `outline-variant` token at **15% opacity**. Anything more is too heavy.

---

## 5. Components

### Message Bubbles (The Signature Component)
*   **Inbound:** `surface-container-high` with `on-surface`. Soft corners (`md`).
*   **Outbound:** `primary` gradient with `on-primary`. 
*   **Contextual Clues:** Do not use borders. Use the `secondary` (Success Green) or `tertiary` (Amber) tokens as small 4px vertical accent bars on the left side of the bubble to indicate "Task" or "Question."

### Buttons
*   **Primary:** `primary` background, `on-primary` text, `DEFAULT` (8px) corners.
*   **Secondary:** `surface-container-highest` background. No border.
*   **Tertiary:** Transparent background with `primary` text. Use for low-emphasis actions like "Cancel."

### Functional Chips (Pills)
*   **Task:** `secondary_container` background with `on_secondary_container` text.
*   **Question:** `tertiary_container` background with `on_tertiary_container` text.
*   **Style:** Pill shape (`full` roundedness), `label-sm` typography, no border.

### Input Fields
*   **State:** Use `surface-container-low` as the base fill. 
*   **Focus:** Transition the background to `surface-container-lowest` and apply a 1px `primary` ghost border (20% opacity). 
*   **Layout:** Remove the divider line between the input and the chat history. Use `xl` spacing (1.5rem) to create a clear separation.

---

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace as a separator. If you feel the need for a divider line, double the padding instead.
*   **DO** use the `primary_fixed_dim` token for hover states on primary buttons to create a sophisticated glow effect.
*   **DO** align text-heavy components to a strict baseline grid to maintain the editorial "cleanliness."

### Don't
*   **DON'T** use 100% black (#000000) for text. Always use `on-surface` (#0b1c30) to maintain tonal harmony with the indigo accents.
*   **DON'T** use standard 1px borders to separate chat messages. The shift in bubble color and vertical spacing is sufficient.
*   **DON'T** use harsh, high-contrast shadows. If the shadow looks like a shadow, it’s too dark. It should look like a "glow of depth."