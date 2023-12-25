import { DocumentNode, GraphQLError, GraphQLSchema, TypeInfo, ValidationContext } from "graphql";
import { ValidationDirectiveRule } from "./validationDirectiveRule";
import { Path } from "@graphql-tools/utils";

export type ValidationRuleCallback = (rule: ValidationDirectiveRule, path: Path) => void;

export class DirectiveValidationContext extends ValidationContext {
  onValidationRule: ValidationRuleCallback;

  constructor(
    schema: GraphQLSchema,
    ast: DocumentNode,
    typeInfo: TypeInfo,
    onError: (error: GraphQLError) => void, // needed for base class
    onValidationRule: ValidationRuleCallback
  ) {
    super(schema, ast, typeInfo, onError);
    this.onValidationRule = onValidationRule;
  }
}