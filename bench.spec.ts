import 'jest';
import 'reflect-metadata';
import {classToPlain, plainToClass} from "../core/src/mapper-old";
import {
    classToPlain as classTransformerClassToPlain,
    plainToClass as classTransformerPlainToClass
} from "class-transformer";
import {bench} from "./util";
import {jitClassToPlain, jitPlainToClass} from "../core/src/jit";
import {f} from "@marcj/marshal";

export class MarshalModel {
    @f ready?: boolean;

    @f.array(String) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f public id: number,
        @f public name: string
    ) {
    }
}

export class ClassTransformerSuperSimple {
    public id?: number;
    public name?: string;

    ready?: boolean;

    tags: string[] = [];

    priority: number = 0;
}

test('benchmark plainToClass', () => {
    const count = 1_000_000;

    bench(count, 'Marshal plainToClass SuperSimple', (i) => {
        plainToClass(MarshalModel, {
            name: 'name' + i,
            id: i,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
    });

    bench(count, 'Marshal jitPlainToClass SuperSimple', (i) => {
        jitPlainToClass(MarshalModel, {
            name: 'name' + i,
            id: i,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
    });

    bench(count, 'ClassTransformer plainToClass SuperSimple', (i) => {
        classTransformerPlainToClass(ClassTransformerSuperSimple, {
            name: 'name' + i,
            id: i,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
    });
});

test('benchmark classToPlain', () => {
    const count = 100_000;

    const b = jitPlainToClass(MarshalModel, {
        name: 'name1',
        id: 1,
        tags: ['a', 2, 'c'],
        priority: 5,
        ready: true,
    });

    bench(count, 'Marshal classToPlain SuperSimple', (i) => {
        classToPlain(MarshalModel, b);
    });

    bench(count, 'Marshal jitClassToPlain SuperSimple', (i) => {
        jitClassToPlain(MarshalModel, b);
    });

    bench(count, 'ClassTransformer classToPlain SuperSimple', (i) => {
        classTransformerClassToPlain(b);
    });
});
