import { register } from "node:module";

// Branche les crochets de résolution avant le chargement des tests.
register("./alias-hooks.mjs", import.meta.url);
