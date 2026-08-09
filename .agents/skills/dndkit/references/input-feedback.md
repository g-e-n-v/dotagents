# Input, Collision, Modifiers, And Feedback

Use this reference to tune activation, keyboard behavior, target selection, motion constraints, visual feedback, accessibility, and interaction performance.

## Contents

- Sensors and handles
- Collision detection
- Modifiers
- Feedback and overlays
- Accessibility
- Performance measurement

## Sensors And Handles

`DragDropProvider` registers `PointerSensor` and `KeyboardSensor` by default. Import sensor classes from `@dnd-kit/dom` only when customizing them.

Configure at three levels:

- Provider `sensors` for all sources.
- Hook `sensors` for one draggable or sortable; these override provider sensors.
- `Sensor.configure(options)` to create a configured descriptor.

An array replaces provider defaults. A function extends them:

```tsx
import {PointerSensor, PointerActivationConstraints} from '@dnd-kit/dom';

<DragDropProvider
  sensors={(defaults) => [
    ...defaults.filter((sensor) => sensor !== PointerSensor),
    PointerSensor.configure({
      activationConstraints(event) {
        if (event.pointerType === 'touch') {
          return [
            new PointerActivationConstraints.Delay({value: 250, tolerance: 5}),
          ];
        }
        return [new PointerActivationConstraints.Distance({value: 5})];
      },
    }),
  ]}
>
```

The pointer sensor handles mouse, touch, and pen through Pointer Events. Constraint arrays use OR semantics: activation occurs when any constraint succeeds. Returning `undefined` from an `activationConstraints` function means immediate activation; it does not restore defaults.

Use a drag handle for the common case:

```tsx
const {ref, handleRef} = useDraggable({id});
return (
  <article ref={ref}>
    <button ref={handleRef} aria-label="Move card">Move</button>
  </article>
);
```

Use `activatorElements` only when an activator lives outside the source subtree. The default pointer behavior avoids activation from interactive descendants that are not handles. Customize `preventActivation(event, source)` carefully; preserve ordinary controls, links, text input, selection, and scrolling.

Configure keyboard keys with `KeyboardSensor.configure({keyboardCodes})`. Values follow `KeyboardEvent.key`; defaults support keyboard drag. The `offset` option controls movement per key press, and Shift multiplies it by five. Never replace provider sensors without retaining `KeyboardSensor` unless an equivalent accessible flow exists.

## Collision Detection

Built-ins come from `@dnd-kit/collision`, a transitive dependency of `@dnd-kit/react`:

| Detector | Behavior | Good fit |
| --- | --- | --- |
| `defaultCollisionDetection` | `pointerIntersection`, then `shapeIntersection` | General use |
| `pointerIntersection` | Pointer must be inside target rectangle | Precise zones |
| `shapeIntersection` | Greatest overlap area; pointer distance breaks ties | Large containers |
| `closestCenter` | Default collision first, then closest centers | Grids and slots |
| `closestCorners` | Smallest average corner distance | Forgiving lists |
| `pointerDistance` | Target center nearest pointer | Cursor-driven targeting |
| `directionBiased` | Considers movement direction | Reduce boundary jitter |

Set `collisionDetector` per `useDroppable` or `useSortable`, not globally. This permits different target behavior on one page.

Use `collisionPriority` when targets overlap. Higher values win before detector scores. `CollisionPriority` from `@dnd-kit/abstract` provides `Lowest`, `Low`, `Normal`, `High`, and `Highest`; plain numbers also work. A common board pattern gives columns `Low` so card targets win.

A custom detector accepts `{dragOperation, droppable}` and returns `null` or a collision object with target `id`, numeric `value`, collision `type`, and `priority`. Higher values win among collisions. Keep custom detectors pure and inexpensive because they run frequently.

Use `onCollision` monitoring to inspect candidates. Call `event.preventDefault()` only when manually selecting or intentionally blocking automatic target selection.

## Modifiers

Modifiers transform movement coordinates and run in array order. Configure globally on the provider or per draggable/sortable; per-source modifiers take precedence over global ones.

Imports:

- `RestrictToElement` and `RestrictToWindow` from `@dnd-kit/dom/modifiers`.
- `RestrictToVerticalAxis`, `RestrictToHorizontalAxis`, and `SnapModifier` from `@dnd-kit/abstract/modifiers`.

Container restriction:

```tsx
RestrictToElement.configure({
  element: () => containerRef.current,
})
```

Pass a function so the element is resolved after the ref is populated. Passing `containerRef.current` during initial render often captures `null` and silently removes the restriction.

Grid snap:

```tsx
SnapModifier.configure({size: {x: 50, y: 25}})
```

Compose deliberately. Restrict-then-snap can differ at boundaries from snap-then-restrict. Test edges, scrolling, zoom, transformed ancestors, and right-to-left layouts where applicable.

## Feedback And Overlays

The default `Feedback` plugin promotes the dragged element to the browser top layer and handles drop animation. Extend default plugins rather than replacing them:

```tsx
import {Feedback} from '@dnd-kit/dom';

<DragDropProvider
  plugins={(defaults) => [
    ...defaults,
    Feedback.configure({dropAnimation: null}),
  ]}
>
```

Configure per source through hook `plugins` when behavior differs by item.

Feedback modes:

| Mode | Behavior |
| --- | --- |
| `'default'` | Promote and move source in top layer |
| `'clone'` | Leave a clone in the original position while source moves |
| `'move'` | Move without top-layer promotion or placeholder |
| `'none'` | No plugin feedback; use for custom `DragOverlay` |

Drop animation accepts `null`, `{duration, easing}`, or an async custom animation. Default duration is 250 ms with `ease`. Respect reduced motion and avoid long animations that delay state or focus reconciliation.

Use one `DragOverlay` per provider for custom previews. Render a lightweight presentational component selected by source ID/type. Do not mount source hooks inside it.

If a drop appears to animate twice, the plugin animation and application state update likely disagree. Use `move` in `onDragEnd`, ensure the final state matches the optimistic position, or disable the drop animation.

## Accessibility

Retain keyboard and accessibility defaults. Verify the complete task rather than only activation:

- Focus a source or handle.
- Start with Space or Enter.
- Move in all meaningful directions.
- Drop with Space, Enter, or the configured end key.
- Cancel with Escape.
- Return focus predictably.

Give handles explicit names such as `Move Pricing card`. Preserve semantic list, listitem, button, and region structure. Use visible focus indicators.

Provide feedback beyond movement and color:

- Style active source and valid/current targets with shape, border, text, or icon changes.
- Announce start, movement/target, drop, cancel, and invalid outcomes with concise status text or the default accessibility plugin.
- Do not disable or replace default plugins without preserving accessibility behavior.
- Keep controls inside draggable content operable without accidental drag.
- Use touch delay/tolerance or a handle so users can scroll.
- Offer an alternate move command for interactions that remain impractical with drag alone when product requirements demand it.

## Performance Measurement

Define an interaction scenario before profiling, for example: move one card across a 5-column, 200-card board for 10 seconds.

Measure:

- React commits and components rendered per movement.
- Main-thread long tasks and frame rate.
- Layout shifts and forced reflow.
- Number of application state writes and network/cache mutations.
- Overlay mount cost and drop-animation duration.

Expected shape:

- No broad list state update on each pointer move unless live cross-list state requires it.
- `useDragOperation` subscribers update on source/target changes, not raw pointer movement.
- Collision detectors and modifiers remain small, synchronous, and allocation-light.
- Expensive card content does not duplicate in a heavy overlay.
- Persistence occurs once per accepted drop, not during drag movement.

Optimize only after measuring. Prefer architectural fixes such as `onDragEnd` reconciliation, narrower subscriptions, stable IDs, and lightweight overlays before adding memoization everywhere.
