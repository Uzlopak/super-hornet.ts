import 'jest-extended';
import 'reflect-metadata';
import {Entity, t, getClassSchema, MultiIndex} from "../src/decorators";
import {uuid} from "../src/utils";
import {getCollectionName} from "../src/mapper";
import {ClassType} from '@super-hornet/core';


@Entity('user2')
class User {
    @t.uuid.primary
    id: string = uuid();

    @t.array(() => Organisation).backReference({via: () => OrganisationMembership})
    organisations: Organisation[] = [];

    //self reference
    @t.optional.reference()
    manager?: User;

    @t.array(User).backReference()
    managedUsers: User[] = [];

    constructor(@t public name: string) {
    }
}

@Entity('organisation2', 'organisations2')
class Organisation {
    @t.uuid.primary
    id: string = uuid();

    @t.array(User).backReference({mappedBy: 'organisations', via: () => OrganisationMembership})
    users: User[] = [];

    constructor(
        @t public name: string,
        @t.reference() public owner: User,
    ) {
    }
}

@Entity('organisation_member2')
@MultiIndex(['user', 'organisation'])
class OrganisationMembership {
    @t.uuid.primary
    id: string = uuid();

    constructor(
        @t.reference().index() public user: User,
        @t.reference().index() public organisation: Organisation,
    ) {
    }
}

test('test reverse ref', async () => {
    const userSchema = getClassSchema(User);
    const organisationSchema = getClassSchema(Organisation);
    const pivotSchema = getClassSchema(OrganisationMembership);

    expect(getCollectionName(Organisation)).toBe('organisations2');

    {
        const backRef = userSchema.findReverseReference(User, userSchema.getProperty('managedUsers'));
        expect(backRef.name).toBe('manager');
    }

    {
        const backRef = userSchema.findReverseReference(User, userSchema.getProperty('manager'));
        expect(backRef.getForeignKeyName()).toBe('managedUsers');
        expect(backRef.name).toBe('managedUsers');
    }

    {
        const backRef = organisationSchema.findReverseReference(User, userSchema.getProperty('organisations'));
        expect(backRef.name).toBe('users');
    }

    {
        //test pivot resolution
        //from user.organisations, OrganisationMembership->User (join to the left)
        const backRef = pivotSchema.findReverseReference(User, userSchema.getProperty('organisations'));
        expect(backRef.name).toBe('user');
    }

    {
        //test pivot resolution
        //from user.organisations, OrganisationMembership->Organisation (join to the right)
        const backRef = pivotSchema.findReverseReference(Organisation, userSchema.getProperty('organisations'));
        expect(backRef.name).toBe('organisation');
    }


    {
        //test regular OrganisationMembership->Organisation, from Organisation.users
        const backRef = pivotSchema.findReverseReference(Organisation, organisationSchema.getProperty('users'));
        expect(backRef.name).toBe('organisation');
    }

    //probably wrong
    {
        const backRef = userSchema.findReverseReference(Organisation, organisationSchema.getProperty('owner'));
        //todo, this is probably not correct
        expect(backRef.name).toBe('organisations');
    }
});
