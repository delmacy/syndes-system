const MODULE_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/;

export interface ModuleInitializationContext {
  readonly moduleId: string;
}

/** A module is application code, statically installed by its host. */
export interface ModuleDefinition {
  readonly id: string;
  readonly version: string;
  /** Optional during migration; explicit ownership in Manifest V2. */
  readonly schema?: string;
  readonly dependencies?: readonly string[];
  initialize?(context: ModuleInitializationContext): Promise<void> | void;
}

export class ModuleRegistry {
  private readonly definitions = new Map<string, Readonly<ModuleDefinition>>();

  constructor(modules: readonly ModuleDefinition[] = []) {
    modules.forEach((module) => this.register(module));
  }

  register(module: ModuleDefinition): void {
    if (!MODULE_ID.test(module.id) || !VERSION.test(module.version)) {
      throw new Error("Invalid module id or version");
    }
    if (this.definitions.has(module.id)) {
      throw new Error(`Duplicate module: ${module.id}`);
    }
    if (module.schema !== undefined) {
      if (!/^[a-z][a-z0-9_]*$/.test(module.schema) ||
          ["public", "pg_catalog", "information_schema", "_syndes", "read", "reporting"].includes(module.schema)) {
        throw new Error("Invalid or reserved module schema: " + module.schema);
      }
      for (const other of this.definitions.values()) {
        if (other.schema === module.schema) throw new Error("Duplicate module schema: " + module.schema);
      }
    }
    const dependencies = [...(module.dependencies ?? [])];
    if (new Set(dependencies).size !== dependencies.length || dependencies.includes(module.id) ||
        dependencies.some((id) => !MODULE_ID.test(id))) {
      throw new Error(`Invalid dependencies for module: ${module.id}`);
    }
    const frozen = Object.freeze({ ...module, dependencies: Object.freeze(dependencies) });
    this.definitions.set(module.id, frozen);
  }

  has(id: string): boolean { return this.definitions.has(id); }

  /**
   * Produces a deterministic, dependency-first order, rejecting both absent
   * dependencies and cycles before executing any module initialization.
   */
  ordered(): readonly Readonly<ModuleDefinition>[] {
    const result: Readonly<ModuleDefinition>[] = [];
    const marks = new Map<string, "visiting" | "visited">();
    const visit = (id: string): void => {
      const state = marks.get(id);
      if (state === "visited") return;
      if (state === "visiting") throw new Error(`Circular dependency: ${id}`);
      const definition = this.definitions.get(id);
      if (!definition) throw new Error(`Missing module dependency: ${id}`);
      marks.set(id, "visiting");
      for (const dependency of definition.dependencies ?? []) visit(dependency);
      marks.set(id, "visited");
      result.push(definition);
    };
    for (const id of [...this.definitions.keys()].sort()) visit(id);
    return Object.freeze(result);
  }
}
