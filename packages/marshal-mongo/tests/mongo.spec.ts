import 'jest-extended';
import 'reflect-metadata';
import {arrayBufferFrom, classToPlain, DatabaseName, Entity, getClassSchema, getDatabaseName, getEntityName, plainToClass, t, uuid,} from '@super-hornet/marshal';
import {Binary, ObjectID} from 'bson';
import * as mongodb from 'mongodb';
import {getInstanceState} from '@super-hornet/marshal-orm';
import {plainToMongo} from '../src/mapping';
import * as moment from 'moment';
import {uuid4Stringify} from '../src/compiler-templates';
import {resolveCollectionName} from '../src/connection';
import {SimpleModel, SuperSimple} from './entities';
import {createDatabaseSession} from './utils';

test('test moment db', async () => {
    @Entity('model-moment')
    class Model {
        @t.primary.mongoId _id?: string;

        @t.moment
        created: moment.Moment = moment();
    }

    const session = await createDatabaseSession('test moment db');

    const m = new Model;
    m.created = moment(new Date('2018-10-13T12:17:35.000Z'));

    await session.immediate.persist(m);
    const m2 = await session.query(Model).findOne();
    expect(m2).toBeInstanceOf(Model);
    expect(moment.isMoment(m2!.created)).toBe(true);
    expect(m2!.created.toJSON()).toBe('2018-10-13T12:17:35.000Z');
});

test('test save undefined values', async () => {
    const session = await createDatabaseSession('test save undefined values');

    @Entity('undefined-model-value')
    class Model {
        @t.primary.mongoId _id?: string;

        constructor(
            @t.optional
            public name?: string) {
        }
    }

    const collection = await session.adapter.connection.getCollection(Model);

    {
        await collection.deleteMany({});
        await session.immediate.persist(new Model(undefined));
        const mongoItem = await collection.find().toArray();
        expect(mongoItem[0].name).toBe(null);
        const marshalItem = await session.query(Model).findOne();
        expect(marshalItem.name).toBe(undefined);
    }

    {
        await collection.deleteMany({});
        await session.immediate.persist(new Model('peter'));
        const mongoItem = await collection.find().toArray();
        expect(mongoItem[0].name).toBe('peter');
    }
});

test('test save model', async () => {
    const session = await createDatabaseSession('testing');

    expect(getEntityName(SimpleModel)).toBe('SimpleModel');

    const instance = plainToClass(SimpleModel, {
        name: 'myName',
    });

    await session.immediate.persist(instance);

    expect(await session.query(SimpleModel).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName'}).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'MyNameNOTEXIST'}).count()).toBe(0);

    expect(await session.query(SimpleModel).has()).toBeTrue();
    expect(await session.query(SimpleModel).filter({name: 'myName'}).has()).toBeTrue();
    expect(await session.query(SimpleModel).filter({name: 'myNameNOTEXIST'}).has()).toBeFalse();

    expect(await session.query(SimpleModel).filter({name: 'myName'}).findOneOrUndefined()).not.toBeUndefined();
    expect(await session.query(SimpleModel).filter({name: 'myNameNOTEXIST'}).findOneOrUndefined()).toBeUndefined();

    await expect(session.query(SimpleModel).filter({name: 'myNameNOTEXIST'}).findOne()).rejects.toThrowError('Item not found');

    const collection = await session.adapter.connection.getCollection(SimpleModel);
    const mongoItem = await collection.find().toArray();

    expect(mongoItem.length).toBe(1);
    expect(mongoItem[0].name).toBe('myName');
    expect(mongoItem[0]._id).toBeInstanceOf(mongodb.ObjectID);
    expect(mongoItem[0].id).toBeInstanceOf(mongodb.Binary);
    expect(uuid4Stringify(mongoItem[0].id)).toBe(instance.id);

    const found = await session.query(SimpleModel).filter({id: instance.id}).findOne();
    expect(found).toBeInstanceOf(SimpleModel);
    expect(found!.name).toBe('myName');
    expect(found!.id).toBe(instance.id);

    const list = await session.query(SimpleModel).filter({id: instance.id}).find();
    expect(list[0]).toBeInstanceOf(SimpleModel);
    expect(list[0].name).toBe('myName');
    expect(list[0].id).toBe(instance.id);

    const listAll = await session.query(SimpleModel).find();
    expect(listAll[0]).toBeInstanceOf(SimpleModel);
    expect(listAll[0].name).toBe('myName');
    expect(listAll[0].id).toBe(instance.id);

    await session.query(SimpleModel).filter({name: 'noneExisting'}).patchOne({name: 'myName2'});

    expect(await session.query(SimpleModel).filter({id: instance.id}).ids(true)).toEqual([instance.id]);
    await session.query(SimpleModel).filter({id: instance.id}).patchOne({name: 'myName2'});

    {
        const found = await session.query(SimpleModel).filter({id: instance.id}).findOne();
        expect(found === instance).toBe(true);
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found!.name).toBe('myName');
    }

    {
        const found = await session.query(SimpleModel).disableIdentityMap().filter({id: instance.id}).findOne();
        expect(found === instance).toBe(false);
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found!.name).toBe('myName2');
    }

    instance.name = 'New Name';
    await session.immediate.persist(instance);
    expect(await session.query(SimpleModel).filter({name: 'MyName'}).has()).toBeFalse();
    expect(await session.query(SimpleModel).filter({name: 'New Name'}).has()).toBeTrue();
});

test('test patchAll', async () => {
    const session = await createDatabaseSession('testing');

    await session.immediate.persist(new SimpleModel('myName1'));
    await session.immediate.persist(new SimpleModel('myName2'));
    await session.immediate.persist(new SimpleModel('peter'));

    expect(await session.query(SimpleModel).filter({name: {$regex: /^myName?/}}).count()).toBe(2);
    expect(await session.query(SimpleModel).filter({name: {$regex: /^peter.*/}}).count()).toBe(1);

    await session.query(SimpleModel).filter({name: {$regex: /^myName?/}}).patchMany({
        name: 'peterNew'
    });

    expect(await session.query(SimpleModel).filter({name: {$regex: /^myName?/}}).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: {$regex: /^peter.*/}}).count()).toBe(3);

    const fields = await session.query(SimpleModel).filter({name: 'peterNew'}).select(['name']).findOne();
    expect(fields!.name).toBe('peterNew');

    const fieldRows = await session.query(SimpleModel).select(['name']).find();
    expect(fieldRows).toBeArrayOfSize(3);
    expect(fieldRows[0].name).toBe('peterNew');
    expect(fieldRows[1].name).toBe('peterNew');
    expect(fieldRows[2].name).toBe('peter');
});

test('test delete', async () => {
    const session = await createDatabaseSession('testing');

    const instance1 = plainToClass(SimpleModel, {
        name: 'myName1',
    });

    const instance2 = plainToClass(SimpleModel, {
        name: 'myName2',
    });

    await session.immediate.persist(instance1);
    await session.immediate.persist(instance2);
    expect(getInstanceState(instance1).isKnownInDatabase()).toBe(true);
    expect(getInstanceState(instance2).isKnownInDatabase()).toBe(true);

    expect(await session.query(SimpleModel).count()).toBe(2);
    expect(await session.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    await session.immediate.remove(instance1);

    expect(getInstanceState(instance1).isKnownInDatabase()).toBe(false);

    expect(await session.query(SimpleModel).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    await session.immediate.remove(instance2);
    expect(getInstanceState(instance2).isKnownInDatabase()).toBe(false);

    expect(await session.query(SimpleModel).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);
    expect(getInstanceState(instance1).isKnownInDatabase()).toBe(false);
    expect(getInstanceState(instance2).isKnownInDatabase()).toBe(false);

    await session.immediate.persist(instance1);
    await session.immediate.persist(instance2);
    expect(getInstanceState(instance1).isKnownInDatabase()).toBe(true);
    expect(getInstanceState(instance2).isKnownInDatabase()).toBe(true);
    expect(await session.query(SimpleModel).count()).toBe(2);

    await session.query(SimpleModel).filter({name: {$regex: /myName[0-9]/}}).deleteMany();
    expect(await session.query(SimpleModel).count()).toBe(0);

    expect(getInstanceState(instance1).isKnownInDatabase()).toBe(false);

    await session.immediate.persist(instance1);
    await session.immediate.persist(instance2);
    expect(await session.query(SimpleModel).count()).toBe(2);

    await session.query(SimpleModel).filter({name: {$regex: /myName[0-9]/}}).deleteOne();
    expect(await session.query(SimpleModel).count()).toBe(1);

    await session.query(SimpleModel).filter({name: {$regex: /myName[0-9]/}}).deleteOne();
    expect(await session.query(SimpleModel).count()).toBe(0);
});

test('test super simple model', async () => {
    const session = await createDatabaseSession('testing-simple-model');

    const instance = plainToClass(SuperSimple, {
        name: 'myName',
    });

    expect(instance._id).toBeUndefined();
    await session.immediate.persist(instance);
    expect(instance._id).not.toBeUndefined();

    {
        const items = await session.query(SuperSimple).find();
        expect(items[0]).toBeInstanceOf(SuperSimple);
        expect(items[0]._id).toBe(instance._id);
        expect(items[0].name).toBe(instance.name);
    }
});

test('test databaseName', async () => {
    const session = await createDatabaseSession('testing-databaseName');
    await (await session.adapter.connection.connect()).db('testing2').dropDatabase();

    @Entity('DifferentDataBase', 'differentCollection')
    @DatabaseName('testing2')
    class DifferentDataBase {
        @t.primary.mongoId
        _id?: string;

        @t
        name?: string;
    }

    const instance = plainToClass(DifferentDataBase, {
        name: 'myName',
    });

    expect(getDatabaseName(DifferentDataBase)).toBe('testing2');
    expect(resolveCollectionName(DifferentDataBase)).toBe('differentCollection');

    expect(instance._id).toBeUndefined();
    await session.immediate.persist(instance);
    expect(instance._id).not.toBeUndefined();

    const collection = await session.adapter.connection.getCollection(DifferentDataBase);
    expect(await collection.countDocuments({})).toBe(1);

    const items = await session.query(DifferentDataBase).find();
    expect(items[0]._id).toBe(instance._id);
    expect(items[0].name).toBe(instance.name);
});

test('no id', async () => {
    const session = await createDatabaseSession('testing');

    @Entity('NoId')
    class NoId {
        @t.mongoId
        _id?: string;

        @t
        name?: string;
    }

    const instance = plainToClass(NoId, {
        name: 'myName',
    });

    await expect(session.immediate.persist(instance)).rejects.toThrow('has no primary field');
});


test('second object id', async () => {
    const session = await createDatabaseSession('testing');

    @Entity('SecondObjectId')
    class SecondObjectId {
        @t.primary.mongoId
        _id?: string;

        @t
        name?: string;

        @t.type(ArrayBuffer)
        preview: ArrayBuffer = arrayBufferFrom('FooBar', 'utf8');

        @t.mongoId
        secondId?: string;
    }

    {
        const instance = plainToMongo(SecondObjectId, {
            _id: '5c8a99d8fdfafb2c8dd59ad6',
            name: 'peter',
            secondId: '5bf4a1ccce060e0b38864c9e',
            preview: 'QmFhcg==', //Baar
        });
        expect(instance._id).toBeInstanceOf(ObjectID);
        expect(instance._id).toEqual(new ObjectID('5c8a99d8fdfafb2c8dd59ad6'));
        expect(instance.secondId).toBeInstanceOf(ObjectID);
        expect(instance.secondId).toEqual(new ObjectID('5bf4a1ccce060e0b38864c9e'));
        expect(instance.name).toBe('peter');
        expect(instance.preview).toBeInstanceOf(Binary);
        expect(instance.preview.toString()).toBe('Baar');
    }


    const instance = plainToClass(SecondObjectId, {
        name: 'myName',
        secondId: '5bf4a1ccce060e0b38864c9e',
        preview: 'QmFhcg==', //Baar
    });

    await session.immediate.persist(instance);

    const dbItem = await session.query(SecondObjectId).filter({name: 'myName'}).findOne();
    expect(dbItem!.name).toBe('myName');

    const dbItemBySecondId = await session.query(SecondObjectId).filter({secondId: '5bf4a1ccce060e0b38864c9e'}).findOne();
    expect(dbItemBySecondId!.name).toBe('myName');

    const collection = await session.adapter.connection.getCollection(SecondObjectId);
    const mongoItem = await collection.find().toArray();
    expect(mongoItem).toBeArrayOfSize(1);
    expect(mongoItem[0].name).toBe('myName');
    expect(mongoItem[0].preview).toBeInstanceOf(mongodb.Binary);
    expect(mongoItem[0].preview.buffer.toString('utf8')).toBe('Baar');

    expect(mongoItem[0]._id).toBeInstanceOf(mongodb.ObjectID);
    expect(mongoItem[0].secondId).toBeInstanceOf(mongodb.ObjectID);
    expect(mongoItem[0]._id.toHexString()).toBe(instance._id);
    expect(mongoItem[0].secondId.toHexString()).toBe(instance.secondId);
});

test('references back', async () => {
    const session = await createDatabaseSession('testing-references-back');

    @Entity('user1')
    class User {
        @t.uuid.primary id: string = uuid();

        @t.array(() => Image).backReference()
        public images: Image[] = [];

        constructor(@t public name: string) {
        }
    }

    @Entity('image1')
    class Image {
        @t.uuid.primary id: string = uuid();

        constructor(
            @t.type(() => User).reference() public user: User,
            @t public title: string,
        ) {
            if (user.images && !user.images.includes(this)) {
                user.images.push(this);
            }
        }
    }

    const userSchema = getClassSchema(User);
    expect(userSchema.getProperty('images').backReference).not.toBeUndefined();
    const imageSchema = getClassSchema(Image);
    // expect(imageSchema.getProperty('userId')).toBeInstanceOf(PropertySchema);
    // expect(imageSchema.getProperty('userId').type).toBe('uuid');

    const marc = new User('marc');
    const peter = new User('peter');
    const marcel = new User('marcel');

    await session.immediate.persist(marc);
    await session.immediate.persist(peter);
    await session.immediate.persist(marcel);

    const image2 = new Image(marc, 'image2');
    await session.immediate.persist(new Image(marc, 'image1'));
    await session.immediate.persist(image2);
    await session.immediate.persist(new Image(marc, 'image3'));

    await session.immediate.persist(new Image(peter, 'image1'));

    {
        expect(getInstanceState(marc).isFromDatabase()).toBe(false);
        expect(getInstanceState(image2).isFromDatabase()).toBe(false);
        const marcFromDb = await session.query(User).joinWith('images').filter({name: 'marc'}).findOne();
        expect(marcFromDb === marc).toBe(true);
        expect(getInstanceState(marcFromDb).isFromDatabase()).toBe(false);

        //make sure that it returns the image2 we already have
        const imageDb = await session.query(Image).joinWith('user').filter({title: 'image2'}).findOne();
        expect(getInstanceState(imageDb).isFromDatabase()).toBe(false);

        expect(imageDb).toBe(image2);
        expect(imageDb.title).toBe('image2');
        expect(imageDb.user).toBeInstanceOf(User);
        //reference is still correct and not overwritten
        expect(imageDb.user.name).toBe('marc');
        expect(imageDb.user).toBe(marc);

        const marcFromDb2 = await session.query(User).joinWith('images').filter({name: 'marc'}).findOne();
        expect(marcFromDb2 === marc).toBe(true);
    }

    {
        const marcFromDb = await session.query(User).disableIdentityMap().filter({name: 'marc'}).findOne();
        expect(getInstanceState(marcFromDb).isFromDatabase()).toBe(true);

        expect(() => {
            marcFromDb.images;
        }).toThrow('images was not populated');
        expect(marcFromDb.id).toBeString();
        expect(marcFromDb.name).toBe('marc');

        const plain = classToPlain(User, marcFromDb);
        expect(plain.id).toBeString();
        expect(plain.name).toBe('marc');
        expect(plain.images).toBeUndefined();
    }

    // {bb nbnn

    {
        const marcFromDb = await session.query(User).joinWith('images').filter({name: 'marc'}).findOne();
        expect(marcFromDb === marc).toBe(true);
        expect(getInstanceState(marcFromDb).isFromDatabase()).toBe(false);
        expect(marcFromDb.name).toBe('marc');
        expect(marcFromDb.images.length).toBe(3);
        expect(marcFromDb.images[0]).toBeInstanceOf(Image);
        expect(marcFromDb.images[1]).toBeInstanceOf(Image);
        expect(marcFromDb.images[2]).toBeInstanceOf(Image);
    }

    {
        const image2 = await session.query(Image).disableIdentityMap().filter({title: 'image2'}).findOne();
        expect(() => {
            image2.user.name;
        }).toThrow(`Can not access User.name since class was not completely hydrated`);
        image2.user.name = 'changed';
        expect(image2.user.name).toBe('changed');
        expect(image2.title).toBe('image2');

        //writing is allowed again
        const mowla = new User('mowla');
        image2.user = mowla;
        image2.user.name = 'mowla2';
        expect(image2.user).toBe(mowla);
    }

    {
        const image2 = await session.query(Image).joinWith('user').filter({title: 'image2'}).findOne();
        expect(image2.title).toBe('image2');
        expect(image2.user).toBeInstanceOf(User);
        expect(image2.user.name).toBe('marc');
    }
});

test('test identityMap', async () => {
    const session = await createDatabaseSession('testing');

    const item = new SimpleModel('myName1');
    await session.immediate.persist(item);

    const pkHash = getInstanceState(item).getLastKnownPKHashOrCurrent();
    const idItem = session.identityMap.getByHash(getClassSchema(SimpleModel), pkHash);
    expect(idItem).toBe(item);

    const dbItem = await session.query(SimpleModel).filter({name: 'myName1'}).findOne();
    expect(dbItem === item).toBe(true);
    expect(dbItem).toBe(item);
});
