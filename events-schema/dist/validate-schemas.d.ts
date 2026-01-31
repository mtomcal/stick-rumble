import AjvModule from 'ajv';
declare const Ajv: typeof AjvModule.Ajv;
/**
 * Recursively find all JSON files in a directory
 */
export declare function findJsonFiles(dir: string): string[];
/**
 * Validate a single schema file
 */
export declare function validateSchemaFile(ajv: InstanceType<typeof Ajv>, filePath: string): boolean;
/**
 * Main validation function
 * @param schemasDirOverride - Optional override for schemas directory (for testing)
 * @returns true if all schemas are valid, false otherwise
 */
export declare function validateSchemas(schemasDirOverride?: string): boolean;
/**
 * CLI entry point - runs validation and exits with appropriate code
 * @param schemasDirOverride - Optional override for schemas directory (for testing)
 */
export declare function runValidationCli(schemasDirOverride?: string): void;
export {};
//# sourceMappingURL=validate-schemas.d.ts.map