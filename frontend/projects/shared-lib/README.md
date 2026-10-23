# SharedLib

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.0.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the library, run:

```bash
ng build shared-lib
```

This command will compile your project, and the build artifacts will be placed in the `dist/` directory.

## Reusable UI components

The library exports standalone components for buttons, cards, text inputs, textareas,
checkboxes, selects, toggles, sliders, badges, alerts, avatars, spinners, progress bars,
tooltips, modals, tabs, accordions, dropdowns, pagination, dividers, skeletons, and form
fields. Every component accepts a typed `properties` input; its interface extends
`ElvUiProperties`, which provides `className` and a `styles` map.

```html
<elv-text-input
  componentId="profile-name"
  [properties]="{
    label: 'Name',
    placeholder: 'Enter your name',
    styles: { 'max-width': '24rem' }
  }"
/>
```

Interactive components keep their state on the component instance. Inject the
root-provided `ElvUiStateService` to update or observe state by component ID:

```ts
this.uiState.setState('profile-name', { key: 'value', value: 'Ada' });
this.uiState.setState('profile-name', {
  key: 'class',
  value: 'rounded-lg bg-indigo-600 px-4 py-2 text-white',
});
this.uiState.stateChanges$.subscribe(({ componentId, state }) => {
  // React to state updates from components or other callers.
});
```

Every UI component accepts a `componentId`; `key: 'class'` applies its string value to
the Angular component host's `class` attribute. State is published to subscribers for
that ID only, while `stateChanges$` remains available for observing all updates.
Built-in controls use the `value` key for their internal state (for example, a text value,
boolean checkbox/toggle value, or numeric slider/page value).

The client app includes Tailwind CSS and scans both client and shared-lib sources. Tailwind
generates CSS at build time, so utility classes coming from runtime data must be included
in the app's `@source inline(...)` safelist in
`projects/client/src/styles.css`; the default file includes common colors, spacing, and
layout utilities.

The dynamic renderer can render registered Angular components as well as native HTML and
text nodes. For example, a native node can use `{ "id": "heading", "type": "element",
"element": "h1", "attributes": { "class": "text-2xl font-bold" }, "children": ["copy"] }`,
where `copy` is a text node ID.

### Publishing the Library

Once the project is built, you can publish your library by following these steps:

1. Navigate to the `dist` directory:
   ```bash
   cd dist/shared-lib
   ```

2. Run the `npm publish` command to publish your library to the npm registry:
   ```bash
   npm publish
   ```

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
