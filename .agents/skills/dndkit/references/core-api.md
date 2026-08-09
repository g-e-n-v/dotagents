# Core React API

Use this reference for provider setup, source/target hooks, overlays, and drag state utilities. All APIs describe the latest React integration.

## Contents

- Packages and provider
- Event lifecycle
- `useDraggable`
- `useDroppable`
- `useSortable`
- `DragOverlay`
- State and event utilities
- Selection guide

## Packages And Provider

Install `@dnd-kit/react`. Import `DragDropProvider`, `DragOverlay`, `useDraggable`, `useDroppable`, `useDragDropMonitor`, `useDragOperation`, and `useDragDropManager` from `@dnd-kit/react`. Import sortable APIs from `@dnd-kit/react/sortable`.

`DragDropProvider` creates a drag context, owns drag state, coordinates registered entities, and exposes lifecycle callbacks. Draggables and droppables interact only inside the same provider. A custom `manager` may be passed, but let the provider create it unless sharing or low-level control is required.

The `sensors`, `plugins`, and `modifiers` props each accept either:

- An array, which fully replaces defaults.
- A function receiving the defaults, which returns an extended or reconfigured list.

Prefer the function form when preserving default keyboard accessibility, feedback, auto-scrolling, and other built-ins.

## Event Lifecycle

Provider callbacks and `useDragDropMonitor` receive `(event, manager)`:

| Callback | Important fields | Preventable behavior |
| --- | --- | --- |
| `onBeforeDragStart` | `event.operation` | `preventDefault()` cancels activation |
| `onDragStart` | `operation`, `nativeEvent` | No |
| `onDragMove` | `operation`, `to`, `by`, `nativeEvent` | `preventDefault()` blocks responding defaults |
| `onDragOver` | `operation` | `preventDefault()` blocks plugins such as optimistic sorting for that event |
| `onCollision` | `collisions` | `preventDefault()` blocks automatic target selection |
| `onDragEnd` | `operation`, `canceled`, `nativeEvent` | No |

The operation commonly exposes:

- `operation.source`, the `Draggable` or `null`.
- `operation.target`, the `Droppable` or `null`.
- `operation.source.id` and `operation.target?.id`.
- `operation.position.initial` and `operation.position.current`, each `{x, y}`.
- `operation.status`.

Check `canceled` first in `onDragEnd`; it replaces the legacy `onDragCancel`. Check `target` before committing a drop. Use `onBeforeDragStart` for policy that must prevent activation, `onDragOver` for live cross-container behavior, and `onDragEnd` for final state and persistence.

## `useDraggable`

```tsx
const {
  ref,
  handleRef,
  isDragSource,
  isDragging,
  isDropping,
  draggable,
} = useDraggable({
  id,
  type: 'card',
  disabled,
  data: {cardId: id},
});
```

Input:

- `id: string | number`, required and unique within the provider.
- `type: string | number | symbol`, used by droppable `accept` rules.
- `element` or `handle`, for an existing element/ref instead of returned callbacks.
- `disabled`, `plugins`, `modifiers`, `sensors`, `alignment`, and arbitrary `data`.
- `effects`, an advanced setup/cleanup mechanism; avoid for ordinary React work.

Attach `ref` to the drag source. Attach `handleRef` to a focusable control when only that control should activate drag. Use `isDragSource` to identify the current operation's source, `isDragging` for active movement, and `isDropping` for drop-animation styling.

Prefer a handle for cards containing links, buttons, text selection, or scrolling. Give the handle an accessible name.

## `useDroppable`

```tsx
const {ref, isDropTarget, droppable} = useDroppable({
  id,
  accept: 'card',
  type: 'column',
});
```

Input:

- `id: string | number`, required and unique within the provider.
- `accept: Type | Type[] | ((source) => boolean)`. Omit to accept all sources.
- `type`, which categorizes the target but is not what its own `accept` evaluates.
- `element`, `collisionDetector`, `collisionPriority`, `disabled`, `data`, and advanced `effects`.

Attach `ref` to the measured drop target. Use `isDropTarget` for current-target feedback. Higher `collisionPriority` wins overlapping collisions; use a lower priority for a container behind child item targets.

Use predicate `accept` for domain rules that need source data. Keep server authorization independent: client acceptance is UX, not a security boundary.

## `useSortable`

Import from `@dnd-kit/react/sortable`. The hook combines draggable and droppable behavior.

```tsx
const sortable = useSortable({
  id,
  index,
  group: columnId,
  type: 'card',
  accept: 'card',
});
```

Required:

- `id: string | number`, stable and unique.
- `index: number`, matching the item's current rendered position.

Additional input includes `group`, transition options, source `element`, drag `handle`, separate droppable `target`, `accept`, `type`, collision options, plugins, modifiers, sensors, data, and `disabled`. Disable both sides with `true`, or one role with `{draggable: true}` or `{droppable: true}`.

Output includes shared `ref`, separate `sourceRef`, `targetRef`, `handleRef`, `isDropTarget`, `isDragSource`, `isDragging`, and `isDropping`. Use separate source and target refs only when the draggable visual and measured insertion target differ.

Items with the same `group` sort together. Items without `group` share an implicit group. For multiple lists, supply explicit groups and compatible `type`/`accept` values.

## `DragOverlay`

Render exactly once inside each provider:

```tsx
<DragOverlay dropAnimation={{duration: 150, easing: 'ease-out'}}>
  {(source) => <CardPreview id={String(source.id)} />}
</DragOverlay>
```

Children may be a node or `(source: Draggable) => ReactNode`; function children support multiple source renderings. Props include:

- `tag`, default `div`.
- `disabled`, boolean or source predicate.
- `dropAnimation`: `undefined` for default 250 ms ease, `null` to disable, `{duration, easing}`, or a custom animation function.
- `className` and `style` for the wrapper.

The overlay renders only during an active operation. Do not register draggable or sortable hooks inside overlay content; keep registration on the source. Use the function child to render a presentational clone.

## State And Event Utilities

### `useDragOperation`

Returns reactive `{source, target}` from the nearest provider. The component re-renders when source or target changes, not on every pointer move. Use for an active banner, target highlight, overlay selection, or temporarily disabled UI.

### `useDragDropMonitor`

Registers provider lifecycle handlers from any descendant. Use when event handling belongs near a feature component or when pointer-level movement/collision events are required. It returns nothing and must be called under a provider.

### `useDragDropManager`

Returns `DragDropManager | null` by type. At runtime, provider-less calls use a shared default manager, but retain the null guard for TypeScript. Use for `manager.monitor.addEventListener`, registry/plugin lookup, or imperative dispatch. Return monitor cleanup functions from `useEffect`.

Prefer provider callbacks or the two higher-level hooks for ordinary UI and state updates.

## Selection Guide

| Requirement | Use |
| --- | --- |
| Move a source to a target | `useDraggable` + `useDroppable` |
| Reorder one or more lists | `useSortable` |
| Render drag preview | One `DragOverlay` |
| Read current source/target in UI | `useDragOperation` |
| Observe lifecycle near a component | `useDragDropMonitor` |
| Access registry, raw monitor, or dispatch | `useDragDropManager` |
