import { FieldNode, GraphQLArgument, GraphQLInputType, GraphQLList, isInputObjectType, isNonNullType } from "graphql";
import { validateInputTypeValue } from "./validateInputTypeValue";
import { VisitorOptions } from "./types";
import { DirectiveValidationContext } from "./validationContext";
import { Path, addPath } from "./path";

export function validateArrayTypeValue(context: DirectiveValidationContext, valueTypeDef: GraphQLList<GraphQLInputType>, typeDefWithDirective: GraphQLArgument, value: unknown, currentField: FieldNode | undefined, argName: string, variableName: string | undefined, parentPath: Path | undefined, options: VisitorOptions) {
  if (!typeDefWithDirective.astNode) {
    return;
  }

  let valueTypeDefArray = valueTypeDef.ofType;
  if (isNonNullType(valueTypeDefArray)) {
    valueTypeDefArray = valueTypeDefArray.ofType;
  }

  if (isArrayLike(value)) {
    let iterator = value[Symbol.iterator]();
    
    let index = 0;
    while (true) {
      const iteratorElement = iterator.next();
      if (iteratorElement.done) {
        break; // exit the while loop
      }
      
      const currentPath = addPath(parentPath, index, undefined, undefined);
      const element = iteratorElement.value;

      if (isInputObjectType(valueTypeDefArray)) {
        validateInputTypeValue(context, valueTypeDefArray, argName, variableName, element, currentField, currentPath, options);
      }
    }
    
  }
}

function isArrayLike(value: unknown): value is Iterable<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  
  const hasIterator = typeof (value as any)[Symbol.iterator] === 'function';
  // more checks??
  return hasIterator;
}