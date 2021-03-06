import {ClassType, typeOf} from '@super-hornet/core';
import {ClassSchema, getClassSchema, PropertyCompilerSchema, PropertyValidator,} from './decorators';
import {jitValidate, jitValidateProperty} from './jit-validation';
import {ExtractClassType, PlainOrFullEntityFromClassTypeOrSchema} from './utils';

export class PropertyValidatorError {
    constructor(
        public readonly code: string,
        public readonly message: string,
    ) {
    }
}

/**
 * The structure of a validation error.
 *
 * Path defines the shallow or deep path (using dots).
 * Message is an arbitrary message in english.
 */
export class ValidationError {
    constructor(
        /**
         * The path to the property. May be a deep path separated by dot.
         */
        public readonly path: string,
        /**
         * A lower cased error code that can be used to identify this error and translate.
         */
        public readonly code: string,
        /**
         * Free text of the error.
         */
        public readonly message: string,
    ) {
    }
}

/**
 *
 */
export class ValidationFailed {
    constructor(public readonly errors: ValidationError[]) {
    }
}

export function handleCustomValidator<T>(
    propSchema: PropertyCompilerSchema,
    validator: PropertyValidator,
    value: any,
    propertyPath: string,
    errors: ValidationError[],
    classType?: ClassType<any>,
) {
    try {
        const result = validator.validate(value, propSchema.name, classType);
        if (result instanceof PropertyValidatorError) {
            errors.push(new ValidationError(propertyPath, result.code, result.message));
        }
    } catch (error) {
        if (error instanceof PropertyValidatorError) {
            errors.push(new ValidationError(propertyPath, error.code, error.message || String(error)));
        } else {
            errors.push(new ValidationError(propertyPath, 'error', error.message || String(error)));
        }
    }
}

/**
 * Validates a set of method arguments and returns the number of errors found.
 */
export function validateMethodArgs<T>(classType: ClassType<T>, methodName: string, args: any[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const schema = getClassSchema(classType);
    schema.loadDefaults();

    const properties = schema.getMethodProperties(methodName);

    for (const i in properties) {
        jitValidateProperty(properties[i], classType)(
            args[i],
            '#' + String(i),
            errors
        );
    }

    return errors;
}

/**
 * Validates a object or class instance and returns all errors.
 * Returns an empty array if not errors found and validation succeeded.
 *
 * @example
 * ```
 * validate(SimpleModel, {id: false});
 * ```
 */
export function validate<T extends ClassType<any> | ClassSchema<any>>(classType: T, item: PlainOrFullEntityFromClassTypeOrSchema<T>, path?: string): ValidationError[] {
    return jitValidate(classType)(item, path);
}

/**
 * A type guarded way of using Marshal.
 *
 * Note: Methods are not type guarded.
 *
 * @example
 * ```
 * if (validates(SimpleMode, data)) {
 *     //data is now typeof SimpleMode
 * }
 * ```
 */
export function validates<T extends ClassType<any> | ClassSchema<any>>(classType: T, item: PlainOrFullEntityFromClassTypeOrSchema<T>): item is ExtractClassType<T> {
    return jitValidate(classType)(item).length === 0;
}

/**
 * A type guarded way of using Marshal as factory for faster access.
 *
 * Note: Methods are not type guarded.
 *
 * @example
 * ```
 * const simpleModelValidates = validatesFactory(SimpleMode);
 * if (simpleModelValidates(data)) {
 *     //data is now typeof SimpleMode
 * }
 * ```
 */
export function validatesFactory<T extends ClassType<any> | ClassSchema<any>>(classType: T): (item: PlainOrFullEntityFromClassTypeOrSchema<T>) => item is ExtractClassType<T> {
    const validation = jitValidate(classType);
    return (item): item is ExtractClassType<T> => {
        return validation(item).length === 0;
    };
}

