import 'jest-extended';
import 'reflect-metadata';
import {Entity, t, getClassSchema, plainToClass, PropertySchema} from "../index";
import {uuid} from "../src/utils";

test('test optional', () => {
    class Model {
        @t.optional super?: number
    }

    const schema = getClassSchema(Model);
    const prop = schema.getProperty('super');

    expect(prop.isOptional).toBe(true);
    expect(prop.type).toBe('number');
});

test('test @f', () => {
    class Config {
        @t created: Date = new Date;
    }

    class Page {
        @t.map(Config)
        map: { [name: string]: Config } = {};

        @t.array(Config)
        configArray: Config[] = [];

        constructor(
            @t name: string,
            @t.array(String) tags: string[]
        ) {
        }
    }

    const schema = getClassSchema(Page);

    expect(schema.getProperty('name').isMap).toBe(false);
    expect(schema.getProperty('name').isArray).toBe(false);
    expect(schema.getProperty('name').type).toBe('string');

    expect(schema.getProperty('tags').isMap).toBe(false);
    expect(schema.getProperty('tags').isArray).toBe(true);
    expect(schema.getProperty('tags').getSubType().type).toBe('string');

    expect(schema.getProperty('map').type).toBe('map');
    expect(schema.getProperty('map').isMap).toBe(true);
    expect(schema.getProperty('map').getSubType().type).toBe('class');
    expect(schema.getProperty('map').getSubType().getResolvedClassType()).toBe(Config);
    expect(schema.getProperty('map').getSubType().isArray).toBe(false);

    expect(schema.getProperty('configArray').type).toBe('array');
    expect(schema.getProperty('configArray').isArray).toBe(true);
    expect(schema.getProperty('configArray').getSubType().type).toBe('class');
    expect(schema.getProperty('configArray').getSubType().getResolvedClassType()).toBe(Config);
    expect(schema.getProperty('configArray').getSubType().isMap).toBe(false);
    expect(schema.getProperty('configArray').getSubType().isArray).toBe(false);
});


test('test propertySchema serialization wrong', () => {
    class Config {
        @t created: Date = new Date;
    }

    class Page {
        @t.type(Config).optional
        config?: Config;
    }

    const schema = getClassSchema(Page);
    const p1 = schema.getProperty('config');
    expect(() => {
        p1.toJSON();
    }).toThrow('Could not serialize type information for');
});

test('test propertySchema serialization', () => {
    @Entity('config')
    class Config {
        @t created: Date = new Date;
    }

    class Page {
        @t.primary.uuid
        id: string = uuid();

        @t.optional
        title: string = '';

        @t.map(Config)
        map: { [name: string]: Config } = {};

        @t.map(Config).template(t.string, Config)
        map2: { [name: string]: Config } = {};
    }

    function compare(p1: PropertySchema, p2: PropertySchema) {
        const compare: Partial<keyof PropertySchema>[] = [
            'name',
            'type',
            'isArray',
            'isMap',
            'isOptional',
            'isDecorated',
            'isParentReference',
            'isId',
            'isPartial',
            'methodName',
            'allowLabelsAsValue',
            'resolveClassType',
        ];
        for (const k of compare) {
            expect(p1[k]).toBe(p2[k]);
        }
    }

    const schema = getClassSchema(Page);
    {
        const p1 = schema.getProperty('id');
        const p2 = PropertySchema.fromJSON(p1.toJSON());
        expect(p1.name).toBe('id');
        expect(p1.isId).toBe(true);
        expect(p1.type).toBe('uuid');
        expect(p1.isResolvedClassTypeIsDecorated()).toBe(false);
        compare(p1, p2);
    }

    {
        const p1 = schema.getProperty('title');
        const p2 = PropertySchema.fromJSON(p1.toJSON());
        compare(p1, p2);
        expect(p1.name).toBe('title');
        expect(p1.isId).toBe(false);
        expect(p1.isOptional).toBe(true);
        expect(p1.type).toBe('string');
    }

    {
        const p1 = schema.getProperty('map');
        const p2 = PropertySchema.fromJSON(p1.toJSON());
        expect(p1.name).toBe('map');
        expect(p1.isMap).toBe(true);
        expect(p1.isId).toBe(false);
        expect(p1.getSubType().getResolvedClassType()).toBe(Config);
        expect(p1.getSubType().getResolvedClassTypeForValidType()).toBe(Config);
        expect(p1.getSubType().type).toBe('class');
        compare(p1, p2);
    }

    {
        const p1 = schema.getProperty('map2');
        const p2 = PropertySchema.fromJSON(p1.toJSON());
        expect(p1.name).toBe('map2');
        expect(p1.isId).toBe(false);
        expect(p1.isMap).toBe(true);
        expect(p1.getSubType().getResolvedClassType()).toBe(Config);
        expect(p1.getSubType().getResolvedClassTypeForValidType()).toBe(Config);
        expect(p1.templateArgs![0].type).toEqual('string');
        expect(p1.templateArgs![1].type).toEqual('class');
        expect(p1.templateArgs![1].getResolvedClassTypeForValidType()).toEqual(Config);
        expect(p1.getSubType().type).toBe('class');
        compare(p1, p2);
    }

});

test('test asName', () => {
    class User {
        constructor(
            @t.name('fieldA')
            public parent: string,
            @t.uuid.optional.name('fieldB')
            public neighbor?: string,
        ) {
        }
    }

    const user = plainToClass(User, {
        fieldA: 'a',
        fieldB: 'b'
    });

    const schema = getClassSchema(User);
    expect(schema.getProperty('fieldA')).toBeInstanceOf(PropertySchema);
    expect(schema.getProperty('fieldB')).toBeInstanceOf(PropertySchema);

    expect(user.parent).toBe('a');
    expect(user.neighbor).toBe('b');
    expect(schema.getProperty('fieldB').isOptional).toBe(true);
});

test('test asName easy', () => {
    class User {
        constructor(
            @t public parent: string,
            @t public neighbor?: number,
        ) {
        }
    }

    const schema = getClassSchema(User);
    expect(schema.getProperty('parent').type).toBe('string');
    expect(schema.getProperty('neighbor').type).toBe('number');
});

test('test inheritance', async () => {
    class Base {
        constructor(
            @t.index({}, 'id2')
            public id: string,
        ) {
        }
    }

    class Page extends Base {
        constructor(id: string, @t public name: string) {
            super(id);
        }
    }

    class Between extends Page {

    }

    class SuperPage extends Between {
        @t.optional super?: number;
    }

    class Super2 extends SuperPage {
    }

    class Super3 extends Super2 {
    }

    expect(getClassSchema(Base).getProperty('id').type).toBe('string');
    expect(getClassSchema(Base).getIndex('id2')!.name).toBe('id2');

    expect(getClassSchema(Page).getProperty('id').type).toBe('string');
    expect(getClassSchema(Page).getProperty('name').type).toBe('string');
    expect(getClassSchema(Page).getIndex('id2')!.name).toBe('id2');

    expect(getClassSchema(SuperPage).getProperty('id').type).toBe('string');
    expect(getClassSchema(SuperPage).getProperty('name').type).toBe('string');
    expect(getClassSchema(SuperPage).getProperty('super').type).toBe('number');
    expect(getClassSchema(SuperPage).getIndex('id2')!.name).toBe('id2');

    expect(getClassSchema(Super3).getProperty('id').type).toBe('string');
    expect(getClassSchema(Super3).getProperty('name').type).toBe('string');
    expect(getClassSchema(Super3).getProperty('super').type).toBe('number');
    expect(getClassSchema(Super3).getIndex('id2')!.name).toBe('id2');

    expect(getClassSchema(Super2).getProperty('id').type).toBe('string');
    expect(getClassSchema(Super2).getProperty('name').type).toBe('string');
    expect(getClassSchema(Super2).getProperty('super').type).toBe('number');
    expect(getClassSchema(Super2).getIndex('id2')!.name).toBe('id2');
});


test('test invalid @f', () => {
    class Config {
        @t.optional name?: string;
    }

    expect(() => {
        class User1 {
            @t
                // @ts-ignore
            notDefined;
        }
    }).toThrowError('User1::notDefined type mismatch. Given undefined, but declared is Object or undefined.');

    expect(() => {
        // @ts-ignore
        var NOTEXIST;

        class User2 {
            // @ts-ignore
            @t.type(NOTEXIST)
                // @ts-ignore
            notDefined;
        }
    }).toThrowError('User2::notDefined type mismatch. Given undefined, but declared is Object or undefined.');

    expect(() => {
        class User3 {
            @t
            created = new Date;
        }
    }).toThrowError('User3::created type mismatch. Given undefined, but declared is Object or undefined.');

    expect(() => {
        class User4 {
            @t.type(Config)
            config: Config[] = [];
        }
    }).toThrowError('User4::config type mismatch. Given Config, but declared is Array.');

    expect(() => {
        class User5 {
            @t.array(Config)
            config?: Config;
        }
    }).toThrowError('User5::config type mismatch. Given Config[], but declared is Config.');

    expect(() => {
        class User6 {
            @t.type(Config)
            config: { [k: string]: Config } = {};
        }
    }).toThrowError('User6::config type mismatch. Given Config, but declared is Object or undefined');

    expect(() => {
        class Model {
            @t.array(t.type(() => Config))
            sub?: Config;
        }

    }).toThrowError('Model::sub type mismatch. Given Config[], but declared is Config.');

    expect(() => {
        class Model {
            @t.array(() => undefined)
            sub?: Config;
        }

    }).toThrowError('Model::sub type mismatch. Given ForwardedRef[], but declared is Config.');

    expect(() => {
        class Model {
            @t.map(() => undefined)
            sub?: Config;
        }
    }).toThrowError('Model::sub type mismatch. Given Map<any, ForwardedRef>, but declared is Config.');

    expect(() => {
        class Model {
            @t.map(Config)
            sub?: Config[];
        }

    }).toThrowError('Model::sub type mismatch. Given Map<any, Config>, but declared is Array.');

    {
        //works
        class Model {
            @t.any
            any?: { [k: string]: any };
        }
    }
    {
        //works
        class Model {
            @t.map(t.any)
                // @ts-ignore
            any?;
        }
    }

    {
        //works
        class Model {
            @t.type(() => Config)
            sub?: Config;
        }
    }
});

test('faulty constructor', () => {
    class Faulty {
        constructor(@t public name: string) {
            if (!name) throw new Error('No name given!!');
        }
    }

    const schema = getClassSchema(Faulty);
    expect(() => {
        schema.loadDefaults();
    }).toThrow('Class Faulty constructor is not callable without values');
});