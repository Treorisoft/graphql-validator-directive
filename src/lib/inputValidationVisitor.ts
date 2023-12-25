import { ASTVisitor, FieldNode, GraphQLInputObjectType, GraphQLInputType, GraphQLList, Kind, isInputObjectType, isInputType, isListType, typeFromAST } from "graphql";
import { VisitorOptions } from "./types";
import { validateInputTypeValue } from "./validateInputTypeValue";
import { validateArrayTypeValue } from "./validateArrayTypeValue";
import { DirectiveValidationContext } from "./validationContext";
import { getExtensionRules } from "./getExtensionRules";
import { Path, addPath } from "./path";

export function inputValidationVisitor(context: DirectiveValidationContext, inputObjectTypeDef: GraphQLInputObjectType, argName: string, variableName: string | undefined, value: unknown, currentField: undefined | FieldNode, parentPath: Path | undefined, options: VisitorOptions): ASTVisitor {

  return {
    InputValueDefinition: {
      enter: (node) => {
        const iFieldName = node.name.value;
        const iFieldTypeDef = inputObjectTypeDef.getFields()[iFieldName];
        const currentPath = addPath(parentPath, iFieldName, (iFieldTypeDef.type as any).name, true);
        // @ts-ignore
        const lvalue = value[iFieldName];

        if (typeof lvalue === 'undefined') {
          // it's undefined... no need to go further down
          return;
        }

        let valueTypeAst = node.type;
        if (valueTypeAst.kind === Kind.NON_NULL_TYPE) {
          valueTypeAst = valueTypeAst.type;
        }

        let validationRules = getExtensionRules(iFieldTypeDef.extensions);
        if (validationRules?.length) {
          validationRules.forEach(rule => {
            context.onValidationRule(rule, currentPath);
          });
        }

        const valueTypeDef = typeFromAST(context.getSchema(), valueTypeAst);
        if (isInputObjectType(valueTypeDef)) {
          if (!lvalue) {
            return;
          }
          validateInputTypeValue(context, valueTypeDef, argName, variableName, lvalue, currentField, currentPath, options);
        }
        else if (isInputListType(valueTypeDef)) {
          validateArrayTypeValue(context, valueTypeDef, iFieldTypeDef, lvalue, currentField, argName, variableName, currentPath, options);
        }
      }
    }
  }
}

function isInputListType(type: unknown): type is GraphQLList<GraphQLInputType> {
  return (isListType(type) && isInputType(type));
}