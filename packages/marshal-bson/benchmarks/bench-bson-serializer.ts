import 'reflect-metadata';
import {calculateObjectSize, serialize} from 'bson';
import * as BSON from 'bson-ext';
import {BenchSuite} from '@super-hornet/core';
import {t} from '@super-hornet/marshal';
import {createBSONSizer, getBSONSerializer} from '../src/bson-serialize';

const bsonNative = new BSON([BSON.Binary, BSON.Code, BSON.DBRef, BSON.Decimal128, BSON.Double, BSON.Int32, BSON.Long, BSON.Map, BSON.MaxKey, BSON.MinKey, BSON.ObjectId, BSON.BSONRegExp, BSON.Symbol, BSON.Timestamp]);

const itemSchema = t.schema('Item', {
    id: t.number,
    name: t.string,
    ready: t.boolean,
    priority: t.number,
    tags: t.array(t.string),
});
const items: any[] = [];

const count = 10_000;
for (let i = 0; i < count; i++) {
    items.push({
        // _id: new ObjectId(),
        id: i,
        name: 'Peter',
        ready: true,
        priority: 0,
        tags: ['a', 'b', 'c', 'd'],
    });
}

const schema = t.schema('schema', {
    cursor: {
        firstBatch: t.array(itemSchema)
    }
});

const suite = new BenchSuite(`BSON serializer array of ${count} items`);
const data = {cursor: {firstBatch: items}};

const serializer = getBSONSerializer(schema);
const bson = serializer({cursor: {firstBatch: [items[0]]}});
console.log('buffer official size', calculateObjectSize(items[0]));
console.log('buffer marshal size', createBSONSizer(itemSchema)(items[0]));

console.log('buffer marshal ', getBSONSerializer(itemSchema)(items[0]));
console.log('buffer official', serialize(items[0]));
// const parsed = createBSONParser(itemSchema)(serializer({cursor: {firstBatch: [items[0]]}}));
// console.log('buffer parsed', parsed.cursor.firstBatch[0]);

// process.exit(1);

// const buffer = Buffer.alloc(16);
// const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

// suite.add('Buffer 4x uint8', () => {
//     buffer[0] = 2;
//     buffer[1] = 4;
//     buffer[2] = 8;
//     buffer[3] = 12;
// });
//
// suite.add('DataView setUint8', () => {
//     dataView.setUint8(0, 2);
//     dataView.setUint8(1, 4);
//     dataView.setUint8(2, 8);
//     dataView.setUint8(3, 12);
// });
//
// suite.add('DataView setUint32', () => {
//     dataView.setUint32(0, 23344, true)
// });

const sizer = createBSONSizer(schema);
suite.add('Marshal sizer', () => {
    const size = sizer(data);
    Buffer.alloc(size);
});

suite.add('js-bson calculateObjectSize', () => {
    const size = calculateObjectSize(data);
    Buffer.alloc(size);
});

suite.add('Marshal stringify', () => {
    serializer(data);
});

suite.add('BSON js serialize', () => {
    serialize(data);
});

suite.add('BSON native serialize', () => {
    bsonNative.serialize(data);
});

suite.add('JSON.stringify', () => {
    JSON.stringify(data);
});

suite.run();

