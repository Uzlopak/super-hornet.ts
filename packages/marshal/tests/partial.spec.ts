import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {Entity, t, uuid} from "../index";
import {JitPropertyConverter} from "../src/jit";
import {Channel, Job} from "./big-entity";

@Entity('jobModelGraphSnapshotLayer')
class JobModelGraphSnapshotLayer {
    @t.optional
    saved?: Date;

    @t.optional
    outputFilePath?: string;

    @t.optional
    dataFilePath?: string;
}

@Entity('jobModelGraphSnapshot')
class JobModelGraphSnapshot {
    @t.primary.uuid
    id: string = uuid();

    @t version: number = 0;

    @t epoch: number = 0;

    @t step: number = 0;

    @t created: Date = new Date;

    @t graphPath: string = '';

    @t.index()
    live: boolean = false;

    @t.map(JobModelGraphSnapshotLayer)
    layerInfo: { [layerName: string]: JobModelGraphSnapshotLayer } = {};

    constructor(@t.uuid.index().name('job') public job: string) {
    }
}

test('break JitPropertyConverter', () => {
    {
        const converter = new JitPropertyConverter('class', 'plain', Job);
        const c = new Channel();
        c.lastValue = [12, 44];
        c.main = true;
        const v = converter.convert('channels.test123', c);
        expect(v).toEqual({
            kpiTrace: 0,
            lastValue: [12, 44],
            main: true,
            maxOptimization: true,
            traces: [],
        });
    }

    {
        const sl = new JobModelGraphSnapshotLayer();
        sl.saved = new Date;
        sl.outputFilePath = './my/output.path';

        const converter = new JitPropertyConverter('class', 'plain', JobModelGraphSnapshot);
        const v = converter.convert('layerInfo.bla', sl);
        //this breaks when we cache only getCacheKey() for virtual properties schemas
        expect(v).toEqual({
            saved: sl.saved.toJSON(),
            outputFilePath: './my/output.path',
        })
    }
});
