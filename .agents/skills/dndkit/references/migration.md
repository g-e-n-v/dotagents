# Migration From Legacy dnd-kit

Use this reference when the codebase imports `@dnd-kit/core`, `@dnd-kit/sortable`, or `@dnd-kit/utilities`. Migrate a coherent interaction boundary at a time; do not mix old and new contracts inside one provider.

## Contents

- Package mapping
- Provider and events
- Hook output changes
- Sortable changes
- Sensors
- Collision and modifiers
- Migration procedure

## Package Mapping

Remove legacy packages when no legacy boundary remains:

| Legacy | Current |
| --- | --- |
| `@dnd-kit/core` | `@dnd-kit/react` plus transitive `@dnd-kit/dom`/`@dnd-kit/abstract` APIs |
| `@dnd-kit/sortable` | `@dnd-kit/react/sortable` |
| `@dnd-kit/utilities` | Usually unnecessary |
| `arrayMove` | `move` from `@dnd-kit/helpers` |

Install `@dnd-kit/helpers` when using `move`. Check the package manager and lockfile before changing dependencies.

## Provider And Events

Replace `DndContext` with `DragDropProvider`.

| Legacy | Current |
| --- | --- |
| `active` | `event.operation.source` |
| `over` | `event.operation.target` |
| `active.id` | `event.operation.source.id` |
| `onDragCancel` | `event.canceled` inside `onDragEnd` |
| Global `collisionDetection` | Per-target `collisionDetector` |

Current callbacks also receive the manager as the second argument. Always guard cancellation and a missing target.

Before:

```tsx
<DndContext
  onDragEnd={({active, over}) => {
    if (over) commit(active.id, over.id);
  }}
/>
```

After:

```tsx
<DragDropProvider
  onDragEnd={({canceled, operation}) => {
    if (canceled || !operation.target) return;
    commit(operation.source.id, operation.target.id);
  }}
/>
```

## Hook Output Changes

Legacy draggable/sortable code often spreads `attributes` and `listeners`, attaches `setNodeRef`, and applies `CSS.Transform.toString(transform)` plus `transition`.

Current hooks attach a direct `ref`; dnd-kit manages interaction listeners and visual motion:

```tsx
const {ref, handleRef, isDragging} = useSortable({id, index});

return (
  <li ref={ref} data-dragging={isDragging}>
    {label}
    <button ref={handleRef} aria-label={`Move ${label}`}>Move</button>
  </li>
);
```

Mappings:

| Legacy | Current |
| --- | --- |
| `setNodeRef` | `ref` |
| `setActivatorNodeRef` or listener target | `handleRef` or `handle` |
| `isOver` | `isDropTarget` |
| Manual `attributes`/`listeners` | Managed by hook/sensors |
| Manual `transform`/`transition` styling | Managed by feedback/sortable behavior |

Remove old utility imports only after their remaining uses are gone.

## Sortable Changes

- Remove `SortableContext`; sortables register with `DragDropProvider` automatically.
- Remove sorting strategies such as `verticalListSortingStrategy`, `horizontalListSortingStrategy`, and `rectSortingStrategy`; current sorting handles layout automatically.
- Pass both stable `id` and current `index` to `useSortable`.
- Use `group` for multiple lists and `type`/`accept` for compatibility.
- Replace `arrayMove(items, oldIndex, newIndex)` with `move(items, event)` or a manual immutable update using `isSortable(source)`.
- Under optimistic sorting, inspect source `initialIndex`/`index` and `initialGroup`/`group`; do not compare source and target IDs to detect movement.

## Sensors

Legacy `useSensor`/`useSensors` setup becomes the provider `sensors` prop. Pointer and keyboard sensors are enabled by default.

`MouseSensor` and `TouchSensor` are consolidated into `PointerSensor` from `@dnd-kit/dom`. To preserve different behavior, configure `activationConstraints(event)` and branch on `event.pointerType` (`mouse`, `touch`, or `pen`).

Use the provider function form to replace only the default pointer descriptor while retaining keyboard:

```tsx
<DragDropProvider
  sensors={(defaults) => [
    ...defaults.filter((sensor) => sensor !== PointerSensor),
    PointerSensor.configure({...options}),
  ]}
>
```

Do not blindly port physical `KeyboardEvent.code` values. Current keyboard mappings use `KeyboardEvent.key`; common `Key*` and `Digit*` forms normalize for compatibility, but replace other physical codes with their produced key value.

## Collision And Modifiers

Collision mapping:

| Legacy | Current import |
| --- | --- |
| `pointerWithin` | `pointerIntersection` from `@dnd-kit/collision` |
| `closestCenter` | `closestCenter` from `@dnd-kit/collision` |
| `closestCorners` | `closestCorners` from `@dnd-kit/collision` |

Set detectors on each `useDroppable` or `useSortable` target.

Modifier mapping:

| Legacy | Current |
| --- | --- |
| `restrictToParentElement` | `RestrictToElement` from `@dnd-kit/dom/modifiers` |
| `restrictToWindowEdges` | `RestrictToWindow` from `@dnd-kit/dom/modifiers` |
| `restrictToVerticalAxis` | `RestrictToVerticalAxis` from `@dnd-kit/abstract/modifiers` |
| `restrictToHorizontalAxis` | `RestrictToHorizontalAxis` from `@dnd-kit/abstract/modifiers` |
| `createSnapModifier` | `SnapModifier` from `@dnd-kit/abstract/modifiers` |

For element restriction, lazily resolve React refs with `element: () => ref.current`.

## Migration Procedure

1. Inventory all legacy imports, providers, sensors, strategies, overlays, modifiers, collision functions, state updates, and tests.
2. Define migration boundaries. Keep each rendered interaction fully legacy or fully current until converted.
3. Update dependencies and imports.
4. Replace provider events and cancellation handling.
5. Replace draggable and droppable refs/state fields.
6. Remove manual listeners, attributes, transforms, and transitions after confirming current feedback behavior.
7. Convert sortables: remove contexts/strategies, pass indices/groups/types, and update state reconciliation.
8. Convert sensors, collision detectors, modifiers, feedback, and overlay placement.
9. Run typecheck to expose residual contract mismatches.
10. Test mouse, touch, keyboard, cancellation, drop outside, empty containers, scrolling, accessibility announcements, and final persisted order.
11. Profile the migrated interaction. Confirm optimistic sorting avoids list-wide React updates per pointer move.

When exact package versions differ, consult the installed declaration files and current official docs instead of guessing APIs.
