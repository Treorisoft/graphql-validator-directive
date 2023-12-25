import { ASTVisitor, BREAK, FieldNode, GraphQLField, GraphQLInputObjectType, GraphQLNamedType, GraphQLObjectType, Kind, OperationTypeNode, getNamedType, getVariableValues, isInputObjectType, isListType, isNonNullType, isObjectType, typeFromAST, valueFromAST } from "graphql";
import { Maybe } from "graphql/jsutils/Maybe";
import { VisitorOptions } from "./types";
import { validateInputTypeValue } from "./validateInputTypeValue";
import { validateArrayTypeValue } from "./validateArrayTypeValue";
import { DirectiveValidationContext } from "./validationContext";
import { getExtensionRules } from "./getExtensionRules";
import { addPath, Path } from "@graphql-tools/utils";

type PossibleTypes = GraphQLNamedType | Maybe<GraphQLObjectType>;

interface CurrentTypeInfo {
  parent?: CurrentTypeInfo
  typeDef: PossibleTypes | undefined
}

export function queryValidationVisitor(context: DirectiveValidationContext, options: VisitorOptions): ASTVisitor {
  let currentTypeInfo: CurrentTypeInfo | undefined;
  let variableValues: undefined | { [variable: string]: unknown };
  let currentField: undefined | FieldNode;
  let currentFieldDef: GraphQLField<any, any, any> | undefined;
  let currentPath: Path | undefined;

  return {
    FragmentDefinition: {
      enter: (node) => {
        const newTypeDef = typeFromAST(context.getSchema(), node.typeCondition);
        currentTypeInfo = { parent: currentTypeInfo, typeDef: newTypeDef };
      },
      leave: () => {
        currentTypeInfo = currentTypeInfo?.parent;
      }
    },
    OperationDefinition: {
      enter: (operation) => {
        if (typeof options.operationName === 'string' && options.operationName !== operation.name?.value) {
          return;
        }
        
        variableValues = getVariableValues(
          context.getSchema(),
          operation.variableDefinitions ?? [],
          options.variables ?? {}
        ).coerced;

        let typeDef: Maybe<GraphQLObjectType>;
        switch (operation.operation) {
          case OperationTypeNode.QUERY:
            typeDef = context.getSchema().getQueryType();
            break;
          case OperationTypeNode.MUTATION:
            typeDef = context.getSchema().getMutationType();
            break;
          case OperationTypeNode.SUBSCRIPTION:
            typeDef = context.getSchema().getSubscriptionType();
            break;
          default:
            throw new Error(`Query validation could not be performed for operation of type ${operation.operation}`);
        }

        currentTypeInfo = { typeDef };
      }
    },
    Field: {
      enter: (node, key, _parent, path) => {
        currentField = node;

        if (isObjectType(currentTypeInfo?.typeDef)) {
          currentFieldDef = currentTypeInfo?.typeDef.getFields()[node.name.value]
        }

        currentPath = addPath(currentPath, node.name.value, currentTypeInfo?.typeDef?.name);

        if (currentFieldDef) {
          const newTypeDef = getNamedType(currentFieldDef.type);
          currentTypeInfo = { parent: currentTypeInfo, typeDef: newTypeDef };
          
          let validationRules = getExtensionRules(currentFieldDef.extensions);
          if (validationRules?.length) {
            validationRules.forEach(rule => {
              context.onValidationRule(rule, currentPath!);
            });
          }
        } else {
          return BREAK;
        }
      },
      leave: () => {
        currentTypeInfo = currentTypeInfo?.parent;
        currentPath = currentPath?.prev;
      }
    },
    Argument: {
      enter: (arg, _key, _parent, path) => {
        const argName = arg.name.value;
        const argTypeDef = currentFieldDef?.args.find(d => d.name === argName);

        if (!argTypeDef) {
          return;
        }

        currentPath = addPath(currentPath, arg.name.value, (argTypeDef.type as any).name);

        let validationRules = getExtensionRules(argTypeDef.extensions);
        if (validationRules?.length) {
          validationRules.forEach(rule => {
            context.onValidationRule(rule, currentPath!);
          });
        }

        const value = valueFromAST(arg.value, argTypeDef.type, variableValues);

        let variableName: string | undefined;
        if (arg.value.kind === Kind.VARIABLE) {
          variableName = arg.value.name.value;
        }

        let valueTypeDef = argTypeDef.type;

        if (isNonNullType(valueTypeDef)) {
          valueTypeDef = valueTypeDef.ofType;
        }

        if (isInputObjectType(valueTypeDef)) {
          if (!value) {
            return; // nothing to validate
          }

          const inputObjectTypeDef = getNamedType(valueTypeDef);
          validateInputTypeValue(context, inputObjectTypeDef as GraphQLInputObjectType, argName, variableName, value, currentField, currentPath, options);
        }
        else if (isListType(valueTypeDef)) {
          validateArrayTypeValue(context, valueTypeDef, argTypeDef, value, currentField, argName, variableName, currentPath, options);
        }
      },
      leave: () => {
        currentPath = currentPath?.prev;
      }
    },
    InlineFragment: {
      enter: (node) => {
        const newTypeDef = typeFromAST(context.getSchema(), node.typeCondition!);
        currentTypeInfo = { parent: currentTypeInfo, typeDef: newTypeDef };
      },
      leave: () => {
        currentTypeInfo = currentTypeInfo?.parent;
      }
    }
  }
}