import { GraphQLResolveInfo } from "graphql";
import { ValidationDirectiveError } from "./errors";
import { Path, addPath, pathToArray } from "@graphql-tools/utils";

export function filterInfoErrorFields(info: GraphQLResolveInfo, errors: ValidationDirectiveError[]) {
  if (!errors?.length) {
    return;
  }

  let possibleMatchingPaths: Path[] = [];
  errors.forEach(err => {
    return err.fieldPaths.some(p => {
      if (pathsStartTheSame(p, info.path) && !pathIsEqual(p, info.path)) {
        possibleMatchingPaths.push(p);
      }
    });
  });

  if (!possibleMatchingPaths.length) {
    return;
  }

  const fieldNodes = info.fieldNodes;
  const selectionSet = fieldNodes[0].selectionSet?.selections ?? [];
  let indexesToRemove: number[] = [];

  for (let i = 0, l = selectionSet.length; i < l; i++){
    let sel = selectionSet[i];
    let selPath = addPath(info.path, (sel as any).name.value, undefined);
    let hasErrorPath = possibleMatchingPaths.some(p => pathIsEqual(p, selPath));
    if (hasErrorPath) {
      indexesToRemove.push(i);
    }
  }

  if (indexesToRemove.length) {
    indexesToRemove.sort((a, b) => b - a);
    for (let idx of indexesToRemove) {
      (fieldNodes[0].selectionSet!.selections as any[]).splice(idx, 1);
      console.log('got here');
    }
  }
}

function pathsStartTheSame(path: Path, startsWith: Path) {
  let startsWithArr = pathToArray(startsWith);
  let pathArr = pathToArray(path);

  // strip out numeric array indicies - paths in path (error paths), won't have arrays - just the type path
  startsWithArr = startsWithArr.filter(v => typeof v === 'string');

  if (pathArr.length < startsWithArr.length) {
    return false;
  }

  let result = true;
  for (let i = 0, l = startsWithArr.length; i < l; i++) {
    if (pathArr[i] != startsWithArr[i]) {
      result = false;
      break;
    }
  }

  return result;
}

function pathIsEqual(path: Path, startsWith: Path) {
  let startsWithArr = pathToArray(startsWith);
  let pathArr = pathToArray(path);

  // strip out numeric array indicies - paths in path (error paths), won't have arrays - just the type path
  startsWithArr = startsWithArr.filter(v => typeof v === 'string');

  if (pathArr.length != startsWithArr.length) {
    return false;
  }

  let result = true;
  for (let i = 0, l = startsWithArr.length; i < l; i++) {
    if (pathArr[i] != startsWithArr[i]) {
      result = false;
      break;
    }
  }

  return result;
}