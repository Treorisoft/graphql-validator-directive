import { FieldNode, GraphQLInputObjectType, visit } from "graphql";
import { VisitorOptions } from "./types";
import { inputValidationVisitor } from "./inputValidationVisitor";
import { DirectiveValidationContext } from "./validationContext";
import { Path } from "./path";

export function validateInputTypeValue(context: DirectiveValidationContext, inputObjectTypeDef: GraphQLInputObjectType, argName: string, variableName: string | undefined, value: unknown, currentField: undefined | FieldNode, parentPath: Path | undefined, options: VisitorOptions) {
  if (!inputObjectTypeDef.astNode) {
    return;
  }

  const visitor = inputValidationVisitor(
    context,
    inputObjectTypeDef,
    argName,
    variableName,
    value,
    currentField,
    parentPath,
    options
  );
  visit(inputObjectTypeDef.astNode, visitor);
}