import { ASTVisitor, BREAK, FieldNode, GraphQLField, GraphQLInputObjectType, GraphQLNamedType, GraphQLObjectType, Kind, OperationTypeNode, getNamedType, getVariableValues, isInputObjectType, isListType, isNonNullType, isObjectType, typeFromAST, valueFromAST } from "graphql";
import { Maybe } from "graphql/jsutils/Maybe";
import { VisitorOptions } from "./types";
import { validateInputTypeValue } from "./validateInputTypeValue";
import { validateArrayTypeValue } from "./validateArrayTypeValue";
import { DirectiveValidationContext } from "./validationContext";
import { getExtensionRules } from "./getExtensionRules";
import { addPath, Path, pathHasSkip, replaceRoot } from "./path";
import { shouldIncludeNode } from "@graphql-tools/utils";
import { ValidationDirectiveRule } from "./validationDirectiveRule";

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
  let currentFragmentName: string | undefined;
  let fragmentRuleMap: Map<string, Array<{ rule: ValidationDirectiveRule, path: Path }>> = new Map();

  return {
    FragmentDefinition: {
      enter: (node) => {
        const newTypeDef = typeFromAST(context.getSchema(), node.typeCondition);
        currentTypeInfo = { parent: currentTypeInfo, typeDef: newTypeDef };
        currentFragmentName = node.name.value;
      },
      leave: () => {
        currentTypeInfo = currentTypeInfo?.parent;
        currentFragmentName = undefined;
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

        const shouldInclude = shouldIncludeNode(variableValues, node);
        currentPath = addPath(currentPath, {
          key: node.alias?.value || node.name.value,
          typename: currentTypeInfo?.typeDef?.name,
          skipped: shouldInclude === false,
        });

        if (currentFieldDef) {
          const newTypeDef = getNamedType(currentFieldDef.type);
          currentTypeInfo = { parent: currentTypeInfo, typeDef: newTypeDef };
          
          if (pathHasSkip(currentPath)) {
            return;
          }

          let validationRules = getExtensionRules(currentFieldDef.extensions);
          if (validationRules?.length) {
            if (currentFragmentName) {
              if (!fragmentRuleMap.has(currentFragmentName)) {
                fragmentRuleMap.set(currentFragmentName, []);
              }
              validationRules.forEach(rule => {
                fragmentRuleMap.get(currentFragmentName!)!.push({ rule, path: currentPath! });
              });
            }
            else {
              validationRules.forEach(rule => {
                context.onValidationRule(rule, currentPath!);
              });
            }
          }
        } else {
          const rawFieldDef = context.getFieldDef();
          if (rawFieldDef) {
            // couldn't find field def on parent type, but it exists in schema, so likely an error with the parent type definition or its an introspection field.
            const rawTypeDef = getNamedType(rawFieldDef.type);
            currentTypeInfo = { parent: currentTypeInfo, typeDef: rawTypeDef };
            // TODO: add warning capability for non-instropection fields that can't be found on the parent type
            return;
          }
          return BREAK;
        }
      },
      leave: () => {
        currentTypeInfo = currentTypeInfo?.parent;
        currentPath = currentPath?.prev as Path | undefined;
      }
    },
    Argument: {
      enter: (arg, _key, _parent, path) => {
        const argName = arg.name.value;
        const argTypeDef = currentFieldDef?.args.find(d => d.name === argName);

        // always need to addPath so that "leave" works properly
        currentPath = addPath(currentPath, {
          key: arg.name.value,
          typename: (argTypeDef?.type as any)?.name || 'unknown',
          is_input: true,
        });

        if (!argTypeDef) {
          return;
        }

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
        currentPath = currentPath?.prev as Path | undefined;
      }
    },
    InlineFragment: {
      enter: (node) => {
        const newTypeDef = typeFromAST(context.getSchema(), node.typeCondition!);
        currentTypeInfo = { parent: currentTypeInfo, typeDef: newTypeDef };

        const shouldInclude = shouldIncludeNode(variableValues, node);
        currentPath = addPath(currentPath, {
          key: `.`, // mostly for print debugging purposes - fragments don't have a key like fields/args do, so just leave it blank, and this shouldn't ever be directly walked when filtering
          typename: currentTypeInfo?.typeDef?.name,
          skipped: shouldInclude === false,
        });
      },
      leave: () => {
        currentTypeInfo = currentTypeInfo?.parent;
        currentPath = currentPath?.prev as Path | undefined;
      }
    },
    FragmentSpread: {
      enter: (node) => {
        const shouldInclude = shouldIncludeNode(variableValues, node);
        if (shouldInclude) {
          const fragmentName = node.name.value;
          const fragmentRules = fragmentRuleMap.get(fragmentName);
          if (fragmentRules?.length) {
            fragmentRules.forEach(({ rule, path }) => {
              let adjustedPath = replaceRoot(path, addPath(currentPath!, {
                key: fragmentName,
                typename: currentTypeInfo?.typeDef?.name,
              }));
              context.onValidationRule(rule, adjustedPath);
            });
          }
        }
      },
      leave: () => {

      }
    }
  }
}