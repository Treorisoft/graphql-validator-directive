import { EXTENSION_RULE_PATH } from "../constants";
import { ValidationDirectiveRule } from "./validationDirectiveRule";

interface GraphQLExtensions { [attributeName: string]: unknown }

export function getExtensionRules(extensions?: GraphQLExtensions | null) {
  if (!extensions) {
    return undefined;
  }

  let extensionPath = EXTENSION_RULE_PATH;
  let curObj: any = extensions;
  let pathLength = extensionPath.length;
  for (let i = 0, l = pathLength - 1; i < l; i++) {
    let path = extensionPath[i];
    if (!curObj || !curObj[path]) {
      return undefined;
    }
    curObj = curObj[path];
  }

  if (!curObj || !curObj[extensionPath[pathLength - 1]]) {
    return undefined;
  }

  return curObj[extensionPath[pathLength - 1]] as ValidationDirectiveRule[];
}