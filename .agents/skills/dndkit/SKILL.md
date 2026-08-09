---
name: dndkit
description: Build, migrate, debug, review, and optimize accessible drag-and-drop interfaces in React with the latest @dnd-kit/react API. Use for draggable and droppable elements, sortable lists, kanban or multi-list transfers, DragOverlay and feedback, drag lifecycle events, sensors and handles, collision detection, modifiers, optimistic state, external-store synchronization, or migrations from @dnd-kit/core, @dnd-kit/sortable, and @dnd-kit/utilities.
---

# dnd kit for React

Use the current `@dnd-kit/react` API, not the legacy context and hook contract. Preserve the project's package manager, component conventions, state architecture, and styling.

## Workflow

1. Inspect installed dnd-kit packages and existing imports before writing code.
2. Classify the interaction: free drag, source-to-target drop, one sortable list, multiple sortable lists, or sortable containers plus items.
3. Choose stable unique IDs, item `type`/target `accept` rules, sortable `group` values, and the authoritative state shape.
4. Build the smallest correct interaction with `DragDropProvider` and the matching hooks.
5. Add keyboard access, visible and announced feedback, cancellation behavior, and touch-safe activation.
6. Add collision detectors, modifiers, overlays, or manager access only for a concrete requirement.
7. Verify pointer, touch, keyboard, valid and invalid targets, empty containers, cancellation, scrolling, persistence failures, and re-renders.

## Load References Selectively

- Read [references/core-api.md](references/core-api.md) for provider events, hooks, IDs, types, accepts, overlays, monitoring, and manager access.
- Read [references/sortable-state.md](references/sortable-state.md) for single or multiple lists, empty containers, optimistic sorting, cancellations, and server-backed state.
- Read [references/input-feedback.md](references/input-feedback.md) for sensors, handles, collision detection, modifiers, feedback, accessibility, and interaction performance.
- Read [references/migration.md](references/migration.md) when legacy `@dnd-kit/core`, `@dnd-kit/sortable`, or `@dnd-kit/utilities` appears.

## Core Rules

- Install `@dnd-kit/react`; add `@dnd-kit/helpers` when using `move`. Treat `@dnd-kit/dom`, `@dnd-kit/abstract`, and `@dnd-kit/collision` as transitive packages unless the project's dependency policy requires direct declarations for imported packages.
- Wrap interacting sources and targets in one `DragDropProvider`. Use separate providers only for intentionally isolated drag domains.
- Give every draggable, droppable, and sortable a stable `string | number` ID unique within its provider. Never use a changing array index as an ID.
- Attach the returned `ref`; a registered hook without its node ref cannot measure or interact.
- Pair draggable `type` with droppable `accept`; remember that `accept` evaluates the source's type, not the target's type.
- Handle `event.canceled` in `onDragEnd` before persisting a move. Treat a missing target as a valid no-drop outcome.
- Render one `DragOverlay` per provider. Keep hooks on source components, not inside overlay content.
- Keep the default `KeyboardSensor` unless keyboard dragging is deliberately unsupported and the product has an equivalent accessible interaction.
- Prefer `useDragOperation` for reactive source/target UI, `useDragDropMonitor` for lifecycle or movement events, and `useDragDropManager` only for low-level registry, monitor, plugin, or imperative work.
- Prefer CSS transforms and dnd-kit's optimistic DOM sorting over React state updates on every pointer move. Update application state at the lowest frequency that meets the behavior.

## Baseline Patterns

Use a source and target:

```tsx
import {DragDropProvider, useDraggable, useDroppable} from '@dnd-kit/react';

function Draggable({id}: {id: string}) {
  const {ref, isDragging} = useDraggable({id, type: 'card'});
  return <button ref={ref} data-dragging={isDragging}>{id}</button>;
}

function Droppable({id}: {id: string}) {
  const {ref, isDropTarget} = useDroppable({id, accept: 'card'});
  return <div ref={ref} data-drop-target={isDropTarget} />;
}

function Board() {
  return (
    <DragDropProvider
      onDragEnd={({canceled, operation}) => {
        if (canceled || !operation.target) return;
        persistDrop(operation.source.id, operation.target.id);
      }}
    >
      <Draggable id="card-1" />
      <Droppable id="done" />
    </DragDropProvider>
  );
}
```

Use a sortable item:

```tsx
import {useSortable} from '@dnd-kit/react/sortable';

function SortableItem({id, index}: {id: string; index: number}) {
  const {ref, handleRef, isDragging} = useSortable({id, index});
  return (
    <li ref={ref} data-dragging={isDragging}>
      {id}
      <button ref={handleRef} aria-label={`Move ${id}`}>Move</button>
    </li>
  );
}
```

Pass the current render index on every render. Commit final state with `move(items, event)` or with `isSortable(source)` plus `initialIndex`/`index`; do not infer a sortable move by comparing `source.id` and `target.id` under optimistic sorting.

## State And Persistence

- Use a flat array for one list and `Record<group, item[]>` for conventional multi-list state.
- Give every multi-list item `group`, `type`, and `accept`. Make each container droppable so empty lists remain valid targets; lower container collision priority so child items win overlaps.
- Snapshot application state in `onDragStart` before any `onDragOver` mutations. Restore it when `onDragEnd` reports `canceled` or when an optimistic persistence request fails.
- Render from one local source of truth. Do not replace local sortable state from a query/cache while a drag is active; reconcile after drag end.
- Prefer immutable updates. Keep domain persistence separate from transient visual state and include enough source/target metadata to validate a move server-side.

## Accessibility And UX Gate

Before finishing, verify:

- Every action works with keyboard alone: focus, start, move, drop, and cancel.
- Drag handles have accessible names and remain focusable.
- Interactive controls inside draggable cards still click without starting accidental drags.
- Touch can scroll; use an appropriate delay/tolerance or handle rather than hijacking pointer-down.
- Valid targets, invalid targets, active source, and drop result have visible feedback not conveyed by color alone.
- Status changes are announced. Preserve the default accessibility plugin when extending provider plugins.
- Focus returns predictably after drop or cancel, and reduced-motion preferences are respected by custom animations.

## Verification And Performance

- Run existing unit, type, lint, and browser tests. Add focused tests for state reducers and event guards.
- Exercise mouse, touch/pen when available, and keyboard. Include empty and nested targets, scrolling, Escape cancellation, drop outside, disabled items, and persistence errors.
- Profile before optimizing. Watch render counts during movement, long tasks, layout shifts, and state writes. `useDragOperation` re-renders only when source or target changes; avoid pointer-level state in broad React subtrees.
- Keep provider `sensors`, `plugins`, and `modifiers` descriptors stable when profiling shows configuration churn.
- Prefer one overlay per provider and lightweight overlay content. Disable or simplify animations when they cause double movement, frame drops, or conflict with state reconciliation.
- Report evidence: commands run, interaction matrix covered, relevant render/commit measurements, and any untested device or assistive-technology risk.

## Common Failure Modes

- Legacy examples import `DndContext`, spread `listeners`/`attributes`, apply manual transforms, or use `SortableContext`; migrate instead of mixing generations.
- Passing an array to provider `sensors`, `plugins`, or `modifiers` replaces defaults. Use `(defaults) => [...]` to extend them.
- Passing `containerRef.current` to `RestrictToElement.configure` during render captures `null`; pass `element: () => containerRef.current`.
- Updating multi-list state in `onDragOver` without a start snapshot leaves canceled drags committed.
- Rendering from refetched data during optimistic sorting can duplicate DOM items.
- Combining a state move with an incompatible drop animation can create a double snap; reconcile to the final position or disable the animation.
