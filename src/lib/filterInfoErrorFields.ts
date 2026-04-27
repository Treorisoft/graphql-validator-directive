import { ASTVisitor, GraphQLResolveInfo, TypeInfo, ValidationContext, visit, visitWithTypeInfo } from "graphql";
import { ValidationDirectiveError } from "./errors";
import { pathToArray } from "@graphql-tools/utils";
import { Path, addPath, printPath } from './path';
import { walkInfoSelections } from "./walkselection";

export function filterInfoErrorFields(info: GraphQLResolveInfo, errors: ValidationDirectiveError[]) {
  if (!errors?.length) {
    return;
  }

  const errorTuples = new Set<string>();
  errors.forEach(err => {
    err.fieldPaths.some(p => {
      errorTuples.add(`${p.typename}:${p.key}`);
    });
  });

  if (!errorTuples.size) {
    return;
  }

  walkInfoSelections(info, ({ node, path, type, namedType, parentType }) => {
    let tupleKey = `${parentType.name}:${node.name.value}`;
    if (errorTuples.has(tupleKey)) {
      return false;
    }
  });
}