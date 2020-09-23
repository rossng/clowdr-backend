import { RoleNames } from "clowdr-db-schema/src/classes/DataLayer/Schema/_Role";
import { ConferenceT, Role, RoleT } from "./SchemaTypes";

function generateRoleName(confId: string, roleName: RoleNames): string {
    return confId + "-" + roleName;
}

const adminRoleMap = new Map<string, RoleT>();
export async function getParseAdminRole(conf: ConferenceT): Promise<RoleT> {
    let result = adminRoleMap.get(conf.id);
    if (result) {
        return result;
    }

    let roleQ = new Parse.Query(Role);
    roleQ.equalTo("conference", conf);
    roleQ.equalTo("name", generateRoleName(conf.id, "admin"));
    result = await roleQ.first({ useMasterKey: true });

    if (!result) {
        throw new Error(`Could not get admin role for conference: ${conf.id}`);
    }

    return result;
}

const roleCache = new Map<string, RoleT>();
export async function getOrCreateRole(conf: ConferenceT, roleName: RoleNames): Promise<RoleT> {
    let name = generateRoleName(conf.id, roleName);

    {
        let cachedRole = roleCache.get(name);
        if (cachedRole) {
            return cachedRole;
        }
    }

    let result: RoleT;
    console.log("Get or create role: " + name)
    try {
        var roleQ = new Parse.Query(Role);
        roleQ.equalTo("conference", conf);
        roleQ.equalTo("name", name);
        roleQ.include("users");
        let role = await roleQ.first({ useMasterKey: true });
        if (!role) {
            let roleACL = new Parse.ACL();

            let adminRole = await getParseAdminRole(conf);
            roleACL.setPublicReadAccess(true);
            let newrole = new Role(name, roleACL);
            newrole.getRoles().add(adminRole);

            try {
                newrole = await newrole.save({}, { useMasterKey: true });
            } catch (err) {
                console.error("Could not create new role", err);
            }
            roleCache.set(name, newrole);
            result = newrole;
        } else {
            roleCache.set(name, role);
            result = role;
        }
    } catch (err) {
        console.error("Unable to create role", err);
        throw new Error(`Unable to create role: ${err}`);
    }
    return result;
}


// async function userInRoles(user, allowedRoles) {
//     const roles = await new Parse.Query(Parse.Role).equalTo('users', user).find();
//     return roles.find(r => allowedRoles.find(allowed => r.get("name") === allowed));
// }

// async function sessionTokenIsFromModerator(sessionToken, confID) {
//     let session = await getSession(sessionToken);
//     let user = session.get("user");
//     return await userInRoles(user, [confID + "-moderator", confID + "-admin", confID + "-manager"]);
// }