# Development Layer

Groups services that support the development lifecycle. The services remain
independent applications with their own ports, Registry entries, deployments,
and configuration:

- [`version-control`](./version-control) — stores versioned snapshots of
  objects owned by other modules.
- [`repository`](./repository) — manages curated collections of resource
  definitions.
- [`deployment-engine`](./deployment-engine) — builds and runs deployable
  artifacts against deployment targets.
