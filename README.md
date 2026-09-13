# heap-analysis

Post-mortem V8 heap snapshot analysis for Node.js.

**Status: not implemented yet.** This release reserves the name. Nothing is
exported.

The plan is to read a `.heapsnapshot` written by `v8.writeHeapSnapshot()` and
answer what is holding memory: retained sizes from a dominator tree, paths
back to GC roots, and diffs between two snapshots, from a CLI and as a
library, with no runtime dependencies.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the conventions this codebase
follows and why.

## License

MIT
