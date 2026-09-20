import { resources, token, adminOrigin } from "./resource-http";
import { ResourceError } from "../services/resource-service";
export async function requireConfigAdmin(request:Request,permission="config.read") {
  adminOrigin(request);
  const actor=await resources.authenticate(token(request,"admin"),"admin");
  if(actor.environment!=="development"||!actor.permissions.includes(permission))throw new ResourceError("FORBIDDEN",403);
  return actor;
}
