# Vendored dependency patch

This package is based on `deepmerge` 4.3.1, licensed under MIT (see `license.txt`).
It applies the `__proto__` key rejection from upstream commit
[`c5ad573121574db1c625b0aabcc6114ed7df6c5a`](https://github.com/TehShrike/deepmerge/commit/c5ad573121574db1c625b0aabcc6114ed7df6c5a)
to both target and source copy loops. The override exists because no patched npm
release is available; remove this vendored copy when an upstream release with the
fix is published and verified.
