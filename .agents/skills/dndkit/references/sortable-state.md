# Sortable State Management

Use this reference for one list, multi-list transfers, empty containers, cancellation, optimistic sorting, and external state.

## Contents

- Model the state
- Understand optimistic sorting
- Use `move`
- Manage one list manually
- Manage multiple lists
- Support empty and sortable containers
- Integrate persistence and fetched data
- Test state behavior

## Model The State

Use a flat array for one list:

```ts
const [items, setItems] = useState<Item[]>(initialItems);
```

Use grouped arrays for conventional boards:

```ts
const [itemsByColumn, setItemsByColumn] = useState<Record<string, Item[]>>(initial);
```

Use stable domain IDs. Pass the current render index to every `useSortable` call. For multi-list items, pass `group: columnId`, a source `type`, and target `accept` rules.

Choose one authoritative local state during a drag. Derive rendered lists from it; do not alternate between query data, props, and optimistic local data.

## Understand Optimistic Sorting

The default `OptimisticSortingPlugin` reorders DOM elements during drag without requiring a React render on each `dragover`. This keeps movement responsive.

Consequences:

- During a sortable operation, `operation.source` and `operation.target` can refer to the same sortable element.
- Do not compare `source.id` and `target.id` to infer the final move.
- Use `isSortable(source)` and read `source.initialIndex`, `source.index`, `source.initialGroup`, and `source.group`.
- Call `event.preventDefault()` in `onDragOver` when a particular move must not be optimistically applied.
- Optimistic DOM changes are reverted automatically on cancellation, but application state changed during `onDragOver` must be restored explicitly.

## Use `move`

Import `move` from `@dnd-kit/helpers`. It supports arrays and records of arrays, matches primitive items or object `id` fields, handles drag events, and works with optimistic sorting.

Single list:

```tsx
<DragDropProvider
  onDragEnd={(event) => {
    if (event.canceled) return;
    setItems((current) => move(current, event));
  }}
>
```

Multiple lists with live cross-column movement:

```tsx
const snapshot = useRef(itemsByColumn);

<DragDropProvider
  onDragStart={() => {
    snapshot.current = structuredClone(itemsByColumn);
  }}
  onDragOver={(event) => {
    if (event.operation.source.type === 'column') return;
    setItemsByColumn((current) => move(current, event));
  }}
  onDragEnd={(event) => {
    if (event.canceled) setItemsByColumn(snapshot.current);
  }}
>
```

Use `onDragEnd` only when live React updates are unnecessary. Use `onDragOver` for cross-container state that other UI must observe during drag, and snapshot first.

## Manage One List Manually

Use manual updates for custom structures or business-specific reconciliation:

```tsx
import {isSortable} from '@dnd-kit/react/sortable';

function handleDragEnd(event: DragEndEvent) {
  if (event.canceled) return;

  const {source} = event.operation;
  if (!isSortable(source) || source.initialIndex === source.index) return;

  setItems((current) => {
    const next = [...current];
    const [item] = next.splice(source.initialIndex, 1);
    next.splice(source.index, 0, item);
    return next;
  });
}
```

Use `isSortableOperation(operation)` when both source and target must be narrowed. Avoid mutating prior React state.

## Manage Multiple Lists Manually

Snapshot state at start. At end, narrow the source and distinguish same-group reorder from cross-group transfer:

```tsx
function handleDragEnd(event: DragEndEvent) {
  if (event.canceled) {
    setItemsByColumn(snapshot.current);
    return;
  }

  const {source} = event.operation;
  if (!isSortable(source)) return;

  const {initialGroup, group, initialIndex, index} = source;
  if (initialGroup == null || group == null) return;

  setItemsByColumn((current) => {
    if (initialGroup === group) {
      const list = [...current[group]];
      const [item] = list.splice(initialIndex, 1);
      list.splice(index, 0, item);
      return {...current, [group]: list};
    }

    const from = [...current[initialGroup]];
    const [item] = from.splice(initialIndex, 1);
    const to = [...current[group]];
    to.splice(index, 0, item);
    return {...current, [initialGroup]: from, [group]: to};
  });
}
```

Validate group existence and indices when state can change concurrently. Encode cross-group business rules in `accept` for feedback and recheck them in the final update or server command.

## Support Empty And Sortable Containers

Sortable items cannot provide targets inside an empty list. Register each container with `useDroppable`:

```tsx
import {CollisionPriority} from '@dnd-kit/abstract';

const {ref, isDropTarget} = useDroppable({
  id: columnId,
  type: 'column',
  accept: 'card',
  collisionPriority: CollisionPriority.Low,
});
```

Low container priority lets item targets win when present while preserving an empty-column target.

To sort columns as well as cards:

- Give columns `useSortable({id, index, type: 'column', accept: ['card', 'column']})`.
- Give cards `type: 'card'`, `accept: 'card'`, and `group: columnId`.
- Ignore column sources in the card `onDragOver` updater.
- Commit column order in `onDragEnd`; let optimistic sorting handle interim visuals to avoid unnecessary renders.

## Integrate Persistence And Fetched Data

Treat local drag state as the UI source of truth while a drag is active:

```tsx
const isDragging = useRef(false);

useEffect(() => {
  if (fetchedItems && !isDragging.current) setItems(fetchedItems);
}, [fetchedItems]);
```

Set the flag in `onDragStart`; clear it in every `onDragEnd` path. On a successful drop:

1. Derive and set the final immutable local state.
2. Send a domain command containing item ID, source group/index, and destination group/index.
3. Reconcile the confirmed server result.
4. On failure, restore the snapshot or refetch and announce the failure.

Do not render the list directly from query data while also maintaining local drag state. Refetches during optimistic sorting can produce duplicate elements.

Handle concurrent data changes explicitly. Possible policies include freezing list sync during drag, rejecting stale moves with a version, or remapping by stable IDs against the latest state.

## Performance Guidance

- Prefer final updates in `onDragEnd`; use `onDragOver` state only when live cross-list application state is required.
- Keep list items keyed by stable IDs and memoize expensive presentational content when profiling proves it useful.
- Keep drag event handlers narrow. Do not perform network requests or broad cache writes on every move.
- Use one lightweight overlay and avoid cloning expensive subtrees.
- Measure React commits during a drag. Optimistic sorting should allow smooth movement without a list-wide commit for every pointer event.

## Test State Behavior

Unit-test pure move/reducer logic for:

- Same-list movement up and down.
- Cross-list movement at start, middle, and end.
- Move into and out of an empty list.
- No target, disabled or rejected target, and unchanged position.
- Cancellation after live `onDragOver` changes.
- Persistence success, failure rollback, and concurrent refetch.
- Stable object identity for untouched groups when relevant to memoization.

In browser tests, cover pointer and keyboard sorting, focus after drop/cancel, auto-scroll, nested item/container collision, and screen-reader announcements.
