import {t} from "../../src/decorators";
import {PageClass} from "./PageClass";

export class PageCollection {
    constructor(
        @t.array(() => PageClass).decorated
        private readonly pages: PageClass[] = []
    ) {
    }

    public get(index: number): PageClass | null {
        return this.pages[index] || null
    }

    public count(): number {
        return this.pages.length;
    }
}
