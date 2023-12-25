import { GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind, getDirectives, DirectiveAnnotation } from '@graphql-tools/utils';
import { createRule, hasRegisteredRule } from './validationRuleMap';
import { ValidationDirectiveRule } from './validationDirectiveRule';
import { EXTENSION_RULE_PATH } from '../constants';

function notEmpty<T>(value: T | null | undefined): value is T { return value != null; }

function getDirectiveRules(directives: DirectiveAnnotation[]) {
  let mappedDirectives = directives.map(directive => {
    if (!hasRegisteredRule(directive.name)) {
      return null;
    }
    return createRule({ name: directive.name, args: directive.args })
  });

  return mappedDirectives.filter(notEmpty);
}

interface GraphQLExtensions { [attributeName: string]: unknown }
function createExtensionObject(rules: ValidationDirectiveRule[], extensionPath: string[], existing?: GraphQLExtensions | null): GraphQLExtensions | undefined | null {
  if (!rules.length) {
    return existing;
  }

  let newExtension: GraphQLExtensions = {
    ...existing
  };

  let curObj: any = newExtension;
  let pathLength = extensionPath.length;
  for (let i = 0, l = pathLength - 1; i < l; i++) {
    let path = extensionPath[i];
    if (!curObj[path]) {
      curObj[path] = {};
    }
    curObj = curObj[path];
  }
  curObj[extensionPath[pathLength - 1]] = rules;
  return newExtension;
}

export function schemaTransformer(schema: GraphQLSchema, extensionPath: string[] = EXTENSION_RULE_PATH): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (field) => {
      const directives = getDirectives(schema, field);
      const rules = getDirectiveRules(directives);
      
      if (rules.length) {
        field.extensions = createExtensionObject(rules, extensionPath, field.extensions);
        rules.forEach(rule => {
          field = rule.appliedToObjectField(field);
        });
      }

      return field;
    },
    [MapperKind.INPUT_OBJECT_FIELD]: (field) => {
      const directives = getDirectives(schema, field);
      const rules = getDirectiveRules(directives);

      if (rules.length) {
        field.extensions = createExtensionObject(rules, extensionPath, field.extensions);
        rules.forEach(rule => {
          field = rule.appliedToInputObjectField(field);
        });
      }

      return field;
    },
    [MapperKind.ARGUMENT]: (argument) => {
      const directives = getDirectives(schema, argument);
      const rules = getDirectiveRules(directives);

      if (rules.length) {
        argument.extensions = createExtensionObject(rules, extensionPath, argument.extensions);
        rules.forEach(rule => {
          argument = rule.appliedToArgument(argument);
        });
      }
      
      return argument;
    }
  });
}