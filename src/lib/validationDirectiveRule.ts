import { GraphQLArgumentConfig, GraphQLFieldConfig, GraphQLInputFieldConfig } from "graphql";
import { ValidationDirectiveRuleOptions } from "../types";
import hash from 'object-hash';
import type { BaseContext } from "@apollo/server";

export type ValidationRuleConstructor = {
  new (options: ValidationDirectiveRuleOptions): ValidationDirectiveRule
};

export abstract class ValidationDirectiveRule<TArgs = Record<string, any>, TSource = any, TContext extends BaseContext = any> {
  private _options: ValidationDirectiveRuleOptions<TArgs>;
  private _hash: string;

  public constructor(options: ValidationDirectiveRuleOptions<TArgs>) {
    this._options = options;
    this._hash = hash(options);
  }

  public get hash() { return this._hash; }
  public get name() { return this._options.name; }
  public get args() { return this._options.args; }

  abstract execute(context: TContext): Promise<void | string | undefined | null | boolean>;

  public appliedToObjectField(field: GraphQLFieldConfig<TSource, TContext, TArgs>): GraphQLFieldConfig<TSource, TContext, TArgs> {
    return field;
  }

  public appliedToInputObjectField(field: GraphQLInputFieldConfig): GraphQLInputFieldConfig {
    return field;
  }

  public appliedToArgument(field: GraphQLArgumentConfig): GraphQLArgumentConfig {
    return field;
  }
}