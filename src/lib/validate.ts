import { DocumentNode, GraphQLSchema, TypeInfo, visit, visitWithTypeInfo } from "graphql";
import { ValidationOptions, VariableValues } from "../types";
import { DirectiveValidationContext } from "./validationContext";
import { queryValidationVisitor } from "./queryValidationVisitor";
import { ValidationDirectiveError } from "./errors";
import { ValidationDirectiveRule } from "./validationDirectiveRule";
import type { BaseContext } from "@apollo/server";
import { Path } from "@graphql-tools/utils";

export async function validate(schema: GraphQLSchema, query: DocumentNode, resolverContext: BaseContext, variables?: VariableValues, operationName?: string, pluginOptions?: ValidationOptions) {
  const typeInfo = new TypeInfo(schema);

  const validationRules: Map<ValidationDirectiveRule, Path[]> = new Map();
  const context = new DirectiveValidationContext(
    schema,
    query,
    typeInfo,
    (_) => {},
    (rule, path) => {
      if (!validationRules.has(rule)) {
        validationRules.set(rule, []);
      }
      validationRules.get(rule)!.push(path);
    }
  );

  const visitor = queryValidationVisitor(context, {
    variables,
    operationName,
    pluginOptions,
  });

  visit(query, visitWithTypeInfo(typeInfo, visitor));

  let ruleResults: Map<string, true | ValidationDirectiveError> = new Map();
  if (validationRules.size) {
    // run through alls the validations, collecting errors
    for (let rule of validationRules.keys()) {
      if (ruleResults.has(rule.hash)) {
        continue;
      }

      const ruleFields = validationRules.get(rule)!;

      try {
        let result = await rule.execute(resolverContext);
        if (result == null || result === true) {
          ruleResults.set(rule.hash, true);
        }
        else if (typeof result === 'string') {
          ruleResults.set(rule.hash, new ValidationDirectiveError(result, ruleFields, false));
        }
        else if (result === false) {
          ruleResults.set(rule.hash, new ValidationDirectiveError(`Directive validation ${rule.name} failed`, ruleFields, false));
        }
        else {
          console.error('INVALID directive rule execution result');
        }
      }
      catch (err) {
        let vErr = err;
        if (!(err instanceof ValidationDirectiveError)) {
          if (err instanceof Error) {
            vErr = new ValidationDirectiveError(err.message, ruleFields, true, err);
          }
          else {
            vErr = new ValidationDirectiveError(`${err}`, ruleFields, true);
          }
        }
        
        ruleResults.set(rule.hash, vErr as ValidationDirectiveError);
      }
    }
  }

  let errorResults = [...ruleResults.values()].filter(isValidationDirectiveError);
  return errorResults;
}

function isValidationDirectiveError(value: true | ValidationDirectiveError): value is ValidationDirectiveError {
  return value !== true;
}